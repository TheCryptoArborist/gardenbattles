import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import path from 'node:path';
import { GARDEN_BOT_STREAMS, prepareGardenBotEvent } from './garden-bot-telegram.mjs';
import { TRADEPORT_STREAMS, prepareTradeportEvent } from './tradeport-telegram.mjs';

export const COLLECTION = '0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705';
const COLLECTION_STREAMS = ['NFTMinted', 'NFTPurchased'].map(kind => `${COLLECTION}::collection::${kind}`);
const STREAMS = [...COLLECTION_STREAMS, ...TRADEPORT_STREAMS, ...GARDEN_BOT_STREAMS];
const ENDPOINT = 'https://graphql.mainnet.sui.io/graphql';
const IMAGE_BASE = 'https://black-persistent-capybara-279.mypinata.cloud/ipfs/bafybeibcs6wmqckyw2xmsl3u2m6si2uww5orz4l6ewbmio5scmllvux7le';

export async function queryEvents(type, cursor, fetchFn = fetch) {
  const initial = cursor === undefined;
  const query = `query Alerts($type: String!${initial ? "" : ", $cursor: String"}) {
    events(${initial ? 'last: 1' : 'first: 50, after: $cursor'}, filter: {type: $type}) {
      edges { cursor node { contents { type { repr } json } transaction { digest sender { address } } } }
      pageInfo { endCursor hasNextPage }
    }
  }`;
  const response = await fetchFn(process.env.SUI_GRAPHQL_URL || ENDPOINT, {
    method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({query, variables: {type, cursor: cursor ?? null}}),
    signal: AbortSignal.timeout(20000),
  });
  const result = await response.json();
  if (!response.ok || result.errors?.length || !result.data?.events) {
    throw new Error(result.errors?.[0]?.message || `Sui event query HTTP ${response.status}`);
  }
  return result.data.events;
}

export function eventMessage(event) {
  if (event.notificationKind === 'garden-bot') return event.notification;
  const fields = event.contents.json;
  const purchased = event.contents.type.repr.endsWith('::NFTPurchased');
  if (!/^0x[0-9a-f]{1,64}$/i.test(fields.object_id) || !/^\d+$/.test(String(fields.number))) {
    throw new Error('Malformed NFTree event');
  }
  const amount = purchased ? BigInt(fields.price_mist) : null;
  const price = amount === null ? '' : `${amount / 1000000000n}${amount % 1000000000n ? '.' + String(amount % 1000000000n).padStart(9, '0').replace(/0+$/, '') : ''} SUI`;
  const wallet = String(purchased ? fields.buyer : fields.recipient);
  const inventory = !purchased && /^0x0+$/.test(wallet);
  return {
    text: `${purchased ? (fields.marketplace ? '🌳 NFTree sold on TradePort!' : '🌳 NFTree purchased!') : inventory ? '🌱 NFTree minted to sale inventory' : '🌱 NFTree minted!'}\n\nNFTree #${fields.number}${purchased ? `\nPrice: ${price}` : ''}\n${purchased ? 'Buyer' : 'Recipient'}: ${wallet}${fields.seller ? `\nSeller: ${fields.seller}` : ''}\n\nhttps://suiscan.xyz/mainnet/tx/${event.transaction.digest}`,
    photo: typeof fields.image_url === 'string' && /^https:\/\//.test(fields.image_url) ? fields.image_url : `${IMAGE_BASE}/${fields.number}.jpg`,
    saleKey: `${purchased ? "sale" : "mint"}:${event.transaction.digest}:${fields.object_id}`,
    reply_markup: {inline_keyboard: [[{text: 'View transaction', url: `https://suiscan.xyz/mainnet/tx/${event.transaction.digest}`}, {text: 'Get an NFTree', url: 'https://nftree.net/'}]]},
  };
}

// Only advance an event's cursor after Telegram confirms delivery. Persist every
// successful send, so a later failure on the same page does not replay the page.
export async function pollStream(type, state, { query = queryEvents, send, save, prepare = async event => event }) {
  if (!Object.hasOwn(state.cursors, type)) {
    const page = await query(type, undefined);
    if (!page.pageInfo.endCursor) throw new Error('Missing initial event checkpoint');
    state.cursors[type] = page.pageInfo.endCursor;
    save();
    console.log(`[nftree-alerts] Baseline saved for ${type.split('::').at(-1)}; historical alerts skipped`);
    return;
  }
  for (let pages = 0; pages < 10; pages++) {
    const page = await query(type, state.cursors[type]);
    for (const edge of page.edges) {
      const event = await prepare(edge.node);
      const message = event ? eventMessage(event) : null;
      if (message && !state.deliveredSales?.includes(message.saleKey)) {
        await send(message);
        state.deliveredSales = [...(state.deliveredSales || []), message.saleKey].slice(-10000);
        console.log(`[nftree-alerts] Delivered ${event.notificationKind === 'garden-bot' ? 'Garden Bot completion ' + event.contents.json.battle_id : (event.contents.json.marketplace || 'collection') + ' sale/mint #' + event.contents.json.number}`);
      }
      state.cursors[type] = edge.cursor;
      save();

    }
    if (page.pageInfo.endCursor) {
      state.cursors[type] = page.pageInfo.endCursor;
      save();
    }
    if (!page.pageInfo.hasNextPage) return;
  }
}

