module treenft::mint {

    use sui::coin::{Self, Coin};
    use sui::sui::SUI;

    use treenft::nft;
    use treenft::config;

    /// Errors
    const E_SUPPLY_EXCEEDED: u64 = 0;
    const E_INSUFFICIENT_PAYMENT: u64 = 1;

    /// Mint authority
    public struct MintCap has key {
        id: UID,
        minted: u64,
    }

    /// Initialize mint cap (run once)
    public fun init_mint_cap(ctx: &mut TxContext): MintCap {
        MintCap {
            id: object::new(ctx),
            minted: 0,
        }
    }

    /// Mint Tree NFT
    public fun mint_nft(
        cap: &mut MintCap,
        config_ref: &config::Config,
        treasury: &mut config::Treasury,
        payment: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        assert!(cap.minted < config::get_max_supply(config_ref), E_SUPPLY_EXCEEDED);
        assert!(
            coin::value(&payment) >= config::get_mint_price(config_ref),
            E_INSUFFICIENT_PAYMENT
        );

        cap.minted = cap.minted + 1;

        let nft = nft::create_nft(
            b"Battle Garden Tree",
            b"https://battlegarden.xyz/tree.png",
            1,
            0,
            ctx
        );

        // Send funds to treasury
        let bal = coin::into_balance(payment);
        config::deposit(treasury, bal);

        // Send NFT to minter
        nft::transfer_nft(nft, tx_context::sender(ctx));
    }

    /// View helper
    public fun total_minted(cap: &MintCap): u64 {
        cap.minted
    }
}
