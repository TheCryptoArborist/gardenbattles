import { useCurrentAccount } from "@mysten/dapp-kit";
import { useFifthMoveEligibility } from "@/hooks/useFifthMoveEligibility";
import { useTreeBalance } from "@/hooks/useTreeBalance";

export default function TreeEcosystemStatus() {
  const account = useCurrentAccount();
  const liquidTree = useTreeBalance(account?.address);
  const eligibility = useFifthMoveEligibility(account?.address);
  const sourceValues = new Map(
    eligibility.response?.sources.map((source) => [
      source.source,
      source.status === "qualified-data"
        ? `${source.underlyingTreeDisplay ?? "Verified"} TREE`
        : source.status === "verified-zero"
          ? "Verified: 0 TREE"
          : "Temporarily unavailable",
    ]) ?? [],
  );
  const fifthMoveValue =
    eligibility.status === "qualified"
      ? "Qualified"
      : eligibility.status === "not-qualified"
        ? "Not qualified"
        : eligibility.status === "checking"
          ? "Checking..."
          : eligibility.status === "not-connected"
            ? "Connect wallet"
            : eligibility.status === "verification-incomplete"
              ? "Verification incomplete"
              : "Temporarily unavailable";

  const rows = [
    {
      label: "Liquid TREE",
      description: "Spendable wallet TREE.",
      value: liquidTree.label,
    },
    {
      label: "SuiDex V2 Position",
      description: "Verified underlying TREE.",
      value: sourceValues.get("suidex-v2") ?? "Checking...",
    },
    {
      label: "SuiDex V3 Position",
      description: "Verified concentrated LP TREE.",
      value: sourceValues.get("suidex-v3") ?? "Checking...",
    },
    {
      label: "Moonbags Staking",
      description: "Verified staked TREE.",
      value: sourceValues.get("moonbags-staking") ?? "Checking...",
    },
    {
      label: "Fifth Move",
      description: "Live battle eligibility.",
      value: fifthMoveValue,
    },
  ];

  return (
    <section className="gb-ecosystem-status-card" aria-label="TREE Ecosystem Status">
      <div className="gb-ecosystem-status-head">
        <div>
          <span>TREE Ecosystem Status</span>
          <strong>Live wallet utility and qualification signals</strong>
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

      <p className="gb-ecosystem-note">
        TREE Reroll is planned but its cost and transaction flow are not configured yet.
      </p>
    </section>
  );
}
