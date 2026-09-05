# Garden Battles v16 TREE Lock Launch

Production upgrade completed on Sui mainnet on 2026-09-05.

- Transaction: `DPrbtyHEVTFN9CkdaN6uZPMamzQoze43U3GwC2cP11rG`
- Package: `0x4a77289a2cd3d54c18f16a17cc7fe7b8890322e60e566df8683391d5a479f7ec`
- Original package: `0x656ac984c39b952b40ccaaad4c26a3e074c4c99f56e2bac0862b811557de448b`
- UpgradeCap: `0xe94d5b1b468dd1e843181edd055b2b24f5b67afcff184820acc9aa86a82fa604`
- UpgradeCap owner: `0x485953e2eadf4aa02af950cf8e914fbd2b67523385e73c36118341459d8d45c4`
- UpgradeCap version: `16`
- Upgrade status: `success`
- Gas paid: `0.37509242 SUI`

Version 16 adds a non-yielding `TreeLock<TREE>` qualification route. A wallet
locks exactly 1,000,000 TREE for at least 30 days, receives the lock object in
that wallet, and immediately qualifies for the fifth battle card. The lock has
no yield, APY, rewards, or early withdrawal. Once mature, the owner may unlock
the full principal or leave it locked.

Moonbags is no longer queried or counted by the production eligibility service.
Historical Moonbags parsing code remains only for backward-compatibility tests
and old attestation interpretation.

Release verification:

- Mainnet upgrade transaction effects confirmed the `tree_lock` module was published.
- Move tests: 103 passed.
- Application and eligibility tests: 45 passed.
- TypeScript check and production build passed.
