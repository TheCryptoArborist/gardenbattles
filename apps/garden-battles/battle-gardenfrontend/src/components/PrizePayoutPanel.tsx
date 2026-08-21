type PrizePayoutPanelProps = {
  isGardenBotBattle: boolean;
  isPracticeBattle?: boolean;
  growthTarget?: number;
};

export default function PrizePayoutPanel({
  isGardenBotBattle,
  isPracticeBattle = false,
  growthTarget = 50,
}: PrizePayoutPanelProps) {
  const mode = isPracticeBattle ? "Practice" : isGardenBotBattle ? "Garden Bot" : "PvP";
  const facts = isPracticeBattle
    ? [
        ["Entry", "Free - no wallet approval"],
        ["Target", `First to ${growthTarget} Growth`],
        ["Rewards", "None"],
        ["Leaderboard", "Not recorded"],
      ]
    : isGardenBotBattle
      ? [
          ["Entry", "No SUI deposit"],
          ["Target", `First to ${growthTarget} Growth`],
          ["Opponent", "Garden Bot"],
          ["Leaderboard", "Ranked result"],
        ]
      : [
          ["Entry", "3 SUI per player"],
          ["Target", `First to ${growthTarget} Growth`],
          ["Winner", "5 SUI"],
          ["TREE support", "1 SUI buyback allocation"],
        ];

  return (
    <aside className="gb-hud-panel gb-prize-payout-panel" aria-label="Current battle terms">
      <div className="gb-hud-panel-kicker">Current Match</div>
      <h2>Battle Terms</h2>
      <p className="gb-hud-panel-intro">{mode} rules for this active match.</p>

      <dl className="gb-hud-facts">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
