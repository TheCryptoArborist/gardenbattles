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
  joinBattle: (nftId: string) => Promise<void>;
  useAbility: (abilityId: number) => Promise<void>;
  getFirstValidSaplingNft: (owner: string) => Promise<string | null>;
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

  const getFirstValidSaplingNft = useCallback(async (owner: string): Promise<string | null> => {
    console.log('Scanning for Sapling NFTs...');
    
    const kiosks = new Set<string>();
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
            const kioskId = 
              // @ts-ignore
              obj?.data?.content?.fields?.for?.fields?.kiosk_id ||
              // @ts-ignore
              obj?.data?.content?.fields?.kiosk_id ||
              // @ts-ignore
              obj?.data?.content?.fields?.for;
            if (kioskId) kiosks.add(kioskId);
          }

          // Check for directly held Sapling NFT
          if (type === SUI_CONFIG.SAPLING_STRUCT) {
            const id = obj?.data?.objectId;
            if (id) {
              console.log('Found Sapling NFT:', id);
              return id;
            }
          }
        }

        cursor = res.hasNextPage ? res.nextCursor || null : null;
      } while (cursor);

      // Check inside kiosks
      for (const kioskId of Array.from(kiosks)) {
        try {
          const fields = await suiClient.getDynamicFields({ parentId: kioskId });
          for (const field of fields.data) {
            const nftId = field?.objectId;
            if (!nftId) continue;

            const obj = await suiClient.getObject({
              id: nftId,
              options: { showType: true },
            });

            if (obj?.data?.type === SUI_CONFIG.SAPLING_STRUCT) {
              console.log(`Found Sapling NFT in kiosk ${kioskId}: ${nftId}`);
              return nftId;
            }
          }
        } catch (err) {
          console.warn(`Error reading kiosk ${kioskId}:`, err);
        }
      }

      console.warn('No valid Sapling NFT found');
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

  const joinBattle = useCallback(async (nftId: string) => {
    if (!address || !randomObjectId) {
      throw new Error('Wallet not connected or random object not initialized');
    }

    try {
      const tx = new Transaction();
      const [fee] = tx.splitCoins(tx.gas, [tx.pure.u64(SUI_CONFIG.ENTRY_FEE)]);
      
      tx.moveCall({
        target: `${SUI_CONFIG.PACKAGE_ID}::${SUI_CONFIG.MODULE}::join_queue`,
        arguments: [
          tx.object(SUI_CONFIG.CONFIG_ID),
          tx.object(SUI_CONFIG.MATCHMAKING_QUEUE_ID),
          tx.object(nftId),
          fee,
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
              setIsWaiting(true);
              listenForBattle();
              resolve();
            },
            onError: (error) => {
              console.error('Join battle failed:', error);
              reject(new Error(error.message || 'Failed to join battle'));
            },
          }
        );
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
