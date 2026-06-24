module battle_garden::config {
    use std::type_name::{Self, TypeName};
    use sui::event;
    use sui::sui::SUI;
    use battle_garden::errors;

    /// Dedicated treasury wallet — all battle revenue is sent here
    const TREASURY_ADDRESS: address = @0x956624f2fbbdf16bb5e334b550efd975ff7677e34bbd4e18cb6f485756af6c08;

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

    // ═══════════════════════════════════════════════════════════════════════════
    //  NEW: TreeConfig — separate shared object for TREE utility params
    // ═══════════════════════════════════════════════════════════════════════════

    /// TREE / Forest utility parameters. Stored as a separate shared object so
    /// the upgrade is compatible with the existing Config struct.
    public struct TreeConfig has key {
        id: UID,
        admin: address,
        /// The designated coin type for all TREE features
        utility_coin: TypeName,
        /// Amount of utility_coin to burn for a move reroll
        reroll_cost: u64,
        /// Amount of utility_coin to burn for a single tree_boost
        boost_cost: u64,
        /// Growth points gained per tree_boost
        boost_growth: u64,
        /// Maximum tree advantage (win threshold reduction)
        max_tree_advantage: u64,
        /// Min utility_coin staked per tier point of advantage
        advantage_per_tier: u64,
        /// Minimum utility_coin staked to qualify for any advantage
        min_tree_for_advantage: u64,
    }

    public struct TreeConfigUpdated has copy, drop {
        reroll_cost: u64,
        boost_cost: u64,
        boost_growth: u64,
        max_tree_advantage: u64,
        advantage_per_tier: u64,
        min_tree_for_advantage: u64,
    }

    fun init(ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        let whitelisted = vector::empty<TypeName>();

        let config = Config {
            id: object::new(ctx),
            admin: sender,
            treasury: TREASURY_ADDRESS,
            entry_fee: 100000000,
            winner_payout: 150000000,
            treasury_share: 50000000,
            paused: false,
            whitelisted_collections: whitelisted,
        };
        sui::transfer::share_object(config);
    }

    // Getters — Config
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

    // Admin functions — Config
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

    // ═══════════════════════════════════════════════════════════════════════════
    //  TreeConfig — init, getters, admin setters
    // ═══════════════════════════════════════════════════════════════════════════

    /// init() for TreeConfig — creates a shared TreeConfig with placeholder values.
    /// Admin must call set_utility_coin<TREE>() and set_tree_params() after upgrade.
    public entry fun init_tree_config(ctx: &mut TxContext) {
        let admin = tx_context::sender(ctx);
        let tc = TreeConfig {
            id: object::new(ctx),
            admin,
            utility_coin: type_name::with_original_ids<SUI>(), // placeholder
            reroll_cost: 0,
            boost_cost: 0,
            boost_growth: 0,
            max_tree_advantage: 0,
            advantage_per_tier: 0,
            min_tree_for_advantage: 0,
        };
        sui::transfer::share_object(tc);
    }

    // Getters — TreeConfig
    public fun tree_admin(tc: &TreeConfig): address { tc.admin }
    public fun utility_coin(tc: &TreeConfig): TypeName { tc.utility_coin }
    public fun reroll_cost(tc: &TreeConfig): u64 { tc.reroll_cost }
    public fun boost_cost(tc: &TreeConfig): u64 { tc.boost_cost }
    public fun boost_growth(tc: &TreeConfig): u64 { tc.boost_growth }
    public fun max_tree_advantage(tc: &TreeConfig): u64 { tc.max_tree_advantage }
    public fun advantage_per_tier(tc: &TreeConfig): u64 { tc.advantage_per_tier }
    public fun min_tree_for_advantage(tc: &TreeConfig): u64 { tc.min_tree_for_advantage }

    /// Check that a provided coin type matches the configured utility coin
    public fun is_utility_coin<T>(tc: &TreeConfig): bool {
        type_name::with_original_ids<T>() == tc.utility_coin
    }

    // Admin setters — TreeConfig
    public fun set_utility_coin<T>(tc: &mut TreeConfig, ctx: &mut TxContext) {
        assert!(tx_context::sender(ctx) == tc.admin, errors::e_admin_only());
        tc.utility_coin = type_name::with_original_ids<T>();
    }

    public fun set_tree_params(
        tc: &mut TreeConfig,
        reroll_cost: u64,
        boost_cost: u64,
        boost_growth: u64,
        max_tree_advantage: u64,
        advantage_per_tier: u64,
        min_tree_for_advantage: u64,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == tc.admin, errors::e_admin_only());
        tc.reroll_cost = reroll_cost;
        tc.boost_cost = boost_cost;
        tc.boost_growth = boost_growth;
        tc.max_tree_advantage = max_tree_advantage;
        tc.advantage_per_tier = advantage_per_tier;
        tc.min_tree_for_advantage = min_tree_for_advantage;
        event::emit(TreeConfigUpdated {
            reroll_cost,
            boost_cost,
            boost_growth,
            max_tree_advantage,
            advantage_per_tier,
            min_tree_for_advantage,
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  TEST-ONLY: Create shared objects explicitly
    // ═══════════════════════════════════════════════════════════════════════════

    #[test_only]
    public fun create_config_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }

    #[test_only]
    public fun create_tree_config_for_testing(ctx: &mut TxContext) {
        init_tree_config(ctx);
    }
}
