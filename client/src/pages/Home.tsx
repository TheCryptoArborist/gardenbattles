import { Link } from 'wouter';
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';

export default function Home() {
  const account = useCurrentAccount();

  return (
    <div 
      style={{
        background: 'url(/assets/background1.jpg) no-repeat center center fixed',
        backgroundSize: 'cover',
        color: 'white',
        minHeight: '100vh',
        margin: 0,
        padding: 0,
        fontFamily: 'Orbitron, sans-serif',
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

        <ConnectButton 
          connectText="Connect Wallet"
          style={{
            padding: '10px 20px',
            border: '2px solid #00ff00',
            background: 'linear-gradient(45deg, rgba(0, 100, 0, 0.5), rgba(0, 150, 0, 0.5))',
            color: 'white',
            fontSize: '16px',
            fontFamily: 'Orbitron, sans-serif',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 0 10px #00ff00, 0 0 5px #000000',
            borderRadius: '8px',
            textTransform: 'uppercase',
          }}
        />
      </header>

      {/* Hero Section with Character */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 100px)',
          padding: '40px 20px',
          position: 'relative',
        }}
      >
        {/* Hero Character */}
        <img 
          src="/assets/hero.png" 
          alt="Tree Warrior"
          className="explosion"
          style={{
            width: '400px',
            maxWidth: '90vw',
            height: 'auto',
            marginBottom: '30px',
            filter: 'drop-shadow(0 0 30px #00ff00)',
          }}
          data-testid="img-hero"
        />

        {/* Title */}
        <h1
          style={{
            fontSize: 'clamp(2rem, 6vw, 4rem)',
            marginBottom: '20px',
            color: '#00ff00',
            textShadow: '0 0 20px #00ff00, 0 0 40px #00ff00',
            fontFamily: 'Orbitron, sans-serif',
            fontWeight: 'bold',
            textAlign: 'center',
          }}
        >
          The Garden Battles
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 'clamp(1rem, 3vw, 1.5rem)',
            marginBottom: '30px',
            maxWidth: '700px',
            textAlign: 'center',
            color: '#00ffcc',
            lineHeight: '1.6',
          }}
        >
          Battle your Sapling NFTs in strategic 1v1 turn-based combat on the Sui blockchain. 
          Watch your NFT evolve from seed to full tree as you gain Growth points!
        </p>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link 
            href="/battle"
            style={{
              padding: '15px 40px',
              border: '2px solid #00ff00',
              background: 'linear-gradient(45deg, rgba(0, 100, 0, 0.5), rgba(0, 150, 0, 0.5))',
              color: 'white',
              fontSize: '18px',
              fontFamily: 'Orbitron, sans-serif',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 0 10px #00ff00',
              borderRadius: '8px',
              textTransform: 'uppercase',
              textDecoration: 'none',
              display: 'inline-block',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#00ff00';
              e.currentTarget.style.color = '#000';
              e.currentTarget.style.boxShadow = '0 0 25px #00ff00';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(45deg, rgba(0, 100, 0, 0.5), rgba(0, 150, 0, 0.5))';
              e.currentTarget.style.color = 'white';
              e.currentTarget.style.boxShadow = '0 0 10px #00ff00';
            }}
            data-testid="button-enter-battle"
          >
            Enter The Garden Battle
          </Link>

          <a 
            href="https://sensational-bubblegum-fd9c7c.netlify.app/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '15px 40px',
              border: '2px solid #00ff00',
              background: 'transparent',
              color: '#00ff00',
              fontSize: '18px',
              fontFamily: 'Orbitron, sans-serif',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 0 10px #00ff00',
              borderRadius: '8px',
              textTransform: 'uppercase',
              textDecoration: 'none',
              display: 'inline-block',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#00ff00';
              e.currentTarget.style.color = '#000';
              e.currentTarget.style.boxShadow = '0 0 25px #00ff00';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#00ff00';
              e.currentTarget.style.boxShadow = '0 0 10px #00ff00';
            }}
            data-testid="button-arboretum"
          >
            Visit Arboretum
          </a>
        </div>

        {/* Info Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '25px',
            maxWidth: '1200px',
            width: '100%',
            marginTop: '60px',
          }}
        >
          {/* Mission Card */}
          <div
            style={{
              padding: '25px',
              background: 'rgba(0, 50, 0, 0.8)',
              border: '2px solid #00ff00',
              borderRadius: '15px',
              boxShadow: '0 0 15px #00ff00',
            }}
          >
            <h3
              style={{
                fontSize: '24px',
                marginBottom: '15px',
                color: '#00ff00',
                textShadow: '0 0 5px #00ff00',
              }}
            >
              Mission
            </h3>
            <p style={{ color: '#00ffcc', fontSize: '16px', lineHeight: '1.5' }}>
              Battle your Sapling NFTs in strategic 1v1 turn-based combat. Watch your NFT evolve from seed to full tree as you gain Growth points.
            </p>
          </div>

          {/* Tokenomics Card */}
          <div
            style={{
              padding: '25px',
              background: 'rgba(0, 50, 0, 0.8)',
              border: '2px solid #00ff00',
              borderRadius: '15px',
              boxShadow: '0 0 15px #00ff00',
            }}
          >
            <h3
              style={{
                fontSize: '24px',
                marginBottom: '15px',
                color: '#00ff00',
                textShadow: '0 0 5px #00ff00',
              }}
            >
              Tokenomics
            </h3>
            <ul style={{ listStyleType: 'none', padding: 0, color: '#00ffcc', fontSize: '16px' }}>
              <li style={{ marginBottom: '10px' }}>✓ Entry Fee: 3 SUI</li>
              <li style={{ marginBottom: '10px' }}>✓ Winner Reward: 5 SUI</li>
              <li style={{ marginBottom: '10px' }}>✓ 30 Unique Abilities</li>
              <li>✓ 4 Evolution Stages</li>
            </ul>
          </div>

          {/* NFTrees Card */}
          <div
            style={{
              padding: '25px',
              background: 'rgba(0, 50, 0, 0.8)',
              border: '2px solid #00ff00',
              borderRadius: '15px',
              boxShadow: '0 0 15px #00ff00',
            }}
          >
            <h3
              style={{
                fontSize: '24px',
                marginBottom: '15px',
                color: '#00ff00',
                textShadow: '0 0 5px #00ff00',
              }}
            >
              NFTrees
            </h3>
            <p style={{ color: '#00ffcc', fontSize: '16px', lineHeight: '1.5' }}>
              Sapling NFTs unlock battle access and evolve visually as they grow. Seed → Sapling → Mature → Full Tree.
            </p>
          </div>
        </div>
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
          href="https://x.com/thickquidity"
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
          Powered by SUI | Join Thickquidity
        </a>
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '15px',
            fontSize: '12px',
            color: '#00ff00',
            opacity: 0.7,
          }}
        >
          Based Dev
        </div>
      </footer>
    </div>
  );
}
