import { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { Trophy } from 'lucide-react';
import { ConnectButton } from '@mysten/dapp-kit';
import { useSuiWallet } from '@/hooks/useSuiWallet';
import { MOVE_LABELS, SUI_CONFIG } from '@/lib/sui-config';
import BattleDialog from '@/components/BattleDialog';
import WaitingOverlay from '@/components/WaitingOverlay';
import AdminPanel from '@/components/AdminPanel';

function getNFTImage(growth: number): string {
  if (growth <= 25) return '/assets/seed.jpg';
  if (growth <= 50) return '/assets/sapling.jpg';
  if (growth <= 75) return '/assets/sapling2.jpg';
  return '/assets/full_tree.jpg';
}

export default function Battle() {
  const { 
    isConnected, 
    address, 
    battleState,
    isWaiting,
    joinBattle,
    useAbility,
    getFirstValidSaplingNft,
  } = useSuiWallet();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState('');
  const [hasScanned, setHasScanned] = useState(false);
  const [playerAnimation, setPlayerAnimation] = useState('');
  const [opponentAnimation, setOpponentAnimation] = useState('');
  const [prevPlayerGrowth, setPrevPlayerGrowth] = useState<number | null>(null);
  const [prevOpponentGrowth, setPrevOpponentGrowth] = useState<number | null>(null);
  const [arboretumModalOpen, setArboretumModalOpen] = useState(false);
  
  const playerAnimationTimer = useRef<NodeJS.Timeout | null>(null);
  const opponentAnimationTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function autoJoinBattle() {
      if (isConnected && address && !battleState && !hasScanned) {
        setHasScanned(true);
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
        }
      }
    }
    autoJoinBattle();
  }, [isConnected, address, battleState, hasScanned, joinBattle, getFirstValidSaplingNft]);

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

  // Trigger animations when growth changes with proper cleanup
  useEffect(() => {
    if (playerGrowth !== prevPlayerGrowth && prevPlayerGrowth !== null) {
      if (playerAnimationTimer.current) {
        clearTimeout(playerAnimationTimer.current);
      }
      
      setPlayerAnimation('');
      
      requestAnimationFrame(() => {
        const newAnimation = playerGrowth > prevPlayerGrowth ? 'grow-green' : 'shake';
        setPlayerAnimation(newAnimation);
        
        playerAnimationTimer.current = setTimeout(() => {
          setPlayerAnimation('');
          playerAnimationTimer.current = null;
        }, 2000);
      });
    }
    setPrevPlayerGrowth(playerGrowth);
  }, [playerGrowth, prevPlayerGrowth]);

  useEffect(() => {
    if (opponentGrowth !== prevOpponentGrowth && prevOpponentGrowth !== null) {
      if (opponentAnimationTimer.current) {
        clearTimeout(opponentAnimationTimer.current);
      }
      
      setOpponentAnimation('');
      
      requestAnimationFrame(() => {
        const newAnimation = opponentGrowth > prevOpponentGrowth ? 'grow-green' : 'shake';
        setOpponentAnimation(newAnimation);
        
        opponentAnimationTimer.current = setTimeout(() => {
          setOpponentAnimation('');
          opponentAnimationTimer.current = null;
        }, 2000);
      });
    }
    setPrevOpponentGrowth(opponentGrowth);
  }, [opponentGrowth, prevOpponentGrowth]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (playerAnimationTimer.current) {
        clearTimeout(playerAnimationTimer.current);
      }
      if (opponentAnimationTimer.current) {
        clearTimeout(opponentAnimationTimer.current);
      }
    };
  }, []);

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
      style={{
        backgroundImage: 'url(/assets/background4.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#000',
        color: 'white',
        textAlign: 'center',
        fontFamily: 'Orbitron, sans-serif',
        margin: 0,
        padding: 0,
        minHeight: '100vh',
        overflowX: 'hidden',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '15px 30px',
          background: 'rgba(0, 50, 0, 0.8)',
          borderBottom: '2px solid #00ff00',
          boxShadow: '0 0 15px #00ff00',
          position: 'relative',
        }}
      >
        <Link href="/">
          <img
            src="/assets/thick.png"
            alt="Thickquidity Logo"
            style={{
              width: '80px',
              cursor: 'pointer',
              filter: 'drop-shadow(0 0 15px #00ff00)',
              transition: 'transform 0.3s ease, filter 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.filter = 'drop-shadow(0 0 25px #00cc00)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.filter = 'drop-shadow(0 0 15px #00ff00)';
            }}
            data-testid="logo-home"
          />
        </Link>

        <nav style={{ display: 'flex', gap: '10px' }}>
          <Link 
            href="/"
            style={{
              color: '#00ff00',
              margin: '0 10px',
              textDecoration: 'none',
              fontSize: '16px',
              transition: 'color 0.3s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#00cc00'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#00ff00'}
            data-testid="link-home"
          >
            Home
          </Link>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setArboretumModalOpen(true);
            }}
            style={{
              color: '#00ff00',
              margin: '0 10px',
              textDecoration: 'none',
              fontSize: '16px',
              transition: 'color 0.3s ease',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#00cc00'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#00ff00'}
            data-testid="link-arboretum"
          >
            Arboretum
          </a>
        </nav>

        <ConnectButton connectText="Connect Wallet" />
      </header>

      {/* Title Image with animation */}
      <img
        src="/assets/garden.png"
        alt="The Garden Battles"
        className="title-image"
        style={{
          width: '100%',
          maxWidth: '680px',
          height: 'auto',
          maxHeight: '300px',
          margin: '25px auto 10px',
          display: 'block',
          animation: 'explodeAndShrink 2s ease-out forwards',
        }}
        data-testid="img-battle-title"
      />

      {/* Battle Area */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          margin: '20px 0',
          flexWrap: 'nowrap',
          maxWidth: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Player 1 NFT */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            margin: '0 20px',
          }}
        >
          <div
            className={playerAnimation}
            style={{
              width: '240px',
              height: '336px',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              boxShadow: winner === 'player' 
                ? '0 0 20px #00ff00, 0 0 40px #00ff00' 
                : '0 0 15px #ff0000',
              transition: 'transform 0.3s ease, box-shadow 0.3s ease',
              marginBottom: '10px',
              zIndex: 1,
              background: 'rgba(255, 255, 255, 0.1)',
              overflow: 'hidden',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 0 30px #00ff00';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = winner === 'player' 
                ? '0 0 20px #00ff00, 0 0 40px #00ff00' 
                : '0 0 15px #ff0000';
            }}
            data-testid="nft-card-player"
          >
            <img
              src={getNFTImage(playerGrowth)}
              alt="Player 1 Sapling"
              style={{
                maxWidth: '90%',
                maxHeight: '90%',
                objectFit: 'contain',
                borderRadius: '10px',
              }}
              data-testid="nft-image-player"
            />
            {winner === 'player' && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2,
                }}
              >
                <Trophy
                  style={{
                    width: '96px',
                    height: '96px',
                    color: '#00ff00',
                    filter: 'drop-shadow(0 0 20px #00ff00)',
                  }}
                />
              </div>
            )}
          </div>
          <div
            style={{
              width: '240px',
              height: '18px',
              background: 'rgba(0, 0, 0, 0.8)',
              borderRadius: '6px',
              padding: '2px',
              display: 'block',
              zIndex: 0,
              margin: '8px 0',
              boxShadow: '0 0 10px #00ff00',
            }}
          >
            <div
              style={{
                width: `${playerGrowth}%`,
                height: '18px',
                background: 'linear-gradient(to right, #00ff00, #00cc00)',
                borderRadius: '6px',
                transition: 'width 0.3s ease',
              }}
              data-testid="health-bar-player"
            />
          </div>
          <p style={{ marginTop: '8px', fontSize: '16px' }} data-testid="text-growth-player">
            Your Growth: {playerGrowth}
          </p>
        </div>

        {/* VS */}
        <div
          style={{
            fontSize: '48px',
            color: '#00ff00',
            textShadow: '0 0 10px #00ff00',
            fontFamily: 'FantasyBattles, sans-serif',
            margin: '0 25px',
            alignSelf: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
          }}
          data-testid="text-vs"
        >
          VS
        </div>

        {/* Player 2 NFT */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            margin: '0 20px',
          }}
        >
          <div
            className={opponentAnimation}
            style={{
              width: '240px',
              height: '336px',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              boxShadow: winner === 'opponent' 
                ? '0 0 20px #00ff00, 0 0 40px #00ff00' 
                : '0 0 15px #00ff00',
              transition: 'transform 0.3s ease, box-shadow 0.3s ease',
              marginBottom: '10px',
              zIndex: 1,
              background: 'rgba(255, 255, 255, 0.1)',
              overflow: 'hidden',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 0 30px #00ff00';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = winner === 'opponent' 
                ? '0 0 20px #00ff00, 0 0 40px #00ff00' 
                : '0 0 15px #00ff00';
            }}
            data-testid="nft-card-opponent"
          >
            <img
              src={getNFTImage(opponentGrowth)}
              alt="Player 2 Sapling"
              style={{
                maxWidth: '90%',
                maxHeight: '90%',
                objectFit: 'contain',
                borderRadius: '10px',
              }}
              data-testid="nft-image-opponent"
            />
            {winner === 'opponent' && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2,
                }}
              >
                <Trophy
                  style={{
                    width: '96px',
                    height: '96px',
                    color: '#00ff00',
                    filter: 'drop-shadow(0 0 20px #00ff00)',
                  }}
                />
              </div>
            )}
          </div>
          <div
            style={{
              width: '240px',
              height: '18px',
              background: 'rgba(0, 0, 0, 0.8)',
              borderRadius: '6px',
              padding: '2px',
              display: 'block',
              zIndex: 0,
              margin: '8px 0',
              boxShadow: '0 0 10px #00ff00',
            }}
          >
            <div
              style={{
                width: `${opponentGrowth}%`,
                height: '18px',
                background: 'linear-gradient(to right, #00ff00, #00cc00)',
                borderRadius: '6px',
                transition: 'width 0.3s ease',
              }}
              data-testid="health-bar-opponent"
            />
          </div>
          <p style={{ marginTop: '8px', fontSize: '16px' }} data-testid="text-growth-opponent">
            Opponent Growth: {opponentGrowth}
          </p>
        </div>
      </div>

      {/* Battle Options */}
      {playerMoves.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '10px',
            padding: '15px',
            background: 'rgba(0, 50, 0, 0.8)',
            border: '2px solid #00ff00',
            borderRadius: '12px',
            margin: '15px auto',
            maxWidth: '700px',
            maxHeight: '200px',
            overflowY: 'auto',
            position: 'relative',
            boxShadow: '0 0 15px #00ff00',
          }}
          data-testid="battle-options"
        >
          {playerMoves.map((moveId) => (
            <button
              key={moveId}
              onClick={() => handleUseAbility(moveId)}
              disabled={winner !== null}
              style={{
                padding: '12px 24px',
                border: '2px solid #00ff00',
                background: 'transparent',
                color: 'white',
                fontSize: '18px',
                cursor: winner ? 'not-allowed' : 'pointer',
                transition: '0.3s ease',
                boxShadow: '0 0 10px #00ff00',
                margin: '5px',
                borderRadius: '8px',
                opacity: winner ? 0.5 : 1,
                fontFamily: 'Orbitron, sans-serif',
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
      <p style={{ margin: '15px 0', fontSize: '20px', color: '#00ffcc' }} data-testid="text-entry-fee">
        3 SUI per Battle
      </p>
      <p style={{ marginTop: '15px', fontSize: '20px', color: '#ffff00' }} data-testid="text-battle-status">
        {battleStatus}
      </p>

      {/* Game Info Section */}
      <div
        style={{
          margin: '25px auto',
          maxWidth: '900px',
          padding: '25px',
          background: 'rgba(0, 50, 0, 0.8)',
          border: '2px solid #00ff00',
          borderRadius: '15px',
          boxShadow: '0 0 15px #00ff00',
          textAlign: 'left',
        }}
      >
        <h2
          style={{
            color: '#00ff00',
            textShadow: '0 0 5px #00ff00',
            marginBottom: '15px',
            fontFamily: 'FantasyBattles, sans-serif',
            fontSize: '24px',
          }}
        >
          Gameplay: The Garden Battles
        </h2>
        <p style={{ color: '#00ffcc', fontSize: '18px', lineHeight: '1.5', marginBottom: '15px' }}>
          Welcome to The Garden Battles by Thickquidity, a thrilling 1v1 strategy game powered by the Sui blockchain! To participate, you must hold a Sapling NFT from our official issuer. Engage in turn-based battles where your NFT grows from a seed to a full tree as you increase your Growth points. The first player to reach 100 Growth wins!
        </p>
        <ul style={{ listStyleType: 'disc', marginLeft: '20px', color: '#00ffcc', fontSize: '16px' }}>
          <li style={{ marginBottom: '10px' }}><strong>NFT Requirement</strong>: Hold a Sapling NFT to access battles.</li>
          <li style={{ marginBottom: '10px' }}><strong>Entry Fee</strong>: Each battle costs 3 SUI.</li>
          <li style={{ marginBottom: '10px' }}><strong>Rewards</strong>: The winner receives 5 SUI, with 1 SUI supporting Thickquidity's token buyback program.</li>
          <li style={{ marginBottom: '10px' }}><strong>Gameplay</strong>: Each player is randomly assigned four moves per battle—two to reduce the opponent's Growth (e.g., Thorn Spike Bomb, Razor Leaf Sword) and two to boost their own (e.g., Sun Beam, Photosynthetic Surge).</li>
          <li style={{ marginBottom: '10px' }}><strong>Visuals</strong>: Watch your NFT evolve from seed (0-25 Growth) to sapling (26-50), mature sapling (51-75), and full tree (76-100).</li>
        </ul>

        <h2
          style={{
            color: '#00ff00',
            textShadow: '0 0 5px #00ff00',
            marginTop: '25px',
            marginBottom: '15px',
            fontFamily: 'FantasyBattles, sans-serif',
            fontSize: '24px',
          }}
        >
          Coming Soon: Phase 2 – The Arboretum (Q4 2025)
        </h2>
        <p style={{ color: '#00ffcc', fontSize: '18px', lineHeight: '1.5', marginBottom: '15px' }}>
          Get ready for Phase 2 of The Garden Battles, launching in Q4 2025 with the introduction of The Arboretum! This exciting expansion brings dynamic NFT utility, unlocking massive rewards for Sapling NFT holders. Stay tuned for new gameplay mechanics, enhanced strategies, and opportunities to grow your rewards in the lush, competitive world of The Arboretum.
        </p>
        <ul style={{ listStyleType: 'disc', marginLeft: '20px', color: '#00ffcc', fontSize: '16px' }}>
          <li style={{ marginBottom: '10px' }}><strong>Dynamic NFT Utility</strong>: Your Sapling NFTs will unlock new abilities and perks.</li>
          <li style={{ marginBottom: '10px' }}><strong>Massive Rewards</strong>: Compete for exclusive prizes and boosted payouts.</li>
          <li style={{ marginBottom: '10px' }}><strong>Launch</strong>: Expected in Q4 2025—join our community for updates!</li>
        </ul>
      </div>

      {/* Footer */}
      <footer
        style={{
          textAlign: 'center',
          padding: '25px',
          background: 'rgba(0, 50, 0, 0.8)',
          borderTop: '2px solid #00ff00',
          boxShadow: '0 0 15px #00ff00',
          position: 'relative',
        }}
      >
        <a
          href="https://x.ai/grok"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#00ffcc',
            textDecoration: 'none',
            transition: 'color 0.3s ease, text-shadow 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#00ffff';
            e.currentTarget.style.textShadow = '0 0 10px #00ffff, 0 0 20px #00ffff, 0 0 30px #00ffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#00ffcc';
            e.currentTarget.style.textShadow = 'none';
          }}
        >
          Powered by SUI
        </a>
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '15px',
            fontSize: '13px',
            color: '#00ff00',
            opacity: 0.7,
          }}
        >
          Based Dev
        </div>
      </footer>

      <BattleDialog
        isOpen={dialogOpen}
        message={dialogMessage}
        onClose={() => setDialogOpen(false)}
      />
      <WaitingOverlay isWaiting={isWaiting} />
      
      <AdminPanel 
        adminAddress="0xcc8efa0e60a6632f1d948345095fd5a55eb37022fbc2646e5ce10046eb95c3e6"
        currentAddress={address || null}
      />

      {/* Arboretum Coming Soon Modal */}
      {arboretumModalOpen && (
        <div
          onClick={() => setArboretumModalOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.9)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'clamp(1rem, 3vw, 2rem)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: 'clamp(300px, 90vw, 600px)',
              background: 'linear-gradient(rgba(0, 50, 0, 0.95), rgba(0, 80, 0, 0.95))',
              border: '3px solid #00ff00',
              borderRadius: '10px',
              boxShadow: '0 0 30px rgba(0, 255, 0, 0.6)',
              padding: 'clamp(2rem, 5vw, 3rem)',
              textAlign: 'center',
            }}
          >
            <h2
              style={{
                fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
                color: '#00ff00',
                marginBottom: 'clamp(1rem, 3vw, 1.5rem)',
                textShadow: '0 0 10px rgba(0, 255, 0, 0.8)',
                fontFamily: 'Orbitron, sans-serif',
              }}
            >
              The Arboretum
            </h2>
            <p
              style={{
                fontSize: 'clamp(1rem, 2.5vw, 1.2rem)',
                color: '#00ffcc',
                marginBottom: 'clamp(1.5rem, 4vw, 2rem)',
                lineHeight: '1.6',
                fontFamily: 'Orbitron, sans-serif',
              }}
            >
              Coming Soon in Q4 2025
            </p>
            <p
              style={{
                fontSize: 'clamp(0.9rem, 2.2vw, 1rem)',
                color: '#fff',
                marginBottom: 'clamp(1.5rem, 4vw, 2rem)',
                lineHeight: '1.6',
                fontFamily: 'Orbitron, sans-serif',
              }}
            >
              The Arboretum will be your gateway to explore, collect, and nurture your NFT forest. 
              Stay tuned for exclusive features, enhanced battle mechanics, and community-driven growth!
            </p>
            <button
              onClick={() => setArboretumModalOpen(false)}
              style={{
                background: 'linear-gradient(45deg, #00ff00, #00cc00)',
                color: '#000',
                padding: 'clamp(0.6rem, 1.8vw, 0.8rem) clamp(1.2rem, 2.8vw, 2rem)',
                borderRadius: '9999px',
                border: '2px solid #00ff00',
                fontWeight: 'bold',
                fontSize: 'clamp(0.8rem, 2.2vw, 1rem)',
                cursor: 'pointer',
                transition: 'transform 0.3s, box-shadow 0.3s',
                boxShadow: '0 0 15px rgba(0, 255, 0, 0.6)',
                fontFamily: 'Orbitron, sans-serif',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.boxShadow = '0 0 25px #00ff00';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 255, 0, 0.6)';
              }}
              data-testid="button-close-arboretum"
            >
              Got it!
            </button>
            <button
              onClick={() => setArboretumModalOpen(false)}
              style={{
                position: 'absolute',
                top: 'clamp(10px, 2vw, 15px)',
                right: 'clamp(10px, 2vw, 15px)',
                width: 'clamp(30px, 8vw, 40px)',
                height: 'clamp(30px, 8vw, 40px)',
                background: 'rgba(0, 50, 0, 0.8)',
                color: '#00ff00',
                borderRadius: '50%',
                border: '2px solid #00ff00',
                fontSize: 'clamp(1rem, 2.5vw, 1.2rem)',
                cursor: 'pointer',
                transition: 'transform 0.3s, box-shadow 0.3s',
                fontFamily: 'Orbitron, sans-serif',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.2)';
                e.currentTarget.style.boxShadow = '0 0 15px #00ff00';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '';
              }}
              data-testid="button-close-arboretum-x"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
