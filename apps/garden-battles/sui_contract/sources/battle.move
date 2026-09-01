#[allow(lint(public_random))]
module battle_garden::battle {
    const PVP_V3_REROLL_COST_MULTIPLIER: u64 = 2;
    const TREE_REROLL_RECIPIENT: address = @0x6f1020c2fd6c91129f7cb5e0d651295e87f7245f96b7d090715c89b38197e77f;
    use sui::event;
    use sui::balance::{Self, Balance};
    use sui::coin;
    use sui::sui::SUI;
    use sui::random::{Self, Random};
    use sui::clock::Clock;
    use sui::dynamic_field;
    use sui::kiosk::{Self, Kiosk, KioskOwnerCap};
    use battle_garden::utils;
    use battle_garden::errors;
    use battle_garden::config::{Self, Config, TreeConfig};
    use battle_garden::fifth_move::{Self, FifthMoveConfig, FifthMoveEligibility};

    public struct Status has copy, drop, store {
        block_turns: u8,
        next_turn_penalty: u64,
        poison_ticks: u8,
        poison_dpt: u64,
    }

    const TIMEOUT_MS: u64 = 24 * 60 * 60 * 1000;
    const BOT_TIMEOUT_MS: u64 = 10 * 60 * 1000;
    const PVP_V2_TARGET_50: u64 = 50;
    const PVP_V2_TARGET_75: u64 = 75;

    public struct Battle has key {
        id: UID,
        player1: address,
        player2: address,
        p1_growth: u64,
        p2_growth: u64,
        turn: u8,
        finished: bool,
        winner: Option<address>,
        p1_moves: vector<u8>,
        p2_moves: vector<u8>,
        p1_status: Status,
        p2_status: Status,
        vault: Balance<SUI>,
        battle_entry_fee: u64,
        winner_payout: u64,
        treasury_share: u64,
        treasury_addr: address,
        last_move_ms: u64,
        is_bot_battle: bool,
    }

    public struct BattleUpdate has copy, drop {
        battle_id: ID,
        player1: address,
        player2: address,
        player1_moves: vector<u8>,
        player2_moves: vector<u8>,
        player1_growth: u64,
        player2_growth: u64,
        winner: Option<address>,
        last_move_ms: u64,
        is_bot_battle: bool,
    }

    /// Upgrade-compatible per-battle rules state. This is attached as a dynamic
    /// field so existing PvpBattleV3 objects keep their original struct layout.
    public struct PvpV3RulesKey has copy, drop, store {}

    public struct PvpV3RulesState has store {
        p1_last_move: Option<u8>,
        p2_last_move: Option<u8>,
    }

    /// Upgrade-compatible V2 card state. Kept in a dynamic field so the
    /// published battle object and Status layouts remain unchanged.
    public struct CardRulesKey has copy, drop, store {}

    public struct FighterCardState has store {
        last_move: Option<u8>,
        reflect_damage: u64,
        armor_half: bool,
        attack_cap: Option<u64>,
    }

    public struct CardRulesState has store {
        p1: FighterCardState,
        p2: FighterCardState,
        total_turns: u64,
    }

    public struct PvpBattleV2 has key {
        id: UID,
        player1: address,
        player2: address,
        p1_growth: u64,
        p2_growth: u64,
        turn: u8,
        finished: bool,
        winner: Option<address>,
        p1_moves: vector<u8>,
        p2_moves: vector<u8>,
        p1_status: Status,
        p2_status: Status,
        vault: Balance<SUI>,
        battle_entry_fee: u64,
        winner_payout: u64,
        treasury_share: u64,
        treasury_addr: address,
        last_move_ms: u64,
        target_growth: u64,
    }

    public struct BotMoveResolved has copy, drop {
        battle_id: ID,
        bot_player: address,
        move_id: u8,
    }

    public struct PvpBattleV2Update has copy, drop {
        battle_id: ID,
        player1: address,
        player2: address,
        player1_moves: vector<u8>,
        player2_moves: vector<u8>,
        player1_growth: u64,
        player2_growth: u64,
        winner: Option<address>,
        last_move_ms: u64,
        target_growth: u64,
    }

    public struct PvpBattleV3 has key {
        id: UID,
        player1: address,
        player2: address,
        p1_growth: u64,
        p2_growth: u64,
        turn: u8,
        finished: bool,
        winner: Option<address>,
        p1_moves: vector<u8>,
        p2_moves: vector<u8>,
        p1_status: Status,
        p2_status: Status,
        vault: Balance<SUI>,
        battle_entry_fee: u64,
        winner_payout: u64,
        treasury_share: u64,
        treasury_addr: address,
        last_move_ms: u64,
        target_growth: u64,
        p1_fifth_move_entitled: bool,
        p2_fifth_move_entitled: bool,
        p1_eligibility_digest: vector<u8>,
        p2_eligibility_digest: vector<u8>,
        p1_reroll_used: bool,
        p2_reroll_used: bool,
    }

    public struct RankedBotBattleV2 has key {
        id: UID,
        player1: address,
        player2: address,
        p1_growth: u64,
        p2_growth: u64,
        turn: u8,
        finished: bool,
        winner: Option<address>,
        p1_moves: vector<u8>,
        p2_moves: vector<u8>,
        p1_status: Status,
        p2_status: Status,
        vault: Balance<SUI>,
        battle_entry_fee: u64,
        winner_payout: u64,
        treasury_share: u64,
        treasury_addr: address,
        last_move_ms: u64,
        target_growth: u64,
        p1_fifth_move_entitled: bool,
        p1_eligibility_digest: vector<u8>,
        p1_reroll_used: bool,
    }

    public struct PvpBattleV3Update has copy, drop {
        battle_id: ID,
        player1: address,
        player2: address,
        player1_moves: vector<u8>,
        player2_moves: vector<u8>,
        player1_growth: u64,
        player2_growth: u64,
        winner: Option<address>,
        last_move_ms: u64,
        target_growth: u64,
        p1_fifth_move_entitled: bool,
        p2_fifth_move_entitled: bool,
        p1_reroll_used: bool,
        p2_reroll_used: bool,
    }

    public struct RankedBotBattleV2Update has copy, drop {
        battle_id: ID,
        player1: address,
        player2: address,
        player1_moves: vector<u8>,
        player2_moves: vector<u8>,
        player1_growth: u64,
        player2_growth: u64,
        winner: Option<address>,
        last_move_ms: u64,
        target_growth: u64,
        p1_fifth_move_entitled: bool,
        p1_reroll_used: bool,
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  Core battle functions (unchanged)
    // ═══════════════════════════════════════════════════════════════════════════

    fun attack_hand_candidate_moves(): vector<u8> {
        let mut attacks = vector::empty<u8>();
        vector::push_back(&mut attacks, 1);
        vector::push_back(&mut attacks, 2);
        vector::push_back(&mut attacks, 3);
        vector::push_back(&mut attacks, 4);
        vector::push_back(&mut attacks, 5);
        vector::push_back(&mut attacks, 6);
        vector::push_back(&mut attacks, 7);
        vector::push_back(&mut attacks, 10);
        vector::push_back(&mut attacks, 11);
        vector::push_back(&mut attacks, 12);
        vector::push_back(&mut attacks, 13);
        vector::push_back(&mut attacks, 16);
        attacks
    }

    fun growth_hand_candidate_moves(): vector<u8> {
        let mut growths = vector::empty<u8>();
        vector::push_back(&mut growths, 15);
        vector::push_back(&mut growths, 19);
        vector::push_back(&mut growths, 20);
        vector::push_back(&mut growths, 21);
        vector::push_back(&mut growths, 22);
        vector::push_back(&mut growths, 23);
        vector::push_back(&mut growths, 24);
        vector::push_back(&mut growths, 25);
        vector::push_back(&mut growths, 26);
        vector::push_back(&mut growths, 28);
        vector::push_back(&mut growths, 30);
        growths
    }

    fun hybrid_hand_candidate_moves(): vector<u8> {
        let mut utility = vector::empty<u8>();
        vector::push_back(&mut utility, 8);
        vector::push_back(&mut utility, 9);
        vector::push_back(&mut utility, 14);
        vector::push_back(&mut utility, 17);
        vector::push_back(&mut utility, 18);
        vector::push_back(&mut utility, 27);
        vector::push_back(&mut utility, 29);
        utility
    }

    fun fifth_attack_candidate_moves(): vector<u8> {
        vector[31, 32, 33]
    }

    fun fifth_growth_candidate_moves(): vector<u8> {
        vector[34, 35, 36]
    }

    fun fifth_hybrid_candidate_moves(): vector<u8> {
        vector[37, 38, 39]
    }

    fun new_fighter_card_state(): FighterCardState {
        FighterCardState {
            last_move: option::none(),
            reflect_damage: 0,
            armor_half: false,
            attack_cap: option::none(),
        }
    }

    fun add_card_rules_state(id: &mut UID) {
        dynamic_field::add(
            id,
            CardRulesKey {},
            CardRulesState {
                p1: new_fighter_card_state(),
                p2: new_fighter_card_state(),
                total_turns: 0,
            },
        );
    }

    fun candidates_excluding(source: &vector<u8>, excluded: &vector<u8>): vector<u8> {
        let mut candidates = vector::empty<u8>();
        let mut i = 0;
        while (i < vector::length(source)) {
            let move_id = *vector::borrow(source, i);
            if (!utils::contains_u8(excluded, move_id)) {
                vector::push_back(&mut candidates, move_id);
            };
            i = i + 1;
        };
        candidates
    }

    // Standard hands contain one attack, one growth, one hybrid, and one
    // flexible card. This prevents the old two-attack opening from leaving a
    // player with only one practical way to advance toward the target.
    fun gen_moves(_arg0: &Random, _arg1: &mut TxContext): vector<u8> {
        let attacks = attack_hand_candidate_moves();
        let growths = growth_hand_candidate_moves();
        let hybrids = hybrid_hand_candidate_moves();

        let mut moves = vector::empty<u8>();
        let mut rng = random::new_generator(_arg0, _arg1);
        let attack_idx = random::generate_u64(&mut rng) % vector::length(&attacks);
        let growth_idx = random::generate_u64(&mut rng) % vector::length(&growths);
        let hybrid_idx = random::generate_u64(&mut rng) % vector::length(&hybrids);
        vector::push_back(&mut moves, *vector::borrow(&attacks, attack_idx));
        vector::push_back(&mut moves, *vector::borrow(&growths, growth_idx));
        vector::push_back(&mut moves, *vector::borrow(&hybrids, hybrid_idx));

        let all = all_hand_candidate_moves();
        let remaining = candidates_excluding(&all, &moves);
        let flexible_idx = random::generate_u64(&mut rng) % vector::length(&remaining);
        vector::push_back(&mut moves, *vector::borrow(&remaining, flexible_idx));
        moves
    }

    fun all_hand_candidate_moves(): vector<u8> {
        let mut moves = vector::empty<u8>();
        vector::push_back(&mut moves, 1);
        vector::push_back(&mut moves, 2);
        vector::push_back(&mut moves, 3);
        vector::push_back(&mut moves, 4);
        vector::push_back(&mut moves, 5);
        vector::push_back(&mut moves, 6);
        vector::push_back(&mut moves, 7);
        vector::push_back(&mut moves, 10);
        vector::push_back(&mut moves, 11);
        vector::push_back(&mut moves, 12);
        vector::push_back(&mut moves, 13);
        vector::push_back(&mut moves, 14);
        vector::push_back(&mut moves, 15);
        vector::push_back(&mut moves, 16);
        vector::push_back(&mut moves, 17);
        vector::push_back(&mut moves, 18);
        vector::push_back(&mut moves, 19);
        vector::push_back(&mut moves, 20);
        vector::push_back(&mut moves, 21);
        vector::push_back(&mut moves, 22);
        vector::push_back(&mut moves, 23);
        vector::push_back(&mut moves, 24);
        vector::push_back(&mut moves, 25);
        vector::push_back(&mut moves, 26);
        vector::push_back(&mut moves, 28);
        vector::push_back(&mut moves, 30);
        vector::push_back(&mut moves, 9);
        vector::push_back(&mut moves, 27);
        vector::push_back(&mut moves, 29);
        vector::push_back(&mut moves, 8);
        moves
    }

    fun gen_moves_for_entitlement(entitled: bool, rand: &Random, ctx: &mut TxContext): vector<u8> {
        let mut moves = gen_moves(rand, ctx);
        if (!entitled) {
            return moves
        };

        let attacks = fifth_attack_candidate_moves();
        let growths = fifth_growth_candidate_moves();
        let hybrids = fifth_hybrid_candidate_moves();
        let mut rng = random::new_generator(rand, ctx);
        let attack_idx = random::generate_u64(&mut rng) % vector::length(&attacks);
        let growth_idx = random::generate_u64(&mut rng) % vector::length(&growths);
        let hybrid_idx = random::generate_u64(&mut rng) % vector::length(&hybrids);
        vector::push_back(&mut moves, *vector::borrow(&attacks, attack_idx));
        vector::push_back(&mut moves, *vector::borrow(&growths, growth_idx));
        vector::push_back(&mut moves, *vector::borrow(&hybrids, hybrid_idx));
        moves
    }

    /// Generates a completely fresh hand. None of the replacement cards are
    /// present in the old hand, so a paid reroll can never return the same set.
    /// Entitled players receive a fresh three-card fifth-move draft after the
    /// four-card base hand, matching the battle-start flow.
    fun gen_reroll_moves(
        old_moves: &vector<u8>,
        entitled: bool,
        rand: &Random,
        ctx: &mut TxContext,
    ): vector<u8> {
        let attacks = candidates_excluding(&attack_hand_candidate_moves(), old_moves);
        let growths = candidates_excluding(&growth_hand_candidate_moves(), old_moves);
        let hybrids = candidates_excluding(&hybrid_hand_candidate_moves(), old_moves);
        let mut rng = random::new_generator(rand, ctx);

        let mut moves = vector::empty<u8>();
        let attack_idx = random::generate_u64(&mut rng) % vector::length(&attacks);
        let growth_idx = random::generate_u64(&mut rng) % vector::length(&growths);
        let hybrid_idx = random::generate_u64(&mut rng) % vector::length(&hybrids);
        vector::push_back(&mut moves, *vector::borrow(&attacks, attack_idx));
        vector::push_back(&mut moves, *vector::borrow(&growths, growth_idx));
        vector::push_back(&mut moves, *vector::borrow(&hybrids, hybrid_idx));

        let all = all_hand_candidate_moves();
        let without_old = candidates_excluding(&all, old_moves);
        let remaining = candidates_excluding(&without_old, &moves);
        let flexible_idx = random::generate_u64(&mut rng) % vector::length(&remaining);
        vector::push_back(&mut moves, *vector::borrow(&remaining, flexible_idx));

        if (!entitled) {
            return moves
        };

        let fifth_attacks_without_old = candidates_excluding(&fifth_attack_candidate_moves(), old_moves);
        let fifth_growths_without_old = candidates_excluding(&fifth_growth_candidate_moves(), old_moves);
        let fifth_hybrids_without_old = candidates_excluding(&fifth_hybrid_candidate_moves(), old_moves);
        let fifth_attacks = candidates_excluding(&fifth_attacks_without_old, &moves);
        let fifth_growths = candidates_excluding(&fifth_growths_without_old, &moves);
        let fifth_hybrids = candidates_excluding(&fifth_hybrids_without_old, &moves);
        let fifth_attack_idx = random::generate_u64(&mut rng) % vector::length(&fifth_attacks);
        let fifth_growth_idx = random::generate_u64(&mut rng) % vector::length(&fifth_growths);
        let fifth_hybrid_idx = random::generate_u64(&mut rng) % vector::length(&fifth_hybrids);
        vector::push_back(&mut moves, *vector::borrow(&fifth_attacks, fifth_attack_idx));
        vector::push_back(&mut moves, *vector::borrow(&fifth_growths, fifth_growth_idx));
        vector::push_back(&mut moves, *vector::borrow(&fifth_hybrids, fifth_hybrid_idx));
        moves
    }

