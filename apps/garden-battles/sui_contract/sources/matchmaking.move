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

    public struct Pending has copy, drop, store {
        player: address,
        entry_fee_snapshot: u64,
    }

    fun init(ctx: &mut TxContext) {
        let queue = MatchmakingQueue {
            id: object::new(ctx),
            waiting: option::none(),
            bank: balance::zero(),
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
    public fun cancel_queue(queue: &mut MatchmakingQueue, ctx: &mut TxContext) {
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
}
