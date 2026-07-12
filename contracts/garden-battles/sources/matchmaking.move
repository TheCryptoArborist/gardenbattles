module battle_garden::matchmaking {
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::random::Random;
    use sui::kiosk::{Self, Kiosk, KioskOwnerCap};
    use battle_garden::battle;
    use battle_garden::errors;
    use battle_garden::config::{Self, Config};

    public struct MatchmakingQueue has key {
        id: UID,
        waiting: Option<Pending>,
        bank: Balance<SUI>,
    }

    public struct MatchmakingQueueV2 has key {
        id: UID,
        waiting: Option<Pending>,
        bank: Balance<SUI>,
        target_growth: u64,
    }

    public struct Pending has copy, drop, store {
        player: address,
        entry_fee_snapshot: u64,
    }

    #[test_only]
    public fun has_waiting(queue: &MatchmakingQueue): bool {
        option::is_some(&queue.waiting)
    }

    #[test_only]
    public fun waiting_player(queue: &MatchmakingQueue): address {
        option::borrow(&queue.waiting).player
    }

    #[test_only]
    public fun waiting_entry_fee_snapshot(queue: &MatchmakingQueue): u64 {
        option::borrow(&queue.waiting).entry_fee_snapshot
    }

    #[test_only]
    public fun bank_value(queue: &MatchmakingQueue): u64 {
        balance::value(&queue.bank)
    }

    #[test_only]
    public fun has_waiting_v2(queue: &MatchmakingQueueV2): bool {
        option::is_some(&queue.waiting)
    }

    #[test_only]
    public fun waiting_player_v2(queue: &MatchmakingQueueV2): address {
        option::borrow(&queue.waiting).player
    }

    #[test_only]
    public fun waiting_entry_fee_snapshot_v2(queue: &MatchmakingQueueV2): u64 {
        option::borrow(&queue.waiting).entry_fee_snapshot
    }

    #[test_only]
    public fun bank_value_v2(queue: &MatchmakingQueueV2): u64 {
        balance::value(&queue.bank)
    }

    public fun target_growth_v2(queue: &MatchmakingQueueV2): u64 {
        queue.target_growth
    }

    fun init(ctx: &mut TxContext) {
        let queue = MatchmakingQueue {
            id: object::new(ctx),
            waiting: option::none(),
            bank: balance::zero(),
        };
        sui::transfer::share_object(queue);
    }

    #[test_only]
    public fun create_queue_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }

    public entry fun create_queue_v2(config: &Config, target_growth: u64, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == config::admin(config), errors::e_admin_only());
        assert!(battle::is_valid_pvp_v2_target(target_growth), errors::e_invalid_target_growth());
        let queue = MatchmakingQueueV2 {
            id: object::new(ctx),
            waiting: option::none(),
            bank: balance::zero(),
            target_growth,
        };
        sui::transfer::share_object(queue);
    }

    #[test_only]
    public fun create_queue_v2_for_testing(target_growth: u64, ctx: &mut TxContext) {
        assert!(battle::is_valid_pvp_v2_target(target_growth), errors::e_invalid_target_growth());
        let queue = MatchmakingQueueV2 {
            id: object::new(ctx),
            waiting: option::none(),
            bank: balance::zero(),
            target_growth,
        };
        sui::transfer::share_object(queue);
    }

    public fun join_queue<T: key + store>(config: &Config, queue: &mut MatchmakingQueue, _nft: &T, payment: Coin<SUI>, rand: &Random, ctx: &mut TxContext) {
        assert!(!config::paused(config), errors::e_paused());
        assert!(config::is_collection_whitelisted<T>(config), errors::e_nft_not_whitelisted());
        
        let entry_fee = config::entry_fee(config);
        assert!(coin::value(&payment) == entry_fee, errors::e_insufficient_payment());

        let sender = tx_context::sender(ctx);
        balance::join(&mut queue.bank, coin::into_balance(payment));

        if (option::is_some(&queue.waiting)) {
            let pending = option::extract(&mut queue.waiting);
            assert!(pending.player != sender, errors::e_unauthorized_player());
            assert!(pending.entry_fee_snapshot == entry_fee, errors::e_entry_fee_changed());
            let battle_fund = balance::split(&mut queue.bank, pending.entry_fee_snapshot + entry_fee);
            battle::create_battle(pending.player, sender, entry_fee, config, battle_fund, rand, ctx);
        } else {
            let pending = Pending {
                player: sender,
                entry_fee_snapshot: entry_fee,
            };
            option::fill(&mut queue.waiting, pending);
        }
    }

    public fun join_queue_v2<T: key + store>(config: &Config, queue: &mut MatchmakingQueueV2, _nft: &T, payment: Coin<SUI>, rand: &Random, ctx: &mut TxContext) {
        assert!(!config::paused(config), errors::e_paused());
        assert!(config::is_collection_whitelisted<T>(config), errors::e_nft_not_whitelisted());
        assert!(battle::is_valid_pvp_v2_target(queue.target_growth), errors::e_invalid_target_growth());

        let entry_fee = config::entry_fee(config);
        assert!(coin::value(&payment) == entry_fee, errors::e_insufficient_payment());

        let sender = tx_context::sender(ctx);
        balance::join(&mut queue.bank, coin::into_balance(payment));

        if (option::is_some(&queue.waiting)) {
            let pending = option::extract(&mut queue.waiting);
            assert!(pending.player != sender, errors::e_unauthorized_player());
            assert!(pending.entry_fee_snapshot == entry_fee, errors::e_entry_fee_changed());
            let battle_fund = balance::split(&mut queue.bank, pending.entry_fee_snapshot + entry_fee);
            battle::create_pvp_battle_v2(pending.player, sender, entry_fee, config, battle_fund, queue.target_growth, rand, ctx);
        } else {
            let pending = Pending {
                player: sender,
                entry_fee_snapshot: entry_fee,
            };
            option::fill(&mut queue.waiting, pending);
        }
    }

    // Join queue from kiosk (for collections that require it)
    public fun join_queue_from_kiosk<T: key + store>(
        config: &Config, 
        queue: &mut MatchmakingQueue, 
        kiosk: &mut Kiosk,
        cap: &KioskOwnerCap,
        _nft_id: ID,
        payment: Coin<SUI>, 
        rand: &Random, 
        ctx: &mut TxContext
    ) {
        assert!(!config::paused(config), errors::e_paused());
        assert!(config::is_collection_whitelisted<T>(config), errors::e_nft_not_whitelisted());
        
        let entry_fee = config::entry_fee(config);
        let sender = tx_context::sender(ctx);

        assert!(coin::value(&payment) == entry_fee, errors::e_insufficient_payment());

        balance::join(&mut queue.bank, coin::into_balance(payment));

        let (_nft, borrow) = kiosk::borrow_val<T>(kiosk, cap, _nft_id);
        kiosk::return_val(kiosk, _nft, borrow);

        if (option::is_some(&queue.waiting)) {
            let pending = option::extract(&mut queue.waiting);
            assert!(pending.player != sender, errors::e_unauthorized_player());
            assert!(pending.entry_fee_snapshot == entry_fee, errors::e_entry_fee_changed());
            let battle_fund = balance::split(&mut queue.bank, pending.entry_fee_snapshot + entry_fee);
            battle::create_battle(pending.player, sender, entry_fee, config, battle_fund, rand, ctx);
        } else {
            let pending = Pending {
                player: sender,
                entry_fee_snapshot: entry_fee,
            };
            option::fill(&mut queue.waiting, pending);
        }
    }

    public fun join_queue_v2_from_kiosk<T: key + store>(
        config: &Config,
        queue: &mut MatchmakingQueueV2,
        kiosk: &mut Kiosk,
        cap: &KioskOwnerCap,
        _nft_id: ID,
        payment: Coin<SUI>,
        rand: &Random,
        ctx: &mut TxContext
    ) {
        assert!(!config::paused(config), errors::e_paused());
        assert!(config::is_collection_whitelisted<T>(config), errors::e_nft_not_whitelisted());
        assert!(battle::is_valid_pvp_v2_target(queue.target_growth), errors::e_invalid_target_growth());

        let entry_fee = config::entry_fee(config);
        let sender = tx_context::sender(ctx);

        assert!(coin::value(&payment) == entry_fee, errors::e_insufficient_payment());

        balance::join(&mut queue.bank, coin::into_balance(payment));

        let (_nft, borrow) = kiosk::borrow_val<T>(kiosk, cap, _nft_id);
        kiosk::return_val(kiosk, _nft, borrow);

        if (option::is_some(&queue.waiting)) {
            let pending = option::extract(&mut queue.waiting);
            assert!(pending.player != sender, errors::e_unauthorized_player());
            assert!(pending.entry_fee_snapshot == entry_fee, errors::e_entry_fee_changed());
            let battle_fund = balance::split(&mut queue.bank, pending.entry_fee_snapshot + entry_fee);
            battle::create_pvp_battle_v2(pending.player, sender, entry_fee, config, battle_fund, queue.target_growth, rand, ctx);
        } else {
            let pending = Pending {
                player: sender,
                entry_fee_snapshot: entry_fee,
            };
            option::fill(&mut queue.waiting, pending);
        }
    }

    public fun cancel_queue(queue: &mut MatchmakingQueue, ctx: &mut TxContext) {
        assert!(option::is_some(&queue.waiting), errors::e_no_pending_to_cancel());
        
        let sender = tx_context::sender(ctx);
        let pending_ref = option::borrow(&queue.waiting);
        assert!(pending_ref.player == sender, errors::e_unauthorized_player());

        let pending = option::extract(&mut queue.waiting);
        let refund = balance::split(&mut queue.bank, pending.entry_fee_snapshot);
        transfer::public_transfer(coin::from_balance(refund, ctx), sender);
    }

    public fun cancel_queue_v2(queue: &mut MatchmakingQueueV2, ctx: &mut TxContext) {
        assert!(option::is_some(&queue.waiting), errors::e_no_pending_to_cancel());

        let sender = tx_context::sender(ctx);
        let pending_ref = option::borrow(&queue.waiting);
        assert!(pending_ref.player == sender, errors::e_unauthorized_player());

        let pending = option::extract(&mut queue.waiting);
        let refund = balance::split(&mut queue.bank, pending.entry_fee_snapshot);
        transfer::public_transfer(coin::from_balance(refund, ctx), sender);
    }

    public fun withdraw_bank(config: &Config, queue: &mut MatchmakingQueue, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == config::admin(config), errors::e_admin_only());
        let amount = balance::value(&queue.bank);
        if (amount > 0) {
            let funds = balance::split(&mut queue.bank, amount);
            transfer::public_transfer(coin::from_balance(funds, ctx), config::treasury(config));
        }
    }

    public fun withdraw_bank_v2(config: &Config, queue: &mut MatchmakingQueueV2, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == config::admin(config), errors::e_admin_only());
        let amount = balance::value(&queue.bank);
        if (amount > 0) {
            let funds = balance::split(&mut queue.bank, amount);
            transfer::public_transfer(coin::from_balance(funds, ctx), config::treasury(config));
        }
    }
}
