import { ConnectButton } from "@mysten/dapp-kit";
import { ArrowUpRight, Bot, Sparkles, Swords } from "lucide-react";
import TreePowerPanel from "@/components/TreePowerPanel";
import UtilityDrawer from "@/components/UtilityDrawer";
import { useFifthMoveEligibility } from "@/hooks/useFifthMoveEligibility";
import { useTreeBalance } from "@/hooks/useTreeBalance";
import { appAsset } from "@/lib/assets";

const QUALIFICATION_ACTIONS = [
  {
    id: "buy",
    eyebrow: "Need TREE first?",
    label: "Buy TREE",
    url: "https://www.tree-token.xyz/dapp/#swap",
    description: "Swap SUI for TREE in the Command Center. TREE held in your wallet is the starting point, but it must be added to a supported position to count toward the fifth card.",
    action: "Open TREE Swap",
  },
  {
    id: "liquidity",
    eyebrow: "Way to qualify",
    label: "Add V3 Liquidity",
    url: "https://www.tree-token.xyz/dapp/#v3",
    description: "Create a supported SUI/TREE V3 liquidity position. The TREE represented by this position counts toward the 1,000,000 TREE requirement.",
    action: "Open V3 Workspace",
  },
  {
    id: "stake",
    eyebrow: "Way to qualify",
    label: "Add & Stake V2",
    url: "https://www.tree-token.xyz/dapp/#earn",
    description: "Create V2 liquidity and stake the LP position. The TREE represented by this position counts toward the 1,000,000 TREE requirement.",
    action: "Open V2 Zap & Stake",
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
  const treeBalance = useTreeBalance(address);
  const fifthMoveEligibility = useFifthMoveEligibility(address);
  const qualification = fifthMoveEligibility.response;
  const isQualified = qualification?.status === "qualified";
  const verifiedTree = qualification?.verifiedUnderlyingTree;

  return (
    <UtilityDrawer
      eyebrow="TREE Battle Benefits"
      title="TREE Battle Benefits"
      description="Unlock a fifth move card for Garden Bot and paid PvP. See what your wallet qualifies for and how to power up."
      className="gb-tree-benefits-drawer"
      onClose={onClose}
    >
      <section className="gb-tree-benefits-at-a-glance" aria-label="Where the fifth card works">
        <strong>Where your fifth card works</strong>
        <span><Bot size={17} aria-hidden="true" /> Garden Bot: included</span>
        <span><Swords size={17} aria-hidden="true" /> Paid PvP: included</span>
        <span className="gb-tree-benefits-practice-note">Practice Mode: four-card training hand</span>
      </section>

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
                  ? "Start Garden Bot or a paid PvP match with this wallet and your fifth move card is added automatically. Practice Mode keeps the standard four-card training hand."
                  : "Build a combined qualifying position of 1,000,000 TREE to receive a fifth move card in Garden Bot and paid PvP. Practice Mode always uses four cards."}
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

      <section className="gb-tree-benefits-actions" aria-labelledby="gb-tree-benefits-actions-title">
        <div className="gb-tree-benefits-actions-head">
          <span>Next step</span>
          <h3 id="gb-tree-benefits-actions-title">Choose your next step</h3>
          <p>Need TREE? Buy it first. Already have TREE? Put it to work through a supported V3 or staked V2 position. Each button opens the correct TREE Command Center workspace.</p>
        </div>
        <div className="gb-tree-benefits-action-grid">
          {QUALIFICATION_ACTIONS.map((action) => (
            <article key={action.id} className={`gb-tree-benefits-action-card gb-tree-benefits-action-${action.id}`}>
              <span>{action.eyebrow}</span>
              <h4>{action.label}</h4>
              <p>{action.description}</p>
              <a href={action.url} target="_blank" rel="noopener noreferrer">
                {action.action} <ArrowUpRight size={17} aria-hidden="true" />
              </a>
            </article>
          ))}
        </div>
        <small className="gb-tree-benefits-action-safety">Garden Battles stays open. Review every amount in the TREE Command Center and approve transactions in your wallet.</small>
      </section>
    </UtilityDrawer>
  );
}
