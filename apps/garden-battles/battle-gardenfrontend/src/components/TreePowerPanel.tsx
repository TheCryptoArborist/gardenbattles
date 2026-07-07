import { useEffect, useState } from "react";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { appAsset } from "@/lib/assets";
import {
  FALLBACK_TREE_DECIMALS,
  TREE_COIN_TYPE,
  formatCompactTREE,
  treeBalanceToNumber,
} from "@/components/ForestPower";

export default function TreePowerPanel() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const [liquidTreeLabel, setLiquidTreeLabel] = useState("Connect wallet");

  useEffect(() => {
    if (!account?.address) {
      setLiquidTreeLabel("Connect wallet");
      return;
    }

    let isMounted = true;
    setLiquidTreeLabel("Loading");

    Promise.all([
      suiClient.getBalance({
        owner: account.address,
        coinType: TREE_COIN_TYPE,
      }),
      suiClient.getCoinMetadata({
        coinType: TREE_COIN_TYPE,
      }),
    ])
      .then(([balance, metadata]) => {
        if (!isMounted) return;
        const decimals = metadata?.decimals ?? FALLBACK_TREE_DECIMALS;
        const liquidTree = treeBalanceToNumber(BigInt(balance.totalBalance), decimals);
        setLiquidTreeLabel(`${formatCompactTREE(liquidTree)} TREE`);
      })
      .catch(() => {
        if (!isMounted) return;
        setLiquidTreeLabel("Unavailable");
      });

    return () => {
      isMounted = false;
    };
  }, [account?.address, suiClient]);

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
        <div className="gb-hud-buy-tree-copy">
          <strong>Get TREE for Battle Utilities</strong>
          <span>Future TREE rerolls will use TREE during active battles.</span>
        </div>
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

      <section className="gb-ecosystem-status" aria-label="TREE Ecosystem Status">
        <div className="gb-ecosystem-status-head">
          <strong>TREE Ecosystem Status</strong>
          <span>Read-only</span>
        </div>

        <div className="gb-ecosystem-status-row">
          <div>
            <strong>Liquid TREE</strong>
            <small>Spendable wallet TREE.</small>
          </div>
          <span>{liquidTreeLabel}</span>
        </div>

        <div className="gb-ecosystem-status-row">
          <div>
            <strong>SuiDex V2 Position</strong>
            <small>LP/staked exposure.</small>
          </div>
          <span>Detection coming soon</span>
        </div>

        <div className="gb-ecosystem-status-row">
          <div>
            <strong>SuiDex V3 Position</strong>
            <small>Concentrated LP exposure.</small>
          </div>
          <span>Detection coming soon</span>
        </div>

        <div className="gb-ecosystem-status-row">
          <div>
            <strong>VICTORY Lock</strong>
            <small>SuiDex supporter status.</small>
          </div>
          <span>Detection coming soon</span>
        </div>

        <div className="gb-ecosystem-status-row">
          <div>
            <strong>NFTree Status</strong>
            <small>Holder identity/access layer.</small>
          </div>
          <span>Detection coming soon</span>
        </div>

        <p className="gb-ecosystem-note">LP exposure is separate from liquid TREE.</p>
      </section>

      <button className="gb-hud-disabled-action" type="button" disabled>
        Move Swap / Canopy Clash perks
      </button>
    </aside>
  );
}
