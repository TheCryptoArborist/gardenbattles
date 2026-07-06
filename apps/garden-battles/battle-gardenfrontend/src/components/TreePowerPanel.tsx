import { appAsset } from "@/lib/assets";

export default function TreePowerPanel() {
  return (
    <aside className="gb-hud-panel gb-tree-power-panel" aria-label="Tree Power planned utilities">
      <div className="gb-hud-panel-kicker">Planned Utility</div>
      <h2>TREE Power</h2>
      <p className="gb-hud-panel-intro">
        Functional TREE battle utilities are being specified before contract and wallet work.
      </p>

      <div className="gb-hud-feature">
        <div>
          <strong>Fifth Move Unlock</strong>
          <span>Position entry required</span>
        </div>
        <span className="gb-hud-status">Coming Soon</span>
      </div>

      <div className="gb-hud-feature">
        <div>
          <strong>TREE Reroll</strong>
          <span>Pay TREE during battle</span>
        </div>
        <span className="gb-hud-status">Coming Soon</span>
      </div>

      <div className="gb-hud-buy-tree">
        <span>
          <strong>Get TREE for Battle Utilities</strong>
          Future TREE rerolls will use TREE during active battles.
        </span>
        <a
          href="https://dex.suidex.org/swap?from=SUI&to=Tree"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src={appAsset("assets/suidex-handshake.png")}
            alt=""
            className="gb-hud-buy-tree-icon"
            aria-hidden="true"
          />
          Buy TREE
        </a>
      </div>

      <button className="gb-hud-disabled-action" type="button" disabled>
        Move Swap / Canopy Clash perks
      </button>
    </aside>
  );
}
