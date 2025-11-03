import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { SUI_CONFIG, getBattleUpdateEvent } from '@/lib/sui-config';

interface BattleState {
  battleId: string | null;
  player1: string | null;
  player2: string | null;
  player1Moves: number[];
  player2Moves: number[];
  player1Growth: number;
  player2Growth: number;
  winner: string | null;
}

interface SuiWalletContextType {
  address: string | null;
  isConnected: boolean;
  battleState: BattleState | null;
  isWaiting: boolean;
  joinBattle: (nftData: { nftId: string; nftType: string; location: 'wallet' | 'kiosk'; kioskId?: string; kioskCapId?: string }) => Promise<void>;
  useAbility: (abilityId: number) => Promise<void>;
  getFirstValidSaplingNft: (owner: string) => Promise<{ nftId: string; nftType: string; location: 'wallet' | 'kiosk'; kioskId?: string; kioskCapId?: string } | null>;
  ConnectWalletButton: () => JSX.Element;
}

const SuiWalletContext = createContext<SuiWalletContextType | null>(null);

export function SuiWalletProvider({ children }: { children: ReactNode }) {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  
  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [randomObjectId, setRandomObjectId] = useState<string | null>(null);
  const [unsubscribeBattle, setUnsubscribeBattle] = useState<(() => void) | null>(null);

  const address = currentAccount?.address || null;
  const isConnected = !!currentAccount;

  // Ensure random object on mount
  useEffect(() => {
    async function ensureRandomObject() {
      for (const id of SUI_CONFIG.RANDOM_OBJECT_CANDIDATES) {
        try {
          const obj = await suiClient.getObject({ id, options: { showType: true } });
          if (obj?.data?.type?.endsWith('::random::Random')) {
            setRandomObjectId(id);
            return;
          }
        } catch (_) {
          // Continue to next candidate
        }
      }
      setRandomObjectId(SUI_CONFIG.RANDOM_OBJECT_CANDIDATES[0]);
    }
    ensureRandomObject();
  }, [suiClient]);

  const getFirstValidSaplingNft = useCallback(async (owner: string): Promise<{ nftId: string; nftType: string; location: 'wallet' | 'kiosk'; kioskId?: string; kioskCapId?: string } | null> => {
    console.log('Scanning for Sapling NFTs...');
    
    // Get allowed collections from localStorage
    const stored = localStorage.getItem('allowed_nft_collections');
    const allowedTypes = stored 
      ? JSON.parse(stored).map((c: any) => c.type)
      : [SUI_CONFIG.SAPLING_STRUCT];
    
    console.log('Allowed NFT types:', allowedTypes);
    
    const kiosks = new Map<string, string>(); // kioskId -> ownerCapId
    let cursor: string | null = null;

    try {
      do {
        const res = await suiClient.getOwnedObjects({
          owner,
          options: { showType: true, showContent: true },
          cursor: cursor || undefined,
          limit: 50,
        });

        for (const obj of res.data) {
          const type = obj?.data?.type;
          if (!type) continue;

          // Check for kiosk ownership caps
          if (type.includes('::kiosk::KioskOwnerCap')) {
            const ownerCapId = obj?.data?.objectId;
            const kioskId = 
              // @ts-ignore
              obj?.data?.content?.fields?.for?.fields?.kiosk_id ||
              // @ts-ignore
              obj?.data?.content?.fields?.kiosk_id ||
              // @ts-ignore
              obj?.data?.content?.fields?.for;
            if (kioskId && ownerCapId) {
              kiosks.set(kioskId, ownerCapId);
            }
          }

          // Check for directly held NFT from any allowed collection
          if (allowedTypes.includes(type)) {
            const id = obj?.data?.objectId;
            if (id) {
              console.log('Found allowed NFT in wallet:', type, id);
              return { nftId: id, nftType: type, location: 'wallet' };
            }
          }
        }

        cursor = res.hasNextPage ? res.nextCursor || null : null;
      } while (cursor);

      // Check inside kiosks
      for (const [kioskId, ownerCapId] of Array.from(kiosks.entries())) {
        try {
          const fields = await suiClient.getDynamicFields({ parentId: kioskId });
          for (const field of fields.data) {
            // Check if this is an Item or Listing field (not a Lock)
            const fieldType = field?.name?.type || '';
            console.log('Kiosk field type:', fieldType);
            
            // Skip locked items - they cannot be used in battles
            if (fieldType.includes('::Lock')) {
              console.log('Skipping locked item');
              continue;
            }
            
            // Get NFT ID from the dynamic field's value, not the field wrapper
            // @ts-ignore
            const nftId = field?.name?.value?.id;
            if (!nftId) continue;

            const obj = await suiClient.getObject({
              id: nftId,
              options: { showType: true, showContent: true },
            });

            if (obj?.data?.type && allowedTypes.includes(obj.data.type)) {
              console.log(`Found allowed NFT in kiosk ${kioskId}:`, obj.data.type, nftId);
              console.log('Field details:', field);
              
              // Only return if it's in an Item field (can be borrowed)
              if (fieldType.includes('::Item')) {
                return {
                  nftId,
                  nftType: obj.data.type,
                  location: 'kiosk',
                  kioskId,
                  kioskCapId: ownerCapId
                };
              }
            }
          }
        } catch (err) {
          console.warn(`Error reading kiosk ${kioskId}:`, err);
        }
      }

      console.warn('No valid NFT found from allowed collections');
      return null;
    } catch (err) {
      console.error('Error scanning for NFTs:', err);
      return null;
    }
  }, [suiClient]);

  const listenForBattle = useCallback(() => {
    if (!address) return;

    const subscribe = async () => {
      try {
        const unsubscribe = await suiClient.subscribeEvent({
          filter: { MoveEventType: getBattleUpdateEvent() },
          onMessage: (event) => {
            try {
              const e = event.parsedJson as any;
              if (!e || !e.battle_id || !e.player1 || !e.player2) {
                return;
              }

              // Only process events for this player
              if (
                e.player1?.toLowerCase() !== address.toLowerCase() &&
                e.player2?.toLowerCase() !== address.toLowerCase()
              ) {
                return;
              }

              // Update battle state
              setBattleState({
                battleId: e.battle_id,
                player1: e.player1,
                player2: e.player2,
                player1Moves: e.player1_moves || [],
                player2Moves: e.player2_moves || [],
                player1Growth: Number(e.player1_growth || 0),
                player2Growth: Number(e.player2_growth || 0),
                winner: e.winner && e.winner !== '0x0' ? e.winner : null,
              });

              // Hide waiting overlay when opponent joins
              if (e.player2 && e.player2 !== '0x0') {
                setIsWaiting(false);
              }
            } catch (err) {
              console.error('Event parse error:', err);
            }
          },
        });

        setUnsubscribeBattle(() => () => unsubscribe());
      } catch (error) {
        console.error('Subscribe failed:', error);
      }
    };

    subscribe();
  }, [address, suiClient]);

  const joinBattle = useCallback(async (nftData: { nftId: string; nftType: string; location: 'wallet' | 'kiosk'; kioskId?: string; kioskCapId?: string }) => {
    if (!address || !randomObjectId) {
      throw new Error('Wallet not connected or random object not initialized');
    }

    try {
      console.log('Building transaction with NFT data:', {
        nftId: nftData.nftId,
        nftType: nftData.nftType,
        location: nftData.location,
        kioskId: nftData.kioskId,
        kioskCapId: nftData.kioskCapId
      });
      
      const tx = new Transaction();
      const [fee] = tx.splitCoins(tx.gas, [tx.pure.u64(SUI_CONFIG.ENTRY_FEE)]);
      
      if (nftData.location === 'wallet') {
        // NFT is in wallet - use standard join_queue
        console.log('Using join_queue for wallet NFT');
        tx.moveCall({
          target: `${SUI_CONFIG.PACKAGE_ID}::${SUI_CONFIG.MODULE}::join_queue`,
          typeArguments: [nftData.nftType],
          arguments: [
            tx.object(SUI_CONFIG.CONFIG_ID),
            tx.object(SUI_CONFIG.MATCHMAKING_QUEUE_ID),
            tx.object(nftData.nftId),
            fee,
            tx.object(randomObjectId),
          ],
        });
      } else if (nftData.location === 'kiosk' && nftData.kioskId && nftData.kioskCapId) {
        // NFT is in kiosk - use join_queue_from_kiosk
        console.log('Using join_queue_from_kiosk for kiosk NFT');
        console.log('Transaction details:', {
          target: `${SUI_CONFIG.PACKAGE_ID}::${SUI_CONFIG.MODULE}::join_queue_from_kiosk`,
          typeArguments: [nftData.nftType],
          configId: SUI_CONFIG.CONFIG_ID,
          queueId: SUI_CONFIG.MATCHMAKING_QUEUE_ID,
          kioskId: nftData.kioskId,
          kioskCapId: nftData.kioskCapId,
          nftId: nftData.nftId,
          randomObjectId
        });
        tx.moveCall({
          target: `${SUI_CONFIG.PACKAGE_ID}::${SUI_CONFIG.MODULE}::join_queue_from_kiosk`,
          typeArguments: [nftData.nftType],
          arguments: [
            tx.object(SUI_CONFIG.CONFIG_ID),
            tx.object(SUI_CONFIG.MATCHMAKING_QUEUE_ID),
            tx.object(nftData.kioskId),
            tx.object(nftData.kioskCapId),
            tx.pure.address(nftData.nftId), // Try using address instead of id
            fee,
            tx.object(randomObjectId),
          ],
        });
      } else {
        throw new Error('Invalid NFT location data');
      }

      tx.setSender(address);
      console.log('Transaction built successfully, submitting...');

      // Dry run the transaction first to see the actual error
      console.log('Performing dry run to check for errors...');
      try {
        const dryRunResult = await tx.build({ client: suiClient });
        console.log('Dry run successful, transaction bytes:', dryRunResult);
      } catch (dryRunError: any) {
        console.error('DRY RUN FAILED - This is the actual error:', dryRunError);
        console.error('DRY RUN ERROR MESSAGE:', dryRunError?.message);
        console.error('DRY RUN ERROR STACK:', dryRunError?.stack);
        throw new Error(`Transaction validation failed: ${dryRunError?.message || 'Unknown error'}`);
      }

      console.log('About to sign and execute transaction...');
      
      return new Promise<void>((resolve, reject) => {
        try {
          signAndExecuteTransaction(
            {
              transaction: tx,
              chain: 'sui:mainnet',
            },
            {
              onSuccess: (result) => {
                console.log('Join battle transaction succeeded:', result);
                setIsWaiting(true);
                listenForBattle();
                resolve();
              },
              onError: (error: any) => {
                console.error('Join battle transaction failed - Full error:', error);
                console.error('Error stringified:', JSON.stringify(error, null, 2));
                console.error('Error type:', typeof error);
                console.error('Error keys:', error ? Object.keys(error) : 'null');
                console.error('Error.data:', error?.data);
                console.error('Error.message:', error?.message);
                console.error('Error.code:', error?.code);
                
                // Try to extract any useful error message
                let errorMessage = 'Failed to join battle';
                if (error?.data?.message) errorMessage = error.data.message;
                else if (error?.message) errorMessage = error.message;
                
                console.error('Final error message:', errorMessage);
                reject(new Error(errorMessage));
              },
            }
          );
        } catch (err) {
          console.error('Exception in signAndExecuteTransaction:', err);
          reject(err);
        }
      });
    } catch (error: any) {
      console.error('Join battle failed:', error);
      throw new Error(error.message || 'Failed to join battle');
    }
  }, [address, randomObjectId, signAndExecuteTransaction, listenForBattle]);

  const useAbility = useCallback(async (abilityId: number) => {
    if (!address || !randomObjectId || !battleState?.battleId) {
      throw new Error('Battle not active');
    }

    try {
      const tx = new Transaction();
      
      tx.moveCall({
        target: `${SUI_CONFIG.PACKAGE_ID}::${SUI_CONFIG.MODULE}::use_ability_id`,
        arguments: [
          tx.object(battleState.battleId),
          tx.pure.u8(abilityId),
          tx.object(randomObjectId),
        ],
      });

      tx.setSender(address);

      return new Promise<void>((resolve, reject) => {
        signAndExecuteTransaction(
          {
            transaction: tx,
            chain: 'sui:mainnet',
          },
          {
            onSuccess: () => {
              resolve();
            },
            onError: (error) => {
              console.error('Use ability failed:', error);
              reject(new Error(error.message || 'Failed to use ability'));
            },
          }
        );
      });
    } catch (error: any) {
      console.error('Use ability failed:', error);
      throw new Error(error.message || 'Failed to use ability');
    }
  }, [address, randomObjectId, battleState, signAndExecuteTransaction]);

  // Cleanup subscription on disconnect
  useEffect(() => {
    if (!isConnected && unsubscribeBattle) {
      unsubscribeBattle();
      setUnsubscribeBattle(null);
      setBattleState(null);
      setIsWaiting(false);
    }
  }, [isConnected, unsubscribeBattle]);

  const ConnectWalletButton = useCallback(() => {
    return (
      <ConnectButton 
        connectText="Connect Wallet"
        style={{
          border: '2px solid #00ff00',
          background: 'linear-gradient(45deg, rgba(0, 100, 0, 0.5), rgba(0, 150, 0, 0.5))',
          color: 'white',
          boxShadow: '0 0 10px #00ff00, 0 0 5px #000000',
          borderRadius: '8px',
          padding: '0.5rem 1.25rem',
          fontSize: '0.875rem',
          fontFamily: 'Orbitron, sans-serif',
          textTransform: 'uppercase',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
        }}
      />
    );
  }, []);

  const value: SuiWalletContextType = {
    address,
    isConnected,
    battleState,
    isWaiting,
    joinBattle,
    useAbility,
    getFirstValidSaplingNft,
    ConnectWalletButton,
  };

  return (
    <SuiWalletContext.Provider value={value}>
      {children}
    </SuiWalletContext.Provider>
  );
}

export function useSuiWallet() {
  const context = useContext(SuiWalletContext);
  if (!context) {
    throw new Error('useSuiWallet must be used within SuiWalletProvider');
  }
  return context;
}
