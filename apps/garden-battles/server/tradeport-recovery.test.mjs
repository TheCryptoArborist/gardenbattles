import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deferTradeportEvent, retryDeferredTradeportEvents} from './tradeport-recovery.mjs';

const stream = 'legacy-buy';
const receipt = (n = 1) => ({
  cursor: `opaque-${n}`,
  node: {
    contents: {type: {repr: stream}, json: {nft_id: `0x${n}`, buyer: '0xab', price: '25000000000'}},
    transaction: {digest: `tx-${n}`},
  },
});
const saleKey = event => `sale:${event.transaction.digest}:${event.contents.json.nft_id}`;
const format = event => ({saleKey: saleKey(event), text: event.transaction.digest});
const quiet = () => {};
const initial = () => ({cursors: {[stream]: 'baseline'}, unrelatedState: {keep: true}});

async function enqueue(state, n = 1, options = {}) {
  return deferTradeportEvent(stream, receipt(n), state, {save: quiet, now: () => 1000, log: quiet, ...options});
}

async function retry(state, options = {}) {
  return retryDeferredTradeportEvents(state, {
    prepare: async event => event, send: async () => {}, format,
    save: quiet, now: () => 31000, log: quiet, ...options,
  });
}

test('deferral persists full receipt and advanced cursor in one snapshot before continuing', async () => {
  const state = initial(); const snapshots = [];
  const edge = receipt(); edge.node.additional = {preserve: ['full', 'event']};
  const saved = await deferTradeportEvent(stream, edge, state, {
    now: () => 1000, log: quiet, error: new Error('metadata absent'),
    save: () => snapshots.push(JSON.parse(JSON.stringify(state))),
  });
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].cursors[stream], edge.cursor);
  assert.deepEqual(snapshots[0].pendingTradeportEvents[0].event, edge.node);
  assert.equal(saved.firstSeenAt, 1000);
  assert.equal(saved.nextRetryAt, 31000);
  assert.equal(saved.attempts, 0);
  assert.equal(saved.lastError, 'metadata absent');
  edge.node.additional.preserve.push('later mutation');
  assert.equal(saved.event.additional.preserve.length, 2);
  assert.deepEqual(state.unrelatedState, {keep: true});
  // Advancing to this durable cursor lets the caller process the following sale.
  const following = receipt(2); state.cursors[stream] = following.cursor;
  state.deliveredSales = [saleKey(following.node)];
  assert.equal(state.pendingTradeportEvents.length, 1);
  assert.equal(state.pendingTradeportEvents[0].saleKey, saleKey(receipt().node));
});

test('a persisted restart recovers once and retains unrelated notifier state', async () => {
  const state = initial(); let persisted;
  await enqueue(state, 1, {save: () => { persisted = JSON.stringify(state); }});
  const restarted = JSON.parse(persisted); const sent = [];
  const result = await retry(restarted, {
    send: async message => sent.push(message), save: () => { persisted = JSON.stringify(restarted); },
  });
  assert.deepEqual(result, {processed: 1, delivered: 1, skipped: 0, failed: 0, pending: 0});
  assert.equal(sent.length, 1);
  assert.deepEqual(JSON.parse(persisted).pendingTradeportEvents, []);
  assert.deepEqual(restarted.deliveredSales, [saleKey(receipt().node)]);
  assert.deepEqual(restarted.unrelatedState, {keep: true});
  await retry(JSON.parse(persisted), {send: async () => assert.fail('duplicate')});
});

test('same deferred stream/cursor is idempotent and retains original retry progress', async () => {
  const state = initial(); await enqueue(state);
  await retry(state, {prepare: async () => { throw new Error('still absent'); }});
  const expected = structuredClone(state.pendingTradeportEvents[0]);
  await enqueue(state, 1, {now: () => 90000, maxPending: 1});
  assert.deepEqual(state.pendingTradeportEvents, [expected]);
});

test('pending receipt delivered through another stream is removed without metadata lookup', async () => {
  const state = initial(); await enqueue(state);
  state.deliveredSales = [saleKey(receipt().node)];
  const result = await retry(state, {
    prepare: async () => assert.fail('metadata lookup'), send: async () => assert.fail('duplicate send'),
  });
  assert.equal(result.skipped, 1); assert.deepEqual(state.pendingTradeportEvents, []);
});

test('delivery history is checked again after preparing and formatting the receipt', async () => {
  const state = initial(); await enqueue(state);
  await retry(state, {
    prepare: async event => { state.deliveredSales = [saleKey(event)]; return event; },
    send: async () => assert.fail('duplicate send'),
  });
  assert.deepEqual(state.pendingTradeportEvents, []);
});

test('two streams for the same receipt deduplicate, while two NFTs in one transaction both deliver', async () => {
  const state = initial(); await enqueue(state);
  await deferTradeportEvent('second-stream', receipt(), state, {save: quiet, now: () => 1000, log: quiet});
  const secondNft = receipt(2); secondNft.node.transaction.digest = 'tx-1';
  await deferTradeportEvent(stream, secondNft, state, {save: quiet, now: () => 1000, log: quiet});
  const sent = []; await retry(state, {send: async message => sent.push(message.saleKey)});
  assert.deepEqual(sent.sort(), ['sale:tx-1:0x1', 'sale:tx-1:0x2']);
  assert.deepEqual(state.pendingTradeportEvents, []);
});

