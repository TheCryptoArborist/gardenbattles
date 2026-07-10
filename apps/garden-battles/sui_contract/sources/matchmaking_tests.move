#[test_only]
module battle_garden::matchmaking_tests {
    use sui::coin;
    use sui::object;
    use sui::random::{Self, Random};
    use sui::sui::SUI;
    use sui::test_scenario;

    use battle_garden::battle;
    use battle_garden::config::{Self, Config};
    use battle_garden::matchmaking::{Self, MatchmakingQueue};

    public struct TestNFT has key, store { id: UID }
    public struct OtherNFT has key, store { id: UID }

    const ADMIN: address = @0xA;
    const PLAYER_A: address = @0xB;
    const PLAYER_B: address = @0xC;
    const PLAYER_C: address = @0xD;
    const ENTRY_FEE: u64 = 3000000000;
    const WINNER_PAYOUT: u64 = 5000000000;
    const TREASURY_SHARE: u64 = 1000000000;

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
}
