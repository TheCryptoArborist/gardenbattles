import { useState, useEffect } from 'react';
import { Trophy } from 'lucide-react';
import { useSuiWallet } from '@/hooks/useSuiWallet';
import { MOVE_LABELS } from '@/lib/sui-config';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BattleDialog from '@/components/BattleDialog';
import WaitingOverlay from '@/components/WaitingOverlay';

function getNFTImage(growth: number): string {
  if (growth <= 25) return '/assets/seed.jpg';
  if (growth <= 50) return '/assets/sapling.jpg';
  if (growth <= 75) return '/assets/sapling2.jpg';
  return '/assets/full_tree.jpg';
}

interface NFTCardProps {
  growth: number;
  isPlayer: boolean;
  isWinner: boolean;
  label: string;
}

function NFTCard({ growth, isPlayer, isWinner, label }: NFTCardProps) {
  return (
    <div className="flex flex-col items-center mx-4 md:mx-8">
      <div 
        className={`relative flex items-center justify-center transition-all duration-300 ${isWinner ? 'grow-green' : ''}`}
        style={{
          width: '240px',
          height: '320px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, rgba(60, 20, 20, 0.9), rgba(40, 15, 15, 0.9))',
          border: '4px solid',
          borderColor: isWinner ? '#00ff00' : (isPlayer ? '#ff0000' : '#8B0000'),
          padding: '20px',
          boxShadow: isWinner 
            ? '0 0 40px #00ff00, inset 0 0 20px rgba(0,255,0,0.2)' 
            : isPlayer 
              ? '0 0 20px #ff0000, inset 0 0 10px rgba(255,0,0,0.1)' 
              : '0 0 20px #8B0000, inset 0 0 10px rgba(139,0,0,0.1)'
        }}
        data-testid={`nft-card-${isPlayer ? 'player' : 'opponent'}`}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #2a2a2a, #1a1a1a)',
            padding: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid rgba(100, 100, 100, 0.3)'
          }}
        >
          <img 
            src={getNFTImage(growth)} 
            alt={label}
            className="max-w-full max-h-full object-contain rounded-lg"
            data-testid={`nft-image-${isPlayer ? 'player' : 'opponent'}`}
          />
        </div>
        {isWinner && (
          <div 
            className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center"
            style={{
              background: 'radial-gradient(circle, rgba(0,255,0,0.2) 0%, transparent 70%)'
            }}
          >
            <Trophy 
              className="w-24 h-24" 
              style={{ 
                color: '#00ff00', 
                filter: 'drop-shadow(0 0 20px #00ff00)'
              }}
            />
          </div>
        )}
      </div>
      <div 
        className="mt-3 w-60"
        style={{
          background: '#000',
          borderRadius: '8px',
          padding: '4px',
          border: '2px solid #00ff00',
          boxShadow: '0 0 10px #00ff00'
        }}
      >
        <div 
          className="h-5 rounded transition-all duration-300"
          style={{
            width: `${growth}%`,
            background: 'linear-gradient(to right, #00ff00, #00cc00)',
            boxShadow: '0 0 10px #00ff00'
          }}
          data-testid={`health-bar-${isPlayer ? 'player' : 'opponent'}`}
        />
      </div>
      <p 
        className="mt-2 text-base md:text-lg font-sans"
        style={{ color: 'white' }}
        data-testid={`text-growth-${isPlayer ? 'player' : 'opponent'}`}
      >
        {label}: {growth}
      </p>
    </div>
  );
}

