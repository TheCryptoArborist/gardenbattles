module battle_garden::config {
    use std::type_name::{Self, TypeName};
    use sui::event;
    use battle_garden::errors;

    public struct Config has key {
        id: UID,
        admin: address,
        treasury: address,
        entry_fee: u64,
        winner_payout: u64,
        treasury_share: u64,
        paused: bool,
        whitelisted_collections: vector<TypeName>,
    }

    public struct ConfigUpdated has copy, drop {
        entry_fee: u64,
        winner_payout: u64,
        treasury_share: u64,
    }

    public struct TreasuryUpdated has copy, drop {
        old_treasury: address,
        new_treasury: address,
    }

    // Friend functions or public functions? 
    // The Config needs to be initialized. 
    // `init` is module specific. We can have a `create_config` or similar if we want to separate logic 
    // but `init` usually runs once. 
    // Since we are splitting modules, we might need a way to initialize everything.
    // However, for now, let's assume `battle_garden` package init calls internal setup or we just expose creation.
    // Ideally `init` in `battle_garden` (the main module) creates this.
    // So we need a friend function to create `Config`.
    
    // Actually, `init` in `config` module itself can create it if it's a separate package, but it's one package.
    // If we have multiple modules with `init`, they all run!
    // So `config` module can have its own `init`.

    fun init(ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        let whitelisted = vector::empty<TypeName>();
        
        let config = Config {
            id: object::new(ctx),
            admin: sender,
            treasury: sender,
            entry_fee: 100000000,
            winner_payout: 150000000,
            treasury_share: 50000000,
            paused: false,
            whitelisted_collections: whitelisted,
        };
        sui::transfer::share_object(config);
    }

    // Getters
    public fun admin(config: &Config): address { config.admin }
    public fun treasury(config: &Config): address { config.treasury }
    public fun entry_fee(config: &Config): u64 { config.entry_fee }
    public fun winner_payout(config: &Config): u64 { config.winner_payout }
    public fun treasury_share(config: &Config): u64 { config.treasury_share }
    public fun paused(config: &Config): bool { config.paused }

    public fun is_collection_whitelisted<T: key + store>(config: &Config): bool {
        let nft_type = type_name::with_original_ids<T>();
        vector::contains(&config.whitelisted_collections, &nft_type)
    }

    // Admin functions
    public fun set_economics(config: &mut Config, entry_fee: u64, winner_payout: u64, treasury_share: u64, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == config.admin, errors::e_admin_only());
        assert!(winner_payout + treasury_share <= 2 * entry_fee, errors::e_invalid_economics());
        config.entry_fee = entry_fee;
        config.winner_payout = winner_payout;
        config.treasury_share = treasury_share;
        event::emit(ConfigUpdated {
            entry_fee,
            winner_payout,
            treasury_share,
        });
    }

    public fun set_paused(config: &mut Config, paused: bool, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == config.admin, errors::e_admin_only());
        config.paused = paused;
    }

    public fun set_treasury(config: &mut Config, new_treasury: address, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == config.admin, errors::e_admin_only());
        assert!(new_treasury != @0x0, errors::e_invalid_address());
        let old_treasury = config.treasury;
        config.treasury = new_treasury;
        event::emit(TreasuryUpdated {
            old_treasury,
            new_treasury,
        });
    }

    public fun whitelist_collection<T: key + store>(config: &mut Config, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == config.admin, errors::e_admin_only());
        let nft_type = type_name::with_original_ids<T>();
        if (!vector::contains(&config.whitelisted_collections, &nft_type)) {
            vector::push_back(&mut config.whitelisted_collections, nft_type);
        };
    }

    public fun remove_collection<T: key + store>(config: &mut Config, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == config.admin, errors::e_admin_only());
        let nft_type = type_name::with_original_ids<T>();
        let (exists, idx) = vector::index_of(&config.whitelisted_collections, &nft_type);
        if (exists) {
            vector::remove(&mut config.whitelisted_collections, idx);
        };
    }
}
