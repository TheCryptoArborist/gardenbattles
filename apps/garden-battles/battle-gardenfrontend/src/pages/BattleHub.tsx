import { ConnectButton } from "@mysten/dapp-kit";
import { Bot, ChevronRight, Gamepad2, House, ShieldCheck, Swords, Trophy } from "lucide-react";
import { Link } from "wouter";
import ModeCrest from "@/components/ModeCrest";
import { useSuiWallet } from "@/hooks/useSuiWallet";
import { appAsset } from "@/lib/assets";
import "@/battle-hub.css";

const modes = [
  {
    id: "garden-bot",
    title: "Garden Bot",
    eyebrow: "Repeatable Single-Player",
    description: "Build a hand, battle the robotic grove, and grow your ranked record without a PvP entry fee.",
    facts: ["NFTree required", "No PvP entry fee", "Leaderboard eligible"],
    href: "/battle/garden-bot",
    action: "Play Garden Bot",
    crest: "garden-bot" as const,
    icon: Bot,
  },
  {
    id: "pvp",
    title: "PvP Battle",
    eyebrow: "Live Player-vs-Player",
    description: "Enter the 50-Growth queue, meet a live opponent, and fight for the winner payout.",
    facts: ["3 SUI entry", "Winner receives 5 SUI", "NFTree required"],
    href: "/battle/pvp",
    action: "Enter PvP Arena",
    crest: "pvp-battle" as const,
    icon: Swords,
  },
  {
    id: "trials",
    title: "Arborist Trials",
    eyebrow: "Daily Ranked Challenge",
    description: "Face the same strategy puzzle as every NFTree owner and record one official score each day.",
    facts: ["NFTree required", "One official run daily", "Unlimited practice"],
    href: "/battle/trials",
    action: "Enter Today’s Trial",
    icon: ShieldCheck,
  },
  {
    id: "canopy-clash",
    title: "Canopy Clash",
    eyebrow: "Tournament Competition",
    description: "A dedicated home for scheduled brackets, tournament prizes, and championship play.",
    facts: ["Tournament mode", "Brackets and prizes", "Coming soon"],
    href: "/battle/canopy-clash",
    action: "Preview Canopy Clash",
    crest: "canopy-clash" as const,
    icon: Trophy,
  },
];

export default function BattleHub() {
  const { address, battleState, isWaiting, pvpQueueState } = useSuiWallet();
  const activeBattle = !!battleState && !battleState.finished && !battleState.winner;
  const activePvp = !!pvpQueueState || isWaiting || (activeBattle && !battleState?.isBotBattle);
  const hasActiveSession = activeBattle || activePvp;
  const activeHref = activePvp ? "/battle/pvp" : "/battle/garden-bot";
  const activeLabel = activePvp ? (pvpQueueState || isWaiting ? "Resume PvP Queue" : "Resume PvP Battle") : "Resume Garden Bot";

  return (
    <div className="gb-hub-page">
      <header className="gb-hub-header">
        <img src={appAsset("assets/garden.png")} alt="Garden Battles" />
        <nav aria-label="Garden Battles navigation">
          <a href="https://www.tree-token.xyz/"><House size={16} /> Home</a>
          <a href="https://tree-token.xyz/play/" target="_blank" rel="noopener noreferrer"><Gamepad2 size={16} /> TREE Arcade</a>
          <Link href="/battle/leaderboard"><Trophy size={16} /> Leaderboard</Link>
        </nav>
        <a className="gb-hub-mobile-home" href="https://www.tree-token.xyz/" aria-label="Go to TREE home page"><House size={17} /><span>Home</span></a>
        <ConnectButton connectText="Connect Wallet" />
      </header>

      <main className="gb-hub-shell">
        <section className="gb-hub-hero">
          <span>THE NFTREE COMBAT ECOSYSTEM</span>
          <h1>Choose Your Battle</h1>
          <p>Each Garden Battles experience now has its own focused arena. Pick a mode, understand the stakes, and get into the action without searching through one long page.</p>
        </section>

        {hasActiveSession && (
          <section className="gb-hub-resume" aria-label="Active battle found">
            <div><small>ACTIVE SESSION FOUND</small><strong>{activeLabel}</strong><span>Your wallet’s current battle or queue is still available.</span></div>
            <Link href={activeHref}>{activeLabel}<ChevronRight size={18} /></Link>
          </section>
        )}

        <section className="gb-hub-grid" aria-label="Garden Battles modes">
          {modes.map((mode) => {
            const Icon = mode.icon;
            return (
              <article className={`gb-hub-mode gb-hub-mode-${mode.id}`} key={mode.id}>
                <div className="gb-hub-mode-art">
                  {mode.id === "trials" ? (
                    <img src={appAsset("assets/arborist-trials-logo.webp")} alt="Arborist Trials" />
                  ) : (
                    <ModeCrest type={mode.crest!} alt={`${mode.title} crest`} />
                  )}
                </div>
                <div className="gb-hub-mode-copy">
                  <small><Icon size={14} /> {mode.eyebrow}</small>
                  <h2>{mode.title}</h2>
                  <p>{mode.description}</p>
                  <div>{mode.facts.map((fact) => <span key={fact}>{fact}</span>)}</div>
                </div>
                <Link href={mode.href}>{mode.action}<ChevronRight size={18} /></Link>
              </article>
            );
          })}
        </section>

        <section className="gb-hub-guide">
          <div><strong>New to Garden Battles?</strong><span>Garden Bot is the best full-battle introduction. Arborist Trials is a shared daily puzzle. PvP puts SUI and live strategy on the line.</span></div>
          <Link href="/battle/garden-bot">Start with Garden Bot<ChevronRight size={17} /></Link>
        </section>

        {address && <p className="gb-hub-wallet-note">Connected wallet: {address.slice(0, 8)}…{address.slice(-6)}</p>}
      </main>
    </div>
  );
}
