import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { AlertTriangle, BookOpen, CheckCircle2, ChevronDown, ChevronRight, Gamepad2, House, LoaderCircle, Menu, ShoppingBag, Sparkles, Trophy, WalletCards, X } from "lucide-react";
import { ConnectButton } from "@mysten/dapp-kit";
import MobileWalletLaunchers from "@/components/MobileWalletLaunchers";
import { useSuiWallet, type PvpQueueState } from "@/hooks/useSuiWallet";
import { usePracticeBattle } from "@/hooks/usePracticeBattle";
import {
  MOVE_LABELS,
  MOVE_META,
  SUI_CONFIG,
  getPvpMatchDisplayLabel,
  moveGrowsSelf,
  type PvpMatchTarget,
} from "@/lib/sui-config";
import { PRACTICE_PLAYER_ADDRESS } from "@/lib/practiceBattle";
import BattleDialog from "@/components/BattleDialog";
import AdminPanel from "@/components/AdminPanel";
import HowToPlay from "@/components/HowToPlay";
import BattleLog from "@/components/BattleLog";
import PlayerRecord from "@/components/PlayerRecord";
import ForestPower from "@/components/ForestPower";
import { appAsset } from "@/lib/assets";
import { appRoute } from "@/lib/routes";
import { resolvePvpQueueUiAfterRefund } from "@/lib/pvpQueueState";
import {
  getFifthMoveDraftState,
  isUnlockedFifthMoveCard,
} from "@/lib/pvpFifthMoveDraft";
import {
  formatPvpJoinFailureMessage,
  isWalletCancelMessage,
} from "@/lib/pvpJoinError";
import PrizePayoutPanel from "@/components/PrizePayoutPanel";
import BattleResultModal from "@/components/BattleResultModal";
import ModeCrest from "@/components/ModeCrest";
import MoveCardFace from "@/components/MoveCardFace";
import CardGuide from "@/components/CardGuide";
import TreeBenefitsDrawer from "@/components/TreeBenefitsDrawer";
import NftreeAcquisitionDrawer from "@/components/NftreeAcquisitionDrawer";
import { useFifthMoveEligibility } from "@/hooks/useFifthMoveEligibility";
import { getFifthCardPromoPresentation } from "@/lib/fifthCardPromo";
import {
  buildBattleResultShareText,
  buildSmsShareUrl,
  getBattleResultShareOptions,
} from "@/lib/battleResultShare";
import { createBattleResultShareImage } from "@/lib/battleResultShareImage";
import {
  getBattleTreeAssetPath,
  resolveGrowthStage,
  type GrowthStage,
} from "@/lib/battleTreeArtwork";

const ecosystemLinks = [
  { label: "Home", href: "https://www.tree-token.xyz/", testId: "home" },
];

function formatHandSummary(moveIds: number[]) {
  const counts = { attack: 0, growth: 0, hybrid: 0, treePower: 0 };
  moveIds.forEach((moveId) => {
    const meta = MOVE_META[moveId];
    if (!meta) return;
    if (meta.fifthExclusive) counts.treePower += 1;
    else counts[meta.type] += 1;
  });
  return [
    counts.attack ? `${counts.attack} Attack` : null,
    counts.growth ? `${counts.growth} Growth` : null,
    counts.hybrid ? `${counts.hybrid} Hybrid` : null,
    counts.treePower ? `${counts.treePower} TREE Power` : null,
  ].filter(Boolean).join(" · ");
}

function getCurrentMoveOutcome(
  moveId: number,
  playerGrowth: number,
  opponentGrowth: number,
  lastPlayerMoveId: number | undefined,
  lastOpponentMoveId: number | undefined,
) {
  const opponentLastType = lastOpponentMoveId ? MOVE_META[lastOpponentMoveId]?.type : undefined;
  const playerLastType = lastPlayerMoveId ? MOVE_META[lastPlayerMoveId]?.type : undefined;
  switch (moveId) {
    case 2: return opponentGrowth >= 40 ? "Current result: drains 12 Growth" : "Current result: drains 8 Growth";
    case 5: return opponentLastType === "growth" ? "Active bonus: drains 12 Growth" : "Current result: drains 8 Growth";
    case 7: return playerGrowth < opponentGrowth ? "Active bonus: drains 13 Growth" : "Current result: drains 10 Growth";
    case 15: return playerGrowth < opponentGrowth ? "Active bonus: gains 12 Growth" : "Current result: gains 8 Growth";
    case 16: return playerGrowth >= 4 ? "Available: spend 4 to drain 16 Growth" : "Needs at least 4 Growth";
    case 22: return opponentLastType === "attack" ? "Active bonus: gains 14 Growth" : "Current result: gains 10 Growth";
    case 26: return playerLastType === "attack" ? "Active bonus: gains 13 Growth" : "Current result: gains 11 Growth";
    case 28: return playerGrowth <= 10 ? "Active bonus: gains 13 Growth" : "Current result: gains 10 Growth";
    case 34: return playerGrowth < opponentGrowth ? "Active bonus: gains 11 Growth" : "Current result: gains 10 Growth";
    default: return null;
  }
}

function ArboretumComingSoonPromo() {
  return (
    <section className="gb-arboretum-promo" aria-label="Arboretum coming soon">
      <div className="gb-arboretum-promo-panel">
        <img
          src={appAsset("assets/arboretum-promo.png")}
          alt="COMING SOON!!! Arboretum. Plant your NFTrees and EARN SUI!!!"
          className="gb-arboretum-promo-image"
        />
      </div>

      <details className="gb-arboretum-mobile-card">
        <summary>
          <span>COMING SOON!!!</span>
          <strong>Arboretum</strong>
          <small>Plant your NFTrees and EARN SUI!!!</small>
        </summary>
        <div className="gb-arboretum-mobile-card-body">
          <p>
            A future TREE utility for planting, care, rewards, and garden
            progression.
          </p>
          <a
            href="https://nftree.net"
            target="_blank"
            rel="noopener noreferrer"
          >
            Buy NFTree
          </a>
        </div>
      </details>
    </section>
  );
}

export type BattleRole =
  | "player-1"
  | "player-2"
  | "player-3"
  | "player-4"
  | "garden-bot";

type GrowthStageVisual = {
  role: BattleRole;
  stage: GrowthStage;
  imageUrl: string;
  className: string;
  alt: string;
};

const DISMISSED_RESULT_STORAGE_KEY = "garden-battles:dismissed-results";
const MAX_DISMISSED_RESULTS = 20;
const RESULT_MODAL_ARM_MS = 5 * 60 * 1000;
const RESULT_PLAY_AGAIN_TIMEOUT_MS = 90 * 1000;
const PVP_WINNER_PAYOUT_MIST = 5_000_000_000;
const PVP_TREE_SUPPORT_MIST = 1_000_000_000;
type BattleDialogKind =
  | "info"
  | "start-pending"
  | "start-timeout"
  | "start-error"
  | "start-cancelled"
  | "pvp-join-pending"
  | "pvp-join-cancelled"
  | "pvp-join-error"
  | "pvp-refund-pending"
  | "pvp-refund-cancelled"
  | "pvp-refund-success"
  | "pvp-refund-error";

function readDismissedResultKeys(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(DISMISSED_RESULT_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed)
      ? parsed.filter((key): key is string => typeof key === "string")
      : [];
  } catch {
    return [];
  }
}

function writeDismissedResultKeys(keys: string[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      DISMISSED_RESULT_STORAGE_KEY,
      JSON.stringify(keys.slice(-MAX_DISMISSED_RESULTS)),
    );
  } catch {
    // localStorage can be unavailable in strict privacy contexts.
  }
}

function formatSuiAmount(mist: number) {
  return `${(mist / 1e9).toLocaleString(undefined, {
    maximumFractionDigits: 9,
  })} SUI`;
}

function formatRefundFailureMessage(message: string) {
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes("temporarily rate-limiting requests")) {
    return "The Sui network is temporarily rate-limiting requests. Your queue deposit has not been reported missing. Wait a moment and try again.";
  }
  if (lowerMessage.includes("could not read your pvp queue entry")) {
    return "Could not read your PvP queue entry. Refresh the page and try again.";
  }
  if (lowerMessage.includes("not in the queue")) {
    return "No active refundable PvP queue entry was found for this wallet.";
  }
  if (lowerMessage.includes("could not construct the refund transaction")) {
    return message;
  }
  if (lowerMessage.includes("moveabort") || lowerMessage.includes("move abort")) {
    return `Refund transaction was rejected on-chain: ${message}`;
  }
  return message.trim()
    ? `Could not refund your queue deposit: ${message}`
    : "Could not refund your queue deposit. Try again.";
}

function resolveGrowthStageVisual({
  role,
  growth,
  growthTarget = 100,
  nftImageUrl,
  revealNft = false,
}: {
  role: BattleRole;
  growth: number;
  growthTarget?: number;
  nftImageUrl?: string;
  revealNft?: boolean;
}): GrowthStageVisual {
  const stage = resolveGrowthStage(growth, growthTarget);
  const isGardenBot = role === "garden-bot";
  const imageUrl =
    !isGardenBot && revealNft && nftImageUrl
      ? nftImageUrl
      : appAsset(getBattleTreeAssetPath(stage, isGardenBot));
  const roleLabel = isGardenBot
    ? "Garden Bot"
    : `Player ${role.replace("player-", "")}`;

  return {
    role,
    stage,
    imageUrl,
    className: `growth-stage-art growth-stage-art-${role} growth-stage-${stage}`,
    alt: `${roleLabel} growth stage ${stage}`,
  };
}

