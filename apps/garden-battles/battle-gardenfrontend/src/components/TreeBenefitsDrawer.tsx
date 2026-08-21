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
    url: "https://dex.suidex.org/swap?from=SUI&to=Tree",
    title: "Swap SUI for TREE",
    description: "Buy TREE on SuiDex. Holding liquid TREE shows in your wallet status; eligible liquidity or staking positions can unlock the fifth battle card.",
    action: "Open the TREE swap on SuiDex",
  },
  {
    id: "liquidity",
    label: "Add V3 Liquidity",
    url: "https://dex.suidex.org/pools/v3/0x39d5ba22e01e45bc4129ec28a0bef52e8fee8db5d07d337adf9540e3cb9074cf/add",
    title: "Add TREE liquidity on SuiDex V3",
    description: "Supply TREE to the current concentrated-liquidity pool. A verified, nonzero V3 TREE position qualifies your wallet for the fifth battle card.",
    action: "Open V3 liquidity on SuiDex",
  },
  {
    id: "stake",
    label: "Stake V2",
    url: "https://dex.suidex.org/zap?pool=0x35a1be1f01f9edf7f5221d226f357d194d43c28f2a65cb38640935518d9a5bfc&stake=true",
    title: "Add and stake SuiDex V2 liquidity",
    description: "Use SuiDex's V2 staking flow. A verified, nonzero TREE position in this pool can also qualify your wallet for the fifth battle card.",
    action: "Open V2 staking on SuiDex",
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
      description="See exactly what TREE can unlock, what your wallet qualifies for, and where to buy or put TREE to work."
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
            <img src={appAsset("assets/suidex-handshake.png")} alt="SuiDex" />
            <div>
              <span>Powered by SuiDex</span>
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
                <strong>Complete the DeFi action directly on SuiDex</strong>
                <p>Wallet extensions block reliable transaction approval inside third-party embedded windows. SuiDex opens in a new tab so its wallet connection and transaction approval can work correctly; Garden Battles remains open here.</p>
              </section>
            </div>
          </div>

          <a className="gb-tree-action-launch" href={selectedTab.url} target="_blank" rel="noopener noreferrer">
            {selectedTab.action} <ArrowUpRight size={17} aria-hidden="true" />
          </a>

          <p className="gb-tree-action-safety">
            <ShieldCheck size={16} aria-hidden="true" /> No transaction starts from this panel. Review every amount in SuiDex and approve it in your wallet.
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
                  <span>Verified for eligibility</span>
                  <strong>{verifiedTree ? `${Number(verifiedTree).toLocaleString(undefined, { maximumFractionDigits: 2 })} TREE` : "Checking wallet"}</strong>
                </div>
              </div>
              <div className="gb-tree-benefits-liquid-note">
                <img src={appAsset("assets/thick.png")} alt="" aria-hidden="true" />
                <div>
                  <span>Loose TREE available in this wallet</span>
                  <strong>{treeBalance.status === "ready" ? treeBalance.exactLabel : treeBalance.label}</strong>
                  <small>Loose TREE and TREE committed to liquidity are separate balances. Your V2/V3 positions—not this loose balance—are what qualify the fifth card.</small>
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
