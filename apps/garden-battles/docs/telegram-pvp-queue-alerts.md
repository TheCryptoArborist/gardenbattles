# Telegram PvP Queue Alerts

Garden Battles can send a Telegram message when a wallet is waiting in the PvP
matchmaking queue. The service is optional and runs in the backend API process.
It is separate from the Sui event relay; `DISABLE_SUI_RELAY=true` can remain
enabled.

## Queue Entry Key

The notifier reads the shared `MatchmakingQueue` object:

```text
0xb5c054185c98d9cb80e35c50f78e306ca2d7bed52955e397df9f1acad9938e4d
```

For each waiting entry, the preferred dedupe key is:

```text
${queueId}:${waitingWallet}:${previousTransaction}
```

If `previousTransaction` is unavailable, the fallback key is:

```text
${queueId}:${waitingWallet}:${queueObjectVersion}:${entryFeeMist}
```

This lets the same wallet trigger a new alert later when it rejoins with a new
queue object version or previous transaction.

## Persistence

The notifier uses the existing Garden Battles SQLite database. The database path
is controlled by the existing production variables:

```text
GARDEN_BATTLES_DB_PATH=/data/battle-data.db
```

or:

```text
DATA_DIR=/data
```

It creates a durable table:

```text
pvp_queue_telegram_alerts
```

Stored fields include:

```text
queue_entry_key
queue_id
waiting_wallet
queue_object_version
previous_transaction
entry_fee_mist
telegram_message_id
notified_at
resolved_at
active
```

## Restart Behavior

After Telegram returns a successful `sendMessage` response, the notifier stores
the queue entry key and Telegram message ID. If Railway restarts while that
wallet is still waiting, the backend reads the persisted row and skips a
duplicate alert.

If Telegram fails, the entry is not marked as notified and a later poll can try
again.

## Queue Lifecycle

- Empty queue: resolve any active stored queue entry. No Telegram message is sent.
- Same active key on repeated polls: skip.
- Entry A to entry B directly: resolve A and send one alert for B.
- Same wallet rejoins later: send a new alert when the key changes.
- Sui RPC failure: do not resolve the last known active entry.

## Railway Variables

Required to enable alerts:

```text
ENABLE_PVP_QUEUE_TELEGRAM=true
TELEGRAM_BOT_TOKEN=<telegram bot token>
TELEGRAM_CHAT_ID=<community chat id>
# Optional, for Telegram forum topics/supergroup threads:
TELEGRAM_MESSAGE_THREAD_ID=<topic id>
MATCHMAKING_QUEUE_ID=0xb5c054185c98d9cb80e35c50f78e306ca2d7bed52955e397df9f1acad9938e4d
GARDEN_BATTLES_PUBLIC_URL=https://nftree.net/battle
PVP_QUEUE_TELEGRAM_POLL_MS=30000
```

Messages are sent with `parse_mode=HTML` and an inline `Join Battle` button.
When `TELEGRAM_MESSAGE_THREAD_ID` is set, the backend includes
`message_thread_id` in the Telegram `sendMessage` payload.

For forum topics:

- `TELEGRAM_CHAT_ID` identifies the forum supergroup. Use a numeric chat ID
  such as `-1001234567890`, or a supported `@username`.
- `TELEGRAM_MESSAGE_THREAD_ID` identifies the specific topic inside that
  forum supergroup.
- Both are required to target a specific forum topic.
- `TELEGRAM_MESSAGE_THREAD_ID` is not a Telegram message URL and is not the
  visible message number from a `https://t.me/...` link.
- Do not set `TELEGRAM_CHAT_ID` to a full `https://t.me/...` URL. The backend
  rejects those values so secrets and routing mistakes fail early.

Keep the existing API-only settings:

```text
DISABLE_SUI_RELAY=true
GARDEN_BATTLES_DB_PATH=/data/battle-data.db
```

Do not log or commit Telegram secrets.

## Test Procedure

Run local validation:

```text
npm.cmd run test:telegram
npm.cmd run telegram:test-send
npm.cmd run check
npm.cmd run build
npx.cmd vite build --base /battle/
git diff --check
```

`npm.cmd run telegram:test-send` sends a manual Telegram test alert directly to
the configured chat or topic. If Telegram rejects the topic, chat, or bot token,
the command exits nonzero.

Production smoke test after Railway env is configured:

1. Confirm `/api/health` returns JSON.
2. Join the PvP queue from a wallet.
3. Confirm one Telegram alert appears.
4. Wait for multiple poll intervals and confirm no duplicate alert appears.
5. Restart Railway while the wallet is still waiting.
6. Confirm no duplicate alert appears after restart.
7. Refund or match the queue entry.
8. Join again later and confirm a new alert appears.

## Disable / Rollback

Set:

```text
ENABLE_PVP_QUEUE_TELEGRAM=false
```

or remove `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`, then restart the API.

The notifier will log that it is disabled and will not poll Sui or call
Telegram. This does not affect leaderboard ingestion, PvP queue transactions,
refunds, Garden Bot, or the disabled Sui relay.
