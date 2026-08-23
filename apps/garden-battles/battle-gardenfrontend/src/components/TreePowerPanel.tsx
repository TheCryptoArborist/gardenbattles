import { ArrowUpRight, CheckCircle2, Lock, RefreshCw, Unlock, WalletCards } from "lucide-react";
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

const QUALIFICATION_SOURCES: Array<{
  id: FifthMoveQualificationSource;
  label: string;
  description: string;
  logo: string;
}> = [
  {
    id: "suidex-v2",
    label: "SuiDex V2",
    description: "TREE committed to the original supported SuiDex liquidity and staking pool.",
    logo: "assets/suidex-handshake.png",
  },
  {
    id: "suidex-v3",
    label: "SuiDex V3",
    description: "TREE currently supplied to the supported SuiDex V3 liquidity pool.",
    logo: "assets/suidex-handshake.png",
  },
  {
    id: "moonbags-staking",
    label: "Moonbags Staking",
    description: "TREE currently deposited in the supported Moonbags staking program.",
    logo: "assets/thick.png",
  },
];

function formatTreeAmount(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "0";
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return String(value);
  return numericValue.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

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
  const StatusIcon = eligibility.status === "qualified" ? Unlock : Lock;
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
    ? `${formatTreeAmount(eligibilityResponse.verifiedUnderlyingTree)} of ${formatTreeAmount(eligibilityResponse.thresholdTree)} TREE required`
    : null;
  const remainingLabel =
    eligibilityResponse?.remainingTree && eligibilityResponse.status === "not-qualified"
      ? `${formatTreeAmount(eligibilityResponse.remainingTree)} more TREE must be added to supported positions`
      : null;
  const qualificationTone = eligibility.status === "qualified"
    ? "active"
    : eligibility.status === "checking"
      ? "checking"
      : eligibility.status === "not-connected"
        ? "connect"
        : eligibility.status === "verification-incomplete" || eligibility.status === "unavailable"
          ? "unavailable"
          : "locked";
  const qualificationLabel =
    eligibility.status === "qualified"
      ? "Fifth card unlocked"
      : eligibility.status === "checking"
        ? "Checking supported TREE positions"
        : eligibility.status === "not-connected"
          ? "Connect wallet to check"
          : eligibility.status === "verification-incomplete"
            ? "Some positions could not be checked"
            : eligibility.status === "unavailable"
              ? "Eligibility check temporarily unavailable"
              : "Fifth card locked — action required";
  const panelHeading =
    eligibility.status === "qualified"
      ? "Your Fifth Card Is Ready"
      : eligibility.status === "checking"
        ? "Checking Your TREE Benefits"
        : eligibility.status === "not-connected"
          ? "Connect to Check Your TREE Benefits"
          : eligibility.status === "verification-incomplete"
            ? "We Could Not Check Every Position"
            : eligibility.status === "unavailable"
              ? "Eligibility Check Temporarily Unavailable"
              : "Unlock Your Fifth Card";
  const panelSubtitle =
    eligibility.status === "qualified"
      ? "Your supported liquidity and staking positions meet the fifth-card requirement."
      : eligibility.status === "checking"
        ? "The game is checking SuiDex V2, SuiDex V3, and Moonbags Staking."
        : eligibility.status === "not-connected"
          ? "Connect a wallet to check supported liquidity and staking positions."
          : eligibility.status === "verification-incomplete" || eligibility.status === "unavailable"
            ? "Nothing is treated as zero when a supported service cannot be checked."
            : "Your wallet needs 1,000,000 TREE placed in the supported liquidity or staking options shown below.";
  const preBattleExplanation =
    eligibility.status === "qualified"
      ? "You are ready. Start Garden Bot or a paid PvP match and the fifth card is added automatically. This check does not move or spend your TREE."
      : eligibility.status === "checking"
        ? "This is a read-only wallet check. No TREE is moved or spent while the game checks your positions."
        : eligibility.status === "not-connected"
          ? "Connect your wallet to run a read-only eligibility check. Checking does not move or spend your TREE."
          : eligibility.status === "verification-incomplete" || eligibility.status === "unavailable"
            ? "Try again shortly. A source that cannot be checked is not counted as zero."
            : "Your wallet has not unlocked the fifth card yet. First get TREE, then place a total of 1,000,000 TREE into supported SuiDex liquidity or Moonbags staking. TREE sitting loose in your wallet does not count toward this unlock.";

  return (
    <aside
      className={compact ? "gb-hud-panel gb-tree-power-panel gb-tree-power-panel-compact" : "gb-hud-panel gb-tree-power-panel"}
      aria-label="TREE battle benefits and fifth card eligibility"
    >
      <header className="gb-tree-power-head">
        <img className="gb-tree-power-head-logo" src={appAsset("assets/thick.png")} alt="TREE" />
        <div className="gb-tree-power-head-copy">
          <h2 className="gb-tree-power-title">{panelHeading}</h2>
          <p className="gb-tree-power-subtitle">{panelSubtitle}</p>
        </div>
        <span className="gb-tree-power-preview-chip">Read Only</span>
      </header>

      {!compact && <TreeBalancePill balance={balance} />}

      <section className={`gb-tree-power-card gb-tree-power-fifth gb-tree-power-fifth-${qualificationTone}`} aria-label="Fifth Move Unlock">
        <div className="gb-tree-power-fifth-top">
          <span className="gb-tree-power-icon-shell" aria-hidden="true">
            <StatusIcon size={18} strokeWidth={2.4} />
          </span>
          <h3>Your Fifth Move Card</h3>
          <span
            className={`gb-tree-power-status gb-tree-power-lock-status gb-tree-power-status-${qualificationTone}`}
            aria-label={`Fifth card status: ${qualificationLabel}`}
          >
            {qualificationTone === "active" && (
              <CheckCircle2 className="gb-tree-power-unlocked-check" size={16} strokeWidth={3} aria-hidden="true" />
            )}
            <span>{qualificationLabel}</span>
          </span>
        </div>

        <p className="gb-tree-power-plain-explainer">
          This benefit works in Garden Bot and paid PvP. Put enough TREE into one or more supported liquidity or staking options and your hand changes from four move cards to five. Practice Mode keeps a four-card training hand.
        </p>

        {isBattleActive ? (
          <>
            <div className="gb-tree-power-hand-row">
              <span>Cards currently in your hand</span>
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
          </>
        ) : (
          <div className="gb-tree-power-hand-preview">
            <span>If you start Garden Bot or paid PvP now</span>
            <strong>{eligibility.status === "qualified" ? "You receive five move cards" : "Standard hand: four move cards"}</strong>
          </div>
        )}

        <div className={`gb-tree-power-qualification gb-tree-power-qualification-${qualificationTone} gb-tree-power-status-${fifthMove.status}`}>
          <strong>{isBattleActive ? fifthMove.statusLabel : qualificationLabel}</strong>
          <span>
            {isBattleActive
              ? fifthMove.description
              : preBattleExplanation}
          </span>
          {thresholdLabel && (
            <span className="gb-tree-power-threshold">
              TREE currently counted toward your unlock: {thresholdLabel}
            </span>
          )}
          {remainingLabel && <span className="gb-tree-power-threshold">To unlock: {remainingLabel}.</span>}
          {!isBattleActive && eligibility.status === "not-qualified" && (
            <a className="gb-tree-power-unlock-cta" href={TREE_POWER_BUY_URL} target="_blank" rel="noopener noreferrer">
              Step 1: Buy TREE <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          )}
          {eligibilityResponse?.status === "verification-incomplete" && (
            <span className="gb-tree-power-threshold">
              We could not check every supported position. Verified amounts are shown, and unavailable sources are not counted as zero.
            </span>
          )}
          {unavailableSources.length > 0 && eligibilityResponse?.status !== "qualified" && (
            <span className="gb-tree-power-threshold">
              Could not check: {unavailableSources.map((source) => source.replace("-staking", "")).join(", ")}. Try again shortly.
            </span>
          )}
        </div>

        <div className="gb-tree-power-source-chips" aria-label="Ways to qualify for the fifth battle card">
          {QUALIFICATION_SOURCES.map((source) => {
            const isActive = activeSources.has(source.id);
            const sourceStatus = responseSourceStatus.get(source.id);
            const responseSource = eligibilityResponse?.sources.find((entry) => entry.source === source.id);
            const hasVerifiedTree = responseSource?.status === "qualified-data";
            const sourceResult =
              responseSource?.status === "qualified-data"
                ? `Counts toward requirement: ${formatTreeAmount(responseSource.underlyingTreeDisplay)} TREE`
                : responseSource?.status === "verified-zero"
                  ? eligibility.status === "qualified"
                    ? "No TREE found here. Your other supported positions already meet the requirement."
                    : "No TREE is currently counted from this supported position."
                  : responseSource?.status === "unavailable"
                    ? "Could not check this position right now."
                    : "Checking this position now…";
            return (
              <span
                key={source.id}
                className={[
                  "gb-tree-power-source-chip",
                  isActive ? "gb-tree-power-source-chip-active" : "",
                  hasVerifiedTree ? "gb-tree-power-source-chip-has-tree" : "",
                  sourceStatus === "verified-zero" ? "gb-tree-power-source-chip-empty" : "",
                  sourceStatus === "unavailable" ? "gb-tree-power-source-chip-unavailable" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <img src={appAsset(source.logo)} alt="" aria-hidden="true" />
                <span>
                  <strong>{source.label}</strong>
                  <small>{source.description}</small>
                  <em>{hasVerifiedTree ? "✓ " : ""}{sourceResult}</em>
                </span>
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
          <summary>TREE Reroll <span>{reroll.statusLabel}</span></summary>
          <p><strong>Garden Bot:</strong> One free reroll replaces the four standard cards and preserves your fifth card.</p>
          <p><strong>Paid PvP:</strong> One full-hand reroll costs 20,000 TREE. The battle screen shows the price before your wallet opens.</p>
          <p>{reroll.helperText}</p>
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
          <span>TREE removed from circulation</span>
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
          <span>Active TREE rerolls use liquid TREE held directly in your wallet.</span>
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
