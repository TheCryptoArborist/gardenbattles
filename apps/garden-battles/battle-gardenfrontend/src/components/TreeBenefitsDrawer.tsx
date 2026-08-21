import { useState } from "react";
import TreeEcosystemStatus from "@/components/TreeEcosystemStatus";
import TreePowerPanel from "@/components/TreePowerPanel";
import UtilityDrawer from "@/components/UtilityDrawer";

const UTILITY_TABS = [
  { id: "benefits", label: "Battle Benefits", url: null },
  { id: "buy", label: "Buy TREE", url: "https://dex.suidex.org/swap?from=SUI&to=Tree" },
  {
    id: "liquidity",
    label: "Add V3 Liquidity",
    url: "https://dex.suidex.org/pools/v3/0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf/add",
  },
  {
    id: "stake",
    label: "Stake V2",
    url: "https://dex.suidex.org/zap?pool=0x35a1be1f01f9edf7f5221d226f357d194d43c28f2a65cb38640935518d9a5bfc&stake=true",
  },
] as const;

type TreeBenefitsDrawerProps = {
  address?: string | null;
  isBattleActive: boolean;
  isPracticeBattle: boolean;
  currentMoveCount: number;
  onClose: () => void;
};

export default function TreeBenefitsDrawer({
  address,
  isBattleActive,
  isPracticeBattle,
  currentMoveCount,
  onClose,
}: TreeBenefitsDrawerProps) {
  const [activeTab, setActiveTab] = useState<(typeof UTILITY_TABS)[number]["id"]>("benefits");
  const selectedTab = UTILITY_TABS.find((tab) => tab.id === activeTab) ?? UTILITY_TABS[0];

  return (
    <UtilityDrawer
      eyebrow="TREE Utilities"
      title="TREE Battle Benefits"
      description="Verified TREE support can unlock a fifth battle card. Buy, provide liquidity, or stake without leaving Garden Battles."
      onClose={onClose}
    >
      <nav className="gb-utility-tabs" aria-label="TREE utility choices">
        {UTILITY_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? "gb-utility-tab gb-utility-tab-active" : "gb-utility-tab"}
            aria-pressed={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {selectedTab.url ? (
        <div className="gb-embedded-utility">
          <div className="gb-embedded-utility-notice">
            This SuiDex utility stays inside Garden Battles. Your wallet will still request approval for any transaction.
          </div>
          <iframe src={selectedTab.url} title={selectedTab.label} allow="clipboard-write" />
        </div>
      ) : (
        <div className="gb-tree-benefits-layout">
          <div className="gb-tree-benefits-explainer">
            <strong>What TREE does in Garden Battles</strong>
            <p>
              A verified, nonzero TREE position through SuiDex V2, SuiDex V3, or Moonbags staking unlocks a fifth card in eligible battles.
            </p>
            <p>TREE Reroll is planned, but its price and transaction flow are not live yet.</p>
          </div>
          <TreePowerPanel
            address={address}
            isBattleActive={isBattleActive}
            isPracticeBattle={isPracticeBattle}
            currentMoveCount={currentMoveCount}
            isFifthMoveActivationLive
            compact
          />
          <TreeEcosystemStatus />
        </div>
      )}
    </UtilityDrawer>
  );
}
