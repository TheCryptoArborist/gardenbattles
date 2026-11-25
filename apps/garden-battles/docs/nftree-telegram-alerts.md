# NFTree mint and purchase Telegram alerts

The backend starts `server/nftree-telegram.mjs` when `ENABLE_NFTREE_TELEGRAM=true`.
It reuses `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and `TELEGRAM_MESSAGE_THREAD_ID`.
Optional destination overrides: `NFTREE_TELEGRAM_CHAT_ID`, `NFTREE_TELEGRAM_THREAD_ID`.
The configured bot must identify as @NFTreeHolderBot.

Every 30 seconds it reads the canonical collection's `NFTMinted` and `NFTPurchased`
events using Sui GraphQL. `NFTPurchased` covers purchases from the collection sale
pool on nftree.net. TradePort resales are also monitored directly on Sui through its legacy
listings, kiosk listings, current simple listings, and matched-bid events. Each
sale object is checked against the exact NFTree type before alerting. The same
transaction/NFT is deduplicated across event streams. No TradePort API key is used.
Other marketplace contracts and future TradePort contract changes are not covered. Inventory batch mints are explicitly labeled as sale inventory.

On first enable, it saves a current checkpoint for each event stream and skips
history. It sends one activation test message after both checkpoints are saved.
Each event alert includes artwork, number, buyer/recipient, exact SUI purchase
price when present, and transaction link. An explicitly rejected image falls
back to text; a network timeout retries later.

State is atomically saved on the existing Railway volume in
`/data/nftree-telegram-state.json`. Override with `NFTREE_ALERT_STATE_PATH` if needed.
Never delete this file to troubleshoot: deletion resets the baseline and can
skip events. Corrupt/unreadable state stops this monitor without resetting it.
Cursor advancement happens after successful delivery, confirmed exclusion of an
unrelated sale, or durable deferral as described below. Delivery
is at least once: a crash after Telegram sends but before the state write, or an
ambiguous network timeout, can cause a duplicate. Normal restarts preserve progress.

No extra Telegram getUpdates consumer is started. Existing queue alerts and
self-service commands continue unchanged. Set `ENABLE_NFTREE_TELEGRAM=false` to
turn off this monitor only.

Validation: `node --test server/nftree-telegram.test.mjs`, `npm run check`,
`npm run build`. Live Sui baseline and follow-up cursor queries were checked.

TradePort support sends its own one-time activation notice and starts at the
current chain checkpoint without posting historical sales. Seller is taken from
the sale event; the current matched single-bid event uses the transaction sender
as seller. New streams fail independently so existing mint alerts continue.
Tests: `node --test server/nftree-telegram.test.mjs server/tradeport-telegram.test.mjs server/tradeport-recovery.test.mjs`.

## Recovering unavailable TradePort sale metadata

Legacy TradePort sale events may omit the NFT type. Reading only the current
object can then block the entire stream when a sold object is later wrapped,
deleted, or unavailable in the current view. The unreadable sale may belong to
any collection, not necessarily NFTree.

`readSaleNft` first reads the current object. If its metadata is unavailable, it
queries the sale transaction's `effects.objectChanges`, matching the exact sold
NFT ID. It checks output and input Move contents and follows the connection's
opaque pagination cursors. An NFTree must have its exact collection type and
number before an alert can be formatted; another known type can be excluded.
The historical lookup is bounded to 20 pages of 50 object changes per attempt.
Historical availability depends on the GraphQL provider's archival backing.

If successful reads still cannot identify the NFT, `SaleNftUnavailableError`
causes that complete receipt to be added to `pendingTradeportEvents` in the
existing state file. The queue entry and original stream's advanced cursor are
saved in one atomic state replacement before scanning continues. A failed save
restores the in-memory cursor and pending list. Network, rate-limit and GraphQL
errors do not qualify as missing metadata; they retain the stream cursor.

The retry worker processes at most three due receipts after normal polling.
Retries begin after 30 seconds, back off to at most one hour, and survive
restarts. It checks the shared transaction/NFT delivery key before lookup and
before sending, so receipts delivered through another supported event stream
are removed without another alert. A recovered unrelated sale is also removed
without alerting. A successfully delivered receipt and its delivery key are
saved together. Telegram timeouts and crashes around delivery still have the
existing at-least-once semantics.

Pending receipts never expire or disappear after an arbitrary retry count.
At 1,000 pending entries, new unresolved receipts stop their stream and log a
queue-full error rather than losing events. Other streams and queued retries
continue. Logs identify the public NFT ID and transaction digest, plus retry
progress. Delivery history retains its existing limit of 10,000 recent keys.

Deploy this repair against the existing Railway service and mounted `/data`
volume. Preserve `nftree-telegram-state.json`, all saved cursors, activation
flags, and Telegram destination variables. Do not delete the state file, reset
the cursor to the newest sale, or replay all historical transactions. The
existing saved cursor is the starting point for catching up the blocked feed.

Reference: [Sui GraphQL: typed object changes and retention](https://www.docs.sui.io/develop/accessing-data/graphql/query-with-graphql).

## Garden Bot completions

Garden Bot on-chain completions use `RankedBotBattleV2Update` plus legacy
`BattleUpdate` events with `is_bot_battle=true`. Package/module settings match the
existing backend battle event configuration. Empty/zero winners and PvP events
are ignored; valid player and bot wins both notify. Player 1 is the human player,
player 2 the bot, as defined by the contract creation functions.

Alerts contain result, player wallet, both growth totals, target where supplied,
transaction link and a Play Garden Bot button. Durable deduplication uses battle
ID so repeated final events produce one notification per match. First startup
baselines skip historical matches and send one activation notice. Free practice
runs do not emit these events and are not included.

Validate with `node --test server/garden-bot-telegram.test.mjs` alongside the other
notification tests. No user-submitted unverified completion endpoint is exposed.
