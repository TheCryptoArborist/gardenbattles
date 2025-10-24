import { SuiClient } from '@mysten/sui/client';

const client = new SuiClient({ url: 'https://fullnode.mainnet.sui.io:443' });

const USER_WALLET = '0x8d73665b159d406d1bd208782cbba5304900ecafbde23f957f77843b5ea06961';
const SAPLING_TYPE = '0x7144301fe39dae2363f57e13d5e8650934a1adf5817a46b64ac5e86a9cffea80::battle_garden::SaplingNFT';

async function checkUserWallet() {
  try {
    console.log('🔍 Checking your wallet for objects...');
    console.log('👤 Your Address:', USER_WALLET);
    console.log('');
    
    const response = await client.getOwnedObjects({
      owner: USER_WALLET,
      options: { showType: true, showContent: true },
      limit: 50
    });
    
    console.log(`📊 Total objects in wallet: ${response.data.length}`);
    
    // Check for Sapling NFTs
    const saplingNFTs = response.data.filter(obj => obj.data?.type === SAPLING_TYPE);
    
    if (saplingNFTs.length > 0) {
      console.log(`\n🌱 Found ${saplingNFTs.length} Sapling NFT(s)!`);
      saplingNFTs.forEach((nft, i) => {
        console.log(`\n  NFT ${i + 1}:`);
        console.log(`  Object ID: ${nft.data.objectId}`);
        if (nft.data?.content?.fields) {
          console.log(`  Growth: ${nft.data.content.fields.growth || 'N/A'}`);
          console.log(`  Name: ${nft.data.content.fields.name || 'Unnamed Sapling'}`);
        }
      });
    } else {
      console.log('\n⚠️  No Sapling NFTs found in your wallet');
      console.log('\n📝 Your wallet contains:');
      const types = response.data.map(o => o.data?.type).filter(Boolean);
      const uniqueTypes = [...new Set(types)];
      uniqueTypes.forEach(type => {
        const count = types.filter(t => t === type).length;
        console.log(`  - ${count}x ${type?.split('::').pop() || type}`);
      });
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

checkUserWallet().then(() => process.exit(0));
