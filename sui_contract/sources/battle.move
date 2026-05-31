module battle_garden::battle {
    use sui::event;
    use sui::balance::{Self, Balance};
    use sui::coin;
    use sui::sui::SUI;
    use sui::random::{Self, Random};
    use sui::kiosk::{Self, Kiosk, KioskOwnerCap};
    use battle_garden::utils;
    use battle_garden::errors;
    use battle_garden::config::{Self, Config};

    public struct Status has copy, drop, store {
        block_turns: u8,
        next_turn_penalty: u64,
        poison_ticks: u8,
        poison_dpt: u64,
    }

    const TIMEOUT_MS: u64 = 24 * 60 * 60 * 1000;
    const BOT_TIMEOUT_MS: u64 = 10 * 60 * 1000;

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

        let mut supports = vector::empty<u8>();
        vector::push_back(&mut supports, 8);
        vector::push_back(&mut supports, 9);
        vector::push_back(&mut supports, 10);
        vector::push_back(&mut supports, 11);
        vector::push_back(&mut supports, 12);
        vector::push_back(&mut supports, 13);
        vector::push_back(&mut supports, 20);
        vector::push_back(&mut supports, 21);
        vector::push_back(&mut supports, 22);
        vector::push_back(&mut supports, 23);
        vector::push_back(&mut supports, 24);
        vector::push_back(&mut supports, 25);
        vector::push_back(&mut supports, 26);
        vector::push_back(&mut supports, 27);
        vector::push_back(&mut supports, 28);
        vector::push_back(&mut supports, 29);
        vector::push_back(&mut supports, 30);

        let mut moves = vector::empty<u8>();
        let mut rng = random::new_generator(_arg0, _arg1);
        let attacks_len: u64 = vector::length(&attacks);
        let supports_len: u64 = vector::length(&supports);
        let idx1 = random::generate_u64(&mut rng) % attacks_len;
        let mut idx2 = random::generate_u64(&mut rng) % attacks_len;
        if (idx1 == idx2) {
            idx2 = (idx1 + 1) % attacks_len;
        };
        vector::push_back(&mut moves, *vector::borrow(&attacks, idx1));
        vector::push_back(&mut moves, *vector::borrow(&attacks, idx2));
        let idx3 = random::generate_u64(&mut rng) % supports_len;
        let mut idx4 = random::generate_u64(&mut rng) % supports_len;
        if (idx3 == idx4) {
            idx4 = (idx3 + 1) % supports_len;
        };
        vector::push_back(&mut moves, *vector::borrow(&supports, idx3));
        vector::push_back(&mut moves, *vector::borrow(&supports, idx4));
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
        
        let now = tx_context::epoch_timestamp_ms(ctx);
        if (battle.turn == 0) {
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
            battle.last_move_ms = now;
            
            if (battle.p1_growth >= 100) {
                let winner = battle.player1;
                finish_and_payout(battle, winner, ctx);
            } else {
                battle.turn = 1;
                emit_update(battle);
            };
        } else {
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
            battle.last_move_ms = now;
            
            if (battle.p2_growth >= 100) {
                let winner = battle.player2;
                finish_and_payout(battle, winner, ctx);
            } else {
                battle.turn = 0;
                emit_update(battle);
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
}