export default function Battle() {
  const { 
    isConnected, 
    address, 
    battleState,
    isWaiting,
    joinBattle,
    useAbility,
    getFirstValidSaplingNft
  } = useSuiWallet();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    async function autoJoinBattle() {
      if (isConnected && address && !battleState && !isJoining) {
        setIsJoining(true);
        try {
          setDialogOpen(true);
          setDialogMessage('Scanning for Sapling NFTs in your wallet...');
          
          const nftId = await getFirstValidSaplingNft(address);
          
          if (nftId) {
            setDialogMessage('Sapling NFT found! Joining battle queue...');
            await joinBattle(nftId);
            setDialogMessage('Successfully joined battle queue! Waiting for opponent...');
          } else {
            setDialogMessage('No Sapling NFT found in your wallet. You need a Sapling NFT from the Battle Garden contract to play.');
          }
        } catch (error: any) {
          setDialogOpen(true);
          setDialogMessage(error.message || 'Failed to join battle');
        } finally {
          setIsJoining(false);
        }
      }
    }
    autoJoinBattle();
  }, [isConnected, address, battleState, isJoining, joinBattle, getFirstValidSaplingNft]);

  const handleUseAbility = async (abilityId: number) => {
    try {
      await useAbility(abilityId);
    } catch (error: any) {
      setDialogOpen(true);
      setDialogMessage(error.message || 'Failed to use ability');
    }
  };

  const isPlayer1 = battleState && address && battleState.player1?.toLowerCase() === address.toLowerCase();
  const playerGrowth = battleState 
    ? (isPlayer1 ? battleState.player1Growth : battleState.player2Growth)
    : 0;
  const opponentGrowth = battleState 
    ? (isPlayer1 ? battleState.player2Growth : battleState.player1Growth)
    : 0;
  const playerMoves = battleState 
    ? (isPlayer1 ? battleState.player1Moves : battleState.player2Moves)
    : [];
  
  const winner = battleState?.winner 
    ? (battleState.winner.toLowerCase() === address?.toLowerCase() ? 'player' : 'opponent')
    : null;

  let battleStatus = 'Connect wallet to start!';
  if (isConnected && !battleState) {
    battleStatus = 'Searching for Sapling NFT...';
  } else if (isWaiting) {
    battleStatus = 'Waiting for opponent...';
  } else if (battleState && !winner) {
    battleStatus = 'Battle in progress! Use your moves!';
  } else if (winner) {
    battleStatus = winner === 'player' ? 'You Win!' : 'Opponent Wins!';
  }

  return (
    <div 
      className="min-h-screen flex flex-col text-white font-sans"
      style={{
        background: '#000',
        backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(0, 50, 0, 0.3) 0%, #000 100%)'
      }}
    >
      <Header />

      <main className="flex-1 flex flex-col items-center px-4 py-8">
        {/* Title Image */}
        <div className="mb-8">
          <img 
            src="/assets/backgrounda.jpg" 
            alt="The Garden Battles" 
            className="h-auto rounded-xl"
            style={{
              maxWidth: '600px',
              width: '100%',
              boxShadow: '0 0 30px #00ff00',
              border: '3px solid #00ff00'
            }}
            data-testid="img-battle-title"
          />
        </div>

        {/* Battle Area */}
        <div className="flex flex-col md:flex-row items-center justify-center mb-8 w-full max-w-5xl">
          <NFTCard 
            growth={playerGrowth}
            isPlayer={true}
            isWinner={winner === 'player'}
            label="Your Growth"
          />
          
          <div 
            className="text-6xl md:text-8xl font-bold mx-6 md:mx-12 my-4 md:my-0"
            style={{
              color: '#00ff00',
              textShadow: '0 0 20px #00ff00, 0 0 40px #00ff00',
              fontFamily: 'Orbitron, sans-serif'
            }}
            data-testid="text-vs"
          >
            VS
          </div>

          <NFTCard 
            growth={opponentGrowth}
            isPlayer={false}
            isWinner={winner === 'opponent'}
            label="Opponent Growth"
          />
        </div>

        {/* Battle Options */}
        {playerMoves.length > 0 && (
          <div 
            className="w-full max-w-4xl p-6 rounded-2xl mb-6 flex flex-wrap justify-center gap-3"
            style={{
              background: 'rgba(0, 50, 0, 0.5)',
              border: '2px solid #00ff00',
              boxShadow: '0 0 20px #00ff00'
            }}
            data-testid="battle-options"
          >
            {playerMoves.map((moveId) => (
              <button
                key={moveId}
                onClick={() => handleUseAbility(moveId)}
                disabled={winner !== null}
                className="px-6 py-3 text-base font-sans transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  border: '2px solid #00ff00',
                  background: 'rgba(0, 100, 0, 0.3)',
                  color: 'white',
                  boxShadow: '0 0 15px #00ff00',
                  borderRadius: '10px',
                  fontFamily: 'Orbitron, sans-serif'
                }}
                onMouseEnter={(e) => {
                  if (!winner) {
                    e.currentTarget.style.background = '#00ff00';
                    e.currentTarget.style.color = '#000';
                    e.currentTarget.style.boxShadow = '0 0 30px #00ff00';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 100, 0, 0.3)';
                  e.currentTarget.style.color = 'white';
                  e.currentTarget.style.boxShadow = '0 0 15px #00ff00';
                }}
                data-testid={`button-ability-${moveId}`}
              >
                {MOVE_LABELS[moveId] || `Move ${moveId}`}
              </button>
            ))}
          </div>
        )}

        {/* Battle Info */}
        <div 
          className="text-center p-6 rounded-xl"
          style={{
            background: 'rgba(0, 50, 0, 0.6)',
            border: '2px solid #00ff00',
            boxShadow: '0 0 20px #00ff00'
          }}
        >
          <p 
            className="text-2xl md:text-3xl mb-3 font-bold"
            style={{ 
              color: '#00ff00',
              textShadow: '0 0 10px #00ff00',
              fontFamily: 'Orbitron, sans-serif'
            }}
            data-testid="text-entry-fee"
          >
            3 SUI per Battle
          </p>
          <p 
            className="text-lg md:text-xl"
            style={{ color: '#00ffcc' }}
            data-testid="text-battle-status"
          >
            {battleStatus}
          </p>
        </div>
      </main>

      <Footer />
      <BattleDialog 
        isOpen={dialogOpen}
        message={dialogMessage}
        onClose={() => setDialogOpen(false)}
      />
      <WaitingOverlay isWaiting={isWaiting} />
    </div>
  );
}
