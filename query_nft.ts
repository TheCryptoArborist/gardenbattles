import { SuiClient } from '@mysten/sui/client';

const client = new SuiClient({ url: 'https://fullnode.mainnet.sui.io:443' });

const PACKAGE_ID = '0x7144301fe39dae2363f57e13d5e8650934a1adf5817a46b64ac5e86a9cffea80';
const CONFIG_ID = '0x06c2b903bf9f805d8882e686d504a09593740deb2bc1a39eb67378e44089c749';

async function findNFTs() {
  try {
    console.log('🔍 Querying package transactions...');
    
    // Get the config object to see its fields
    const configObj = await client.getObject({
      id: CONFIG_ID,
      options: { showContent: true, showType: true }
    });
    
    console.log('📦 Config Object:');
    console.log(JSON.stringify(configObj.data, null, 2));
    
    // Try to get dynamic fields which might contain NFT references
    const dynamicFields = await client.getDynamicFields({
      parentId: CONFIG_ID
    });
    
    console.log('\n📋 Dynamic Fields:');
    console.log(JSON.stringify(dynamicFields, null, 2));
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

findNFTs().then(() => process.exit(0));
