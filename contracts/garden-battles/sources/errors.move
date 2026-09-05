module battle_garden::errors {
    const EAdminOnly: u64 = 100;
    const ENftNotWhitelisted: u64 = 101;
    const EUnauthorizedPlayer: u64 = 102;
    const EBattleFinished: u64 = 103;
    const EInsufficientPayment: u64 = 104;
    const EInsufficientVault: u64 = 105;
    const EInvalidAbilityName: u64 = 106;
    const EPaused: u64 = 107;
    const ENoPendingToCancel: u64 = 108;
    const EInvalidMove: u64 = 109;
    const EInvalidEconomics: u64 = 110;
    const EInvalidAddress: u64 = 111;
    const EEntryFeeChanged: u64 = 112;
    const EInvalidTargetGrowth: u64 = 113;
    const EAdminTransferNoop: u64 = 114;
    const EFifthMoveDisabled: u64 = 115;
    const EFifthMoveBadSignature: u64 = 116;
    const EFifthMoveWrongWallet: u64 = 117;
    const EFifthMoveNotQualified: u64 = 118;
    const EFifthMoveThresholdMismatch: u64 = 119;
    const EFifthMoveConfigMismatch: u64 = 120;
    const EFifthMoveExpired: u64 = 121;
    const EFifthMoveFutureIssued: u64 = 122;
    const EFifthMoveDomainMismatch: u64 = 123;
    const EFifthMoveNetworkMismatch: u64 = 124;
    const EFifthMoveInvalidVersion: u64 = 125;
    const EFifthMoveWrongConfigObject: u64 = 126;
    const EFifthMoveMalformedPublicKey: u64 = 127;
    const EFifthMoveMalformedSignature: u64 = 128;
    const EFifthMoveInvalidSourceBitmap: u64 = 129;
    const EFifthMoveInvalidTimestampOrdering: u64 = 130;
    const EFifthMoveVersionOverflow: u64 = 131;
    const EFifthMoveConfigNoop: u64 = 132;
    const ETreeLockBelowMinimum: u64 = 133;
    const ETreeLockStillLocked: u64 = 134;
    const ETreeLockWrongOwner: u64 = 135;
    const ETreeLockOverflow: u64 = 136;

    // ── TREE utility errors ──────────────────────────────────────────────────
    const EIncorrectCoinType: u64 = 200;
    const ETreeInsufficient: u64 = 201;

    public fun e_admin_only(): u64 { EAdminOnly }
    public fun e_nft_not_whitelisted(): u64 { ENftNotWhitelisted }
    public fun e_unauthorized_player(): u64 { EUnauthorizedPlayer }
    public fun e_battle_finished(): u64 { EBattleFinished }
    public fun e_insufficient_payment(): u64 { EInsufficientPayment }
    public fun e_insufficient_vault(): u64 { EInsufficientVault }
    public fun e_invalid_ability_name(): u64 { EInvalidAbilityName }
    public fun e_paused(): u64 { EPaused }
    public fun e_no_pending_to_cancel(): u64 { ENoPendingToCancel }
    public fun e_invalid_move(): u64 { EInvalidMove }
    public fun e_invalid_economics(): u64 { EInvalidEconomics }
    public fun e_invalid_address(): u64 { EInvalidAddress }
    public fun e_entry_fee_changed(): u64 { EEntryFeeChanged }
    public fun e_invalid_target_growth(): u64 { EInvalidTargetGrowth }
    public fun e_admin_transfer_noop(): u64 { EAdminTransferNoop }
    public fun e_fifth_move_disabled(): u64 { EFifthMoveDisabled }
    public fun e_fifth_move_bad_signature(): u64 { EFifthMoveBadSignature }
    public fun e_fifth_move_wrong_wallet(): u64 { EFifthMoveWrongWallet }
    public fun e_fifth_move_not_qualified(): u64 { EFifthMoveNotQualified }
    public fun e_fifth_move_threshold_mismatch(): u64 { EFifthMoveThresholdMismatch }
    public fun e_fifth_move_config_mismatch(): u64 { EFifthMoveConfigMismatch }
    public fun e_fifth_move_expired(): u64 { EFifthMoveExpired }
    public fun e_fifth_move_future_issued(): u64 { EFifthMoveFutureIssued }
    public fun e_fifth_move_domain_mismatch(): u64 { EFifthMoveDomainMismatch }
    public fun e_fifth_move_network_mismatch(): u64 { EFifthMoveNetworkMismatch }
    public fun e_fifth_move_invalid_version(): u64 { EFifthMoveInvalidVersion }
    public fun e_fifth_move_wrong_config_object(): u64 { EFifthMoveWrongConfigObject }
    public fun e_fifth_move_malformed_public_key(): u64 { EFifthMoveMalformedPublicKey }
    public fun e_fifth_move_malformed_signature(): u64 { EFifthMoveMalformedSignature }
    public fun e_fifth_move_invalid_source_bitmap(): u64 { EFifthMoveInvalidSourceBitmap }
    public fun e_fifth_move_invalid_timestamp_ordering(): u64 { EFifthMoveInvalidTimestampOrdering }
    public fun e_fifth_move_version_overflow(): u64 { EFifthMoveVersionOverflow }
    public fun e_fifth_move_config_noop(): u64 { EFifthMoveConfigNoop }
    public fun e_tree_lock_below_minimum(): u64 { ETreeLockBelowMinimum }
    public fun e_tree_lock_still_locked(): u64 { ETreeLockStillLocked }
    public fun e_tree_lock_wrong_owner(): u64 { ETreeLockWrongOwner }
    public fun e_tree_lock_overflow(): u64 { ETreeLockOverflow }
    public fun e_incorrect_coin_type(): u64 { EIncorrectCoinType }
    public fun e_tree_insufficient(): u64 { ETreeInsufficient }
}
