#[test_only]
module battle_garden::matchmaking_tests {
    use sui::coin;
    use sui::object;
    use sui::random::{Self, Random};
    use sui::sui::SUI;
    use sui::clock;
    use sui::test_scenario;

    use battle_garden::battle;
    use battle_garden::config::{Self, Config};
    use battle_garden::fifth_move::{Self, FifthMoveConfig};
    use battle_garden::matchmaking::{Self, MatchmakingQueue, MatchmakingQueueV2, MatchmakingQueueV3};

    public struct TestNFT has key, store { id: UID }
    public struct OtherNFT has key, store { id: UID }
    public struct TREE has drop {}

    const ADMIN: address = @0xA;
    const PLAYER_A: address = @0xB;
    const PLAYER_B: address = @0xC;
    const PLAYER_C: address = @0xD;
    const ENTRY_FEE: u64 = 3000000000;
    const WINNER_PAYOUT: u64 = 5000000000;
    const TREASURY_SHARE: u64 = 1000000000;
    const TARGET_50: u64 = 50;
    const TARGET_75: u64 = 75;
    const THRESHOLD: u64 = 1_000_000_000_000;
    const ISSUED_AT_MS: u64 = 1_000_000;
    const EXPIRES_AT_MS: u64 = 1_120_000;

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

    fun signer_public_key(): vector<u8> {
        vector[
            234, 74, 108, 99, 226, 156, 82, 10,
            190, 245, 80, 123, 19, 46, 197, 249,
            149, 71, 118, 174, 190, 190, 123, 146,
            66, 30, 234, 105, 20, 70, 210, 44,
        ]
    }

    fun valid_signature(): vector<u8> {
        vector[
            216, 121, 212, 186, 182, 237, 109, 188,
            244, 39, 180, 62, 164, 210, 111, 189,
            235, 40, 2, 112, 175, 121, 235, 187,
            132, 123, 118, 2, 16, 172, 64, 158,
            202, 117, 114, 4, 2, 48, 88, 254,
            91, 56, 125, 242, 97, 251, 182, 112,
            110, 181, 184, 147, 100, 148, 75, 37,
            191, 30, 76, 62, 140, 125, 104, 2,
        ]
    }

    fun valid_signature_b(): vector<u8> {
        vector[
            223, 173, 51, 138, 27, 158, 5, 231,
            61, 48, 169, 86, 69, 48, 29, 108,
            226, 5, 195, 168, 206, 107, 135, 187,
            251, 160, 177, 254, 167, 124, 230, 149,
            17, 69, 172, 144, 206, 141, 177, 76,
            201, 213, 59, 214, 163, 67, 120, 126,
            114, 134, 43, 42, 185, 235, 20, 58,
            150, 174, 7, 149, 232, 107, 77, 3,
        ]
    }

    fun valid_signature_multi_source(): vector<u8> {
        vector[
            178, 185, 82, 149, 228, 129, 177, 169,
            34, 184, 240, 85, 243, 229, 11, 178,
            42, 103, 107, 141, 205, 112, 148, 107,
            97, 13, 201, 58, 172, 39, 8, 19,
            183, 249, 49, 224, 189, 200, 174, 13,
            119, 245, 72, 114, 65, 103, 38, 69,
            162, 247, 117, 183, 11, 248, 223, 9,
            128, 226, 203, 13, 56, 167, 95, 14,
        ]
    }