    /// Replaces only the four standard Garden Bot cards. A pending fifth-card
    /// draft or the already-selected fifth card is preserved exactly.
    fun gen_free_ranked_bot_reroll_moves(
        old_moves: &vector<u8>,
        entitled: bool,
        rand: &Random,
        ctx: &mut TxContext,
    ): vector<u8> {
        let mut moves = gen_reroll_moves(old_moves, false, rand, ctx);
        if (!entitled) return moves;

        let old_length = vector::length(old_moves);
        if (old_length == 7) {
            vector::push_back(&mut moves, *vector::borrow(old_moves, 4));
            vector::push_back(&mut moves, *vector::borrow(old_moves, 5));
            vector::push_back(&mut moves, *vector::borrow(old_moves, 6));
        } else if (old_length >= 5) {
            vector::push_back(&mut moves, *vector::borrow(old_moves, 4));
        };
        moves
    }

    fun charge_reroll<T>(
        tree_config: &TreeConfig,
        mut payment: coin::Coin<T>,
        cost_multiplier: u64,
        ctx: &mut TxContext,
    ) {
        assert!(config::is_utility_coin<T>(tree_config), errors::e_incorrect_coin_type());
        let cost = config::reroll_cost(tree_config) * cost_multiplier;
        assert!(cost > 0, errors::e_tree_insufficient());
        assert!(coin::value(&payment) >= cost, errors::e_insufficient_payment());

        // Send the exact reroll fee to the configured Garden Battles recipient
        // while returning any accidental surplus to the player.
        let spent = coin::split(&mut payment, cost, ctx);
        transfer::public_transfer(spent, TREE_REROLL_RECIPIENT);
        if (coin::value(&payment) > 0) {
            transfer::public_transfer(payment, tx_context::sender(ctx));
        } else {
            coin::destroy_zero(payment);
        };
    }

    fun emit_update(arg0: &Battle) {
        let update = BattleUpdate {
            battle_id: object::uid_to_inner(&arg0.id),
            player1: arg0.player1,
            player2: arg0.player2,
            player1_moves: utils::clone_vec_u8(&arg0.p1_moves),
            player2_moves: utils::clone_vec_u8(&arg0.p2_moves),
            player1_growth: arg0.p1_growth,
            player2_growth: arg0.p2_growth,
            winner: arg0.winner,
            last_move_ms: arg0.last_move_ms,
            is_bot_battle: arg0.is_bot_battle,
        };
        event::emit(update);
    }

    fun emit_bot_move_resolved(battle: &Battle, move_id: u8) {
        event::emit(BotMoveResolved {
            battle_id: object::uid_to_inner(&battle.id),
            bot_player: battle.player2,
            move_id,
        });
    }

    fun emit_ranked_bot_v2_move_resolved(battle: &RankedBotBattleV2, move_id: u8) {
        event::emit(BotMoveResolved {
            battle_id: object::uid_to_inner(&battle.id),
            bot_player: battle.player2,
            move_id,
        });
    }

    public fun is_valid_pvp_v2_target(target_growth: u64): bool {
        target_growth == PVP_V2_TARGET_50 || target_growth == PVP_V2_TARGET_75
    }

    fun assert_valid_pvp_v2_target(target_growth: u64) {
        assert!(is_valid_pvp_v2_target(target_growth), errors::e_invalid_target_growth());
    }

    fun emit_update_v2(battle: &PvpBattleV2) {
        let update = PvpBattleV2Update {
            battle_id: object::uid_to_inner(&battle.id),
            player1: battle.player1,
            player2: battle.player2,
            player1_moves: utils::clone_vec_u8(&battle.p1_moves),
            player2_moves: utils::clone_vec_u8(&battle.p2_moves),
            player1_growth: battle.p1_growth,
            player2_growth: battle.p2_growth,
            winner: battle.winner,
            last_move_ms: battle.last_move_ms,
            target_growth: battle.target_growth,
        };
        event::emit(update);
    }

    fun emit_update_v3(battle: &PvpBattleV3) {
        let update = PvpBattleV3Update {
            battle_id: object::uid_to_inner(&battle.id),
            player1: battle.player1,
            player2: battle.player2,
            player1_moves: utils::clone_vec_u8(&battle.p1_moves),
            player2_moves: utils::clone_vec_u8(&battle.p2_moves),
            player1_growth: battle.p1_growth,
            player2_growth: battle.p2_growth,
            winner: battle.winner,
            last_move_ms: battle.last_move_ms,
            target_growth: battle.target_growth,
            p1_fifth_move_entitled: battle.p1_fifth_move_entitled,
            p2_fifth_move_entitled: battle.p2_fifth_move_entitled,
            p1_reroll_used: battle.p1_reroll_used,
            p2_reroll_used: battle.p2_reroll_used,
        };
        event::emit(update);
    }

    fun emit_update_ranked_bot_v2(battle: &RankedBotBattleV2) {
        let update = RankedBotBattleV2Update {
            battle_id: object::uid_to_inner(&battle.id),
            player1: battle.player1,
            player2: battle.player2,
            player1_moves: utils::clone_vec_u8(&battle.p1_moves),
            player2_moves: utils::clone_vec_u8(&battle.p2_moves),
            player1_growth: battle.p1_growth,
            player2_growth: battle.p2_growth,
            winner: battle.winner,
            last_move_ms: battle.last_move_ms,
            target_growth: battle.target_growth,
            p1_fifth_move_entitled: battle.p1_fifth_move_entitled,
            p1_reroll_used: battle.p1_reroll_used,
        };
        event::emit(update);
    }

    fun finish_and_payout(arg0: &mut Battle, arg1: address, arg2: &mut TxContext) {
        assert!(!arg0.finished, errors::e_battle_finished());
        arg0.finished = true;
        arg0.winner = option::some(arg1);
        assert!(balance::value(&arg0.vault) >= arg0.winner_payout + arg0.treasury_share, errors::e_insufficient_vault());
        if (arg0.winner_payout > 0) {
            let payout = balance::split(&mut arg0.vault, arg0.winner_payout);
            transfer::public_transfer(coin::from_balance(payout, arg2), arg1);
        };
        if (arg0.treasury_share > 0) {
            let treasury_cut = balance::split(&mut arg0.vault, arg0.treasury_share);
            transfer::public_transfer(coin::from_balance(treasury_cut, arg2), arg0.treasury_addr);
        };
        let remaining = balance::value(&arg0.vault);
        if (remaining > 0) {
            let rem = balance::split(&mut arg0.vault, remaining);
            transfer::public_transfer(coin::from_balance(rem, arg2), arg1);
        };
        emit_update(arg0);
    }

    fun finish_and_payout_v2(battle: &mut PvpBattleV2, winner: address, ctx: &mut TxContext) {
        assert!(!battle.finished, errors::e_battle_finished());
        battle.finished = true;
        battle.winner = option::some(winner);
        assert!(balance::value(&battle.vault) >= battle.winner_payout + battle.treasury_share, errors::e_insufficient_vault());
        if (battle.winner_payout > 0) {
            let payout = balance::split(&mut battle.vault, battle.winner_payout);
            transfer::public_transfer(coin::from_balance(payout, ctx), winner);
        };
        if (battle.treasury_share > 0) {
            let treasury_cut = balance::split(&mut battle.vault, battle.treasury_share);
            transfer::public_transfer(coin::from_balance(treasury_cut, ctx), battle.treasury_addr);
        };
        let remaining = balance::value(&battle.vault);
        if (remaining > 0) {
            let rem = balance::split(&mut battle.vault, remaining);
            transfer::public_transfer(coin::from_balance(rem, ctx), winner);
        };
        emit_update_v2(battle);
    }

    fun finish_and_payout_v3(battle: &mut PvpBattleV3, winner: address, ctx: &mut TxContext) {
        assert!(!battle.finished, errors::e_battle_finished());
        battle.finished = true;
        battle.winner = option::some(winner);
        assert!(balance::value(&battle.vault) >= battle.winner_payout + battle.treasury_share, errors::e_insufficient_vault());
        if (battle.winner_payout > 0) {
            let payout = balance::split(&mut battle.vault, battle.winner_payout);
            transfer::public_transfer(coin::from_balance(payout, ctx), winner);
        };
        if (battle.treasury_share > 0) {
            let treasury_cut = balance::split(&mut battle.vault, battle.treasury_share);
            transfer::public_transfer(coin::from_balance(treasury_cut, ctx), battle.treasury_addr);
        };
        let remaining = balance::value(&battle.vault);
        if (remaining > 0) {
            let rem = balance::split(&mut battle.vault, remaining);
            transfer::public_transfer(coin::from_balance(rem, ctx), winner);
        };
        emit_update_v3(battle);
    }

    fun finish_and_payout_ranked_bot_v2(battle: &mut RankedBotBattleV2, winner: address, ctx: &mut TxContext) {
        assert!(!battle.finished, errors::e_battle_finished());
        battle.finished = true;
        battle.winner = option::some(winner);
        assert!(balance::value(&battle.vault) >= battle.winner_payout + battle.treasury_share, errors::e_insufficient_vault());
        if (battle.winner_payout > 0) {
            let payout = balance::split(&mut battle.vault, battle.winner_payout);
            transfer::public_transfer(coin::from_balance(payout, ctx), winner);
        };
        if (battle.treasury_share > 0) {
            let treasury_cut = balance::split(&mut battle.vault, battle.treasury_share);
            transfer::public_transfer(coin::from_balance(treasury_cut, ctx), battle.treasury_addr);
        };
        let remaining = balance::value(&battle.vault);
        if (remaining > 0) {
            let rem = balance::split(&mut battle.vault, remaining);
            transfer::public_transfer(coin::from_balance(rem, ctx), winner);
        };
        emit_update_ranked_bot_v2(battle);
    }

    public fun create_battle(
        player1: address,
        player2: address,
        entry_fee: u64,
        config: &Config,
        vault_balance: Balance<SUI>,
        rand: &Random,
        ctx: &mut TxContext
    ) {
        let p1_status = Status { block_turns: 0, next_turn_penalty: 0, poison_ticks: 0, poison_dpt: 0 };
        let p2_status = Status { block_turns: 0, next_turn_penalty: 0, poison_ticks: 0, poison_dpt: 0 };
        assert!(player1 != player2, errors::e_invalid_address());
        let battle = Battle {
            id: object::new(ctx),
            player1,
            player2,
            p1_growth: 0,
            p2_growth: 0,
            turn: 0,
            finished: false,
            winner: option::none(),
            p1_moves: gen_moves(rand, ctx),
            p2_moves: gen_moves(rand, ctx),
            p1_status,
            p2_status,
            vault: vault_balance,
            battle_entry_fee: entry_fee,
            winner_payout: config::winner_payout(config),
            treasury_share: config::treasury_share(config),
            treasury_addr: config::treasury(config),
            last_move_ms: tx_context::epoch_timestamp_ms(ctx),
            is_bot_battle: false,
        };
        emit_update(&battle);
        transfer::share_object(battle);
    }

    public fun create_pvp_battle_v2(
        player1: address,
        player2: address,
        entry_fee: u64,
        config: &Config,
        vault_balance: Balance<SUI>,
        target_growth: u64,
        rand: &Random,
        ctx: &mut TxContext
    ) {
        assert_valid_pvp_v2_target(target_growth);
        assert!(player1 != player2, errors::e_invalid_address());
        let p1_status = Status { block_turns: 0, next_turn_penalty: 0, poison_ticks: 0, poison_dpt: 0 };
        let p2_status = Status { block_turns: 0, next_turn_penalty: 0, poison_ticks: 0, poison_dpt: 0 };
        let battle = PvpBattleV2 {
            id: object::new(ctx),
            player1,
            player2,
            p1_growth: 0,
            p2_growth: 0,
            turn: 0,
            finished: false,
            winner: option::none(),
            p1_moves: gen_moves(rand, ctx),
            p2_moves: gen_moves(rand, ctx),
            p1_status,
            p2_status,
            vault: vault_balance,
            battle_entry_fee: entry_fee,
            winner_payout: config::winner_payout(config),
            treasury_share: config::treasury_share(config),
            treasury_addr: config::treasury(config),
            last_move_ms: tx_context::epoch_timestamp_ms(ctx),
            target_growth,
        };
        emit_update_v2(&battle);
        transfer::share_object(battle);
    }

    public fun create_pvp_battle_v3(
        player1: address,
        player2: address,
        entry_fee: u64,
        config: &Config,
        vault_balance: Balance<SUI>,
        target_growth: u64,
        p1_eligibility: FifthMoveEligibility,
        p2_eligibility: FifthMoveEligibility,
        rand: &Random,
        ctx: &mut TxContext
    ) {
        assert_valid_pvp_v2_target(target_growth);
        assert!(player1 != player2, errors::e_invalid_address());
        let p1_status = Status { block_turns: 0, next_turn_penalty: 0, poison_ticks: 0, poison_dpt: 0 };
        let p2_status = Status { block_turns: 0, next_turn_penalty: 0, poison_ticks: 0, poison_dpt: 0 };
        let p1_entitled = fifth_move::entitled(&p1_eligibility);
        let p2_entitled = fifth_move::entitled(&p2_eligibility);
        let mut starting_turn_rng = random::new_generator(rand, ctx);
        let starting_turn = (random::generate_u64(&mut starting_turn_rng) % 2) as u8;
        let mut battle = PvpBattleV3 {
            id: object::new(ctx),
            player1,
            player2,
            p1_growth: 0,
            p2_growth: 0,
            turn: starting_turn,
            finished: false,
            winner: option::none(),
            p1_moves: gen_moves_for_entitlement(p1_entitled, rand, ctx),
            p2_moves: gen_moves_for_entitlement(p2_entitled, rand, ctx),
            p1_status,
            p2_status,
            vault: vault_balance,
            battle_entry_fee: entry_fee,
            winner_payout: config::winner_payout(config),
            treasury_share: config::treasury_share(config),
            treasury_addr: config::treasury(config),
            last_move_ms: tx_context::epoch_timestamp_ms(ctx),
            target_growth,
            p1_fifth_move_entitled: p1_entitled,
            p2_fifth_move_entitled: p2_entitled,
            p1_eligibility_digest: fifth_move::attestation_digest(&p1_eligibility),
            p2_eligibility_digest: fifth_move::attestation_digest(&p2_eligibility),
            p1_reroll_used: false,
            p2_reroll_used: false,
        };
        dynamic_field::add(
            &mut battle.id,
            PvpV3RulesKey {},
            PvpV3RulesState {
                p1_last_move: option::none(),
                p2_last_move: option::none(),
            },
        );
        add_card_rules_state(&mut battle.id);
        emit_update_v3(&battle);
        transfer::share_object(battle);
    }

