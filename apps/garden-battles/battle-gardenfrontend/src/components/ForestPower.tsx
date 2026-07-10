import { useEffect, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import TreeBadgeCrest from "@/components/TreeBadgeCrest";

interface ForestPowerProps {
  address: string | null;
}

export const TREE_COIN_TYPE =
  "0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE";

export const FALLBACK_TREE_DECIMALS = 6;

const TIERS = [
  { min: 0, label: "Forest Sprout", className: "gb-holder-rank-forest-sprout" },
  { min: 10_000, label: "Rooted Holder", className: "gb-holder-rank-rooted-holder" },
  { min: 100_000, label: "Grove Builder", className: "gb-holder-rank-grove-builder" },
  { min: 1_000_000, label: "Canopy Holder", className: "gb-holder-rank-canopy-holder" },
  { min: 5_000_000, label: "Ancient Grove", className: "gb-holder-rank-ancient-grove" },
  { min: 25_000_000, label: "Canopy Titan", className: "gb-holder-rank-canopy-titan" },
];

export function treeBalanceToNumber(balance: bigint, decimals: number): number {
  return Number(balance) / 10 ** decimals;
}

export function formatCompactTREE(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  if (amount >= 1) return amount.toFixed(1);
  return amount.toFixed(4);
}

function formatExactTREE(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(3)}M`;
  if (amount >= 1) {
    return amount.toLocaleString(undefined, { maximumFractionDigits: 3 });
  }
  return amount.toFixed(4);
}

export default function ForestPower({ address }: ForestPowerProps) {
  const suiClient = useSuiClient();
  const [treeBalance, setTreeBalance] = useState<bigint | null>(null);
  const [treeDecimals, setTreeDecimals] = useState(FALLBACK_TREE_DECIMALS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setTreeBalance(null);
      return;
    }

    setLoading(true);
    Promise.all([
      suiClient.getBalance({
        owner: address,
        coinType: TREE_COIN_TYPE,
      }),
      suiClient.getCoinMetadata({
        coinType: TREE_COIN_TYPE,
      }),
    ])
      .then(([balance, metadata]) => {
        setTreeDecimals(metadata?.decimals ?? FALLBACK_TREE_DECIMALS);
        setTreeBalance(BigInt(balance.totalBalance));
      })
      .catch(() => {
        setTreeDecimals(FALLBACK_TREE_DECIMALS);
        setTreeBalance(BigInt(0));
      })
      .finally(() => setLoading(false));
  }, [address, suiClient]);

  if (!address || loading) return null;
  if (treeBalance === null) return null;

  const liquidTree = treeBalanceToNumber(treeBalance, treeDecimals);
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
