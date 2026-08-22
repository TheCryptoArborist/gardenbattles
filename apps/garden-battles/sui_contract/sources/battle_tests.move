#[test_only]
module battle_garden::battle_tests {
    use sui::coin::{Self, Coin};
    use sui::balance;
    use sui::test_scenario;
    use sui::random::{Self, Random};
    use sui::object;

    use battle_garden::battle;
    use battle_garden::config::{Self, Config, TreeConfig};
    use battle_garden::fifth_move;
    use battle_garden::utils;

    /// Fake TREE coin for testing TREE utility functions.
    public struct TREE has drop {}

    /// Minimal NFT for creating bot battles in tests.
    public struct TestNFT has key, store { id: UID }

    #[test]
    fun new_card_effects_match_their_descriptions() {
        let mut s = test_scenario::begin(@0xA);
        test_scenario::next_tx(&mut s, @0x0);
        random::create_for_testing(test_scenario::ctx(&mut s));

        test_scenario::next_tx(&mut s, @0xA);
        {
            let r = test_scenario::take_shared<Random>(&s);

            let (self_14, opp_14, block_14, poison_14, penalty_14) =
                battle::resolve_move_for_testing(14, 10, 20, &r, test_scenario::ctx(&mut s));
            assert!(self_14 == 18 && opp_14 == 20 && block_14 == 0, 0);
            assert!(poison_14 == 0 && penalty_14 == 0, 0);
            let (cleansed_growth, cleansed_poison, cleansed_penalty) =
                battle::apply_start_of_turn_status_for_testing(14);
            assert!(cleansed_growth == 20 && cleansed_poison == 0 && cleansed_penalty == 0, 0);

            let (self_15_behind, _, _, _, _) =
                battle::resolve_move_for_testing(15, 10, 20, &r, test_scenario::ctx(&mut s));
            let (self_15_ahead, _, _, _, _) =
                battle::resolve_move_for_testing(15, 20, 10, &r, test_scenario::ctx(&mut s));
            assert!(self_15_behind == 24 && self_15_ahead == 27, 0);

            let (self_16, opp_16, _, _, _) =
                battle::resolve_move_for_testing(16, 10, 30, &r, test_scenario::ctx(&mut s));
            assert!(self_16 == 5 && opp_16 == 15, 0);

            let (self_17, opp_17, block_17, _, _) =
                battle::resolve_move_for_testing(17, 10, 20, &r, test_scenario::ctx(&mut s));
            assert!(self_17 == 16 && opp_17 == 20 && block_17 == 1, 0);

            let (self_18, opp_18, _, _, _) =
                battle::resolve_move_for_testing(18, 10, 20, &r, test_scenario::ctx(&mut s));
            assert!(self_18 == 16 && opp_18 == 14, 0);

            let (self_19, opp_19, _, _, _) =
                battle::resolve_move_for_testing(19, 10, 20, &r, test_scenario::ctx(&mut s));
            assert!((self_19 == 5 || self_19 == 32) && opp_19 == 20, 0);

            test_scenario::return_shared(r);
        };
        test_scenario::end(s);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  reroll_moves — Happy path
    // ═══════════════════════════════════════════════════════════════════════════

    #[test]
    fun test_reroll_moves_happy_path() {
        let admin = @0xA;
        let player = @0xB;
        let bot = @0xC;
        let mut s = test_scenario::begin(admin);

        // Tx 1 — Create Config + TreeConfig shared objects
        test_scenario::next_tx(&mut s, admin);
        {
            config::create_config_for_testing(test_scenario::ctx(&mut s));
            config::create_tree_config_for_testing(test_scenario::ctx(&mut s));
        };

        // Tx 2 — Create Random
        test_scenario::next_tx(&mut s, @0x0);
        random::create_for_testing(test_scenario::ctx(&mut s));

        // Tx 3 — Admin: set utility coin, reroll cost on TreeConfig, whitelist on Config
        test_scenario::next_tx(&mut s, admin);
        {
            let mut c = test_scenario::take_shared<Config>(&s);
            config::whitelist_collection<TestNFT>(&mut c, test_scenario::ctx(&mut s));
            test_scenario::return_shared(c);
            let mut tc = test_scenario::take_shared<TreeConfig>(&s);
            config::set_utility_coin<TREE>(&mut tc, test_scenario::ctx(&mut s));
            config::set_tree_params(&mut tc, 100, 0, 0, 0, 0, 0, test_scenario::ctx(&mut s));
            test_scenario::return_shared(tc);
        };

        // Tx 4 — Player: create bot battle
        test_scenario::next_tx(&mut s, player);
        {
            let c   = test_scenario::take_shared<Config>(&s);
            let r   = test_scenario::take_shared<Random>(&s);
            let nft = TestNFT { id: object::new(test_scenario::ctx(&mut s)) };
            battle::create_bot_battle<TestNFT>(&c, &nft, bot, &r, test_scenario::ctx(&mut s));
            let TestNFT { id } = nft;
            object::delete(id);
            test_scenario::return_shared(r);
            test_scenario::return_shared(c);
        };

        // Tx 5 — Player: reroll moves + verify
        test_scenario::next_tx(&mut s, player);
        {
            let mut b = test_scenario::take_shared<battle::Battle>(&s);
            let tc    = test_scenario::take_shared<TreeConfig>(&s);
            let r     = test_scenario::take_shared<Random>(&s);
            let payment = coin::mint_for_testing<TREE>(100, test_scenario::ctx(&mut s));

            let old_turn = battle::turn(&b);
            let old_len  = vector::length(battle::p1_moves(&b));

            battle::reroll_moves<TREE>(&mut b, &tc, payment, &r, test_scenario::ctx(&mut s));

            assert!(vector::length(battle::p1_moves(&b)) == 4, 0);
            assert!(battle::turn(&b) == old_turn, 0);
            assert!(old_len == 4, 0);

            test_scenario::return_shared(r);
            test_scenario::return_shared(tc);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    #[test]
    fun pvp_v3_reroll_replaces_hand_once_without_advancing_turn() {
        let admin = @0xA;
        let player = @0xB;
        let opponent = @0xC;
        let mut s = test_scenario::begin(admin);

        test_scenario::next_tx(&mut s, admin);
        {
            config::create_config_for_testing(test_scenario::ctx(&mut s));
            config::create_tree_config_for_testing(test_scenario::ctx(&mut s));
        };
        test_scenario::next_tx(&mut s, @0x0);
        random::create_for_testing(test_scenario::ctx(&mut s));
        test_scenario::next_tx(&mut s, admin);
        {
            let mut tc = test_scenario::take_shared<TreeConfig>(&s);
            config::set_utility_coin<TREE>(&mut tc, test_scenario::ctx(&mut s));
            config::set_tree_params(&mut tc, 100, 0, 0, 0, 0, 0, test_scenario::ctx(&mut s));
            test_scenario::return_shared(tc);
        };
        test_scenario::next_tx(&mut s, player);
        {
            let c = test_scenario::take_shared<Config>(&s);
            let r = test_scenario::take_shared<Random>(&s);
            battle::create_pvp_battle_v3(
                player,
                opponent,
                0,
                &c,
                balance::zero(),
                50,
                fifth_move::standard_eligibility(),
                fifth_move::standard_eligibility(),
                &r,
                test_scenario::ctx(&mut s),
            );
            test_scenario::return_shared(r);
            test_scenario::return_shared(c);
        };
        test_scenario::next_tx(&mut s, player);
        {
            let mut b = test_scenario::take_shared<battle::PvpBattleV3>(&s);
            let tc = test_scenario::take_shared<TreeConfig>(&s);
            let r = test_scenario::take_shared<Random>(&s);
            battle::set_pvp_v3_turn_for_testing(&mut b, 0);
            let old_moves = utils::clone_vec_u8(battle::pvp_v3_p1_moves(&b));
            let payment = coin::mint_for_testing<TREE>(200, test_scenario::ctx(&mut s));

            battle::reroll_pvp_v3_moves<TREE>(&mut b, &tc, payment, &r, test_scenario::ctx(&mut s));

            assert!(battle::pvp_v3_turn(&b) == 0, 0);
            assert!(battle::pvp_v3_p1_reroll_used(&b), 0);
            assert!(vector::length(battle::pvp_v3_p1_moves(&b)) == 4, 0);
            let mut i = 0;
            while (i < vector::length(&old_moves)) {
                assert!(!utils::contains_u8(battle::pvp_v3_p1_moves(&b), *vector::borrow(&old_moves, i)), 0);
                i = i + 1;
            };

            test_scenario::return_shared(r);
            test_scenario::return_shared(tc);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 104)]
    fun pvp_v3_reroll_rejects_the_garden_bot_base_fee() {
        let admin = @0xA;
        let player = @0xB;
        let opponent = @0xC;
        let mut s = test_scenario::begin(admin);

        test_scenario::next_tx(&mut s, admin);
        {
            config::create_config_for_testing(test_scenario::ctx(&mut s));
            config::create_tree_config_for_testing(test_scenario::ctx(&mut s));
        };
        test_scenario::next_tx(&mut s, @0x0);
        random::create_for_testing(test_scenario::ctx(&mut s));
        test_scenario::next_tx(&mut s, admin);
        {
            let mut tc = test_scenario::take_shared<TreeConfig>(&s);
            config::set_utility_coin<TREE>(&mut tc, test_scenario::ctx(&mut s));
            config::set_tree_params(&mut tc, 100, 0, 0, 0, 0, 0, test_scenario::ctx(&mut s));
            test_scenario::return_shared(tc);
        };
        test_scenario::next_tx(&mut s, player);
        {
            let c = test_scenario::take_shared<Config>(&s);
            let r = test_scenario::take_shared<Random>(&s);
            battle::create_pvp_battle_v3(
                player,
                opponent,
                0,
                &c,
                balance::zero(),
                50,
                fifth_move::standard_eligibility(),
                fifth_move::standard_eligibility(),
                &r,
                test_scenario::ctx(&mut s),
            );
            test_scenario::return_shared(r);
            test_scenario::return_shared(c);
        };
        test_scenario::next_tx(&mut s, player);
        {
            let mut b = test_scenario::take_shared<battle::PvpBattleV3>(&s);
            let tc = test_scenario::take_shared<TreeConfig>(&s);
            let r = test_scenario::take_shared<Random>(&s);
            battle::set_pvp_v3_turn_for_testing(&mut b, 0);
            let payment = coin::mint_for_testing<TREE>(100, test_scenario::ctx(&mut s));
            battle::reroll_pvp_v3_moves<TREE>(&mut b, &tc, payment, &r, test_scenario::ctx(&mut s));
            abort 999
        };
    }

    #[test]
    #[expected_failure(abort_code = 204)]
    fun ranked_bot_v2_entitled_reroll_is_disabled() {
        let admin = @0xA;
        let player = @0xB;
        let bot = @0xC;
        let mut s = test_scenario::begin(admin);

        test_scenario::next_tx(&mut s, admin);
        {
            config::create_config_for_testing(test_scenario::ctx(&mut s));
            config::create_tree_config_for_testing(test_scenario::ctx(&mut s));
        };
        test_scenario::next_tx(&mut s, @0x0);
        random::create_for_testing(test_scenario::ctx(&mut s));
        test_scenario::next_tx(&mut s, admin);
        {
            let mut c = test_scenario::take_shared<Config>(&s);
            config::whitelist_collection<TestNFT>(&mut c, test_scenario::ctx(&mut s));
            test_scenario::return_shared(c);
            let mut tc = test_scenario::take_shared<TreeConfig>(&s);
            config::set_utility_coin<TREE>(&mut tc, test_scenario::ctx(&mut s));
            config::set_tree_params(&mut tc, 100, 0, 0, 0, 0, 0, test_scenario::ctx(&mut s));
            test_scenario::return_shared(tc);
        };
        test_scenario::next_tx(&mut s, player);
        {
            let c = test_scenario::take_shared<Config>(&s);
            let r = test_scenario::take_shared<Random>(&s);
            let nft = TestNFT { id: object::new(test_scenario::ctx(&mut s)) };
            let eligibility = fifth_move::snapshot_eligibility(true, 1, 1, 1, vector[1]);
            battle::create_ranked_bot_battle_v2<TestNFT>(
                &c,
                &nft,
                bot,
                eligibility,
                &r,
                test_scenario::ctx(&mut s),
            );
            let TestNFT { id } = nft;
            object::delete(id);
            test_scenario::return_shared(r);
            test_scenario::return_shared(c);
        };
        test_scenario::next_tx(&mut s, player);
        {
            let mut b = test_scenario::take_shared<battle::RankedBotBattleV2>(&s);
            let tc = test_scenario::take_shared<TreeConfig>(&s);
            let r = test_scenario::take_shared<Random>(&s);
            let old_moves = utils::clone_vec_u8(battle::ranked_bot_v2_p1_moves(&b));
            let payment = coin::mint_for_testing<TREE>(100, test_scenario::ctx(&mut s));

            battle::reroll_ranked_bot_v2_moves<TREE>(&mut b, &tc, payment, &r, test_scenario::ctx(&mut s));

            assert!(battle::ranked_bot_v2_p1_reroll_used(&b), 0);
            assert!(vector::length(battle::ranked_bot_v2_p1_moves(&b)) == 7, 0);
            let mut i = 0;
            while (i < vector::length(&old_moves)) {
                assert!(!utils::contains_u8(battle::ranked_bot_v2_p1_moves(&b), *vector::borrow(&old_moves, i)), 0);
                i = i + 1;
            };

            test_scenario::return_shared(r);
            test_scenario::return_shared(tc);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 204)]
    fun ranked_bot_v2_standard_reroll_is_disabled() {
        let admin = @0xA;
        let player = @0xB;
        let bot = @0xC;
        let mut s = test_scenario::begin(admin);

        test_scenario::next_tx(&mut s, admin);
        {
            config::create_config_for_testing(test_scenario::ctx(&mut s));
            config::create_tree_config_for_testing(test_scenario::ctx(&mut s));
        };
        test_scenario::next_tx(&mut s, @0x0);
        random::create_for_testing(test_scenario::ctx(&mut s));
        test_scenario::next_tx(&mut s, admin);
        {
            let mut c = test_scenario::take_shared<Config>(&s);
            config::whitelist_collection<TestNFT>(&mut c, test_scenario::ctx(&mut s));
            test_scenario::return_shared(c);
            let mut tc = test_scenario::take_shared<TreeConfig>(&s);
            config::set_utility_coin<TREE>(&mut tc, test_scenario::ctx(&mut s));
            config::set_tree_params(&mut tc, 100, 0, 0, 0, 0, 0, test_scenario::ctx(&mut s));
            test_scenario::return_shared(tc);
        };
        test_scenario::next_tx(&mut s, player);
        {
            let c = test_scenario::take_shared<Config>(&s);
            let r = test_scenario::take_shared<Random>(&s);
            let nft = TestNFT { id: object::new(test_scenario::ctx(&mut s)) };
            battle::create_ranked_bot_battle_v2_standard<TestNFT>(
                &c,
                &nft,
                bot,
                &r,
                test_scenario::ctx(&mut s),
            );
            let TestNFT { id } = nft;
            object::delete(id);
            test_scenario::return_shared(r);
            test_scenario::return_shared(c);
        };
        test_scenario::next_tx(&mut s, player);
        {
            let mut b = test_scenario::take_shared<battle::RankedBotBattleV2>(&s);
            let tc = test_scenario::take_shared<TreeConfig>(&s);
            let r = test_scenario::take_shared<Random>(&s);
            let payment1 = coin::mint_for_testing<TREE>(100, test_scenario::ctx(&mut s));
            battle::reroll_ranked_bot_v2_moves<TREE>(&mut b, &tc, payment1, &r, test_scenario::ctx(&mut s));
            let payment2 = coin::mint_for_testing<TREE>(100, test_scenario::ctx(&mut s));
            battle::reroll_ranked_bot_v2_moves<TREE>(&mut b, &tc, payment2, &r, test_scenario::ctx(&mut s));
            abort 999
        };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  reroll_moves — Wrong coin type → abort 200
    // ═══════════════════════════════════════════════════════════════════════════

    #[test]
    #[expected_failure(abort_code = 200)]
    fun test_reroll_moves_wrong_coin_aborts() {
        let admin = @0xA;
        let player = @0xB;
        let bot = @0xC;
        let mut s = test_scenario::begin(admin);

        test_scenario::next_tx(&mut s, admin);
        {
            config::create_config_for_testing(test_scenario::ctx(&mut s));
            config::create_tree_config_for_testing(test_scenario::ctx(&mut s));
        };

        test_scenario::next_tx(&mut s, @0x0);
        random::create_for_testing(test_scenario::ctx(&mut s));

        // Set reroll_cost on TreeConfig but do NOT set utility_coin (defaults to SUI)
        test_scenario::next_tx(&mut s, admin);
        {
            let mut c = test_scenario::take_shared<Config>(&s);
            config::whitelist_collection<TestNFT>(&mut c, test_scenario::ctx(&mut s));
            test_scenario::return_shared(c);
            let mut tc = test_scenario::take_shared<TreeConfig>(&s);
            config::set_tree_params(&mut tc, 100, 0, 0, 0, 0, 0, test_scenario::ctx(&mut s));
            test_scenario::return_shared(tc);
        };

        test_scenario::next_tx(&mut s, player);
        {
            let c   = test_scenario::take_shared<Config>(&s);
            let r   = test_scenario::take_shared<Random>(&s);
            let nft = TestNFT { id: object::new(test_scenario::ctx(&mut s)) };
            battle::create_bot_battle<TestNFT>(&c, &nft, bot, &r, test_scenario::ctx(&mut s));
            let TestNFT { id } = nft;
            object::delete(id);
            test_scenario::return_shared(r);
            test_scenario::return_shared(c);
        };

        // Try reroll with TREE while utility_coin is SUI → abort 200
        test_scenario::next_tx(&mut s, player);
        {
            let mut b   = test_scenario::take_shared<battle::Battle>(&s);
            let tc      = test_scenario::take_shared<TreeConfig>(&s);
            let r       = test_scenario::take_shared<Random>(&s);
            let payment = coin::mint_for_testing<TREE>(100, test_scenario::ctx(&mut s));
            battle::reroll_moves<TREE>(&mut b, &tc, payment, &r, test_scenario::ctx(&mut s));
            test_scenario::return_shared(r);
            test_scenario::return_shared(tc);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  reroll_moves — Zero cost → abort 201
    // ═══════════════════════════════════════════════════════════════════════════

    #[test]
    #[expected_failure(abort_code = 201)]
    fun test_reroll_moves_zero_cost_aborts() {
        let admin = @0xA;
        let player = @0xB;
        let bot = @0xC;
        let mut s = test_scenario::begin(admin);

        test_scenario::next_tx(&mut s, admin);
        {
            config::create_config_for_testing(test_scenario::ctx(&mut s));
            config::create_tree_config_for_testing(test_scenario::ctx(&mut s));
        };

        test_scenario::next_tx(&mut s, @0x0);
        random::create_for_testing(test_scenario::ctx(&mut s));

        test_scenario::next_tx(&mut s, admin);
        {
            let mut c = test_scenario::take_shared<Config>(&s);
            config::whitelist_collection<TestNFT>(&mut c, test_scenario::ctx(&mut s));
            test_scenario::return_shared(c);
            let mut tc = test_scenario::take_shared<TreeConfig>(&s);
            config::set_utility_coin<TREE>(&mut tc, test_scenario::ctx(&mut s));
            config::set_tree_params(&mut tc, 0, 0, 0, 0, 0, 0, test_scenario::ctx(&mut s));
            test_scenario::return_shared(tc);
        };

        test_scenario::next_tx(&mut s, player);
        {
            let c   = test_scenario::take_shared<Config>(&s);
            let r   = test_scenario::take_shared<Random>(&s);
            let nft = TestNFT { id: object::new(test_scenario::ctx(&mut s)) };
            battle::create_bot_battle<TestNFT>(&c, &nft, bot, &r, test_scenario::ctx(&mut s));
            let TestNFT { id } = nft;
            object::delete(id);
            test_scenario::return_shared(r);
            test_scenario::return_shared(c);
        };

        test_scenario::next_tx(&mut s, player);
        {
            let mut b   = test_scenario::take_shared<battle::Battle>(&s);
            let tc      = test_scenario::take_shared<TreeConfig>(&s);
            let r       = test_scenario::take_shared<Random>(&s);
            let payment = coin::mint_for_testing<TREE>(100, test_scenario::ctx(&mut s));
            battle::reroll_moves<TREE>(&mut b, &tc, payment, &r, test_scenario::ctx(&mut s));
            test_scenario::return_shared(r);
            test_scenario::return_shared(tc);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  tree_boost — Happy path: growth increases by boost_growth
    // ═══════════════════════════════════════════════════════════════════════════

    #[test]
    fun test_tree_boost_increases_growth() {
        let admin = @0xA;
        let player = @0xB;
        let bot = @0xC;
        let mut s = test_scenario::begin(admin);

        test_scenario::next_tx(&mut s, admin);
        {
            config::create_config_for_testing(test_scenario::ctx(&mut s));
            config::create_tree_config_for_testing(test_scenario::ctx(&mut s));
        };

        test_scenario::next_tx(&mut s, @0x0);
        random::create_for_testing(test_scenario::ctx(&mut s));

        test_scenario::next_tx(&mut s, admin);
        {
            let mut c = test_scenario::take_shared<Config>(&s);
            config::whitelist_collection<TestNFT>(&mut c, test_scenario::ctx(&mut s));
            test_scenario::return_shared(c);
            let mut tc = test_scenario::take_shared<TreeConfig>(&s);
            config::set_utility_coin<TREE>(&mut tc, test_scenario::ctx(&mut s));
            config::set_tree_params(&mut tc, 0, 50, 30, 0, 0, 0, test_scenario::ctx(&mut s));
            test_scenario::return_shared(tc);
        };

        test_scenario::next_tx(&mut s, player);
        {
            let c   = test_scenario::take_shared<Config>(&s);
            let r   = test_scenario::take_shared<Random>(&s);
            let nft = TestNFT { id: object::new(test_scenario::ctx(&mut s)) };
            battle::create_bot_battle<TestNFT>(&c, &nft, bot, &r, test_scenario::ctx(&mut s));
            let TestNFT { id } = nft;
            object::delete(id);
            test_scenario::return_shared(r);
            test_scenario::return_shared(c);
        };

        test_scenario::next_tx(&mut s, player);
        {
            let mut b   = test_scenario::take_shared<battle::Battle>(&s);
            let tc      = test_scenario::take_shared<TreeConfig>(&s);
            let r       = test_scenario::take_shared<Random>(&s);
            let payment = coin::mint_for_testing<TREE>(50, test_scenario::ctx(&mut s));

            assert!(battle::p1_growth(&b) == 0, 0);
            battle::tree_boost<TREE>(&mut b, &tc, payment, &r, test_scenario::ctx(&mut s));
            assert!(battle::p1_growth(&b) == 30, 0);

            test_scenario::return_shared(r);
            test_scenario::return_shared(tc);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  tree_boost — Clamped at 100
    // ═══════════════════════════════════════════════════════════════════════════

    #[test]
    fun test_tree_boost_clamped_at_100() {
        let admin = @0xA;
        let player = @0xB;
        let bot = @0xC;
        let mut s = test_scenario::begin(admin);

        test_scenario::next_tx(&mut s, admin);
        {
            config::create_config_for_testing(test_scenario::ctx(&mut s));
            config::create_tree_config_for_testing(test_scenario::ctx(&mut s));
        };

        test_scenario::next_tx(&mut s, @0x0);
        random::create_for_testing(test_scenario::ctx(&mut s));

        test_scenario::next_tx(&mut s, admin);
        {
            let mut c = test_scenario::take_shared<Config>(&s);
            config::whitelist_collection<TestNFT>(&mut c, test_scenario::ctx(&mut s));
            test_scenario::return_shared(c);
            let mut tc = test_scenario::take_shared<TreeConfig>(&s);
            config::set_utility_coin<TREE>(&mut tc, test_scenario::ctx(&mut s));
            config::set_tree_params(&mut tc, 0, 50, 40, 0, 0, 0, test_scenario::ctx(&mut s));
            test_scenario::return_shared(tc);
        };

        test_scenario::next_tx(&mut s, player);
        {
            let c   = test_scenario::take_shared<Config>(&s);
            let r   = test_scenario::take_shared<Random>(&s);
            let nft = TestNFT { id: object::new(test_scenario::ctx(&mut s)) };
            battle::create_bot_battle<TestNFT>(&c, &nft, bot, &r, test_scenario::ctx(&mut s));
            let TestNFT { id } = nft;
            object::delete(id);
            test_scenario::return_shared(r);
            test_scenario::return_shared(c);
        };

        // Boost → growth 40
        test_scenario::next_tx(&mut s, player);
        {
            let mut b  = test_scenario::take_shared<battle::Battle>(&s);
            let tc     = test_scenario::take_shared<TreeConfig>(&s);
            let r      = test_scenario::take_shared<Random>(&s);
            let p      = coin::mint_for_testing<TREE>(50, test_scenario::ctx(&mut s));
            battle::tree_boost<TREE>(&mut b, &tc, p, &r, test_scenario::ctx(&mut s));
            test_scenario::return_shared(r);
            test_scenario::return_shared(tc);
            test_scenario::return_shared(b);
        };

        // Boost → growth 80
        test_scenario::next_tx(&mut s, player);
        {
            let mut b  = test_scenario::take_shared<battle::Battle>(&s);
            let tc     = test_scenario::take_shared<TreeConfig>(&s);
            let r      = test_scenario::take_shared<Random>(&s);
            let p      = coin::mint_for_testing<TREE>(50, test_scenario::ctx(&mut s));
            battle::tree_boost<TREE>(&mut b, &tc, p, &r, test_scenario::ctx(&mut s));
            test_scenario::return_shared(r);
            test_scenario::return_shared(tc);
            test_scenario::return_shared(b);
        };

        // Boost → growth 120 → clamped to 100
        test_scenario::next_tx(&mut s, player);
        {
            let mut b  = test_scenario::take_shared<battle::Battle>(&s);
            let tc     = test_scenario::take_shared<TreeConfig>(&s);
            let r      = test_scenario::take_shared<Random>(&s);
            let p      = coin::mint_for_testing<TREE>(50, test_scenario::ctx(&mut s));
            battle::tree_boost<TREE>(&mut b, &tc, p, &r, test_scenario::ctx(&mut s));
            assert!(battle::p1_growth(&b) == 100, 0);
            test_scenario::return_shared(r);
            test_scenario::return_shared(tc);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  use_ability_id_v2 — Same thresholds as v1 (no advantage yet)
    // ═══════════════════════════════════════════════════════════════════════════

    #[test]
    fun test_v2_behaves_like_v1_no_advantage() {
        let admin = @0xA;
        let player = @0xB;
        let bot = @0xC;
        let mut s = test_scenario::begin(admin);

        test_scenario::next_tx(&mut s, admin);
        {
            config::create_config_for_testing(test_scenario::ctx(&mut s));
            config::create_tree_config_for_testing(test_scenario::ctx(&mut s));
        };

        test_scenario::next_tx(&mut s, @0x0);
        random::create_for_testing(test_scenario::ctx(&mut s));

        test_scenario::next_tx(&mut s, admin);
        {
            let mut c = test_scenario::take_shared<Config>(&s);
            config::whitelist_collection<TestNFT>(&mut c, test_scenario::ctx(&mut s));
            test_scenario::return_shared(c);
        };

        test_scenario::next_tx(&mut s, player);
        {
            let c   = test_scenario::take_shared<Config>(&s);
            let r   = test_scenario::take_shared<Random>(&s);
            let nft = TestNFT { id: object::new(test_scenario::ctx(&mut s)) };
            battle::create_bot_battle<TestNFT>(&c, &nft, bot, &r, test_scenario::ctx(&mut s));
            let TestNFT { id } = nft;
            object::delete(id);
            test_scenario::return_shared(r);
            test_scenario::return_shared(c);
        };

        // With 0 growth and bot threshold 50, one move won't win
        test_scenario::next_tx(&mut s, player);
        {
            let mut b  = test_scenario::take_shared<battle::Battle>(&s);
            let c      = test_scenario::take_shared<Config>(&s);
            let tc     = test_scenario::take_shared<TreeConfig>(&s);
            let r      = test_scenario::take_shared<Random>(&s);

            let moves = battle::p1_moves(&b);
            let mid   = *vector::borrow(moves, 0);

            battle::use_ability_id_v2(&mut b, mid, &c, &tc, &r, test_scenario::ctx(&mut s));

            assert!(!battle::is_finished(&b), 0);

            test_scenario::return_shared(r);
            test_scenario::return_shared(tc);
            test_scenario::return_shared(c);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    #[test]
    fun test_bot_scores_growth_over_low_value_attack_at_zero_growth() {
        let growth_score = battle::bot_move_score_for_testing(20, 0, 40);
        let pollen_score = battle::bot_move_score_for_testing(12, 0, 40);
        assert!(growth_score > pollen_score, 0);
    }

    #[test]
    fun test_bot_scores_affecting_attack_over_dead_attack() {
        let live_attack_score = battle::bot_move_score_for_testing(1, 20, 25);
        let dead_attack_score = battle::bot_move_score_for_testing(1, 20, 0);
        assert!(live_attack_score > dead_attack_score, 0);
    }

    #[test]
    fun test_bot_scores_growth_cap_as_low_value() {
        let capped_growth_score = battle::bot_move_score_for_testing(20, 100, 0);
        let useful_growth_score = battle::bot_move_score_for_testing(20, 40, 0);
        assert!(useful_growth_score > capped_growth_score, 0);
    }

    #[test]
    fun test_bot_diversity_avoids_last_move_when_alternatives_exist_v1() {
        let admin = @0xA;
        let player = @0xB;
        let bot = @0xC;
        let mut s = test_scenario::begin(admin);

        test_scenario::next_tx(&mut s, admin);
        {
            config::create_config_for_testing(test_scenario::ctx(&mut s));
            config::create_tree_config_for_testing(test_scenario::ctx(&mut s));
        };

        test_scenario::next_tx(&mut s, @0x0);
        random::create_for_testing(test_scenario::ctx(&mut s));

        test_scenario::next_tx(&mut s, admin);
        {
            let mut c = test_scenario::take_shared<Config>(&s);
            config::whitelist_collection<TestNFT>(&mut c, test_scenario::ctx(&mut s));
            test_scenario::return_shared(c);
        };

        test_scenario::next_tx(&mut s, player);
        {
            let c = test_scenario::take_shared<Config>(&s);
            let r = test_scenario::take_shared<Random>(&s);
            let nft = TestNFT { id: object::new(test_scenario::ctx(&mut s)) };
            battle::create_bot_battle<TestNFT>(&c, &nft, bot, &r, test_scenario::ctx(&mut s));
            let TestNFT { id } = nft;
            object::delete(id);
            test_scenario::return_shared(r);
            test_scenario::return_shared(c);
        };

        test_scenario::next_tx(&mut s, player);
        {
            let mut b = test_scenario::take_shared<battle::Battle>(&s);
            let r = test_scenario::take_shared<Random>(&s);
            battle::set_p2_moves_for_testing(&mut b, vector[20, 21, 22, 30]);

            let player_move = *vector::borrow(battle::p1_moves(&b), 0);
            battle::use_ability_id(&mut b, player_move, &r, test_scenario::ctx(&mut s));

            let bot_moves = battle::p2_moves(&b);
            let last_bot_move = *vector::borrow(bot_moves, vector::length(bot_moves) - 1);
            assert!(last_bot_move != 30, 0);

            test_scenario::return_shared(r);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    #[test]
    fun test_bot_diversity_allows_repeat_when_only_option_v2() {
        let admin = @0xA;
        let player = @0xB;
        let bot = @0xC;
        let mut s = test_scenario::begin(admin);

        test_scenario::next_tx(&mut s, admin);
        {
            config::create_config_for_testing(test_scenario::ctx(&mut s));
            config::create_tree_config_for_testing(test_scenario::ctx(&mut s));
        };

        test_scenario::next_tx(&mut s, @0x0);
        random::create_for_testing(test_scenario::ctx(&mut s));

        test_scenario::next_tx(&mut s, admin);
        {
            let mut c = test_scenario::take_shared<Config>(&s);
            config::whitelist_collection<TestNFT>(&mut c, test_scenario::ctx(&mut s));
            test_scenario::return_shared(c);
        };

        test_scenario::next_tx(&mut s, player);
        {
            let c = test_scenario::take_shared<Config>(&s);
            let r = test_scenario::take_shared<Random>(&s);
            let nft = TestNFT { id: object::new(test_scenario::ctx(&mut s)) };
            battle::create_bot_battle<TestNFT>(&c, &nft, bot, &r, test_scenario::ctx(&mut s));
            let TestNFT { id } = nft;
            object::delete(id);
            test_scenario::return_shared(r);
            test_scenario::return_shared(c);
        };

        test_scenario::next_tx(&mut s, player);
        {
            let mut b = test_scenario::take_shared<battle::Battle>(&s);
            let c = test_scenario::take_shared<Config>(&s);
            let tc = test_scenario::take_shared<TreeConfig>(&s);
            let r = test_scenario::take_shared<Random>(&s);
            battle::set_p2_moves_for_testing(&mut b, vector[30]);

            let player_move = *vector::borrow(battle::p1_moves(&b), 0);
            battle::use_ability_id_v2(&mut b, player_move, &c, &tc, &r, test_scenario::ctx(&mut s));

            let bot_moves = battle::p2_moves(&b);
            assert!(vector::length(bot_moves) == 1, 0);
            assert!(*vector::borrow(bot_moves, 0) == 30, 0);

            test_scenario::return_shared(r);
            test_scenario::return_shared(tc);
            test_scenario::return_shared(c);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }
}
