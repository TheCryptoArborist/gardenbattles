import { Link } from "wouter";
import { useSuiWallet } from "@/hooks/useSuiWallet";

export default function Header() {
  const { ConnectWalletButton } = useSuiWallet();

  return (
    <header className="flex justify-between items-center px-4 md:px-8 py-4" style={{
      background: 'rgba(0, 50, 0, 0.8)',
      borderBottom: '2px solid #00ff00',
      boxShadow: '0 0 15px #00ff00'
    }}>
      <div className="flex items-center">
        <Link href="/">
          <img 
            src="/assets/tree.jpg" 
            alt="The Garden Battles" 
            className="w-16 md:w-20 cursor-pointer transition-all duration-300"
            style={{
              filter: 'drop-shadow(0 0 15px #00ff00)',
              borderRadius: '50%',
              objectFit: 'cover',
              height: '64px',
              width: '64px'
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
      </div>
      
      <nav className="hidden md:flex gap-4 items-center">
        <Link 
          href="/"
          className="text-base transition-colors duration-300"
          style={{ color: '#00ff00' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#00cc00'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#00ff00'}
          data-testid="link-home"
        >
          Home
        </Link>
        <Link 
          href="/battle"
          className="text-base transition-colors duration-300"
          style={{ color: '#00ff00' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#00cc00'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#00ff00'}
          data-testid="link-battle"
        >
          Garden Battle
        </Link>
      </nav>

      <div data-testid="wallet-connect-button">
        <ConnectWalletButton />
      </div>
    </header>
  );
}
