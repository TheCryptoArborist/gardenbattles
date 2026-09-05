import TreeBadgeCrest from "@/components/TreeBadgeCrest";
import { useFifthMoveEligibility } from "@/hooks/useFifthMoveEligibility";
import { useTreeBalance } from "@/hooks/useTreeBalance";
import { formatCompactTREE, formatExactTREE } from "@/lib/treeBalance";
export {
  FALLBACK_TREE_DECIMALS,
  TREE_COIN_TYPE,
  formatCompactTREE,
  treeBalanceToNumber,
} from "@/lib/treeBalance";

interface ForestPowerProps {
  address: string | null;
}

const TIERS = [
  { min: 0, label: "Forest Sprout", className: "gb-holder-rank-forest-sprout" },
  { min: 10_000, label: "Rooted Holder", className: "gb-holder-rank-rooted-holder" },
  { min: 100_000, label: "Grove Builder", className: "gb-holder-rank-grove-builder" },
  { min: 1_000_000, label: "Canopy Holder", className: "gb-holder-rank-canopy-holder" },
  { min: 5_000_000, label: "Ancient Grove", className: "gb-holder-rank-ancient-grove" },
  { min: 25_000_000, label: "Canopy Titan", className: "gb-holder-rank-canopy-titan" },
];

export default function ForestPower({ address }: ForestPowerProps) {
  const treeBalance = useTreeBalance(address);
  const eligibility = useFifthMoveEligibility(address);

  if (!address || treeBalance.status !== "ready") return null;

  const liquidTree = treeBalance.amount;
  const tier = [...TIERS].reverse().find((t) => liquidTree >= t.min) || TIERS[0];
  const tierNumber = TIERS.findIndex((candidate) => candidate.label === tier.label) + 1;
  const nextTier = TIERS[tierNumber] ?? null;
  const compactBalance = formatCompactTREE(liquidTree);
  const exactBalance = formatExactTREE(liquidTree);
  const sources = new Map(
    eligibility.response?.sources.map((source) => [
      source.source,
      {
        status: source.status,
        value: source.status === "qualified-data"
          ? `${source.underlyingTreeDisplay ?? "Verified"} TREE`
          : source.status === "verified-zero"
            ? "0 TREE"
            : "Not verified",
      },
    ]) ?? [],
  );
  const qualifyingTotal = eligibility.response?.verifiedUnderlyingTree ?? null;
  const sourceRows = [
    { id: "suidex-v2", label: "V2 LP" },
    { id: "suidex-v3", label: "V3 LP" },
    { id: "tree-lock", label: "30D Lock" },
  ] as const;

  return (
    <div
      className={`gb-holder-rank-badge gb-hud-rank-card gb-tree-status-card ${tier.className}`}
      title={`TREE Status Rank: tier ${tierNumber} of ${TIERS.length}, ${tier.label}. Liquid TREE: ${exactBalance} TREE. Qualifying LP and lock: ${qualifyingTotal ?? "checking"} TREE.`}
    >
      <span className="gb-hud-rank-crest-shell">
        <TreeBadgeCrest family="tree-status" rankName={tier.label} size="lg" />
      </span>
      <span className="gb-hud-rank-content">
        <span className="gb-holder-rank-kicker">TREE Status Rank · Tier {tierNumber} of {TIERS.length}</span>
        <span className="gb-holder-rank-title">{tier.label}</span>
        <span className="gb-holder-rank-balance">Liquid wallet: {compactBalance} TREE</span>
        <span className="gb-tree-status-qualifying">
          Qualifying LP + lock: {qualifyingTotal === null ? "Checking…" : `${qualifyingTotal} TREE`}
        </span>
        {nextTier && (
          <span className="gb-tree-status-next-tier">
            Next TREE rank: {nextTier.label} at {formatCompactTREE(nextTier.min)} TREE held
          </span>
        )}
        <span className="gb-tree-status-sources" aria-label="TREE liquidity and lock breakdown">
          {sourceRows.map((source) => {
            const result = sources.get(source.id);
            return (
              <span key={source.id} data-status={result?.status ?? "checking"}>
                <strong>{source.label}</strong>
                <span>{result?.value ?? "Checking…"}</span>
              </span>
            );
          })}
        </span>
      </span>
    </div>
  );
}