export default function Battle() {
  const {
    isConnected,
    address,
    battleState: verifiedBattleState,
    isWaiting,
    pvpQueueState,
    entryFeeMist,
    isMyTurn: isVerifiedTurn,
    actionLog,
    joinBattle,
    startBotBattle,
    useAbility,
    rerollHand,
    claimTimeoutWin,
    forfeitBattle,
    adminForceClose,
    cancelQueue,
    refreshPvpQueueState,
    refreshActivePvpBattle,
    refreshCurrentBattleState,
    moveLifecycleStage,
    isMoveTransactionPending,
    treeRerollLifecycleStage,
    isTreeRerollTransactionPending,
    treeRerollCostTree,
    isBattleRefreshPending,
    recoverableBattleError,
    dismissRecoverableBattleError,
    getFirstValidSaplingNft,
  } = useSuiWallet();
  const fifthCardEligibility = useFifthMoveEligibility(address);
  const fifthCardPromo = getFifthCardPromoPresentation(fifthCardEligibility.status);
  const {
    battleState: practiceBattleState,
    actionLog: practiceActionLog,
    isPracticeActive,
    startPracticeBattle,
    usePracticeMove,
    clearPracticeBattle,
  } = usePracticeBattle();
  const battleState = practiceBattleState ?? verifiedBattleState;
  const effectiveActionLog = isPracticeActive ? practiceActionLog : actionLog;
  const effectiveAddress = isPracticeActive ? PRACTICE_PLAYER_ADDRESS : address;
  const isMyTurn = isPracticeActive
    ? !!practiceBattleState && !practiceBattleState.finished && !practiceBattleState.winner
    : isVerifiedTurn;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState("");
  const [dialogKind, setDialogKind] = useState<BattleDialogKind>("info");
  const [hasScanned, setHasScanned] = useState(false);
  const [playerAnimation, setPlayerAnimation] = useState("");
  const [opponentAnimation, setOpponentAnimation] = useState("");
  const [prevPlayerGrowth, setPrevPlayerGrowth] = useState<number | null>(null);
  const [prevOpponentGrowth, setPrevOpponentGrowth] = useState<number | null>(
    null,
  );
  const [arboretumModalOpen, setArboretumModalOpen] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isCheckingPvpQueue, setIsCheckingPvpQueue] = useState(false);
  const [selectedPvpTarget, setSelectedPvpTarget] =
    useState<PvpMatchTarget>(50);
  const [localPvpQueued, setLocalPvpQueued] = useState(false);
  const [recoveredPvpQueueState, setRecoveredPvpQueueState] =
    useState<PvpQueueState | null>(null);
  const [isStartingBot, setIsStartingBot] = useState(false);
  const [isClaimingTimeout, setIsClaimingTimeout] = useState(false);
  const [isForfeiting, setIsForfeiting] = useState(false);
  const [isAdminClosing, setIsAdminClosing] = useState(false);
  const [rerollReviewOpen, setRerollReviewOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [mobileProfileExpanded, setMobileProfileExpanded] = useState(false);
  const [modeCardsExpanded, setModeCardsExpanded] = useState(false);
  const [cardGuideOpen, setCardGuideOpen] = useState(false);
  const [cardGuideCurrentHandOnly, setCardGuideCurrentHandOnly] = useState(false);
  const [utilityDrawer, setUtilityDrawer] = useState<"tree" | "nftree" | null>(null);
  const [dismissedResultKeys, setDismissedResultKeys] = useState<string[]>(
    () => readDismissedResultKeys(),
  );
  const [liveResultKey, setLiveResultKey] = useState<string | null>(null);
  const [isResultPlayAgainStarting, setIsResultPlayAgainStarting] = useState(false);
  const [selectedResultShareOptionId, setSelectedResultShareOptionId] =
    useState("");
  const entryFeeLabel = formatSuiAmount(entryFeeMist);
  const activePvpQueueState = recoveredPvpQueueState ?? pvpQueueState;
  const pvpQueueEntryFeeLabel = formatSuiAmount(
    activePvpQueueState?.entryFeeMist ?? entryFeeMist,
  );
  const pvpWinnerPayoutLabel = formatSuiAmount(PVP_WINNER_PAYOUT_MIST);
  const pvpTreeSupportLabel = formatSuiAmount(PVP_TREE_SUPPORT_MIST);
  const selectedPvpMatchLabel = getPvpMatchDisplayLabel(selectedPvpTarget);
  const activePvpMatchLabel =
    activePvpQueueState?.matchLabel ??
    (battleState && !battleState.isBotBattle
      ? battleState.matchLabel ||
        getPvpMatchDisplayLabel(
          (battleState.targetGrowth as PvpMatchTarget | undefined) ?? 100,
        )
      : selectedPvpMatchLabel);
  const [playerNftImageUrl, setPlayerNftImageUrl] = useState<string | null>(
    null,
  );
  const [opponentNftImageUrl, setOpponentNftImageUrl] = useState<string | null>(
    null,
  );
  const [pendingMoveId, setPendingMoveId] = useState<number | null>(null);
  const [selectedFifthMoveId, setSelectedFifthMoveId] = useState<number | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const inlineErrorTimer = useRef<NodeJS.Timeout | null>(null);

  const openCardGuide = (currentHandOnly = false) => {
    setCardGuideCurrentHandOnly(currentHandOnly);
    setCardGuideOpen(true);
  };

  const battleFocusRef = useRef<HTMLElement | null>(null);
  const pvpQueuePanelRef = useRef<HTMLElement | null>(null);
  const playerAnimationTimer = useRef<NodeJS.Timeout | null>(null);
  const opponentAnimationTimer = useRef<NodeJS.Timeout | null>(null);
  const resultModalArmedRef = useRef(false);
  const resultModalArmedBattleIdRef = useRef<string | null>(null);
  const resultModalArmedUntilRef = useRef(0);
  const liveResultKeysShownRef = useRef<Set<string>>(new Set());
  const resultPlayAgainTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pvpQueueActivationKeyRef = useRef<string | null>(null);
  const pvpQueueWalletRef = useRef<string | null>(null);

  const showInlineError = (message: string) => {
    if (inlineErrorTimer.current) clearTimeout(inlineErrorTimer.current);
    setInlineError(message);
    inlineErrorTimer.current = setTimeout(() => setInlineError(null), 8000);
  };

  const handleRefreshBattle = async () => {
    const refreshed = await refreshCurrentBattleState("recoverable error panel");
    if (!refreshed) {
      showInlineError("Move confirmed on-chain, but the battle state could not be refreshed.");
    }
  };

  useEffect(() => {
    if (moveLifecycleStage === "leaderboard-sync-failed") {
      showInlineError("Move confirmed. Leaderboard sync will retry.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveLifecycleStage]);

  const handleJoinBattle = async () => {
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    setIsJoining(true);
    try {
      setDialogOpen(true);
      setDialogKind("info");
      setDialogMessage("Scanning for NFTs...");

      const nftData = await getFirstValidSaplingNft(address!);

      if (nftData) {
        setDialogKind("info");
        setDialogMessage(
          `Preparing PvP queue entry\n\n${selectedPvpMatchLabel}\n\nChecking on-chain settings before wallet approval.`,
        );
        setPlayerNftImageUrl(nftData.imageUrl || null);
        const joinResult = await joinBattle(nftData, selectedPvpTarget);
        setLocalPvpQueued(true);
        if (joinResult.status === "syncing") {
          setDialogOpen(true);
          setDialogKind("info");
          setDialogMessage(joinResult.message);
        } else {
          setDialogOpen(false);
          setDialogMessage("");
          setDialogKind("info");
        }
        setModeCardsExpanded(false);
        setUtilityDrawer(null);
        scrollToBattleFocus();
      } else {
        setDialogKind("info");
        setDialogMessage(
          "No whitelisted NFT found. Contact admin to whitelist your collection.",
        );
      }
    } catch (error: any) {
      const message = error?.message || "";
      const isCancelled = isWalletCancelMessage(message);
      setDialogOpen(true);
      setDialogKind(isCancelled ? "pvp-join-cancelled" : "pvp-join-error");
      setDialogMessage(formatPvpJoinFailureMessage(message));
    } finally {
      setIsJoining(false);
    }
  };

  const handleStartBotBattle = async () => {
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    setIsStartingBot(true);
    setLiveResultKey(null);
    resultModalArmedRef.current = false;
    resultModalArmedBattleIdRef.current = null;
    resultModalArmedUntilRef.current = 0;
    try {
      setDialogOpen(true);
      setDialogMessage("Scanning for NFTs...");

      const nftData = await getFirstValidSaplingNft(address!);

      if (nftData) {
        setDialogKind("start-pending");
        setDialogMessage(
          "NFTree found!\n\nApprove in your wallet to start Garden Bot.\n\nReject to cancel.",
        );
        setPlayerNftImageUrl(nftData.imageUrl || null);
        await startBotBattle(nftData, {
          onStatus: (status) => {
            if (status === "wallet-request-opened") {
              setDialogKind("start-pending");
              setDialogMessage(
                "NFTree found!\n\nApprove in your wallet to start Garden Bot.\n\nReject to cancel.",
              );
            }
            if (status === "transaction-digest-received") {
              setDialogKind("start-pending");
              setDialogMessage(
                "Transaction confirmed.\n\nCreating verified Garden Bot battle...",
              );
            }
            if (status === "battle-state-loaded") {
              setDialogKind("start-pending");
              setDialogMessage("Battle ready.");
            }
          },
        });
        setDialogOpen(false);
        setDialogMessage("");
        setDialogKind("info");
        setModeCardsExpanded(false);
        setUtilityDrawer(null);
        scrollToBattleFocus();
      } else {
        setDialogKind("info");
        setDialogMessage(
          "No whitelisted NFT found. Contact admin to whitelist your collection.",
        );
      }
    } catch (error: any) {
      setIsStartingBot(false);
      const message = error?.message || "";
      const lowerMessage = message.toLowerCase();
      const friendlyMessage =
        lowerMessage.includes("timed out waiting")
          ? "Timed out waiting for the Garden Bot battle to start. Please try again."
          : lowerMessage.includes("could not scan your nftrees")
            ? "Could not scan your NFTrees because the Sui RPC request failed. Wait a moment and try again."
          : lowerMessage.includes("did not refresh")
            ? "Battle transaction confirmed, but the game did not refresh. Try Refresh Battle."
          : lowerMessage.includes("reject") ||
              lowerMessage.includes("cancel") ||
              lowerMessage.includes("denied") ||
              lowerMessage.includes("declined")
            ? "Start cancelled in wallet."
            : "Could not start Garden Bot battle. Try again.";
      setDialogKind(
        lowerMessage.includes("timed out waiting")
          ? "start-timeout"
          : lowerMessage.includes("did not refresh")
            ? "start-error"
          : lowerMessage.includes("reject") ||
              lowerMessage.includes("cancel") ||
              lowerMessage.includes("denied") ||
              lowerMessage.includes("declined")
            ? "start-cancelled"
            : "start-error",
      );
      setDialogOpen(true);
      setDialogMessage(friendlyMessage);
    } finally {
      setIsStartingBot(false);
    }
  };

  const scrollToBattleFocus = () => {
    window.setTimeout(() => {
      battleFocusRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
  };

  const scrollToPvpQueuePanel = () => {
    window.setTimeout(() => {
      pvpQueuePanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
  };

  const clearRecoveredPvpQueue = (reason: string) => {
    if (recoveredPvpQueueState) {
      console.info(`[pvp-status] queue recovery cleared: ${reason}`);
    }
    setRecoveredPvpQueueState(null);
    pvpQueueActivationKeyRef.current = null;
    pvpQueueWalletRef.current = null;
  };

  const clearPvpQueueUiAfterRefundSuccess = () => {
    const cleared = resolvePvpQueueUiAfterRefund(
      {
        localPvpQueued,
        recoveredQueueState: recoveredPvpQueueState,
        activationKey: pvpQueueActivationKeyRef.current,
        recoveryWallet: pvpQueueWalletRef.current,
      },
      "success",
    );
    setLocalPvpQueued(cleared.localPvpQueued);
    setRecoveredPvpQueueState(cleared.recoveredQueueState);
    pvpQueueActivationKeyRef.current = cleared.activationKey;
    pvpQueueWalletRef.current = cleared.recoveryWallet;
  };

  const activatePvpQueuePanel = (
    queueState?: Partial<PvpQueueState> | null,
    options: { scroll?: boolean } = {},
  ) => {
    const shouldScroll = options.scroll ?? true;
    const activationKey = queueState
      ? `${queueState.queueId ?? "queue"}:${queueState.entryFeeMist ?? "entry"}`
      : "local";
    if (pvpQueueActivationKeyRef.current === activationKey) {
      console.info("[pvp-status] queue panel already active");
      if (shouldScroll) scrollToPvpQueuePanel();
      return;
    } else {
      console.info("[pvp-status] queue panel activated", {
        queueId: queueState?.queueId,
        entryFeeMist: queueState?.entryFeeMist,
      });
      pvpQueueActivationKeyRef.current = activationKey;
    }
    if (queueState?.queueId) {
      console.info("[pvp-status] queue recovery pinned", {
        queueId: queueState.queueId,
        entryFeeMist: queueState.entryFeeMist,
      });
      setRecoveredPvpQueueState({
        queueId: queueState.queueId,
        player:
          "player" in queueState && typeof queueState.player === "string"
            ? queueState.player
            : address?.toLowerCase() ?? "",
        entryFeeMist: queueState.entryFeeMist ?? entryFeeMist,
        targetGrowth:
          (queueState.targetGrowth as PvpMatchTarget | undefined) ?? 100,
        matchLabel:
          queueState.matchLabel ??
          getPvpMatchDisplayLabel(
            (queueState.targetGrowth as PvpMatchTarget | undefined) ?? 100,
          ),
        queueType: queueState.queueType ?? "legacy",
      });
      pvpQueueWalletRef.current = address?.toLowerCase() ?? null;
    } else if (recoveredPvpQueueState) {
      console.info("[pvp-status] queue recovery retained");
    }
    setLocalPvpQueued(true);
    setModeCardsExpanded(false);
    setUtilityDrawer(null);
    if (shouldScroll) scrollToPvpQueuePanel();
  };

  const handleForceRefund = async () => {
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    setIsRefunding(true);
    try {
      setDialogOpen(true);
      setDialogKind("info");
      setDialogMessage(
        "Checking your PvP queue entry before requesting a refund.",
      );
      const refundResult = await cancelQueue({
        onWalletApprovalRequested: (queueState) => {
          const refundLabel = formatSuiAmount(queueState.entryFeeMist);
          setDialogOpen(true);
          setDialogKind("pvp-refund-pending");
          setDialogMessage(
            `Refund requested\n\nWaiting for wallet approval to refund your ${refundLabel}.\n\nApprove or reject the request in your wallet.`,
          );
        },
        onRefundConfirmed: () => {
          console.info("[pvp-status] queue recovery cleared: refund confirmed");
          clearPvpQueueUiAfterRefundSuccess();
          setModeCardsExpanded(true);
        },
      });
      console.info("[pvp-status] queue recovery cleared: refund success");
      clearPvpQueueUiAfterRefundSuccess();
      setModeCardsExpanded(true);
      setDialogOpen(true);
      setDialogKind("pvp-refund-success");
      const refundCompleteMessage = `Refund complete. Your ${formatSuiAmount(refundResult.queueState.entryFeeMist)} queue deposit was returned.`;
      setDialogMessage(
        refundResult.verificationNotice
          ? `${refundCompleteMessage} ${refundResult.verificationNotice}`
          : refundCompleteMessage,
      );
    } catch (error: any) {
      const message = error?.message || "";
      const isCancelled = isWalletCancelMessage(message);
      const noQueueFound = message.toLowerCase().includes("not in the queue");
      if (noQueueFound) {
        setLocalPvpQueued(false);
        clearRecoveredPvpQueue("confirmed no queue");
        void refreshPvpQueueState().catch((err) => {
          console.warn("[pvp-status] queue check failed", err);
        });
      }
      setDialogOpen(true);
      setDialogKind(isCancelled ? "pvp-refund-cancelled" : "pvp-refund-error");
      setDialogMessage(
        isCancelled
          ? "Refund cancelled in wallet."
          : formatRefundFailureMessage(message),
      );
    } finally {
      setIsRefunding(false);
    }
  };

  const handleCheckPvpQueueStatus = async () => {
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    setIsCheckingPvpQueue(true);
    console.info("[pvp-status] check button clicked");
    try {
      console.info("[pvp-status] checking queue");
      const queueState = await refreshPvpQueueState();
      console.info("[pvp-status] queue state returned", {
        found: !!queueState,
        queueId: queueState?.queueId,
        entryFeeMist: queueState?.entryFeeMist,
      });
      setLocalPvpQueued(!!queueState);
      if (queueState) {
        activatePvpQueuePanel(queueState);
        setDialogOpen(false);
        setDialogKind("info");
        setDialogMessage("");
      } else {
        console.info("[pvp-status] no queue found");
        const activeBattle = await refreshActivePvpBattle("queue status check");
        if (activeBattle) {
          setLocalPvpQueued(false);
          clearRecoveredPvpQueue("active PvP battle found");
          setDialogOpen(false);
          setDialogKind("info");
          setDialogMessage("");
          scrollToBattleFocus();
        } else {
          setLocalPvpQueued(false);
          clearRecoveredPvpQueue("confirmed no queue");
          setDialogOpen(true);
          setDialogKind("info");
          setDialogMessage(
            "No active refundable PvP queue entry was found for this wallet.",
          );
        }
      }
    } catch (err) {
      console.warn("[pvp-status] queue check failed", err);
      setDialogOpen(true);
      setDialogKind("info");
      setDialogMessage("Could not check PvP queue status. Try again.");
    } finally {
      setIsCheckingPvpQueue(false);
    }
  };

  const handleForfeitBattle = async () => {
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    setIsForfeiting(true);
    try {
      await forfeitBattle();
      setDialogOpen(true);
      setDialogMessage("You have forfeited the battle.");
    } catch (error: any) {
      setDialogOpen(true);
      setDialogMessage(`Forfeit failed: ${error.message}`);
    } finally {
      setIsForfeiting(false);
    }
  };

  const handleClaimTimeout = async () => {
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    setIsClaimingTimeout(true);
    try {
      await claimTimeoutWin();
      setDialogOpen(true);
      setDialogMessage("Timeout claim submitted. Waiting for chain confirmation.");
    } catch (error: any) {
      setDialogOpen(true);
      setDialogMessage(`Timeout claim failed: ${error.message}`);
    } finally {
      setIsClaimingTimeout(false);
    }
  };

  const handleAdminForceClose = async () => {
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    const winnerAddress = window.prompt(
      "Enter the winner address to assign a winner, or leave blank to simply force-close the battle:",
      "",
    );

    setIsAdminClosing(true);
    try {
      await adminForceClose(
        winnerAddress?.trim() ? winnerAddress.trim().toLowerCase() : undefined,
      );
      setDialogOpen(true);
      setDialogMessage("Admin force-close submitted. Waiting for chain confirmation.");
    } catch (error: any) {
      setDialogOpen(true);
      setDialogMessage(`Admin force-close failed: ${error.message}`);
    } finally {
      setIsAdminClosing(false);
    }
  };

  // AUTO-JOIN DISABLED - User must manually join to prevent accidental charges
  // useEffect(() => {
  //   async function autoJoinBattle() {
  //     if (isConnected && address && !battleState) {
  //       if (!hasScanned) {
  //         setHasScanned(true);
  //         try {
  //           setDialogOpen(true);
  //           setDialogMessage('Scanning for NFTs in your wallet and kiosks...');
  //
  //           const nftData = await getFirstValidSaplingNft(address);
  //
  //           if (nftData) {
  //             const locationText = nftData.location === 'kiosk' ? 'in your kiosk' : 'in your wallet';
  //             setDialogMessage(`NFT found ${locationText}! Joining battle queue...`);
  //             await joinBattle(nftData);
  //             setDialogMessage('Successfully joined battle queue! Waiting for opponent...');
  //           } else {
  //             setDialogMessage('No whitelisted NFT found. Contact admin to whitelist your NFT collection.');
  //           }
  //         } catch (error: any) {
  //           setDialogOpen(true);
  //           setDialogMessage(error.message || 'Failed to join battle');
  //         }
  //       }
  //     } else if (!isConnected) {
  //       setHasScanned(false);
  //     }
  //   }
  //   autoJoinBattle();
  // }, [isConnected, address, battleState, hasScanned, joinBattle, getFirstValidSaplingNft]);

  const handleUseAbility = async (abilityId: number) => {
    if (
      pendingMoveId !== null ||
      isMoveTransactionPending ||
      isBattleRefreshPending ||
      (!!recoverableBattleError && !isPracticeActive)
    ) {
      return;
    }
    if (!battleState || battleState.finished || battleState.winner) {
      showInlineError("Battle not active.");
      return;
    }
    if (!isMyTurn) {
      showInlineError("Not your turn yet — wait for your opponent to move.");
      return;
    }

    setPendingMoveId(abilityId);
    setInlineError(null);
    resultModalArmedRef.current = true;
    resultModalArmedBattleIdRef.current = battleState.battleId || null;
    resultModalArmedUntilRef.current = Date.now() + RESULT_MODAL_ARM_MS;
    if (inlineErrorTimer.current) clearTimeout(inlineErrorTimer.current);

    try {
      if (isPracticeActive) {
        usePracticeMove(abilityId);
      } else {
        await useAbility(abilityId, selectedFifthMoveId ?? undefined);
      }
    } catch (error: any) {
      resultModalArmedRef.current = false;
      const msg: string = error.message || "Failed to use ability";
      // Friendly messages for common contract errors
      const lowerMsg = msg.toLowerCase();
      const friendly =
        lowerMsg.includes("insufficient gas")
          ? "The move was not applied because the wallet submitted too little gas. This battle is still active; refresh and try the move again."
          : lowerMsg.includes("e_unauthorized_player") ||
              lowerMsg.includes("unauthorized") ||
              /\b102\b/.test(msg)
            ? "Not your turn yet — wait for your opponent to move."
          : lowerMsg.includes("battle not active") ||
              lowerMsg.includes("e_battle_finished") ||
              lowerMsg.includes("finished") ||
              /\b103\b/.test(msg)
            ? "This battle has already ended."
            : lowerMsg.includes("e_invalid_move") ||
                lowerMsg.includes("invalid_move") ||
                lowerMsg.includes("not available") ||
                /\b109\b/.test(msg)
              ? "That move isn't in your assigned move set."
              : lowerMsg.includes("e_move_repeated") || /\b135\b/.test(msg)
                ? "Choose a different card this turn. The same move cannot be played twice in a row."
              : lowerMsg.includes("fifth move") ||
                  lowerMsg.includes("fifth_move_draft") ||
                  /\b13[34]\b/.test(msg)
                ? "Choose one of your three fifth-move cards before submitting your move."
              : lowerMsg.includes("transaction submitted") &&
                  lowerMsg.includes("confirmation")
                ? "Transaction submitted, but confirmation could not be loaded. Check your wallet history before trying again."
              : lowerMsg.includes("move was not submitted") ||
                  lowerMsg.includes("failed to fetch") ||
                  lowerMsg.includes("network")
                ? "Move was not submitted. Check your wallet connection and network, then try again."
              : lowerMsg.includes("battle state could not be refreshed") ||
                  lowerMsg.includes("did not refresh")
                ? "Move confirmed on-chain, but the battle state could not be refreshed."
              : msg;
      showInlineError(friendly);
    } finally {
      setPendingMoveId(null);
    }
  };

  // Reset battle-specific presentation state when a new battle starts.
  // The provider restores or initializes the persisted action log for this id.
  useEffect(() => {
    if (verifiedBattleState?.battleId) {
      setSelectedFifthMoveId(null);
      setLiveResultKey(null);
      resultModalArmedRef.current = false;
      resultModalArmedBattleIdRef.current = null;
      resultModalArmedUntilRef.current = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifiedBattleState?.battleId]);

  const isPlayer1 =
    battleState &&
    effectiveAddress &&
    battleState.player1?.toLowerCase() === effectiveAddress.toLowerCase();
  const playerGrowth = battleState
    ? isPlayer1
      ? battleState.player1Growth
      : battleState.player2Growth
    : 0;
  const opponentGrowth = battleState
    ? isPlayer1
      ? battleState.player2Growth
      : battleState.player1Growth
    : 0;
  const isGardenBotBattle =
    !!battleState &&
    (battleState.isBotBattle ||
      battleState.player1?.toLowerCase() === SUI_CONFIG.BOT_ADDRESS.toLowerCase() ||
      battleState.player2?.toLowerCase() === SUI_CONFIG.BOT_ADDRESS.toLowerCase());
  const activeGrowthTarget =
    battleState?.targetGrowth ??
    (isGardenBotBattle || isPracticeActive ? 50 : 100);
  const displayGrowthTarget = battleState ? activeGrowthTarget : 50;
  const growthTarget = activeGrowthTarget;
  const playerRole: BattleRole = isPlayer1 ? "player-1" : "player-2";
  const opponentRole: BattleRole = isGardenBotBattle
    ? "garden-bot"
    : isPlayer1
      ? "player-2"
      : "player-1";
  const rawPlayerMoves = battleState
    ? isPlayer1
      ? battleState.player1Moves
      : battleState.player2Moves
    : [];
  const fifthMoveEntitled = battleState
    ? isPlayer1
      ? Boolean(battleState.player1FifthMoveEntitled)
      : Boolean(battleState.player2FifthMoveEntitled)
    : false;
  const rerollUsed = battleState
    ? isPlayer1
      ? Boolean(battleState.player1RerollUsed)
      : Boolean(battleState.player2RerollUsed)
    : false;
  const fifthMoveDraft = getFifthMoveDraftState(rawPlayerMoves, fifthMoveEntitled);
  const playerMoves = fifthMoveDraft.pending
    ? selectedFifthMoveId !== null
      ? [...fifthMoveDraft.playableMoves, selectedFifthMoveId]
      : fifthMoveDraft.playableMoves
    : fifthMoveDraft.playableMoves;
  const lastPlayerMoveId = [...effectiveActionLog]
    .reverse()
    .find((entry) => entry.actor === "you" && entry.moveId > 0)?.moveId;
  const lastOpponentMoveId = [...effectiveActionLog]
    .reverse()
    .find((entry) => entry.actor === "opponent" && entry.moveId > 0)?.moveId;
  const growthMoveCount = playerMoves.filter(moveGrowsSelf).length;
  const handSummary = formatHandSummary(playerMoves);
  const handNeedsReroll =
    isGardenBotBattle &&
    playerMoves.length > 0 &&
    growthMoveCount < 2;
  const attacksAreStalled =
    isGardenBotBattle &&
    opponentGrowth <= 0 &&
    playerMoves.some((moveId) => MOVE_META[moveId]?.type === "attack");

  const thresholdWinner =
    battleState &&
    isGardenBotBattle &&
    !battleState.winner &&
    !battleState.finished
      ? playerGrowth >= growthTarget
        ? "player"
        : opponentGrowth >= growthTarget
          ? "opponent"
          : null
      : null;
  const winner =
    battleState?.winner
      ? battleState.winner.toLowerCase() === effectiveAddress?.toLowerCase()
        ? "player"
        : "opponent"
      : thresholdWinner;
  const battleFinished = !!winner || !!battleState?.finished;
  const winnerNeedsChainFinalization = !!thresholdWinner && !battleState?.winner;
  const PLAYER_BATTLE_TIMEOUT_MS = 24 * 60 * 60 * 1000;
  const BOT_BATTLE_TIMEOUT_MS = 10 * 60 * 1000;
  const battleTimeoutMs = battleState?.isBotBattle
    ? BOT_BATTLE_TIMEOUT_MS
    : PLAYER_BATTLE_TIMEOUT_MS;
  const timeoutElapsedMs = battleState?.lastMoveMs
    ? Date.now() - battleState.lastMoveMs
    : 0;
  const canClaimTimeout =
    !!battleState &&
    !battleFinished &&
    !isMyTurn &&
    timeoutElapsedMs >= battleTimeoutMs;
  const hasOpponent =
    !!battleState?.player1 &&
    !!battleState.player2 &&
    battleState.player1 !== "0x0" &&
    battleState.player2 !== "0x0";
  const hasActivePvpBattle =
    !!battleState &&
    !isPracticeActive &&
    !isGardenBotBattle &&
    hasOpponent &&
    !battleFinished;
  const moveControlsLocked =
    pendingMoveId !== null ||
    isMoveTransactionPending ||
    isTreeRerollTransactionPending ||
    isBattleRefreshPending ||
    (!!recoverableBattleError && !isPracticeActive && !!battleState);
  const rerollBattleSupported = battleState?.battleVersion === "pvp-v3";
  const rerollCanReview =
    !isPracticeActive &&
    rerollBattleSupported &&
    !battleFinished &&
    isMyTurn &&
    !rerollUsed &&
    treeRerollCostTree !== null &&
    !moveControlsLocked;

  const handleConfirmReroll = async () => {
    if (!rerollCanReview) return;
    setRerollReviewOpen(false);
    setInlineError(null);
    try {
      await rerollHand();
      setSelectedFifthMoveId(null);
    } catch (error: any) {
      const message = error?.message ?? "TREE Reroll could not be completed.";
      const friendly = /202|already.*used/i.test(message)
        ? "Your one TREE Reroll has already been used in this battle."
        : /203|turn/i.test(message)
          ? "Wait for your turn before rerolling."
          : /insufficient|need at least/i.test(message)
            ? message
            : /cancel/i.test(message)
              ? "TREE Reroll was cancelled. No TREE was charged."
              : message;
      showInlineError(friendly);
    }
  };
  const isPvpQueued =
    isConnected &&
    !isPracticeActive &&
    !hasActivePvpBattle &&
    (
      !!recoveredPvpQueueState ||
      !!pvpQueueState ||
      ((localPvpQueued || isWaiting) && !battleFinished && !hasOpponent)
    );
  const shouldShowPvpQueuePanel = isPvpQueued || !!pvpQueueState;
  const hasRefundablePvpQueue = shouldShowPvpQueuePanel;
  const isQueueWaitingMessage =
    /waiting for (opponent|chain update)|joined queue/i.test(dialogMessage);
  const isQueueWaitingDialog = isWaiting && isQueueWaitingMessage;
  const isWalletPendingDialog =
    dialogKind === "start-pending" ||
    dialogKind === "pvp-join-pending" ||
    dialogKind === "pvp-refund-pending";
  const canCloseBattleDialog = !isQueueWaitingDialog && !isWalletPendingDialog;
  const handleCloseBattleDialog = () => {
    if (!canCloseBattleDialog) return;
    setDialogOpen(false);
    setDialogKind("info");
    setIsStartingBot(false);
    setIsJoining(false);
    setIsRefunding(false);
    setIsResultPlayAgainStarting(false);
  };

  useEffect(() => {
    if (!isConnected) {
      setLocalPvpQueued(false);
      clearRecoveredPvpQueue("wallet changed");
      return;
    }

    const normalizedAddress = address?.toLowerCase() ?? null;
    if (
      recoveredPvpQueueState &&
      pvpQueueWalletRef.current &&
      pvpQueueWalletRef.current !== normalizedAddress
    ) {
      setLocalPvpQueued(false);
      clearRecoveredPvpQueue("wallet changed");
      return;
    }

    if (recoveredPvpQueueState && hasActivePvpBattle) {
      setLocalPvpQueued(false);
      clearRecoveredPvpQueue("active PvP battle found");
      return;
    }

    if (!recoveredPvpQueueState && !pvpQueueState && (hasOpponent || battleFinished)) {
      setLocalPvpQueued(false);
      pvpQueueActivationKeyRef.current = null;
      return;
    }

    if (recoveredPvpQueueState && !pvpQueueState) {
      console.info("[pvp-status] queue recovery NOT cleared during transient refresh");
    }

    if (isWaiting) {
      setLocalPvpQueued(true);
    }
  }, [
    isConnected,
    address,
    isWaiting,
    hasOpponent,
    hasActivePvpBattle,
    battleFinished,
    pvpQueueState,
    recoveredPvpQueueState,
  ]);

  useEffect(() => {
    if (!isConnected || isPracticeActive || !pvpQueueState) return;

    activatePvpQueuePanel(pvpQueueState, { scroll: false });
  }, [
    isConnected,
    isPracticeActive,
    pvpQueueState?.queueId,
    pvpQueueState?.player,
    pvpQueueState?.entryFeeMist,
  ]);

  useEffect(() => {
    if (hasOpponent && dialogOpen && isQueueWaitingMessage) {
      setDialogOpen(false);
    }
  }, [hasOpponent, dialogOpen, isQueueWaitingMessage]);

  // Trigger animations when growth changes with proper cleanup
  useEffect(() => {
    if (playerGrowth !== prevPlayerGrowth && prevPlayerGrowth !== null) {
      if (playerAnimationTimer.current) {
        clearTimeout(playerAnimationTimer.current);
      }

      setPlayerAnimation("");

      requestAnimationFrame(() => {
        const newAnimation =
          playerGrowth > prevPlayerGrowth ? "grow-green" : "shake";
        setPlayerAnimation(newAnimation);

        playerAnimationTimer.current = setTimeout(() => {
          setPlayerAnimation("");
          playerAnimationTimer.current = null;
        }, 2000);
      });
    }
    setPrevPlayerGrowth(playerGrowth);
  }, [playerGrowth, prevPlayerGrowth]);

  useEffect(() => {
    if (opponentGrowth !== prevOpponentGrowth && prevOpponentGrowth !== null) {
      if (opponentAnimationTimer.current) {
        clearTimeout(opponentAnimationTimer.current);
      }

      setOpponentAnimation("");

      requestAnimationFrame(() => {
        const newAnimation =
          opponentGrowth > prevOpponentGrowth ? "grow-green" : "shake";
        setOpponentAnimation(newAnimation);

        opponentAnimationTimer.current = setTimeout(() => {
          setOpponentAnimation("");
          opponentAnimationTimer.current = null;
        }, 2000);
      });
    }
    setPrevOpponentGrowth(opponentGrowth);
  }, [opponentGrowth, prevOpponentGrowth]);

  // Fetch opponent's NFT image when battle starts
  useEffect(() => {
    if (battleState && isConnected && address) {
      if (isPracticeActive) return;
      if (!playerNftImageUrl) {
        getFirstValidSaplingNft(address).then((nft) => {
          if (nft?.imageUrl) {
            setPlayerNftImageUrl(nft.imageUrl);
          }
        });
      }

      const opponentAddress = isPlayer1
        ? battleState.player2
        : battleState.player1;
      if (
        opponentAddress &&
        opponentAddress !== "0x0" &&
        !opponentNftImageUrl
      ) {
        getFirstValidSaplingNft(opponentAddress).then((nft) => {
          if (nft?.imageUrl) {
            setOpponentNftImageUrl(nft.imageUrl);
          }
        });
      }
    }
  }, [
    battleState,
    isConnected,
    address,
    isPracticeActive,
    isPlayer1,
    playerNftImageUrl,
    opponentNftImageUrl,
    getFirstValidSaplingNft,
  ]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (playerAnimationTimer.current) {
        clearTimeout(playerAnimationTimer.current);
      }
      if (opponentAnimationTimer.current) {
        clearTimeout(opponentAnimationTimer.current);
      }
      if (inlineErrorTimer.current) {
        clearTimeout(inlineErrorTimer.current);
      }
      if (resultPlayAgainTimerRef.current) {
        clearTimeout(resultPlayAgainTimerRef.current);
      }
    };
  }, []);

  let battleStatus = "Connect wallet to start!";
  if (isWaiting) {
    battleStatus = "Waiting for opponent.";
  } else if (isConnected && !battleState) {
    battleStatus = "Ready to join! Click the button below.";
  } else if (battleState && !battleFinished) {
    battleStatus = isPracticeActive
      ? "Practice Mode active - choose a move."
      : canClaimTimeout
      ? "Opponent has been idle for too long — you may claim timeout victory."
      : isMyTurn
        ? "Your turn! Choose a move."
        : isGardenBotBattle
          ? "Garden Bot is thinking..."
          : "Waiting for your opponent to move.";
  } else if (winner) {
    battleStatus =
      winner === "player"
        ? "You Win!"
        : isGardenBotBattle
          ? "Garden Bot Wins!"
          : "Opponent Wins!";
  } else if (battleState?.finished) {
    battleStatus = "Battle ended.";
  }

  const matchLiveStatus =
    isTreeRerollTransactionPending
      ? treeRerollLifecycleStage === "awaiting-wallet-approval"
        ? "Approve TREE Reroll in wallet"
        : "TREE Reroll pending"
      : pendingMoveId !== null || isMoveTransactionPending
      ? "Move transaction pending"
      : isBattleRefreshPending
        ? "Refreshing match"
        : canClaimTimeout
          ? "Timeout win available"
          : isPracticeActive || isMyTurn
            ? "Your turn"
            : isGardenBotBattle
              ? "Garden Bot thinking"
              : "Waiting on opponent";
  const matchStatusTone =
    pendingMoveId !== null || isMoveTransactionPending || isTreeRerollTransactionPending || isBattleRefreshPending
      ? "processing"
      : canClaimTimeout
        ? "action"
        : isPracticeActive || isMyTurn
          ? "ready"
          : "waiting";

  const shareUrl = "https://nftree.net/battle";
  const leaderboardRoute = appRoute("leaderboard");
  const winnerTitle =
    winner === "player"
      ? "You Win!"
      : isGardenBotBattle
        ? "Garden Bot Wins"
        : "Opponent Wins";
  const playerStageVisual = resolveGrowthStageVisual({
    role: playerRole,
    growth: playerGrowth,
    growthTarget: displayGrowthTarget,
    nftImageUrl: playerNftImageUrl || undefined,
    revealNft: winner === "player",
  });
  const opponentStageVisual = resolveGrowthStageVisual({
    role: opponentRole,
    growth: opponentGrowth,
    growthTarget: displayGrowthTarget,
    nftImageUrl: isGardenBotBattle ? undefined : opponentNftImageUrl || undefined,
    revealNft: winner === "opponent" && !isGardenBotBattle,
  });
  const winnerStageVisual =
    winner === "player" ? playerStageVisual : opponentStageVisual;
  const winnerImage = winnerStageVisual.imageUrl;
  const resultShareOutcome = isPracticeActive
    ? "practice"
    : winner === "player"
      ? "win"
      : "loss";
  const resultShareOptions = getBattleResultShareOptions({
    outcome: resultShareOutcome,
    playerGrowth,
    opponentGrowth,
    targetGrowth: growthTarget,
  });
  const selectedResultShareOption =
    resultShareOptions.find(
      (option) => option.id === selectedResultShareOptionId,
    ) ?? resultShareOptions[0];
  const selectedResultShareText = selectedResultShareOption?.message ?? "";
  const shareText = buildBattleResultShareText(
    selectedResultShareText,
    shareUrl,
  );
  const encodedShareText = encodeURIComponent(selectedResultShareText);
  const encodedShareUrl = encodeURIComponent(shareUrl);
  const isAppleShareDevice =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);
  const smsShareUrl = buildSmsShareUrl(shareText, isAppleShareDevice);
  const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedShareUrl}`;
  const resultModalKey =
    battleState && winner
      ? `battleResult:${battleState.battleId || "unknown"}:${winner}:${playerGrowth}:${opponentGrowth}`
      : null;
  const resultScore = `${playerGrowth}/${growthTarget} vs ${opponentGrowth}/${growthTarget}`;
  const resultSummary = winnerNeedsChainFinalization
    ? "The Garden Bot target was reached. The interface is stopping this match here while the contract target bug is queued for upgrade."
    : isPracticeActive
      ? "Practice Mode result. No rewards or verified leaderboard credit."
    : `${Math.max(playerGrowth, opponentGrowth)} / ${growthTarget} Growth reached.`;
  const battleInfoText =
    battleState && isPracticeActive
      ? "Practice Mode - No rewards - No leaderboard credit"
      : battleState && isGardenBotBattle
      ? "Single-player Garden Bot battle"
      : battleState && !isGardenBotBattle
        ? `${activePvpMatchLabel} - ${entryFeeLabel} entry`
        : isWaiting
          ? `PvP Battle - ${activePvpMatchLabel} - ${entryFeeLabel} entry paid. Waiting for opponent.`
          : isConnected
            ? "Choose Single Player or PvP to begin"
            : "Connect wallet to choose a mode";
  const resultModalOpen =
    !!winner &&
    battleFinished &&
    !!resultModalKey &&
    liveResultKey === resultModalKey &&
    !dismissedResultKeys.includes(resultModalKey);

  const markResultDismissed = () => {
    if (!resultModalKey) return;
    setLiveResultKey(null);
    setDismissedResultKeys((currentKeys) => {
      const nextKeys = currentKeys.includes(resultModalKey)
        ? currentKeys
        : [...currentKeys, resultModalKey].slice(-MAX_DISMISSED_RESULTS);
      writeDismissedResultKeys(nextKeys);
      return nextKeys;
    });
  };

  useEffect(() => {
    const battleId = battleState?.battleId || null;

    if (!battleId || !battleFinished) {
      setLiveResultKey(null);
      return;
    }

    const resultWasReachedFromCurrentMove =
      resultModalArmedRef.current &&
      resultModalArmedBattleIdRef.current === battleId &&
      Date.now() <= resultModalArmedUntilRef.current;

    if (
      resultModalKey &&
      winner &&
      resultWasReachedFromCurrentMove &&
      !dismissedResultKeys.includes(resultModalKey) &&
      !liveResultKeysShownRef.current.has(resultModalKey)
    ) {
      liveResultKeysShownRef.current.add(resultModalKey);
      resultModalArmedRef.current = false;
      resultModalArmedBattleIdRef.current = null;
      resultModalArmedUntilRef.current = 0;
      setLiveResultKey(resultModalKey);
    }
  }, [battleState?.battleId, battleFinished, dismissedResultKeys, resultModalKey, winner]);

  const handleCloseResultModal = () => {
    markResultDismissed();
  };
  const handlePlayAgainFromResult = async () => {
    if (isResultPlayAgainStarting) return;

    markResultDismissed();
    setIsResultPlayAgainStarting(true);

    if (resultPlayAgainTimerRef.current) {
      clearTimeout(resultPlayAgainTimerRef.current);
    }

    const timeout = new Promise<never>((_, reject) => {
      resultPlayAgainTimerRef.current = setTimeout(() => {
        reject(new Error("New Bot Hand timed out. Please try again."));
      }, RESULT_PLAY_AGAIN_TIMEOUT_MS);
    });

    try {
      await Promise.race([handleStartBotBattle(), timeout]);
    } catch (error: any) {
      console.warn("[battle-result] New Bot Hand failed", error);
      setDialogOpen(true);
      setDialogMessage(error?.message || "New Bot Hand did not start. Please try again.");
    } finally {
      if (resultPlayAgainTimerRef.current) {
        clearTimeout(resultPlayAgainTimerRef.current);
        resultPlayAgainTimerRef.current = null;
      }
      setIsResultPlayAgainStarting(false);
      setIsStartingBot(false);
    }
  };

  const handleNativeShareWin = async () => {
    try {
      if (navigator.share) {
        const shareTitle =
          winner === "player"
            ? "Garden Battles Victory"
            : "Garden Battles Result";
        const resultImage = await createBattleResultShareImage({
          title: winnerTitle,
          score: `Final score: ${resultScore}`,
          message: selectedResultShareText,
          battleUrl: shareUrl,
          won: winner === "player",
        });
        const canShareImage =
          !!resultImage &&
          !!navigator.canShare &&
          navigator.canShare({ files: [resultImage] });

        await navigator.share(
          canShareImage
            ? {
                title: shareTitle,
                text: shareText,
                files: [resultImage],
              }
            : {
                title: shareTitle,
                text: selectedResultShareText,
                url: shareUrl,
              },
        );
      } else {
        await navigator.clipboard.writeText(shareText);
        setDialogOpen(true);
        setDialogMessage("Battle caption copied.");
      }
    } catch {
      // User cancelled the native share sheet.
    }
  };

  const handleCopyWin = async () => {
    await navigator.clipboard.writeText(shareText);
    setDialogOpen(true);
    setDialogMessage("Battle caption copied.");
  };

  // Check if user is admin to show admin panel
  const isAdmin =
    address &&
    SUI_CONFIG.ADMIN_ADDRESSES.some(
      (adminAddr) => adminAddr.toLowerCase() === address.toLowerCase(),
    );
  const hasActiveSession = isPvpQueued || (!!battleState && !battleFinished);
  const showFullModeSelect = !hasActiveSession || modeCardsExpanded;
  const modeActionsDisabled = hasActiveSession || isJoining || isStartingBot;
  const activeModeTitle = isPracticeActive
    ? "Practice Mode"
    : isPvpQueued
      ? "PvP Battle Queue"
      : isGardenBotBattle
        ? "Single Player Garden Bot"
        : "PvP Battle";
  const activeModeDetails = isPracticeActive
    ? "No wallet needed - No rewards - No leaderboard credit"
    : isPvpQueued
      ? `${activePvpMatchLabel} - ${pvpQueueEntryFeeLabel} deposited - Waiting for opponent`
      : isGardenBotBattle
        ? "Single-Player Battle"
        : `${activePvpMatchLabel} - ${entryFeeLabel} entry`;

  const handleStartPracticeBattle = () => {
    startPracticeBattle();
    setModeCardsExpanded(false);
    setUtilityDrawer(null);
    setLiveResultKey(null);
    resultModalArmedRef.current = false;
    resultModalArmedBattleIdRef.current = null;
    resultModalArmedUntilRef.current = 0;
    setInlineError(null);
    scrollToBattleFocus();
  };

  const modeSelect =
    showFullModeSelect ? (
      <section className="gb-mode-select" aria-label="Choose battle mode">
        <article className="gb-mode-card gb-mode-card-bot gb-mode-card-garden-bot">
          <ModeCrest type="garden-bot" alt="Garden Bot robotic plant medallion" />
          <h2>Garden Bot</h2>
          <p>Single-Player Battle</p>
          <div className="gb-mode-card-details">
            <button
              onClick={handleStartBotBattle}
              disabled={!isConnected || modeActionsDisabled}
              className="gb-mode-action gb-mode-action-bot"
              data-testid="button-start-bot-battle"
            >
              {isStartingBot ? "Starting..." : "Play Single Player"}
            </button>
          </div>
        </article>

        <article className="gb-mode-card gb-mode-card-pvp">
          <ModeCrest type="pvp-battle" alt="PvP Battle duel medallion" />
          <h2>PvP Battle</h2>
          <p>Player-vs-Player Queue</p>
          <div className="gb-mode-card-details">
            <div className="gb-mode-card-chips" aria-label="PvP Battle details">
              <span>{shouldShowPvpQueuePanel ? "Already in queue" : `Entry: ${entryFeeLabel}`}</span>
              <span>Winner receives {pvpWinnerPayoutLabel}</span>
              <span>{pvpTreeSupportLabel} supports TREE buybacks</span>
            </div>
            {!shouldShowPvpQueuePanel && (
              <div className="gb-pvp-target-selector" aria-label="Choose PvP match length">
                <span className="gb-pvp-target-selector-label">Choose Match Length</span>
                <div className="gb-pvp-target-options">
                  {[
                    {
                      target: 50 as const,
                      title: "50 Growth",
                      subtitle: "Quick Match",
                    },
                    {
                      target: 75 as const,
                      title: "75 Growth",
                      subtitle: "Standard Match",
                    },
                  ].map((option) => (
                    <button
                      key={option.target}
                      type="button"
                      className={
                        selectedPvpTarget === option.target
                          ? "gb-pvp-target-option gb-pvp-target-option-active"
                          : "gb-pvp-target-option"
                      }
                      aria-pressed={selectedPvpTarget === option.target}
                      onClick={() => setSelectedPvpTarget(option.target)}
                    >
                      <strong>{option.title}</strong>
                      <span>{option.subtitle}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {shouldShowPvpQueuePanel ? (
              <>
                <div className="gb-mode-queued-label">Already in queue</div>
                <button
                  type="button"
                  onClick={handleForceRefund}
                  disabled={isRefunding}
                  className="gb-mode-action gb-mode-action-pvp"
                  data-testid="button-mode-card-refund"
                >
                  {isRefunding ? "Refunding..." : "Get Refund"}
                </button>
                <button
                  type="button"
                  onClick={scrollToPvpQueuePanel}
                  className="gb-mode-action gb-mode-action-secondary"
                  data-testid="button-view-pvp-queue"
                >
                  View Queue
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleJoinBattle}
                  disabled={!isConnected || modeActionsDisabled}
                  className="gb-mode-action gb-mode-action-pvp"
                  data-testid="button-join-battle"
                >
                  {isJoining
                    ? "Joining..."
                    : `Join ${selectedPvpTarget} Growth Queue (${entryFeeLabel})`}
                </button>
                {isConnected && !hasActiveSession && (
                  <button
                    type="button"
                    onClick={handleCheckPvpQueueStatus}
                    disabled={isCheckingPvpQueue}
                    className="gb-mode-action gb-mode-action-secondary"
                    data-testid="button-check-pvp-queue"
                  >
                    {isCheckingPvpQueue ? "Checking..." : "Check Queue Status"}
                  </button>
                )}
              </>
            )}
          </div>
        </article>

        <article
          className="gb-mode-card gb-mode-card-clash"
          aria-label="Canopy Clash coming soon"
        >
          <ModeCrest type="canopy-clash" alt="Canopy Clash tournament medallion" />
          <h2>Canopy Clash</h2>
          <p>Tournament Mode</p>
          <div className="gb-mode-card-details">
            <span className="gb-mode-placeholder">Coming Soon</span>
          </div>
        </article>
      </section>
    ) : null;

  const activeModeBar = hasActiveSession ? (
    <section
      ref={battleFocusRef}
      className="gb-active-mode-bar"
      aria-label="Active battle mode"
    >
      <div className="gb-active-mode-copy">
        <strong>{activeModeTitle}</strong>
        <span>{activeModeDetails}</span>
      </div>
      {!hasRefundablePvpQueue && (
        <div className="gb-active-mode-actions">
          {!isPracticeActive && (
            <Link href={leaderboardRoute} className="gb-active-mode-button">
              View Leaderboard
            </Link>
          )}
          <button
            type="button"
            className="gb-active-mode-button gb-active-mode-button-secondary"
            onClick={() => setModeCardsExpanded((expanded) => !expanded)}
          >
            {modeCardsExpanded ? "Hide Modes" : "Change Mode"}
          </button>
        </div>
      )}
    </section>
  ) : null;

  const pvpQueuePanel = shouldShowPvpQueuePanel ? (
    <section
      ref={pvpQueuePanelRef}
      className="gb-pvp-queue-panel"
      aria-label="PvP battle queue status"
    >
      <div className="gb-pvp-queue-copy">
        <p className="gb-pvp-queue-kicker">PvP Battle Queue</p>
        <h2>Waiting for opponent</h2>
        <div className="gb-pvp-queue-facts" aria-label="PvP queue details">
          <span>{activePvpMatchLabel}</span>
          <span>{pvpQueueEntryFeeLabel} deposited</span>
          <span>Winner receives {pvpWinnerPayoutLabel}</span>
          <span>{pvpTreeSupportLabel} supports TREE buybacks</span>
        </div>
      </div>
      <div className="gb-pvp-queue-actions">
        <button
          type="button"
          onClick={handleForceRefund}
          disabled={isRefunding}
          className="gb-refund-button gb-pvp-queue-refund-button"
          data-testid="button-queue-refund"
        >
          {isRefunding ? "Refunding..." : "Get Refund"}
        </button>
        <Link href={leaderboardRoute} className="gb-active-mode-button">
          View Leaderboard
        </Link>
        <button
          type="button"
          className="gb-active-mode-button gb-active-mode-button-secondary"
          onClick={() => setModeCardsExpanded((expanded) => !expanded)}
        >
          {modeCardsExpanded ? "Hide Modes" : "Change Mode"}
        </button>
      </div>
    </section>
  ) : null;

  return (
    <>
      <style>{`
  @keyframes pulseGlow {
    from { box-shadow: 0 0 20px #00ff00; }
    to { box-shadow: 0 0 40px #00ff00, 0 0 60px #00ff00; }
  }
  @keyframes explodeAndShrink {
    0% { transform: scale(0.5); opacity: 0; }
    50% { transform: scale(1.1); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes slideInLog {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .battle-grid {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: clamp(8px, 2vw, 20px);
    max-width: 100%;
    margin: 20px auto;
    padding: 0 clamp(8px, 2vw, 15px);
    align-items: start;
    justify-items: center;
  }

  @media (max-width: 640px) {
    .battle-grid {
      gap: clamp(4px, 1.5vw, 12px);
      padding: 0 clamp(4px, 1.5vw, 8px);
    }

    .player-card,
    .opponent-card {
      max-width: 140px;
    }

    .nft-wrapper {
      max-width: 120px;
      aspect-ratio: 5 / 7;
    }

    .nft-wrapper img {
      max-width: 90%;
      max-height: 90%;
    }

    .vs-element {
      font-size: clamp(24px, 7vw, 36px);
    }

    .health-bar,
    .growth-text {
      max-width: 120px;
      font-size: clamp(10px, 2.5vw, 13px);
    }
  }

  @media (max-width: 360px) {
    .player-card,
    .opponent-card { max-width: 115px; }
    .nft-wrapper { max-width: 100px; }
    .vs-element { font-size: clamp(20px, 6vw, 30px); }
  }
`}</style>
      <div
        className={`gb-battle-page${battleState && !battleFinished ? " gb-battle-page-active" : ""}`}
        style={{
          backgroundImage: `
            linear-gradient(115deg, rgba(255, 193, 64, 0.13), transparent 24%),
            linear-gradient(245deg, rgba(0, 203, 222, 0.16), transparent 30%),
            linear-gradient(160deg, rgba(220, 42, 86, 0.1), transparent 34%),
            linear-gradient(180deg, rgba(4, 8, 16, 0.78), rgba(4, 8, 16, 0.95)),
            url(${appAsset("assets/background4.jpg")})
          `,
          backgroundSize: "auto, auto, auto, auto, cover",
          backgroundPosition: "center center",
          backgroundAttachment: "fixed",
          backgroundRepeat: "no-repeat",
          backgroundColor: "#040810",
          color: "white",
          textAlign: "center",
          fontFamily: "Orbitron, sans-serif",
          margin: 0,
          padding: 0,
          minHeight: "100vh",
          overflowX: "hidden",
        }}
      >
        {/* Header */}
        <header
          className="gb-app-header"
        >
          <div className="gb-header-brand" aria-label="Garden Battles">
            <img
              src={appAsset("assets/garden.png")}
              alt="The Garden Battles"
              className="gb-header-game-logo"
              data-testid="logo-brand"
            />
          </div>

          <nav className="gb-header-nav" aria-label="TREE ecosystem navigation">
            <div className="gb-nav-group" aria-label="TREE ecosystem links">
              {ecosystemLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="gb-nav-link gb-nav-link-home"
                  target="_blank"
                  rel="noreferrer"
                  data-testid={`link-${link.testId}`}
                >
                  <House size={16} aria-hidden="true" />
                  <span>{link.label}</span>
                </a>
              ))}
            </div>
            <div className="gb-nav-divider" aria-hidden="true" />
            <div className="gb-nav-group gb-nav-group-suidex" aria-label="Garden Battles utilities">
              <button type="button" className="gb-nav-link gb-nav-link-nftree" onClick={() => setUtilityDrawer("nftree")}>
                <ShoppingBag size={16} aria-hidden="true" /> <span>Get an NFTree</span>
              </button>
              <button type="button" className="gb-nav-link gb-nav-link-tree" onClick={() => setUtilityDrawer("tree")}>
                <Sparkles size={16} aria-hidden="true" /> <span>TREE Battle Benefits</span>
              </button>
              <button type="button" className="gb-nav-link gb-nav-link-guide" onClick={() => openCardGuide(false)}>
                <BookOpen size={16} aria-hidden="true" /> <span>Card Guide</span>
              </button>
              <a
                href="https://tree-token.xyz/play/"
                className="gb-nav-link gb-nav-link-arcade"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Gamepad2 size={16} aria-hidden="true" /> <span>TREE Arcade</span>
              </a>
            </div>
          </nav>

          <div
            className="gb-header-actions"
          >
            {hasRefundablePvpQueue && (
              <button
                onClick={handleForceRefund}
                disabled={!isConnected || isRefunding}
                className="gb-refund-button"
                data-testid="button-emergency-refund"
              >
                <span className="gb-refund-label-full">
                  {isRefunding ? "Processing..." : "Get Refund"}
                </span>
                <span className="gb-refund-label-compact">
                  {isRefunding ? "Processing" : "Refund"}
                </span>
              </button>
            )}
            <ConnectButton connectText="Connect Wallet" />
            <button
              type="button"
              className="gb-mobile-menu-toggle"
              aria-expanded={headerMenuOpen}
              aria-controls="battle-header-mobile-nav"
              aria-label={headerMenuOpen ? "Close TREE menu" : "Open TREE menu"}
              onClick={() => setHeaderMenuOpen((open) => !open)}
            >
              {headerMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
          <nav
            id="battle-header-mobile-nav"
            className="gb-mobile-nav-panel"
            data-open={headerMenuOpen}
            aria-label="TREE ecosystem mobile navigation"
          >
            <div className="gb-mobile-nav-section" aria-label="TREE ecosystem links">
              {ecosystemLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="gb-nav-link"
                  target="_blank"
                  rel="noreferrer"
                  data-testid={`mobile-link-${link.testId}`}
                >
                  {link.label}
                </a>
              ))}
            </div>
            <div className="gb-mobile-nav-section" aria-label="Garden Battles utilities">
              <button type="button" className="gb-nav-link" onClick={() => { setUtilityDrawer("nftree"); setHeaderMenuOpen(false); }}>
                <ShoppingBag size={16} aria-hidden="true" /> Get an NFTree
              </button>
              <button type="button" className="gb-nav-link" onClick={() => { setUtilityDrawer("tree"); setHeaderMenuOpen(false); }}>
                <Sparkles size={16} aria-hidden="true" /> TREE Battle Benefits
              </button>
              <button type="button" className="gb-nav-link" onClick={() => { openCardGuide(false); setHeaderMenuOpen(false); }}>
                <BookOpen size={16} aria-hidden="true" /> Card Guide
              </button>
              <a
                href="https://tree-token.xyz/play/"
                className="gb-nav-link gb-nav-link-arcade"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Gamepad2 size={16} aria-hidden="true" /> TREE Arcade
              </a>
            </div>
            {hasRefundablePvpQueue && (
              <button
                type="button"
                onClick={handleForceRefund}
                disabled={!isConnected || isRefunding}
                className="gb-mobile-refund-menu-item"
                data-testid="mobile-button-emergency-refund"
              >
                {isRefunding ? "Processing" : "Refund"}
              </button>
            )}
          </nav>
        </header>

        {address && (
          <section
            className="gb-player-status-strip"
            aria-label="Connected player status"
            data-expanded={mobileProfileExpanded}
          >
            <div className="gb-mobile-profile-heading">
              <span><Trophy size={15} aria-hidden="true" /> Player Profile</span>
              <div>
                <Link href={leaderboardRoute}>Leaderboard</Link>
                <button
                  type="button"
                  aria-expanded={mobileProfileExpanded}
                  aria-label={mobileProfileExpanded ? "Hide player statistics" : "Show player statistics and badges"}
                  onClick={() => setMobileProfileExpanded((expanded) => !expanded)}
                >
                  {mobileProfileExpanded ? "Less" : "Stats"}
                  <ChevronDown size={15} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="gb-player-profile-content">
              <div className="gb-rank-showcase">
                <aside className="gb-rank-showcase-copy gb-rank-showcase-copy-left" aria-label="Battle rank explanation">
                  <span>Your Competitive Legacy</span>
                  <strong>Garden Bot and PvP wins grow your Battle Rank.</strong>
                </aside>
                <PlayerRecord address={address} />
                <aside className="gb-rank-showcase-copy gb-rank-showcase-copy-right" aria-label="TREE holder battle benefits">
                  <span>TREE Holder Battle Benefits</span>
                  <strong>Put TREE to work through verified liquidity or staking to unlock a fifth battle card.</strong>
                  <button
                    type="button"
                    className="gb-rank-tree-benefits-button"
                    onClick={() => setUtilityDrawer("tree")}
                  >
                    <Sparkles size={13} aria-hidden="true" />
                    Explore TREE Benefits
                  </button>
                </aside>
              </div>
              <ForestPower address={address} />
            </div>
          </section>
        )}

        <main className="gb-battle-main">
          {!hasActiveSession && <section
            className={`gb-tree-benefits-trigger gb-tree-benefits-trigger-featured gb-tree-benefits-trigger-${fifthCardPromo.tone}`}
            aria-label={fifthCardPromo.title}
          >
            <div className="gb-tree-benefits-trigger-art" aria-hidden="true">
              <img src={appAsset("assets/thick.png")} alt="" />
              <span className={`gb-tree-benefits-trigger-badge gb-tree-benefits-trigger-badge-${fifthCardPromo.badge}`}>
                {fifthCardPromo.badge === "check" ? <CheckCircle2 size={17} strokeWidth={3} /> :
                  fifthCardPromo.badge === "wallet" ? <WalletCards size={16} /> :
                    fifthCardPromo.badge === "checking" ? <LoaderCircle size={16} /> :
                      fifthCardPromo.badge === "alert" ? <AlertTriangle size={15} /> : "+1"}
              </span>
            </div>
            <div className="gb-tree-benefits-trigger-copy">
              <small>{fifthCardPromo.eyebrow}</small>
              <strong>{fifthCardPromo.title}</strong>
              <span>{fifthCardPromo.description}</span>
            </div>
            <button type="button" onClick={() => setUtilityDrawer("tree")}>
              {fifthCardPromo.action} <ChevronRight size={17} aria-hidden="true" />
            </button>
          </section>}
          {!hasActiveSession && (
            <div className="gb-quick-start-tools">
              <HowToPlay />
              <button type="button" className="gb-card-guide-launcher" onClick={() => openCardGuide(false)}>
                <span className="gb-card-guide-launcher-icon" aria-hidden="true"><BookOpen size={19} /></span>
                <span>
                  <strong>Card Guide</strong>
                  <small>Explore all 39 cards</small>
                </span>
                <ChevronRight size={17} aria-hidden="true" />
              </button>
              <details className="gb-practice-launcher">
                <summary>
                  <span className="gb-practice-launcher-icon" aria-hidden="true"><Gamepad2 size={19} /></span>
                  <span>
                    <strong>Practice Mode</strong>
                    <small>Try it free</small>
                  </span>
                  <ChevronRight size={17} aria-hidden="true" />
                </summary>
                <div className="gb-practice-launcher-panel">
                  <p>Learn the cards against a practice opponent. No wallet, entry fee, rewards, or leaderboard record.</p>
                  <button
                    type="button"
                    onClick={handleStartPracticeBattle}
                    className="gb-mode-action gb-mode-action-practice"
                    data-testid="button-start-practice-battle"
                  >
                    Start Free Practice
                  </button>
                </div>
              </details>
            </div>
          )}
          {!isConnected && !hasActiveSession && (
            <section
              className="gb-disconnected-onboarding"
              aria-label="Connect wallet to start Garden Battles"
            >
              <div className="gb-disconnected-onboarding-copy">
                <p className="gb-disconnected-kicker">Ranked or practice</p>
                <h1>Choose how you want to play</h1>
                <p>
                  Connect for ranked battles, or start Practice Mode immediately without a wallet.
                </p>
              </div>
              <div className="gb-disconnected-wallet-cta">
                <ConnectButton connectText="Connect for Ranked Play" />
              </div>
              <MobileWalletLaunchers />
            </section>
          )}
          {activeModeBar}
          {pvpQueuePanel}
          {modeSelect}
          {hasActiveSession && (
            <div className="gb-active-reference-tools">
              <HowToPlay />
            </div>
          )}
          {battleState && <div
            className="gb-battle-hud"
            aria-label="Garden Battles HUD"
          >
          <div className="gb-battle-hud-center">
          <PrizePayoutPanel
            isGardenBotBattle={isGardenBotBattle}
            isPracticeBattle={isPracticeActive}
            growthTarget={growthTarget}
            liveStatus={matchLiveStatus}
            statusTone={matchStatusTone}
          />
          {/* Battle Area */}
          <section
            className={
              !isConnected && !battleState
                ? "gb-battle-arena gb-battle-arena-disconnected"
                : isPvpQueued
                  ? "gb-battle-arena gb-battle-arena-queue"
                : "gb-battle-arena"
            }
            aria-label="Current battle arena"
          >
          {!isConnected && !battleState && (
            <div className="gb-disconnected-arena-overlay">
              Connect for ranked modes, or start Practice Mode above.
            </div>
          )}
          {isPvpQueued && (
            <div className="gb-queue-arena-overlay">
              Waiting for PvP opponent.
            </div>
          )}
          <div className="battle-grid">
          {/* Player 1 NFT */}
          <div
            className="player-card"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "100%",
              maxWidth: "280px",
            }}
          >
            <div
              style={{
                marginBottom: "8px",
                padding: "5px 12px",
                border: "1px solid #00ffcc",
                borderRadius: "6px",
                background: "rgba(0, 45, 40, 0.9)",
                color: "#baffee",
                fontWeight: "bold",
                fontSize: "13px",
                textTransform: "uppercase",
              }}
            >
              You
            </div>
            <div
              className={`${playerAnimation} gb-battle-tree-portrait`}
              style={{
                width: "100%",
                aspectRatio: "5/7",
                maxWidth: "240px",
                borderRadius: "12px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                boxShadow:
                  winner === "player"
                    ? "0 0 20px #00ff00, 0 0 40px #00ff00"
                    : "0 0 15px #ff0000",
                transition: "transform 0.3s ease, box-shadow 0.3s ease",
                marginBottom: "10px",
                zIndex: 1,
                background: "rgba(255, 255, 255, 0.1)",
                overflow: "hidden",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow = "0 0 30px #00ff00";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow =
                  winner === "player"
                    ? "0 0 20px #00ff00, 0 0 40px #00ff00"
                    : "0 0 15px #ff0000";
              }}
              data-testid="nft-card-player"
            >
              <img
                key={`${playerStageVisual.role}-${playerStageVisual.stage}-${playerStageVisual.imageUrl}`}
                src={playerStageVisual.imageUrl}
                alt={playerStageVisual.alt}
                className={playerStageVisual.className}
                style={{
                  width: "94%",
                  height: "94%",
                  maxWidth: "94%",
                  maxHeight: "94%",
                  objectFit: "contain",
                  borderRadius: 0,
                }}
                data-testid="nft-image-player"
              />
              {winner === "player" && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 2,
                  }}
                >
                  <Trophy
                    style={{
                      width: "96px",
                      height: "96px",
                      color: "#00ff00",
                      filter: "drop-shadow(0 0 20px #00ff00)",
                    }}
                  />
                </div>
              )}
            </div>
            <p
              style={{
                marginTop: "4px",
                fontSize: "clamp(11px, 2.5vw, 13px)",
                color: "#00ffcc",
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              🌱 Your Growth
            </p>
            <div
              style={{
                width: "100%",
                maxWidth: "240px",
                height: "18px",
                background: "rgba(0, 0, 0, 0.8)",
                borderRadius: "6px",
                padding: "2px",
                display: "block",
                zIndex: 0,
                margin: "4px 0",
                boxShadow: "0 0 10px #00ff00",
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, (playerGrowth / displayGrowthTarget) * 100)}%`,
                  height: "18px",
                  background: "linear-gradient(to right, #00ff00, #00cc00)",
                  borderRadius: "6px",
                  transition: "width 0.3s ease",
                }}
                data-testid="health-bar-player"
              />
            </div>
            <p
              style={{
                marginTop: "4px",
                fontSize: "clamp(13px, 3vw, 17px)",
                fontWeight: "bold",
                color: "#00ff00",
              }}
              data-testid="text-growth-player"
            >
              {playerGrowth} / {displayGrowthTarget}
            </p>
          </div>

          {/* VS - Centered on mobile */}
          <div
            className="vs-element"
            style={{
              fontSize: "clamp(32px, 8vw, 48px)",
              color: "#00ff00",
              textShadow: "0 0 10px #00ff00",
              fontFamily: "FantasyBattles, sans-serif",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1,
            }}
            data-testid="text-vs"
          >
            VS
          </div>

          {/* Player 2 NFT */}
          <div
            className="opponent-card"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "100%",
              maxWidth: "280px",
            }}
          >
            <div
              style={{
                marginBottom: "8px",
                padding: "5px 12px",
                border: "1px solid #ff9944",
                borderRadius: "6px",
                background: "rgba(70, 30, 0, 0.9)",
                color: "#ffd2ad",
                fontWeight: "bold",
                fontSize: "13px",
                textTransform: "uppercase",
              }}
            >
              {isGardenBotBattle ? "Garden Bot" : "Opponent"}
            </div>
            <div
              className={`${opponentAnimation} gb-battle-tree-portrait`}
              style={{
                width: "100%",
                aspectRatio: "5/7",
                maxWidth: "240px",
                borderRadius: "12px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                boxShadow:
                  winner === "opponent"
                    ? "0 0 20px #00ff00, 0 0 40px #00ff00"
                    : "0 0 15px #00ff00",
                transition: "transform 0.3s ease, box-shadow 0.3s ease",
                marginBottom: "10px",
                zIndex: 1,
                background: "rgba(255, 255, 255, 0.1)",
                overflow: "hidden",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.boxShadow = "0 0 30px #00ff00";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.boxShadow =
                  winner === "opponent"
                    ? "0 0 20px #00ff00, 0 0 40px #00ff00"
                    : "0 0 15px #00ff00";
              }}
              data-testid="nft-card-opponent"
            >
              <img
                key={`${opponentStageVisual.role}-${opponentStageVisual.stage}-${opponentStageVisual.imageUrl}`}
                src={opponentStageVisual.imageUrl}
                alt={opponentStageVisual.alt}
                className={opponentStageVisual.className}
                style={{
                  width: "94%",
                  height: "94%",
                  maxWidth: "94%",
                  maxHeight: "94%",
                  objectFit: "contain",
                  borderRadius: 0,
                }}
                data-testid="nft-image-opponent"
              />
              {winner === "opponent" && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 2,
                  }}
                >
                  <Trophy
                    style={{
                      width: "96px",
                      height: "96px",
                      color: "#00ff00",
                      filter: "drop-shadow(0 0 20px #00ff00)",
                    }}
                  />
                </div>
              )}
            </div>
            <p
              style={{
                marginTop: "4px",
                fontSize: "clamp(11px, 2.5vw, 13px)",
                color: "#ff9944",
                fontWeight: "bold",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              🌿{" "}
              {isGardenBotBattle
                ? "Garden Bot Growth"
                : "Opponent Growth"}
            </p>
            <div
              style={{
                width: "100%",
                maxWidth: "240px",
                height: "18px",
                background: "rgba(0, 0, 0, 0.8)",
                borderRadius: "6px",
                padding: "2px",
                display: "block",
                zIndex: 0,
                margin: "4px 0",
                boxShadow: "0 0 10px #00ff00",
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, (opponentGrowth / displayGrowthTarget) * 100)}%`,
                  height: "18px",
                  background: "linear-gradient(to right, #00ff00, #00cc00)",
                  borderRadius: "6px",
                  transition: "width 0.3s ease",
                }}
                data-testid="health-bar-opponent"
              />
            </div>
            <p
              style={{
                marginTop: "4px",
                fontSize: "clamp(13px, 3vw, 17px)",
                fontWeight: "bold",
                color: "#ff9944",
              }}
              data-testid="text-growth-opponent"
            >
              {opponentGrowth} / {displayGrowthTarget}
            </p>
          </div>
          </div>
        </section>

        {/* Battle Options - Color-coded move cards */}
        {false && battleFinished && winner && (
          <section
            style={{
              width: "min(760px, calc(100% - 24px))",
              margin: "14px auto 18px",
              padding: "clamp(12px, 4vw, 18px)",
              borderRadius: "10px",
              border: "2px solid #00ff88",
              background:
                "linear-gradient(135deg, rgba(0,45,35,0.92), rgba(0,12,30,0.9))",
              boxShadow: "0 0 30px rgba(0,255,136,0.45)",
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
              gap: "clamp(12px, 4vw, 18px)",
              alignItems: "center",
              textAlign: "left",
            }}
            data-testid="winner-panel"
          >
            <div
              style={{
                aspectRatio: "1 / 1",
                borderRadius: "12px",
                border: "1px solid rgba(0,255,136,0.7)",
                background: "rgba(0,0,0,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                boxShadow: "0 0 24px rgba(0,255,136,0.35)",
              }}
            >
              <img
                src={winnerImage}
                alt={winnerStageVisual.alt}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
                data-testid="winner-image"
              />
            </div>
            <div>
              <div
                style={{
                  color: "#00ff88",
                  fontSize: "12px",
                  fontWeight: "bold",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  marginBottom: "8px",
                }}
              >
                Battle Result
              </div>
              <h2
                style={{
                  margin: "0 0 8px",
                  color: "#ffffff",
                  fontSize: "clamp(28px, 6vw, 48px)",
                  lineHeight: 1,
                  textShadow: "0 0 18px rgba(0,255,136,0.7)",
                }}
              >
                {winnerTitle}
              </h2>
              <p
                style={{
                  margin: "0 0 14px",
                  color: "#cffff0",
                  fontSize: "clamp(12px, 2.8vw, 15px)",
                  lineHeight: 1.5,
                }}
              >
                {winnerNeedsChainFinalization
                  ? "The Garden Bot target was reached. The interface is stopping this match here while the contract target bug is queued for upgrade."
                  : `${Math.max(playerGrowth, opponentGrowth)} / ${growthTarget} Growth reached.`}
              </p>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <button
                  onClick={handleNativeShareWin}
                  style={{
                    minHeight: "44px",
                    minWidth: "92px",
                    flex: "1 1 104px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #00ff88",
                    background: "rgba(0,255,136,0.16)",
                    color: "#eafff6",
                    cursor: "pointer",
                    fontWeight: "bold",
                    fontSize: "14px",
                  }}
                >
                  Share
                </button>
                <button
                  onClick={handleCopyWin}
                  style={{
                    minHeight: "44px",
                    minWidth: "92px",
                    flex: "1 1 104px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #88ccff",
                    background: "rgba(0,90,140,0.22)",
                    color: "#e6f6ff",
                    cursor: "pointer",
                    fontWeight: "bold",
                    fontSize: "14px",
                  }}
                >
                  Copy
                </button>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodedShareText}&url=${encodedShareUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    minHeight: "44px",
                    minWidth: "64px",
                    flex: "1 1 72px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #ffffff",
                    color: "#ffffff",
                    textDecoration: "none",
                    fontWeight: "bold",
                    fontSize: "14px",
                    textAlign: "center",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  X
                </a>
                <a
                  href={`https://t.me/share/url?url=${encodedShareUrl}&text=${encodedShareText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    minHeight: "44px",
                    minWidth: "116px",
                    flex: "1 1 116px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #2aa8ff",
                    color: "#dff4ff",
                    textDecoration: "none",
                    fontWeight: "bold",
                    fontSize: "14px",
                    textAlign: "center",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  Telegram
                </a>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodedShareUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    minHeight: "44px",
                    minWidth: "116px",
                    flex: "1 1 116px",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #7da7ff",
                    color: "#e9f0ff",
                    textDecoration: "none",
                    fontWeight: "bold",
                    fontSize: "14px",
                    textAlign: "center",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  Facebook
                </a>
              </div>
            </div>
          </section>
        )}

        {battleState && !battleFinished && (
          <div
            className="gb-battle-options"
            data-testid="battle-options"
          >
            <div className={`gb-turn-command gb-turn-command-${matchStatusTone}`} role="status">
              <span>{fifthMoveDraft.pending && selectedFifthMoveId === null ? "Step 1 of 2" : matchLiveStatus}</span>
              <strong>
                {fifthMoveDraft.pending && selectedFifthMoveId === null
                  ? "Choose your bonus fifth move"
                  : battleStatus}
              </strong>
            </div>

            <div className="gb-hand-toolbar">
              <span>
                <small>Your Hand</small>
                <strong>{handSummary || "Loading cards…"}</strong>
              </span>
              <button type="button" onClick={() => openCardGuide(playerMoves.length > 0)}>
                <BookOpen size={15} aria-hidden="true" />
                Card Guide
              </button>
            </div>
            {/* Transaction and refresh feedback. Normal turn state lives in the compact match bar. */}
            {(pendingMoveId !== null || isMoveTransactionPending || isTreeRerollTransactionPending || isBattleRefreshPending) && <div
              style={{
                textAlign: "center",
                marginBottom: "10px",
                padding: "8px 16px",
                borderRadius: "8px",
                background:
                  pendingMoveId !== null || isMoveTransactionPending || isTreeRerollTransactionPending
                    ? "rgba(80,60,0,0.7)"
                    : isBattleRefreshPending
                      ? "rgba(0, 70, 80, 0.78)"
                    : "rgba(0,40,80,0.7)",
                border: `1px solid ${
                  pendingMoveId !== null || isMoveTransactionPending || isTreeRerollTransactionPending
                    ? "#ffcc00"
                    : isBattleRefreshPending
                      ? "#00e5ff"
                      : "#44aaff"
                }`,
                color:
                  pendingMoveId !== null || isMoveTransactionPending || isTreeRerollTransactionPending
                    ? "#ffcc00"
                    : isBattleRefreshPending
                      ? "#c9fbff"
                      : "#88ccff",
                fontSize: "clamp(11px, 2.5vw, 14px)",
                fontWeight: "bold",
                letterSpacing: "0.5px",
                transition: "all 0.3s ease",
              }}
            >
              {isTreeRerollTransactionPending
                ? treeRerollLifecycleStage === "awaiting-wallet-approval"
                  ? "Review and approve the TREE Reroll in your wallet..."
                  : treeRerollLifecycleStage === "refreshing-battle"
                    ? "Reroll confirmed. Loading your new hand..."
                    : "TREE Reroll submitted. Waiting for confirmation..."
                : isBattleRefreshPending
                  ? "Refreshing battle state from chain..."
                : pendingMoveId !== null
                  ? `Waiting for transaction... (${MOVE_LABELS[pendingMoveId] || "Move"})`
                  : "Waiting for transaction confirmation..."}
            </div>}

            {(attacksAreStalled || handNeedsReroll) && !battleFinished && !isPracticeActive && (
              <div
                role="status"
                style={{
                  marginBottom: "10px",
                  padding: "10px 14px",
                  border: "1px solid #ffaa33",
                  borderRadius: "8px",
                  background: "rgba(80, 45, 0, 0.82)",
                  color: "#ffe5b4",
                  textAlign: "center",
                  fontSize: "clamp(11px, 2.5vw, 13px)",
                  fontWeight: "bold",
                  lineHeight: "1.4",
                }}
              >
                {handNeedsReroll
                  ? "Bad Garden Bot hand detected. You have fewer than two moves that grow your tree; start a new bot hand to avoid a stalled match."
                  : "Garden Bot is at 0 Growth. Attack moves cannot push that bar lower; use growth or start a new bot hand."}
              </div>
            )}

            {/* Inline error banner */}
            {inlineError && (
              <div
                style={{
                  background: "rgba(150,0,0,0.7)",
                  border: "1px solid #ff4444",
                  borderRadius: "8px",
                  padding: "10px 16px",
                  marginBottom: "10px",
                  color: "#ffaaaa",
                  fontSize: "clamp(11px, 2.5vw, 13px)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span>⚠️</span>
                <span>{inlineError}</span>
                <button
                  onClick={() => setInlineError(null)}
                  style={{
                    marginLeft: "auto",
                    background: "none",
                    border: "none",
                    color: "#ff8888",
                    cursor: "pointer",
                    fontSize: "16px",
                    fontWeight: "bold",
                    padding: "0 4px",
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            {recoverableBattleError && battleState && !isPracticeActive && !battleFinished && (
              <div
                role="alert"
                style={{
                  marginBottom: "12px",
                  padding: "14px",
                  border: "1px solid rgba(0, 229, 255, 0.68)",
                  borderRadius: "10px",
                  background:
                    "linear-gradient(135deg, rgba(0, 34, 48, 0.94), rgba(35, 22, 0, 0.88))",
                  boxShadow: "0 0 18px rgba(0, 229, 255, 0.16)",
                  color: "#d8fbff",
                  fontFamily: "Orbitron, sans-serif",
                }}
              >
                <div
                  style={{
                    color: "#00e5ff",
                    fontSize: "clamp(12px, 2.6vw, 15px)",
                    fontWeight: 900,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    marginBottom: "6px",
                  }}
                >
                  {recoverableBattleError.title}
                </div>
                <div
                  style={{
                    color: "#c9fbff",
                    fontSize: "clamp(11px, 2.5vw, 13px)",
                    lineHeight: 1.45,
                    marginBottom: recoverableBattleError.detail ? "6px" : "12px",
                  }}
                >
                  {recoverableBattleError.body}
                </div>
                {recoverableBattleError.detail && (
                  <div
                    style={{
                      color: "#ffe7a8",
                      fontSize: "clamp(10px, 2.4vw, 12px)",
                      lineHeight: 1.4,
                      marginBottom: "12px",
                    }}
                  >
                    {recoverableBattleError.detail}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    onClick={handleRefreshBattle}
                    disabled={isBattleRefreshPending}
                    style={{
                      background: isBattleRefreshPending
                        ? "rgba(0, 160, 160, 0.28)"
                        : "linear-gradient(135deg, #00e5ff, #00ff88)",
                      border: "1px solid rgba(201, 251, 255, 0.65)",
                      borderRadius: "8px",
                      color: "#021a18",
                      cursor: isBattleRefreshPending ? "wait" : "pointer",
                      fontSize: "12px",
                      fontWeight: 900,
                      letterSpacing: "0.04em",
                      padding: "9px 13px",
                      textTransform: "uppercase",
                    }}
                  >
                    {isBattleRefreshPending ? "Refreshing..." : "Refresh Battle"}
                  </button>
                  <button
                    type="button"
                    onClick={dismissRecoverableBattleError}
                    disabled={isBattleRefreshPending}
                    style={{
                      background: "rgba(4, 14, 18, 0.72)",
                      border: "1px solid rgba(201, 251, 255, 0.35)",
                      borderRadius: "8px",
                      color: "#c9fbff",
                      cursor: isBattleRefreshPending ? "not-allowed" : "pointer",
                      fontSize: "12px",
                      fontWeight: 800,
                      letterSpacing: "0.04em",
                      padding: "9px 13px",
                      textTransform: "uppercase",
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {!isPracticeActive && rerollBattleSupported && (
              <section
                aria-label="TREE Reroll"
                style={{
                  marginBottom: "14px",
                  padding: "12px 14px",
                  border: `1px solid ${rerollUsed ? "#66736d" : "#c8ff3d"}`,
                  borderRadius: "11px",
                  background: rerollUsed
                    ? "rgba(20, 31, 28, 0.84)"
                    : "linear-gradient(135deg, rgba(20, 52, 20, 0.92), rgba(35, 25, 0, 0.9))",
                  boxShadow: rerollUsed ? "none" : "0 0 16px rgba(200, 255, 61, 0.14)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0, flex: "1 1 250px" }}>
                    <strong style={{ display: "block", color: rerollUsed ? "#a8b5ae" : "#eaffad", fontSize: "13px", letterSpacing: "0.05em" }}>
                      TREE REROLL · {rerollUsed ? "USED" : "ONE PER BATTLE"}
                    </strong>
                    <span style={{ display: "block", marginTop: "4px", color: "#e7f2e9", fontSize: "12px", lineHeight: 1.4 }}>
                      Replace every card in your hand without losing your turn.
                      {treeRerollCostTree === null ? " Activation is not complete yet." : ` Cost: ${treeRerollCostTree.toLocaleString()} TREE.`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRerollReviewOpen(true)}
                    disabled={!rerollCanReview}
                    style={{
                      minHeight: "44px",
                      padding: "10px 16px",
                      borderRadius: "9px",
                      border: "1px solid rgba(234, 255, 173, 0.8)",
                      background: rerollCanReview ? "linear-gradient(135deg, #c8ff3d, #28e6a2)" : "rgba(85, 103, 92, 0.35)",
                      color: rerollCanReview ? "#07170d" : "#a5b2aa",
                      cursor: rerollCanReview ? "pointer" : "not-allowed",
                      fontWeight: 900,
                    }}
                  >
                    {rerollUsed
                      ? "Reroll Used"
                      : isTreeRerollTransactionPending
                        ? "Reroll Pending"
                        : !isMyTurn
                          ? "Available on Your Turn"
                          : treeRerollCostTree === null
                            ? "Not Active Yet"
                            : "Review Reroll"}
                  </button>
                </div>
                {rerollReviewOpen && !rerollUsed && treeRerollCostTree !== null && (
                  <div role="dialog" aria-label="Confirm TREE Reroll" style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(200,255,61,0.35)" }}>
                    <strong style={{ color: "#fff4ad" }}>Confirm before opening your wallet</strong>
                    <p style={{ margin: "6px 0 10px", color: "#f3f7ee", fontSize: "12px", lineHeight: 1.5 }}>
                      This spends exactly {treeRerollCostTree.toLocaleString()} TREE, replaces your entire hand, and cannot be undone. Your turn and Growth score stay the same.
                    </p>
                    <div style={{ display: "flex", gap: "9px", flexWrap: "wrap" }}>
                      <button type="button" onClick={handleConfirmReroll} disabled={!rerollCanReview} style={{ minHeight: "44px", padding: "10px 15px", borderRadius: "8px", border: "1px solid #ecffae", background: "#c8ff3d", color: "#07170d", fontWeight: 900 }}>
                        Approve {treeRerollCostTree.toLocaleString()} TREE Reroll
                      </button>
                      <button type="button" onClick={() => setRerollReviewOpen(false)} style={{ minHeight: "44px", padding: "10px 15px", borderRadius: "8px", border: "1px solid #8ca094", background: "rgba(0,0,0,0.3)", color: "#e8f0ea", fontWeight: 800 }}>
                        Keep Current Hand
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {fifthMoveDraft.pending && (
              <section
                aria-label="Choose your fifth move"
                className={`gb-fifth-picker${selectedFifthMoveId !== null ? " gb-fifth-picker-selected" : ""}`}
              >
                <div className="gb-fifth-picker-title">
                  Choose Your Fifth Move
                </div>
                <p>
                  Pick one bonus card for this battle. Your choice locks with your first move—no extra wallet confirmation.
                </p>
                <div className="gb-fifth-picker-grid">
                  {fifthMoveDraft.candidates.map((moveId) => {
                    const selected = selectedFifthMoveId === moveId;
                    return (
                      <button
                        key={`fifth-${moveId}`}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setSelectedFifthMoveId(moveId)}
                        disabled={battleFinished || moveControlsLocked}
                        data-testid={`button-fifth-move-${moveId}`}
                        className={`gb-fifth-picker-card${selected ? " gb-fifth-picker-card-selected" : ""}`}
                      >
                        <MoveCardFace moveId={moveId} isFifth compact />
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Move card grid */}
            {(!fifthMoveDraft.pending || selectedFifthMoveId !== null) && <div className="gb-move-card-grid">
              {playerMoves.length === 0 && (
                <div
                  role="status"
                  style={{
                    gridColumn: "1 / -1",
                    minHeight: "52px",
                    padding: "14px",
                    border: "1px solid rgba(68, 170, 255, 0.55)",
                    borderRadius: "10px",
                    background: "rgba(0, 35, 65, 0.78)",
                    color: "#d8f3ff",
                    textAlign: "center",
                    fontSize: "clamp(12px, 2.5vw, 14px)",
                    fontWeight: "bold",
                  }}
                >
                  Loading battle moves from chain...
                </div>
              )}
              {playerMoves.map((moveId, moveIndex) => {
                const meta = MOVE_META[moveId];
                const isAttack = meta?.type === "attack";
                const isGrowth = meta?.type === "growth";
                const isHybrid = meta?.type === "hybrid";
                const isPending = pendingMoveId === moveId;
                const isFifthMoveCard = isUnlockedFifthMoveCard(
                  moveIndex,
                  playerMoves.length,
                  fifthMoveEntitled,
                );
                const isRepeatedMove = lastPlayerMoveId === moveId;
                const currentOutcome = getCurrentMoveOutcome(
                  moveId,
                  playerGrowth,
                  opponentGrowth,
                  lastPlayerMoveId,
                  lastOpponentMoveId,
                );
                const isDisabled =
                  battleFinished ||
                  moveControlsLocked ||
                  !isMyTurn ||
                  (fifthMoveDraft.pending && selectedFifthMoveId === null) ||
                  isRepeatedMove;

                const borderColor = isGrowth
                  ? "#00ff88"
                  : isHybrid
                    ? "#ffaa33"
                    : "#ff5544";
                const bgBase = isGrowth
                  ? "rgba(0,80,30,0.75)"
                  : isHybrid
                    ? "rgba(80,40,0,0.75)"
                    : "rgba(80,0,0,0.75)";
                return (
                  <button
                    key={moveId}
                    className={`gb-battle-move-card${isFifthMoveCard ? " gb-battle-move-card-fifth" : ""}${isRepeatedMove ? " gb-battle-move-card-repeated" : ""}`}
                    onClick={() => handleUseAbility(moveId)}
                    disabled={isDisabled}
                    style={{
                      background: isPending ? "rgba(200,160,0,0.3)" : bgBase,
                      border: `${isFifthMoveCard ? 3 : 2}px solid ${borderColor}`,
                      borderRadius: "10px",
                      padding: "12px 10px",
                      cursor: isDisabled ? "not-allowed" : "pointer",
                      opacity: isDisabled && !isPending ? (isFifthMoveCard ? 0.74 : 0.5) : 1,
                      textAlign: "left",
                      transition: "all 0.2s ease",
                      boxShadow: isPending
                        ? `0 0 20px ${borderColor}, 0 0 34px rgba(181, 108, 255, 0.55)`
                        : isFifthMoveCard
                          ? `0 0 12px ${borderColor}, 0 0 24px rgba(255, 216, 75, 0.42)`
                          : `0 0 6px ${borderColor}40`,
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                    onMouseEnter={(e) => {
                      if (!isDisabled) {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = isFifthMoveCard
                          ? `0 0 20px ${borderColor}, 0 0 34px rgba(255, 216, 75, 0.68)`
                          : `0 0 20px ${borderColor}`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = isFifthMoveCard
                        ? `0 0 12px ${borderColor}, 0 0 24px rgba(255, 216, 75, 0.42)`
                        : `0 0 6px ${borderColor}40`;
                    }}
                    data-testid={`button-ability-${moveId}`}
                  >
                    {isFifthMoveCard && (
                      <span className="gb-fifth-move-card-ribbon">
                        <Sparkles size={12} strokeWidth={2.8} aria-hidden="true" />
                        Your Bonus Fifth Move
                      </span>
                    )}
                    <MoveCardFace moveId={moveId} isFifth={isFifthMoveCard} isPending={isPending} />
                    {isRepeatedMove ? (
                      <span className="gb-move-card-state gb-move-card-state-locked">
                        Used last turn · Choose another card
                      </span>
                    ) : currentOutcome ? (
                      <span className="gb-move-card-state">{currentOutcome}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>}

            {(battleState && !battleFinished) && (
              <div
                className="gb-battle-secondary-controls"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  gap: "12px",
                  marginTop: "18px",
                }}
              >
                {isPracticeActive ? (
                  <>
                    <button
                      onClick={handleStartPracticeBattle}
                      style={{
                        padding: "14px 18px",
                        borderRadius: "10px",
                        border: "2px solid #00ffaa",
                        background: "linear-gradient(45deg, #00e5ff, #00ffaa)",
                        color: "#001414",
                        cursor: "pointer",
                        fontWeight: "bold",
                        textTransform: "uppercase",
                        boxShadow: "0 0 18px rgba(0, 229, 255, 0.45)",
                      }}
                    >
                      New Practice Battle
                    </button>
                    <button
                      onClick={clearPracticeBattle}
                      style={{
                        padding: "14px 18px",
                        borderRadius: "10px",
                        border: "2px solid rgba(255,255,255,0.35)",
                        background: "rgba(0, 0, 0, 0.35)",
                        color: "#d8fff2",
                        cursor: "pointer",
                        fontWeight: "bold",
                        textTransform: "uppercase",
                      }}
                    >
                      End Practice
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="gb-battle-forfeit-button"
                      onClick={handleForfeitBattle}
                      disabled={isForfeiting}
                      style={{
                    padding: "14px 18px",
                    borderRadius: "10px",
                    border: "2px solid #ff4444",
                    background: isForfeiting
                      ? "rgba(100, 0, 0, 0.5)"
                      : "linear-gradient(45deg, #ff4444, #aa0000)",
                    color: isForfeiting ? "#ccc" : "#fff",
                    cursor: isForfeiting ? "not-allowed" : "pointer",
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    boxShadow: isForfeiting
                      ? "none"
                      : "0 0 18px rgba(255, 68, 68, 0.45)",
                  }}
                    >
                      {isForfeiting ? "Forfeiting..." : "Forfeit Battle"}
                    </button>
                    {isGardenBotBattle && (attacksAreStalled || handNeedsReroll) && (
                      <button
                        className="gb-battle-new-hand-button"
                        onClick={handleStartBotBattle}
                        disabled={isStartingBot}
                        style={{
                      minHeight: "48px",
                      padding: "14px 18px",
                      borderRadius: "10px",
                      border: "2px solid #00e5ff",
                      background: isStartingBot
                        ? "rgba(0, 90, 100, 0.5)"
                        : "linear-gradient(45deg, #00e5ff, #00ffaa)",
                      color: isStartingBot ? "#d4f8ff" : "#001414",
                      cursor: isStartingBot ? "not-allowed" : "pointer",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                      boxShadow: isStartingBot
                        ? "none"
                        : "0 0 18px rgba(0, 229, 255, 0.45)",
                        }}
                      >
                        {isStartingBot ? "Dealing..." : "Deal a New Hand"}
                      </button>
                    )}
                    {canClaimTimeout && (
                      <button
                        onClick={handleClaimTimeout}
                        disabled={isClaimingTimeout}
                        style={{
                      padding: "14px 18px",
                      borderRadius: "10px",
                      border: "2px solid #ffcc00",
                      background: isClaimingTimeout
                        ? "rgba(100, 100, 0, 0.5)"
                        : "linear-gradient(45deg, #ffcc00, #ffdd55)",
                      color: isClaimingTimeout ? "#333" : "#000",
                      cursor: isClaimingTimeout ? "not-allowed" : "pointer",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                      boxShadow: isClaimingTimeout
                        ? "none"
                        : "0 0 18px rgba(255, 204, 0, 0.55)",
                        }}
                      >
                        {isClaimingTimeout ? "Claiming..." : "Claim Timeout Win"}
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={handleAdminForceClose}
                        disabled={isAdminClosing}
                        style={{
                      padding: "14px 18px",
                      borderRadius: "10px",
                      border: "2px solid #00ccff",
                      background: isAdminClosing
                        ? "rgba(0, 100, 150, 0.5)"
                        : "linear-gradient(45deg, #00ccff, #00aaff)",
                      color: isAdminClosing ? "#ccc" : "#000",
                      cursor: isAdminClosing ? "not-allowed" : "pointer",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                      boxShadow: isAdminClosing
                        ? "none"
                        : "0 0 18px rgba(0, 204, 255, 0.45)",
                        }}
                      >
                        {isAdminClosing ? "Closing..." : "Admin Force Close"}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Battle Log */}
            <div className="gb-battle-log-panel">
              <div className="gb-battle-log-title">📜 Battle Log <span>Tap a move for full details</span></div>
              <BattleLog
                entries={effectiveActionLog}
                isPlayer1={!!isPlayer1}
                opponentLabel={isGardenBotBattle ? "Garden Bot" : "Opponent"}
              />
            </div>
          </div>
        )}
          </div>
          </div>}

        {/* Battle Info */}
        {(!battleState || battleFinished) && <p
          style={{
            margin: "15px 0",
            fontSize: "clamp(14px, 3.5vw, 20px)",
            color: "#00ffcc",
            padding: "0 15px",
          }}
          data-testid="text-entry-fee"
        >
          {battleInfoText}
        </p>}
        {(!battleState || battleFinished) && <p
          style={{
            marginTop: "15px",
            fontSize: "clamp(14px, 3.5vw, 20px)",
            color: "#ffff00",
            padding: "0 15px",
          }}
          data-testid="text-battle-status"
        >
          {battleStatus}
        </p>}

        {!battleState && <ArboretumComingSoonPromo />}
        </main>
        {/* Footer */}
        <footer
          style={{
            textAlign: "center",
            padding: "25px",
            background: "rgba(0, 50, 0, 0.8)",
            borderTop: "2px solid #00ff00",
            boxShadow: "0 0 15px #00ff00",
            position: "relative",
          }}
        >
          <a
            href="https://t.me/cryptoarborist"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#00ffcc",
              textDecoration: "none",
              transition: "color 0.3s ease, text-shadow 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#00ffff";
              e.currentTarget.style.textShadow =
                "0 0 10px #00ffff, 0 0 20px #00ffff, 0 0 30px #00ffff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#00ffcc";
              e.currentTarget.style.textShadow = "none";
            }}
          >
            Powered by $TREE on SUI
          </a>
          <div
            style={{
              position: "absolute",
              bottom: "10px",
              right: "15px",
              fontSize: "13px",
              color: "#00ff00",
              opacity: 0.7,
            }}
          >
            © 2025 Thickquidity
          </div>
        </footer>

        <BattleDialog
          isOpen={dialogOpen}
          message={dialogMessage}
          onClose={handleCloseBattleDialog}
          canClose={canCloseBattleDialog}
        />
        {utilityDrawer === "tree" && (
          <TreeBenefitsDrawer
            address={address}
            isBattleActive={!!battleState && !battleFinished}
            isPracticeBattle={isPracticeActive}
            currentMoveCount={fifthMoveDraft.pending ? 5 : playerMoves.length}
            rerollStatus={
              isPracticeActive || isGardenBotBattle
                ? "mode-excluded"
                : !rerollBattleSupported
                  ? "available-in-pvp"
                : rerollUsed
                  ? "used"
                  : isTreeRerollTransactionPending
                    ? treeRerollLifecycleStage === "awaiting-wallet-approval"
                      ? "awaiting-approval"
                      : "submitted"
                    : treeRerollCostTree === null
                      ? "not-live"
                      : isMyTurn
                        ? "available"
                        : "waiting-turn"
            }
            rerollCostTree={treeRerollCostTree}
            rerollUsed={rerollUsed}
            onClose={() => setUtilityDrawer(null)}
          />
        )}
        {utilityDrawer === "nftree" && (
          <NftreeAcquisitionDrawer onClose={() => setUtilityDrawer(null)} />
        )}
        <CardGuide
          isOpen={cardGuideOpen}
          currentHand={playerMoves}
          initialCurrentHandOnly={cardGuideCurrentHandOnly}
          onClose={() => setCardGuideOpen(false)}
        />
        <BattleResultModal
          open={resultModalOpen}
          title={winnerTitle}
          score={`Final score: ${resultScore}`}
          summary={resultSummary}
          imageUrl={winnerImage}
          imageAlt={winnerStageVisual.alt}
          shareOptions={resultShareOptions}
          selectedShareOptionId={selectedResultShareOption?.id ?? ""}
          xShareUrl={`https://twitter.com/intent/tweet?text=${encodedShareText}&url=${encodedShareUrl}`}
          smsShareUrl={smsShareUrl}
          facebookShareUrl={facebookShareUrl}
          leaderboardUrl={leaderboardRoute}
          canPlayAgain={isGardenBotBattle && !isPracticeActive}
          isPlayingAgain={isResultPlayAgainStarting}
          onSelectShareOption={setSelectedResultShareOptionId}
          onShare={handleNativeShareWin}
          onCopy={handleCopyWin}
          onClose={handleCloseResultModal}
          onPlayAgain={handlePlayAgainFromResult}
        />
        <AdminPanel
          adminAddresses={SUI_CONFIG.ADMIN_ADDRESSES}
          currentAddress={address || null}
        />

        {/* Arboretum Coming Soon Modal */}
        {arboretumModalOpen && (
          <div
            onClick={() => setArboretumModalOpen(false)}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0, 0, 0, 0.9)",
              zIndex: 200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "clamp(1rem, 3vw, 2rem)",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "relative",
                width: "clamp(300px, 90vw, 600px)",
                background:
                  "linear-gradient(rgba(0, 50, 0, 0.95), rgba(0, 80, 0, 0.95))",
                border: "3px solid #00ff00",
                borderRadius: "10px",
                boxShadow: "0 0 30px rgba(0, 255, 0, 0.6)",
                padding: "clamp(2rem, 5vw, 3rem)",
                textAlign: "center",
              }}
            >
              <h2
                style={{
                  fontSize: "clamp(1.5rem, 4vw, 2.5rem)",
                  color: "#00ff00",
                  marginBottom: "clamp(1rem, 3vw, 1.5rem)",
                  textShadow: "0 0 10px rgba(0, 255, 0, 0.8)",
                  fontFamily: "Orbitron, sans-serif",
                }}
              >
                The Arboretum
              </h2>
              <a
                href="https://nftree.net"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: "clamp(1.2rem, 3vw, 1.5rem)",
                  color: "#00ffcc",
                  marginBottom: "clamp(1rem, 3vw, 1.5rem)",
                  display: "inline-block",
                  textDecoration: "underline",
                  fontWeight: "bold",
                  fontFamily: "Orbitron, sans-serif",
                }}
                onClick={() => setArboretumModalOpen(false)}
              >
                Buy NFTree
              </a>
              <p
                style={{
                  fontSize: "clamp(0.9rem, 2.2vw, 1rem)",
                  color: "#fff",
                  marginBottom: "clamp(1.5rem, 4vw, 2rem)",
                  lineHeight: "1.6",
                  fontFamily: "Orbitron, sans-serif",
                }}
              >
                The Arboretum is a future TREE ecosystem utility. Buy an NFTree
                to join the ecosystem while details are still being shaped.
              </p>
              <button
                onClick={() => setArboretumModalOpen(false)}
                style={{
                  background: "linear-gradient(45deg, #00ff00, #00cc00)",
                  color: "#000",
                  padding:
                    "clamp(0.6rem, 1.8vw, 0.8rem) clamp(1.2rem, 2.8vw, 2rem)",
                  borderRadius: "9999px",
                  border: "2px solid #00ff00",
                  fontWeight: "bold",
                  fontSize: "clamp(0.8rem, 2.2vw, 1rem)",
                  cursor: "pointer",
                  transition: "transform 0.3s, box-shadow 0.3s",
                  boxShadow: "0 0 15px rgba(0, 255, 0, 0.6)",
                  fontFamily: "Orbitron, sans-serif",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.1)";
                  e.currentTarget.style.boxShadow = "0 0 25px #00ff00";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow =
                    "0 0 15px rgba(0, 255, 0, 0.6)";
                }}
                data-testid="button-close-arboretum"
              >
                Got it!
              </button>
              <button
                onClick={() => setArboretumModalOpen(false)}
                style={{
                  position: "absolute",
                  top: "clamp(10px, 2vw, 15px)",
                  right: "clamp(10px, 2vw, 15px)",
                  width: "clamp(30px, 8vw, 40px)",
                  height: "clamp(30px, 8vw, 40px)",
                  background: "rgba(0, 50, 0, 0.8)",
                  color: "#00ff00",
                  borderRadius: "50%",
                  border: "2px solid #00ff00",
                  fontSize: "clamp(1rem, 2.5vw, 1.2rem)",
                  cursor: "pointer",
                  transition: "transform 0.3s, box-shadow 0.3s",
                  fontFamily: "Orbitron, sans-serif",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.2)";
                  e.currentTarget.style.boxShadow = "0 0 15px #00ff00";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "";
                }}
                data-testid="button-close-arboretum-x"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
