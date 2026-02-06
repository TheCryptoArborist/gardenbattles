module treenft::config {

    use sui::object::{Self, UID};
    use sui::balance::Balance;
    use sui::sui::SUI;
    use sui::tx_context::TxContext;

    /// Errors
    const E_NOT_AUTHORIZED: u64 = 0;

    /// Global config
     public struct Config has key {
        id: UID,
        max_supply: u64,
        mint_price: u64,
        admin: address,
    }

    /// Treasury vault
    public struct Treasury has key {
        id: UID,
        balance: Balance<SUI>,
    }

    /// Initialize config + treasury (call once)
    fun init(ctx: &mut TxContext) {
        use sui::object;
        use sui::transfer;

        let admin = tx_context::sender(ctx);

        let config = Config {
            id: object::new(ctx),
            max_supply: 5000,
            mint_price: 50_000_000_000,
            admin,
        };

        let treasury = Treasury {
            id: object::new(ctx),
            balance: balance::zero<SUI>(),
        };

        transfer::share_object(config);
        transfer::share_object(treasury);
    }

    /// Get max supply
    public fun get_max_supply(config: &Config): u64 {
        config.max_supply
    }

    /// Get mint price
    public fun get_mint_price(config: &Config): u64 {
        config.mint_price
    }

    /// Get admin address
    public fun get_admin(config: &Config): address {
        config.admin
    }

    /// Deposit funds to treasury
    public fun deposit(treasury: &mut Treasury, bal: Balance<SUI>) {
        balance::join(&mut treasury.balance, bal);
    }

    /// Admin-only price update
    public  fun update_price(
        config: &mut Config,
        new_price: u64,
        ctx: &TxContext
    ) {
        assert!(tx_context::sender(ctx) == config.admin, E_NOT_AUTHORIZED);
        config.mint_price = new_price;
    }
}
