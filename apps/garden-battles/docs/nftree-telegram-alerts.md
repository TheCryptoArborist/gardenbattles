# NFTree mint and purchase Telegram alerts

The backend starts `server/nftree-telegram.mjs` when `ENABLE_NFTREE_TELEGRAM=true`.
It reuses `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and `TELEGRAM_MESSAGE_THREAD_ID`.
Optional destination overrides: `NFTREE_TELEGRAM_CHAT_ID`, `NFTREE_TELEGRAM_THREAD_ID`.
The configured bot must identify as @NFTreeHolderBot.

Every 30 seconds it reads the canonical collection's `NFTMinted` and `NFTPurchased`
events using Sui GraphQL. `NFTPurchased` covers purchases from the collection sale
pool on nftree.net. Marketplace resales with different marketplace events are not
covered. Inventory batch mints are explicitly labeled as sale inventory.

On first enable, it saves a current checkpoint for each event stream and skips
history. It sends one activation test message after both checkpoints are saved.
Each event alert includes artwork, number, buyer/recipient, exact SUI purchase
price when present, and transaction link. An explicitly rejected image falls
back to text; a network timeout retries later.

State is atomically saved on the existing Railway volume in
`/data/nftree-telegram-state.json`. Override with `NFTREE_ALERT_STATE_PATH` if needed.
Never delete this file to troubleshoot: deletion resets the baseline and can
skip events. Corrupt/unreadable state stops this monitor without resetting it.
Cursor advancement happens only after a successful Telegram response. Delivery
is at least once: a crash after Telegram sends but before the state write, or an
ambiguous network timeout, can cause a duplicate. Normal restarts preserve progress.

No extra Telegram getUpdates consumer is started. Existing queue alerts and
self-service commands continue unchanged. Set `ENABLE_NFTREE_TELEGRAM=false` to
turn off this monitor only.

Validation: `node --test server/nftree-telegram.test.mjs`, `npm run check`,
`npm run build`. Live Sui baseline and follow-up cursor queries were checked.
