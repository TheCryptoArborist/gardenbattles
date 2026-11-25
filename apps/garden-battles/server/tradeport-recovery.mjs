// Keep unresolved marketplace receipts durable without blocking later sales.
// Telegram delivery remains at least once if a send succeeds but its save fails.
const INITIAL_RETRY_MS = 30_000;
const MAX_RETRY_MS = 60 * 60 * 1000;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function receiptIdentity(event) {
  const transactionDigest = event?.transaction?.digest;
  const nftId = event?.contents?.json?.nft_id;
  if (typeof transactionDigest !== 'string' || !transactionDigest ||
      typeof nftId !== 'string' || !/^0x[a-f0-9]{1,64}$/i.test(nftId)) {
    throw new Error('Invalid unresolved TradePort receipt identity');
  }
  return {transactionDigest, nftId, saleKey: `sale:${transactionDigest}:${nftId}`};
}

function pendingEvents(state) {
  if (!isRecord(state) || !isRecord(state.cursors)) {
    throw new Error('Invalid TradePort recovery cursor state');
  }
  if (!Object.hasOwn(state, 'pendingTradeportEvents')) return [];
  const pending = state.pendingTradeportEvents;
  if (!Array.isArray(pending)) throw new Error('Corrupt pending TradePort state');
  const keys = new Set();
  for (const item of pending) {
    if (!isRecord(item) || typeof item.type !== 'string' || !item.type ||
        typeof item.cursor !== 'string' || !item.cursor ||
        item.key !== JSON.stringify([item.type, item.cursor]) || keys.has(item.key) ||
        !Number.isSafeInteger(item.firstSeenAt) || item.firstSeenAt < 0 ||
        !Number.isSafeInteger(item.attempts) || item.attempts < 0 ||
        !Number.isSafeInteger(item.nextRetryAt) || item.nextRetryAt < 0 ||
        typeof item.lastError !== 'string') {
      throw new Error('Corrupt pending TradePort state');
    }
    const identity = receiptIdentity(item.event);
    if (item.saleKey !== identity.saleKey || item.nftId !== identity.nftId ||
        item.transactionDigest !== identity.transactionDigest) {
      throw new Error('Corrupt pending TradePort receipt identity');
    }
    keys.add(item.key);
  }
  return pending;
}

function deliveredKeys(state) {
  if (!Object.hasOwn(state, 'deliveredSales')) return [];
  if (!Array.isArray(state.deliveredSales) ||
      state.deliveredSales.some(key => typeof key !== 'string')) {
    throw new Error('Corrupt TradePort delivery history');
  }
  return state.deliveredSales;
}

function timestamp(now) {
  const value = now();
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid recovery time');
  return value;
}

// Apply one file-backed state transition. Callers serialize these operations.
// The existing notifier save callback atomically replaces its JSON state file.
async function persist(state, patch, save) {
  const previous = Object.keys(patch).map(key => [key, Object.hasOwn(state, key), state[key]]);
  Object.assign(state, patch);
  try {
    await save();
  } catch (error) {
    for (const [key, existed, value] of previous) {
      if (existed) state[key] = value;
      else delete state[key];
    }
    throw error;
  }
}

function report(log, message) {
  // Diagnostics must not reverse a transition that was already persisted.
  try { log(message); } catch {}
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error ?? 'NFT metadata unavailable');
}

