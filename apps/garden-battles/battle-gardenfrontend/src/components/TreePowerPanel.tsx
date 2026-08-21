import { Lock, RefreshCw, Unlock, WalletCards } from "lucide-react";
import {
  mapFifthMoveResponseToPanelEligibility,
  useFifthMoveEligibility,
} from "@/hooks/useFifthMoveEligibility";
import { useTreeBalance } from "@/hooks/useTreeBalance";
import { appAsset } from "@/lib/assets";
import type { FifthMoveEligibilityResponse } from "@/lib/api";
import {
  TREE_POWER_BUY_URL,
  getFifthMovePresentation,
  getTreeRerollPresentation,
  type TreeRerollStatus,
} from "@/lib/treePowerPresentation";
import type { FifthMoveEligibility, FifthMoveQualificationSource } from "@/lib/suiDexTreePosition";
import type { TreeBalanceView } from "@/lib/treeBalance";

type TreePowerPanelProps = {
  address?: string | null;
  isBattleActive?: boolean;
  isPracticeBattle?: boolean;
  currentMoveCount?: number;
  treeBalance?: TreeBalanceView;
  fifthMoveEligibility?: FifthMoveEligibility;
  fifthMoveEligibilityResponse?: FifthMoveEligibilityResponse;
  isFifthMoveActivationLive?: boolean;
  rerollStatus?: TreeRerollStatus;
  rerollCostTree?: number | null;
  rerollUsed?: boolean;
  onReroll?: () => void;
  compact?: boolean;
};

const QUALIFICATION_SOURCES: Array<{ id: FifthMoveQualificationSource; label: string }> = [
  { id: "suidex-v2", label: "SuiDex V2" },
  { id: "suidex-v3", label: "SuiDex V3" },
  { id: "moonbags-staking", label: "Moonbags" },
];

function TreeBalancePill({ balance }: { balance: TreeBalanceView }) {
  const title =
    balance.status === "ready"
      ? `Liquid TREE wallet balance: ${balance.exactLabel}`
      : "Liquid TREE wallet balance";
  const ariaLabel =
    balance.status === "ready"
      ? `Liquid wallet balance ${balance.exactLabel}`
      : `Liquid wallet balance ${balance.label}`;

  return (
    <div
      className={`gb-tree-power-balance gb-tree-power-balance-${balance.status}`}
      title={title}
      aria-label={ariaLabel}
    >
      <img
        src={appAsset("assets/thick.png")}
        alt=""
        aria-hidden="true"
        className="gb-tree-power-token"
      />
      <div>
        <strong>{balance.label}</strong>
        <span>Liquid wallet balance</span>
      </div>
    </div>
  );
}

