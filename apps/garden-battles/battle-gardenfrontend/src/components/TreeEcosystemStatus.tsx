import { useEffect, useState } from "react";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import {
  FALLBACK_TREE_DECIMALS,
  TREE_COIN_TYPE,
  formatCompactTREE,
  treeBalanceToNumber,
} from "@/components/ForestPower";

export default function TreeEcosystemStatus() {
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

  const rows = [
    {
      label: "Liquid TREE",
      description: "Spendable wallet TREE.",
      value: liquidTreeLabel,
    },
    {
      label: "SuiDex V2 Position",
      description: "LP/staked exposure.",
      value: "Detection coming soon",
    },
    {
      label: "SuiDex V3 Position",
      description: "Concentrated LP exposure.",
      value: "Detection coming soon",
    },
    {
      label: "VICTORY Lock",
      description: "SuiDex supporter status.",
      value: "Detection coming soon",
    },
    {
      label: "NFTree Status",
      description: "Holder identity/access layer.",
      value: "Detection coming soon",
    },
  ];

  return (
    <section className="gb-ecosystem-status-card" aria-label="TREE Ecosystem Status">
      <div className="gb-ecosystem-status-head">
        <div>
          <span>TREE Ecosystem Status</span>
          <strong>Liquid TREE and future qualification signals</strong>
        </div>
        <em>Read-only</em>
      </div>

      <div className="gb-ecosystem-status-grid">
        {rows.map((row) => (
          <div className="gb-ecosystem-status-row" key={row.label}>
            <div>
              <strong>{row.label}</strong>
              <small>{row.description}</small>
            </div>
            <span>{row.value}</span>
          </div>
        ))}
      </div>

      <p className="gb-ecosystem-note">LP exposure is separate from liquid TREE.</p>
    </section>
  );
}