export async function deferTradeportEvent(type, edge, state, {
  save, now = Date.now, maxPending = 1000, log = console.warn, error,
}) {
  if (typeof save !== 'function' || !Number.isSafeInteger(maxPending) || maxPending < 1) {
    throw new Error('Invalid TradePort deferral options');
  }
  if (typeof type !== 'string' || !type || typeof edge?.cursor !== 'string' || !edge.cursor) {
    throw new Error('Invalid unresolved TradePort stream or cursor');
  }
  const pending = pendingEvents(state);
  const identity = receiptIdentity(edge.node);
  const key = JSON.stringify([type, edge.cursor]);
  let item = pending.find(entry => entry.key === key);
  if (item && item.saleKey !== identity.saleKey) throw new Error('Conflicting deferred TradePort receipt');
  if (!item && pending.length >= maxPending) {
    throw new Error(`TradePort unresolved-event queue is full (${maxPending}); cursor retained`);
  }
  if (!item) {
    const firstSeenAt = timestamp(now);
    item = {
      key, type, cursor: edge.cursor, ...identity,
      event: JSON.parse(JSON.stringify(edge.node)),
      firstSeenAt, attempts: 0, nextRetryAt: firstSeenAt + INITIAL_RETRY_MS,
      lastError: errorMessage(error),
    };
  }
  await persist(state, {
    pendingTradeportEvents: pending.some(entry => entry.key === key) ? pending : [...pending, item],
    cursors: {...state.cursors, [type]: edge.cursor},
  }, save);
  report(log, `[nftree-alerts] Deferred TradePort NFT ${item.nftId} in transaction ${item.transactionDigest}; saved for retry at ${item.nextRetryAt}`);
  return item;
}

export async function retryDeferredTradeportEvents(state, {
  prepare, send, format, save, now = Date.now, limit = 3, log = console.warn,
}) {
  if (![prepare, send, format, save].every(fn => typeof fn === 'function') ||
      !Number.isSafeInteger(limit) || limit < 0) {
    throw new Error('Invalid TradePort recovery options');
  }
  const pending = pendingEvents(state);
  deliveredKeys(state);
  const cutoff = timestamp(now);
  const due = pending.filter(item => item.nextRetryAt <= cutoff)
    .sort((a, b) => a.nextRetryAt - b.nextRetryAt || a.firstSeenAt - b.firstSeenAt || a.key.localeCompare(b.key))
    .slice(0, limit);
  const result = {processed: 0, delivered: 0, skipped: 0, failed: 0, pending: pending.length};

  const remove = async (item, saleKey) => {
    const patch = {pendingTradeportEvents: pendingEvents(state).filter(entry => entry.key !== item.key)};
    if (saleKey) patch.deliveredSales = [...deliveredKeys(state), saleKey].slice(-10000);
    await persist(state, patch, save);
  };
  const retryLater = async (item, error) => {
    const attempts = item.attempts + 1;
    const delay = Math.min(MAX_RETRY_MS, INITIAL_RETRY_MS * 2 ** Math.min(attempts - 1, 7));
    const updated = {...item, attempts, nextRetryAt: timestamp(now) + delay, lastError: errorMessage(error)};
    await persist(state, {
      pendingTradeportEvents: pendingEvents(state).map(entry => entry.key === item.key ? updated : entry),
    }, save);
    result.failed++;
    report(log, `[nftree-alerts] TradePort NFT ${item.nftId} in transaction ${item.transactionDigest} remains unresolved; attempt ${attempts}, retry at ${updated.nextRetryAt}`);
  };

  for (const selected of due) {
    const item = pendingEvents(state).find(entry => entry.key === selected.key);
    if (!item) continue;
    result.processed++;
    if (deliveredKeys(state).includes(item.saleKey)) {
      await remove(item);
      result.skipped++;
      continue;
    }

    let event;
    try { event = await prepare(item.event); }
    catch (error) { await retryLater(item, error); continue; }
    if (event === null) {
      await remove(item);
      result.skipped++;
      continue;
    }

    let message;
    try {
      message = await format(event);
      if (message?.saleKey !== item.saleKey) throw new Error('Recovered TradePort receipt identity changed');
    } catch (error) { await retryLater(item, error); continue; }
    if (deliveredKeys(state).includes(message.saleKey)) {
      await remove(item);
      result.skipped++;
      continue;
    }
    try { await send(message); }
    catch (error) { await retryLater(item, error); continue; }

    // Save errors deliberately propagate, rather than masquerading as lookup or
    // Telegram failures. The pending record survives if this transition fails.
    await remove(item, message.saleKey);
    result.delivered++;
    report(log, `[nftree-alerts] Recovered TradePort NFT ${item.nftId} in transaction ${item.transactionDigest}`);
  }
  result.pending = pendingEvents(state).length;
  return result;
}
