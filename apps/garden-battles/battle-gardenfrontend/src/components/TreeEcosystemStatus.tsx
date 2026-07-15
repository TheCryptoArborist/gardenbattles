import { useCurrentAccount } from "@mysten/dapp-kit";
import { useTreeBalance } from "@/hooks/useTreeBalance";

export default function TreeEcosystemStatus() {
  const account = useCurrentAccount();
  const liquidTree = useTreeBalance(account?.address);

  const rows = [
    {
      label: "Liquid TREE",
      description: "Spendable wallet TREE.",
      value: liquidTree.label,
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
