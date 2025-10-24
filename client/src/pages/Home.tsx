import { useState } from 'react';
import { Link } from 'wouter';
import { ConnectButton } from '@mysten/dapp-kit';

export default function Home() {
  const [showComingSoon, setShowComingSoon] = useState(false);

  return (
    <div 
      style={{
        backgroundImage: 'url(/assets/background4.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat',
        color: 'white',
        minHeight: '100vh',
        margin: 0,
        padding: 0,
        fontFamily: 'Orbitron, sans-serif',
      }}
    >
      {/* Coming Soon Dialog */}
      {showComingSoon && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowComingSoon(false)}
          data-testid="dialog-coming-soon"
        >
          <div
            style={{
              background: 'rgba(0, 50, 0, 0.9)',
              border: '2px solid #00ff00',
              borderRadius: '15px',
              padding: 'clamp(1.5rem, 5vw, 2.5rem)',
              maxWidth: '90%',
              width: 'clamp(300px, 80vw, 500px)',
              textAlign: 'center',
              boxShadow: '0 0 15px #00ff00',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', marginBottom: '1rem', color: '#00ff00', textShadow: '0 0 10px #00ff00' }}>
              Coming Soon!
            </h2>
            <p style={{ fontSize: 'clamp(1rem, 3vw, 1.2rem)', marginBottom: '1.5rem' }}>
              The Arboretum is currently under development. Stay tuned!
            </p>
            <button
              onClick={() => setShowComingSoon(false)}
              style={{
                padding: 'clamp(10px, 2vw, 12px) clamp(20px, 4vw, 24px)',
                background: 'transparent',
                color: 'white',
                border: '2px solid #00ff00',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)',
                cursor: 'pointer',
                transition: 'all 0.3s',
                boxShadow: '0 0 10px #00ff00',
                textTransform: 'uppercase',
                fontFamily: 'Orbitron, sans-serif',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#00ff00';
                e.currentTarget.style.color = '#000';
                e.currentTarget.style.boxShadow = '0 0 25px #00ff00';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'white';
                e.currentTarget.style.boxShadow = '0 0 10px #00ff00';
              }}
              data-testid="button-close-dialog"
            >
              Close
            </button>
          </div>
        </div>
      )}

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
          flexWrap: 'wrap',
          gap: '10px',
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
              transition: 'transform 0.3s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            data-testid="logo-home"
          />
        </Link>

        <nav style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <Link
            href="/"
            style={{
              color: '#00ff00',
              textDecoration: 'none',
              fontSize: '16px',
              transition: 'color 0.3s',
              fontWeight: 'bold',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#00cc00'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#00ff00'}
            data-testid="link-home"
          >
            Home
          </Link>
          <button
            onClick={() => setShowComingSoon(true)}
            style={{
              color: '#00ff00',
              background: 'none',
              border: 'none',
              fontSize: '16px',
              cursor: 'pointer',
              transition: 'color 0.3s',
              fontWeight: 'bold',
              padding: 0,
              fontFamily: 'Orbitron, sans-serif',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#00cc00'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#00ff00'}
            data-testid="button-arboretum-nav"
          >
            Arboretum
          </button>
          <Link
            href="/battle"
            style={{
              color: '#00ff00',
              textDecoration: 'none',
              fontSize: '16px',
              transition: 'color 0.3s',
              fontWeight: 'bold',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#00cc00'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#00ff00'}
            data-testid="link-battle"
          >
            Battle
          </Link>
        </nav>

        <ConnectButton 
          connectText="Connect Wallet"
        />
      </header>

      {/* Hero Section */}
      <section
        style={{
          minHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: 'clamp(40px, 8vw, 80px) clamp(20px, 4vw, 40px)',
        }}
      >
        <img 
          src="/assets/hero.png" 
          alt="Tree Warrior"
          className="explosion"
          style={{
            width: 'clamp(200px, 40vw, 400px)',
            height: 'auto',
            marginBottom: 'clamp(20px, 4vw, 30px)',
            filter: 'drop-shadow(0 0 30px #00ff00)',
          }}
          data-testid="img-hero"
        />

        <h1
          style={{
            fontSize: 'clamp(2.5rem, 6vw, 4rem)',
            marginBottom: 'clamp(15px, 3vw, 20px)',
            color: '#00ff00',
            textShadow: '0 0 20px #00ff00, 0 0 40px #00ff00',
            fontWeight: 'bold',
          }}
        >
          The Garden Battles
        </h1>

        <p
          style={{
            fontSize: 'clamp(1rem, 2.5vw, 1.3rem)',
            marginBottom: 'clamp(20px, 4vw, 30px)',
            maxWidth: '700px',
            color: '#00ffcc',
            lineHeight: '1.6',
          }}
        >
          Battle your Sapling NFTs in strategic 1v1 turn-based combat on the Sui blockchain. 
          Watch your NFT evolve from seed to full tree as you gain Growth points!
        </p>

        <div style={{ display: 'flex', gap: 'clamp(15px, 3vw, 20px)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link 
            href="/battle"
            style={{
              padding: 'clamp(12px, 2.5vw, 15px) clamp(30px, 5vw, 40px)',
              border: '2px solid #00ff00',
              background: 'linear-gradient(45deg, rgba(0, 100, 0, 0.5), rgba(0, 150, 0, 0.5))',
              color: 'white',
              fontSize: 'clamp(16px, 3vw, 18px)',
              fontFamily: 'Orbitron, sans-serif',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 0 10px #00ff00',
              borderRadius: '8px',
              textTransform: 'uppercase',
              textDecoration: 'none',
              display: 'inline-block',
              fontWeight: 'bold',
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

          <button
            onClick={() => setShowComingSoon(true)}
            style={{
              padding: 'clamp(12px, 2.5vw, 15px) clamp(30px, 5vw, 40px)',
              border: '2px solid #00ff00',
              background: 'transparent',
              color: '#00ff00',
              fontSize: 'clamp(16px, 3vw, 18px)',
              fontFamily: 'Orbitron, sans-serif',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 0 10px #00ff00',
              borderRadius: '8px',
              textTransform: 'uppercase',
              fontWeight: 'bold',
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
          </button>
        </div>
      </section>

      {/* About Section */}
      <section style={{ padding: 'clamp(30px, 6vw, 60px) clamp(20px, 4vw, 40px)' }}>
        <div
          style={{
            maxWidth: '900px',
            margin: '0 auto',
            padding: '25px',
            background: 'rgba(0, 50, 0, 0.8)',
            border: '2px solid #00ff00',
            borderRadius: '15px',
            boxShadow: '0 0 15px #00ff00',
          }}
        >
          <h2
            style={{
              fontSize: 'clamp(28px, 5vw, 36px)',
              textAlign: 'center',
              marginBottom: '25px',
              color: '#00ff00',
              textShadow: '0 0 10px #00ff00',
            }}
          >
            About Battle Garden
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))',
              gap: '20px',
            }}
          >
            <div>
              <h3 style={{ fontSize: 'clamp(20px, 4vw, 24px)', color: '#00ff00', marginBottom: '10px' }}>
                Fair Launch
              </h3>
              <p style={{ color: '#00ffcc', fontSize: 'clamp(14px, 2.5vw, 16px)', lineHeight: '1.5' }}>Total $TREE Supply</p>
            </div>
            <div>
              <h3 style={{ fontSize: 'clamp(20px, 4vw, 24px)', color: '#00ff00', marginBottom: '10px' }}>
                NFTrees
              </h3>
              <p style={{ color: '#00ffcc', fontSize: 'clamp(14px, 2.5vw, 16px)', lineHeight: '1.5' }}>Utility NFTrees in development</p>
            </div>
            <div>
              <h3 style={{ fontSize: 'clamp(20px, 4vw, 24px)', color: '#00ff00', marginBottom: '10px' }}>
                SUI-Powered
              </h3>
              <p style={{ color: '#00ffcc', fontSize: 'clamp(14px, 2.5vw, 16px)', lineHeight: '1.5' }}>Fast, Scalable Blockchain</p>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section style={{ padding: 'clamp(30px, 6vw, 60px) clamp(20px, 4vw, 40px)' }}>
        <h2
          style={{
            fontSize: 'clamp(28px, 5vw, 36px)',
            textAlign: 'center',
            marginBottom: '30px',
            color: '#00ff00',
            textShadow: '0 0 10px #00ff00',
          }}
        >
          Our Mission
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(250px, 100%), 1fr))',
            gap: '25px',
            maxWidth: '1200px',
            margin: '0 auto',
          }}
        >
          <div
            style={{
              padding: '25px',
              background: 'rgba(0, 50, 0, 0.8)',
              border: '2px solid #00ff00',
              borderRadius: '15px',
              boxShadow: '0 0 15px #00ff00',
            }}
          >
            <h3 style={{ fontSize: 'clamp(20px, 4vw, 24px)', marginBottom: '15px', color: '#00ff00', textShadow: '0 0 5px #00ff00' }}>
              Growth
            </h3>
            <p style={{ color: '#00ffcc', fontSize: 'clamp(14px, 2.5vw, 16px)', lineHeight: '1.6' }}>
              Empower financial prosperity through innovative DeFi solutions and project utility on the SUI chain.
              $TREE holders can stake, trade, and grow their wealth with cutting-edge tools and thick liquidity.
            </p>
          </div>
          <div
            style={{
              padding: '25px',
              background: 'rgba(0, 50, 0, 0.8)',
              border: '2px solid #00ff00',
              borderRadius: '15px',
              boxShadow: '0 0 15px #00ff00',
            }}
          >
            <h3 style={{ fontSize: 'clamp(20px, 4vw, 24px)', marginBottom: '15px', color: '#00ff00', textShadow: '0 0 5px #00ff00' }}>
              Ecosystem
            </h3>
            <p style={{ color: '#00ffcc', fontSize: 'clamp(14px, 2.5vw, 16px)', lineHeight: '1.6' }}>
              Build a robust ecosystem where $TREE's thick liquidity ensures stability and growth.
              Our fair launch approach fosters collaboration and shared success for all members.
            </p>
          </div>
          <div
            style={{
              padding: '25px',
              background: 'rgba(0, 50, 0, 0.8)',
              border: '2px solid #00ff00',
              borderRadius: '15px',
              boxShadow: '0 0 15px #00ff00',
            }}
          >
            <h3 style={{ fontSize: 'clamp(20px, 4vw, 24px)', marginBottom: '15px', color: '#00ff00', textShadow: '0 0 5px #00ff00' }}>
              Sustainability
            </h3>
            <p style={{ color: '#00ffcc', fontSize: 'clamp(14px, 2.5vw, 16px)', lineHeight: '1.6' }}>
              Ensure long-term wealth with secure, transparent blockchain technology.
              Our roots are built to last, supporting a thriving future with strong project utility.
            </p>
          </div>
        </div>
      </section>

      {/* Tokenomics Section */}
      <section style={{ padding: 'clamp(30px, 6vw, 60px) clamp(20px, 4vw, 40px)' }}>
        <div
          style={{
            maxWidth: '900px',
            margin: '0 auto',
            padding: '25px',
            background: 'rgba(0, 50, 0, 0.8)',
            border: '2px solid #00ff00',
            borderRadius: '15px',
            boxShadow: '0 0 15px #00ff00',
          }}
        >
          <h2
            style={{
              fontSize: 'clamp(28px, 5vw, 36px)',
              textAlign: 'center',
              marginBottom: '25px',
              color: '#00ff00',
              textShadow: '0 0 10px #00ff00',
            }}
          >
            Tokenomics of $TREE
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))',
              gap: '20px',
            }}
          >
            <div>
              <h3 style={{ fontSize: 'clamp(18px, 3.5vw, 22px)', color: '#00ff00', marginBottom: '10px' }}>
                Total Supply
              </h3>
              <p style={{ color: '#00ffcc', fontSize: 'clamp(13px, 2.3vw, 15px)', lineHeight: '1.5' }}>
                1,000,000,000 $TREE tokens, ensuring a robust foundation for ecosystem growth.
              </p>
            </div>
            <div>
              <h3 style={{ fontSize: 'clamp(18px, 3.5vw, 22px)', color: '#00ff00', marginBottom: '10px' }}>
                NFTrees
              </h3>
              <p style={{ color: '#00ffcc', fontSize: 'clamp(13px, 2.3vw, 15px)', lineHeight: '1.5' }}>
                Utility NFTrees in development.
              </p>
            </div>
            <div>
              <h3 style={{ fontSize: 'clamp(18px, 3.5vw, 22px)', color: '#00ff00', marginBottom: '10px' }}>
                Staking Rewards
              </h3>
              <p style={{ color: '#00ffcc', fontSize: 'clamp(13px, 2.3vw, 15px)', lineHeight: '1.5' }}>
                Earn passive income by staking $TREE in our DeFi pools on SUI.
              </p>
            </div>
            <div>
              <h3 style={{ fontSize: 'clamp(18px, 3.5vw, 22px)', color: '#00ff00', marginBottom: '10px' }}>
                Fair Launch
              </h3>
              <p style={{ color: '#00ffcc', fontSize: 'clamp(13px, 2.3vw, 15px)', lineHeight: '1.5' }}>
                Launched off moonbags.io, focused on utility and thick liquidity for sustained growth.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* NFTs Section */}
      <section style={{ padding: 'clamp(30px, 6vw, 60px) clamp(20px, 4vw, 40px)' }}>
        <div
          style={{
            maxWidth: '900px',
            margin: '0 auto',
            padding: '25px',
            background: 'rgba(0, 50, 0, 0.8)',
            border: '2px solid #00ff00',
            borderRadius: '15px',
            boxShadow: '0 0 15px #00ff00',
          }}
        >
          <img
            src="/assets/tree.jpg"
            alt="$TREE NFT Preview"
            style={{
              maxWidth: '100%',
              height: 'auto',
              maxHeight: '80px',
              margin: '0 auto 20px',
              display: 'block',
              filter: 'drop-shadow(0 0 15px #00ff00)',
            }}
          />
          <h2 style={{ fontSize: 'clamp(28px, 5vw, 36px)', marginBottom: '20px', color: '#00ff00', textShadow: '0 0 10px #00ff00' }}>
            $TREE NFTs
          </h2>
          <p style={{ color: '#00ffcc', fontSize: 'clamp(14px, 2.5vw, 16px)', marginBottom: '15px', lineHeight: '1.6' }}>
            $TREE NFTs unlock monthly SUI airdrops from staking pools, funded by developers, with 80% of sales fueling $TREE buybacks for locked liquidity. 5% will be donated to treefund.org and be livestreamed on Youtube, with receipt for verification.
          </p>
          <p style={{ color: '#00ffcc', fontSize: 'clamp(14px, 2.5vw, 16px)', lineHeight: '1.6' }}>
            Gain access to explosive gaming opportunities as a holder, and unlock ongoing ecosystem benefits. Crafted with stunning worldly tree designs and arborist-inspired details, 5% of every sale supports treefund.org, donated live on The Crypto Arborist's YouTube. NFT Games will begin development in Q4 2025.
          </p>
        </div>
      </section>

      {/* Litepaper Section */}
      <section style={{ padding: 'clamp(30px, 6vw, 60px) clamp(20px, 4vw, 40px)' }}>
        <div
          style={{
            maxWidth: '900px',
            margin: '0 auto',
            padding: '25px',
            background: 'rgba(0, 50, 0, 0.8)',
            border: '2px solid #00ff00',
            borderRadius: '15px',
            boxShadow: '0 0 15px #00ff00',
          }}
        >
          <h2 style={{ fontSize: 'clamp(28px, 5vw, 36px)', marginBottom: '20px', color: '#00ff00', textShadow: '0 0 10px #00ff00' }}>
            $TREE Litepaper
          </h2>
          <p style={{ color: '#00ffcc', fontSize: 'clamp(14px, 2.5vw, 16px)', lineHeight: '1.6' }}>
            Explore the $TREE Litepaper to learn about our vision, tokenomics, and utility-driven ecosystem.
            Discover how THICKQUIDITY is planting the seeds for financial freedom on the SUI blockchain.
          </p>
        </div>
      </section>

      {/* Social Section */}
      <section style={{ padding: 'clamp(30px, 6vw, 60px) clamp(20px, 4vw, 40px)' }}>
        <div
          style={{
            maxWidth: '900px',
            margin: '0 auto',
            padding: '25px',
            background: 'rgba(0, 50, 0, 0.8)',
            border: '2px solid #00ff00',
            borderRadius: '15px',
            boxShadow: '0 0 15px #00ff00',
          }}
        >
          <h2 style={{ fontSize: 'clamp(28px, 5vw, 36px)', marginBottom: '20px', color: '#00ff00', textShadow: '0 0 10px #00ff00' }}>
            Social Outreach Utility
          </h2>
          <p style={{ color: '#00ffcc', fontSize: 'clamp(14px, 2.5vw, 16px)', lineHeight: '1.6' }}>
            Join @thecryptoarborist on YouTube for explosive $TREE content, diving deep into the DeFi ecosystem, SUI blockchain, and the growth of the $TREE universe.
            The Crypto Arborist collaborates with team members across various projects to expand our reach and cultivate a thriving community through engaging discussions and insights.
          </p>
        </div>
      </section>

      {/* Join Section */}
      <section style={{ padding: 'clamp(30px, 6vw, 60px) clamp(20px, 4vw, 40px)' }}>
        <div
          style={{
            maxWidth: '900px',
            margin: '0 auto',
            padding: '25px',
            background: 'rgba(0, 50, 0, 0.8)',
            border: '2px solid #00ff00',
            borderRadius: '15px',
            boxShadow: '0 0 15px #00ff00',
          }}
        >
          <h2 style={{ fontSize: 'clamp(28px, 5vw, 36px)', marginBottom: '20px', color: '#00ff00', textShadow: '0 0 10px #00ff00' }}>
            Join the $TREE Forest
          </h2>
          <p style={{ color: '#00ffcc', fontSize: 'clamp(14px, 2.5vw, 16px)', marginBottom: '20px', lineHeight: '1.6' }}>
            Stake your $TREE in the SUI network and watch your financial freedom blossom.
            Connect with our thriving ecosystem of crypto arborists, leverage our robust utility,
            and cultivate wealth in a decentralized world with thick liquidity. Follow us on social platforms for updates!
          </p>
          <div
            style={{
              display: 'flex',
              gap: '15px',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            {[
              { href: 'https://app.turbos.finance/#/trade?input=0x2::sui::SUI&output=0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE', text: 'BUY $TREE', testid: 'link-buy-tree' },
              { href: 'https://x.com/thickquidity', text: 'X', testid: 'link-twitter' },
              { href: 'https://youtube.com/@thecryptoarborist', text: 'YouTube', testid: 'link-youtube' },
              { href: 'https://t.me/thickquidity', text: 'Telegram', testid: 'link-telegram' },
              { href: 'https://sui.io', text: 'SUI Network', testid: 'link-sui' },
              { href: 'https://dexscreener.com/sui/0xaa133ce1f8fd55d85b6fc87c1b3054cb717d83be477ef3635c661c21fbdfa0ee', text: 'Dexscreener', testid: 'link-dexscreener' },
            ].map((link) => (
              <a
                key={link.testid}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: 'clamp(10px, 2vw, 12px) clamp(20px, 3vw, 24px)',
                  border: '2px solid #00ff00',
                  background: 'transparent',
                  color: 'white',
                  fontSize: 'clamp(13px, 2.5vw, 16px)',
                  fontWeight: 'bold',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  transition: 'all 0.3s',
                  boxShadow: '0 0 10px #00ff00',
                  textTransform: 'uppercase',
                  fontFamily: 'Orbitron, sans-serif',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#00ff00';
                  e.currentTarget.style.color = '#000';
                  e.currentTarget.style.boxShadow = '0 0 25px #00ff00';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'white';
                  e.currentTarget.style.boxShadow = '0 0 10px #00ff00';
                }}
                data-testid={link.testid}
              >
                {link.text}
              </a>
            ))}
          </div>
        </div>
      </section>

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
        <p style={{ marginBottom: '10px', fontSize: 'clamp(14px, 2.5vw, 16px)' }}>
          © 2025 THICKQUIDITY ($TREE). All rights reserved.
        </p>
        <p style={{ marginBottom: '15px', fontSize: 'clamp(14px, 2.5vw, 16px)' }}>
          Growing the future of finance, one branch at a time.
        </p>
        <div
          style={{
            display: 'flex',
            gap: '15px',
            flexWrap: 'wrap',
            justifyContent: 'center',
            fontSize: 'clamp(13px, 2.3vw, 15px)',
          }}
        >
          {[
            { href: 'https://app.turbos.finance/#/trade?input=0x2::sui::SUI&output=0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE', text: 'BUY $TREE' },
            { href: 'https://x.com/thickquidity', text: 'X' },
            { href: 'https://youtube.com/@thecryptoarborist', text: 'YouTube' },
            { href: 'https://t.me/thickquidity', text: 'Telegram' },
            { href: 'https://sui.io', text: 'SUI Network' },
            { href: 'https://dexscreener.com/sui/0xaa133ce1f8fd55d85b6fc87c1b3054cb717d83be477ef3635c661c21fbdfa0ee', text: 'Dexscreener' },
          ].map((link, i) => (
            <a
              key={i}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#00ffcc',
                textDecoration: 'none',
                transition: 'all 0.3s',
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
              {link.text}
            </a>
          ))}
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '15px',
            fontSize: 'clamp(11px, 2vw, 13px)',
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
