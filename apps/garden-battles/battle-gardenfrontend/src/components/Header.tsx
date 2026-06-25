import { useState } from "react";
import { Link } from "wouter";
import { Menu, X } from "lucide-react";
import { useSuiWallet } from "@/hooks/useSuiWallet";

const ecosystemLinks = [
  { label: "Home", href: "https://tree-token.net" },
  { label: "NFTree.net", href: "https://nftree.net" },
  { label: "NFTree Reward Site", href: "https://treedrop.xyz" },
];

const treeUtilityLinks = [
  { label: "Buy TREE", href: "https://dex.suidex.org/swap?from=SUI&to=Tree" },
  {
    label: "Add V3 LP",
    href: "https://dex.suidex.org/pools/v3/0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf/add",
  },
  {
    label: "Stake V2",
    href: "https://dex.suidex.org/zap?pool=0x35a1be1f01f9edf7f5221d226f357d194d43c28f2a65cb38640935518d9a5bfc&stake=true",
  },
];

export default function Header() {
  const { ConnectWalletButton } = useSuiWallet();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="gb-app-header">
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
      
      <nav className="gb-header-nav" aria-label="TREE ecosystem navigation">
        {ecosystemLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="gb-nav-link"
            target="_blank"
            rel="noreferrer"
          >
            {link.label}
          </a>
        ))}
        {treeUtilityLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="gb-nav-link"
            target="_blank"
            rel="noreferrer"
          >
            {link.label}
          </a>
        ))}
      </nav>

      <div className="gb-header-actions" data-testid="wallet-connect-button">
        <ConnectWalletButton />
        <button
          type="button"
          className="gb-mobile-menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="garden-header-mobile-nav"
          aria-label={menuOpen ? "Close TREE menu" : "Open TREE menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
      <nav
        id="garden-header-mobile-nav"
        className="gb-mobile-nav-panel"
        data-open={menuOpen}
        aria-label="TREE ecosystem mobile navigation"
      >
        {ecosystemLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="gb-nav-link"
            target="_blank"
            rel="noreferrer"
          >
            {link.label}
          </a>
        ))}
        {treeUtilityLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="gb-nav-link"
            target="_blank"
            rel="noreferrer"
          >
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
