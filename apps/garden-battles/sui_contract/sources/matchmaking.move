module battle_garden::matchmaking {
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::random::Random;
    use sui::clock::Clock;
    use sui::kiosk::{Self, Kiosk, KioskOwnerCap};
    use battle_garden::battle;
    use battle_garden::errors;
    use battle_garden::config::{Self, Config};
    use battle_garden::fifth_move::{Self, FifthMoveConfig, FifthMoveEligibility};

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

    public struct MatchmakingQueueV3 has key {
        id: UID,
        waiting: Option<PendingV3>,
        bank: Balance<SUI>,
        target_growth: u64,
    }

    public struct PendingV3 has copy, drop, store {
        player: address,
        entry_fee_snapshot: u64,
        fifth_move_entitled: bool,
        verified_underlying_tree_raw: u64,
        source_bitmap: u8,
        eligibility_config_version: u64,
        attestation_digest: vector<u8>,
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

    #[test_only]
    public fun has_waiting_v3(queue: &MatchmakingQueueV3): bool {
        option::is_some(&queue.waiting)
    }

    #[test_only]
    public fun waiting_player_v3(queue: &MatchmakingQueueV3): address {
        option::borrow(&queue.waiting).player
    }

    #[test_only]
    public fun waiting_entry_fee_snapshot_v3(queue: &MatchmakingQueueV3): u64 {
        option::borrow(&queue.waiting).entry_fee_snapshot
    }

    #[test_only]
    public fun waiting_fifth_move_entitled_v3(queue: &MatchmakingQueueV3): bool {
        option::borrow(&queue.waiting).fifth_move_entitled
    }

    #[test_only]
    public fun waiting_verified_underlying_tree_raw_v3(queue: &MatchmakingQueueV3): u64 {
        option::borrow(&queue.waiting).verified_underlying_tree_raw
    }

    #[test_only]
    public fun waiting_source_bitmap_v3(queue: &MatchmakingQueueV3): u8 {
        option::borrow(&queue.waiting).source_bitmap
    }

    #[test_only]
    public fun waiting_eligibility_config_version_v3(queue: &MatchmakingQueueV3): u64 {
        option::borrow(&queue.waiting).eligibility_config_version
    }

    #[test_only]
    public fun waiting_attestation_digest_len_v3(queue: &MatchmakingQueueV3): u64 {
        vector::length(&option::borrow(&queue.waiting).attestation_digest)
    }

    #[test_only]
    public fun bank_value_v3(queue: &MatchmakingQueueV3): u64 {
        balance::value(&queue.bank)
    }

    public fun target_growth_v3(queue: &MatchmakingQueueV3): u64 {
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

    public entry fun create_queue_v3(config: &Config, target_growth: u64, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == config::admin(config), errors::e_admin_only());
        assert!(battle::is_valid_pvp_v2_target(target_growth), errors::e_invalid_target_growth());
        let queue = MatchmakingQueueV3 {
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

    #[test_only]
    public fun create_queue_v3_for_testing(target_growth: u64, ctx: &mut TxContext) {
        assert!(battle::is_valid_pvp_v2_target(target_growth), errors::e_invalid_target_growth());
        let queue = MatchmakingQueueV3 {
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

    fun join_queue_v3_with_eligibility<T: key + store>(
        config: &Config,
        queue: &mut MatchmakingQueueV3,
        _nft: &T,
        payment: Coin<SUI>,
        eligibility: FifthMoveEligibility,
        rand: &Random,
        ctx: &mut TxContext,
    ) {
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
            let pending_eligibility = fifth_move::snapshot_eligibility(
                pending.fifth_move_entitled,
                pending.verified_underlying_tree_raw,
                pending.source_bitmap,
                pending.eligibility_config_version,
                pending.attestation_digest,
            );
            battle::create_pvp_battle_v3(
                pending.player,
                sender,
                entry_fee,
                config,
                battle_fund,
                queue.target_growth,
                pending_eligibility,
                eligibility,
                rand,
                ctx,
            );
        } else {
            let pending = PendingV3 {
                player: sender,
                entry_fee_snapshot: entry_fee,
                fifth_move_entitled: fifth_move::entitled(&eligibility),
                verified_underlying_tree_raw: fifth_move::verified_underlying_tree_raw(&eligibility),
                source_bitmap: fifth_move::source_bitmap(&eligibility),
                eligibility_config_version: fifth_move::eligibility_config_version(&eligibility),
                attestation_digest: fifth_move::attestation_digest(&eligibility),
            };
            option::fill(&mut queue.waiting, pending);
        }
    }

    public fun join_queue_v3<T: key + store>(
        config: &Config,
        queue: &mut MatchmakingQueueV3,
        _nft: &T,
        payment: Coin<SUI>,
        rand: &Random,
        ctx: &mut TxContext,
    ) {
        join_queue_v3_with_eligibility<T>(
            config,
            queue,
            _nft,
            payment,
            fifth_move::standard_eligibility(),
            rand,
            ctx,
        );
    }

    public fun join_queue_v3_with_fifth_move<T: key + store>(
        config: &Config,
        fifth_move_config: &FifthMoveConfig,
        queue: &mut MatchmakingQueueV3,
        _nft: &T,
        payment: Coin<SUI>,
        signature: vector<u8>,
        qualified: bool,
        verified_underlying_tree_raw: u64,
        threshold_raw: u64,
        source_bitmap: u8,
        config_version: u64,
        issued_at_ms: u64,
        expires_at_ms: u64,
        clock: &Clock,
        rand: &Random,
        ctx: &mut TxContext,
    ) {
        let payload = fifth_move::payload(
            fifth_move::config_id(fifth_move_config),
            tx_context::sender(ctx),
            qualified,
            verified_underlying_tree_raw,
            threshold_raw,
            source_bitmap,
            config_version,
            issued_at_ms,
            expires_at_ms,
        );
        let eligibility = fifth_move::verify_attestation(fifth_move_config, payload, signature, clock, ctx);
        join_queue_v3_with_eligibility<T>(config, queue, _nft, payment, eligibility, rand, ctx);
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

    public fun join_queue_v3_from_kiosk<T: key + store>(
        config: &Config,
        queue: &mut MatchmakingQueueV3,
        kiosk: &mut Kiosk,
        cap: &KioskOwnerCap,
        _nft_id: ID,
        payment: Coin<SUI>,
        rand: &Random,
        ctx: &mut TxContext
    ) {
        assert!(!config::paused(config), errors::e_paused());
        assert!(config::is_collection_whitelisted<T>(config), errors::e_nft_not_whitelisted());

        let (_nft, borrow) = kiosk::borrow_val<T>(kiosk, cap, _nft_id);
        join_queue_v3_with_eligibility<T>(
            config,
            queue,
            &_nft,
            payment,
            fifth_move::standard_eligibility(),
            rand,
            ctx,
        );
        kiosk::return_val(kiosk, _nft, borrow);
    }

    public fun join_queue_v3_with_fifth_move_from_kiosk<T: key + store>(
        config: &Config,
        fifth_move_config: &FifthMoveConfig,
        queue: &mut MatchmakingQueueV3,
        kiosk: &mut Kiosk,
        cap: &KioskOwnerCap,
        _nft_id: ID,
        payment: Coin<SUI>,
        signature: vector<u8>,
        qualified: bool,
        verified_underlying_tree_raw: u64,
        threshold_raw: u64,
        source_bitmap: u8,
        config_version: u64,
        issued_at_ms: u64,
        expires_at_ms: u64,
        clock: &Clock,
        rand: &Random,
        ctx: &mut TxContext
    ) {
        assert!(!config::paused(config), errors::e_paused());
        assert!(config::is_collection_whitelisted<T>(config), errors::e_nft_not_whitelisted());

        let (_nft, borrow) = kiosk::borrow_val<T>(kiosk, cap, _nft_id);
        join_queue_v3_with_fifth_move<T>(
            config,
            fifth_move_config,
            queue,
            &_nft,
            payment,
            signature,
            qualified,
            verified_underlying_tree_raw,
            threshold_raw,
            source_bitmap,
            config_version,
            issued_at_ms,
            expires_at_ms,
            clock,
            rand,
            ctx,
        );
        kiosk::return_val(kiosk, _nft, borrow);
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

    public fun cancel_queue_v3(queue: &mut MatchmakingQueueV3, ctx: &mut TxContext) {
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

    public fun withdraw_bank_v3(config: &Config, queue: &mut MatchmakingQueueV3, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == config::admin(config), errors::e_admin_only());
        let amount = balance::value(&queue.bank);
        if (amount > 0) {
            let funds = balance::split(&mut queue.bank, amount);
            transfer::public_transfer(coin::from_balance(funds, ctx), config::treasury(config));
        }
    }
}
