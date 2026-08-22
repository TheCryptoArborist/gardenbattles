import { useState } from "react";
import { ConnectButton } from "@mysten/dapp-kit";
import { ArrowUpRight, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import TreePowerPanel from "@/components/TreePowerPanel";
import UtilityDrawer from "@/components/UtilityDrawer";
import { useFifthMoveEligibility } from "@/hooks/useFifthMoveEligibility";
import { useTreeBalance } from "@/hooks/useTreeBalance";
import { appAsset } from "@/lib/assets";

const UTILITY_TABS = [
  { id: "benefits", label: "Battle Benefits", url: null, title: null, description: null, action: null },
  {
    id: "buy",
    label: "Buy TREE",
    url: "https://www.tree-token.xyz/dapp/#swap",
    title: "Swap SUI for TREE",
    description: "Buy TREE through the native TREE Command Center swap. It compares supported on-chain routes for a protected quote. TREE held directly in your wallet does not unlock the fifth card by itself.",
    action: "Open TREE Swap in Command Center",
  },
  {
    id: "liquidity",
    label: "Add V3 Liquidity",
    url: "https://www.tree-token.xyz/dapp/#v3",
    title: "Add TREE liquidity on SuiDex V3",
    description: "Use the TREE Command Center V3 workspace to create a supported SUI/TREE position. The TREE represented by the position counts toward the combined 1,000,000 TREE fifth-card requirement.",
    action: "Open V3 Workspace in Command Center",
  },
  {
    id: "stake",
    label: "Stake V2",
    url: "https://www.tree-token.xyz/dapp/#earn",
    title: "Add and stake SuiDex V2 liquidity",
    description: "Use the TREE Command Center V2 Zap & Stake flow to create liquidity and stake the LP position. The TREE represented by that position counts toward the combined 1,000,000 TREE fifth-card requirement.",
    action: "Open V2 Zap & Stake in Command Center",
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
  const treeBalance = useTreeBalance(address);
  const fifthMoveEligibility = useFifthMoveEligibility(address);
  const qualification = fifthMoveEligibility.response;
  const isQualified = qualification?.status === "qualified";
  const verifiedTree = qualification?.verifiedUnderlyingTree;

  return (
    <UtilityDrawer
      eyebrow="TREE Battle Benefits"
      title="TREE Battle Benefits"
      description="Learn how the fifth battle card works, see what counts toward eligibility, and check your connected wallet."
      className="gb-tree-benefits-drawer"
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
        <section className="gb-tree-action-panel" aria-label={selectedTab.title || "TREE utility"}>
          <div className="gb-tree-action-brand">
            <img src={appAsset("assets/thick.png")} alt="TREE Command Center" />
            <div>
              <span>TREE Command Center</span>
              <h3>{selectedTab.title}</h3>
            </div>
          </div>

          <p className="gb-tree-action-description">{selectedTab.description}</p>

          <div className="gb-tree-action-steps">
            <div>
              <span>1</span>
              <section>
                <strong>Connect to Garden Battles here</strong>
                <p>This lets the game read your TREE balance and determine whether your wallet qualifies for battle benefits.</p>
              </section>
              {address ? (
                <em><CheckCircle2 size={16} aria-hidden="true" /> Wallet connected</em>
              ) : (
                <ConnectButton connectText="Connect Wallet Here" />
              )}
            </div>
            <div>
              <span>2</span>
              <section>
                <strong>Continue in the TREE Command Center</strong>
                <p>The Command Center opens in a new tab so its wallet connection and transaction approval can work correctly. Garden Battles remains open here. Supported SuiDex pools or other verified routes may still be used underneath.</p>
              </section>
            </div>
          </div>

          <a className="gb-tree-action-launch" href={selectedTab.url} target="_blank" rel="noopener noreferrer">
            {selectedTab.action} <ArrowUpRight size={17} aria-hidden="true" />
          </a>

          <p className="gb-tree-action-safety">
            <ShieldCheck size={16} aria-hidden="true" /> No transaction starts from this panel. Review every amount in the TREE Command Center and approve it in your wallet.
          </p>
        </section>
      ) : (
        <div className="gb-tree-benefits-layout">
          <section className={`gb-tree-benefits-spotlight ${isQualified ? "gb-tree-benefits-spotlight-qualified" : ""}`}>
            <div className="gb-tree-benefits-spotlight-art">
              <img src={appAsset("assets/tree.jpg")} alt="NFTree character ready for battle" />
              <div className="gb-tree-benefits-spotlight-badge">
                <Sparkles size={18} aria-hidden="true" />
                <span>{isQualified ? "Battle Ready" : "Power Up"}</span>
              </div>
            </div>
            <div className="gb-tree-benefits-spotlight-copy">
              <span className="gb-tree-benefits-eyebrow">
                {isQualified ? "Your wallet qualifies" : "TREE battle advantage"}
              </span>
              <h3>{isQualified ? "Your Fifth Card Is Unlocked" : "Turn Four Choices Into Five"}</h3>
              <p>
                {isQualified
                  ? "When an eligible paid battle begins, this wallet receives five move cards instead of the standard four. That extra choice can change your strategy every turn."
                  : "A verified TREE liquidity or staking position unlocks a fifth move card in eligible paid battles, giving you one more strategic option every turn."}
              </p>
              <div className="gb-tree-benefits-reward-row">
                <div>
                  <span>Battle hand</span>
                  <strong>{isQualified ? "5 move cards" : "4 → 5 cards"}</strong>
                </div>
                <div>
                  <span>Qualifying TREE found</span>
                  <strong>{verifiedTree !== undefined ? `${Number(verifiedTree).toLocaleString(undefined, { maximumFractionDigits: 2 })} TREE` : "Checking…"}</strong>
                </div>
              </div>
              <div className="gb-tree-benefits-liquid-note">
                <img src={appAsset("assets/thick.png")} alt="" aria-hidden="true" />
                <div>
                  <span>TREE held directly in this wallet</span>
                  <strong>{treeBalance.status === "ready" ? treeBalance.exactLabel : treeBalance.label}</strong>
                  <small>This wallet balance does not unlock the fifth card by itself. Only TREE represented by supported V2/V3 liquidity or Moonbags staking positions counts toward the 1,000,000 TREE requirement.</small>
                </div>
              </div>
            </div>
            {!address && (
              <div className="gb-tree-benefits-connect">
                <ConnectButton connectText="Connect Wallet in This Panel" />
                <small>The wallet chooser opens over Garden Battles. Slush may open its own secure approval screen; Garden Battles cannot—and should not—display your wallet credentials.</small>
              </div>
            )}
          </section>
          <TreePowerPanel
            address={address}
            isBattleActive={isBattleActive}
            isPracticeBattle={isPracticeBattle}
            currentMoveCount={currentMoveCount}
            treeBalance={treeBalance}
            fifthMoveEligibilityResponse={qualification ?? undefined}
            isFifthMoveActivationLive
            compact
          />
        </div>
      )}
    </UtilityDrawer>
  );
}
