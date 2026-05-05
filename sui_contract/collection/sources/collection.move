
module collection::collection;

use std::string::{Self, String};
use sui::coin;
use sui::display;
use sui::event;
use sui::package;
use sui::sui::SUI;


const E_ADMIN_ONLY: u64 = 1;
const E_INVALID_ADDRESS: u64 = 2;
const E_PRICE_ZERO: u64 = 3;
const E_INSUFFICIENT_PAYMENT: u64 = 4;
const E_POOL_EMPTY: u64 = 5;
const DEFAULT_MINT_PRICE_MIST: u64 = 25000000000; // 25 SUI

/// Dedicated treasury wallet — all mint revenue is sent here
const TREASURY_ADDRESS: address = @0x956624f2fbbdf16bb5e334b550efd975ff7677e34bbd4e18cb6f485756af6c08;


public struct NFT has key, store {
    id: UID,
    number: u64,
    name: String,
    description: String,
    image_url: String,
    rarity: String,
}

public struct COLLECTION has drop {}

public struct MintCap has key, store {
    id: UID,
}

public struct MintConfig has key {
    id: UID,
    admin: address,
    treasury: address,
    mint_price_mist: u64,
}

/// Shared pool that holds pre-minted NFTs waiting to be purchased
public struct Pool has key {
    id: UID,
    nfts: vector<NFT>,
}

public struct NFTMinted has copy, drop {
    object_id: ID,
    number: u64,
    name: String,
    recipient: address,
}

public struct NFTPurchased has copy, drop {
    object_id: ID,
    number: u64,
    buyer: address,
    price_mist: u64,
}


fun init(otw: COLLECTION, ctx: &mut TxContext) {
    let sender = ctx.sender();
    let keys = vector[
        b"name".to_string(),
        b"link".to_string(),
        b"description".to_string(),
        b"image_url".to_string(),
        b"project_url".to_string(),
        b"creator".to_string(),
        b"rarity".to_string(),
    ];

    let values = vector[
        b"{name}".to_string(),
        b"{image_url}".to_string(),
        b"{description}".to_string(),
        b"{image_url}".to_string(),
        b"https://gateway.pinata.cloud/ipfs/bafybeicbhuvbtuo5whbpkxjtodjy32a3irxwwrorune7i6bs3haoazhhgy/".to_string(),
        b"Tree NFT Collection".to_string(),
        b"{rarity}".to_string(),
    ];

    let publisher = package::claim(otw, ctx);
    let mut display = display::new_with_fields<NFT>(&publisher, keys, values, ctx);
    display.update_version();

    transfer::public_transfer(publisher, sender);
    transfer::public_transfer(display, sender);

    let cap = MintCap { id: object::new(ctx) };
    transfer::public_transfer(cap, sender);

    let config = MintConfig {
        id: object::new(ctx),
        admin: sender,
        treasury: TREASURY_ADDRESS,
        mint_price_mist: DEFAULT_MINT_PRICE_MIST,
    };
    transfer::share_object(config);

    let pool = Pool {
        id: object::new(ctx),
        nfts: vector::empty(),
    };
    transfer::share_object(pool);
}


public entry fun mint(
    _cap: &MintCap,
    number: u64,
    name: vector<u8>,
    description: vector<u8>,
    image_url: vector<u8>,
    rarity: vector<u8>,
    recipient: address,
    ctx: &mut TxContext,
) {
    let nft = NFT {
        id: object::new(ctx),
        number,
        name: string::utf8(name),
        description: string::utf8(description),
        image_url: string::utf8(image_url),
        rarity: string::utf8(rarity),
    };

    event::emit(NFTMinted {
        object_id: object::id(&nft),
        number,
        name: nft.name,
        recipient,
    });

    transfer::public_transfer(nft, recipient);
}


public entry fun batch_deposit(
    cap: &MintCap,
    pool: &mut Pool,
    numbers: vector<u64>,
    names: vector<vector<u8>>,
    descriptions: vector<vector<u8>>,
    image_urls: vector<vector<u8>>,
    rarities: vector<vector<u8>>,
    ctx: &mut TxContext,
) {
    let len = numbers.length();
    assert!(names.length() == len, 0);
    assert!(descriptions.length() == len, 0);
    assert!(image_urls.length() == len, 0);
    assert!(rarities.length() == len, 0);

    let mut i = 0;
    while (i < len) {
        let nft = NFT {
            id: object::new(ctx),
            number: *numbers.borrow(i),
            name: string::utf8(*names.borrow(i)),
            description: string::utf8(*descriptions.borrow(i)),
            image_url: string::utf8(*image_urls.borrow(i)),
            rarity: string::utf8(*rarities.borrow(i)),
        };
        event::emit(NFTMinted {
            object_id: object::id(&nft),
            number: nft.number,
            name: nft.name,
            recipient: @0x0,
        });
        pool.nfts.push_back(nft);
        i = i + 1;
    }
}

/// User pays mint price and receives the next NFT from the pool
public entry fun purchase(
    pool: &mut Pool,
    mut payment: coin::Coin<SUI>,
    config: &MintConfig,
    ctx: &mut TxContext,
) {
    assert!(!pool.nfts.is_empty(), E_POOL_EMPTY);

    let sender = ctx.sender();
    let paid = coin::value(&payment);
    assert!(paid >= config.mint_price_mist, E_INSUFFICIENT_PAYMENT);

    if (paid > config.mint_price_mist) {
        let change = coin::split(&mut payment, paid - config.mint_price_mist, ctx);
        transfer::public_transfer(change, sender);
    };
    transfer::public_transfer(payment, config.treasury);

    let nft = pool.nfts.pop_back();
    event::emit(NFTPurchased {
        object_id: object::id(&nft),
        number: nft.number,
        buyer: sender,
        price_mist: config.mint_price_mist,
    });
    transfer::public_transfer(nft, sender);
}

public entry fun set_treasury(config: &mut MintConfig, new_treasury: address, ctx: &mut TxContext) {
    assert!(ctx.sender() == config.admin, E_ADMIN_ONLY);
    assert!(new_treasury != @0x0, E_INVALID_ADDRESS);
    config.treasury = new_treasury;
}

public entry fun set_mint_price(config: &mut MintConfig, new_price_mist: u64, ctx: &mut TxContext) {
    assert!(ctx.sender() == config.admin, E_ADMIN_ONLY);
    assert!(new_price_mist > 0, E_PRICE_ZERO);
    config.mint_price_mist = new_price_mist;
}

public fun mint_price_mist(config: &MintConfig): u64 { config.mint_price_mist }
public fun treasury(config: &MintConfig): address { config.treasury }
public fun pool_size(pool: &Pool): u64 { pool.nfts.length() }

public fun number(nft: &NFT): u64 { nft.number }
public fun name(nft: &NFT): &String { &nft.name }
public fun description(nft: &NFT): &String { &nft.description }
public fun image_url(nft: &NFT): &String { &nft.image_url }
public fun rarity(nft: &NFT): &String { &nft.rarity }

public entry fun burn(nft: NFT) {
    let NFT { id, number: _, name: _, description: _, image_url: _, rarity: _ } = nft;
    id.delete();
}
