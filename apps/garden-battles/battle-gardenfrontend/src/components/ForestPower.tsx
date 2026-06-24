import { useEffect, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";

interface ForestPowerProps {
  address: string | null;
}

// TREE coin type on Sui mainnet
const TREE_COIN_TYPE =
  "0x6c5a609f6d0288523ce4a6ed87d19ae127f62073ab75fd9b0b1c9b455d4895cf::tree::TREE";

// Tiers for visual display
const TIERS = [
  { min: 0, label: "Seedling", color: "#8B8B8B", leaves: 1 },
  { min: 1_000_000, label: "Sapling", color: "#4CAF50", leaves: 2 },
  { min: 10_000_000, label: "Thicket", color: "#2196F3", leaves: 3 },
  { min: 100_000_000, label: "Forest", color: "#9C27B0", leaves: 4 },
  { min: 1_000_000_000, label: "Ancient Grove", color: "#FF9800", leaves: 5 },
];

function formatTREE(balance: bigint): string {
  const num = Number(balance) / 1_000_000_000;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  if (num >= 1) return num.toFixed(1);
  return num.toFixed(4);
}

export default function ForestPower({ address }: ForestPowerProps) {
  const suiClient = useSuiClient();
  const [treeBalance, setTreeBalance] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setTreeBalance(null);
      return;
    }

    setLoading(true);
    suiClient
      .getBalance({
        owner: address,
        coinType: TREE_COIN_TYPE,
      })
      .then((balance) => {
        setTreeBalance(BigInt(balance.totalBalance));
      })
      .catch(() => {
        setTreeBalance(BigInt(0));
      })
      .finally(() => setLoading(false));
  }, [address, suiClient]);

  if (!address || loading) return null;
  if (treeBalance === null) return null;

  // Find the applicable tier
  const tier = [...TIERS].reverse().find((t) => (treeBalance ?? BigInt(0)) >= BigInt(t.min)) || TIERS[0];

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
      title={`${formatTREE(treeBalance ?? BigInt(0))} $TREE balance`}
    >
      <span style={{ fontSize: "14px" }}>🌳</span>
      <span style={{ fontWeight: "bold" }}>{tier.label}</span>
      <span style={{ opacity: 0.6, fontSize: "9px" }}>
        {formatTREE(treeBalance ?? BigInt(0))} TREE
      </span>
    </div>
  );
}
