import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Trophy } from 'lucide-react';
import { useSuiWallet } from '@/hooks/useSuiWallet';
import { MOVE_LABELS } from '@/lib/sui-config';
import BattleDialog from '@/components/BattleDialog';
import WaitingOverlay from '@/components/WaitingOverlay';

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
    ConnectWalletButton
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
      style={{
        background: 'url(/assets/background4.jpg) no-repeat center center fixed, #000',
        backgroundSize: 'cover',
        color: 'white',
        textAlign: 'center',
        fontFamily: 'Orbitron, sans-serif',
        margin: 0,
        padding: 0,
        minHeight: '100vh',
        overflowX: 'hidden',
      }}
    >
      {/* Header - Horizontal layout */}
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
            src="/assets/tree.jpg"
            alt="Battle Garden Logo"
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
            href="https://sensational-bubblegum-fd9c7c.netlify.app/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#00ff00',
              margin: '0 10px',
              textDecoration: 'none',
              fontSize: '16px',
              transition: 'color 0.3s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#00cc00'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#00ff00'}
            data-testid="link-arboretum"
          >
            Arboretum
          </a>
        </nav>

        <div>
          <ConnectWalletButton />
        </div>
      </header>

      {/* Title Image */}
      <img
        src="/assets/backgrounda.jpg"
        alt="The Garden Battles"
        style={{
          width: '100%',
          maxWidth: '680px',
          height: 'auto',
          maxHeight: '300px',
          margin: '25px auto 10px',
          display: 'block',
          borderRadius: '15px',
          boxShadow: '0 0 30px #00ff00',
          border: '3px solid #00ff00',
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
            style={{
              width: '240px',
              height: '336px',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              boxShadow: winner === 'player' ? '0 0 20px #00ff00, 0 0 40px #00ff00' : '0 0 15px #ff0000',
              transition: 'transform 0.3s ease, box-shadow 0.3s ease',
              marginBottom: '10px',
              zIndex: 1,
              background: 'rgba(255, 255, 255, 0.1)',
              overflow: 'hidden',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
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
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
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
            style={{
              width: '240px',
              height: '336px',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              boxShadow: winner === 'opponent' ? '0 0 20px #00ff00, 0 0 40px #00ff00' : '0 0 15px #00ff00',
              transition: 'transform 0.3s ease, box-shadow 0.3s ease',
              marginBottom: '10px',
              zIndex: 1,
              background: 'rgba(255, 255, 255, 0.1)',
              overflow: 'hidden',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
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
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
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
      </footer>

      <BattleDialog 
        isOpen={dialogOpen}
        message={dialogMessage}
        onClose={() => setDialogOpen(false)}
      />
      <WaitingOverlay isWaiting={isWaiting} />
    </div>
  );
}
