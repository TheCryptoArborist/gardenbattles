#[test_only]
module battle_garden::battle_tests {
    use sui::coin::{Self, Coin};
    use sui::test_scenario;
    use sui::random::{Self, Random};
    use sui::object;

    use battle_garden::battle;
    use battle_garden::config::{Self, Config, TreeConfig};

    /// Fake TREE coin for testing TREE utility functions.
    public struct TREE has drop {}

    /// Minimal NFT for creating bot battles in tests.
    public struct TestNFT has key, store { id: UID }

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
}
