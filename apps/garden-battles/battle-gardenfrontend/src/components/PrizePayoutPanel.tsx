type PrizePayoutPanelProps = {
  isGardenBotBattle: boolean;
};

export default function PrizePayoutPanel({ isGardenBotBattle }: PrizePayoutPanelProps) {
  return (
    <aside className="gb-hud-panel gb-prize-payout-panel" aria-label="Prize and payout planning">
      <div className="gb-hud-panel-kicker">Battle Terms</div>
      <h2>Prize & Payout</h2>
      <p className="gb-hud-panel-intro">
        Conservative preview only. Live values should be confirmed before any wallet approval.
      </p>

      <dl className="gb-hud-facts">
        <div>
          <dt>Garden Bot</dt>
          <dd>{isGardenBotBattle ? "Practice mode active" : "Practice battle mode"}</dd>
        </div>
        <div>
          <dt>PvP</dt>
          <dd>Entry and payout shown before confirmation</dd>
        </div>
        <div>
          <dt>Canopy Clash</dt>
          <dd>Tournament prize structure coming soon</dd>
        </div>
        <div>
          <dt>TREE Routing</dt>
          <dd>Pending spec</dd>
        </div>
      </dl>
    </aside>
  );
}
