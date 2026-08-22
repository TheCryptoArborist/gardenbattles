type MatchStatusTone = "ready" | "waiting" | "processing" | "action";

type PrizePayoutPanelProps = {
  isGardenBotBattle: boolean;
  isPracticeBattle?: boolean;
  growthTarget?: number;
  liveStatus: string;
  statusTone?: MatchStatusTone;
};

export default function PrizePayoutPanel({
  isGardenBotBattle,
  isPracticeBattle = false,
  growthTarget = 50,
  liveStatus,
  statusTone = "waiting",
}: PrizePayoutPanelProps) {
  const mode = isPracticeBattle ? "Practice" : isGardenBotBattle ? "Garden Bot" : "PvP";
  const details = isPracticeBattle
    ? [
        ["Entry", "Free - no wallet approval"],
        ["Rewards", "None"],
        ["Leaderboard", "Not recorded"],
      ]
    : isGardenBotBattle
      ? [
          ["Entry", "No SUI deposit"],
          ["Opponent", "Garden Bot"],
          ["Leaderboard", "Ranked result"],
        ]
      : [
          ["Entry", "3 SUI per player"],
          ["Prize", "5 SUI to winner"],
          ["TREE support", "1 SUI buyback allocation"],
        ];

  return (
    <aside className="gb-match-status-bar" aria-label="Current match status">
      <div className="gb-match-status-summary">
        <span>{mode} Match</span>
        <strong>First to {growthTarget} Growth</strong>
      </div>

      <div className={`gb-match-status-live gb-match-status-live-${statusTone}`} role="status">
        <span aria-hidden="true" />
        <strong>{liveStatus}</strong>
      </div>

      <details className="gb-match-terms-details">
        <summary>View match details</summary>
        <dl>
          {details.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </details>
    </aside>
  );
}
