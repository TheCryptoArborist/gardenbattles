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
          height: '336px',
          borderRadius: '12px',
          background: 'rgba(255, 255, 255, 0.1)',
          overflow: 'hidden',
          boxShadow: isWinner 
            ? '0 0 20px #00ff00, 0 0 40px #00ff00' 
            : isPlayer 
              ? '0 0 15px #00ff00' 
              : '0 0 15px #ff0000'
        }}
        data-testid={`nft-card-${isPlayer ? 'player' : 'opponent'}`}
      >
        <img 
          src={getNFTImage(growth)} 
          alt={label}
          className="max-w-[90%] max-h-[90%] object-contain rounded-lg"
          data-testid={`nft-image-${isPlayer ? 'player' : 'opponent'}`}
        />
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
        className="mt-2 px-2 w-60"
        style={{
          background: 'rgba(0, 0, 0, 0.8)',
          borderRadius: '6px',
          padding: '2px',
          boxShadow: '0 0 10px #00ff00'
        }}
      >
        <div 
          className="h-4 rounded transition-all duration-300"
          style={{
            width: `${growth}%`,
            background: 'linear-gradient(to right, #00ff00, #00cc00)'
          }}
          data-testid={`health-bar-${isPlayer ? 'player' : 'opponent'}`}
        />
      </div>
      <p 
        className="mt-2 text-base md:text-lg font-sans"
        style={{ color: '#00ffcc' }}
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

  // Automatically join battle when wallet connects (if not already in battle)
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

  // Determine player and opponent growth
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
        backgroundImage: 'url(/assets/background4.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
        backgroundColor: '#000'
      }}
    >
      <Header />

      <main className="flex-1 flex flex-col items-center px-4 py-8">
        {/* Title */}
        <h1 
          className="text-3xl md:text-5xl font-bold mb-8 explode-shrink"
          style={{
            color: '#00ff00',
            textShadow: '0 0 10px #00ff00'
          }}
          data-testid="text-battle-title"
        >
          The Garden Battles
        </h1>

        {/* Battle Area */}
        <div className="flex flex-col md:flex-row items-center justify-center mb-8 w-full max-w-5xl">
          <NFTCard 
            growth={playerGrowth}
            isPlayer={true}
            isWinner={winner === 'player'}
            label="Your Growth"
          />
          
          <div 
            className="text-4xl md:text-6xl font-bold mx-4 md:mx-8 my-4 md:my-0"
            style={{
              color: '#00ff00',
              textShadow: '0 0 10px #00ff00'
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
            className="w-full max-w-3xl p-4 rounded-xl mb-4 flex flex-wrap justify-center gap-2 overflow-y-auto"
            style={{
              background: 'rgba(0, 50, 0, 0.8)',
              border: '2px solid #00ff00',
              boxShadow: '0 0 15px #00ff00',
              maxHeight: '200px'
            }}
            data-testid="battle-options"
          >
            {playerMoves.map((moveId) => (
              <button
                key={moveId}
                onClick={() => handleUseAbility(moveId)}
                disabled={winner !== null}
                className="px-4 py-2 text-sm md:text-base font-sans transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  border: '2px solid #00ff00',
                  background: 'transparent',
                  color: 'white',
                  boxShadow: '0 0 10px #00ff00',
                  borderRadius: '8px'
                }}
                onMouseEnter={(e) => {
                  if (!winner) {
                    e.currentTarget.style.background = '#00ff00';
                    e.currentTarget.style.color = '#000';
                    e.currentTarget.style.boxShadow = '0 0 25px #00ff00';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'white';
                  e.currentTarget.style.boxShadow = '0 0 10px #00ff00';
                }}
                data-testid={`button-ability-${moveId}`}
              >
                {MOVE_LABELS[moveId] || `Move ${moveId}`}
              </button>
            ))}
          </div>
        )}

        {/* Battle Info */}
        <p 
          className="text-lg md:text-xl mb-2"
          style={{ color: '#00ffcc' }}
          data-testid="text-entry-fee"
        >
          3 SUI per Battle
        </p>
        <p 
          className="text-lg md:text-xl font-bold"
          style={{ color: '#ffff00' }}
          data-testid="text-battle-status"
        >
          {battleStatus}
        </p>

        {/* Info Section */}
        <div 
          className="w-full max-w-4xl mt-12 p-6 md:p-8 rounded-2xl"
          style={{
            background: 'rgba(0, 50, 0, 0.8)',
            border: '2px solid #00ff00',
            boxShadow: '0 0 15px #00ff00'
          }}
        >
          <h2 
            className="text-2xl md:text-3xl font-bold mb-4"
            style={{
              color: '#00ff00',
              textShadow: '0 0 5px #00ff00'
            }}
          >
            How to Play
          </h2>
          <ul 
            className="list-disc ml-6 space-y-2 text-base md:text-lg"
            style={{ color: '#00ffcc' }}
          >
            <li>Connect your Sui wallet containing a Sapling NFT</li>
            <li>Pay 3 SUI to enter the matchmaking queue</li>
            <li>Wait for an opponent to join</li>
            <li>Take turns using your assigned abilities</li>
            <li>First to reach 100 Growth wins 5 SUI!</li>
            <li>Watch your NFT evolve as you gain Growth points</li>
          </ul>
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