    entry fun create_bot_battle<T: key + store>(
        config: &Config,
        _nft: &T,
        bot_player: address,
        rand: &Random,
        ctx: &mut TxContext
    ) {
        assert!(!config::paused(config), errors::e_paused());
        assert!(config::is_collection_whitelisted<T>(config), errors::e_nft_not_whitelisted());

        let player = tx_context::sender(ctx);
        assert!(bot_player != @0x0 && bot_player != player, errors::e_invalid_address());

        let p1_status = Status { block_turns: 0, next_turn_penalty: 0, poison_ticks: 0, poison_dpt: 0 };
        let p2_status = Status { block_turns: 0, next_turn_penalty: 0, poison_ticks: 0, poison_dpt: 0 };
        let battle = Battle {
            id: object::new(ctx),
            player1: player,
            player2: bot_player,
            p1_growth: 0,
            p2_growth: 0,
            turn: 0,
            finished: false,
            winner: option::none(),
            p1_moves: gen_moves(rand, ctx),
            p2_moves: gen_moves(rand, ctx),
            p1_status,
            p2_status,
            vault: balance::zero(),
            battle_entry_fee: 0,
            winner_payout: 0,
            treasury_share: 0,
            treasury_addr: config::treasury(config),
            last_move_ms: tx_context::epoch_timestamp_ms(ctx),
            is_bot_battle: true,
        };
        emit_update(&battle);
        transfer::share_object(battle);
    }
    entry fun create_bot_battle_from_kiosk<T: key + store>(
        config: &Config,
        kiosk: &mut Kiosk,
        cap: &KioskOwnerCap,
        nft_id: ID,
        bot_player: address,
        rand: &Random,
        ctx: &mut TxContext
    ) {
        let (nft, borrow) = kiosk::borrow_val<T>(kiosk, cap, nft_id);
        create_bot_battle<T>(config, &nft, bot_player, rand, ctx);
        kiosk::return_val(kiosk, nft, borrow);
    }
    entry fun create_paid_bot_battle<T: key + store>(
        config: &Config,
        _nft: &T,
        bot_player: address,
        payment: coin::Coin<SUI>,
        rand: &Random,
        ctx: &mut TxContext
    ) {
        assert!(!config::paused(config), errors::e_paused());
        assert!(config::is_collection_whitelisted<T>(config), errors::e_nft_not_whitelisted());

        let entry_fee = config::entry_fee(config);
        assert!(coin::value(&payment) == entry_fee, errors::e_insufficient_payment());

        let player = tx_context::sender(ctx);
        assert!(bot_player != @0x0 && bot_player != player, errors::e_invalid_address());

        let p1_status = Status { block_turns: 0, next_turn_penalty: 0, poison_ticks: 0, poison_dpt: 0 };
        let p2_status = Status { block_turns: 0, next_turn_penalty: 0, poison_ticks: 0, poison_dpt: 0 };
        let battle = Battle {
            id: object::new(ctx),
            player1: player,
            player2: bot_player,
            p1_growth: 0,
            p2_growth: 0,
            turn: 0,
            finished: false,
            winner: option::none(),
            p1_moves: gen_moves(rand, ctx),
            p2_moves: gen_moves(rand, ctx),
            p1_status,
            p2_status,
            vault: coin::into_balance(payment),
            battle_entry_fee: entry_fee,
            winner_payout: entry_fee,
            treasury_share: 0,
            treasury_addr: config::treasury(config),
            last_move_ms: tx_context::epoch_timestamp_ms(ctx),
            is_bot_battle: true,
        };
        emit_update(&battle);
        transfer::share_object(battle);
    }
    entry fun create_paid_bot_battle_from_kiosk<T: key + store>(
        config: &Config,
        kiosk: &mut Kiosk,
        cap: &KioskOwnerCap,
        nft_id: ID,
        bot_player: address,
        payment: coin::Coin<SUI>,
        rand: &Random,
        ctx: &mut TxContext
    ) {
        let (nft, borrow) = kiosk::borrow_val<T>(kiosk, cap, nft_id);
        create_paid_bot_battle<T>(config, &nft, bot_player, payment, rand, ctx);
        kiosk::return_val(kiosk, nft, borrow);
    }

    public entry fun create_ranked_bot_battle_v2<T: key + store>(
        config: &Config,
        _nft: &T,
        bot_player: address,
        eligibility: FifthMoveEligibility,
        rand: &Random,
        ctx: &mut TxContext
    ) {
        assert!(!config::paused(config), errors::e_paused());
        assert!(config::is_collection_whitelisted<T>(config), errors::e_nft_not_whitelisted());

        let player = tx_context::sender(ctx);
        assert!(bot_player != @0x0 && bot_player != player, errors::e_invalid_address());
        let entitled = fifth_move::entitled(&eligibility);

        let p1_status = Status { block_turns: 0, next_turn_penalty: 0, poison_ticks: 0, poison_dpt: 0 };
        let p2_status = Status { block_turns: 0, next_turn_penalty: 0, poison_ticks: 0, poison_dpt: 0 };
        let mut battle = RankedBotBattleV2 {
            id: object::new(ctx),
            player1: player,
            player2: bot_player,
            p1_growth: 0,
            p2_growth: 0,
            turn: 0,
            finished: false,
            winner: option::none(),
            p1_moves: gen_moves_for_entitlement(entitled, rand, ctx),
            p2_moves: gen_moves(rand, ctx),
            p1_status,
            p2_status,
            vault: balance::zero(),
            battle_entry_fee: 0,
            winner_payout: 0,
            treasury_share: 0,
            treasury_addr: config::treasury(config),
            last_move_ms: tx_context::epoch_timestamp_ms(ctx),
            target_growth: 50,
            p1_fifth_move_entitled: entitled,
            p1_eligibility_digest: fifth_move::attestation_digest(&eligibility),
            p1_reroll_used: false,
        };
        add_card_rules_state(&mut battle.id);
        emit_update_ranked_bot_v2(&battle);
        transfer::share_object(battle);
    }

    public entry fun create_ranked_bot_battle_v2_from_kiosk<T: key + store>(
        config: &Config,
        kiosk: &mut Kiosk,
        cap: &KioskOwnerCap,
        nft_id: ID,
        bot_player: address,
        eligibility: FifthMoveEligibility,
        rand: &Random,
        ctx: &mut TxContext
    ) {
        let (nft, borrow) = kiosk::borrow_val<T>(kiosk, cap, nft_id);
        create_ranked_bot_battle_v2<T>(config, &nft, bot_player, eligibility, rand, ctx);
        kiosk::return_val(kiosk, nft, borrow);
    }

    public entry fun create_ranked_bot_battle_v2_standard<T: key + store>(
        config: &Config,
        _nft: &T,
        bot_player: address,
        rand: &Random,
        ctx: &mut TxContext
    ) {
        create_ranked_bot_battle_v2<T>(
            config,
            _nft,
            bot_player,
            fifth_move::standard_eligibility(),
            rand,
            ctx,
        );
    }

    public entry fun create_ranked_bot_battle_v2_with_fifth_move<T: key + store>(
        config: &Config,
        fifth_move_config: &FifthMoveConfig,
        _nft: &T,
        bot_player: address,
        signature: vector<u8>,
        qualified: bool,
        verified_underlying_tree_raw: u64,
        threshold_raw: u64,
        source_bitmap: u8,
        config_version: u64,
        issued_at_ms: u64,
        expires_at_ms: u64,
        clock: &Clock,
        rand: &Random,
        ctx: &mut TxContext
    ) {
        let payload = fifth_move::payload(
            fifth_move::config_id(fifth_move_config),
            tx_context::sender(ctx),
            qualified,
            verified_underlying_tree_raw,
            threshold_raw,
            source_bitmap,
            config_version,
            issued_at_ms,
            expires_at_ms,
        );
        let eligibility = fifth_move::verify_attestation(fifth_move_config, payload, signature, clock, ctx);
        create_ranked_bot_battle_v2<T>(config, _nft, bot_player, eligibility, rand, ctx);
    }

    public entry fun create_ranked_bot_battle_v2_standard_from_kiosk<T: key + store>(
        config: &Config,
        kiosk: &mut Kiosk,
        cap: &KioskOwnerCap,
        nft_id: ID,
        bot_player: address,
        rand: &Random,
        ctx: &mut TxContext
    ) {
        let (nft, borrow) = kiosk::borrow_val<T>(kiosk, cap, nft_id);
        create_ranked_bot_battle_v2_standard<T>(config, &nft, bot_player, rand, ctx);
        kiosk::return_val(kiosk, nft, borrow);
    }

    public entry fun create_ranked_bot_battle_v2_with_fifth_move_from_kiosk<T: key + store>(
        config: &Config,
        fifth_move_config: &FifthMoveConfig,
        kiosk: &mut Kiosk,
        cap: &KioskOwnerCap,
        nft_id: ID,
        bot_player: address,
        signature: vector<u8>,
        qualified: bool,
        verified_underlying_tree_raw: u64,
        threshold_raw: u64,
        source_bitmap: u8,
        config_version: u64,
        issued_at_ms: u64,
        expires_at_ms: u64,
        clock: &Clock,
        rand: &Random,
        ctx: &mut TxContext
    ) {
        let (nft, borrow) = kiosk::borrow_val<T>(kiosk, cap, nft_id);
        create_ranked_bot_battle_v2_with_fifth_move<T>(
            config,
            fifth_move_config,
            &nft,
            bot_player,
            signature,
            qualified,
            verified_underlying_tree_raw,
            threshold_raw,
            source_bitmap,
            config_version,
            issued_at_ms,
            expires_at_ms,
            clock,
            rand,
            ctx,
        );
        kiosk::return_val(kiosk, nft, borrow);
    }

    public fun surrender(battle: &mut Battle, ctx: &mut TxContext) {
        assert!(!battle.finished, errors::e_battle_finished());
        let sender = tx_context::sender(ctx);
        let winner = if (sender == battle.player1) {
            battle.player2
        } else if (sender == battle.player2) {
            battle.player1
        } else {
            abort errors::e_unauthorized_player()
        };
        finish_and_payout(battle, winner, ctx);
    }

    public fun claim_timeout_win(battle: &mut Battle, ctx: &mut TxContext) {
        assert!(!battle.finished, errors::e_battle_finished());
        let sender = tx_context::sender(ctx);
        let is_player1 = sender == battle.player1;
        let is_player2 = sender == battle.player2;
        assert!(is_player1 || is_player2, errors::e_unauthorized_player());

        let is_opponent_turn = if (battle.turn == 0) {
            sender == battle.player2
        } else {
            sender == battle.player1
        };
        assert!(is_opponent_turn, errors::e_unauthorized_player());

        let timeout = if (battle.is_bot_battle) { BOT_TIMEOUT_MS } else { TIMEOUT_MS };
        let now = tx_context::epoch_timestamp_ms(ctx);
        assert!(now >= battle.last_move_ms + timeout, errors::e_unauthorized_player());

        finish_and_payout(battle, sender, ctx);
    }

    public fun admin_force_close(battle: &mut Battle, config: &Config, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == config::admin(config), errors::e_admin_only());
        assert!(!battle.finished, errors::e_battle_finished());
        battle.finished = true;
        battle.winner = option::none();
        let total = balance::value(&battle.vault);
        let half = total / 2;
        let p1_refund = balance::split(&mut battle.vault, half);
        transfer::public_transfer(coin::from_balance(p1_refund, ctx), battle.player1);
        let p2_refund = balance::split(&mut battle.vault, half);
        transfer::public_transfer(coin::from_balance(p2_refund, ctx), battle.player2);
        let remaining = balance::value(&battle.vault);
        if (remaining > 0) {
            let rem = balance::split(&mut battle.vault, remaining);
            transfer::public_transfer(coin::from_balance(rem, ctx), battle.player1);
        };
        emit_update(battle);
    }

