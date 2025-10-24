import { useState } from 'react';
import { Link } from 'wouter';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BattleDialog from '@/components/BattleDialog';

export default function Home() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState('');

  return (
    <div 
      className="min-h-screen flex flex-col text-white font-sans"
      style={{
        backgroundImage: 'url(/assets/background1.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
        backgroundColor: '#000'
      }}
    >
      <Header />

      <main className="flex-1 flex flex-col items-center px-4 py-8">
        {/* Title Image */}
        <div className="w-full max-w-2xl mb-8">
          <img 
            src="/assets/backgrounda.jpg" 
            alt="The Garden Battles Title" 
            className="w-full h-auto rounded-xl explode-shrink"
            style={{
              boxShadow: '0 0 30px #00ff00',
              border: '3px solid #00ff00'
            }}
            data-testid="img-title"
          />
        </div>

        {/* CTA Button */}
        <Link href="/battle">
          <button
            className="px-8 md:px-12 py-4 md:py-5 text-lg md:text-xl font-bold uppercase mb-12 shake transition-all duration-300"
            style={{
              border: '3px solid #00ff00',
              background: 'linear-gradient(45deg, rgba(0, 100, 0, 0.7), rgba(0, 150, 0, 0.7))',
              color: 'white',
              boxShadow: '0 0 20px #00ff00, 0 0 10px #000000',
              borderRadius: '12px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#00ff00';
              e.currentTarget.style.color = '#000';
              e.currentTarget.style.boxShadow = '0 0 40px #00ff00, 0 0 20px #000000';
              e.currentTarget.style.transform = 'scale(1.05) translateY(-3px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(45deg, rgba(0, 100, 0, 0.7), rgba(0, 150, 0, 0.7))';
              e.currentTarget.style.color = 'white';
              e.currentTarget.style.boxShadow = '0 0 20px #00ff00, 0 0 10px #000000';
              e.currentTarget.style.transform = 'scale(1) translateY(0)';
            }}
            data-testid="button-enter-battle"
          >
            Enter The Garden Battle
          </button>
        </Link>

        {/* Info Sections */}
        <div className="grid md:grid-cols-2 gap-8 w-full max-w-5xl">
          {/* What is The Garden Battles? */}
          <div 
            className="p-6 md:p-8 rounded-2xl"
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
              What is The Garden Battles?
            </h2>
            <p 
              className="text-base md:text-lg leading-relaxed"
              style={{ color: '#00ffcc' }}
            >
              The Garden Battles is a blockchain-based NFT battle game where players compete in strategic 1v1 
              turn-based combat. Watch your Sapling NFT evolve from a tiny seed to a mighty tree as you gain 
              Growth points through battle. Powered by the Sui blockchain for secure, transparent gameplay.
            </p>
          </div>

          {/* How to Play */}
          <div 
            className="p-6 md:p-8 rounded-2xl"
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
            <ol 
              className="list-decimal ml-6 space-y-2 text-base md:text-lg"
              style={{ color: '#00ffcc' }}
            >
              <li>Connect your Sui wallet</li>
              <li>Pay 3 SUI to enter the battle queue</li>
              <li>Get matched with an opponent</li>
              <li>Use strategic abilities to grow your NFT</li>
              <li>First to reach 100 Growth wins 5 SUI!</li>
            </ol>
          </div>

          {/* Battle Mechanics */}
          <div 
            className="p-6 md:p-8 rounded-2xl"
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
              Battle Mechanics
            </h2>
            <ul 
              className="space-y-2 text-base md:text-lg"
              style={{ color: '#00ffcc' }}
            >
              <li>Turn-based strategy gameplay</li>
              <li>4 unique abilities per player</li>
              <li>Offensive and growth-boosting moves</li>
              <li>Real-time battle updates</li>
              <li>Visual NFT evolution stages</li>
            </ul>
          </div>

          {/* NFT Evolution */}
          <div 
            className="p-6 md:p-8 rounded-2xl"
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
              NFT Evolution
            </h2>
            <ul 
              className="space-y-2 text-base md:text-lg"
              style={{ color: '#00ffcc' }}
            >
              <li>Seed: 0-25 Growth</li>
              <li>Young Sapling: 26-50 Growth</li>
              <li>Mature Sapling: 51-75 Growth</li>
              <li>Full Tree: 76-100 Growth</li>
            </ul>
          </div>
        </div>
      </main>

      <Footer />
      <BattleDialog 
        isOpen={dialogOpen}
        message={dialogMessage}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}
