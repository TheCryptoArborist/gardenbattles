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

export class SaleNftUnavailableError extends Error {
  constructor(id, digest) {
    super(`Sold NFT metadata unavailable for ${id} in transaction ${digest || 'unknown'}`);
    this.name = 'SaleNftUnavailableError';
    this.code = 'NFT_METADATA_UNAVAILABLE';
  }
}

const normalizedAddress = value => /^0x[a-f0-9]{1,64}$/i.test(value || '')
  ? value.slice(2).toLowerCase().padStart(64, '0') : null;

// A type is sufficient to exclude another collection. An NFTree also needs its
// number; missing artwork already has a fallback in the notification formatter.
const usableContents = contents => typeof contents?.type?.repr === 'string'
  && contents.type.repr.length > 0
  && (contents.type.repr !== NFTREE_TYPE || /^\d+$/.test(String(contents.json?.number)));

async function querySaleData(query, variables, fetchFn) {
  const response = await fetchFn(process.env.SUI_GRAPHQL_URL || 'https://graphql.mainnet.sui.io/graphql', {
    method: 'POST', headers: {'content-type':'application/json'}, signal: AbortSignal.timeout(20000),
    body: JSON.stringify({query, variables}),
  });
  const result = await response.json();
  if (!response.ok || result.errors?.length) throw new Error(result.errors?.[0]?.message || `NFT lookup HTTP ${response.status}`);
  if (!result.data || typeof result.data !== 'object') throw new Error('NFT lookup returned no data');
  return result.data;
}

export async function readSaleNft(id, digest, fetchFn = fetch) {
  const address = normalizedAddress(id);
  if (!address) throw new Error('Invalid marketplace NFT ID');
  const current = await querySaleData(
    'query($id:SuiAddress!){object(address:$id){asMoveObject{contents{type{repr} json}}}}',
    {id}, fetchFn,
  );
  const contents = current.object?.asMoveObject?.contents;
  if (usableContents(contents)) return contents;
  if (typeof digest !== 'string' || !digest) throw new SaleNftUnavailableError(id, digest);

  // A sold object can later be wrapped or deleted. Recover its exact contents
  // at the sale instead of repeatedly asking for an unavailable current object.
  const query = `query SaleObject($digest:String!, $cursor:String) {
    transaction(digest:$digest) {
      effects {
        objectChanges(first:50, after:$cursor) {
          nodes {
            address
            outputState { asMoveObject { contents { type { repr } json } } }
            inputState { asMoveObject { contents { type { repr } json } } }
          }
          pageInfo { endCursor hasNextPage }
        }
      }
    }
  }`;
  let cursor = null;
  const seen = new Set();
  for (let page = 0; page < 20; page++) {
    const data = await querySaleData(query, {digest, cursor}, fetchFn);
    if (!data.transaction?.effects) throw new SaleNftUnavailableError(id, digest);
    const changes = data.transaction.effects.objectChanges;
    if (!Array.isArray(changes?.nodes) || typeof changes.pageInfo?.hasNextPage !== 'boolean') {
      throw new Error('Sale transaction lookup returned invalid object changes');
    }
    for (const change of changes.nodes) {
      if (normalizedAddress(change.address) !== address) continue;
      for (const state of [change.outputState, change.inputState]) {
        const historical = state?.asMoveObject?.contents;
        if (usableContents(historical)) return historical;
      }
    }
    if (!changes.pageInfo.hasNextPage) throw new SaleNftUnavailableError(id, digest);
    const next = changes.pageInfo.endCursor;
    if (typeof next !== 'string' || !next || seen.has(next)) {
      throw new Error('Sale transaction lookup did not advance its cursor');
    }
    seen.add(next);
    cursor = next;
  }
  // Preserve the sale for separate retry even if an unusually large transaction
  // exceeds this per-poll work limit. Never classify missing data as unrelated.
  throw new SaleNftUnavailableError(id, digest);
}

export async function prepareTradeportEvent(event, readNft = readSaleNft) {
  const type = event.contents.type.repr;
  if (!TRADEPORT_STREAMS.includes(type)) return null;
  const fields = event.contents.json;
  if (fields.nft_type && String(fields.nft_type).replace(/^0x/, '') !== NFTREE_TYPE.slice(2)) return null;
  const nft = await readNft(fields.nft_id, event.transaction.digest);
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
