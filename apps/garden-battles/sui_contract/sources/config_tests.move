#[test_only]
module battle_garden::config_tests {
    use sui::test_scenario;

    use battle_garden::config::{Self, Config, TreeConfig};

    const ADMIN: address = @0xA;
    const NEW_ADMIN: address = @0xB;
    const OTHER: address = @0xC;

    fun setup_config(): test_scenario::Scenario {
        let mut s = test_scenario::begin(ADMIN);
        test_scenario::next_tx(&mut s, ADMIN);
        {
            config::create_config_for_testing(test_scenario::ctx(&mut s));
        };
        s
    }

    fun setup_tree_config(): test_scenario::Scenario {
        let mut s = test_scenario::begin(ADMIN);
        test_scenario::next_tx(&mut s, ADMIN);
        {
            config::create_tree_config_for_testing(test_scenario::ctx(&mut s));
        };
        s
    }

    fun transfer_config_to_new_admin(s: &mut test_scenario::Scenario) {
        test_scenario::next_tx(s, ADMIN);
        {
            let mut c = test_scenario::take_shared<Config>(s);
            config::transfer_admin(&mut c, NEW_ADMIN, test_scenario::ctx(s));
            test_scenario::return_shared(c);
        };
    }

    fun transfer_tree_config_to_new_admin(s: &mut test_scenario::Scenario) {
        test_scenario::next_tx(s, ADMIN);
        {
            let mut tc = test_scenario::take_shared<TreeConfig>(s);
            config::transfer_tree_admin(&mut tc, NEW_ADMIN, test_scenario::ctx(s));
            test_scenario::return_shared(tc);
        };
    }

    #[test]
    fun config_admin_can_transfer_and_getter_updates() {
        let mut s = setup_config();
        transfer_config_to_new_admin(&mut s);

        test_scenario::next_tx(&mut s, NEW_ADMIN);
        {
            let c = test_scenario::take_shared<Config>(&s);
            assert!(config::admin(&c) == NEW_ADMIN, 0);
            test_scenario::return_shared(c);
        };

        test_scenario::end(s);
    }

    #[test]
    fun new_config_admin_gains_privileged_access() {
        let mut s = setup_config();
        transfer_config_to_new_admin(&mut s);

        test_scenario::next_tx(&mut s, NEW_ADMIN);
        {
            let mut c = test_scenario::take_shared<Config>(&s);
            config::set_paused(&mut c, true, test_scenario::ctx(&mut s));
            assert!(config::paused(&c), 0);
            test_scenario::return_shared(c);
        };

        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 100)]
    fun old_config_admin_loses_privileged_access() {
        let mut s = setup_config();
        transfer_config_to_new_admin(&mut s);

        test_scenario::next_tx(&mut s, ADMIN);
        {
            let mut c = test_scenario::take_shared<Config>(&s);
            config::set_paused(&mut c, true, test_scenario::ctx(&mut s));
            test_scenario::return_shared(c);
        };

        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 100)]
    fun unauthorized_caller_cannot_transfer_config_admin() {
        let mut s = setup_config();

        test_scenario::next_tx(&mut s, OTHER);
        {
            let mut c = test_scenario::take_shared<Config>(&s);
            config::transfer_admin(&mut c, NEW_ADMIN, test_scenario::ctx(&mut s));
            test_scenario::return_shared(c);
        };

        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 111)]
    fun config_admin_transfer_rejects_zero_address() {
        let mut s = setup_config();

        test_scenario::next_tx(&mut s, ADMIN);
        {
            let mut c = test_scenario::take_shared<Config>(&s);
            config::transfer_admin(&mut c, @0x0, test_scenario::ctx(&mut s));
            test_scenario::return_shared(c);
        };

        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 114)]
    fun config_admin_transfer_rejects_same_address() {
        let mut s = setup_config();

        test_scenario::next_tx(&mut s, ADMIN);
        {
            let mut c = test_scenario::take_shared<Config>(&s);
            config::transfer_admin(&mut c, ADMIN, test_scenario::ctx(&mut s));
            test_scenario::return_shared(c);
        };

        test_scenario::end(s);
    }

    #[test]
    fun tree_admin_can_transfer_and_getter_updates() {
        let mut s = setup_tree_config();
        transfer_tree_config_to_new_admin(&mut s);

        test_scenario::next_tx(&mut s, NEW_ADMIN);
        {
            let tc = test_scenario::take_shared<TreeConfig>(&s);
            assert!(config::tree_admin(&tc) == NEW_ADMIN, 0);
            test_scenario::return_shared(tc);
        };

        test_scenario::end(s);
    }

    #[test]
    fun new_tree_admin_gains_privileged_access() {
        let mut s = setup_tree_config();
        transfer_tree_config_to_new_admin(&mut s);

        test_scenario::next_tx(&mut s, NEW_ADMIN);
        {
            let mut tc = test_scenario::take_shared<TreeConfig>(&s);
            config::set_tree_params(&mut tc, 1, 2, 3, 4, 5, 6, test_scenario::ctx(&mut s));
            assert!(config::reroll_cost(&tc) == 1, 0);
            assert!(config::boost_cost(&tc) == 2, 0);
            assert!(config::boost_growth(&tc) == 3, 0);
            test_scenario::return_shared(tc);
        };

        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 100)]
    fun old_tree_admin_loses_privileged_access() {
        let mut s = setup_tree_config();
        transfer_tree_config_to_new_admin(&mut s);

        test_scenario::next_tx(&mut s, ADMIN);
        {
            let mut tc = test_scenario::take_shared<TreeConfig>(&s);
            config::set_tree_params(&mut tc, 1, 2, 3, 4, 5, 6, test_scenario::ctx(&mut s));
            test_scenario::return_shared(tc);
        };

        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 100)]
    fun unauthorized_caller_cannot_transfer_tree_admin() {
        let mut s = setup_tree_config();

        test_scenario::next_tx(&mut s, OTHER);
        {
            let mut tc = test_scenario::take_shared<TreeConfig>(&s);
            config::transfer_tree_admin(&mut tc, NEW_ADMIN, test_scenario::ctx(&mut s));
            test_scenario::return_shared(tc);
        };

        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 111)]
    fun tree_admin_transfer_rejects_zero_address() {
        let mut s = setup_tree_config();

        test_scenario::next_tx(&mut s, ADMIN);
        {
            let mut tc = test_scenario::take_shared<TreeConfig>(&s);
            config::transfer_tree_admin(&mut tc, @0x0, test_scenario::ctx(&mut s));
            test_scenario::return_shared(tc);
        };

        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 114)]
    fun tree_admin_transfer_rejects_same_address() {
        let mut s = setup_tree_config();

        test_scenario::next_tx(&mut s, ADMIN);
        {
            let mut tc = test_scenario::take_shared<TreeConfig>(&s);
            config::transfer_tree_admin(&mut tc, ADMIN, test_scenario::ctx(&mut s));
            test_scenario::return_shared(tc);
        };

        test_scenario::end(s);
    }
}
