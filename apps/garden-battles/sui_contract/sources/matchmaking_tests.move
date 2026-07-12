#[test_only]
module battle_garden::matchmaking_tests {
    use sui::coin;
    use sui::object;
    use sui::random::{Self, Random};
    use sui::sui::SUI;
    use sui::test_scenario;

    use battle_garden::battle;
    use battle_garden::config::{Self, Config};
    use battle_garden::matchmaking::{Self, MatchmakingQueue, MatchmakingQueueV2};

    public struct TestNFT has key, store { id: UID }
    public struct OtherNFT has key, store { id: UID }

    const ADMIN: address = @0xA;
    const PLAYER_A: address = @0xB;
    const PLAYER_B: address = @0xC;
    const PLAYER_C: address = @0xD;
    const ENTRY_FEE: u64 = 3000000000;
    const WINNER_PAYOUT: u64 = 5000000000;
    const TREASURY_SHARE: u64 = 1000000000;
    const TARGET_50: u64 = 50;
    const TARGET_75: u64 = 75;

    fun setup(): test_scenario::Scenario {
        let mut s = test_scenario::begin(ADMIN);

        test_scenario::next_tx(&mut s, ADMIN);
        {
            config::create_config_for_testing(test_scenario::ctx(&mut s));
            matchmaking::create_queue_for_testing(test_scenario::ctx(&mut s));
        };

        test_scenario::next_tx(&mut s, @0x0);
        {
            random::create_for_testing(test_scenario::ctx(&mut s));
        };

        test_scenario::next_tx(&mut s, ADMIN);
        {
            let mut c = test_scenario::take_shared<Config>(&s);
            config::whitelist_collection<TestNFT>(&mut c, test_scenario::ctx(&mut s));
            config::set_economics(&mut c, ENTRY_FEE, WINNER_PAYOUT, TREASURY_SHARE, test_scenario::ctx(&mut s));
            test_scenario::return_shared(c);
        };

        s
    }

    fun setup_v2(target_growth: u64): test_scenario::Scenario {
        let mut s = test_scenario::begin(ADMIN);

        test_scenario::next_tx(&mut s, ADMIN);
        {
            config::create_config_for_testing(test_scenario::ctx(&mut s));
            matchmaking::create_queue_v2_for_testing(target_growth, test_scenario::ctx(&mut s));
        };

        test_scenario::next_tx(&mut s, @0x0);
        {
            random::create_for_testing(test_scenario::ctx(&mut s));
        };

        test_scenario::next_tx(&mut s, ADMIN);
        {
            let mut c = test_scenario::take_shared<Config>(&s);
            config::whitelist_collection<TestNFT>(&mut c, test_scenario::ctx(&mut s));
            config::set_economics(&mut c, ENTRY_FEE, WINNER_PAYOUT, TREASURY_SHARE, test_scenario::ctx(&mut s));
            test_scenario::return_shared(c);
        };

        s
    }

    fun join_as(s: &mut test_scenario::Scenario, player: address) {
        test_scenario::next_tx(s, player);
        {
            let c = test_scenario::take_shared<Config>(s);
            let mut q = test_scenario::take_shared<MatchmakingQueue>(s);
            let r = test_scenario::take_shared<Random>(s);
            let nft = TestNFT { id: object::new(test_scenario::ctx(s)) };
            let payment = coin::mint_for_testing<SUI>(ENTRY_FEE, test_scenario::ctx(s));

            matchmaking::join_queue<TestNFT>(&c, &mut q, &nft, payment, &r, test_scenario::ctx(s));

            let TestNFT { id } = nft;
            object::delete(id);
            test_scenario::return_shared(r);
            test_scenario::return_shared(q);
            test_scenario::return_shared(c);
        }
    }

    fun join_as_v2(s: &mut test_scenario::Scenario, player: address) {
        test_scenario::next_tx(s, player);
        {
            let c = test_scenario::take_shared<Config>(s);
            let mut q = test_scenario::take_shared<MatchmakingQueueV2>(s);
            let r = test_scenario::take_shared<Random>(s);
            let nft = TestNFT { id: object::new(test_scenario::ctx(s)) };
            let payment = coin::mint_for_testing<SUI>(ENTRY_FEE, test_scenario::ctx(s));

            matchmaking::join_queue_v2<TestNFT>(&c, &mut q, &nft, payment, &r, test_scenario::ctx(s));

            let TestNFT { id } = nft;
            object::delete(id);
            test_scenario::return_shared(r);
            test_scenario::return_shared(q);
            test_scenario::return_shared(c);
        }
    }

