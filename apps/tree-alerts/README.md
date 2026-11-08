# TREE Telegram alerts

Isolated Railway worker for @TreeGatekeeperBot. Existing Garden Battles runs on a separate branch/service and is not changed by this deployment.

## Coverage

- Five verified current TREE pools: SuiDex V2 TREE/SUI, SuiDex V3 TREE/SUI and TREE/USDC, Turbos TREE/SUI and Cetus TREE/SUI.
- GraphQL transaction polling by affected pool; full pagination of transactions and events. Failed transactions, sells, transfers, fee collection and LP withdrawals are ignored.
- All new factory pool-creation events on those four protocol deployments are followed. New TREE pools start from the checkpoint immediately before creation to include initial deposits.
- Periodic Dexscreener and official SuiDex V3 indexer discovery supplements the chain feeds. An unindexed pre-existing pool outside the seed set may require adding its address to SEEDS; coverage is not a proof that no other historical pools exist.
- One alert per transaction combines routed buys and liquidity deposits. Swap-only round trips with no net TREE output are ignored. Buyer is the transaction sender; liquidity positions may have a separate owner or ultimate beneficiary.

## Price and buy records

Price milestones use the initially selected highest-liquidity eligible Dexscreener TREE-base pool. The source is pinned persistently so changing venues cannot create artificial price jumps. A minimum $1,000 pool liquidity, $50 reported 24-hour volume and 3 consecutive minute-spaced confirmations guard milestone notifications. These safeguards reduce transient spikes; they are not an oracle or a guarantee against manipulation. The current change is the provider's rolling 24-hour change. +20% supersedes +10% when both first qualify. Rearm requires a 3 percentage point retreat and six-hour cooldown.

Daily and weekly records compare estimated USD spend among observed and USD-valued buys; boundaries are America/Chicago and Monday-start weeks. The first valued buy establishes a baseline. SUI is estimated using the current source pool's TREE USD/native ratio; USDC is treated as $1. Other quote assets and replayed transactions older than five minutes are excluded from USD record ranking, but still get purchase alerts. Record scope starts at watcher initialization; no historical record claims.

## Persistence and delivery

Node 24 built-in SQLite, on a dedicated /data volume. Cursors move only after processed transactions. Telegram confirmed deliveries have persistent outbox IDs. If delivery is uncertain (e.g. timeout after a possible send), the worker holds the transaction for manual review instead of automatically duplicating it. Telegram has no idempotency key; absolute exactly-once delivery cannot be guaranteed across an abrupt crash after a successful send.

Single replica, zero overlap. `/health` returns sanitized readiness. Runtime logs contain no bot token. Store `TELEGRAM_BOT_TOKEN` only in Railway variables. `TELEGRAM_ENABLED=true` and `DRY_RUN=false` enable live alerts. `SEND_SETUP_TEST=true` sends one clearly labeled setup photo per persistent database, with exact topic response verification. Missing permission/topic/token errors block startup.

Graphics are JPEGs embedded as base64 in graphics/*.b64 for self-contained deployment: buy, liquidity, up10, up20, daily, weekly. The liquidity and weekly art derives from Peter's supplied 1526.jpg and 5040.jpg; other illustrations use his TREE hero reference with unique poses.

## Validation

`npm test` verifies 13 scenarios using 25 captured mainnet transactions and all five pool object types. Local integration validates live GraphQL schema, metadata, discovery and cursor baselining. No wallet key or on-chain transaction is required.
