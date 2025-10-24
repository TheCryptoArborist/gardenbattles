import { SuiClient } from '@mysten/sui/client';

const client = new SuiClient({ url: 'https://fullnode.mainnet.sui.io:443' });

const PACKAGE_ID = '0x7144301fe39dae2363f57e13d5e8650934a1adf5817a46b64ac5e86a9cffea80';
const SAPLING_TYPE = `${PACKAGE_ID}::battle_garden::SaplingNFT`;

async function findSaplingNFTs() {
  try {
    console.log('🔍 Searching for Sapling NFTs on Sui mainnet...');
    console.log('📦 Package:', PACKAGE_ID);
    console.log('🎯 Type:', SAPLING_TYPE);
    console.log('');
    
    // Get objects by type from the package
    const objects = await client.queryEvents({
      query: {
        MoveEventType: `${PACKAGE_ID}::battle_garden::MintEvent`
      },
      limit: 10
    });
    
    console.log('📊 Found events:', objects.data.length);
    
    if (objects.data.length > 0) {
      console.log('');
      console.log('🌱 Sample Sapling NFT Objects:');
      objects.data.slice(0, 5).forEach((event: any, i: number) => {
        const nftId = event.parsedJson?.nft_id || event.parsedJson?.object_id;
        if (nftId) {
          console.log(`  ${i + 1}. NFT Object ID: ${nftId}`);
        }
      });
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.log('');
    console.log('💡 Trying alternative query method...');
    
    // Try querying the package objects
    try {
      const pkg = await client.getObject({
        id: PACKAGE_ID,
        options: { showContent: true }
      });
      console.log('📦 Package found:', pkg.data?.digest);
    } catch (e: any) {
      console.error('Package query failed:', e.message);
    }
  }
}

findSaplingNFTs().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