    #[test]
    fun second_player_join_creates_battle_and_clears_queue() {
        let mut s = setup();

        join_as(&mut s, PLAYER_A);
        test_scenario::next_tx(&mut s, ADMIN);
        {
            let q = test_scenario::take_shared<MatchmakingQueue>(&s);
            assert!(matchmaking::has_waiting(&q), 0);
            assert!(matchmaking::waiting_player(&q) == PLAYER_A, 0);
            assert!(matchmaking::waiting_entry_fee_snapshot(&q) == ENTRY_FEE, 0);
            assert!(matchmaking::bank_value(&q) == ENTRY_FEE, 0);
            test_scenario::return_shared(q);
        };

        join_as(&mut s, PLAYER_B);
        test_scenario::next_tx(&mut s, ADMIN);
        {
            let q = test_scenario::take_shared<MatchmakingQueue>(&s);
            assert!(!matchmaking::has_waiting(&q), 0);
            assert!(matchmaking::bank_value(&q) == 0, 0);
            test_scenario::return_shared(q);

            let b = test_scenario::take_shared<battle::Battle>(&s);
            assert!(battle::player1(&b) == PLAYER_A, 0);
            assert!(battle::player2(&b) == PLAYER_B, 0);
            assert!(battle::battle_entry_fee(&b) == ENTRY_FEE, 0);
            assert!(battle::battle_winner_payout(&b) == WINNER_PAYOUT, 0);
            assert!(battle::battle_treasury_share(&b) == TREASURY_SHARE, 0);
            assert!(battle::vault_value(&b) == ENTRY_FEE + ENTRY_FEE, 0);
            test_scenario::return_shared(b);
        };

        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 102)]
    fun same_wallet_cannot_match_itself() {
        let mut s = setup();
        join_as(&mut s, PLAYER_A);
        join_as(&mut s, PLAYER_A);
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 101)]
    fun invalid_nft_does_not_join_queue() {
        let mut s = setup();

        test_scenario::next_tx(&mut s, PLAYER_A);
        {
            let c = test_scenario::take_shared<Config>(&s);
            let mut q = test_scenario::take_shared<MatchmakingQueue>(&s);
            let r = test_scenario::take_shared<Random>(&s);
            let nft = OtherNFT { id: object::new(test_scenario::ctx(&mut s)) };
            let payment = coin::mint_for_testing<SUI>(ENTRY_FEE, test_scenario::ctx(&mut s));

            matchmaking::join_queue<OtherNFT>(&c, &mut q, &nft, payment, &r, test_scenario::ctx(&mut s));
            let OtherNFT { id } = nft;
            object::delete(id);
            test_scenario::return_shared(r);
            test_scenario::return_shared(q);
            test_scenario::return_shared(c);
        };
        test_scenario::end(s);
    }

    #[test]
    fun cancel_queue_returns_waiting_deposit() {
        let mut s = setup();

        join_as(&mut s, PLAYER_A);
        test_scenario::next_tx(&mut s, PLAYER_A);
        {
            let mut q = test_scenario::take_shared<MatchmakingQueue>(&s);
            matchmaking::cancel_queue(&mut q, test_scenario::ctx(&mut s));
            assert!(!matchmaking::has_waiting(&q), 0);
            assert!(matchmaking::bank_value(&q) == 0, 0);
            test_scenario::return_shared(q);
        };

        test_scenario::end(s);
    }

    #[test]
    fun third_wallet_can_wait_while_first_match_is_active() {
        let mut s = setup();

        join_as(&mut s, PLAYER_A);
        join_as(&mut s, PLAYER_B);
        join_as(&mut s, PLAYER_C);

        test_scenario::next_tx(&mut s, ADMIN);
        {
            let q = test_scenario::take_shared<MatchmakingQueue>(&s);
            assert!(matchmaking::has_waiting(&q), 0);
            assert!(matchmaking::waiting_player(&q) == PLAYER_C, 0);
            assert!(matchmaking::bank_value(&q) == ENTRY_FEE, 0);
            test_scenario::return_shared(q);

            let b = test_scenario::take_shared<battle::Battle>(&s);
            assert!(battle::player1(&b) == PLAYER_A, 0);
            assert!(battle::player2(&b) == PLAYER_B, 0);
            test_scenario::return_shared(b);
        };

        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 108)]
    fun matched_players_are_not_refundable_from_queue() {
        let mut s = setup();

        join_as(&mut s, PLAYER_A);
        join_as(&mut s, PLAYER_B);

        test_scenario::next_tx(&mut s, PLAYER_A);
        {
            let mut q = test_scenario::take_shared<MatchmakingQueue>(&s);
            matchmaking::cancel_queue(&mut q, test_scenario::ctx(&mut s));
            test_scenario::return_shared(q);
        };
        test_scenario::end(s);
    }

    #[test]
    fun v2_queue_target_50_creates_50_growth_battle() {
        let mut s = setup_v2(TARGET_50);
        join_as_v2(&mut s, PLAYER_A);
        join_as_v2(&mut s, PLAYER_B);

        test_scenario::next_tx(&mut s, ADMIN);
        {
            let q = test_scenario::take_shared<MatchmakingQueueV2>(&s);
            assert!(!matchmaking::has_waiting_v2(&q), 0);
            assert!(matchmaking::bank_value_v2(&q) == 0, 0);
            assert!(matchmaking::target_growth_v2(&q) == TARGET_50, 0);
            test_scenario::return_shared(q);

            let b = test_scenario::take_shared<battle::PvpBattleV2>(&s);
            assert!(battle::pvp_v2_player1(&b) == PLAYER_A, 0);
            assert!(battle::pvp_v2_player2(&b) == PLAYER_B, 0);
            assert!(battle::pvp_v2_target_growth(&b) == TARGET_50, 0);
            assert!(battle::pvp_v2_target_growth(&b) != 100, 0);
            assert!(battle::pvp_v2_battle_entry_fee(&b) == ENTRY_FEE, 0);
            assert!(battle::pvp_v2_winner_payout(&b) == WINNER_PAYOUT, 0);
            assert!(battle::pvp_v2_treasury_share(&b) == TREASURY_SHARE, 0);
            assert!(battle::pvp_v2_vault_value(&b) == ENTRY_FEE + ENTRY_FEE, 0);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    #[test]
    fun v2_queue_target_75_creates_75_growth_battle() {
        let mut s = setup_v2(TARGET_75);
        join_as_v2(&mut s, PLAYER_A);
        join_as_v2(&mut s, PLAYER_B);

        test_scenario::next_tx(&mut s, ADMIN);
        {
            let q = test_scenario::take_shared<MatchmakingQueueV2>(&s);
            assert!(matchmaking::target_growth_v2(&q) == TARGET_75, 0);
            test_scenario::return_shared(q);

            let b = test_scenario::take_shared<battle::PvpBattleV2>(&s);
            assert!(battle::pvp_v2_target_growth(&b) == TARGET_75, 0);
            assert!(battle::pvp_v2_target_growth(&b) != 100, 0);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    #[test]
    fun v2_50_and_75_queues_are_separate_objects() {
        let mut s = test_scenario::begin(ADMIN);

        test_scenario::next_tx(&mut s, ADMIN);
        {
            matchmaking::create_queue_v2_for_testing(TARGET_50, test_scenario::ctx(&mut s));
            matchmaking::create_queue_v2_for_testing(TARGET_75, test_scenario::ctx(&mut s));
        };

        test_scenario::next_tx(&mut s, ADMIN);
        {
            let q1 = test_scenario::take_shared<MatchmakingQueueV2>(&s);
            let q2 = test_scenario::take_shared<MatchmakingQueueV2>(&s);
            let first = matchmaking::target_growth_v2(&q1);
            let second = matchmaking::target_growth_v2(&q2);
            assert!(
                (first == TARGET_50 && second == TARGET_75) ||
                (first == TARGET_75 && second == TARGET_50),
                0,
            );
            test_scenario::return_shared(q2);
            test_scenario::return_shared(q1);
        };

        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 113)]
    fun v2_invalid_target_rejected() {
        let mut s = test_scenario::begin(ADMIN);
        test_scenario::next_tx(&mut s, ADMIN);
        {
            matchmaking::create_queue_v2_for_testing(100, test_scenario::ctx(&mut s));
        };
        test_scenario::end(s);
    }

    #[test]
    fun v2_finish_at_50_uses_stored_target() {
        let mut s = setup_v2(TARGET_50);
        join_as_v2(&mut s, PLAYER_A);
        join_as_v2(&mut s, PLAYER_B);

        test_scenario::next_tx(&mut s, PLAYER_A);
        {
            let mut b = test_scenario::take_shared<battle::PvpBattleV2>(&s);
            let r = test_scenario::take_shared<Random>(&s);
            battle::set_pvp_v2_p1_moves_for_testing(&mut b, vector[20]);
            battle::set_pvp_v2_p1_growth_for_testing(&mut b, 40);
            battle::use_ability_id_pvp_v2(&mut b, 20, &r, test_scenario::ctx(&mut s));
            assert!(battle::pvp_v2_is_finished(&b), 0);
            assert!(option::borrow(&battle::pvp_v2_winner(&b)) == &PLAYER_A, 0);
            assert!(battle::pvp_v2_vault_value(&b) == 0, 0);
            test_scenario::return_shared(r);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    #[test]
    fun v2_finish_at_75_uses_stored_target() {
        let mut s = setup_v2(TARGET_75);
        join_as_v2(&mut s, PLAYER_A);
        join_as_v2(&mut s, PLAYER_B);

        test_scenario::next_tx(&mut s, PLAYER_A);
        {
            let mut b = test_scenario::take_shared<battle::PvpBattleV2>(&s);
            let r = test_scenario::take_shared<Random>(&s);
            battle::set_pvp_v2_p1_moves_for_testing(&mut b, vector[20]);
            battle::set_pvp_v2_p1_growth_for_testing(&mut b, 65);
            battle::use_ability_id_pvp_v2(&mut b, 20, &r, test_scenario::ctx(&mut s));
            assert!(battle::pvp_v2_is_finished(&b), 0);
            assert!(option::borrow(&battle::pvp_v2_winner(&b)) == &PLAYER_A, 0);
            assert!(battle::pvp_v2_vault_value(&b) == 0, 0);
            test_scenario::return_shared(r);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    #[test]
    fun v2_refund_works_for_50_queue() {
        let mut s = setup_v2(TARGET_50);
        join_as_v2(&mut s, PLAYER_A);
        test_scenario::next_tx(&mut s, PLAYER_A);
        {
            let mut q = test_scenario::take_shared<MatchmakingQueueV2>(&s);
            matchmaking::cancel_queue_v2(&mut q, test_scenario::ctx(&mut s));
            assert!(!matchmaking::has_waiting_v2(&q), 0);
            assert!(matchmaking::bank_value_v2(&q) == 0, 0);
            test_scenario::return_shared(q);
        };
        test_scenario::end(s);
    }

    #[test]
    fun v2_refund_works_for_75_queue() {
        let mut s = setup_v2(TARGET_75);
        join_as_v2(&mut s, PLAYER_A);
        test_scenario::next_tx(&mut s, PLAYER_A);
        {
            let mut q = test_scenario::take_shared<MatchmakingQueueV2>(&s);
            matchmaking::cancel_queue_v2(&mut q, test_scenario::ctx(&mut s));
            assert!(!matchmaking::has_waiting_v2(&q), 0);
            assert!(matchmaking::bank_value_v2(&q) == 0, 0);
            test_scenario::return_shared(q);
        };
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 102)]
    fun v2_self_match_blocked() {
        let mut s = setup_v2(TARGET_50);
        join_as_v2(&mut s, PLAYER_A);
        join_as_v2(&mut s, PLAYER_A);
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 101)]
    fun v2_invalid_nft_rejected() {
        let mut s = setup_v2(TARGET_50);

        test_scenario::next_tx(&mut s, PLAYER_A);
        {
            let c = test_scenario::take_shared<Config>(&s);
            let mut q = test_scenario::take_shared<MatchmakingQueueV2>(&s);
            let r = test_scenario::take_shared<Random>(&s);
            let nft = OtherNFT { id: object::new(test_scenario::ctx(&mut s)) };
            let payment = coin::mint_for_testing<SUI>(ENTRY_FEE, test_scenario::ctx(&mut s));

            matchmaking::join_queue_v2<OtherNFT>(&c, &mut q, &nft, payment, &r, test_scenario::ctx(&mut s));
            let OtherNFT { id } = nft;
            object::delete(id);
            test_scenario::return_shared(r);
            test_scenario::return_shared(q);
            test_scenario::return_shared(c);
        };
        test_scenario::end(s);
    }

    #[test]
    fun v2_third_player_can_wait_after_match_forms() {
        let mut s = setup_v2(TARGET_75);
        join_as_v2(&mut s, PLAYER_A);
        join_as_v2(&mut s, PLAYER_B);
        join_as_v2(&mut s, PLAYER_C);

        test_scenario::next_tx(&mut s, ADMIN);
        {
            let q = test_scenario::take_shared<MatchmakingQueueV2>(&s);
            assert!(matchmaking::has_waiting_v2(&q), 0);
            assert!(matchmaking::waiting_player_v2(&q) == PLAYER_C, 0);
            assert!(matchmaking::waiting_entry_fee_snapshot_v2(&q) == ENTRY_FEE, 0);
            assert!(matchmaking::bank_value_v2(&q) == ENTRY_FEE, 0);
            assert!(matchmaking::target_growth_v2(&q) == TARGET_75, 0);
            test_scenario::return_shared(q);

            let b = test_scenario::take_shared<battle::PvpBattleV2>(&s);
            assert!(battle::pvp_v2_player1(&b) == PLAYER_A, 0);
            assert!(battle::pvp_v2_player2(&b) == PLAYER_B, 0);
            assert!(battle::pvp_v2_target_growth(&b) == TARGET_75, 0);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    #[test]
    fun v2_surrender_works() {
        let mut s = setup_v2(TARGET_50);
        join_as_v2(&mut s, PLAYER_A);
        join_as_v2(&mut s, PLAYER_B);

        test_scenario::next_tx(&mut s, PLAYER_A);
        {
            let mut b = test_scenario::take_shared<battle::PvpBattleV2>(&s);
            battle::surrender_pvp_v2(&mut b, test_scenario::ctx(&mut s));
            assert!(battle::pvp_v2_is_finished(&b), 0);
            assert!(option::borrow(&battle::pvp_v2_winner(&b)) == &PLAYER_B, 0);
            assert!(battle::pvp_v2_vault_value(&b) == 0, 0);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    #[test]
    fun v2_admin_winner_close_works() {
        let mut s = setup_v2(TARGET_75);
        join_as_v2(&mut s, PLAYER_A);
        join_as_v2(&mut s, PLAYER_B);

        test_scenario::next_tx(&mut s, ADMIN);
        {
            let c = test_scenario::take_shared<Config>(&s);
            let mut b = test_scenario::take_shared<battle::PvpBattleV2>(&s);
            battle::admin_force_close_pvp_v2_with_winner(&mut b, &c, PLAYER_B, test_scenario::ctx(&mut s));
            assert!(battle::pvp_v2_is_finished(&b), 0);
            assert!(option::borrow(&battle::pvp_v2_winner(&b)) == &PLAYER_B, 0);
            assert!(battle::pvp_v2_vault_value(&b) == 0, 0);
            test_scenario::return_shared(b);
            test_scenario::return_shared(c);
        };
        test_scenario::end(s);
    }

    #[test]
    fun v2_admin_refund_close_works() {
        let mut s = setup_v2(TARGET_50);
        join_as_v2(&mut s, PLAYER_A);
        join_as_v2(&mut s, PLAYER_B);

        test_scenario::next_tx(&mut s, ADMIN);
        {
            let c = test_scenario::take_shared<Config>(&s);
            let mut b = test_scenario::take_shared<battle::PvpBattleV2>(&s);
            battle::admin_force_close_pvp_v2(&mut b, &c, test_scenario::ctx(&mut s));
            assert!(battle::pvp_v2_is_finished(&b), 0);
            assert!(option::is_none(&battle::pvp_v2_winner(&b)), 0);
            assert!(battle::pvp_v2_vault_value(&b) == 0, 0);
            test_scenario::return_shared(b);
            test_scenario::return_shared(c);
        };
        test_scenario::end(s);
    }

    #[test]
    fun v2_timeout_works() {
        let mut s = setup_v2(TARGET_50);
        join_as_v2(&mut s, PLAYER_A);
        join_as_v2(&mut s, PLAYER_B);

        test_scenario::later_epoch(&mut s, 24 * 60 * 60 * 1000, PLAYER_B);
        {
            let mut b = test_scenario::take_shared<battle::PvpBattleV2>(&s);
            battle::set_pvp_v2_last_move_ms_for_testing(&mut b, 0);
            battle::claim_timeout_win_pvp_v2(&mut b, test_scenario::ctx(&mut s));
            assert!(battle::pvp_v2_is_finished(&b), 0);
            assert!(option::borrow(&battle::pvp_v2_winner(&b)) == &PLAYER_B, 0);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }
}
