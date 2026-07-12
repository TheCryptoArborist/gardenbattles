#[allow(lint(public_random))]
module battle_garden::battle {
    use sui::event;
    use sui::balance::{Self, Balance};
    use sui::coin;
    use sui::sui::SUI;
    use sui::random::{Self, Random};
    use sui::kiosk::{Self, Kiosk, KioskOwnerCap};
    use battle_garden::utils;
    use battle_garden::errors;
    use battle_garden::config::{Self, Config, TreeConfig};

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

    // ═══════════════════════════════════════════════════════════════════════════
    //  Core battle functions (unchanged)
    // ═══════════════════════════════════════════════════════════════════════════

    // Helper to generate moves - Internal
    fun gen_moves(_arg0: &Random, _arg1: &mut TxContext): vector<u8> {
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

        let mut growths = vector::empty<u8>();
        vector::push_back(&mut growths, 20);
        vector::push_back(&mut growths, 21);
        vector::push_back(&mut growths, 22);
        vector::push_back(&mut growths, 23);
        vector::push_back(&mut growths, 24);
        vector::push_back(&mut growths, 25);
        vector::push_back(&mut growths, 26);
        vector::push_back(&mut growths, 28);
        vector::push_back(&mut growths, 30);

        let mut utility = vector::empty<u8>();
        vector::push_back(&mut utility, 9);
        vector::push_back(&mut utility, 27);
        vector::push_back(&mut utility, 29);

        let mut moves = vector::empty<u8>();
        let mut rng = random::new_generator(_arg0, _arg1);
        let attacks_len: u64 = vector::length(&attacks);
        let growths_len: u64 = vector::length(&growths);
        let utility_len: u64 = vector::length(&utility);
        let idx1 = random::generate_u64(&mut rng) % attacks_len;
        let mut idx2 = random::generate_u64(&mut rng) % attacks_len;
        if (idx1 == idx2) {
            idx2 = (idx1 + 1) % attacks_len;
        };
        vector::push_back(&mut moves, *vector::borrow(&attacks, idx1));
        vector::push_back(&mut moves, *vector::borrow(&attacks, idx2));
        let idx3 = random::generate_u64(&mut rng) % growths_len;
        let idx4 = random::generate_u64(&mut rng) % utility_len;
        vector::push_back(&mut moves, *vector::borrow(&growths, idx3));
        vector::push_back(&mut moves, *vector::borrow(&utility, idx4));
        moves
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

    fun apply_damage(arg0: u64, arg1: &mut Status): u64 {
        if (arg1.block_turns > 0) {
            arg1.block_turns = arg1.block_turns - 1;
            0
        } else {
            arg0
        }
    }

    fun map_ability_name(name: vector<u8>): u8 {
        if (utils::eq_str(name, b"ThornSpikeBomb")) { 1 }
        else if (utils::eq_str(name, b"RazorLeafSword")) { 2 }
        else if (utils::eq_str(name, b"TumbleweedMace")) { 3 }
        else if (utils::eq_str(name, b"ShovelSpear")) { 4 }
        else if (utils::eq_str(name, b"ThornedWhip")) { 5 }
        else if (utils::eq_str(name, b"AcornSlingshot")) { 6 }
        else if (utils::eq_str(name, b"StoneNunchuck")) { 7 }
        else if (utils::eq_str(name, b"CactusShield")) { 8 }
        else if (utils::eq_str(name, b"LifeAbsorb")) { 9 }
        else if (utils::eq_str(name, b"Poison")) { 10 }
        else if (utils::eq_str(name, b"WitherTouch")) { 11 }
        else if (utils::eq_str(name, b"PollenCloud")) { 12 }
        else if (utils::eq_str(name, b"FungalRot")) { 13 }
        else if (utils::eq_str(name, b"RootsUp")) { 20 }
        else if (utils::eq_str(name, b"SunBeam")) { 21 }
        else if (utils::eq_str(name, b"RainStorm")) { 22 }
        else if (utils::eq_str(name, b"WhiteMold")) { 23 }
        else if (utils::eq_str(name, b"GreenhouseGas")) { 24 }
        else if (utils::eq_str(name, b"PotassiumPowerUp")) { 25 }
        else if (utils::eq_str(name, b"PhotosyntheticSurge")) { 26 }
        else if (utils::eq_str(name, b"BarkskinArmor")) { 27 }
        else if (utils::eq_str(name, b"SapOverflow")) { 28 }
        else if (utils::eq_str(name, b"CloudCover")) { 29 }
        else if (utils::eq_str(name, b"ShadowCanopy")) { 30 }
        else { 0 }
    }

    fun expected_self_growth(move_id: u8): u64 {
        if (move_id == 9) { 4 }
        else if (move_id == 20) { 10 }
        else if (move_id == 21) { 10 }
        else if (move_id == 22) { 15 }
        else if (move_id == 23) { 10 }
        else if (move_id == 24) { 15 }
        else if (move_id == 25) { 18 }
        else if (move_id == 26) { 17 }
        else if (move_id == 27) { 10 }
        else if (move_id == 28) { 12 }
        else if (move_id == 29) { 8 }
        else if (move_id == 30) { 12 }
        else { 0 }
    }

    fun expected_damage(move_id: u8): u64 {
        if (move_id == 1) { 10 }
        else if (move_id == 2) { 8 }
        else if (move_id == 3) { 12 }
        else if (move_id == 4) { 7 }
        else if (move_id == 5) { 9 }
        else if (move_id == 6) { 6 }
        else if (move_id == 7) { 11 }
        else if (move_id == 8) { 5 }
        else if (move_id == 9) { 8 }
        else if (move_id == 11) { 12 }
        else if (move_id == 12) { 5 }
        else if (move_id == 13) { 7 }
        else { 0 }
    }

    fun adds_block(move_id: u8): bool {
        move_id == 8 || move_id == 12 || move_id == 27 || move_id == 29
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

    fun apply_player1_move(battle: &mut Battle, move_id: u8, rand: &Random, ctx: &mut TxContext) {
        if (battle.p1_status.next_turn_penalty > 0) {
            battle.p1_growth = utils::sub_growth(battle.p1_growth, battle.p1_status.next_turn_penalty);
            battle.p1_status.next_turn_penalty = 0;
        };
        if (battle.p1_status.poison_ticks > 0) {
            battle.p1_growth = utils::sub_growth(battle.p1_growth, battle.p1_status.poison_dpt);
            battle.p1_status.poison_ticks = battle.p1_status.poison_ticks - 1;
        };

        resolve_move(move_id, &mut battle.p1_growth, &mut battle.p2_growth, &mut battle.p1_status, &mut battle.p2_status, rand, ctx);

        battle.p1_growth = utils::clamp(battle.p1_growth, 0, 100);
        battle.p2_growth = utils::clamp(battle.p2_growth, 0, 100);
        battle.last_move_ms = tx_context::epoch_timestamp_ms(ctx);
    }

    fun apply_player2_move(battle: &mut Battle, move_id: u8, rand: &Random, ctx: &mut TxContext) {
        if (battle.p2_status.next_turn_penalty > 0) {
            battle.p2_growth = utils::sub_growth(battle.p2_growth, battle.p2_status.next_turn_penalty);
            battle.p2_status.next_turn_penalty = 0;
        };
        if (battle.p2_status.poison_ticks > 0) {
            battle.p2_growth = utils::sub_growth(battle.p2_growth, battle.p2_status.poison_dpt);
            battle.p2_status.poison_ticks = battle.p2_status.poison_ticks - 1;
        };

        resolve_move(move_id, &mut battle.p2_growth, &mut battle.p1_growth, &mut battle.p2_status, &mut battle.p1_status, rand, ctx);

        battle.p2_growth = utils::clamp(battle.p2_growth, 0, 100);
        battle.p1_growth = utils::clamp(battle.p1_growth, 0, 100);
        battle.last_move_ms = tx_context::epoch_timestamp_ms(ctx);
    }

    fun apply_player1_move_v2(battle: &mut PvpBattleV2, move_id: u8, rand: &Random, ctx: &mut TxContext) {
        if (battle.p1_status.next_turn_penalty > 0) {
            battle.p1_growth = utils::sub_growth(battle.p1_growth, battle.p1_status.next_turn_penalty);
            battle.p1_status.next_turn_penalty = 0;
        };
        if (battle.p1_status.poison_ticks > 0) {
            battle.p1_growth = utils::sub_growth(battle.p1_growth, battle.p1_status.poison_dpt);
            battle.p1_status.poison_ticks = battle.p1_status.poison_ticks - 1;
        };

        resolve_move(move_id, &mut battle.p1_growth, &mut battle.p2_growth, &mut battle.p1_status, &mut battle.p2_status, rand, ctx);

        battle.p1_growth = utils::clamp(battle.p1_growth, 0, 100);
        battle.p2_growth = utils::clamp(battle.p2_growth, 0, 100);
        battle.last_move_ms = tx_context::epoch_timestamp_ms(ctx);
    }

    fun apply_player2_move_v2(battle: &mut PvpBattleV2, move_id: u8, rand: &Random, ctx: &mut TxContext) {
        if (battle.p2_status.next_turn_penalty > 0) {
            battle.p2_growth = utils::sub_growth(battle.p2_growth, battle.p2_status.next_turn_penalty);
            battle.p2_status.next_turn_penalty = 0;
        };
        if (battle.p2_status.poison_ticks > 0) {
            battle.p2_growth = utils::sub_growth(battle.p2_growth, battle.p2_status.poison_dpt);
            battle.p2_status.poison_ticks = battle.p2_status.poison_ticks - 1;
        };

        resolve_move(move_id, &mut battle.p2_growth, &mut battle.p1_growth, &mut battle.p2_status, &mut battle.p1_status, rand, ctx);

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

        // Burn the cost amount (send to 0x0)
        let burn_coin = coin::split(&mut payment, cost, ctx);
        transfer::public_transfer(burn_coin, @0x0);

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
}
