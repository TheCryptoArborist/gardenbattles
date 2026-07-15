import TreeBadgeCrest from "@/components/TreeBadgeCrest";
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

  if (!address || treeBalance.status !== "ready") return null;

  const liquidTree = treeBalance.amount;
  const tier = [...TIERS].reverse().find((t) => liquidTree >= t.min) || TIERS[0];
  const compactBalance = formatCompactTREE(liquidTree);
  const exactBalance = formatExactTREE(liquidTree);

  return (
    <div
      className={`gb-holder-rank-badge gb-hud-rank-card gb-tree-status-card ${tier.className}`}
      title={`Liquid TREE: ${exactBalance} TREE. SuiDex V3: Not included in liquid balance.`}
    >
      <span className="gb-hud-rank-crest-shell">
        <TreeBadgeCrest family="tree-status" rankName={tier.label} size="lg" />
      </span>
      <span className="gb-hud-rank-content">
        <span className="gb-holder-rank-kicker">TREE Status</span>
        <span className="gb-holder-rank-title">{tier.label}</span>
        <span className="gb-holder-rank-balance">{compactBalance} TREE</span>
      </span>
    </div>
  );
}