export function startNftreeTelegramNotifier() {
  if (process.env.ENABLE_NFTREE_TELEGRAM !== 'true') return;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.NFTREE_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
  const thread = process.env.NFTREE_TELEGRAM_THREAD_ID || process.env.TELEGRAM_MESSAGE_THREAD_ID;
  if (!token || !chat) { console.error('[nftree-alerts] Missing Telegram configuration'); return; }
  const statePath = process.env.NFTREE_ALERT_STATE_PATH || path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH || '/data', 'nftree-telegram-state.json');
  let state;
  try { state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {cursors: {}, activationSent: false};
    if (!state.cursors || typeof state.cursors !== 'object') throw new Error('Invalid cursor state');
  } catch { console.error('[nftree-alerts] Cannot read saved state; refusing to reset progress'); return; }
  const save = () => {
    mkdirSync(path.dirname(statePath), {recursive: true});
    writeFileSync(statePath + '.tmp', JSON.stringify(state), {mode: 0o600});
    renameSync(statePath + '.tmp', statePath);
  };
  const telegram = async (method, body) => {
    let response;
    try {
      response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST', headers: {'content-type': 'application/json'},
        body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
      });
    } catch { throw new Error('Telegram network request failed'); }
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(`Telegram ${method}: ${result.description || response.status}`);
    return result.result;
  };
  const target = {chat_id: chat, ...(thread ? {message_thread_id: Number(thread)} : {})};
  let running = false;
  let verified = false;
  const poll = async () => {
    if (running) return;
    running = true;
    try {
      if (!verified) {
        const me = await telegram('getMe', {});
        if (me.username?.toLowerCase() !== 'nftreeholderbot') throw new Error('Configured bot is not @NFTreeHolderBot');
        verified = true;
        console.log(`[nftree-alerts] Verified @${me.username}; monitoring collection mint and purchase events`);
      }
      for (const type of STREAMS) {
        try {
        await pollStream(type, state, {save, prepare: TRADEPORT_STREAMS.includes(type) ? prepareTradeportEvent : GARDEN_BOT_STREAMS.includes(type) ? prepareGardenBotEvent : undefined, send: async message => {
          // Retry transient photo errors without advancing. Do not also send a
          // text alert on a timeout, as Telegram may already have sent the photo.
          if (!message.photo) {
            await telegram('sendMessage', {...target, text: message.text, reply_markup: message.reply_markup, disable_web_page_preview: true});
            return;
          }
          try {
            await telegram('sendPhoto', {...target, photo: message.photo, caption: message.text, reply_markup: message.reply_markup});
          } catch (error) {
            if (!(error instanceof Error) || !/^Telegram sendPhoto:/.test(error.message) || !/photo|image|wrong file|failed to get http url/i.test(error.message)) throw error;
            await telegram('sendMessage', {...target, text: message.text, reply_markup: message.reply_markup, disable_web_page_preview: true});
          }
        }});
        } catch (error) { console.error(`[nftree-alerts] ${type}: ${error instanceof Error ? error.message : 'Poll failed'}`); }
      }
      if (!state.gardenBotActivationSent && GARDEN_BOT_STREAMS.every(type => Object.hasOwn(state.cursors, type))) {
        const result = await telegram('sendMessage', {...target, text: '🌳 Garden Bot match-completion alerts are now active!\n\nNew completed on-chain Garden Bot matches will appear here with the result, player wallet, growth totals, and transaction link. Both player wins and losses are included. Historical matches and free practice runs will not be reposted.'});
        state.gardenBotActivationSent = true;
        save();
        console.log(`[nftree-alerts] Garden Bot activation test delivered; message ID ${result.message_id}`);
      }
      if (!state.tradeportActivationSent && TRADEPORT_STREAMS.every(type => Object.hasOwn(state.cursors, type))) {
        const result = await telegram('sendMessage', {...target, text: '🌳 TradePort purchase alerts are now active for NFTree!\n\nNew completed NFTree sales through TradePort listing and matched-bid contracts will appear here with artwork, SUI price, buyer, seller, and transaction link. Historical sales will not be reposted.'});
        state.tradeportActivationSent = true;
        save();
        console.log(`[nftree-alerts] TradePort activation test delivered; message ID ${result.message_id}`);
      }
      if (!state.activationSent && COLLECTION_STREAMS.every(type => Object.hasOwn(state.cursors, type))) {
        const result = await telegram('sendMessage', {...target, text: '🌳 NFTree mint & purchase alerts are now active!\n\nNew collection mints and purchases will appear here with the NFT artwork, wallet, purchase price when available, and transaction link. Monitoring starts now; historical events will not be reposted.\n\nhttps://nftree.net/', disable_web_page_preview: true});
        state.activationSent = true;
        save();
        console.log(`[nftree-alerts] Activation test delivered; message ID ${result.message_id}`);
      }
    } catch (error) { console.error('[nftree-alerts]', error instanceof Error ? error.message : 'Poll failed'); }
    finally { running = false; }
  };
  void poll();
  const timer = setInterval(() => void poll(), 30000);
  timer.unref();
}
