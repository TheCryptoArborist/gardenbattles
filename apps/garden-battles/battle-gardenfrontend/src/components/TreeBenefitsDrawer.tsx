import { ConnectButton } from "@mysten/dapp-kit";
import { ArrowUpRight, Bot, Sparkles, Swords } from "lucide-react";
import TreePowerPanel from "@/components/TreePowerPanel";
import UtilityDrawer from "@/components/UtilityDrawer";
import { useFifthMoveEligibility } from "@/hooks/useFifthMoveEligibility";
import { useTreeBalance } from "@/hooks/useTreeBalance";
import { appAsset } from "@/lib/assets";
import type { TreeRerollStatus } from "@/lib/treePowerPresentation";

const QUALIFICATION_ACTIONS = [
  {
    id: "buy",
    eyebrow: "Need TREE first?",
    label: "Buy TREE",
    url: "https://www.tree-token.xyz/dapp/#swap",
    description: "Get TREE first. Wallet-held TREE alone does not unlock the card.",
  },
  {
    id: "liquidity",
    eyebrow: "Unlock route",
    label: "Add V3 Liquidity",
    url: "https://www.tree-token.xyz/dapp/#v3",
    description: "TREE placed here counts toward the 1,000,000 TREE unlock requirement.",
  },
  {
    id: "stake",
    eyebrow: "Unlock route",
    label: "Add & Stake V2",
    url: "https://www.tree-token.xyz/dapp/#earn",
    description: "TREE placed here counts toward the 1,000,000 TREE unlock requirement.",
  },
] as const;

type TreeBenefitsDrawerProps = {
  address?: string | null;
  isBattleActive: boolean;
  isPracticeBattle: boolean;
  currentMoveCount: number;
  rerollStatus?: TreeRerollStatus;
  rerollCostTree?: number | null;
  rerollUsed?: boolean;
  onClose: () => void;
};

export default function TreeBenefitsDrawer({
  address,
  isBattleActive,
  isPracticeBattle,
  currentMoveCount,
  rerollStatus,
  rerollCostTree,
  rerollUsed,
  onClose,
}: TreeBenefitsDrawerProps) {
  const treeBalance = useTreeBalance(address);
  const fifthMoveEligibility = useFifthMoveEligibility(address);
  const qualification = fifthMoveEligibility.response;
  const isQualified = qualification?.status === "qualified";
  const verifiedTree = qualification?.verifiedUnderlyingTree;
  const handleChooseBattle = () => {
    onClose();
    window.requestAnimationFrame(() => {
      document.querySelector(".gb-mode-select")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <UtilityDrawer
      eyebrow="TREE Battle Benefits"
      title="TREE Battle Benefits"
      description="Unlock a fifth move card for Garden Bot, Arborist Trials, and paid PvP. See whether your wallet has unlocked it and exactly what to do next."
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
              <img src={appAsset("assets/tree-battle-benefits-hero.png")} alt="Flexing NFTree character ready for battle" />
              <div className="gb-tree-benefits-spotlight-badge">
                <Sparkles size={18} aria-hidden="true" />
                <span>{isQualified ? "Battle Ready" : "Power Up"}</span>
              </div>
            </div>
            <div className="gb-tree-benefits-spotlight-copy">
              <span className="gb-tree-benefits-eyebrow">
                {isQualified ? "Fifth card unlocked" : "TREE battle advantage"}
              </span>
              <h3>{isQualified ? "Your Fifth Card Is Unlocked" : "Turn Four Choices Into Five"}</h3>
              <p>
                {isQualified
                  ? "Start Garden Bot, Arborist Trials, or a paid PvP match with this wallet and your fifth move card is added automatically. Practice Mode keeps the standard four-card training hand."
                  : "Get TREE, then place a combined total of 1,000,000 TREE into supported SuiDex liquidity or Moonbags staking to unlock a fifth move card. Practice Mode always uses four cards."}
              </p>
              <div className="gb-tree-benefits-reward-row">
                <div>
                  <span>Battle hand</span>
                  <strong>{isQualified ? "5 move cards" : "4 → 5 cards"}</strong>
                </div>
                <div>
                  <span>TREE counted toward unlock</span>
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
              <section className="gb-tree-benefits-actions-compact" aria-labelledby="gb-tree-benefits-actions-title">
                <div className="gb-tree-benefits-actions-compact-head">
                  <span>Next step</span>
                  <strong id="gb-tree-benefits-actions-title">
                    {isQualified ? "Choose a battle—your fifth card is ready" : "Buy TREE, then choose an unlock route"}
                  </strong>
                </div>
                {isQualified ? (
                  <div className="gb-tree-benefits-ready-action">
                    <p>Your qualifying TREE is already verified. Start Garden Bot or paid PvP and the fifth move card will be added automatically.</p>
                    <button type="button" onClick={handleChooseBattle}>
                      <Swords size={17} aria-hidden="true" /> Choose a Battle
                    </button>
                  </div>
                ) : (
                  <div className="gb-tree-benefits-action-grid-compact">
                    {QUALIFICATION_ACTIONS.map((action) => (
                      <a
                        key={action.id}
                        className={`gb-tree-benefits-action-compact gb-tree-benefits-action-${action.id}`}
                        href={action.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <span>{action.eyebrow}</span>
                        <strong>{action.label}</strong>
                        <small>{action.description}</small>
                        <ArrowUpRight size={16} aria-hidden="true" />
                      </a>
                    ))}
                  </div>
                )}
              </section>
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
            rerollStatus={rerollStatus}
            rerollCostTree={rerollCostTree}
            rerollUsed={rerollUsed}
            compact
          />
      </div>

    </UtilityDrawer>
  );
}
