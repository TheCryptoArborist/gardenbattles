import type { FifthMoveEligibility } from "@/lib/suiDexTreePosition";

export const TREE_POWER_BUY_URL = "https://www.tree-token.xyz/dapp/#swap";

export type FifthMoveDisplayStatus =
  | "inactive"
  | "not-connected"
  | "checking"
  | "not-qualified"
  | "verification-incomplete"
  | "qualified"
  | "qualified-not-live"
  | "unavailable"
  | "active";
export type TreeRerollStatus =
  | "unavailable"
  | "available-in-pvp"
  | "waiting-turn"
  | "mode-excluded"
  | "available"
  | "insufficient-tree"
  | "awaiting-approval"
  | "submitted"
  | "used"
  | "not-live";

export type FifthMovePresentation = {
  status: FifthMoveDisplayStatus;
  statusLabel: string;
  handLabel: string;
  title: string;
  description: string;
  explainer: string | null;
  slotCount: number;
  filledSlots: number;
  isUnlocked: boolean;
};

export type TreeRerollPresentation = {
  status: TreeRerollStatus;
  statusLabel: string;
  costLabel: string;
  buttonLabel: string;
  disabled: boolean;
  helperText: string;
};

function formatQualificationSources(sources: FifthMoveEligibility["sources"]): string {
  if (sources.length > 1) return "Multiple TREE Positions";
  if (sources[0] === "suidex-v2") return "SuiDex V2";
  if (sources[0] === "suidex-v3") return "SuiDex V3";
  if (sources[0] === "moonbags-staking") return "Moonbags Staking";
  return "TREE Position";
}

export function getFifthMovePresentation(options: {
  isBattleActive: boolean;
  currentMoveCount: number;
  eligibility?: FifthMoveEligibility;
  isFifthMoveActivationLive?: boolean;
}): FifthMovePresentation {
  const slotCount = 5;
  const filledSlots = Math.max(0, Math.min(slotCount, Math.floor(options.currentMoveCount || 0)));
  const explainer =
    "NFTree grants access to Garden Battles. Support TREE through SuiDex liquidity or Moonbags staking to unlock your fifth move.";

  if (!options.isBattleActive) {
    return {
      status: "inactive",
      statusLabel: "Available during battle",
      handLabel: "Current Hand: - / 5",
      title: "Fifth Move Unlock",
      description: "Available during an active battle.",
      explainer,
      slotCount,
      filledSlots: 0,
      isUnlocked: false,
    };
  }

  if (filledSlots >= slotCount) {
    return {
      status: "active",
      statusLabel: "Unlocked",
      handLabel: `Current Hand: ${filledSlots} / 5`,
      title: "Fifth move active",
      description: "Your active hand includes the fifth move slot.",
      explainer,
      slotCount,
      filledSlots,
      isUnlocked: true,
    };
  }

  const eligibility = options.eligibility ?? { status: "unavailable", sources: [] };

  if (eligibility.status === "not-connected") {
    return {
      status: "not-connected",
      statusLabel: "Verify Position",
      handLabel: `Current Hand: ${filledSlots} / 5`,
      title: "Fifth Move Unlock",
      description: "Connect wallet to verify SuiDex position.",
      explainer,
      slotCount,
      filledSlots,
      isUnlocked: false,
    };
  }

  if (eligibility.status === "checking") {
    return {
      status: "checking",
      statusLabel: "Checking",
      handLabel: `Current Hand: ${filledSlots} / 5`,
      title: "Fifth Move Unlock",
      description: "Checking SuiDex and Moonbags TREE positions.",
      explainer,
      slotCount,
      filledSlots,
      isUnlocked: false,
    };
  }

  if (eligibility.status === "unavailable") {
    return {
      status: "unavailable",
      statusLabel: "Position Verification Unavailable",
      handLabel: `Current Hand: ${filledSlots} / 5`,
      title: "Fifth Move Unlock",
      description: "Position verification temporarily unavailable.",
      explainer,
      slotCount,
      filledSlots,
      isUnlocked: false,
    };
  }

  if (eligibility.status === "verification-incomplete") {
    return {
      status: "verification-incomplete",
      statusLabel: "Position Verification Incomplete",
      handLabel: `Current Hand: ${filledSlots} / 5`,
      title: "Fifth Move Unlock",
      description: "Known verified TREE is below threshold and one or more sources are unavailable.",
      explainer,
      slotCount,
      filledSlots,
      isUnlocked: false,
    };
  }

  if (eligibility.status === "qualified") {
    const sourceLabel = formatQualificationSources(eligibility.sources);

      if (!options.isFifthMoveActivationLive) {
      return {
        status: "qualified-not-live",
        statusLabel: "Position Qualified",
        handLabel: `Current Hand: ${filledSlots} / 5`,
        title: "Fifth Move Unlock",
        description: `Fifth Move Activation Not Live Yet. Qualified via ${sourceLabel}.`,
        explainer,
        slotCount,
        filledSlots,
        isUnlocked: false,
      };
    }

    return {
      status: "qualified",
      statusLabel: `Unlocked via ${sourceLabel}`,
      handLabel: `Current Hand: ${filledSlots} / 5`,
      title: "Fifth Move Unlock",
      description: `Your verified TREE through ${sourceLabel} meets the combined 1,000,000 TREE fifth-card requirement.`,
      explainer,
      slotCount,
      filledSlots: slotCount,
      isUnlocked: true,
    };
  }

  return {
    status: "not-qualified",
    statusLabel: "No Qualifying TREE Position",
    handLabel: `Current Hand: ${filledSlots} / 5`,
    title: "Fifth Move Unlock",
    description: "Build a combined 1,000,000 TREE position through supported SuiDex liquidity or Moonbags staking to unlock the fifth move.",
    explainer,
    slotCount,
    filledSlots,
    isUnlocked: false,
  };
}

