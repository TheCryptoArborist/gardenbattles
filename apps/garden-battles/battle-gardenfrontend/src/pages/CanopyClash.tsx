import { ConnectButton } from "@mysten/dapp-kit";
import { ArrowLeft, CalendarClock, GitBranch, Trophy } from "lucide-react";
import { Link } from "wouter";
import ModeCrest from "@/components/ModeCrest";
import { appAsset } from "@/lib/assets";
import "@/battle-hub.css";

export default function CanopyClash() {
  return (
    <div className="gb-hub-page gb-clash-page">
      <header className="gb-hub-header">
        <Link href="/battle" className="gb-clash-back"><ArrowLeft size={17} /> Battle Modes</Link>
        <img src={appAsset("assets/garden.png")} alt="Garden Battles" />
        <ConnectButton connectText="Connect Wallet" />
      </header>
      <main className="gb-hub-shell">
        <section className="gb-clash-hero">
          <ModeCrest type="canopy-clash" alt="Canopy Clash tournament crest" />
          <small>GARDEN BATTLES TOURNAMENT MODE</small>
          <h1>Canopy Clash</h1>
          <p>Canopy Clash will turn Garden Battles into scheduled tournament competition. This dedicated route is reserved now so brackets, registration, prizes, and live rounds can grow without crowding the other modes.</p>
          <strong>COMING SOON</strong>
        </section>
        <section className="gb-clash-roadmap" aria-label="Canopy Clash planned features">
          <article><CalendarClock size={24} /><h2>Scheduled Events</h2><p>Clear registration windows and tournament start times.</p></article>
          <article><GitBranch size={24} /><h2>Visible Brackets</h2><p>Follow every matchup from opening round to the final.</p></article>
          <article><Trophy size={24} /><h2>Championship Prizes</h2><p>Dedicated prize information before a player enters.</p></article>
        </section>
        <Link href="/battle" className="gb-clash-return">Return to Battle Modes</Link>
      </main>
    </div>
  );
}
