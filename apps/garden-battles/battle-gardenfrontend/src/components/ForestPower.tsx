import { useEffect, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";

interface ForestPowerProps {
  address: string | null;
}

const TREE_COIN_TYPE =
  "0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE";

const FALLBACK_TREE_DECIMALS = 6;

const TIERS = [
  { min: 0, label: "Seedling", color: "#8B8B8B", leaves: 1 },
  { min: 1_000_000, label: "Sapling", color: "#4CAF50", leaves: 2 },
  { min: 10_000_000, label: "Thicket", color: "#2196F3", leaves: 3 },
  { min: 100_000_000, label: "Forest", color: "#9C27B0", leaves: 4 },
  { min: 1_000_000_000, label: "Ancient Grove", color: "#FF9800", leaves: 5 },
];

function treeBalanceToNumber(balance: bigint, decimals: number): number {
  return Number(balance) / 10 ** decimals;
}

function formatCompactTREE(amount: number): string {
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
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 10px",
        background: "rgba(0,20,0,0.8)",
        border: `1px solid ${tier.color}40`,
        borderRadius: "6px",
        fontFamily: "Orbitron, sans-serif",
        fontSize: "10px",
        color: tier.color,
        whiteSpace: "nowrap",
      }}
      title={`Liquid TREE: ${exactBalance} TREE. SuiDex V3: Not included in liquid balance.`}
    >
      <span style={{ fontSize: "12px", fontWeight: 800 }}>TREE</span>
      <span style={{ fontWeight: "bold" }}>{tier.label}</span>
      <span style={{ opacity: 0.6, fontSize: "9px" }}>{compactBalance} TREE</span>
    </div>
  );
}
