import { Link } from 'wouter';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <div 
      className="min-h-screen flex flex-col text-white font-sans"
      style={{
        background: '#000',
        backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(0, 50, 0, 0.3) 0%, #000 100%)'
      }}
    >
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Logo */}
        <div className="mb-8">
          <img 
            src="/assets/tree.jpg" 
            alt="Battle Garden Logo" 
            className="rounded-full"
            style={{
              width: '200px',
              height: '200px',
              objectFit: 'cover',
              boxShadow: '0 0 40px #00ff00',
              border: '4px solid #00ff00'
            }}
            data-testid="img-logo"
          />
        </div>

        {/* Title */}
        <h1 
          className="text-4xl md:text-6xl font-bold mb-6 text-center"
          style={{
            color: '#00ff00',
            textShadow: '0 0 20px #00ff00',
            fontFamily: 'Orbitron, sans-serif'
          }}
          data-testid="text-title"
        >
          The Garden Battles
        </h1>

        {/* Navigation Buttons */}
        <div className="flex flex-col md:flex-row gap-4 mb-12">
          <Link href="/">
            <button
              className="px-8 py-3 text-lg font-sans transition-all duration-300"
              style={{
                border: '2px solid #00ff00',
                background: 'rgba(0, 100, 0, 0.3)',
                color: 'white',
                boxShadow: '0 0 15px #00ff00',
                borderRadius: '10px',
                fontFamily: 'Orbitron, sans-serif',
                minWidth: '150px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#00ff00';
                e.currentTarget.style.color = '#000';
                e.currentTarget.style.boxShadow = '0 0 30px #00ff00';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0, 100, 0, 0.3)';
                e.currentTarget.style.color = 'white';
                e.currentTarget.style.boxShadow = '0 0 15px #00ff00';
              }}
              data-testid="link-home"
            >
              Home
            </button>
          </Link>
          
          <a 
            href="https://sensational-bubblegum-fd9c7c.netlify.app/" 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <button
              className="px-8 py-3 text-lg font-sans transition-all duration-300"
              style={{
                border: '2px solid #00ff00',
                background: 'rgba(0, 100, 0, 0.3)',
                color: 'white',
                boxShadow: '0 0 15px #00ff00',
                borderRadius: '10px',
                fontFamily: 'Orbitron, sans-serif',
                minWidth: '150px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#00ff00';
                e.currentTarget.style.color = '#000';
                e.currentTarget.style.boxShadow = '0 0 30px #00ff00';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0, 100, 0, 0.3)';
                e.currentTarget.style.color = 'white';
                e.currentTarget.style.boxShadow = '0 0 15px #00ff00';
              }}
              data-testid="link-arboretum"
            >
              Arboretum
            </button>
          </a>
        </div>

        {/* Battle CTA */}
        <Link href="/battle">
          <button
            className="px-12 py-5 text-2xl font-bold uppercase mb-12 transition-all duration-300"
            style={{
              border: '3px solid #00ff00',
              background: 'linear-gradient(45deg, rgba(0, 100, 0, 0.7), rgba(0, 150, 0, 0.7))',
              color: 'white',
              boxShadow: '0 0 30px #00ff00',
              borderRadius: '15px',
              fontFamily: 'Orbitron, sans-serif'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#00ff00';
              e.currentTarget.style.color = '#000';
              e.currentTarget.style.boxShadow = '0 0 50px #00ff00';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(45deg, rgba(0, 100, 0, 0.7), rgba(0, 150, 0, 0.7))';
              e.currentTarget.style.color = 'white';
              e.currentTarget.style.boxShadow = '0 0 30px #00ff00';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            data-testid="button-enter-battle"
          >
            Enter The Garden Battle
          </button>
        </Link>

        {/* Info Panels */}
        <div className="grid md:grid-cols-3 gap-6 w-full max-w-6xl">
          {/* Mission */}
          <div 
            className="p-6 rounded-xl"
            style={{
              background: 'rgba(0, 50, 0, 0.5)',
              border: '2px solid #00ff00',
              boxShadow: '0 0 15px #00ff00'
            }}
          >
            <h3 
              className="text-xl font-bold mb-3"
              style={{
                color: '#00ff00',
                textShadow: '0 0 10px #00ff00',
                fontFamily: 'Orbitron, sans-serif'
              }}
            >
              Mission
            </h3>
            <p 
              className="text-sm leading-relaxed"
              style={{ color: '#00ffcc' }}
            >
              Battle your Sapling NFTs in strategic 1v1 turn-based combat. Watch your NFT evolve from seed to full tree as you gain Growth points.
            </p>
          </div>

          {/* Tokenomics */}
          <div 
            className="p-6 rounded-xl"
            style={{
              background: 'rgba(0, 50, 0, 0.5)',
              border: '2px solid #00ff00',
              boxShadow: '0 0 15px #00ff00'
            }}
          >
            <h3 
              className="text-xl font-bold mb-3"
              style={{
                color: '#00ff00',
                textShadow: '0 0 10px #00ff00',
                fontFamily: 'Orbitron, sans-serif'
              }}
            >
              Tokenomics
            </h3>
            <ul 
              className="text-sm space-y-1"
              style={{ color: '#00ffcc' }}
            >
              <li>Entry Fee: 3 SUI</li>
              <li>Winner Reward: 5 SUI</li>
              <li>30 Unique Abilities</li>
              <li>4 Evolution Stages</li>
            </ul>
          </div>

          {/* NFTs */}
          <div 
            className="p-6 rounded-xl"
            style={{
              background: 'rgba(0, 50, 0, 0.5)',
              border: '2px solid #00ff00',
              boxShadow: '0 0 15px #00ff00'
            }}
          >
            <h3 
              className="text-xl font-bold mb-3"
              style={{
                color: '#00ff00',
                textShadow: '0 0 10px #00ff00',
                fontFamily: 'Orbitron, sans-serif'
              }}
            >
              NFTrees
            </h3>
            <p 
              className="text-sm leading-relaxed"
              style={{ color: '#00ffcc' }}
            >
              Sapling NFTs unlock battle access and evolve visually as they grow. Seed → Sapling → Mature → Full Tree.
            </p>
          </div>
        </div>

        {/* Social Links */}
        <div className="mt-12">
          <p 
            className="text-sm mb-3 text-center"
            style={{ color: '#00ffcc' }}
          >
            Join the $TREE Forest
          </p>
          <div className="flex gap-4 justify-center">
            <a 
              href="https://x.com/thickquidity" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm hover:underline"
              style={{ color: '#00ff00' }}
            >
              X
            </a>
            <a 
              href="https://t.me/thickquidity" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm hover:underline"
              style={{ color: '#00ff00' }}
            >
              Telegram
            </a>
            <a 
              href="https://sui.io/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm hover:underline"
              style={{ color: '#00ff00' }}
            >
              SUI Network
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
