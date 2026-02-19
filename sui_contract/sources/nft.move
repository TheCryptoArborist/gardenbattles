module battle_garden::nft {
    use std::string::String;

    public struct SaplingNFT has key, store {
        id: UID,
        issuer: address,
        name: String,
    }

    public struct MintCap has key, store {
        id: UID,
    }

    // Init usually creates MintCap and sends to sender
    // We can assume this module has its own init or we need to expose a way to create MintCap?
    // In original `battle_garden::init`, it created MintCap.
    // If we have separate `nft` module, its `init` can do it.
    
    fun init(ctx: &mut TxContext) {
        let mint_cap = MintCap {
            id: object::new(ctx),
        };
        transfer::public_transfer(mint_cap, tx_context::sender(ctx));
    }

    public fun mint_sapling(_cap: &MintCap, recipient: address, name: String, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        let nft = SaplingNFT {
            id: object::new(ctx),
            issuer: sender,
            name,
        };
        transfer::public_transfer(nft, recipient);
    }

    public fun destroy_mint_cap(cap: MintCap) {
        let MintCap { id } = cap;
        object::delete(id);
    }
}
