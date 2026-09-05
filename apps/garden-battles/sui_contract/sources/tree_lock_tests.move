#[test_only]
module battle_garden::tree_lock_tests {
    use sui::clock;
    use sui::coin;
    use sui::test_scenario;
    use battle_garden::tree_lock::{Self, TreeLock};

    public struct TREE has drop {}
    const PLAYER: address = @0xB;
    const MINIMUM: u64 = 1_000_000_000_000;
    const THIRTY_DAYS_MS: u64 = 2_592_000_000;

    #[test]
    fun lock_custodies_exact_funds_and_unlocks_after_thirty_days() {
        let mut s = test_scenario::begin(PLAYER);
        let mut clk = clock::create_for_testing(test_scenario::ctx(&mut s));
        clock::set_for_testing(&mut clk, 1_000);
        let payment = coin::mint_for_testing<TREE>(MINIMUM, test_scenario::ctx(&mut s));
        tree_lock::lock(payment, &clk, test_scenario::ctx(&mut s));

        test_scenario::next_tx(&mut s, PLAYER);
        let receipt = test_scenario::take_from_sender<TreeLock<TREE>>(&s);
        assert!(tree_lock::owner(&receipt) == PLAYER, 0);
        assert!(tree_lock::amount_raw(&receipt) == MINIMUM, 0);
        assert!(tree_lock::locked_at_ms(&receipt) == 1_000, 0);
        assert!(tree_lock::unlock_at_ms(&receipt) == 1_000 + THIRTY_DAYS_MS, 0);
        clock::set_for_testing(&mut clk, 1_000 + THIRTY_DAYS_MS);
        tree_lock::unlock(receipt, &clk, test_scenario::ctx(&mut s));
        test_scenario::next_tx(&mut s, PLAYER);
        let returned = test_scenario::take_from_sender<coin::Coin<TREE>>(&s);
        assert!(coin::value(&returned) == MINIMUM, 0);
        coin::burn_for_testing(returned);
        clock::destroy_for_testing(clk);
        test_scenario::end(s);
    }

    #[test]
    #[expected_failure(abort_code = 133)]
    fun amount_below_one_million_is_rejected() {
        let mut s = test_scenario::begin(PLAYER);
        let clk = clock::create_for_testing(test_scenario::ctx(&mut s));
        let payment = coin::mint_for_testing<TREE>(MINIMUM - 1, test_scenario::ctx(&mut s));
        tree_lock::lock(payment, &clk, test_scenario::ctx(&mut s));
        abort 0
    }

    #[test]
    #[expected_failure(abort_code = 134)]
    fun early_unlock_is_rejected() {
        let mut s = test_scenario::begin(PLAYER);
        let mut clk = clock::create_for_testing(test_scenario::ctx(&mut s));
        clock::set_for_testing(&mut clk, 1_000);
        let payment = coin::mint_for_testing<TREE>(MINIMUM, test_scenario::ctx(&mut s));
        tree_lock::lock(payment, &clk, test_scenario::ctx(&mut s));
        test_scenario::next_tx(&mut s, PLAYER);
        let receipt = test_scenario::take_from_sender<TreeLock<TREE>>(&s);
        clock::set_for_testing(&mut clk, 1_000 + THIRTY_DAYS_MS - 1);
        tree_lock::unlock(receipt, &clk, test_scenario::ctx(&mut s));
        abort 0
    }
}
