module battle_garden::tree_lock {
    use sui::balance::{Self, Balance};
    use sui::clock::{Self, Clock};
    use sui::coin::{Self, Coin};
    use sui::event;
    use battle_garden::errors;

    const MINIMUM_TREE_RAW: u64 = 1_000_000_000_000;
    const LOCK_PERIOD_MS: u64 = 2_592_000_000;
    const MAX_U64: u64 = 18_446_744_073_709_551_615;

    public struct TreeLock<phantom T> has key { id: UID, owner: address, funds: Balance<T>, locked_at_ms: u64, unlock_at_ms: u64 }
    public struct TreeLocked has copy, drop { lock_id: address, owner: address, amount_raw: u64, locked_at_ms: u64, unlock_at_ms: u64 }
    public struct TreeUnlocked has copy, drop { lock_id: address, owner: address, amount_raw: u64 }

    public entry fun lock<T>(payment: Coin<T>, clock: &Clock, ctx: &mut TxContext) {
        let amount_raw = coin::value(&payment);
        assert!(amount_raw >= MINIMUM_TREE_RAW, errors::e_tree_lock_below_minimum());
        let locked_at_ms = clock::timestamp_ms(clock);
        assert!(locked_at_ms <= MAX_U64 - LOCK_PERIOD_MS, errors::e_tree_lock_overflow());
        let owner = tx_context::sender(ctx);
        let receipt = TreeLock<T> { id: object::new(ctx), owner, funds: coin::into_balance(payment), locked_at_ms, unlock_at_ms: locked_at_ms + LOCK_PERIOD_MS };
        let lock_id = object::uid_to_address(&receipt.id);
        let unlock_at_ms = receipt.unlock_at_ms;
        transfer::transfer(receipt, owner);
        event::emit(TreeLocked { lock_id, owner, amount_raw, locked_at_ms, unlock_at_ms });
    }

    public entry fun unlock<T>(receipt: TreeLock<T>, clock: &Clock, ctx: &mut TxContext) {
        let TreeLock { id, owner, funds, locked_at_ms: _, unlock_at_ms } = receipt;
        let sender = tx_context::sender(ctx);
        assert!(sender == owner, errors::e_tree_lock_wrong_owner());
        assert!(clock::timestamp_ms(clock) >= unlock_at_ms, errors::e_tree_lock_still_locked());
        let lock_id = object::uid_to_address(&id);
        let amount_raw = balance::value(&funds);
        object::delete(id);
        transfer::public_transfer(coin::from_balance(funds, ctx), owner);
        event::emit(TreeUnlocked { lock_id, owner, amount_raw });
    }
    public fun owner<T>(receipt: &TreeLock<T>): address { receipt.owner }
    public fun amount_raw<T>(receipt: &TreeLock<T>): u64 { balance::value(&receipt.funds) }
    public fun locked_at_ms<T>(receipt: &TreeLock<T>): u64 { receipt.locked_at_ms }
    public fun unlock_at_ms<T>(receipt: &TreeLock<T>): u64 { receipt.unlock_at_ms }
    public fun minimum_tree_raw(): u64 { MINIMUM_TREE_RAW }
    public fun lock_period_ms(): u64 { LOCK_PERIOD_MS }
}
