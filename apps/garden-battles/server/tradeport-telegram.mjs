const NFTREE_TYPE = '0xf6c6d439ea0da2f3e9ba79e4992a7a4c113215fbf54c442ac9020c315f953705::collection::NFT';
export const TRADEPORT_STREAMS = [
  '0xb42dbb7413b79394e1a0175af6ae22b69a5c7cc5df259cd78072b6818217c027::listings::BuyEvent',
  '0xec175e537be9e48f75fa6929291de6454d2502f1091feb22c0d26a22821bbf28::kiosk_listings::BuyEvent',
  '0xff2251ea99230ed1cbe3a347a209352711c6723fcdcd9286e16636e65bb55cab::tradeport_listings::BuySimpleListingEvent',
  '0xb42dbb7413b79394e1a0175af6ae22b69a5c7cc5df259cd78072b6818217c027::biddings::MatchBidEvent',
  '0xb42dbb7413b79394e1a0175af6ae22b69a5c7cc5df259cd78072b6818217c027::biddings::MatchCollectionBidEvent',
  '0xec175e537be9e48f75fa6929291de6454d2502f1091feb22c0d26a22821bbf28::kiosk_biddings::MatchBidEvent',
  '0xec175e537be9e48f75fa6929291de6454d2502f1091feb22c0d26a22821bbf28::kiosk_biddings::MatchCollectionBidEvent',
  '0x53134eb544c5a0b5085e99efaf7eab13b28ad123de35d61f941f8c8c40b72033::tradeport_biddings::MatchSingleBidEvent',
];

export async function readSaleNft(id) {
  if (!/^0x[a-f0-9]{1,64}$/i.test(id)) throw new Error('Invalid marketplace NFT ID');
  const response = await fetch(process.env.SUI_GRAPHQL_URL || 'https://graphql.mainnet.sui.io/graphql', {
    method: 'POST', headers: {'content-type':'application/json'}, signal: AbortSignal.timeout(20000),
    body: JSON.stringify({query: 'query($id:SuiAddress!){object(address:$id){asMoveObject{contents{type{repr} json}}}}',variables:{id}}),
  });
  const result = await response.json();
  if (!response.ok || result.errors?.length) throw new Error(result.errors?.[0]?.message || `NFT lookup HTTP ${response.status}`);
  const contents = result.data?.object?.asMoveObject?.contents;
  if (!contents) throw new Error('Sold NFT metadata unavailable; retaining cursor for retry');
  return contents;
}

export async function prepareTradeportEvent(event, readNft = readSaleNft) {
  const type = event.contents.type.repr;
  if (!TRADEPORT_STREAMS.includes(type)) return null;
  const fields = event.contents.json;
  if (fields.nft_type && String(fields.nft_type).replace(/^0x/, '') !== NFTREE_TYPE.slice(2)) return null;
  const nft = await readNft(fields.nft_id);
  const seller = fields.seller || event.transaction.sender?.address;
  if (nft.type.repr !== NFTREE_TYPE) return null;
  const metadata = nft.json;
  if (!/^\d+$/.test(String(metadata.number)) || !/^\d+$/.test(String(fields.price)) || !/^0x[a-f0-9]{1,64}$/i.test(fields.buyer) || !/^0x[a-f0-9]{1,64}$/i.test(seller)) throw new Error('Invalid TradePort sale fields');
  return {
    ...event,
    contents: {type: {repr: `${NFTREE_TYPE.split('::')[0]}::collection::NFTPurchased`},json: {
      object_id: fields.nft_id, number: String(metadata.number), buyer: fields.buyer,
      seller, price_mist: String(fields.price), marketplace: 'TradePort',
      image_url: metadata.image_url,
    }},
  };
}