test('historical metadata proving another collection resolves without an alert', async () => {
  const state = initial(); await enqueue(state);
  const result = await retry(state, {prepare: async () => null, send: async () => assert.fail('unrelated alert')});
  assert.equal(result.skipped, 1); assert.deepEqual(state.pendingTradeportEvents, []);
  assert.equal(Object.hasOwn(state, 'deliveredSales'), false);
});

test('deferral save failure restores cursor and absence of pending state', async () => {
  const state = initial(); const before = structuredClone(state);
  await assert.rejects(enqueue(state, 1, {save: async () => { throw new Error('disk full'); }}), /disk full/);
  assert.deepEqual(state, before);
});

test('a full queue rejects new receipts without changing any cursor or old record', async () => {
  const state = initial(); await enqueue(state); const before = structuredClone(state);
  await assert.rejects(enqueue(state, 2, {maxPending: 1}), /queue is full/);
  assert.deepEqual(state, before);
});

test('corrupt pending state fails closed instead of replacing or dropping records', async () => {
  for (const invalid of [null, {}, [{key: 'broken'}]]) {
    const state = {...initial(), pendingTradeportEvents: invalid}; const before = structuredClone(state);
    await assert.rejects(enqueue(state), /Corrupt pending/);
    await assert.rejects(retry(state), /Corrupt pending/);
    assert.deepEqual(state, before);
  }
  const state = initial(); await enqueue(state);
  state.pendingTradeportEvents.push(structuredClone(state.pendingTradeportEvents[0]));
  await assert.rejects(retry(state), /Corrupt pending/);
});

test('lookup and Telegram failures stay durable and use exponential backoff capped at an hour', async () => {
  const state = initial(); await enqueue(state); let clock = 31000;
  const original = structuredClone(state.pendingTradeportEvents[0].event);
  for (let attempt = 1; attempt <= 12; attempt++) {
    const options = attempt % 2
      ? {prepare: async () => { throw new Error('lookup offline'); }}
      : {send: async () => { throw new Error('Telegram offline'); }};
    const result = await retry(state, {...options, now: () => clock});
    const pending = state.pendingTradeportEvents[0];
    assert.equal(result.failed, 1); assert.equal(pending.attempts, attempt);
    assert.equal(pending.nextRetryAt - clock, Math.min(3600000, 30000 * 2 ** (attempt - 1)));
    assert.deepEqual(pending.event, original);
    clock = pending.nextRetryAt;
  }
  assert.equal(state.pendingTradeportEvents.length, 1);
});

test('retry limits and due times are fair to receipts not attempted in the previous batch', async () => {
  const state = initial(); for (let n = 1; n <= 5; n++) await enqueue(state, n);
  const seen = [];
  const options = {limit: 2, prepare: async event => { seen.push(event.transaction.digest); throw new Error('absent'); }};
  await retry(state, {...options, now: () => 30999}); assert.deepEqual(seen, []);
  await retry(state, options); assert.equal(seen.length, 2);
  await retry(state, options); assert.equal(seen.length, 4);
  await retry(state, options); assert.equal(seen.length, 5);
  assert.equal(new Set(seen).size, 5);
  assert.equal(state.pendingTradeportEvents.length, 5);
});

test('retry backoff save failure propagates and restores the entire unresolved record', async () => {
  const state = initial(); await enqueue(state); const before = structuredClone(state);
  await assert.rejects(retry(state, {
    prepare: async () => { throw new Error('lookup failure'); },
    save: () => { throw new Error('persistence failure'); },
  }), /persistence failure/);
  assert.deepEqual(state, before);
});

test('successful send followed by a failed save retains receipt and delivery history for recovery', async () => {
  const state = initial(); await enqueue(state); state.deliveredSales = ['prior-sale'];
  const before = structuredClone(state); let sends = 0;
  await assert.rejects(retry(state, {
    send: async () => { sends++; }, save: async () => { throw new Error('save rejected'); },
  }), /save rejected/);
  assert.equal(sends, 1); assert.deepEqual(state, before);
});

test('resolved unrelated receipt is retained if its removal cannot be persisted', async () => {
  const state = initial(); await enqueue(state); const before = structuredClone(state);
  await assert.rejects(retry(state, {
    prepare: async () => null, save: () => { throw new Error('read only disk'); },
  }), /read only disk/);
  assert.deepEqual(state, before);
});

test('invalid recovered identity remains pending and never sends a mismatched sale', async () => {
  const state = initial(); await enqueue(state);
  await retry(state, {format: () => ({saleKey: 'different-sale'}), send: async () => assert.fail('wrong sale')});
  assert.equal(state.pendingTradeportEvents.length, 1);
  assert.match(state.pendingTradeportEvents[0].lastError, /identity changed/);
});

test('successful recovery preserves the existing recent-delivery history limit', async () => {
  const state = initial(); await enqueue(state);
  state.deliveredSales = Array.from({length: 10000}, (_, n) => `old-${n}`);
  await retry(state);
  assert.equal(state.deliveredSales.length, 10000);
  assert.equal(state.deliveredSales[0], 'old-1');
  assert.equal(state.deliveredSales.at(-1), saleKey(receipt().node));
});