    fun setup_v3(target_growth: u64): test_scenario::Scenario {
        let mut s = test_scenario::begin(ADMIN);

        test_scenario::next_tx(&mut s, ADMIN);
        {
            config::create_config_for_testing(test_scenario::ctx(&mut s));
            matchmaking::create_queue_v3_for_testing(target_growth, test_scenario::ctx(&mut s));
            fifth_move::create_for_testing<TREE>(signer_public_key(), 300_000, test_scenario::ctx(&mut s));
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

            let mut fm = test_scenario::take_shared<FifthMoveConfig>(&s);
            fifth_move::set_enabled(&mut fm, true, test_scenario::ctx(&mut s));
            test_scenario::return_shared(fm);
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

    fun join_as_v3(s: &mut test_scenario::Scenario, player: address) {
        test_scenario::next_tx(s, player);
        {
            let c = test_scenario::take_shared<Config>(s);
            let mut q = test_scenario::take_shared<MatchmakingQueueV3>(s);
            let r = test_scenario::take_shared<Random>(s);
            let nft = TestNFT { id: object::new(test_scenario::ctx(s)) };
            let payment = coin::mint_for_testing<SUI>(ENTRY_FEE, test_scenario::ctx(s));

            matchmaking::join_queue_v3<TestNFT>(&c, &mut q, &nft, payment, &r, test_scenario::ctx(s));

            let TestNFT { id } = nft;
            object::delete(id);
            test_scenario::return_shared(r);
            test_scenario::return_shared(q);
            test_scenario::return_shared(c);
        }
    }

    fun fifth_signature_for(player: address): vector<u8> {
        if (player == PLAYER_B) {
            valid_signature_b()
        } else {
            valid_signature()
        }
    }

    fun join_as_v3_with_fifth(s: &mut test_scenario::Scenario, player: address) {
        join_as_v3_with_fifth_and_source(s, player, 5, fifth_signature_for(player));
    }

    fun join_as_v3_with_fifth_and_source(
        s: &mut test_scenario::Scenario,
        player: address,
        source_bitmap: u8,
        signature: vector<u8>,
    ) {
        test_scenario::next_tx(s, player);
        {
            let c = test_scenario::take_shared<Config>(s);
            let fm = test_scenario::take_shared<FifthMoveConfig>(s);
            let mut q = test_scenario::take_shared<MatchmakingQueueV3>(s);
            let r = test_scenario::take_shared<Random>(s);
            let nft = TestNFT { id: object::new(test_scenario::ctx(s)) };
            let payment = coin::mint_for_testing<SUI>(ENTRY_FEE, test_scenario::ctx(s));
            let mut clk = clock::create_for_testing(test_scenario::ctx(s));
            clock::set_for_testing(&mut clk, ISSUED_AT_MS + 1_000);

            matchmaking::join_queue_v3_with_fifth_move<TestNFT>(
                &c,
                &fm,
                &mut q,
                &nft,
                payment,
                signature,
                true,
                THRESHOLD,
                THRESHOLD,
                source_bitmap,
                2,
                ISSUED_AT_MS,
                EXPIRES_AT_MS,
                &clk,
                &r,
                test_scenario::ctx(s),
            );

            clock::destroy_for_testing(clk);
            let TestNFT { id } = nft;
            object::delete(id);
            test_scenario::return_shared(r);
            test_scenario::return_shared(q);
            test_scenario::return_shared(fm);
            test_scenario::return_shared(c);
        }
    }

    fun assert_hand_unique(moves: &vector<u8>) {
        let len = vector::length(moves);
        let mut i = 0;
        while (i < len) {
            let mut j = i + 1;
            while (j < len) {
                assert!(*vector::borrow(moves, i) != *vector::borrow(moves, j), 0);
                j = j + 1;
            };
            i = i + 1;
        }
    }

    fun assert_standard_hand(moves: &vector<u8>) {
        assert!(vector::length(moves) == 4, 0);
        assert_hand_unique(moves);
        assert!(battle::is_attack_hand_candidate_for_testing(*vector::borrow(moves, 0)), 0);
        assert!(battle::is_growth_hand_candidate_for_testing(*vector::borrow(moves, 1)), 0);
        assert!(battle::is_hybrid_hand_candidate_for_testing(*vector::borrow(moves, 2)), 0);
    }

    fun assert_fifth_move_draft(moves: &vector<u8>) {
        assert!(vector::length(moves) == 7, 0);
        assert_hand_unique(moves);
        assert!(battle::is_attack_hand_candidate_for_testing(*vector::borrow(moves, 4)), 0);
        assert!(battle::is_growth_hand_candidate_for_testing(*vector::borrow(moves, 5)), 0);
        assert!(battle::is_hybrid_hand_candidate_for_testing(*vector::borrow(moves, 6)), 0);
    }

    fun create_ranked_bot_standard(s: &mut test_scenario::Scenario, player: address) {
        test_scenario::next_tx(s, player);
        {
            let c = test_scenario::take_shared<Config>(s);
            let r = test_scenario::take_shared<Random>(s);
            let nft = TestNFT { id: object::new(test_scenario::ctx(s)) };
            battle::create_ranked_bot_battle_v2_standard<TestNFT>(
                &c,
                &nft,
                @0xB07,
                &r,
                test_scenario::ctx(s),
            );
            let TestNFT { id } = nft;
            object::delete(id);
            test_scenario::return_shared(r);
            test_scenario::return_shared(c);
        }
    }

    fun create_ranked_bot_qualified(s: &mut test_scenario::Scenario, player: address) {
        test_scenario::next_tx(s, player);
        {
            let c = test_scenario::take_shared<Config>(s);
            let fm = test_scenario::take_shared<FifthMoveConfig>(s);
            let r = test_scenario::take_shared<Random>(s);
            let nft = TestNFT { id: object::new(test_scenario::ctx(s)) };
            let mut clk = clock::create_for_testing(test_scenario::ctx(s));
            clock::set_for_testing(&mut clk, ISSUED_AT_MS + 1_000);
            battle::create_ranked_bot_battle_v2_with_fifth_move<TestNFT>(
                &c,
                &fm,
                &nft,
                @0xB07,
                fifth_signature_for(player),
                true,
                THRESHOLD,
                THRESHOLD,
                5,
                2,
                ISSUED_AT_MS,
                EXPIRES_AT_MS,
                &clk,
                &r,
                test_scenario::ctx(s),
            );
            clock::destroy_for_testing(clk);
            let TestNFT { id } = nft;
            object::delete(id);
            test_scenario::return_shared(r);
            test_scenario::return_shared(fm);
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

    #[test]
    fun v3_standard_queue_creates_four_move_50_battle() {
        let mut s = setup_v3(TARGET_50);
        join_as_v3(&mut s, PLAYER_A);
        join_as_v3(&mut s, PLAYER_B);

        test_scenario::next_tx(&mut s, ADMIN);
        {
            let q = test_scenario::take_shared<MatchmakingQueueV3>(&s);
            assert!(!matchmaking::has_waiting_v3(&q), 0);
            assert!(matchmaking::bank_value_v3(&q) == 0, 0);
            assert!(matchmaking::target_growth_v3(&q) == TARGET_50, 0);
            test_scenario::return_shared(q);

            let b = test_scenario::take_shared<battle::PvpBattleV3>(&s);
            assert!(battle::pvp_v3_player1(&b) == PLAYER_A, 0);
            assert!(battle::pvp_v3_player2(&b) == PLAYER_B, 0);
            assert!(battle::pvp_v3_target_growth(&b) == TARGET_50, 0);
            assert!(vector::length(battle::pvp_v3_p1_moves(&b)) == 4, 0);
            assert!(vector::length(battle::pvp_v3_p2_moves(&b)) == 4, 0);
            assert!(!battle::pvp_v3_p1_fifth_move_entitled(&b), 0);
            assert!(!battle::pvp_v3_p2_fifth_move_entitled(&b), 0);
            assert!(battle::pvp_v3_battle_entry_fee(&b) == ENTRY_FEE, 0);
            assert!(battle::pvp_v3_winner_payout(&b) == WINNER_PAYOUT, 0);
            assert!(battle::pvp_v3_treasury_share(&b) == TREASURY_SHARE, 0);
            assert!(battle::pvp_v3_vault_value(&b) == ENTRY_FEE + ENTRY_FEE, 0);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    #[test]
    fun v3_entitlement_survives_waiting_and_creates_draft_four_battle() {
        let mut s = setup_v3(TARGET_75);
        join_as_v3_with_fifth(&mut s, PLAYER_A);

        test_scenario::next_tx(&mut s, ADMIN);
        {
            let q = test_scenario::take_shared<MatchmakingQueueV3>(&s);
            assert!(matchmaking::has_waiting_v3(&q), 0);
            assert!(matchmaking::waiting_player_v3(&q) == PLAYER_A, 0);
            assert!(matchmaking::waiting_fifth_move_entitled_v3(&q), 0);
            test_scenario::return_shared(q);
        };

        join_as_v3(&mut s, PLAYER_B);

        test_scenario::next_tx(&mut s, ADMIN);
        {
            let b = test_scenario::take_shared<battle::PvpBattleV3>(&s);
            assert!(battle::pvp_v3_target_growth(&b) == TARGET_75, 0);
            assert!(vector::length(battle::pvp_v3_p1_moves(&b)) == 7, 0);
            assert!(vector::length(battle::pvp_v3_p2_moves(&b)) == 4, 0);
            assert!(battle::pvp_v3_p1_fifth_move_entitled(&b), 0);
            assert!(!battle::pvp_v3_p2_fifth_move_entitled(&b), 0);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    #[test]
    fun v3_cancel_queue_returns_waiting_deposit() {
        let mut s = setup_v3(TARGET_50);
        join_as_v3(&mut s, PLAYER_A);

        test_scenario::next_tx(&mut s, PLAYER_A);
        {
            let mut q = test_scenario::take_shared<MatchmakingQueueV3>(&s);
            matchmaking::cancel_queue_v3(&mut q, test_scenario::ctx(&mut s));
            assert!(!matchmaking::has_waiting_v3(&q), 0);
            assert!(matchmaking::bank_value_v3(&q) == 0, 0);
            test_scenario::return_shared(q);
        };
        test_scenario::end(s);
    }

    #[test]
    fun v3_finish_at_50_uses_stored_target() {
        let mut s = setup_v3(TARGET_50);
        join_as_v3(&mut s, PLAYER_A);
        join_as_v3(&mut s, PLAYER_B);

        test_scenario::next_tx(&mut s, PLAYER_A);
        {
            let mut b = test_scenario::take_shared<battle::PvpBattleV3>(&s);
            let r = test_scenario::take_shared<Random>(&s);
            battle::set_pvp_v3_turn_for_testing(&mut b, 0);
            battle::set_pvp_v3_p1_moves_for_testing(&mut b, vector[20]);
            battle::set_pvp_v3_p1_growth_for_testing(&mut b, 40);
            battle::use_ability_id_pvp_v3(&mut b, 20, &r, test_scenario::ctx(&mut s));
            assert!(battle::pvp_v3_is_finished(&b), 0);
            assert!(option::borrow(&battle::pvp_v3_winner(&b)) == &PLAYER_A, 0);
            assert!(battle::pvp_v3_vault_value(&b) == 0, 0);
            test_scenario::return_shared(r);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    #[test]
    fun v3_four_vs_four_hands_are_standard() {
        let mut s = setup_v3(TARGET_50);
        join_as_v3(&mut s, PLAYER_A);
        join_as_v3(&mut s, PLAYER_B);
        test_scenario::next_tx(&mut s, ADMIN);
        {
            let b = test_scenario::take_shared<battle::PvpBattleV3>(&s);
            assert!(battle::pvp_v3_turn(&b) <= 1, 0);
            assert_standard_hand(battle::pvp_v3_p1_moves(&b));
            assert_standard_hand(battle::pvp_v3_p2_moves(&b));
            assert!(!battle::pvp_v3_p1_fifth_move_entitled(&b), 0);
            assert!(!battle::pvp_v3_p2_fifth_move_entitled(&b), 0);
            assert!(battle::pvp_v3_p1_eligibility_digest_len(&b) == 0, 0);
            assert!(battle::pvp_v3_p2_eligibility_digest_len(&b) == 0, 0);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    #[test]
    fun v3_draft_vs_four_hands_preserve_entitlement() {
        let mut s = setup_v3(TARGET_50);
        join_as_v3_with_fifth(&mut s, PLAYER_A);
        join_as_v3(&mut s, PLAYER_B);
        test_scenario::next_tx(&mut s, ADMIN);
        {
            let b = test_scenario::take_shared<battle::PvpBattleV3>(&s);
            assert_fifth_move_draft(battle::pvp_v3_p1_moves(&b));
            assert_standard_hand(battle::pvp_v3_p2_moves(&b));
            assert!(battle::pvp_v3_p1_fifth_move_entitled(&b), 0);
            assert!(!battle::pvp_v3_p2_fifth_move_entitled(&b), 0);
            assert!(battle::pvp_v3_p1_eligibility_digest_len(&b) > 0, 0);
            assert!(battle::pvp_v3_p2_eligibility_digest_len(&b) == 0, 0);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    #[test]
    fun v3_four_vs_draft_hands_preserve_entitlement() {
        let mut s = setup_v3(TARGET_75);
        join_as_v3(&mut s, PLAYER_A);
        join_as_v3_with_fifth(&mut s, PLAYER_B);
        test_scenario::next_tx(&mut s, ADMIN);
        {
            let b = test_scenario::take_shared<battle::PvpBattleV3>(&s);
            assert_standard_hand(battle::pvp_v3_p1_moves(&b));
            assert_fifth_move_draft(battle::pvp_v3_p2_moves(&b));
            assert!(!battle::pvp_v3_p1_fifth_move_entitled(&b), 0);
            assert!(battle::pvp_v3_p2_fifth_move_entitled(&b), 0);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    #[test]
    fun v3_draft_vs_draft_hands_are_unique_and_category_balanced() {
        let mut s = setup_v3(TARGET_75);
        join_as_v3_with_fifth_and_source(&mut s, PLAYER_A, 15, valid_signature_multi_source());
        join_as_v3_with_fifth(&mut s, PLAYER_B);
        test_scenario::next_tx(&mut s, ADMIN);
        {
            let b = test_scenario::take_shared<battle::PvpBattleV3>(&s);
            assert_fifth_move_draft(battle::pvp_v3_p1_moves(&b));
            assert_fifth_move_draft(battle::pvp_v3_p2_moves(&b));
            assert!(battle::pvp_v3_p1_fifth_move_entitled(&b), 0);
            assert!(battle::pvp_v3_p2_fifth_move_entitled(&b), 0);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    #[test]
    fun v3_fifth_move_draft_locks_one_candidate_and_plays_in_one_transaction() {
        let mut s = setup_v3(TARGET_50);
        join_as_v3_with_fifth(&mut s, PLAYER_A);
        join_as_v3(&mut s, PLAYER_B);

        test_scenario::next_tx(&mut s, ADMIN);
        {
            let mut b = test_scenario::take_shared<battle::PvpBattleV3>(&s);
            battle::set_pvp_v3_turn_for_testing(&mut b, 0);
            battle::set_pvp_v3_p1_moves_for_testing(&mut b, vector[1, 20, 8, 21, 2, 22, 9]);
            test_scenario::return_shared(b);
        };

        test_scenario::next_tx(&mut s, PLAYER_A);
        {
            let mut b = test_scenario::take_shared<battle::PvpBattleV3>(&s);
            let r = test_scenario::take_shared<Random>(&s);
            battle::use_ability_id_pvp_v3_with_fifth_move(
                &mut b,
                22,
                20,
                &r,
                test_scenario::ctx(&mut s),
            );
            assert!(vector::length(battle::pvp_v3_p1_moves(&b)) == 5, 0);
            assert!(*vector::borrow(battle::pvp_v3_p1_moves(&b), 4) == 22, 0);
            assert!(battle::pvp_v3_p1_growth(&b) == 10, 0);
            assert!(battle::pvp_v3_turn(&b) == 1, 0);
            test_scenario::return_shared(r);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 133)]
    fun v3_entitled_player_must_lock_draft_before_normal_move() {
        let mut s = setup_v3(TARGET_50);
        join_as_v3_with_fifth(&mut s, PLAYER_A);
        join_as_v3(&mut s, PLAYER_B);
        test_scenario::next_tx(&mut s, ADMIN);
        {
            let mut b = test_scenario::take_shared<battle::PvpBattleV3>(&s);
            battle::set_pvp_v3_turn_for_testing(&mut b, 0);
            test_scenario::return_shared(b);
        };
        test_scenario::next_tx(&mut s, PLAYER_A);
        {
            let mut b = test_scenario::take_shared<battle::PvpBattleV3>(&s);
            let r = test_scenario::take_shared<Random>(&s);
            let move_id = *vector::borrow(battle::pvp_v3_p1_moves(&b), 0);
            battle::use_ability_id_pvp_v3(&mut b, move_id, &r, test_scenario::ctx(&mut s));
            test_scenario::return_shared(r);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 135)]
    fun v3_player_cannot_repeat_the_same_move_consecutively() {
        let mut s = setup_v3(TARGET_50);
        join_as_v3(&mut s, PLAYER_A);
        join_as_v3(&mut s, PLAYER_B);

        test_scenario::next_tx(&mut s, ADMIN);
        {
            let mut b = test_scenario::take_shared<battle::PvpBattleV3>(&s);
            battle::set_pvp_v3_turn_for_testing(&mut b, 0);
            battle::set_pvp_v3_p1_moves_for_testing(&mut b, vector[20, 21, 8, 1]);
            test_scenario::return_shared(b);
        };

        test_scenario::next_tx(&mut s, PLAYER_A);
        {
            let mut b = test_scenario::take_shared<battle::PvpBattleV3>(&s);
            let r = test_scenario::take_shared<Random>(&s);
            battle::use_ability_id_pvp_v3(&mut b, 20, &r, test_scenario::ctx(&mut s));
            test_scenario::return_shared(r);
            test_scenario::return_shared(b);
        };

        test_scenario::next_tx(&mut s, PLAYER_B);
        {
            let mut b = test_scenario::take_shared<battle::PvpBattleV3>(&s);
            let r = test_scenario::take_shared<Random>(&s);
            let move_id = *vector::borrow(battle::pvp_v3_p2_moves(&b), 0);
            battle::use_ability_id_pvp_v3(&mut b, move_id, &r, test_scenario::ctx(&mut s));
            test_scenario::return_shared(r);
            test_scenario::return_shared(b);
        };

        test_scenario::next_tx(&mut s, PLAYER_A);
        {
            let mut b = test_scenario::take_shared<battle::PvpBattleV3>(&s);
            let r = test_scenario::take_shared<Random>(&s);
            battle::use_ability_id_pvp_v3(&mut b, 20, &r, test_scenario::ctx(&mut s));
            test_scenario::return_shared(r);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    #[test]
    fun v3_waiting_snapshot_contains_and_clears_entitlement_fields() {
        let mut s = setup_v3(TARGET_50);
        join_as_v3_with_fifth(&mut s, PLAYER_A);

        test_scenario::next_tx(&mut s, ADMIN);
        {
            let q = test_scenario::take_shared<MatchmakingQueueV3>(&s);
            assert!(matchmaking::has_waiting_v3(&q), 0);
            assert!(matchmaking::waiting_fifth_move_entitled_v3(&q), 0);
            assert!(matchmaking::waiting_verified_underlying_tree_raw_v3(&q) == THRESHOLD, 0);
            assert!(matchmaking::waiting_source_bitmap_v3(&q) == 5, 0);
            assert!(matchmaking::waiting_eligibility_config_version_v3(&q) == 2, 0);
            assert!(matchmaking::waiting_attestation_digest_len_v3(&q) > 0, 0);
            test_scenario::return_shared(q);
        };

        test_scenario::next_tx(&mut s, PLAYER_A);
        {
            let mut q = test_scenario::take_shared<MatchmakingQueueV3>(&s);
            matchmaking::cancel_queue_v3(&mut q, test_scenario::ctx(&mut s));
            assert!(!matchmaking::has_waiting_v3(&q), 0);
            assert!(matchmaking::bank_value_v3(&q) == 0, 0);
            test_scenario::return_shared(q);
        };
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 102)]
    fun v3_reused_attestation_does_not_bypass_same_wallet_match_restriction() {
        let mut s = setup_v3(TARGET_50);
        join_as_v3_with_fifth(&mut s, PLAYER_A);
        join_as_v3_with_fifth(&mut s, PLAYER_A);
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 104)]
    fun v3_entry_fee_change_rejects_second_player_and_preserves_first_deposit() {
        let mut s = setup_v3(TARGET_50);
        join_as_v3(&mut s, PLAYER_A);

        test_scenario::next_tx(&mut s, ADMIN);
        {
            let mut c = test_scenario::take_shared<Config>(&s);
            config::set_economics(&mut c, ENTRY_FEE + 1, WINNER_PAYOUT, TREASURY_SHARE, test_scenario::ctx(&mut s));
            test_scenario::return_shared(c);
        };

        join_as_v3(&mut s, PLAYER_B);
        test_scenario::end(s);
    }

    #[test]
    fun v3_target_75_standard_battle_keeps_target_isolated() {
        let mut s = setup_v3(TARGET_75);
        join_as_v3(&mut s, PLAYER_A);
        join_as_v3(&mut s, PLAYER_B);

        test_scenario::next_tx(&mut s, ADMIN);
        {
            let q = test_scenario::take_shared<MatchmakingQueueV3>(&s);
            assert!(matchmaking::target_growth_v3(&q) == TARGET_75, 0);
            test_scenario::return_shared(q);

            let b = test_scenario::take_shared<battle::PvpBattleV3>(&s);
            assert!(battle::pvp_v3_target_growth(&b) == TARGET_75, 0);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    #[test]
    fun ranked_bot_v2_standard_human_gets_four_moves_and_bot_stays_four() {
        let mut s = setup_v3(TARGET_50);
        create_ranked_bot_standard(&mut s, PLAYER_A);

        test_scenario::next_tx(&mut s, ADMIN);
        {
            let b = test_scenario::take_shared<battle::RankedBotBattleV2>(&s);
            assert_standard_hand(battle::ranked_bot_v2_p1_moves(&b));
            assert_standard_hand(battle::ranked_bot_v2_p2_moves(&b));
            assert!(!battle::ranked_bot_v2_p1_fifth_move_entitled(&b), 0);
            assert!(battle::ranked_bot_v2_eligibility_digest_len(&b) == 0, 0);
            assert!(battle::ranked_bot_v2_target_growth(&b) == TARGET_50, 0);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    #[test]
    fun ranked_bot_v2_qualified_human_gets_draft_and_bot_stays_four() {
        let mut s = setup_v3(TARGET_50);
        create_ranked_bot_qualified(&mut s, PLAYER_A);

        test_scenario::next_tx(&mut s, ADMIN);
        {
            let b = test_scenario::take_shared<battle::RankedBotBattleV2>(&s);
            assert_fifth_move_draft(battle::ranked_bot_v2_p1_moves(&b));
            assert_standard_hand(battle::ranked_bot_v2_p2_moves(&b));
            assert!(battle::ranked_bot_v2_p1_fifth_move_entitled(&b), 0);
            assert!(battle::ranked_bot_v2_eligibility_digest_len(&b) > 0, 0);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 116)]
    fun ranked_bot_v2_invalid_proof_cannot_create_five_move_battle() {
        let mut s = setup_v3(TARGET_50);
        test_scenario::next_tx(&mut s, PLAYER_A);
        {
            let c = test_scenario::take_shared<Config>(&s);
            let fm = test_scenario::take_shared<FifthMoveConfig>(&s);
            let r = test_scenario::take_shared<Random>(&s);
            let nft = TestNFT { id: object::new(test_scenario::ctx(&mut s)) };
            let mut clk = clock::create_for_testing(test_scenario::ctx(&mut s));
            let mut sig = valid_signature();
            *vector::borrow_mut(&mut sig, 0) = 0;
            clock::set_for_testing(&mut clk, ISSUED_AT_MS + 1_000);
            battle::create_ranked_bot_battle_v2_with_fifth_move<TestNFT>(
                &c,
                &fm,
                &nft,
                @0xB07,
                sig,
                true,
                THRESHOLD,
                THRESHOLD,
                5,
                2,
                ISSUED_AT_MS,
                EXPIRES_AT_MS,
                &clk,
                &r,
                test_scenario::ctx(&mut s),
            );
            clock::destroy_for_testing(clk);
            let TestNFT { id } = nft;
            object::delete(id);
            test_scenario::return_shared(r);
            test_scenario::return_shared(fm);
            test_scenario::return_shared(c);
        };
        test_scenario::end(s);
    }

    #[test]
    fun ranked_bot_v2_standard_creation_still_available_after_proof_failure_path() {
        let mut s = setup_v3(TARGET_50);
        create_ranked_bot_standard(&mut s, PLAYER_A);

        test_scenario::next_tx(&mut s, ADMIN);
        {
            let b = test_scenario::take_shared<battle::RankedBotBattleV2>(&s);
            assert_standard_hand(battle::ranked_bot_v2_p1_moves(&b));
            assert_standard_hand(battle::ranked_bot_v2_p2_moves(&b));
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    #[test]
    fun ranked_bot_v2_surrender_preserves_parity() {
        let mut s = setup_v3(TARGET_50);
        create_ranked_bot_standard(&mut s, PLAYER_A);
        test_scenario::next_tx(&mut s, PLAYER_A);
        {
            let mut b = test_scenario::take_shared<battle::RankedBotBattleV2>(&s);
            battle::surrender_ranked_bot_v2(&mut b, test_scenario::ctx(&mut s));
            assert!(battle::ranked_bot_v2_is_finished(&b), 0);
            assert!(option::borrow(&battle::ranked_bot_v2_winner(&b)) == &@0xB07, 0);
            assert!(battle::ranked_bot_v2_vault_value(&b) == 0, 0);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    #[test]
    fun ranked_bot_v2_timeout_preserves_parity() {
        let mut s = setup_v3(TARGET_50);
        create_ranked_bot_standard(&mut s, PLAYER_A);
        test_scenario::later_epoch(&mut s, 10 * 60 * 1000, PLAYER_A);
        {
            let mut b = test_scenario::take_shared<battle::RankedBotBattleV2>(&s);
            battle::set_ranked_bot_v2_last_move_ms_for_testing(&mut b, 0);
            battle::claim_timeout_win_ranked_bot_v2(&mut b, test_scenario::ctx(&mut s));
            assert!(battle::ranked_bot_v2_is_finished(&b), 0);
            assert!(option::borrow(&battle::ranked_bot_v2_winner(&b)) == &PLAYER_A, 0);
            test_scenario::return_shared(b);
        };
        test_scenario::end(s);
    }

    #[test]
    fun ranked_bot_v2_admin_close_preserves_parity() {
        let mut s = setup_v3(TARGET_50);
        create_ranked_bot_standard(&mut s, PLAYER_A);
        test_scenario::next_tx(&mut s, ADMIN);
        {
            let c = test_scenario::take_shared<Config>(&s);
            let mut b = test_scenario::take_shared<battle::RankedBotBattleV2>(&s);
            battle::admin_force_close_ranked_bot_v2(&mut b, &c, test_scenario::ctx(&mut s));
            assert!(battle::ranked_bot_v2_is_finished(&b), 0);
            assert!(option::is_none(&battle::ranked_bot_v2_winner(&b)), 0);
            assert!(battle::ranked_bot_v2_vault_value(&b) == 0, 0);
            test_scenario::return_shared(b);
            test_scenario::return_shared(c);
        };
        test_scenario::end(s);
    }
}