export default function TreePowerPanel({
  address,
  isBattleActive = false,
  isPracticeBattle = false,
  currentMoveCount = 0,
  treeBalance,
  fifthMoveEligibility,
  fifthMoveEligibilityResponse,
  isFifthMoveActivationLive = false,
  rerollStatus = "not-live",
  rerollCostTree = null,
  rerollUsed = false,
  onReroll,
  compact = false,
}: TreePowerPanelProps) {
  const queriedTreeBalance = useTreeBalance(treeBalance ? null : address);
  const queriedFifthMoveEligibility = useFifthMoveEligibility(
    fifthMoveEligibility || fifthMoveEligibilityResponse ? null : address,
  );
  const balance = treeBalance ?? queriedTreeBalance;
  const eligibility =
    fifthMoveEligibility ??
    (fifthMoveEligibilityResponse
      ? mapFifthMoveResponseToPanelEligibility(fifthMoveEligibilityResponse)
      : queriedFifthMoveEligibility.panelEligibility);
  const eligibilityResponse = fifthMoveEligibilityResponse ?? queriedFifthMoveEligibility.response;
  const fifthMove = getFifthMovePresentation({
    isBattleActive,
    currentMoveCount,
    eligibility,
    isFifthMoveActivationLive,
  });
  const reroll = getTreeRerollPresentation({
    isPracticeBattle,
    rerollStatus: rerollUsed ? "used" : rerollStatus,
    rerollCostTree,
  });
  const StatusIcon = fifthMove.isUnlocked ? Unlock : Lock;
  const currentHandValue = isBattleActive
    ? `${fifthMove.filledSlots} / ${fifthMove.slotCount}`
    : `- / ${fifthMove.slotCount}`;
  const activeSources = new Set<FifthMoveQualificationSource>(
    eligibility.status === "qualified" ? eligibility.sources : [],
  );
  const responseSourceStatus = new Map(
    eligibilityResponse?.sources.map((source) => [source.source, source.status]) ?? [],
  );
  const unavailableSources =
    eligibilityResponse?.sources
      .filter((source) => source.status === "unavailable")
      .map((source) => source.source) ?? [];
  const thresholdLabel = eligibilityResponse
    ? `${eligibilityResponse.verifiedUnderlyingTree} / ${eligibilityResponse.thresholdTree} TREE`
    : null;
  const remainingLabel =
    eligibilityResponse?.remainingTree && eligibilityResponse.status === "not-qualified"
      ? `${eligibilityResponse.remainingTree} TREE remaining`
      : null;

  return (
    <aside
      className={compact ? "gb-hud-panel gb-tree-power-panel gb-tree-power-panel-compact" : "gb-hud-panel gb-tree-power-panel"}
      aria-label="TREE Power battle utility console"
    >
      <header className="gb-tree-power-head">
        <div>
          <h2 className="gb-tree-power-title">TREE POWER</h2>
          <p className="gb-tree-power-subtitle">Battle Utility Console</p>
        </div>
        <span className="gb-tree-power-preview-chip">Battle Utilities</span>
      </header>

      {(!compact || balance.status === "ready") && <TreeBalancePill balance={balance} />}

      <section className="gb-tree-power-card gb-tree-power-fifth" aria-label="Fifth Move Unlock">
        <div className="gb-tree-power-fifth-top">
          <span className="gb-tree-power-icon-shell" aria-hidden="true">
            <StatusIcon size={18} strokeWidth={2.4} />
          </span>
          <h3>Fifth Move</h3>
          <span
            className={`gb-tree-power-status gb-tree-power-lock-status gb-tree-power-status-${
              fifthMove.isUnlocked ? "active" : "locked"
            }`}
            aria-label={`Fifth move status: ${fifthMove.statusLabel}`}
          >
            {fifthMove.isUnlocked ? "Unlocked" : "Locked"}
          </span>
        </div>

        <div className="gb-tree-power-hand-row">
          <span>Current Hand</span>
          <strong>{currentHandValue}</strong>
        </div>

        <div className="gb-tree-power-slots" aria-label={fifthMove.handLabel}>
          {Array.from({ length: fifthMove.slotCount }, (_, index) => {
            const isFilled = index < fifthMove.filledSlots;
            const isFifthSlot = index === fifthMove.slotCount - 1;
            return (
              <span
                key={index}
                className={[
                  "gb-tree-power-slot",
                  isFilled ? "gb-tree-power-slot-filled" : "",
                  isFifthSlot && !isFilled ? "gb-tree-power-slot-fifth-locked" : "",
                  isFifthSlot && isFilled ? "gb-tree-power-slot-fifth-unlocked" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
            );
          })}
        </div>

        <div className={`gb-tree-power-qualification gb-tree-power-status-${fifthMove.status}`}>
          <strong>{fifthMove.statusLabel}</strong>
          <span>{fifthMove.description}</span>
          {thresholdLabel && (
            <span className="gb-tree-power-threshold">
              Verified underlying TREE: {thresholdLabel}
            </span>
          )}
          {remainingLabel && <span className="gb-tree-power-threshold">{remainingLabel}</span>}
          {eligibilityResponse?.status === "verification-incomplete" && (
            <span className="gb-tree-power-threshold">
              Verification incomplete. Known TREE is shown; unavailable sources are not counted as zero.
            </span>
          )}
          {unavailableSources.length > 0 && eligibilityResponse?.status !== "qualified" && (
            <span className="gb-tree-power-threshold">
              Unavailable: {unavailableSources.map((source) => source.replace("-staking", "")).join(", ")}
            </span>
          )}
        </div>

        <div className="gb-tree-power-source-chips" aria-label="Fifth move qualification sources">
          {QUALIFICATION_SOURCES.map((source) => {
            const isActive = activeSources.has(source.id);
            const sourceStatus = responseSourceStatus.get(source.id);
            return (
              <span
                key={source.id}
                className={[
                  "gb-tree-power-source-chip",
                  isActive ? "gb-tree-power-source-chip-active" : "",
                  sourceStatus === "unavailable" ? "gb-tree-power-source-chip-unavailable" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {source.label}
              </span>
            );
          })}
        </div>

        {!compact && <div className="gb-tree-power-note gb-tree-power-explainer">
          <span>NFTree grants access to Garden Battles.</span>
          <span>Support TREE through SuiDex liquidity or Moonbags staking to unlock your fifth move.</span>
        </div>}
      </section>

      {compact ? (
        <details className="gb-tree-power-reroll-compact">
          <summary>TREE Reroll <span>Coming Soon</span></summary>
          <p>Once-per-battle hand replacement is planned. Cost and transaction flow are not configured yet.</p>
        </details>
      ) : <section className="gb-tree-power-card gb-tree-power-reroll" aria-label="TREE Reroll">
        <div className="gb-tree-power-card-head">
          <span className="gb-tree-power-icon-shell" aria-hidden="true">
            <RefreshCw size={18} strokeWidth={2.4} />
          </span>
          <div>
            <h3>TREE Reroll</h3>
            <p>Full hand replacement</p>
          </div>
          <span
            className={`gb-tree-power-status gb-tree-power-status-${reroll.status}`}
            aria-label={`TREE reroll status: ${reroll.statusLabel}`}
          >
            {reroll.statusLabel}
          </span>
        </div>

        <div className="gb-tree-power-reroll-facts">
          <span>Once per battle</span>
          <span>Paid in TREE</span>
          <span>Payment routes to treasury</span>
        </div>
        <div className="gb-tree-power-cost">
          <WalletCards size={16} aria-hidden="true" />
          <span>{reroll.costLabel}</span>
        </div>
        <button
          className="gb-tree-power-reroll-button"
          type="button"
          disabled={reroll.disabled}
          onClick={reroll.disabled ? undefined : onReroll}
          aria-describedby="gb-tree-power-reroll-help"
        >
          {reroll.buttonLabel}
        </button>
        <p className="gb-tree-power-note" id="gb-tree-power-reroll-help">
          {reroll.helperText}
        </p>
      </section>}

      {!compact && <section className="gb-tree-power-buy" aria-label="Buy TREE for Battle Utilities">
        <div className="gb-tree-power-buy-copy">
          <strong>Get TREE for Battle Utilities</strong>
          <span>Future TREE rerolls will use TREE during active battles.</span>
        </div>
        <a href={TREE_POWER_BUY_URL} target="_blank" rel="noopener noreferrer">
          <img
            src={appAsset("assets/suidex-handshake.png")}
            alt=""
            className="gb-tree-power-buy-icon"
            aria-hidden="true"
          />
          Buy TREE
        </a>
      </section>}
    </aside>
  );
}
