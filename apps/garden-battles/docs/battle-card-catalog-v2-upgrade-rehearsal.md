# Battle Card Catalog V2 — Mainnet Upgrade Rehearsal

Rehearsal date: 2026-08-22

Implementation commit: `b0277151ce0ea7c2e533b820fe17998808ec2cc2`

This rehearsal was read-only. No transaction was signed or submitted, no package was upgraded, and no frontend was deployed.

## Verified live lineage before rehearsal

- Network: Sui mainnet
- Current package: `0x28c2222bad60e98c272874878b92f29a6df85fb4afca6bb64cd83d51a5381020`
- Original package: `0x656ac984c39b952b40ccaaad4c26a3e074c4c99f56e2bac0862b811557de448b`
- Current package version: `12`
- UpgradeCap: `0xe94d5b1b468dd1e843181edd055b2b24f5b67afcff184820acc9aa86a82fa604`
- UpgradeCap owner: `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`
- Upgrade policy: `0`
- UpgradeCap object version: `971189044`
- UpgradeCap digest: `ER9wWXVQ23g92grJvGonxB2fsAA6ApwJ5ezrZuZY92r`

`Published.toml` contains this current lineage. `Move.toml` still contains an older `published-at` value, so the current `Published.toml` record and live UpgradeCap must remain the source of truth for the actual upgrade command.

## Rehearsal commands

The package was compiled and locally checked for upgrade compatibility through `sui client upgrade --dry-run`, first normally and then with explicit dependency verification. Both commands specified the verified UpgradeCap and its live owner as the simulated sender.

The second run added `--verify-deps` and succeeded.

## Dry-run result

- Status: success
- Simulated next package version: `13`
- Modules: `battle`, `config`, `errors`, `fifth_move`, `matchmaking`, `nft`, `utils`
- Simulated computation cost: `421,000 MIST`
- Simulated storage cost: `361,889,200 MIST`
- Simulated storage rebate: `1,617,660 MIST`
- Simulated non-refundable storage fee: `16,340 MIST`
- Simulated net balance change: `-360,692,540 MIST` (approximately `0.3607 SUI`)

The simulated package ID and transaction digest are rehearsal artifacts only. They are not live object identifiers and must not be copied into application configuration.

## Post-rehearsal live verification

A fresh mainnet GraphQL read returned the same live state as before the dry runs:

- package version remained `12`;
- UpgradeCap object version remained `971189044`;
- UpgradeCap digest remained `ER9wWXVQ23g92grJvGonxB2fsAA6ApwJ5ezrZuZY92r`;
- owner remained `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`.

This proves the dry runs did not mutate mainnet.

## Actual-upgrade prerequisite

The locally active Sui CLI address is `0x47a6b4e25fd82af7b6a43e82e70fd4437de82a9189dbaa832cf5318946a17274`. It does not own the UpgradeCap, and it must not be used for the actual upgrade.

Before a production upgrade is authorized:

1. Make the exact implementation commit available from the reviewed branch.
2. Initiate the upgrade with the established admin wallet `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`.
3. Re-read the UpgradeCap immediately before signing and confirm version `12`, policy `0`, owner, package, object version, and digest still match this rehearsal.
4. Run one final dependency-verified dry run from the exact production checkout.
5. Only then sign and submit the upgrade as a separately authorized mainnet action.
6. Do not deploy the new frontend labels until the upgraded package ID is verified and application package/event IDs are updated together.
