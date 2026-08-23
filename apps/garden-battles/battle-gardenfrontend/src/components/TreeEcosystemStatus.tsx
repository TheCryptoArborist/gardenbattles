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
      label: "TREE in your wallet",
      description: "TREE you can spend or move. This balance alone does not unlock the fifth card.",
      value: liquidTree.label,
    },
    {
      label: "SuiDex V2 liquidity",
      description: "TREE supplied to the original SuiDex pool. Any verified amount can qualify.",
      value: sourceValues.get("suidex-v2") ?? "Checking...",
    },
    {
      label: "SuiDex V3 liquidity",
      description: "TREE supplied to the current concentrated-liquidity pool. Any verified amount can qualify.",
      value: sourceValues.get("suidex-v3") ?? "Checking...",
    },
    {
      label: "Moonbags staking",
      description: "TREE deposited in the supported staking program. Any verified amount can qualify.",
      value: sourceValues.get("moonbags-staking") ?? "Checking...",
    },
    {
      label: "Your fifth-card result",
      description: "If qualified, Garden Bot, Arborist Trials, and paid PvP deal five move cards instead of four. Practice Mode uses four cards.",
      value: fifthMoveValue,
    },
  ];

  return (
    <section className="gb-ecosystem-status-card" aria-label="TREE Ecosystem Status">
      <div className="gb-ecosystem-status-head">
        <div>
          <span>What the game found in your wallet</span>
          <strong>These read-only checks explain whether you qualify for a fifth battle card.</strong>
        </div>
        <em>Nothing is spent</em>
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
        If a source is temporarily unavailable, the game does not treat it as zero. Wait a moment and check again before changing your position.
      </p>
    </section>
  );
}
