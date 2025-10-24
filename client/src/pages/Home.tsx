import { useState } from 'react';
import { Link } from 'wouter';

export default function Home() {
  const [bookletOpen, setBookletOpen] = useState(false);
  const [speechBubbleVisible, setSpeechBubbleVisible] = useState(false);
  const [currentPhrase, setCurrentPhrase] = useState(0);

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
            <Link
              href="/battle"
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
              data-testid="link-battle"
            >
              Battle
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
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.15)';
                e.currentTarget.style.boxShadow = '0 0 20px #34d399';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 0 15px rgba(52, 211, 153, 0.6), 0 0 30px rgba(52, 211, 153, 0.3)';
              }}
              data-testid="button-battle"
            >
              Play Battle Garden
            </Link>
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

      {/* Booklet Modal Placeholder */}
      {bookletOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.8)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'clamp(1rem, 3vw, 2rem)',
          }}
          onClick={() => setBookletOpen(false)}
        >
          <div
            style={{
              position: 'relative',
              width: 'clamp(300px, 90vw, 800px)',
              height: 'clamp(400px, 60vh, 600px)',
              background: 'linear-gradient(#1a4731, #276749)',
              border: '3px solid #d4a017',
              borderRadius: '10px',
              boxShadow: '0 0 20px rgba(52, 211, 153, 0.6)',
              padding: '2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontSize: 'clamp(1rem, 3vw, 1.5rem)', color: '#f7fafc', textAlign: 'center' }}>
              Litepaper content coming soon!
            </p>
            <button
              onClick={() => setBookletOpen(false)}
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
              data-testid="button-close-litepaper"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
