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
}
