# Garden Bot Local Test - 2026-06-24

Branch tested: `codex/recovered-gardenbattles-20260624`

Local URL tested: `http://localhost:5000/battle`

Manual server command used:

```powershell
Set-Location -LiteralPath "D:\Finance\Crypto\Repos\gardenbattles\apps\garden-battles"
$env:NODE_ENV = "development"
$env:DISABLE_SUI_RELAY = "true"
$tsx = Join-Path (Get-Location) "node_modules\.bin\tsx.cmd"
& $tsx server/index.ts
```

Frontend validation passed:

- `npm.cmd run check`
- `npm.cmd run build`

Sui Move validation passed:

- `apps/garden-battles/sui_contract`: build passed, tests passed, 6/6
- `contracts/garden-battles`: build passed, tests passed, 6/6

Wallet-connected Garden Bot UI test passed:

- Garden Bot changes appeared after connecting wallet.
- Garden Bot response showed as a separate action.
- `New Bot Hand` appeared in an active bot battle.
- Bad-hand / 0 Growth warning appeared correctly.
- Current hand showed 2 attack and 2 growth moves.
- Battle log separated player and Garden Bot actions.
- Mobile layout had no horizontal overflow at 390x844.

Remaining caution: do not merge to `main` until final review.