export function getTreeRerollPresentation(options: {
  isPracticeBattle: boolean;
  rerollStatus?: TreeRerollStatus;
  rerollCostTree?: number | null;
}): TreeRerollPresentation {
  if (options.isPracticeBattle) {
    return {
      status: "mode-excluded",
      statusLabel: "Paid PvP Only",
      costLabel: "No Practice Mode payment",
      buttonLabel: "Not Used in Practice",
      disabled: true,
      helperText: "TREE Reroll is a live paid-PvP feature. Practice Mode has no wallet payments.",
    };
  }

  const status = options.rerollStatus ?? "not-live";
  const costLabel =
    typeof options.rerollCostTree === "number"
      ? `${options.rerollCostTree.toLocaleString()} TREE`
      : "Cost not configured";

  switch (status) {
    case "not-live":
      return {
        status,
        statusLabel: "Not Live",
        costLabel,
        buttonLabel: "TREE Reroll Not Active",
        disabled: true,
        helperText: "Design preview only. No TREE transaction is available yet.",
      };
    case "unavailable":
      return {
        status,
        statusLabel: "Status Temporarily Unavailable",
        costLabel,
        buttonLabel: "Check Again Shortly",
        disabled: true,
        helperText: "The game could not confirm the live reroll configuration. No TREE has been charged.",
      };
    case "available-in-pvp":
      return {
        status,
        statusLabel: "Live in Paid PvP",
        costLabel,
        buttonLabel: "Available During Paid PvP",
        disabled: true,
        helperText: "Start a current paid PvP match. During your turn, you may replace your entire hand once for 20,000 TREE.",
      };
    case "waiting-turn":
      return {
        status,
        statusLabel: "Ready on Your Turn",
        costLabel,
        buttonLabel: "Wait for Your Turn",
        disabled: true,
        helperText: "Your reroll is unused and will become available when it is your turn.",
      };
    case "mode-excluded":
      return {
        status,
        statusLabel: "Paid PvP Only",
        costLabel,
        buttonLabel: "Not Used in This Mode",
        disabled: true,
        helperText: "TREE Reroll is live in paid PvP. Garden Bot and Practice Mode do not include paid rerolls.",
      };
    case "insufficient-tree":
      return {
        status,
        statusLabel: "Need TREE",
        costLabel,
        buttonLabel: "Insufficient TREE",
        disabled: true,
        helperText: "Add enough liquid TREE to this wallet before rerolling.",
      };
    case "awaiting-approval":
      return {
        status,
        statusLabel: "Awaiting Approval",
        costLabel,
        buttonLabel: "Awaiting Wallet",
        disabled: true,
        helperText: "Waiting for wallet approval.",
      };
    case "submitted":
      return {
        status,
        statusLabel: "Submitted",
        costLabel,
        buttonLabel: "Reroll Submitted",
        disabled: true,
        helperText: "Waiting for the reroll transaction to settle.",
      };
    case "used":
      return {
        status,
        statusLabel: "Used",
        costLabel,
        buttonLabel: "Reroll Used",
        disabled: true,
        helperText: "One reroll has already been used in this battle.",
      };
    case "available":
      return {
        status,
        statusLabel: "Available",
        costLabel,
        buttonLabel: "Reroll Hand",
        disabled: false,
        helperText: "Full hand replacement. Once per battle.",
      };
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}