    public fun admin_force_close_with_winner(
        battle: &mut Battle,
        config: &Config,
        winner: address,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == config::admin(config), errors::e_admin_only());
        assert!(!battle.finished, errors::e_battle_finished());
        finish_and_payout(battle, winner, ctx);
    }

    public fun admin_close(battle: &mut Battle, config: &Config, ctx: &mut TxContext) {
        admin_force_close(battle, config, ctx);
    }

    public fun surrender_pvp_v2(battle: &mut PvpBattleV2, ctx: &mut TxContext) {
        assert!(!battle.finished, errors::e_battle_finished());
        let sender = tx_context::sender(ctx);
        let winner = if (sender == battle.player1) {
            battle.player2
        } else if (sender == battle.player2) {
            battle.player1
        } else {
            abort errors::e_unauthorized_player()
        };
        finish_and_payout_v2(battle, winner, ctx);
    }

    public fun claim_timeout_win_pvp_v2(battle: &mut PvpBattleV2, ctx: &mut TxContext) {
        assert!(!battle.finished, errors::e_battle_finished());
        let sender = tx_context::sender(ctx);
        let is_player1 = sender == battle.player1;
        let is_player2 = sender == battle.player2;
        assert!(is_player1 || is_player2, errors::e_unauthorized_player());

        let is_opponent_turn = if (battle.turn == 0) {
            sender == battle.player2
        } else {
            sender == battle.player1
        };
        assert!(is_opponent_turn, errors::e_unauthorized_player());

        let now = tx_context::epoch_timestamp_ms(ctx);
        assert!(now >= battle.last_move_ms + TIMEOUT_MS, errors::e_unauthorized_player());
        finish_and_payout_v2(battle, sender, ctx);
    }

    public fun admin_force_close_pvp_v2(battle: &mut PvpBattleV2, config: &Config, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == config::admin(config), errors::e_admin_only());
        assert!(!battle.finished, errors::e_battle_finished());
        battle.finished = true;
        battle.winner = option::none();
        let total = balance::value(&battle.vault);
        let half = total / 2;
        let p1_refund = balance::split(&mut battle.vault, half);
        transfer::public_transfer(coin::from_balance(p1_refund, ctx), battle.player1);
        let p2_refund = balance::split(&mut battle.vault, half);
        transfer::public_transfer(coin::from_balance(p2_refund, ctx), battle.player2);
        let remaining = balance::value(&battle.vault);
        if (remaining > 0) {
            let rem = balance::split(&mut battle.vault, remaining);
            transfer::public_transfer(coin::from_balance(rem, ctx), battle.player1);
        };
        emit_update_v2(battle);
    }

    public fun admin_force_close_pvp_v2_with_winner(
        battle: &mut PvpBattleV2,
        config: &Config,
        winner: address,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == config::admin(config), errors::e_admin_only());
        assert!(!battle.finished, errors::e_battle_finished());
        finish_and_payout_v2(battle, winner, ctx);
    }

    public fun surrender_pvp_v3(battle: &mut PvpBattleV3, ctx: &mut TxContext) {
        assert!(!battle.finished, errors::e_battle_finished());
        let sender = tx_context::sender(ctx);
        let winner = if (sender == battle.player1) {
            battle.player2
        } else if (sender == battle.player2) {
            battle.player1
        } else {
            abort errors::e_unauthorized_player()
        };
        finish_and_payout_v3(battle, winner, ctx);
    }

    public fun claim_timeout_win_pvp_v3(battle: &mut PvpBattleV3, ctx: &mut TxContext) {
        assert!(!battle.finished, errors::e_battle_finished());
        let sender = tx_context::sender(ctx);
        let is_player1 = sender == battle.player1;
        let is_player2 = sender == battle.player2;
        assert!(is_player1 || is_player2, errors::e_unauthorized_player());

        let is_opponent_turn = if (battle.turn == 0) {
            sender == battle.player2
        } else {
            sender == battle.player1
        };
        assert!(is_opponent_turn, errors::e_unauthorized_player());

        let now = tx_context::epoch_timestamp_ms(ctx);
        assert!(now >= battle.last_move_ms + TIMEOUT_MS, errors::e_unauthorized_player());
        finish_and_payout_v3(battle, sender, ctx);
    }

    public fun admin_force_close_pvp_v3(battle: &mut PvpBattleV3, config: &Config, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == config::admin(config), errors::e_admin_only());
        assert!(!battle.finished, errors::e_battle_finished());
        battle.finished = true;
        battle.winner = option::none();
        let total = balance::value(&battle.vault);
        let half = total / 2;
        let p1_refund = balance::split(&mut battle.vault, half);
        transfer::public_transfer(coin::from_balance(p1_refund, ctx), battle.player1);
        let p2_refund = balance::split(&mut battle.vault, half);
        transfer::public_transfer(coin::from_balance(p2_refund, ctx), battle.player2);
        let remaining = balance::value(&battle.vault);
        if (remaining > 0) {
            let rem = balance::split(&mut battle.vault, remaining);
            transfer::public_transfer(coin::from_balance(rem, ctx), battle.player1);
        };
        emit_update_v3(battle);
    }

    public fun admin_force_close_pvp_v3_with_winner(
        battle: &mut PvpBattleV3,
        config: &Config,
        winner: address,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == config::admin(config), errors::e_admin_only());
        assert!(!battle.finished, errors::e_battle_finished());
        finish_and_payout_v3(battle, winner, ctx);
    }

    public fun surrender_ranked_bot_v2(battle: &mut RankedBotBattleV2, ctx: &mut TxContext) {
        assert!(!battle.finished, errors::e_battle_finished());
        assert!(tx_context::sender(ctx) == battle.player1, errors::e_unauthorized_player());
        let winner = battle.player2;
        finish_and_payout_ranked_bot_v2(battle, winner, ctx);
    }

    public fun claim_timeout_win_ranked_bot_v2(battle: &mut RankedBotBattleV2, ctx: &mut TxContext) {
        assert!(!battle.finished, errors::e_battle_finished());
        assert!(tx_context::sender(ctx) == battle.player1, errors::e_unauthorized_player());
        let now = tx_context::epoch_timestamp_ms(ctx);
        assert!(now >= battle.last_move_ms + BOT_TIMEOUT_MS, errors::e_unauthorized_player());
        let winner = battle.player1;
        finish_and_payout_ranked_bot_v2(battle, winner, ctx);
    }

    public fun admin_force_close_ranked_bot_v2(battle: &mut RankedBotBattleV2, config: &Config, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == config::admin(config), errors::e_admin_only());
        assert!(!battle.finished, errors::e_battle_finished());
        battle.finished = true;
        battle.winner = option::none();
        let total = balance::value(&battle.vault);
        if (total > 0) {
            let refund = balance::split(&mut battle.vault, total);
            transfer::public_transfer(coin::from_balance(refund, ctx), battle.player1);
        };
        emit_update_ranked_bot_v2(battle);
    }

    fun apply_damage(arg0: u64, arg1: &mut Status): u64 {
        if (arg1.block_turns > 0) {
            arg1.block_turns = arg1.block_turns - 1;
            0
        } else {
            arg0
        }
    }

    fun is_standard_attack(move_id: u8): bool {
        move_id == 1 || move_id == 2 || move_id == 3 || move_id == 4 ||
        move_id == 5 || move_id == 6 || move_id == 7 || move_id == 10 ||
        move_id == 11 || move_id == 12 || move_id == 13 || move_id == 16
    }

    fun is_attack_move(move_id: u8): bool {
        is_standard_attack(move_id) || move_id == 31 || move_id == 32 || move_id == 33
    }

    fun is_growth_move(move_id: u8): bool {
        move_id == 15 || move_id == 19 || move_id == 20 || move_id == 21 ||
        move_id == 22 || move_id == 23 || move_id == 24 || move_id == 25 ||
        move_id == 26 || move_id == 28 || move_id == 30 ||
        move_id == 34 || move_id == 35 || move_id == 36
    }

    fun optional_move_is_attack(last_move: &Option<u8>): bool {
        option::is_some(last_move) && is_attack_move(*option::borrow(last_move))
    }

    fun optional_move_is_growth(last_move: &Option<u8>): bool {
        option::is_some(last_move) && is_growth_move(*option::borrow(last_move))
    }

    fun apply_catalog_start_of_turn(
        move_id: u8,
        total_turns: u64,
        growth: &mut u64,
        status: &mut Status,
    ): bool {
        let natural_growth = if (total_turns >= 25) { 3 } else if (total_turns >= 15) { 2 } else { 1 };
        *growth = utils::add_growth(*growth, natural_growth);
        let had_pending_damage = status.next_turn_penalty > 0 || status.poison_ticks > 0;
        if (move_id == 14 || move_id == 36) {
            status.next_turn_penalty = 0;
            status.poison_ticks = 0;
            status.poison_dpt = 0;
            return had_pending_damage
        };
        if (move_id == 20) {
            status.next_turn_penalty = 0;
        };
        if (status.next_turn_penalty > 0) {
            *growth = utils::sub_growth(*growth, status.next_turn_penalty);
            status.next_turn_penalty = 0;
        };
        if (status.poison_ticks > 0) {
            *growth = utils::sub_growth(*growth, status.poison_dpt);
            status.poison_ticks = status.poison_ticks - 1;
            if (status.poison_ticks == 0) {
                status.poison_dpt = 0;
            };
        };
        had_pending_damage
    }

    fun apply_catalog_damage(
        amount: u64,
        piercing: bool,
        self_growth: &mut u64,
        opp_growth: &mut u64,
        opp_status: &mut Status,
        opp_card: &mut FighterCardState,
    ) {
        if (!piercing && opp_status.block_turns > 0) {
            opp_status.block_turns = opp_status.block_turns - 1;
            if (opp_card.reflect_damage > 0) {
                *self_growth = utils::sub_growth(*self_growth, opp_card.reflect_damage);
                opp_card.reflect_damage = 0;
            };
            return
        };
        let mut resolved = amount;
        if (option::is_some(&opp_card.attack_cap)) {
            let cap = *option::borrow(&opp_card.attack_cap);
            if (resolved > cap) resolved = cap;
            opp_card.attack_cap = option::none();
        };
        if (opp_card.armor_half) {
            resolved = (resolved + 1) / 2;
            opp_card.armor_half = false;
        };
        *opp_growth = utils::sub_growth(*opp_growth, resolved);
    }

    fun clear_one_block(status: &mut Status, card: &mut FighterCardState) {
        if (status.block_turns > 0) {
            status.block_turns = status.block_turns - 1;
            card.reflect_damage = 0;
        };
    }

    fun resolve_catalog_move(
        move_id: u8,
        had_pending_damage: bool,
        self_growth: &mut u64,
        opp_growth: &mut u64,
        self_status: &mut Status,
        opp_status: &mut Status,
        self_card: &mut FighterCardState,
        opp_card: &mut FighterCardState,
        rand: &Random,
        ctx: &mut TxContext,
    ) {
        let self_last_was_attack = optional_move_is_attack(&self_card.last_move);
        let opp_last_was_attack = optional_move_is_attack(&opp_card.last_move);
        let opp_last_was_growth = optional_move_is_growth(&opp_card.last_move);
        if (is_standard_attack(move_id) && *opp_growth == 0) {
            *self_growth = utils::add_growth(*self_growth, 4);
        };

        if (move_id == 1) {
            if (opp_status.block_turns > 0) {
                clear_one_block(opp_status, opp_card);
                apply_catalog_damage(7, true, self_growth, opp_growth, opp_status, opp_card);
            } else {
                apply_catalog_damage(11, false, self_growth, opp_growth, opp_status, opp_card);
            };
        } else if (move_id == 2) {
            let damage = if (*opp_growth >= 40) { 12 } else { 8 };
            apply_catalog_damage(damage, false, self_growth, opp_growth, opp_status, opp_card);
        } else if (move_id == 3) {
            if (!utils::miss(rand, ctx, 25)) apply_catalog_damage(16, false, self_growth, opp_growth, opp_status, opp_card);
        } else if (move_id == 4) {
            apply_catalog_damage(11, true, self_growth, opp_growth, opp_status, opp_card);
        } else if (move_id == 5) {
            let damage = if (opp_last_was_growth) { 12 } else { 8 };
            apply_catalog_damage(damage, false, self_growth, opp_growth, opp_status, opp_card);
        } else if (move_id == 6) {
            apply_catalog_damage(6, false, self_growth, opp_growth, opp_status, opp_card);
            apply_catalog_damage(6, false, self_growth, opp_growth, opp_status, opp_card);
        } else if (move_id == 7) {
            let damage = if (*self_growth < *opp_growth) { 13 } else { 10 };
            apply_catalog_damage(damage, false, self_growth, opp_growth, opp_status, opp_card);
        } else if (move_id == 8) {
            *self_growth = utils::add_growth(*self_growth, 6);
            if (self_status.block_turns == 0) {
                self_status.block_turns = 1;
                self_card.reflect_damage = 4;
            };
        } else if (move_id == 9) {
            apply_catalog_damage(6, false, self_growth, opp_growth, opp_status, opp_card);
            *self_growth = utils::add_growth(*self_growth, 4);
        } else if (move_id == 10) {
            if (opp_status.poison_ticks == 0) {
                opp_status.poison_ticks = 2;
                opp_status.poison_dpt = 4;
            };
        } else if (move_id == 11) {
            if (!utils::miss(rand, ctx, 25)) apply_catalog_damage(17, false, self_growth, opp_growth, opp_status, opp_card);
        } else if (move_id == 12) {
            clear_one_block(opp_status, opp_card);
            apply_catalog_damage(10, true, self_growth, opp_growth, opp_status, opp_card);
        } else if (move_id == 13) {
            apply_catalog_damage(7, false, self_growth, opp_growth, opp_status, opp_card);
            opp_status.next_turn_penalty = opp_status.next_turn_penalty + 4;
        } else if (move_id == 14) {
            *self_growth = utils::add_growth(*self_growth, if (had_pending_damage) { 14 } else { 10 });
        } else if (move_id == 15) {
            *self_growth = utils::add_growth(*self_growth, if (*self_growth < *opp_growth) { 12 } else { 8 });
        } else if (move_id == 16) {
            if (*self_growth >= 4) {
                *self_growth = utils::sub_growth(*self_growth, 4);
                apply_catalog_damage(16, false, self_growth, opp_growth, opp_status, opp_card);
            };
        } else if (move_id == 17) {
            if (self_status.block_turns > 0) {
                *self_growth = utils::add_growth(*self_growth, 10);
            } else {
                *self_growth = utils::add_growth(*self_growth, 7);
                self_status.block_turns = 1;
            };
        } else if (move_id == 18) {
            *self_growth = utils::add_growth(*self_growth, 5);
            apply_catalog_damage(5, false, self_growth, opp_growth, opp_status, opp_card);
        } else if (move_id == 19) {
            if (!utils::miss(rand, ctx, 40)) {
                *self_growth = utils::add_growth(*self_growth, 20);
            } else {
                *self_growth = utils::sub_growth(*self_growth, 4);
            };
        } else if (move_id == 20) {
            *self_growth = utils::add_growth(*self_growth, 10);
        } else if (move_id == 21) {
            *self_growth = utils::add_growth(*self_growth, utils::rand_inclusive(rand, ctx, 8, 14));
        } else if (move_id == 22) {
            *self_growth = utils::add_growth(*self_growth, if (opp_last_was_attack) { 14 } else { 10 });
        } else if (move_id == 23) {
            *self_growth = utils::add_growth(*self_growth, if (opp_status.block_turns > 0) { 15 } else { 10 });
        } else if (move_id == 24) {
            *self_growth = utils::add_growth(*self_growth, 14);
            *opp_growth = utils::add_growth(*opp_growth, 3);
        } else if (move_id == 25) {
            *self_growth = utils::add_growth(*self_growth, if (!utils::miss(rand, ctx, 25)) { 15 } else { 3 });
        } else if (move_id == 26) {
            *self_growth = utils::add_growth(*self_growth, if (self_last_was_attack) { 13 } else { 11 });
        } else if (move_id == 27) {
            *self_growth = utils::add_growth(*self_growth, 7);
            self_card.armor_half = true;
        } else if (move_id == 28) {
            *self_growth = utils::add_growth(*self_growth, if (*self_growth <= 10) { 13 } else { 10 });
        } else if (move_id == 29) {
            *self_growth = utils::add_growth(*self_growth, 8);
            if (!utils::miss(rand, ctx, 50) && self_status.block_turns == 0) self_status.block_turns = 1;
        } else if (move_id == 30) {
            *self_growth = utils::add_growth(*self_growth, 8);
            self_card.attack_cap = option::some(8);
        } else if (move_id == 31) {
            *self_growth = utils::add_growth(*self_growth, 3);
            apply_catalog_damage(8, false, self_growth, opp_growth, opp_status, opp_card);
        } else if (move_id == 32) {
            *self_growth = utils::add_growth(*self_growth, 4);
            if (opp_status.poison_ticks == 0) {
                opp_status.poison_ticks = 2;
                opp_status.poison_dpt = 3;
            };
        } else if (move_id == 33) {
            *self_growth = utils::add_growth(*self_growth, 3);
            if (!utils::miss(rand, ctx, 25)) apply_catalog_damage(10, false, self_growth, opp_growth, opp_status, opp_card);
        } else if (move_id == 34) {
            *self_growth = utils::add_growth(*self_growth, if (*self_growth < *opp_growth) { 11 } else { 10 });
        } else if (move_id == 35) {
            clear_one_block(opp_status, opp_card);
            *self_growth = utils::add_growth(*self_growth, 10);
        } else if (move_id == 36) {
            *self_growth = utils::add_growth(*self_growth, 9);
        } else if (move_id == 37) {
            *self_growth = utils::add_growth(*self_growth, 7);
            if (self_status.block_turns == 0) self_status.block_turns = 1;
        } else if (move_id == 38) {
            *self_growth = utils::add_growth(*self_growth, 6);
            apply_catalog_damage(6, false, self_growth, opp_growth, opp_status, opp_card);
        } else if (move_id == 39) {
            *self_growth = utils::add_growth(*self_growth, 8);
            self_card.attack_cap = option::some(8);
        };
        self_card.last_move = option::some(move_id);
    }

    fun map_ability_name(name: vector<u8>): u8 {
        if (utils::eq_str(name, b"Wedgebreaker") || utils::eq_str(name, b"ThornSpikeBomb")) { 1 }
        else if (utils::eq_str(name, b"SkyreachSaw") || utils::eq_str(name, b"RazorLeafSword")) { 2 }
        else if (utils::eq_str(name, b"ChainsawCyclone") || utils::eq_str(name, b"TumbleweedMace")) { 3 }
        else if (utils::eq_str(name, b"Rootpiercer") || utils::eq_str(name, b"ShovelSpear")) { 4 }
        else if (utils::eq_str(name, b"LimbfallSlam") || utils::eq_str(name, b"ThornedWhip")) { 5 }
        else if (utils::eq_str(name, b"AcornBarrage") || utils::eq_str(name, b"AcornSlingshot")) { 6 }
        else if (utils::eq_str(name, b"LogSwingRampage") || utils::eq_str(name, b"StoneNunchuck")) { 7 }
        else if (utils::eq_str(name, b"BarklashShield") || utils::eq_str(name, b"CactusShield")) { 8 }
        else if (utils::eq_str(name, b"RootSiphon") || utils::eq_str(name, b"LifeAbsorb")) { 9 }
        else if (utils::eq_str(name, b"BeetleBlight") || utils::eq_str(name, b"Poison")) { 10 }
        else if (utils::eq_str(name, b"LightningCrown") || utils::eq_str(name, b"WitherTouch")) { 11 }
        else if (utils::eq_str(name, b"AirSpadeBlast") || utils::eq_str(name, b"PollenCloud")) { 12 }
        else if (utils::eq_str(name, b"FungalDoom") || utils::eq_str(name, b"FungalRot")) { 13 }
        else if (utils::eq_str(name, b"CompostCleanse") || utils::eq_str(name, b"CompostTea")) { 14 }
        else if (utils::eq_str(name, b"RootlinkSurge") || utils::eq_str(name, b"MycorrhizalNetwork")) { 15 }
        else if (utils::eq_str(name, b"PruningFury") || utils::eq_str(name, b"PruningShears")) { 16 }
        else if (utils::eq_str(name, b"MulchFortress") || utils::eq_str(name, b"MulchBarrier")) { 17 }
        else if (utils::eq_str(name, b"GraftFusion") || utils::eq_str(name, b"RootGraft")) { 18 }
        else if (utils::eq_str(name, b"WildwoodGamble") || utils::eq_str(name, b"OvergrowthGamble")) { 19 }
        else if (utils::eq_str(name, b"RootRevival") || utils::eq_str(name, b"RootsUp")) { 20 }
        else if (utils::eq_str(name, b"SolarBloom") || utils::eq_str(name, b"SunBeam")) { 21 }
        else if (utils::eq_str(name, b"Rainmaker") || utils::eq_str(name, b"RainStorm")) { 22 }
        else if (utils::eq_str(name, b"MycoMight") || utils::eq_str(name, b"WhiteMold")) { 23 }
        else if (utils::eq_str(name, b"CanopyDownpour") || utils::eq_str(name, b"GreenhouseGas")) { 24 }
        else if (utils::eq_str(name, b"PotassiumPower") || utils::eq_str(name, b"PotassiumPowerUp")) { 25 }
        else if (utils::eq_str(name, b"PhotosynthesisOverdrive") || utils::eq_str(name, b"PhotosyntheticSurge")) { 26 }
        else if (utils::eq_str(name, b"IronbarkArmor") || utils::eq_str(name, b"BarkskinArmor")) { 27 }
        else if (utils::eq_str(name, b"SapSurge") || utils::eq_str(name, b"SapOverflow")) { 28 }
        else if (utils::eq_str(name, b"GaleGuard") || utils::eq_str(name, b"CloudCover")) { 29 }
        else if (utils::eq_str(name, b"ShadowCanopy")) { 30 }
        else if (utils::eq_str(name, b"ChainsawCataclysm")) { 31 }
        else if (utils::eq_str(name, b"BeetleSwarmBlitz")) { 32 }
        else if (utils::eq_str(name, b"LightningSplit")) { 33 }
        else if (utils::eq_str(name, b"AncientRootAwakening")) { 34 }
        else if (utils::eq_str(name, b"CanopyExplosion")) { 35 }
        else if (utils::eq_str(name, b"SolarCrownSurge")) { 36 }
        else if (utils::eq_str(name, b"IronwoodFortress")) { 37 }
        else if (utils::eq_str(name, b"RootstormSiphon")) { 38 }
        else if (utils::eq_str(name, b"ArboristAscension")) { 39 }
        else { 0 }
    }

    fun expected_self_growth(move_id: u8): u64 {
        if (move_id == 8) { 6 }
        else if (move_id == 9) { 4 }
        else if (move_id == 14) { 10 }
        else if (move_id == 15) { 10 }
        else if (move_id == 17) { 7 }
        else if (move_id == 18) { 5 }
        else if (move_id == 19) { 10 }
        else if (move_id == 20) { 10 }
        else if (move_id == 21) { 11 }
        else if (move_id == 22) { 10 }
        else if (move_id == 23) { 10 }
        else if (move_id == 24) { 14 }
        else if (move_id == 25) { 12 }
        else if (move_id == 26) { 11 }
        else if (move_id == 27) { 7 }
        else if (move_id == 28) { 10 }
        else if (move_id == 29) { 8 }
        else if (move_id == 30) { 8 }
        else if (move_id == 31) { 3 }
        else if (move_id == 32) { 4 }
        else if (move_id == 33) { 3 }
        else if (move_id == 34) { 10 }
        else if (move_id == 35) { 10 }
        else if (move_id == 36) { 9 }
        else if (move_id == 37) { 7 }
        else if (move_id == 38) { 6 }
        else if (move_id == 39) { 8 }
        else { 0 }
    }

    fun expected_damage(move_id: u8): u64 {
        if (move_id == 1) { 11 }
        else if (move_id == 2) { 8 }
        else if (move_id == 3) { 12 }
        else if (move_id == 4) { 11 }
        else if (move_id == 5) { 8 }
        else if (move_id == 6) { 12 }
        else if (move_id == 7) { 10 }
        else if (move_id == 9) { 6 }
        else if (move_id == 11) { 13 }
        else if (move_id == 12) { 10 }
        else if (move_id == 13) { 7 }
        else if (move_id == 16) { 16 }
        else if (move_id == 18) { 5 }
        else if (move_id == 31) { 8 }
        else if (move_id == 32) { 6 }
        else if (move_id == 33) { 8 }
        else if (move_id == 38) { 6 }
        else { 0 }
    }

    fun adds_block(move_id: u8): bool {
        move_id == 8 || move_id == 17 || move_id == 29 || move_id == 37
    }

    fun bot_move_score(move_id: u8, self_growth: u64, opp_growth: u64, self_status: &Status, opp_status: &Status): u64 {
        let mut score = 0;
        let growth = expected_self_growth(move_id);
        if (growth > 0 && self_growth < 100) {
            let missing_growth = 100 - self_growth;
            let useful_growth = if (growth > missing_growth) { missing_growth } else { growth };
            score = score + 100 + useful_growth;
        };

        let damage = expected_damage(move_id);
        if (damage > 0 && opp_growth > 0) {
            if (opp_status.block_turns > 0) {
                score = score + 10;
            } else {
                let useful_damage = if (damage > opp_growth) { opp_growth } else { damage };
                score = score + 40 + useful_damage;
            };
        };

        if (move_id == 10 && opp_growth > 0 && opp_status.poison_ticks == 0) {
            score = score + 35;
        };
        if (move_id == 32 && opp_growth > 0 && opp_status.poison_ticks == 0) {
            score = score + 30;
        };
        if (move_id == 13 && opp_growth > 0) {
            score = score + 20;
        };
        if (adds_block(move_id)) {
            score = score + if (self_status.block_turns == 0) { 12 } else { 2 };
        };

        if (score == 0) { 1 } else { score }
    }

    fun bot_score_is_viable(score: u64, max_score: u64): bool {
        score == max_score || max_score - score <= 20
    }

    fun choose_bot_move(battle: &Battle, rand: &Random, ctx: &mut TxContext): u8 {
        let moves_len = vector::length(&battle.p2_moves);
        assert!(moves_len > 0, errors::e_invalid_move());
        let recent_move = *vector::borrow(&battle.p2_moves, moves_len - 1);

        let mut max_score = 0;
        let mut i = 0;
        while (i < moves_len) {
            let move_id = *vector::borrow(&battle.p2_moves, i);
            let score = bot_move_score(move_id, battle.p2_growth, battle.p1_growth, &battle.p2_status, &battle.p1_status);
            if (score > max_score) {
                max_score = score;
            };
            i = i + 1;
        };

        let mut candidate_count = 0;
        let mut alternate_candidate_count = 0;
        i = 0;
        while (i < moves_len) {
            let move_id = *vector::borrow(&battle.p2_moves, i);
            let score = bot_move_score(move_id, battle.p2_growth, battle.p1_growth, &battle.p2_status, &battle.p1_status);
            if (bot_score_is_viable(score, max_score)) {
                candidate_count = candidate_count + 1;
                if (move_id != recent_move) {
                    alternate_candidate_count = alternate_candidate_count + 1;
                };
            };
            i = i + 1;
        };

        let avoid_recent = alternate_candidate_count > 0;
        let selection_count = if (avoid_recent) { alternate_candidate_count } else { candidate_count };
        let mut rng = random::new_generator(rand, ctx);
        let selected_candidate = random::generate_u64(&mut rng) % selection_count;
        let mut seen_candidates = 0;
        i = 0;
        while (i < moves_len) {
            let move_id = *vector::borrow(&battle.p2_moves, i);
            let score = bot_move_score(move_id, battle.p2_growth, battle.p1_growth, &battle.p2_status, &battle.p1_status);
            if (bot_score_is_viable(score, max_score) && (!avoid_recent || move_id != recent_move)) {
                if (seen_candidates == selected_candidate) {
                    return move_id
                };
                seen_candidates = seen_candidates + 1;
            };
            i = i + 1;
        };

        *vector::borrow(&battle.p2_moves, 0)
    }

    fun rotate_bot_move_to_end(battle: &mut Battle, move_id: u8) {
        let moves_len = vector::length(&battle.p2_moves);
        let mut i = 0;
        while (i < moves_len) {
            if (*vector::borrow(&battle.p2_moves, i) == move_id) {
                let selected = vector::remove(&mut battle.p2_moves, i);
                vector::push_back(&mut battle.p2_moves, selected);
                return
            };
            i = i + 1;
        };
    }

    fun choose_ranked_bot_v2_move(battle: &RankedBotBattleV2, rand: &Random, ctx: &mut TxContext): u8 {
        let moves_len = vector::length(&battle.p2_moves);
        assert!(moves_len > 0, errors::e_invalid_move());
        let recent_move = *vector::borrow(&battle.p2_moves, moves_len - 1);

        let mut max_score = 0;
        let mut i = 0;
        while (i < moves_len) {
            let move_id = *vector::borrow(&battle.p2_moves, i);
            let score = bot_move_score(move_id, battle.p2_growth, battle.p1_growth, &battle.p2_status, &battle.p1_status);
            if (score > max_score) {
                max_score = score;
            };
            i = i + 1;
        };

        let mut candidate_count = 0;
        let mut alternate_candidate_count = 0;
        i = 0;
        while (i < moves_len) {
            let move_id = *vector::borrow(&battle.p2_moves, i);
            let score = bot_move_score(move_id, battle.p2_growth, battle.p1_growth, &battle.p2_status, &battle.p1_status);
            if (bot_score_is_viable(score, max_score)) {
                candidate_count = candidate_count + 1;
                if (move_id != recent_move) {
                    alternate_candidate_count = alternate_candidate_count + 1;
                };
            };
            i = i + 1;
        };

        let avoid_recent = alternate_candidate_count > 0;
        let selection_count = if (avoid_recent) { alternate_candidate_count } else { candidate_count };
        let mut rng = random::new_generator(rand, ctx);
        let selected_candidate = random::generate_u64(&mut rng) % selection_count;
        let mut seen_candidates = 0;
        i = 0;
        while (i < moves_len) {
            let move_id = *vector::borrow(&battle.p2_moves, i);
            let score = bot_move_score(move_id, battle.p2_growth, battle.p1_growth, &battle.p2_status, &battle.p1_status);
            if (bot_score_is_viable(score, max_score) && (!avoid_recent || move_id != recent_move)) {
                if (seen_candidates == selected_candidate) {
                    return move_id
                };
                seen_candidates = seen_candidates + 1;
            };
            i = i + 1;
        };

        *vector::borrow(&battle.p2_moves, 0)
    }

    fun rotate_ranked_bot_v2_move_to_end(battle: &mut RankedBotBattleV2, move_id: u8) {
        let moves_len = vector::length(&battle.p2_moves);
        let mut i = 0;
        while (i < moves_len) {
            if (*vector::borrow(&battle.p2_moves, i) == move_id) {
                let selected = vector::remove(&mut battle.p2_moves, i);
                vector::push_back(&mut battle.p2_moves, selected);
                return
            };
            i = i + 1;
        };
    }

    fun apply_start_of_turn_status(move_id: u8, growth: &mut u64, status: &mut Status) {
        if (move_id == 14) {
            status.next_turn_penalty = 0;
            status.poison_ticks = 0;
            status.poison_dpt = 0;
            return
        };
        if (status.next_turn_penalty > 0) {
            *growth = utils::sub_growth(*growth, status.next_turn_penalty);
            status.next_turn_penalty = 0;
        };
        if (status.poison_ticks > 0) {
            *growth = utils::sub_growth(*growth, status.poison_dpt);
            status.poison_ticks = status.poison_ticks - 1;
            if (status.poison_ticks == 0) {
                status.poison_dpt = 0;
            };
        };
    }

    fun apply_player1_move(battle: &mut Battle, move_id: u8, rand: &Random, ctx: &mut TxContext) {
        apply_start_of_turn_status(move_id, &mut battle.p1_growth, &mut battle.p1_status);

        resolve_move(move_id, &mut battle.p1_growth, &mut battle.p2_growth, &mut battle.p1_status, &mut battle.p2_status, rand, ctx);

        battle.p1_growth = utils::clamp(battle.p1_growth, 0, 100);
        battle.p2_growth = utils::clamp(battle.p2_growth, 0, 100);
        battle.last_move_ms = tx_context::epoch_timestamp_ms(ctx);
    }

    fun apply_player2_move(battle: &mut Battle, move_id: u8, rand: &Random, ctx: &mut TxContext) {
        apply_start_of_turn_status(move_id, &mut battle.p2_growth, &mut battle.p2_status);

        resolve_move(move_id, &mut battle.p2_growth, &mut battle.p1_growth, &mut battle.p2_status, &mut battle.p1_status, rand, ctx);

        battle.p2_growth = utils::clamp(battle.p2_growth, 0, 100);
        battle.p1_growth = utils::clamp(battle.p1_growth, 0, 100);
        battle.last_move_ms = tx_context::epoch_timestamp_ms(ctx);
    }

    fun apply_player1_move_v2(battle: &mut PvpBattleV2, move_id: u8, rand: &Random, ctx: &mut TxContext) {
        apply_start_of_turn_status(move_id, &mut battle.p1_growth, &mut battle.p1_status);

        resolve_move(move_id, &mut battle.p1_growth, &mut battle.p2_growth, &mut battle.p1_status, &mut battle.p2_status, rand, ctx);

        battle.p1_growth = utils::clamp(battle.p1_growth, 0, 100);
        battle.p2_growth = utils::clamp(battle.p2_growth, 0, 100);
        battle.last_move_ms = tx_context::epoch_timestamp_ms(ctx);
    }

    fun apply_player2_move_v2(battle: &mut PvpBattleV2, move_id: u8, rand: &Random, ctx: &mut TxContext) {
        apply_start_of_turn_status(move_id, &mut battle.p2_growth, &mut battle.p2_status);

        resolve_move(move_id, &mut battle.p2_growth, &mut battle.p1_growth, &mut battle.p2_status, &mut battle.p1_status, rand, ctx);

        battle.p2_growth = utils::clamp(battle.p2_growth, 0, 100);
        battle.p1_growth = utils::clamp(battle.p1_growth, 0, 100);
        battle.last_move_ms = tx_context::epoch_timestamp_ms(ctx);
    }

    fun apply_player1_move_v3(battle: &mut PvpBattleV3, move_id: u8, rand: &Random, ctx: &mut TxContext) {
        let key = CardRulesKey {};
        if (dynamic_field::exists_(&battle.id, key)) {
            let rules = dynamic_field::borrow_mut<CardRulesKey, CardRulesState>(&mut battle.id, key);
            let had_pending_damage = apply_catalog_start_of_turn(move_id, rules.total_turns, &mut battle.p1_growth, &mut battle.p1_status);
            resolve_catalog_move(move_id, had_pending_damage, &mut battle.p1_growth, &mut battle.p2_growth, &mut battle.p1_status, &mut battle.p2_status, &mut rules.p1, &mut rules.p2, rand, ctx);
            rules.total_turns = rules.total_turns + 1;
        } else {
            apply_start_of_turn_status(move_id, &mut battle.p1_growth, &mut battle.p1_status);
            resolve_move(move_id, &mut battle.p1_growth, &mut battle.p2_growth, &mut battle.p1_status, &mut battle.p2_status, rand, ctx);
        };
        battle.p1_growth = utils::clamp(battle.p1_growth, 0, 100);
        battle.p2_growth = utils::clamp(battle.p2_growth, 0, 100);
        battle.last_move_ms = tx_context::epoch_timestamp_ms(ctx);
    }

    fun apply_player2_move_v3(battle: &mut PvpBattleV3, move_id: u8, rand: &Random, ctx: &mut TxContext) {
        let key = CardRulesKey {};
        if (dynamic_field::exists_(&battle.id, key)) {
            let rules = dynamic_field::borrow_mut<CardRulesKey, CardRulesState>(&mut battle.id, key);
            let had_pending_damage = apply_catalog_start_of_turn(move_id, rules.total_turns, &mut battle.p2_growth, &mut battle.p2_status);
            resolve_catalog_move(move_id, had_pending_damage, &mut battle.p2_growth, &mut battle.p1_growth, &mut battle.p2_status, &mut battle.p1_status, &mut rules.p2, &mut rules.p1, rand, ctx);
            rules.total_turns = rules.total_turns + 1;
        } else {
            apply_start_of_turn_status(move_id, &mut battle.p2_growth, &mut battle.p2_status);
            resolve_move(move_id, &mut battle.p2_growth, &mut battle.p1_growth, &mut battle.p2_status, &mut battle.p1_status, rand, ctx);
        };
        battle.p2_growth = utils::clamp(battle.p2_growth, 0, 100);
        battle.p1_growth = utils::clamp(battle.p1_growth, 0, 100);
        battle.last_move_ms = tx_context::epoch_timestamp_ms(ctx);
    }

    fun apply_player1_move_ranked_bot_v2(battle: &mut RankedBotBattleV2, move_id: u8, rand: &Random, ctx: &mut TxContext) {
        let key = CardRulesKey {};
        if (dynamic_field::exists_(&battle.id, key)) {
            let rules = dynamic_field::borrow_mut<CardRulesKey, CardRulesState>(&mut battle.id, key);
            let had_pending_damage = apply_catalog_start_of_turn(move_id, rules.total_turns, &mut battle.p1_growth, &mut battle.p1_status);
            resolve_catalog_move(move_id, had_pending_damage, &mut battle.p1_growth, &mut battle.p2_growth, &mut battle.p1_status, &mut battle.p2_status, &mut rules.p1, &mut rules.p2, rand, ctx);
            rules.total_turns = rules.total_turns + 1;
        } else {
            apply_start_of_turn_status(move_id, &mut battle.p1_growth, &mut battle.p1_status);
            resolve_move(move_id, &mut battle.p1_growth, &mut battle.p2_growth, &mut battle.p1_status, &mut battle.p2_status, rand, ctx);
        };
        battle.p1_growth = utils::clamp(battle.p1_growth, 0, 100);
        battle.p2_growth = utils::clamp(battle.p2_growth, 0, 100);
        battle.last_move_ms = tx_context::epoch_timestamp_ms(ctx);
    }

    fun apply_player2_move_ranked_bot_v2(battle: &mut RankedBotBattleV2, move_id: u8, rand: &Random, ctx: &mut TxContext) {
        let key = CardRulesKey {};
        if (dynamic_field::exists_(&battle.id, key)) {
            let rules = dynamic_field::borrow_mut<CardRulesKey, CardRulesState>(&mut battle.id, key);
            let had_pending_damage = apply_catalog_start_of_turn(move_id, rules.total_turns, &mut battle.p2_growth, &mut battle.p2_status);
            resolve_catalog_move(move_id, had_pending_damage, &mut battle.p2_growth, &mut battle.p1_growth, &mut battle.p2_status, &mut battle.p1_status, &mut rules.p2, &mut rules.p1, rand, ctx);
            rules.total_turns = rules.total_turns + 1;
        } else {
            apply_start_of_turn_status(move_id, &mut battle.p2_growth, &mut battle.p2_status);
            resolve_move(move_id, &mut battle.p2_growth, &mut battle.p1_growth, &mut battle.p2_status, &mut battle.p1_status, rand, ctx);
        };
        battle.p2_growth = utils::clamp(battle.p2_growth, 0, 100);
        battle.p1_growth = utils::clamp(battle.p1_growth, 0, 100);
        battle.last_move_ms = tx_context::epoch_timestamp_ms(ctx);
    }

    public fun use_ability(battle: &mut Battle, ability_name: vector<u8>, rand: &Random, ctx: &mut TxContext) {
        let move_id = map_ability_name(ability_name);
        assert!(move_id != 0, errors::e_invalid_ability_name());
        use_ability_id(battle, move_id, rand, ctx);
    }
    public fun use_ability_id(battle: &mut Battle, move_id: u8, rand: &Random, ctx: &mut TxContext) {
        assert!(!battle.finished, errors::e_battle_finished());
        let sender = tx_context::sender(ctx);
        let is_player_turn = if (battle.turn == 0) {
            assert!(sender == battle.player1, errors::e_unauthorized_player());
            utils::contains_u8(&battle.p1_moves, move_id)
        } else {
            assert!(sender == battle.player2, errors::e_unauthorized_player());
            utils::contains_u8(&battle.p2_moves, move_id)
        };
        assert!(is_player_turn, errors::e_invalid_move());

        if (battle.turn == 0) {
            apply_player1_move(battle, move_id, rand, ctx);

            let target_growth = if (battle.is_bot_battle) { 50 } else { 100 };
            if (battle.p1_growth >= target_growth) {
                let winner = battle.player1;
                finish_and_payout(battle, winner, ctx);
            } else if (battle.is_bot_battle) {
                let bot_move = choose_bot_move(battle, rand, ctx);
                emit_bot_move_resolved(battle, bot_move);
                rotate_bot_move_to_end(battle, bot_move);
                apply_player2_move(battle, bot_move, rand, ctx);

                if (battle.p2_growth >= target_growth) {
                    let winner = battle.player2;
                    finish_and_payout(battle, winner, ctx);
                } else {
                    battle.turn = 0;
                    emit_update(battle);
                };
            } else {
                battle.turn = 1;
                emit_update(battle);
            };
        } else {
            apply_player2_move(battle, move_id, rand, ctx);

            let target_growth = if (battle.is_bot_battle) { 50 } else { 100 };
            if (battle.p2_growth >= target_growth) {
                let winner = battle.player2;
                finish_and_payout(battle, winner, ctx);
            } else {
                battle.turn = 0;
                emit_update(battle);
            };
        };
    }

    public fun use_ability_id_pvp_v2(battle: &mut PvpBattleV2, move_id: u8, rand: &Random, ctx: &mut TxContext) {
        assert!(!battle.finished, errors::e_battle_finished());
        let sender = tx_context::sender(ctx);
        let is_player_turn = if (battle.turn == 0) {
            assert!(sender == battle.player1, errors::e_unauthorized_player());
            utils::contains_u8(&battle.p1_moves, move_id)
        } else {
            assert!(sender == battle.player2, errors::e_unauthorized_player());
            utils::contains_u8(&battle.p2_moves, move_id)
        };
        assert!(is_player_turn, errors::e_invalid_move());

        if (battle.turn == 0) {
            apply_player1_move_v2(battle, move_id, rand, ctx);

            if (battle.p1_growth >= battle.target_growth) {
                let winner = battle.player1;
                finish_and_payout_v2(battle, winner, ctx);
            } else {
                battle.turn = 1;
                emit_update_v2(battle);
            };
        } else {
            apply_player2_move_v2(battle, move_id, rand, ctx);

            if (battle.p2_growth >= battle.target_growth) {
                let winner = battle.player2;
                finish_and_payout_v2(battle, winner, ctx);
            } else {
                battle.turn = 0;
                emit_update_v2(battle);
            };
        };
    }

    fun fifth_move_draft_pending(moves: &vector<u8>, entitled: bool): bool {
        entitled && vector::length(moves) == 7
    }

    fun lock_fifth_move_draft(moves: &mut vector<u8>, fifth_move_id: u8) {
        assert!(vector::length(moves) == 7, errors::e_fifth_move_draft_required());
        let valid_choice =
            *vector::borrow(moves, 4) == fifth_move_id ||
            *vector::borrow(moves, 5) == fifth_move_id ||
            *vector::borrow(moves, 6) == fifth_move_id;
        assert!(valid_choice, errors::e_fifth_move_invalid_draft_choice());
        vector::pop_back(moves);
        vector::pop_back(moves);
        vector::pop_back(moves);
        vector::push_back(moves, fifth_move_id);
    }

    fun assert_not_repeated_and_record(battle: &mut PvpBattleV3, player1: bool, move_id: u8) {
        let key = PvpV3RulesKey {};
        if (!dynamic_field::exists_(&battle.id, key)) {
            // Battles created before this package upgrade have no rules field
            // and remain playable under their original rules.
            return
        };
        let rules = dynamic_field::borrow_mut<PvpV3RulesKey, PvpV3RulesState>(&mut battle.id, key);
        if (player1) {
            if (option::is_some(&rules.p1_last_move)) {
                assert!(*option::borrow(&rules.p1_last_move) != move_id, errors::e_move_repeated());
            };
            rules.p1_last_move = option::some(move_id);
        } else {
            if (option::is_some(&rules.p2_last_move)) {
                assert!(*option::borrow(&rules.p2_last_move) != move_id, errors::e_move_repeated());
            };
            rules.p2_last_move = option::some(move_id);
        };
    }

    fun assert_ranked_bot_move_not_repeated(battle: &RankedBotBattleV2, move_id: u8) {
        let key = CardRulesKey {};
        if (!dynamic_field::exists_(&battle.id, key)) return;
        let rules = dynamic_field::borrow<CardRulesKey, CardRulesState>(&battle.id, key);
        if (option::is_some(&rules.p1.last_move)) {
            assert!(*option::borrow(&rules.p1.last_move) != move_id, errors::e_move_repeated());
        };
    }

    /// Locks one of the three on-chain fifth-card candidates and submits the
    /// player's move in the same transaction.
    public fun use_ability_id_pvp_v3_with_fifth_move(
        battle: &mut PvpBattleV3,
        fifth_move_id: u8,
        move_id: u8,
        rand: &Random,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        if (sender == battle.player1) {
            assert!(fifth_move_draft_pending(&battle.p1_moves, battle.p1_fifth_move_entitled), errors::e_fifth_move_draft_required());
            lock_fifth_move_draft(&mut battle.p1_moves, fifth_move_id);
        } else if (sender == battle.player2) {
            assert!(fifth_move_draft_pending(&battle.p2_moves, battle.p2_fifth_move_entitled), errors::e_fifth_move_draft_required());
            lock_fifth_move_draft(&mut battle.p2_moves, fifth_move_id);
        } else {
            abort errors::e_unauthorized_player()
        };
        use_ability_id_pvp_v3(battle, move_id, rand, ctx);
    }

    public fun use_ability_id_pvp_v3(battle: &mut PvpBattleV3, move_id: u8, rand: &Random, ctx: &mut TxContext) {
        assert!(!battle.finished, errors::e_battle_finished());
        let sender = tx_context::sender(ctx);
        let is_player_turn = if (battle.turn == 0) {
            assert!(sender == battle.player1, errors::e_unauthorized_player());
            assert!(!fifth_move_draft_pending(&battle.p1_moves, battle.p1_fifth_move_entitled), errors::e_fifth_move_draft_required());
            utils::contains_u8(&battle.p1_moves, move_id)
        } else {
            assert!(sender == battle.player2, errors::e_unauthorized_player());
            assert!(!fifth_move_draft_pending(&battle.p2_moves, battle.p2_fifth_move_entitled), errors::e_fifth_move_draft_required());
            utils::contains_u8(&battle.p2_moves, move_id)
        };
        assert!(is_player_turn, errors::e_invalid_move());
        let is_player1_turn = battle.turn == 0;
        assert_not_repeated_and_record(battle, is_player1_turn, move_id);

        if (battle.turn == 0) {
            apply_player1_move_v3(battle, move_id, rand, ctx);

            if (battle.p1_growth >= battle.target_growth) {
                let winner = battle.player1;
                finish_and_payout_v3(battle, winner, ctx);
            } else {
                battle.turn = 1;
                emit_update_v3(battle);
            };
        } else {
            apply_player2_move_v3(battle, move_id, rand, ctx);

            if (battle.p2_growth >= battle.target_growth) {
                let winner = battle.player2;
                finish_and_payout_v3(battle, winner, ctx);
            } else {
                battle.turn = 0;
                emit_update_v3(battle);
            };
        };
    }

    public fun use_ability_id_ranked_bot_v2(
        battle: &mut RankedBotBattleV2,
        move_id: u8,
        rand: &Random,
        ctx: &mut TxContext,
    ) {
        assert!(!battle.finished, errors::e_battle_finished());
        let sender = tx_context::sender(ctx);
        assert!(sender == battle.player1, errors::e_unauthorized_player());
        assert!(!fifth_move_draft_pending(&battle.p1_moves, battle.p1_fifth_move_entitled), errors::e_fifth_move_draft_required());
        assert!(utils::contains_u8(&battle.p1_moves, move_id), errors::e_invalid_move());
        assert_ranked_bot_move_not_repeated(battle, move_id);

        apply_player1_move_ranked_bot_v2(battle, move_id, rand, ctx);

        if (battle.p1_growth >= battle.target_growth) {
            let winner = battle.player1;
            finish_and_payout_ranked_bot_v2(battle, winner, ctx);
        } else {
            let bot_move = choose_ranked_bot_v2_move(battle, rand, ctx);
            emit_ranked_bot_v2_move_resolved(battle, bot_move);
            rotate_ranked_bot_v2_move_to_end(battle, bot_move);
            apply_player2_move_ranked_bot_v2(battle, bot_move, rand, ctx);

            if (battle.p2_growth >= battle.target_growth) {
                let winner = battle.player2;
                finish_and_payout_ranked_bot_v2(battle, winner, ctx);
            } else {
                battle.turn = 0;
                emit_update_ranked_bot_v2(battle);
            };
        };
    }

    public fun use_ability_id_ranked_bot_v2_with_fifth_move(
        battle: &mut RankedBotBattleV2,
        fifth_move_id: u8,
        move_id: u8,
        rand: &Random,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == battle.player1, errors::e_unauthorized_player());
        assert!(fifth_move_draft_pending(&battle.p1_moves, battle.p1_fifth_move_entitled), errors::e_fifth_move_draft_required());
        lock_fifth_move_draft(&mut battle.p1_moves, fifth_move_id);
        use_ability_id_ranked_bot_v2(battle, move_id, rand, ctx);
    }

    fun resolve_move(move_id: u8, self_growth: &mut u64, opp_growth: &mut u64, self_status: &mut Status, opp_status: &mut Status, rand: &Random, ctx: &mut TxContext) {
        if (move_id == 1) {
            *opp_growth = utils::sub_growth(*opp_growth, apply_damage(10, opp_status));
        } else if (move_id == 2) {
            *opp_growth = utils::sub_growth(*opp_growth, apply_damage(8, opp_status));
        } else if (move_id == 3) {
            *opp_growth = utils::sub_growth(*opp_growth, apply_damage(12, opp_status));
        } else if (move_id == 4) {
            *opp_growth = utils::sub_growth(*opp_growth, apply_damage(7, opp_status));
        } else if (move_id == 5) {
            *opp_growth = utils::sub_growth(*opp_growth, apply_damage(9, opp_status));
        } else if (move_id == 6) {
            *opp_growth = utils::sub_growth(*opp_growth, apply_damage(6, opp_status));
        } else if (move_id == 7) {
            *opp_growth = utils::sub_growth(*opp_growth, apply_damage(11, opp_status));
        } else if (move_id == 8) {
            self_status.block_turns = 1;
            *opp_growth = utils::sub_growth(*opp_growth, 5);
        } else if (move_id == 9) {
            *opp_growth = utils::sub_growth(*opp_growth, apply_damage(8, opp_status));
            *self_growth = utils::add_growth(*self_growth, 4);
        } else if (move_id == 10) {
            opp_status.poison_ticks = 2;
            opp_status.poison_dpt = 5;
        } else if (move_id == 11) {
            if (!utils::miss(rand, ctx, 20)) {
                *opp_growth = utils::sub_growth(*opp_growth, apply_damage(15, opp_status));
            }
        } else if (move_id == 12) {
            if (!utils::miss(rand, ctx, 50)) {
                *opp_growth = utils::sub_growth(*opp_growth, apply_damage(10, opp_status));
            } else {
                opp_status.block_turns = opp_status.block_turns + 1;
            }
        } else if (move_id == 13) {
            *opp_growth = utils::sub_growth(*opp_growth, apply_damage(7, opp_status));
            opp_status.next_turn_penalty = opp_status.next_turn_penalty + 3;
        } else if (move_id == 14) {
            *self_growth = utils::add_growth(*self_growth, 8);
            self_status.poison_ticks = 0;
            self_status.poison_dpt = 0;
            self_status.next_turn_penalty = 0;
        } else if (move_id == 15) {
            let growth = if (*self_growth < *opp_growth) { 14 } else { 7 };
            *self_growth = utils::add_growth(*self_growth, growth);
        } else if (move_id == 16) {
            if (*self_growth >= 5) {
                *self_growth = utils::sub_growth(*self_growth, 5);
                *opp_growth = utils::sub_growth(*opp_growth, apply_damage(15, opp_status));
            };
        } else if (move_id == 17) {
            *self_growth = utils::add_growth(*self_growth, 6);
            self_status.block_turns = self_status.block_turns + 1;
        } else if (move_id == 18) {
            *self_growth = utils::add_growth(*self_growth, 6);
            *opp_growth = utils::sub_growth(*opp_growth, apply_damage(6, opp_status));
        } else if (move_id == 19) {
            if (utils::miss(rand, ctx, 40)) {
                *self_growth = utils::sub_growth(*self_growth, 5);
            } else {
                *self_growth = utils::add_growth(*self_growth, 22);
            };
        } else if (move_id == 20) {
            *self_growth = utils::add_growth(*self_growth, 10);
        } else if (move_id == 21) {
            *self_growth = utils::add_growth(*self_growth, utils::rand_inclusive(rand, ctx, 8, 12));
        } else if (move_id == 22) {
            *self_growth = utils::add_growth(*self_growth, 15);
        } else if (move_id == 23) {
            let bonus = if (utils::miss(rand, ctx, 20)) { 5 } else { 0 };
            *self_growth = utils::add_growth(*self_growth, 10 + bonus);
        } else if (move_id == 24) {
            *self_growth = utils::add_growth(*self_growth, utils::rand_inclusive(rand, ctx, 12, 18));
        } else if (move_id == 25) {
            if (!utils::miss(rand, ctx, 10)) {
                *self_growth = utils::add_growth(*self_growth, 20);
            }
        } else if (move_id == 26) {
            *self_growth = utils::add_growth(*self_growth, utils::rand_inclusive(rand, ctx, 15, 20));
        } else if (move_id == 27) {
            *self_growth = utils::add_growth(*self_growth, 10);
            self_status.block_turns = 1;
        } else if (move_id == 28) {
            *self_growth = utils::add_growth(*self_growth, 12);
        } else if (move_id == 29) {
            *self_growth = utils::add_growth(*self_growth, 8);
            if (!utils::miss(rand, ctx, 50)) {
                self_status.block_turns = self_status.block_turns + 1;
            }
        } else if (move_id == 30) {
            *self_growth = utils::add_growth(*self_growth, utils::rand_inclusive(rand, ctx, 10, 15));
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  NEW: TREE / Forest Utility Functions
    // ═══════════════════════════════════════════════════════════════════════════

    /// Same as use_ability_id but accepts TreeConfig for future tree advantage integration.
    /// Currently uses the same base thresholds as v1 (50 for bot, 100 for PvP).
    public fun use_ability_id_v2(
        battle: &mut Battle,
        move_id: u8,
        _config: &Config,
        _tree_config: &TreeConfig,
        rand: &Random,
        ctx: &mut TxContext,
    ) {
        assert!(!battle.finished, errors::e_battle_finished());
        let sender = tx_context::sender(ctx);
        let is_player_turn = if (battle.turn == 0) {
            assert!(sender == battle.player1, errors::e_unauthorized_player());
            utils::contains_u8(&battle.p1_moves, move_id)
        } else {
            assert!(sender == battle.player2, errors::e_unauthorized_player());
            utils::contains_u8(&battle.p2_moves, move_id)
        };
        assert!(is_player_turn, errors::e_invalid_move());

        let base_target = if (battle.is_bot_battle) { 50 } else { 100 };

        if (battle.turn == 0) {
            apply_player1_move(battle, move_id, rand, ctx);

            if (battle.p1_growth >= base_target) {
                let winner = battle.player1;
                finish_and_payout(battle, winner, ctx);
            } else if (battle.is_bot_battle) {
                let bot_move = choose_bot_move(battle, rand, ctx);
                emit_bot_move_resolved(battle, bot_move);
                rotate_bot_move_to_end(battle, bot_move);
                apply_player2_move(battle, bot_move, rand, ctx);

                if (battle.p2_growth >= base_target) {
                    let winner = battle.player2;
                    finish_and_payout(battle, winner, ctx);
                } else {
                    battle.turn = 0;
                    emit_update(battle);
                };
            } else {
                battle.turn = 1;
                emit_update(battle);
            };
        } else {
            apply_player2_move(battle, move_id, rand, ctx);

            if (battle.p2_growth >= base_target) {
                let winner = battle.player2;
                finish_and_payout(battle, winner, ctx);
            } else {
                battle.turn = 0;
                emit_update(battle);
            };
        };
    }

    /// Reroll your move set by burning the configured utility coin (e.g. $TREE).
    /// Cost is set in TreeConfig via set_tree_params(). Does NOT advance the turn.
    public entry fun reroll_moves<T>(
        battle: &mut Battle,
        tree_config: &TreeConfig,
        mut payment: coin::Coin<T>,
        rand: &Random,
        ctx: &mut TxContext,
    ) {
        assert!(!battle.finished, errors::e_battle_finished());
        assert!(config::is_utility_coin<T>(tree_config), errors::e_incorrect_coin_type());
        assert!(config::reroll_cost(tree_config) > 0, errors::e_tree_insufficient());

        let sender = tx_context::sender(ctx);
        assert!(sender == battle.player1 || sender == battle.player2, errors::e_unauthorized_player());

        let cost = config::reroll_cost(tree_config);
        assert!(coin::value(&payment) >= cost, errors::e_insufficient_payment());

        // Send the exact reroll fee to the Garden Battles recipient.
        let burn_coin = coin::split(&mut payment, cost, ctx);
        transfer::public_transfer(burn_coin, TREE_REROLL_RECIPIENT);

        // Return any surplus to the sender
        if (coin::value(&payment) > 0) {
            transfer::public_transfer(payment, tx_context::sender(ctx));
        } else {
            coin::destroy_zero(payment);
        };

        // Regenerate 4 new random moves for this player
        let new_moves = gen_moves(rand, ctx);
        if (sender == battle.player1) {
            battle.p1_moves = new_moves;
        } else {
            battle.p2_moves = new_moves;
        };

        emit_update(battle);
    }

    /// Replaces the current PvP V3 player's entire hand once per battle.
    /// The reroll is only available on that player's turn and never advances it.
    public entry fun reroll_pvp_v3_moves<T>(
        battle: &mut PvpBattleV3,
        tree_config: &TreeConfig,
        payment: coin::Coin<T>,
        rand: &Random,
        ctx: &mut TxContext,
    ) {
        assert!(!battle.finished, errors::e_battle_finished());
        let sender = tx_context::sender(ctx);

        if (sender == battle.player1) {
            assert!(battle.turn == 0, errors::e_reroll_not_players_turn());
            assert!(!battle.p1_reroll_used, errors::e_reroll_already_used());
            charge_reroll(tree_config, payment, PVP_V3_REROLL_COST_MULTIPLIER, ctx);
            battle.p1_moves = gen_reroll_moves(
                &battle.p1_moves,
                battle.p1_fifth_move_entitled,
                rand,
                ctx,
            );
            battle.p1_reroll_used = true;
        } else if (sender == battle.player2) {
            assert!(battle.turn == 1, errors::e_reroll_not_players_turn());
            assert!(!battle.p2_reroll_used, errors::e_reroll_already_used());
            charge_reroll(tree_config, payment, PVP_V3_REROLL_COST_MULTIPLIER, ctx);
            battle.p2_moves = gen_reroll_moves(
                &battle.p2_moves,
                battle.p2_fifth_move_entitled,
                rand,
                ctx,
            );
            battle.p2_reroll_used = true;
        } else {
            abort errors::e_unauthorized_player()
        };

        emit_update_v3(battle);
    }

    /// Gives every ranked Garden Bot player one free four-card reroll per
    /// battle. It preserves the turn, Growth, and fifth-card choice/draft.
    public entry fun reroll_ranked_bot_v2_moves_free(
        battle: &mut RankedBotBattleV2,
        rand: &Random,
        ctx: &mut TxContext,
    ) {
        assert!(!battle.finished, errors::e_battle_finished());
        assert!(tx_context::sender(ctx) == battle.player1, errors::e_unauthorized_player());
        assert!(battle.turn == 0, errors::e_reroll_not_players_turn());
        assert!(!battle.p1_reroll_used, errors::e_reroll_already_used());

        battle.p1_moves = gen_free_ranked_bot_reroll_moves(
            &battle.p1_moves,
            battle.p1_fifth_move_entitled,
            rand,
            ctx,
        );
        battle.p1_reroll_used = true;
        emit_update_ranked_bot_v2(battle);
    }

    /// Retained for package compatibility. Garden Bot rerolls are disabled.
    public entry fun reroll_ranked_bot_v2_moves<T>(
        _battle: &mut RankedBotBattleV2,
        _tree_config: &TreeConfig,
        _payment: coin::Coin<T>,
        _rand: &Random,
        _ctx: &mut TxContext,
    ) {
        abort errors::e_reroll_disabled_for_mode()
    }

    /// Spend the configured utility coin (e.g. $TREE) for an instant growth boost.
    /// Does NOT advance or replace your turn — you still play a move after.
    public entry fun tree_boost<T>(
        battle: &mut Battle,
        tree_config: &TreeConfig,
        mut payment: coin::Coin<T>,
        _rand: &Random,
        ctx: &mut TxContext,
    ) {
        assert!(!battle.finished, errors::e_battle_finished());
        assert!(config::is_utility_coin<T>(tree_config), errors::e_incorrect_coin_type());

        let sender = tx_context::sender(ctx);
        assert!(sender == battle.player1 || sender == battle.player2, errors::e_unauthorized_player());

        let cost = config::boost_cost(tree_config);
        assert!(cost > 0, errors::e_tree_insufficient());
        assert!(coin::value(&payment) >= cost, errors::e_insufficient_payment());

        // Burn the cost amount
        let burn_coin = coin::split(&mut payment, cost, ctx);
        transfer::public_transfer(burn_coin, @0x0);

        if (coin::value(&payment) > 0) {
            transfer::public_transfer(payment, tx_context::sender(ctx));
        } else {
            coin::destroy_zero(payment);
        };

        // Apply growth boost
        let boost = config::boost_growth(tree_config);
        if (sender == battle.player1) {
            battle.p1_growth = utils::add_growth(battle.p1_growth, boost);
        } else {
            battle.p2_growth = utils::add_growth(battle.p2_growth, boost);
        };

        battle.p1_growth = utils::clamp(battle.p1_growth, 0, 100);
        battle.p2_growth = utils::clamp(battle.p2_growth, 0, 100);

        emit_update(battle);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  TEST-ONLY: Getters and helpers
    // ═══════════════════════════════════════════════════════════════════════════

    #[test_only]
    public fun p1_moves(battle: &Battle): &vector<u8> { &battle.p1_moves }
    #[test_only]
    public fun p2_moves(battle: &Battle): &vector<u8> { &battle.p2_moves }
    #[test_only]
    public fun set_p2_moves_for_testing(battle: &mut Battle, moves: vector<u8>) {
        battle.p2_moves = moves;
    }
    #[test_only]
    public fun p1_growth(battle: &Battle): u64 { battle.p1_growth }
    #[test_only]
    public fun p2_growth(battle: &Battle): u64 { battle.p2_growth }
    #[test_only]
    public fun vault_value(battle: &Battle): u64 { balance::value(&battle.vault) }
    #[test_only]
    public fun battle_entry_fee(battle: &Battle): u64 { battle.battle_entry_fee }
    #[test_only]
    public fun battle_winner_payout(battle: &Battle): u64 { battle.winner_payout }
    #[test_only]
    public fun battle_treasury_share(battle: &Battle): u64 { battle.treasury_share }
    #[test_only]
    public fun is_finished(battle: &Battle): bool { battle.finished }
    #[test_only]
    public fun winner(battle: &Battle): Option<address> { battle.winner }
    #[test_only]
    public fun player1(battle: &Battle): address { battle.player1 }
    #[test_only]
    public fun player2(battle: &Battle): address { battle.player2 }
    #[test_only]
    public fun turn(battle: &Battle): u8 { battle.turn }
    #[test_only]
    public fun bot_move_score_for_testing(move_id: u8, self_growth: u64, opp_growth: u64): u64 {
        let self_status = Status {
            block_turns: 0,
            next_turn_penalty: 0,
            poison_ticks: 0,
            poison_dpt: 0,
        };
        let opp_status = Status {
            block_turns: 0,
            next_turn_penalty: 0,
            poison_ticks: 0,
            poison_dpt: 0,
        };
        bot_move_score(move_id, self_growth, opp_growth, &self_status, &opp_status)
    }

    #[test_only]
    public fun resolve_move_for_testing(
        move_id: u8,
        initial_self_growth: u64,
        initial_opp_growth: u64,
        rand: &Random,
        ctx: &mut TxContext,
    ): (u64, u64, u8, u8, u64) {
        let mut self_growth = initial_self_growth;
        let mut opp_growth = initial_opp_growth;
        let mut self_status = Status {
            block_turns: 0,
            next_turn_penalty: 3,
            poison_ticks: 2,
            poison_dpt: 5,
        };
        let mut opp_status = Status {
            block_turns: 0,
            next_turn_penalty: 0,
            poison_ticks: 0,
            poison_dpt: 0,
        };
        resolve_move(
            move_id,
            &mut self_growth,
            &mut opp_growth,
            &mut self_status,
            &mut opp_status,
            rand,
            ctx,
        );
        (
            self_growth,
            opp_growth,
            self_status.block_turns,
            self_status.poison_ticks,
            self_status.next_turn_penalty,
        )
    }

    #[test_only]
    public fun is_attack_hand_candidate_for_testing(move_id: u8): bool {
        utils::contains_u8(&attack_hand_candidate_moves(), move_id)
    }

    #[test_only]
    public fun is_growth_hand_candidate_for_testing(move_id: u8): bool {
        utils::contains_u8(&growth_hand_candidate_moves(), move_id)
    }

    #[test_only]
    public fun is_hybrid_hand_candidate_for_testing(move_id: u8): bool {
        utils::contains_u8(&hybrid_hand_candidate_moves(), move_id)
    }

    #[test_only]
    public fun is_fifth_attack_candidate_for_testing(move_id: u8): bool {
        utils::contains_u8(&fifth_attack_candidate_moves(), move_id)
    }

    #[test_only]
    public fun is_fifth_growth_candidate_for_testing(move_id: u8): bool {
        utils::contains_u8(&fifth_growth_candidate_moves(), move_id)
    }

    #[test_only]
    public fun is_fifth_hybrid_candidate_for_testing(move_id: u8): bool {
        utils::contains_u8(&fifth_hybrid_candidate_moves(), move_id)
    }

    #[test_only]
    public fun map_catalog_name_for_testing(name: vector<u8>): u8 {
        map_ability_name(name)
    }

    #[test_only]
    public fun resolve_catalog_move_for_testing(
        move_id: u8,
        initial_self_growth: u64,
        initial_opp_growth: u64,
        self_last_move: u8,
        opp_last_move: u8,
        opp_has_block: bool,
        self_has_pending_damage: bool,
        rand: &Random,
        ctx: &mut TxContext,
    ): (u64, u64, u8, u8, u8, u64, bool, u64) {
        let mut self_growth = initial_self_growth;
        let mut opp_growth = initial_opp_growth;
        let mut self_status = Status {
            block_turns: 0,
            next_turn_penalty: if (self_has_pending_damage) { 4 } else { 0 },
            poison_ticks: 0,
            poison_dpt: 0,
        };
        let mut opp_status = Status {
            block_turns: if (opp_has_block) { 1 } else { 0 },
            next_turn_penalty: 0,
            poison_ticks: 0,
            poison_dpt: 0,
        };
        let mut self_card = FighterCardState {
            last_move: if (self_last_move == 0) { option::none() } else { option::some(self_last_move) },
            reflect_damage: 0,
            armor_half: false,
            attack_cap: option::none(),
        };
        let mut opp_card = FighterCardState {
            last_move: if (opp_last_move == 0) { option::none() } else { option::some(opp_last_move) },
            reflect_damage: 0,
            armor_half: false,
            attack_cap: option::none(),
        };
        let had_pending = apply_catalog_start_of_turn(move_id, 0, &mut self_growth, &mut self_status);
        resolve_catalog_move(
            move_id,
            had_pending,
            &mut self_growth,
            &mut opp_growth,
            &mut self_status,
            &mut opp_status,
            &mut self_card,
            &mut opp_card,
            rand,
            ctx,
        );
        let armor_half = self_card.armor_half;
        let attack_cap_value = if (option::is_some(&self_card.attack_cap)) {
            *option::borrow(&self_card.attack_cap)
        } else { 0 };
        let FighterCardState {
            last_move: _,
            reflect_damage: _,
            armor_half: _,
            attack_cap: _,
        } = self_card;
        let FighterCardState {
            last_move: _,
            reflect_damage: _,
            armor_half: _,
            attack_cap: _,
        } = opp_card;
        (
            self_growth,
            opp_growth,
            self_status.block_turns,
            opp_status.block_turns,
            opp_status.poison_ticks,
            opp_status.next_turn_penalty,
            armor_half,
            attack_cap_value,
        )
    }

    #[test_only]
    public fun apply_start_of_turn_status_for_testing(move_id: u8): (u64, u8, u64) {
        let mut growth = 20;
        let mut status = Status {
            block_turns: 0,
            next_turn_penalty: 3,
            poison_ticks: 2,
            poison_dpt: 5,
        };
        apply_start_of_turn_status(move_id, &mut growth, &mut status);
        (growth, status.poison_ticks, status.next_turn_penalty)
    }
    #[test_only]
    public fun bot_score_is_viable_for_testing(score: u64, max_score: u64): bool {
        bot_score_is_viable(score, max_score)
    }
    #[test_only]
    public fun pvp_v2_p1_moves(battle: &PvpBattleV2): &vector<u8> { &battle.p1_moves }
    #[test_only]
    public fun pvp_v2_p2_moves(battle: &PvpBattleV2): &vector<u8> { &battle.p2_moves }
    #[test_only]
    public fun set_pvp_v2_p1_moves_for_testing(battle: &mut PvpBattleV2, moves: vector<u8>) {
        battle.p1_moves = moves;
    }
    #[test_only]
    public fun set_pvp_v2_p2_moves_for_testing(battle: &mut PvpBattleV2, moves: vector<u8>) {
        battle.p2_moves = moves;
    }
    #[test_only]
    public fun set_pvp_v2_p1_growth_for_testing(battle: &mut PvpBattleV2, growth: u64) {
        battle.p1_growth = growth;
    }
    #[test_only]
    public fun set_pvp_v2_p2_growth_for_testing(battle: &mut PvpBattleV2, growth: u64) {
        battle.p2_growth = growth;
    }
    #[test_only]
    public fun set_pvp_v2_last_move_ms_for_testing(battle: &mut PvpBattleV2, last_move_ms: u64) {
        battle.last_move_ms = last_move_ms;
    }
    #[test_only]
    public fun pvp_v2_p1_growth(battle: &PvpBattleV2): u64 { battle.p1_growth }
    #[test_only]
    public fun pvp_v2_p2_growth(battle: &PvpBattleV2): u64 { battle.p2_growth }
    #[test_only]
    public fun pvp_v2_target_growth(battle: &PvpBattleV2): u64 { battle.target_growth }
    #[test_only]
    public fun pvp_v2_vault_value(battle: &PvpBattleV2): u64 { balance::value(&battle.vault) }
    #[test_only]
    public fun pvp_v2_battle_entry_fee(battle: &PvpBattleV2): u64 { battle.battle_entry_fee }
    #[test_only]
    public fun pvp_v2_winner_payout(battle: &PvpBattleV2): u64 { battle.winner_payout }
    #[test_only]
    public fun pvp_v2_treasury_share(battle: &PvpBattleV2): u64 { battle.treasury_share }
    #[test_only]
    public fun pvp_v2_is_finished(battle: &PvpBattleV2): bool { battle.finished }
    #[test_only]
    public fun pvp_v2_winner(battle: &PvpBattleV2): Option<address> { battle.winner }
    #[test_only]
    public fun pvp_v2_player1(battle: &PvpBattleV2): address { battle.player1 }
    #[test_only]
    public fun pvp_v2_player2(battle: &PvpBattleV2): address { battle.player2 }
    #[test_only]
    public fun pvp_v2_turn(battle: &PvpBattleV2): u8 { battle.turn }

    #[test_only]
    public fun pvp_v3_p1_moves(battle: &PvpBattleV3): &vector<u8> { &battle.p1_moves }
    #[test_only]
    public fun pvp_v3_p2_moves(battle: &PvpBattleV3): &vector<u8> { &battle.p2_moves }
    #[test_only]
    public fun set_pvp_v3_p1_moves_for_testing(battle: &mut PvpBattleV3, moves: vector<u8>) {
        battle.p1_moves = moves;
    }
    #[test_only]
    public fun set_pvp_v3_p1_growth_for_testing(battle: &mut PvpBattleV3, growth: u64) {
        battle.p1_growth = growth;
    }
    #[test_only]
    public fun set_pvp_v3_p2_growth_for_testing(battle: &mut PvpBattleV3, growth: u64) {
        battle.p2_growth = growth;
    }
    #[test_only]
    public fun set_pvp_v3_last_move_ms_for_testing(battle: &mut PvpBattleV3, last_move_ms: u64) {
        battle.last_move_ms = last_move_ms;
    }
    #[test_only]
    public fun set_pvp_v3_turn_for_testing(battle: &mut PvpBattleV3, turn: u8) {
        assert!(turn <= 1, errors::e_invalid_move());
        battle.turn = turn;
    }
    #[test_only]
    public fun pvp_v3_p1_growth(battle: &PvpBattleV3): u64 { battle.p1_growth }
    #[test_only]
    public fun pvp_v3_p2_growth(battle: &PvpBattleV3): u64 { battle.p2_growth }
    #[test_only]
    public fun pvp_v3_target_growth(battle: &PvpBattleV3): u64 { battle.target_growth }
    #[test_only]
    public fun pvp_v3_vault_value(battle: &PvpBattleV3): u64 { balance::value(&battle.vault) }
    #[test_only]
    public fun pvp_v3_battle_entry_fee(battle: &PvpBattleV3): u64 { battle.battle_entry_fee }
    #[test_only]
    public fun pvp_v3_winner_payout(battle: &PvpBattleV3): u64 { battle.winner_payout }
    #[test_only]
    public fun pvp_v3_treasury_share(battle: &PvpBattleV3): u64 { battle.treasury_share }
    #[test_only]
    public fun pvp_v3_is_finished(battle: &PvpBattleV3): bool { battle.finished }
    #[test_only]
    public fun pvp_v3_winner(battle: &PvpBattleV3): Option<address> { battle.winner }
    #[test_only]
    public fun pvp_v3_player1(battle: &PvpBattleV3): address { battle.player1 }
    #[test_only]
    public fun pvp_v3_player2(battle: &PvpBattleV3): address { battle.player2 }
    #[test_only]
    public fun pvp_v3_turn(battle: &PvpBattleV3): u8 { battle.turn }
    #[test_only]
    public fun pvp_v3_p1_fifth_move_entitled(battle: &PvpBattleV3): bool { battle.p1_fifth_move_entitled }
    #[test_only]
    public fun pvp_v3_p2_fifth_move_entitled(battle: &PvpBattleV3): bool { battle.p2_fifth_move_entitled }
    #[test_only]
    public fun pvp_v3_p1_reroll_used(battle: &PvpBattleV3): bool { battle.p1_reroll_used }
    #[test_only]
    public fun pvp_v3_p2_reroll_used(battle: &PvpBattleV3): bool { battle.p2_reroll_used }
    #[test_only]
    public fun pvp_v3_p1_eligibility_digest_len(battle: &PvpBattleV3): u64 { vector::length(&battle.p1_eligibility_digest) }
    #[test_only]
    public fun pvp_v3_p2_eligibility_digest_len(battle: &PvpBattleV3): u64 { vector::length(&battle.p2_eligibility_digest) }

    #[test_only]
    public fun ranked_bot_v2_p1_moves(battle: &RankedBotBattleV2): &vector<u8> { &battle.p1_moves }
    #[test_only]
    public fun ranked_bot_v2_p2_moves(battle: &RankedBotBattleV2): &vector<u8> { &battle.p2_moves }
    #[test_only]
    public fun ranked_bot_v2_p1_fifth_move_entitled(battle: &RankedBotBattleV2): bool { battle.p1_fifth_move_entitled }
    #[test_only]
    public fun ranked_bot_v2_p1_reroll_used(battle: &RankedBotBattleV2): bool { battle.p1_reroll_used }
    #[test_only]
    public fun ranked_bot_v2_target_growth(battle: &RankedBotBattleV2): u64 { battle.target_growth }
    #[test_only]
    public fun ranked_bot_v2_is_finished(battle: &RankedBotBattleV2): bool { battle.finished }
    #[test_only]
    public fun ranked_bot_v2_winner(battle: &RankedBotBattleV2): Option<address> { battle.winner }
    #[test_only]
    public fun ranked_bot_v2_vault_value(battle: &RankedBotBattleV2): u64 { balance::value(&battle.vault) }
    #[test_only]
    public fun ranked_bot_v2_battle_entry_fee(battle: &RankedBotBattleV2): u64 { battle.battle_entry_fee }
    #[test_only]
    public fun ranked_bot_v2_winner_payout(battle: &RankedBotBattleV2): u64 { battle.winner_payout }
    #[test_only]
    public fun ranked_bot_v2_treasury_share(battle: &RankedBotBattleV2): u64 { battle.treasury_share }
    #[test_only]
    public fun ranked_bot_v2_eligibility_digest_len(battle: &RankedBotBattleV2): u64 {
        vector::length(&battle.p1_eligibility_digest)
    }
    #[test_only]
    public fun set_ranked_bot_v2_p1_moves_for_testing(battle: &mut RankedBotBattleV2, moves: vector<u8>) {
        battle.p1_moves = moves;
    }
    #[test_only]
    public fun set_ranked_bot_v2_p1_growth_for_testing(battle: &mut RankedBotBattleV2, growth: u64) {
        battle.p1_growth = growth;
    }
    #[test_only]
    public fun set_ranked_bot_v2_last_move_ms_for_testing(battle: &mut RankedBotBattleV2, last_move_ms: u64) {
        battle.last_move_ms = last_move_ms;
    }
}
