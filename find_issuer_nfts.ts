import { SuiClient } from '@mysten/sui/client';

const client = new SuiClient({ url: 'https://fullnode.mainnet.sui.io:443' });

const ISSUER = '0xcc8efa0e60a6632f1d948345095fd5a55eb37022fbc2646e5ce10046eb95c3e6';
const SAPLING_TYPE = '0x7144301fe39dae2363f57e13d5e8650934a1adf5817a46b64ac5e86a9cffea80::battle_garden::SaplingNFT';

async function findIssuerNFTs() {
  try {
    console.log('🔍 Searching issuer wallet for Sapling NFTs...');
    console.log('👤 Issuer:', ISSUER);
    console.log('');
    
    // Get all objects owned by issuer
    let allObjects: any[] = [];
    let cursor: string | null = null;
    let pageCount = 0;
    
    do {
      const response = await client.getOwnedObjects({
        owner: ISSUER,
        options: { showType: true, showContent: true },
        cursor: cursor || undefined,
        limit: 50
      });
      
      allObjects.push(...response.data);
      cursor = response.hasNextPage ? (response.nextCursor || null) : null;
      pageCount++;
      
      console.log(`📄 Page ${pageCount}: ${response.data.length} objects`);
      
    } while (cursor && pageCount < 5); // Limit to 5 pages max
    
    console.log(`\n📊 Total objects scanned: ${allObjects.length}`);
    
    // Filter for Sapling NFTs
    const saplingNFTs = allObjects.filter(obj => 
      obj.data?.type === SAPLING_TYPE
    );
    
    console.log(`🌱 Found ${saplingNFTs.length} Sapling NFTs!\n`);
    
    if (saplingNFTs.length > 0) {
      console.log('🎯 SAPLING NFT OBJECT IDs:');
      saplingNFTs.slice(0, 5).forEach((nft, i) => {
        console.log(`  ${i + 1}. ${nft.data.objectId}`);
        if (nft.data?.content?.fields) {
          console.log(`     Growth: ${nft.data.content.fields.growth || 'N/A'}`);
          console.log(`     Name: ${nft.data.content.fields.name || 'N/A'}`);
        }
      });
    } else {
      console.log('⚠️  No Sapling NFTs found in issuer wallet');
      console.log('\n💡 Showing sample object types:');
      const uniqueTypes = [...new Set(allObjects.map(o => o.data?.type).filter(Boolean))];
      uniqueTypes.slice(0, 10).forEach(type => console.log(`  - ${type}`));
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

findIssuerNFTs().then(() => process.exit(0));
