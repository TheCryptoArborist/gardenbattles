import { Link } from 'wouter';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';

export default function Home() {
  const account = useCurrentAccount();

  return (
    <div 
      style={{
        background: 'url(/assets/background1.jpg) no-repeat center center fixed',
        backgroundSize: 'cover',
        color: '#f7fafc',
        minHeight: '100vh',
        margin: 0,
        padding: 0,
      }}
    >
      {/* Header - Centered with logo and nav stacked */}
      <header 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          padding: 'clamp(0.8rem, 3vw, 1rem) 5%',
          background: 'linear-gradient(#1a4731, transparent)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '0.5rem',
          }}
        >
          <img 
            src="/assets/tree.jpg" 
            alt="Battle Garden Logo"
            style={{
              height: 'clamp(3rem, 10vw, 5rem)',
              maxWidth: '90%',
              filter: 'drop-shadow(0 0 10px #34d399)',
              marginBottom: '0.25rem',
            }}
            data-testid="img-logo"
          />
          <nav
            style={{
              display: 'flex',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <Link 
              href="/"
              style={{
                color: '#00ff00',
                textDecoration: 'none',
                margin: 'clamp(0.5rem, 1.5vw, 1rem)',
                fontWeight: 'bold',
                fontSize: 'clamp(0.8rem, 2.2vw, 1rem)',
                position: 'relative',
                transition: 'color 0.3s',
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
                textDecoration: 'none',
                margin: 'clamp(0.5rem, 1.5vw, 1rem)',
                fontWeight: 'bold',
                fontSize: 'clamp(0.8rem, 2.2vw, 1rem)',
                position: 'relative',
                transition: 'color 0.3s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#00cc00'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#00ff00'}
              data-testid="link-arboretum"
            >
              Arboretum
            </a>
            <Link 
              href="/battle"
              style={{
                color: '#00ff00',
                textDecoration: 'none',
                margin: 'clamp(0.5rem, 1.5vw, 1rem)',
                fontWeight: 'bold',
                fontSize: 'clamp(0.8rem, 2.2vw, 1rem)',
                position: 'relative',
                transition: 'color 0.3s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#00cc00'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#00ff00'}
              data-testid="link-battle"
            >
              Battle
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: 'clamp(1rem, 5vw, 2rem)',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div style={{ maxWidth: '90%', width: '100%' }}>
          <img 
            src="/assets/tree.jpg" 
            alt="Battle Garden Logo"
            style={{
              width: '200px',
              height: '200px',
              margin: '0 auto clamp(1rem, 3vw, 1.5rem)',
              display: 'block',
              filter: 'drop-shadow(0 0 15px #34d399)',
              borderRadius: '50%',
              objectFit: 'cover',
              boxShadow: '0 0 40px #00ff00',
              border: '4px solid #00ff00',
            }}
          />
          
          <h1
            style={{
              fontSize: 'clamp(1.8rem, 5vw, 3.5rem)',
              marginBottom: 'clamp(1rem, 3vw, 2rem)',
              color: '#34d399',
              textShadow: '0 0 10px #1a4731',
              fontFamily: 'Orbitron, sans-serif',
            }}
          >
            The Garden Battles
          </h1>

          <p
            style={{
              fontSize: 'clamp(0.9rem, 2.8vw, 1.3rem)',
              marginBottom: 'clamp(1rem, 3vw, 2rem)',
              maxWidth: '600px',
              marginLeft: 'auto',
              marginRight: 'auto',
              color: '#00ffcc',
              textShadow: '0 0 10px #00ff00',
            }}
          >
            Battle your Sapling NFTs in strategic 1v1 turn-based combat. Watch your NFT evolve from seed to full tree as you gain Growth points.
          </p>

          {/* Connect Wallet Button */}
          <div style={{ marginBottom: 'clamp(2rem, 4vw, 3rem)' }}>
            <ConnectButton 
              connectText="Connect Wallet"
              style={{
                background: 'linear-gradient(45deg, #34d399, #d4a017)',
                color: '#1a4731',
                padding: 'clamp(0.6rem, 1.8vw, 0.9rem) clamp(1.2rem, 2.8vw, 2rem)',
                borderRadius: '9999px',
                fontWeight: 'bold',
                fontSize: 'clamp(0.8rem, 2.2vw, 1.1rem)',
                border: 'none',
                cursor: 'pointer',
                transition: 'transform 0.3s, box-shadow 0.3s',
              }}
            />
          </div>

          {account && (
            <p
              style={{
                fontSize: '0.8rem',
                color: '#d4a017',
                marginTop: '0.5rem',
              }}
            >
              Connected: {account.address.slice(0, 6)}...{account.address.slice(-4)}
            </p>
          )}

          {/* CTA Button */}
          <Link 
            href="/battle"
            style={{
              display: 'inline-block',
              background: 'linear-gradient(45deg, #34d399, #d4a017)',
              color: '#1a4731',
              padding: 'clamp(0.6rem, 1.8vw, 0.9rem) clamp(1.2rem, 2.8vw, 2rem)',
              borderRadius: '9999px',
              textDecoration: 'none',
              fontWeight: 'bold',
              fontSize: 'clamp(0.8rem, 2.2vw, 1.1rem)',
              position: 'relative',
              overflow: 'hidden',
              transition: 'transform 0.3s, box-shadow 0.3s',
              marginTop: '2rem',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.15)';
              e.currentTarget.style.boxShadow = '0 0 20px #34d399';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            data-testid="button-enter-battle"
          >
            Enter The Garden Battle
          </Link>

          {/* Info Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))',
              gap: 'clamp(0.8rem, 2.5vw, 1.5rem)',
              maxWidth: '1200px',
              margin: '3rem auto 0',
            }}
          >
            {/* Mission */}
            <div
              style={{
                padding: 'clamp(0.8rem, 2.5vw, 1.5rem)',
                background: 'linear-gradient(#276749, #1a4731)',
                borderRadius: '0.75rem',
                textAlign: 'center',
              }}
            >
              <h3
                style={{
                  fontSize: 'clamp(1.2rem, 3vw, 1.5rem)',
                  marginBottom: 'clamp(0.6rem, 1.8vw, 1rem)',
                  color: '#d4a017',
                }}
              >
                Mission
              </h3>
              <p style={{ fontSize: 'clamp(0.8rem, 2.2vw, 0.9rem)' }}>
                Battle your Sapling NFTs in strategic 1v1 turn-based combat. Watch your NFT evolve from seed to full tree as you gain Growth points.
              </p>
            </div>

            {/* Tokenomics */}
            <div
              style={{
                padding: 'clamp(0.8rem, 2.5vw, 1.5rem)',
                background: 'linear-gradient(#276749, #1a4731)',
                borderRadius: '0.75rem',
                textAlign: 'center',
              }}
            >
              <h3
                style={{
                  fontSize: 'clamp(1.2rem, 3vw, 1.5rem)',
                  marginBottom: 'clamp(0.6rem, 1.8vw, 1rem)',
                  color: '#d4a017',
                }}
              >
                Tokenomics
              </h3>
              <ul
                style={{
                  listStyleType: 'none',
                  padding: 0,
                  fontSize: 'clamp(0.8rem, 2.2vw, 0.9rem)',
                }}
              >
                <li>Entry Fee: 3 SUI</li>
                <li>Winner Reward: 5 SUI</li>
                <li>30 Unique Abilities</li>
                <li>4 Evolution Stages</li>
              </ul>
            </div>

            {/* NFTs */}
            <div
              style={{
                padding: 'clamp(0.8rem, 2.5vw, 1.5rem)',
                background: 'linear-gradient(#276749, #1a4731)',
                borderRadius: '0.75rem',
                textAlign: 'center',
              }}
            >
              <h3
                style={{
                  fontSize: 'clamp(1.2rem, 3vw, 1.5rem)',
                  marginBottom: 'clamp(0.6rem, 1.8vw, 1rem)',
                  color: '#d4a017',
                }}
              >
                NFTrees
              </h3>
              <p style={{ fontSize: 'clamp(0.8rem, 2.2vw, 0.9rem)' }}>
                Sapling NFTs unlock battle access and evolve visually as they grow. Seed → Sapling → Mature → Full Tree.
              </p>
            </div>
          </div>

          {/* Social Links */}
          <div style={{ marginTop: '3rem' }}>
            <p style={{ fontSize: '0.9rem', marginBottom: '1rem', color: '#2dd4bf' }}>
              Join the $TREE Forest
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <a 
                href="https://x.com/thickquidity" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: '#34d399', fontSize: '0.9rem', textDecoration: 'underline' }}
              >
                X
              </a>
              <a 
                href="https://t.me/thickquidity" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: '#34d399', fontSize: '0.9rem', textDecoration: 'underline' }}
              >
                Telegram
              </a>
              <a 
                href="https://sui.io/" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: '#34d399', fontSize: '0.9rem', textDecoration: 'underline' }}
              >
                SUI Network
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer
        style={{
          textAlign: 'center',
          padding: '1.5rem',
          background: 'rgba(26, 71, 49, 0.8)',
          borderTop: '2px solid #34d399',
        }}
      >
        <a
          href="https://sui.io/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#2dd4bf',
            textDecoration: 'none',
            transition: 'color 0.3s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#34d399'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#2dd4bf'}
        >
          Powered by SUI
        </a>
      </footer>
    </div>
  );
}
