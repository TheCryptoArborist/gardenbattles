module treenft::nft {

    use sui::object::{Self, UID};
    use sui::tx_context::TxContext;
    use std::string::String;

    /// Tree NFT used in Battle Garden
    public struct TreeNFT has key, store {
        id: UID,
        name: vector<u8>,
        image_url: vector<u8>,
        rarity: u8,
        created_at: u64,
    }

    /// Collection container to hold multiple NFTs
    public struct TreeCollection has key {
        id: UID,
        name: String,
        description: String,
        owner: address,
        nft_count: u64,
    }

    /// Errors
    const E_UNAUTHORIZED: u64 = 0;

    /// Create a new collection
    public fun create_collection(
        name: String,
        description: String,
        owner: address,
        ctx: &mut TxContext
    ): TreeCollection {
        TreeCollection {
            id: object::new(ctx),
            name,
            description,
            owner,
            nft_count: 0,
        }
    }

    /// Create a new Tree NFT
    public fun create_nft(
        name: vector<u8>,
        image_url: vector<u8>,
        rarity: u8,
        created_at: u64,
        ctx: &mut TxContext
    ): TreeNFT {
        TreeNFT {
            id: object::new(ctx),
            name,
            image_url,
            rarity,
            created_at,
        }
    }

    /// Add NFT to collection
    public fun add_nft_to_collection(
        collection: &mut TreeCollection,
        sender: address
    ) {
        assert!(sender == collection.owner, E_UNAUTHORIZED);
        collection.nft_count = collection.nft_count + 1;
    }

    /// Transfer NFT to recipient
    public fun transfer_nft(nft: TreeNFT, recipient: address) {
        use sui::transfer;
        transfer::public_transfer(nft, recipient);
    }

    /// Get collection info
    public fun get_collection_nft_count(collection: &TreeCollection): u64 {
        collection.nft_count
    }

    /// Get NFT rarity
    public fun get_nft_rarity(nft: &TreeNFT): u8 {
        nft.rarity
    }

    /// Get NFT name
    public fun get_nft_name(nft: &TreeNFT): vector<u8> {
        nft.name
    }
}
