import { useState } from 'react';
import { Link } from 'wouter';

export default function Home() {
  const [speechBubbleVisible, setSpeechBubbleVisible] = useState(false);
  const [currentPhrase, setCurrentPhrase] = useState(0);
  const [arboretumModalOpen, setArboretumModalOpen] = useState(false);
  const [battleModalOpen, setBattleModalOpen] = useState(false);

  const phrases = [
    "Get your $TREE roots started!",
    "Based DEV!",
    "Join the $TREE forest now!"
  ];

  const handleHeroClick = () => {
    setSpeechBubbleVisible(true);
    setTimeout(() => setSpeechBubbleVisible(false), 2000);
    setCurrentPhrase((prev) => (prev + 1) % phrases.length);
  };

  return (
    <div
      style={{
        backgroundImage: 'url(/assets/background1.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat',
        color: '#f7fafc',
        fontFamily: 'Arial, sans-serif',
        margin: 0,
        padding: 0,
        minHeight: '100vh',
        overflowX: 'hidden',
        lineHeight: 1.6,
      }}
    >
      {/* Header - Centered with logo on top */}
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
            src="/assets/thick.png"
            alt="THICKQUIDITY Logo"
            style={{
              height: 'clamp(3rem, 10vw, 5rem)',
              maxWidth: '90%',
              filter: 'drop-shadow(0 0 10px #34d399)',
              marginBottom: '0.25rem',
            }}
            data-testid="logo-header"
          />
          <nav
            style={{
              display: 'flex',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <a
              href="#about"
              style={{
                color: '#f7fafc',
                textDecoration: 'none',
                margin: 'clamp(0.5rem, 1.5vw, 1rem)',
                fontWeight: 'bold',
                fontSize: 'clamp(0.8rem, 2.2vw, 1rem)',
                transition: 'color 0.3s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#34d399')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#f7fafc')}
              data-testid="link-about"
            >
              $TREE
            </a>
            <a
              href="#mission"
              style={{
                color: '#f7fafc',
                textDecoration: 'none',
                margin: 'clamp(0.5rem, 1.5vw, 1rem)',
                fontWeight: 'bold',
                fontSize: 'clamp(0.8rem, 2.2vw, 1rem)',
                transition: 'color 0.3s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#34d399')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#f7fafc')}
              data-testid="link-mission"
            >
              Mission
            </a>
            <a
              href="#tokenomics"
              style={{
                color: '#f7fafc',
                textDecoration: 'none',
                margin: 'clamp(0.5rem, 1.5vw, 1rem)',
                fontWeight: 'bold',
                fontSize: 'clamp(0.8rem, 2.2vw, 1rem)',
                transition: 'color 0.3s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#34d399')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#f7fafc')}
              data-testid="link-tokenomics"
            >
              Tokenomics
            </a>
            <a
              href="#nfts"
              style={{
                color: '#f7fafc',
                textDecoration: 'none',
                margin: 'clamp(0.5rem, 1.5vw, 1rem)',
                fontWeight: 'bold',
                fontSize: 'clamp(0.8rem, 2.2vw, 1rem)',
                transition: 'color 0.3s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#34d399')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#f7fafc')}
              data-testid="link-nfts"
            >
              NFTs
            </a>
            <a
              href="#social"
              style={{
                color: '#f7fafc',
                textDecoration: 'none',
                margin: 'clamp(0.5rem, 1.5vw, 1rem)',
                fontWeight: 'bold',
                fontSize: 'clamp(0.8rem, 2.2vw, 1rem)',
                transition: 'color 0.3s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#34d399')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#f7fafc')}
              data-testid="link-social"
            >
              Social
            </a>
            <Link
              href="/mint"
              style={{
                color: '#f7fafc',
                textDecoration: 'none',
                margin: 'clamp(0.5rem, 1.5vw, 1rem)',
                fontWeight: 'bold',
                fontSize: 'clamp(0.8rem, 2.2vw, 1rem)',
                transition: 'color 0.3s',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#34d399')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#f7fafc')}
              data-testid="link-arboretum"
            >
              Arboretum
            </Link>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setBattleModalOpen(true);
              }}
              style={{
                color: '#f7fafc',
                textDecoration: 'none',
                margin: 'clamp(0.5rem, 1.5vw, 1rem)',
                fontWeight: 'bold',
                fontSize: 'clamp(0.8rem, 2.2vw, 1rem)',
                transition: 'color 0.3s',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#34d399')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#f7fafc')}
              data-testid="link-battle"
            >
              Battle
            </a>
            <Link
              href="/mint"
              style={{
                color: '#f7fafc',
                textDecoration: 'none',
                margin: 'clamp(0.5rem, 1.5vw, 1rem)',
                fontWeight: 'bold',
                fontSize: 'clamp(0.8rem, 2.2vw, 1rem)',
                transition: 'color 0.3s',
              }}
              data-testid="link-mint"
            >
              Mint
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section
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
            src="/assets/thick.png"
            alt="THICKQUIDITY $TREE Logo"
            style={{
              maxWidth: '100%',
              height: 'auto',
              maxHeight: 'clamp(60px, 18vw, 100px)',
              margin: '0 auto clamp(1rem, 3vw, 1.5rem)',
              display: 'block',
              filter: 'drop-shadow(0 0 15px #34d399)',
            }}
            data-testid="img-hero-logo"
          />
          <p
            style={{
              fontSize: 'clamp(0.9rem, 2.8vw, 1.3rem)',
              marginBottom: 'clamp(1rem, 3vw, 2rem)',
              maxWidth: '600px',
              marginLeft: 'auto',
              marginRight: 'auto',
              color: '#4a2f2f',
              textShadow: '0 0 15px #1a4731, 0 0 25px rgba(52, 211, 153, 0.5), 2px 2px 5px rgba(0, 0, 0, 0.5)',
            }}
            data-testid="text-hero-description"
          >
            Planting the seeds to financial freedom with the water droplets of the SUI network.
            Join the $TREE movement, a fair launch token with robust utility and thick liquidity for a thriving DeFi ecosystem.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href="#join"
              style={{
                display: 'inline-block',
                background: 'linear-gradient(45deg, #34d399, #d4a017)',
                color: '#1a4731',
                padding: 'clamp(0.6rem, 1.8vw, 0.9rem) clamp(1.2rem, 2.8vw, 2rem)',
                borderRadius: '9999px',
                textDecoration: 'none',
                fontWeight: 'bold',
                fontSize: 'clamp(0.8rem, 2.2vw, 1.1rem)',
                transition: 'transform 0.3s, box-shadow 0.3s',
                boxShadow: '0 0 15px rgba(52, 211, 153, 0.6), 0 0 30px rgba(52, 211, 153, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.15)';
                e.currentTarget.style.boxShadow = '0 0 20px #34d399';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 0 15px rgba(52, 211, 153, 0.6), 0 0 30px rgba(52, 211, 153, 0.3)';
              }}
              data-testid="button-grow"
            >
              Grow with $TREE
            </a>
            <a
              href="https://app.turbos.finance/#/trade?input=0x2::sui::SUI&output=0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                background: 'linear-gradient(45deg, #34d399, #d4a017)',
                color: '#1a4731',
                padding: 'clamp(0.6rem, 1.8vw, 0.9rem) clamp(1.2rem, 2.8vw, 2rem)',
                borderRadius: '9999px',
                textDecoration: 'none',
                fontWeight: 'bold',
                fontSize: 'clamp(0.8rem, 2.2vw, 1.1rem)',
                transition: 'transform 0.3s, box-shadow 0.3s',
                boxShadow: '0 0 15px rgba(52, 211, 153, 0.6), 0 0 30px rgba(52, 211, 153, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.15)';
                e.currentTarget.style.boxShadow = '0 0 20px #34d399';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 0 15px rgba(52, 211, 153, 0.6), 0 0 30px rgba(52, 211, 153, 0.3)';
              }}
              data-testid="button-buy-tree"
            >
              Buy $TREE!
            </a>
          </div>
        </div>
      </section>

      {/* About $TREE Section */}
      <section
        id="about"
        style={{
          padding: 'clamp(2rem, 6vw, 4rem) clamp(0.8rem, 4vw, 1.5rem)',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: 'clamp(0.8rem, 2.5vw, 1.5rem)',
            background: 'rgba(26, 71, 49, 0.8)',
            borderRadius: '1rem',
            position: 'relative',
            border: '2px solid rgba(52, 211, 153, 0.3)',
          }}
        >
          <h2
            style={{
              fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
              textAlign: 'center',
              marginBottom: 'clamp(1rem, 3vw, 2rem)',
              textShadow: '0 0 10px #1a4731',
              color: '#f7fafc',
            }}
            data-testid="heading-about"
          >
            About $TREE
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(250px, 100%), 1fr))',
              gap: 'clamp(0.8rem, 2.5vw, 1.5rem)',
            }}
          >
            <div>
              <p style={{ marginBottom: 'clamp(0.8rem, 2vw, 1rem)', fontSize: 'clamp(0.8rem, 2.2vw, 0.9rem)' }}>
                $TREE, powered by THICKQUIDITY on the SUI blockchain, is a fair launch token designed for utility and growth.
                Inspired by the resilience of ancient forests, we aim to foster financial prosperity, ecosystem stability,
                and sustainable wealth creation with thick liquidity to support long-term growth.
              </p>
              <p style={{ marginBottom: 'clamp(0.8rem, 2vw, 1rem)', fontSize: 'clamp(0.8rem, 2.2vw, 0.9rem)' }}>
                Built on the SUI network's high-speed, low-cost infrastructure, $TREE combines purpose with potential.
                Whether you're a crypto sapling or a seasoned arborist, THICKQUIDITY invites you to stake your $TREE
                and grow with us toward a greener financial future with robust project utility. Stake your TREE on moonbags.io, and Turbos.finance
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(0.6rem, 1.8vw, 0.8rem)' }}>
              <div
                style={{
                  background: '#276749',
                  padding: 'clamp(0.6rem, 1.8vw, 0.9rem)',
                  borderRadius: '0.5rem',
                  textAlign: 'center',
                }}
              >
                <h3 style={{ fontSize: 'clamp(1rem, 2.8vw, 1.3rem)', color: '#d4a017' }}>1B</h3>
                <p style={{ fontSize: 'clamp(0.8rem, 2.2vw, 0.9rem)' }}>Total $TREE Supply</p>
              </div>
              <div
                style={{
                  background: '#276749',
                  padding: 'clamp(0.6rem, 1.8vw, 0.9rem)',
                  borderRadius: '0.5rem',
                  textAlign: 'center',
                }}
              >
                <h3 style={{ fontSize: 'clamp(1rem, 2.8vw, 1.3rem)', color: '#d4a017' }}>NFTrees</h3>
                <Link href="/mint" style={{ fontSize: 'clamp(0.8rem, 2.2vw, 0.9rem)', color: '#34d399', textDecoration: 'none', fontWeight: 'bold', cursor: 'pointer' }}>Utility NFTrees: Live Now!</Link>
              </div>
              <div
                style={{
                  background: '#276749',
                  padding: 'clamp(0.6rem, 1.8vw, 0.9rem)',
                  borderRadius: '0.5rem',
                  textAlign: 'center',
                }}
              >
                <h3 style={{ fontSize: 'clamp(1rem, 2.8vw, 1.3rem)', color: '#d4a017' }}>SUI-Powered</h3>
                <p style={{ fontSize: 'clamp(0.8rem, 2.2vw, 0.9rem)' }}>Fast, Scalable Blockchain</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section
        id="mission"
        style={{
          padding: 'clamp(2rem, 6vw, 4rem) clamp(0.8rem, 4vw, 1.5rem)',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <h2
          style={{
            fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
            textAlign: 'center',
            marginBottom: 'clamp(1rem, 3vw, 2rem)',
            textShadow: '0 0 10px #1a4731',
            color: '#f7fafc',
          }}
          data-testid="heading-mission"
        >
          Our Mission
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))',
            gap: 'clamp(0.8rem, 2.5vw, 1.5rem)',
            maxWidth: '1200px',
            margin: '0 auto',
          }}
        >
          <div
            style={{
              padding: 'clamp(0.8rem, 2.5vw, 1.5rem)',
              background: 'linear-gradient(#276749, #1a4731)',
              borderRadius: '0.75rem',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <h3 style={{ fontSize: 'clamp(1.2rem, 3vw, 1.5rem)', marginBottom: 'clamp(0.6rem, 1.8vw, 1rem)', color: '#d4a017' }}>
              Growth
            </h3>
            <p style={{ fontSize: 'clamp(0.8rem, 2.2vw, 0.9rem)' }}>
              Empower financial prosperity through innovative DeFi solutions and project utility on the SUI chain.
              $TREE holders can stake, trade, and grow their wealth with cutting-edge tools and thick liquidity.
            </p>
          </div>
          <div
            style={{
              padding: 'clamp(0.8rem, 2.5vw, 1.5rem)',
              background: 'linear-gradient(#276749, #1a4731)',
              borderRadius: '0.75rem',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <h3 style={{ fontSize: 'clamp(1.2rem, 3vw, 1.5rem)', marginBottom: 'clamp(0.6rem, 1.8vw, 1rem)', color: '#d4a017' }}>
              Ecosystem
            </h3>
            <p style={{ fontSize: 'clamp(0.8rem, 2.2vw, 0.9rem)' }}>
              Build a robust ecosystem where $TREE's thick liquidity ensures stability and growth.
              Our fair launch approach fosters collaboration and shared success for all members.
            </p>
          </div>
          <div
            style={{
              padding: 'clamp(0.8rem, 2.5vw, 1.5rem)',
              background: 'linear-gradient(#276749, #1a4731)',
              borderRadius: '0.75rem',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <h3 style={{ fontSize: 'clamp(1.2rem, 3vw, 1.5rem)', marginBottom: 'clamp(0.6rem, 1.8vw, 1rem)', color: '#d4a017' }}>
              Sustainability
            </h3>
            <p style={{ fontSize: 'clamp(0.8rem, 2.2vw, 0.9rem)' }}>
              Ensure long-term wealth with secure, transparent blockchain technology.
              Our roots are built to last, supporting a thriving future with strong project utility.
            </p>
          </div>
        </div>
      </section>

      {/* Tokenomics Section */}
      <section
        id="tokenomics"
        style={{
          padding: 'clamp(2rem, 6vw, 4rem) clamp(0.8rem, 4vw, 1.5rem)',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: 'clamp(0.8rem, 2.5vw, 1.5rem)',
            background: 'rgba(26, 71, 49, 0.8)',
            borderRadius: '1rem',
            position: 'relative',
            border: '2px solid rgba(52, 211, 153, 0.3)',
          }}
        >
          <h2
            style={{
              fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
              textAlign: 'center',
              marginBottom: 'clamp(1rem, 3vw, 2rem)',
              textShadow: '0 0 10px #1a4731',
              color: '#f7fafc',
            }}
            data-testid="heading-tokenomics"
          >
            Tokenomics of $TREE
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))',
              gap: 'clamp(0.8rem, 2.5vw, 1.5rem)',
            }}
          >
            <div
              style={{
                padding: 'clamp(0.8rem, 2vw, 1.2rem)',
                background: '#276749',
                borderRadius: '0.75rem',
                textAlign: 'center',
              }}
            >
              <h3 style={{ fontSize: 'clamp(1rem, 2.8vw, 1.3rem)', color: '#d4a017', marginBottom: 'clamp(0.4rem, 1.2vw, 0.6rem)' }}>
                Total Supply
              </h3>
              <p style={{ fontSize: 'clamp(0.8rem, 2.2vw, 0.9rem)' }}>
                1,000,000,000 $TREE tokens, ensuring a robust foundation for ecosystem growth.
              </p>
            </div>
            <div
              style={{
                padding: 'clamp(0.8rem, 2vw, 1.2rem)',
                background: '#276749',
                borderRadius: '0.75rem',
                textAlign: 'center',
              }}
            >
              <h3 style={{ fontSize: 'clamp(1rem, 2.8vw, 1.3rem)', color: '#d4a017', marginBottom: 'clamp(0.4rem, 1.2vw, 0.6rem)' }}>
                NFTrees
              </h3>
              <p style={{ fontSize: 'clamp(0.8rem, 2.2vw, 0.9rem)' }}>
                <Link href="/mint" style={{ color: '#34d399', textDecoration: 'underline', fontWeight: 'bold', cursor: 'pointer' }}>Utility NFTrees: Live Now!</Link>
              </p>
            </div>
            <div
              style={{
                padding: 'clamp(0.8rem, 2vw, 1.2rem)',
                background: '#276749',
                borderRadius: '0.75rem',
                textAlign: 'center',
              }}
            >
              <h3 style={{ fontSize: 'clamp(1rem, 2.8vw, 1.3rem)', color: '#d4a017', marginBottom: 'clamp(0.4rem, 1.2vw, 0.6rem)' }}>
                Staking Rewards
              </h3>
              <p style={{ fontSize: 'clamp(0.8rem, 2.2vw, 0.9rem)' }}>
                Earn passive income by staking $TREE in our DeFi pools on SUI.
              </p>
            </div>
            <div
              style={{
                padding: 'clamp(0.8rem, 2vw, 1.2rem)',
                background: '#276749',
                borderRadius: '0.75rem',
                textAlign: 'center',
              }}
            >
              <h3 style={{ fontSize: 'clamp(1rem, 2.8vw, 1.3rem)', color: '#d4a017', marginBottom: 'clamp(0.4rem, 1.2vw, 0.6rem)' }}>
                Fair Launch
              </h3>
              <p style={{ fontSize: 'clamp(0.8rem, 2.2vw, 0.9rem)' }}>
                Launched off moonbags.io, focused on utility and thick liquidity for sustained growth.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* NFTs Section */}
      <section
        id="nfts"
        style={{
          padding: 'clamp(2rem, 6vw, 4rem) clamp(0.8rem, 4vw, 1.5rem)',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div
          style={{
            textAlign: 'center',
            maxWidth: '1200px',
            margin: '0 auto',
            padding: 'clamp(0.8rem, 2.5vw, 1.5rem)',
            background: 'rgba(26, 71, 49, 0.8)',
            borderRadius: '1rem',
            position: 'relative',
            border: '2px solid rgba(52, 211, 153, 0.3)',
          }}
        >
          <img
            src="/assets/tree.jpg"
            alt="$TREE NFT Preview"
            style={{
              maxWidth: '100%',
              height: 'auto',
              maxHeight: 'clamp(50px, 15vw, 80px)',
              margin: '0 auto clamp(1rem, 3vw, 1.5rem)',
              display: 'block',
              filter: 'drop-shadow(0 0 15px #34d399)',
            }}
            data-testid="img-nft-preview"
          />
          <h2
            style={{
              fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
              textAlign: 'center',
              marginBottom: 'clamp(1rem, 3vw, 2rem)',
              textShadow: '0 0 10px #1a4731',
              color: '#f7fafc',
            }}
            data-testid="heading-nfts"
          >
            $TREE NFTs
          </h2>
          <p style={{ fontSize: 'clamp(0.8rem, 2.2vw, 0.9rem)', marginBottom: 'clamp(0.8rem, 2vw, 1rem)', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
            $TREE NFTs unlock monthly SUI airdrops from staking pools, funded by developers, with 80% of sales fueling $TREE buybacks for locked liquidity. 5% will be donated to treefund.org and be livestreamed on Youtube, with reciept for verification.
          </p>
          <p style={{ fontSize: 'clamp(0.8rem, 2.2vw, 0.9rem)', marginBottom: 'clamp(0.8rem, 2vw, 1rem)', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
            Gain access to explosive gaming opportunities as a holder, and unlock ongoing ecosystem benefits. Crafted with stunning worldly tree designs and arborist-inspired details, 5% of every sale supports treefund.org, donated live on The Crypto Arborist's YouTube. <Link href="/battle" style={{ color: '#34d399', fontWeight: 'bold', textDecoration: 'underline', cursor: 'pointer' }}>The Battle Garden is now LIVE!</Link>
          </p>
          <div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
            <Link
              href="/mint"
              style={{
                display: 'inline-block',
                background: 'linear-gradient(45deg, #34d399, #d4a017)',
                color: '#1a4731',
                padding: 'clamp(0.6rem, 1.8vw, 0.9rem) clamp(1.2rem, 2.8vw, 2rem)',
                borderRadius: '9999px',
                textDecoration: 'none',
                fontWeight: 'bold',
                fontSize: 'clamp(0.8rem, 2.2vw, 1.1rem)',
                transition: 'transform 0.3s, box-shadow 0.3s',
                boxShadow: '0 0 15px rgba(52, 211, 153, 0.6), 0 0 30px rgba(52, 211, 153, 0.3)',
                cursor: 'pointer',
              }}
              data-testid="button-nft-mint"
            >
              Mint NFT (25 SUI)
            </Link>
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
                transition: 'transform 0.3s, box-shadow 0.3s',
                boxShadow: '0 0 15px rgba(52, 211, 153, 0.6), 0 0 30px rgba(52, 211, 153, 0.3)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.15)';
                e.currentTarget.style.boxShadow = '0 0 20px #34d399';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 0 15px rgba(52, 211, 153, 0.6), 0 0 30px rgba(52, 211, 153, 0.3)';
              }}
              data-testid="button-nft-battle"
            >
              Play Battle Garden
            </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Social Section */}
      <section
        id="social"
        style={{
          padding: 'clamp(2rem, 6vw, 4rem) clamp(0.8rem, 4vw, 1.5rem)',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div
          style={{
            textAlign: 'center',
            maxWidth: '1200px',
            margin: '0 auto',
            padding: 'clamp(0.8rem, 2.5vw, 1.5rem)',
            background: 'rgba(26, 71, 49, 0.8)',
            borderRadius: '1rem',
            position: 'relative',
            border: '2px solid rgba(52, 211, 153, 0.3)',
          }}
        >
          <h2
            style={{
              fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
              textAlign: 'center',
              marginBottom: 'clamp(1rem, 3vw, 2rem)',
              textShadow: '0 0 10px #1a4731',
              color: '#f7fafc',
            }}
            data-testid="heading-social"
          >
            Social Outreach Utility
          </h2>
          <p style={{ fontSize: 'clamp(0.8rem, 2.2vw, 0.9rem)', marginBottom: 'clamp(0.8rem, 2vw, 1rem)', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto' }}>
            Join @thecryptoarborist on YouTube for explosive $TREE content, diving deep into the DeFi ecosystem, SUI blockchain, and the growth of the $TREE universe.
            The Crypto Arborist collaborates with team members across various projects to expand our reach and cultivate a thriving community through engaging discussions and insights.
          </p>
        </div>
      </section>

      {/* Join Section */}
      <section
        id="join"
        style={{
          padding: 'clamp(2rem, 6vw, 4rem) clamp(0.8rem, 4vw, 1.5rem)',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: 'clamp(0.8rem, 2.5vw, 1.5rem)',
            background: 'rgba(26, 71, 49, 0.8)',
            borderRadius: '1rem',
            position: 'relative',
            border: '2px solid rgba(52, 211, 153, 0.3)',
          }}
        >
          <h2
            style={{
              fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
              textAlign: 'center',
              marginBottom: 'clamp(1rem, 3vw, 2rem)',
              textShadow: '0 0 10px #1a4731',
              color: '#f7fafc',
            }}
            data-testid="heading-join"
          >
            Join the $TREE Forest
          </h2>
          <p style={{ fontSize: 'clamp(0.8rem, 2.2vw, 0.9rem)', marginBottom: 'clamp(1rem, 3vw, 2rem)', textAlign: 'center' }}>
            Stake your $TREE in the SUI network and watch your financial freedom blossom.
            Connect with our thriving ecosystem of crypto arborists, leverage our robust utility,
            and cultivate wealth in a decentralized world with thick liquidity. Follow us on social platforms for updates!
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(0.8rem, 2vw, 1.2rem)', flexWrap: 'wrap' }}>
            <a
              href="https://app.turbos.finance/#/trade?input=0x2::sui::SUI&output=0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                background: 'linear-gradient(45deg, #34d399, #d4a017)',
                color: '#1a4731',
                padding: 'clamp(0.6rem, 1.8vw, 0.9rem) clamp(1.2rem, 2.8vw, 2rem)',
                borderRadius: '9999px',
                textDecoration: 'none',
                fontWeight: 'bold',
                fontSize: 'clamp(0.8rem, 2.2vw, 1.1rem)',
                transition: 'transform 0.3s, box-shadow 0.3s',
                boxShadow: '0 0 15px rgba(52, 211, 153, 0.6), 0 0 30px rgba(52, 211, 153, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 0 15px #34d399';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 0 15px rgba(52, 211, 153, 0.6), 0 0 30px rgba(52, 211, 153, 0.3)';
              }}
              data-testid="button-buy"
            >
              BUY $TREE
            </a>
            <a
              href="https://x.com/thickquidity"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                background: 'linear-gradient(45deg, #34d399, #d4a017)',
                color: '#1a4731',
                padding: 'clamp(0.6rem, 1.8vw, 0.9rem) clamp(1.2rem, 2.8vw, 2rem)',
                borderRadius: '9999px',
                textDecoration: 'none',
                fontWeight: 'bold',
                fontSize: 'clamp(0.8rem, 2.2vw, 1.1rem)',
                transition: 'transform 0.3s, box-shadow 0.3s',
                boxShadow: '0 0 15px rgba(52, 211, 153, 0.6), 0 0 30px rgba(52, 211, 153, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 0 15px #34d399';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 0 15px rgba(52, 211, 153, 0.6), 0 0 30px rgba(52, 211, 153, 0.3)';
              }}
              data-testid="button-x"
            >
              X
            </a>
            <a
              href="https://youtube.com/@thecryptoarborist"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                background: 'linear-gradient(45deg, #34d399, #d4a017)',
                color: '#1a4731',
                padding: 'clamp(0.6rem, 1.8vw, 0.9rem) clamp(1.2rem, 2.8vw, 2rem)',
                borderRadius: '9999px',
                textDecoration: 'none',
                fontWeight: 'bold',
                fontSize: 'clamp(0.8rem, 2.2vw, 1.1rem)',
                transition: 'transform 0.3s, box-shadow 0.3s',
                boxShadow: '0 0 15px rgba(52, 211, 153, 0.6), 0 0 30px rgba(52, 211, 153, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 0 15px #34d399';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 0 15px rgba(52, 211, 153, 0.6), 0 0 30px rgba(52, 211, 153, 0.3)';
              }}
              data-testid="button-youtube"
            >
              YouTube
            </a>
            <a
              href="https://t.me/thickquidity"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                background: 'linear-gradient(45deg, #34d399, #d4a017)',
                color: '#1a4731',
                padding: 'clamp(0.6rem, 1.8vw, 0.9rem) clamp(1.2rem, 2.8vw, 2rem)',
                borderRadius: '9999px',
                textDecoration: 'none',
                fontWeight: 'bold',
                fontSize: 'clamp(0.8rem, 2.2vw, 1.1rem)',
                transition: 'transform 0.3s, box-shadow 0.3s',
                boxShadow: '0 0 15px rgba(52, 211, 153, 0.6), 0 0 30px rgba(52, 211, 153, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 0 15px #34d399';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 0 15px rgba(52, 211, 153, 0.6), 0 0 30px rgba(52, 211, 153, 0.3)';
              }}
              data-testid="button-telegram"
            >
              Telegram
            </a>
            <a
              href="https://sui.io"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                background: 'linear-gradient(45deg, #34d399, #d4a017)',
                color: '#1a4731',
                padding: 'clamp(0.6rem, 1.8vw, 0.9rem) clamp(1.2rem, 2.8vw, 2rem)',
                borderRadius: '9999px',
                textDecoration: 'none',
                fontWeight: 'bold',
                fontSize: 'clamp(0.8rem, 2.2vw, 1.1rem)',
                transition: 'transform 0.3s, box-shadow 0.3s',
                boxShadow: '0 0 15px rgba(52, 211, 153, 0.6), 0 0 30px rgba(52, 211, 153, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 0 15px #34d399';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 0 15px rgba(52, 211, 153, 0.6), 0 0 30px rgba(52, 211, 153, 0.3)';
              }}
              data-testid="button-sui"
            >
              SUI Network
            </a>
            <a
              href="https://dexscreener.com/sui/0xaa133ce1f8fd55d85b6fc87c1b3054cb717d83be477ef3635c661c21fbdfa0ee"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                background: 'linear-gradient(45deg, #34d399, #d4a017)',
                color: '#1a4731',
                padding: 'clamp(0.6rem, 1.8vw, 0.9rem) clamp(1.2rem, 2.8vw, 2rem)',
                borderRadius: '9999px',
                textDecoration: 'none',
                fontWeight: 'bold',
                fontSize: 'clamp(0.8rem, 2.2vw, 1.1rem)',
                transition: 'transform 0.3s, box-shadow 0.3s',
                boxShadow: '0 0 15px rgba(52, 211, 153, 0.6), 0 0 30px rgba(52, 211, 153, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 0 15px #34d399';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 0 15px rgba(52, 211, 153, 0.6), 0 0 30px rgba(52, 211, 153, 0.3)';
              }}
              data-testid="button-dexscreener"
            >
              Dexscreener
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          padding: 'clamp(1.5rem, 4vw, 2.5rem) clamp(0.8rem, 3vw, 1.5rem)',
          background: 'linear-gradient(#1a4731, #276749)',
          textAlign: 'center',
          zIndex: 2,
          position: 'relative',
        }}
      >
        <p style={{ fontSize: 'clamp(0.8rem, 2.2vw, 1rem)', marginBottom: 'clamp(0.6rem, 1.8vw, 1rem)', color: '#f7fafc' }}>
          © 2025 THICKQUIDITY ($TREE). All rights reserved.
        </p>
        <p style={{ fontSize: 'clamp(0.8rem, 2.2vw, 1rem)', marginBottom: 'clamp(0.6rem, 1.8vw, 1rem)', color: '#f7fafc' }}>
          Growing the future of finance, one branch at a time.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(0.8rem, 2.5vw, 1.5rem)', marginTop: 'clamp(0.8rem, 2vw, 1.2rem)', flexWrap: 'wrap' }}>
          <a
            href="https://app.turbos.finance/#/trade?input=0x2::sui::SUI&output=0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#f7fafc',
              textDecoration: 'none',
              fontSize: 'clamp(0.8rem, 2.2vw, 1rem)',
              transition: 'color 0.3s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#d4a017')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#f7fafc')}
          >
            BUY $TREE
          </a>
          <a
            href="https://x.com/thickquidity"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#f7fafc',
              textDecoration: 'none',
              fontSize: 'clamp(0.8rem, 2.2vw, 1rem)',
              transition: 'color 0.3s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#d4a017')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#f7fafc')}
          >
            X
          </a>
          <a
            href="https://youtube.com/@thecryptoarborist"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#f7fafc',
              textDecoration: 'none',
              fontSize: 'clamp(0.8rem, 2.2vw, 1rem)',
              transition: 'color 0.3s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#d4a017')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#f7fafc')}
          >
            YouTube
          </a>
          <a
            href="https://t.me/thickquidity"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#f7fafc',
              textDecoration: 'none',
              fontSize: 'clamp(0.8rem, 2.2vw, 1rem)',
              transition: 'color 0.3s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#d4a017')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#f7fafc')}
          >
            Telegram
          </a>
          <a
            href="https://sui.io"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#f7fafc',
              textDecoration: 'none',
              fontSize: 'clamp(0.8rem, 2.2vw, 1rem)',
              transition: 'color 0.3s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#d4a017')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#f7fafc')}
          >
            SUI Network
          </a>
          <a
            href="https://dexscreener.com/sui/0xaa133ce1f8fd55d85b6fc87c1b3054cb717d83be477ef3635c661c21fbdfa0ee"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#f7fafc',
              textDecoration: 'none',
              fontSize: 'clamp(0.8rem, 2.2vw, 1rem)',
              transition: 'color 0.3s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#d4a017')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#f7fafc')}
          >
            Dexscreener
          </a>
        </div>
      </footer>

      {/* Hero Character */}
      <div
        onClick={handleHeroClick}
        style={{
          position: 'fixed',
          bottom: 0,
          right: 'clamp(10px, 3vw, 20px)',
          zIndex: 3,
          cursor: 'pointer',
        }}
      >
        <img
          src="/assets/hero.png"
          alt="THICKQUIDITY Hero Character"
          style={{
            width: 'clamp(60px, 15vw, 100px)',
            height: 'auto',
            display: 'block',
            transition: 'transform 0.3s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          data-testid="img-hero-character"
        />
        <div
          style={{
            position: 'absolute',
            bottom: 'clamp(80px, 20vw, 120px)',
            right: 'clamp(90px, 22vw, 140px)',
            background: '#34d399',
            color: '#1a4731',
            padding: 'clamp(8px, 2vw, 12px) clamp(12px, 3vw, 15px)',
            borderRadius: '15px',
            fontSize: 'clamp(0.7rem, 2vw, 0.9rem)',
            fontWeight: 'bold',
            width: 'clamp(100px, 25vw, 140px)',
            textAlign: 'center',
            opacity: speechBubbleVisible ? 1 : 0,
            transform: speechBubbleVisible ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 0.3s ease, transform 0.3s ease',
            pointerEvents: 'none',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
            border: '2px solid #1a4731',
          }}
          data-testid="speech-bubble"
        >
          {phrases[currentPhrase]}
        </div>
      </div>

            {/* Arboretum Coming Soon Modal */}
            {arboretumModalOpen && (
        <div
          onClick={() => setArboretumModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'clamp(1rem, 3vw, 2rem)',
            overflow: 'auto',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: 'clamp(300px, 90vw, 600px)',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'linear-gradient(#1a4731, #276749)',
              border: '3px solid #d4a017',
              borderRadius: '10px',
              boxShadow: '0 0 20px rgba(52, 211, 153, 0.6)',
              padding: 'clamp(2rem, 5vw, 3rem)',
              textAlign: 'center',
            }}
          >
            <h2
              style={{
                fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
                color: '#d4a017',
                marginBottom: 'clamp(1rem, 3vw, 1.5rem)',
                textShadow: '0 0 10px rgba(212, 160, 23, 0.5)',
              }}
            >
              The Arboretum
            </h2>
            <Link
              href="/mint"
              style={{
                fontSize: 'clamp(1.2rem, 3vw, 1.5rem)',
                color: '#34d399',
                marginBottom: 'clamp(1rem, 3vw, 1.5rem)',
                display: 'inline-block',
                textDecoration: 'underline',
                fontWeight: 'bold',
              }}
              onClick={() => setArboretumModalOpen(false)}
            >
              Mint your Sapling NFT to Enter
            </Link>
            <p
              style={{
                fontSize: 'clamp(0.9rem, 2.2vw, 1rem)',
                color: '#f7fafc',
                marginBottom: 'clamp(1.5rem, 4vw, 2rem)',
                lineHeight: '1.6',
              }}
            >
              The Arboretum is your gateway to explore, collect, and nurture your NFT forest. 
              Mint your unique Sapling now to unlock exclusive features and community-driven growth!
            </p>
            <button
              onClick={() => setArboretumModalOpen(false)}
              style={{
                background: 'linear-gradient(45deg, #34d399, #d4a017)',
                color: '#1a4731',
                padding: 'clamp(0.6rem, 1.8vw, 0.8rem) clamp(1.2rem, 2.8vw, 2rem)',
                borderRadius: '9999px',
                border: 'none',
                fontWeight: 'bold',
                fontSize: 'clamp(0.8rem, 2.2vw, 1rem)',
                cursor: 'pointer',
                transition: 'transform 0.3s, box-shadow 0.3s',
                boxShadow: '0 0 15px rgba(52, 211, 153, 0.6)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.boxShadow = '0 0 20px #34d399';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 0 15px rgba(52, 211, 153, 0.6)';
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
                background: '#1a4731',
                color: '#d4a017',
                borderRadius: '50%',
                border: 'none',
                fontSize: 'clamp(1rem, 2.5vw, 1.2rem)',
                cursor: 'pointer',
                transition: 'transform 0.3s, box-shadow 0.3s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.2)';
                e.currentTarget.style.boxShadow = '0 0 15px #34d399';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '';
              }}
              data-testid="button-close-arboretum-x"
            >
              X
            </button>
          </div>
        </div>
      )}

      {/* Battle Coming Soon Modal */}
      {battleModalOpen && (
        <div
          onClick={() => setBattleModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'clamp(1rem, 3vw, 2rem)',
            overflow: 'auto',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: 'clamp(300px, 90vw, 600px)',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'linear-gradient(#1a4731, #276749)',
              border: '3px solid #d4a017',
              borderRadius: '10px',
              boxShadow: '0 0 20px rgba(52, 211, 153, 0.6)',
              padding: 'clamp(2rem, 5vw, 3rem)',
              textAlign: 'center',
            }}
          >
            <h2
              style={{
                fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
                color: '#d4a017',
                marginBottom: 'clamp(1rem, 3vw, 1.5rem)',
                textShadow: '0 0 10px rgba(212, 160, 23, 0.5)',
              }}
            >
              Battle Garden
            </h2>
            <Link
              href="/battle"
              style={{
                fontSize: 'clamp(1rem, 2.5vw, 1.2rem)',
                color: '#f7fafc',
                marginBottom: 'clamp(1.5rem, 4vw, 2rem)',
                lineHeight: '1.6',
                display: 'inline-block',
                textDecoration: 'underline',
                textUnderlineOffset: '0.2em',
                textDecorationColor: '#d4a017',
              }}
            >
              Battle Garden (Nov 2025) - Click to Enter
            </Link>
            <p
              style={{
                fontSize: 'clamp(0.9rem, 2.2vw, 1rem)',
                color: '#34d399',
                marginBottom: 'clamp(1.5rem, 4vw, 2rem)',
                lineHeight: '1.6',
              }}
            >
              The Battle Garden will allow holders of NFTrees to battle each other for SUI rewards!
              Stay tuned for exclusive features, enhanced mechanics, and community-driven gameplay!
            </p>
            <button
              onClick={() => setBattleModalOpen(false)}
              style={{
                background: 'linear-gradient(45deg, #34d399, #d4a017)',
                color: '#1a4731',
                padding: 'clamp(0.6rem, 1.8vw, 0.8rem) clamp(1.2rem, 2.8vw, 2rem)',
                borderRadius: '9999px',
                border: 'none',
                fontWeight: 'bold',
                fontSize: 'clamp(0.8rem, 2.2vw, 1rem)',
                cursor: 'pointer',
                transition: 'transform 0.3s, box-shadow 0.3s',
                boxShadow: '0 0 15px rgba(52, 211, 153, 0.6)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.boxShadow = '0 0 20px #34d399';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 0 15px rgba(52, 211, 153, 0.6)';
              }}
              data-testid="button-close-battle"
            >
              Got it!
            </button>
            <button
              onClick={() => setBattleModalOpen(false)}
              style={{
                position: 'absolute',
                top: 'clamp(10px, 2vw, 15px)',
                right: 'clamp(10px, 2vw, 15px)',
                width: 'clamp(30px, 8vw, 40px)',
                height: 'clamp(30px, 8vw, 40px)',
                background: '#1a4731',
                color: '#d4a017',
                borderRadius: '50%',
                border: 'none',
                fontSize: 'clamp(1rem, 2.5vw, 1.2rem)',
                cursor: 'pointer',
                transition: 'transform 0.3s, box-shadow 0.3s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.2)';
                e.currentTarget.style.boxShadow = '0 0 15px #34d399';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '';
              }}
              data-testid="button-close-battle-x"
            >
              X
            </button>
          </div>
        </div>
      )}
    </div>
  );
}