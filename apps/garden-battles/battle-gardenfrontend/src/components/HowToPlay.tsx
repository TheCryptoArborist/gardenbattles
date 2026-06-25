import { useEffect, useState } from "react";

type HowToPlaySection = {
  title: string;
  summary: string;
  bullets: string[];
};

const howToPlaySections: HowToPlaySection[] = [
  {
    title: "Overview",
    summary: "Grow your tree to the target before your opponent.",
    bullets: [
      "Battle details may shift as gameplay is refined.",
      "Use this guide as a quick orientation, not final rules text.",
    ],
  },
  {
    title: "Game Modes",
    summary: "Choose between practice and competitive battle paths.",
    bullets: [
      "Garden Bot is the practice mode.",
      "PvP and Canopy Clash are competitive modes being shaped.",
    ],
  },
  {
    title: "Turn Flow",
    summary: "Choose a move or ability each turn.",
    bullets: [
      "Some actions may require wallet confirmation.",
      "After your action resolves, the battle waits for the next turn.",
    ],
  },
  {
    title: "Move Types",
    summary: "Moves may grow your tree, pressure an opponent, or add utility.",
    bullets: [
      "Growth, attack, defend, and utility effects may appear in your hand.",
      "Exact move balance can change while the game is tuned.",
    ],
  },
  {
    title: "TREE Power",
    summary: "TREE utility actions may support battle options.",
    bullets: [
      "Utilities may include buying, staking, rerolling, or powering moves.",
      "Confirm which actions are live before relying on them in battle.",
    ],
  },
  {
    title: "Garden Bot",
    summary: "Garden Bot gives you a practice opponent.",
    bullets: [
      "Bot battles are useful for learning turn flow and move timing.",
      "Bot visuals and stages are planned to evolve as the mode develops.",
    ],
  },
  {
    title: "PvP / Canopy Clash",
    summary: "Competitive modes are intended for player-vs-player play.",
    bullets: [
      "PvP is the direct battle path.",
      "Canopy Clash is planned as a larger tournament-style mode.",
    ],
  },
  {
    title: "Rewards / Payouts",
    summary: "Rewards and payouts should be reviewed before confirming actions.",
    bullets: [
      "Prize, payout, and treasury details may depend on the selected mode.",
      "Use the live confirmation screens as the source of truth.",
    ],
  },
];

export default function HowToPlay() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      <div className="gb-how-to-play-trigger-wrap">
        <button
          type="button"
          className="gb-how-to-play-trigger"
          onClick={() => setIsOpen(true)}
          data-testid="button-how-to-play-toggle"
        >
          <span className="gb-how-to-play-trigger-icon" aria-hidden="true">
            ?
          </span>
          <span>How To Play</span>
          <span className="gb-how-to-play-trigger-meta">
            Quick guide
          </span>
        </button>
      </div>

      {isOpen && (
        <div
          className="gb-how-to-play-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <section
            className="gb-how-to-play-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="how-to-play-title"
          >
            <header className="gb-how-to-play-modal-header">
              <div>
                <p className="gb-how-to-play-eyebrow">Garden Battles helper</p>
                <h2 id="how-to-play-title">How To Play</h2>
              </div>
              <button
                type="button"
                className="gb-how-to-play-close"
                onClick={() => setIsOpen(false)}
                aria-label="Close How To Play"
              >
                X
              </button>
            </header>

            <div className="gb-how-to-play-modal-body">
              <p className="gb-how-to-play-note">
                Gameplay is still being tuned, so this guide uses flexible
                wording and will stay easy to update.
              </p>
              <div className="gb-how-to-play-section-grid">
                {howToPlaySections.map((section, index) => (
                  <article className="gb-how-to-play-card" key={section.title}>
                    <span className="gb-how-to-play-card-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3>{section.title}</h3>
                    <p>{section.summary}</p>
                    <ul>
                      {section.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
