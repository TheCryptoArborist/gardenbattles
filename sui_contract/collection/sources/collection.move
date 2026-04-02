
module collection::collection;

use std::string::{Self, String};
use sui::display;
use sui::event;
use sui::package;
use sui::url::{Self, Url};


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


public struct NFTMinted has copy, drop {
    object_id: ID,
    number: u64,
    name: String,
    recipient: address,
}


fun init(otw: COLLECTION, ctx: &mut TxContext) {
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

    transfer::public_transfer(publisher, ctx.sender());
    transfer::public_transfer(display, ctx.sender());

    let cap = MintCap { id: object::new(ctx) };
    transfer::public_transfer(cap, ctx.sender());
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


public fun number(nft: &NFT): u64 { nft.number }
public fun name(nft: &NFT): &String { &nft.name }
public fun description(nft: &NFT): &String { &nft.description }
public fun image_url(nft: &NFT): &Url { &nft.image_url }


public entry fun burn(nft: NFT) {
    let NFT { id, number: _, name: _, description: _, image_url: _ } = nft;
    id.delete();
}
