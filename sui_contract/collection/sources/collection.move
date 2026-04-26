
module collection::collection;

use std::string::{Self, String};
use sui::coin;
use sui::display;
use sui::event;
use sui::package;
use sui::sui::SUI;
use sui::url::{Self, Url};

const E_ADMIN_ONLY: u64 = 1;
const E_INVALID_ADDRESS: u64 = 2;
const E_PRICE_ZERO: u64 = 3;
const E_INSUFFICIENT_PAYMENT: u64 = 4;
const DEFAULT_MINT_PRICE_MIST: u64 = 25000000000; // 25 SUI


public struct NFT has key, store {
    id: UID,
    number: u64,
    name: String,
    description: String,
    image_url: Url,
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


public struct NFTMinted has copy, drop {
    object_id: ID,
    number: u64,
    name: String,
    recipient: address,
}


fun init(otw: COLLECTION, ctx: &mut TxContext) {
    let sender = ctx.sender();
    let keys = vector[
        b"name".to_string(),
        b"description".to_string(),
        b"image_url".to_string(),
        b"project_url".to_string(),
        b"creator".to_string(),
    ];

    let values = vector[
        b"{name}".to_string(),
        b"{description}".to_string(),
        b"{image_url}".to_string(),
        b"https://black-persistent-capybara-279.mypinata.cloud/ipfs/bafybeieqdexmp545rptji3w4j6uigoqs3nk5lhtulunpnkjdjopaclobda/".to_string(),
        b"Collection Creator".to_string(),
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
        treasury: sender,
        mint_price_mist: DEFAULT_MINT_PRICE_MIST,
    };
    transfer::share_object(config);
}


public entry fun mint(
    _cap: &MintCap,
    number: u64,
    name: vector<u8>,
    description: vector<u8>,
    image_url: vector<u8>,
    recipient: address,
    ctx: &mut TxContext,
) {
    let nft = NFT {
        id: object::new(ctx),
        number,
        name: string::utf8(name),
        description: string::utf8(description),
        image_url: url::new_unsafe_from_bytes(image_url),
    };

    event::emit(NFTMinted {
        object_id: object::id(&nft),
        number,
        name: nft.name,
        recipient,
    });

    transfer::public_transfer(nft, recipient);
}


public entry fun batch_mint(
    cap: &MintCap,
    numbers: vector<u64>,
    names: vector<vector<u8>>,
    descriptions: vector<vector<u8>>,
    image_urls: vector<vector<u8>>,
    recipient: address,
    ctx: &mut TxContext,
) {
    let len = numbers.length();
    assert!(names.length() == len, 0);
    assert!(descriptions.length() == len, 0);
    assert!(image_urls.length() == len, 0);

    let mut i = 0;
    while (i < len) {
        mint(
            cap,
            *numbers.borrow(i),
            *names.borrow(i),
            *descriptions.borrow(i),
            *image_urls.borrow(i),
            recipient,
            ctx,
        );
        i = i + 1;
    }
}

public entry fun mint_public(
    number: u64,
    name: vector<u8>,
    description: vector<u8>,
    image_url: vector<u8>,
    mut payment: coin::Coin<SUI>,
    config: &MintConfig,
    ctx: &mut TxContext,
) {
    let sender = ctx.sender();
    let paid = coin::value(&payment);
    assert!(paid >= config.mint_price_mist, E_INSUFFICIENT_PAYMENT);

    if (paid > config.mint_price_mist) {
        let change = coin::split(&mut payment, paid - config.mint_price_mist, ctx);
        transfer::public_transfer(change, sender);
    };

    transfer::public_transfer(payment, config.treasury);
    mint_internal(number, name, description, image_url, sender, ctx);
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


public fun number(nft: &NFT): u64 { nft.number }
public fun name(nft: &NFT): &String { &nft.name }
public fun description(nft: &NFT): &String { &nft.description }
public fun image_url(nft: &NFT): &Url { &nft.image_url }


public entry fun burn(nft: NFT) {
    let NFT { id, number: _, name: _, description: _, image_url: _ } = nft;
    id.delete();
}

fun mint_internal(
    number: u64,
    name: vector<u8>,
    description: vector<u8>,
    image_url: vector<u8>,
    recipient: address,
    ctx: &mut TxContext,
) {
    let nft = NFT {
        id: object::new(ctx),
        number,
        name: string::utf8(name),
        description: string::utf8(description),
        image_url: url::new_unsafe_from_bytes(image_url),
    };

    event::emit(NFTMinted {
        object_id: object::id(&nft),
        number,
        name: nft.name,
        recipient,
    });

    transfer::public_transfer(nft, recipient);
}
