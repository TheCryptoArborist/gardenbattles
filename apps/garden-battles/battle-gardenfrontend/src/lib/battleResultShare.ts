export type BattleResultShareOutcome = "win" | "loss" | "practice";

export interface BattleResultShareOption {
  id: string;
  title: string;
  message: string;
}

interface BattleResultShareInput {
  outcome: BattleResultShareOutcome;
  playerGrowth: number;
  opponentGrowth: number;
  targetGrowth: number;
}

export function getBattleResultShareOptions({
  outcome,
  playerGrowth,
  opponentGrowth,
  targetGrowth,
}: BattleResultShareInput): BattleResultShareOption[] {
  const score = `${playerGrowth}-${opponentGrowth}`;

  if (outcome === "practice") {
    return [
      {
        id: "practice-run",
        title: "Practice Run",
        message: `I just finished a ${targetGrowth} Growth Garden Battles practice run at ${score}. Time to enter the arena! 🌱⚔️`,
      },
      {
        id: "practice-ready",
        title: "Battle Ready",
        message: `Training complete: ${score} in Garden Battles Practice Mode. Who wants the first real match? 🌳🔥`,
      },
      {
        id: "practice-challenge",
        title: "Challenge",
        message: `My NFTree is warming up in Garden Battles. Think yours can survive the arena? 🌳⚔️`,
      },
    ];
  }

  if (outcome === "win") {
    return [
      {
        id: "win-victory",
        title: "Victory",
        message: `I won a ${targetGrowth} Growth Garden Battles match, ${score}! Think your NFTree can beat mine? 🌳⚔️`,
      },
      {
        id: "win-challenge",
        title: "Challenge",
        message: `My NFTree survived the arena at ${score}. Who wants the next Garden Battles challenge? 🌳🔥`,
      },
      {
        id: "win-leaderboard",
        title: "Leaderboard",
        message: `Another Garden Battles victory added to my record: ${score}. Enter the arena and climb the leaderboard! 🏆`,
      },
    ];
  }

  return [
    {
      id: "loss-pruned",
      title: "Got Pruned",
      message: `My NFTree got professionally pruned, ${score}. Rematch? 🌳✂️`,
    },
    {
      id: "loss-composted",
      title: "Composted",
      message: `I came. I grew. I got composted, ${score}. Think you can do better? 😂🌱`,
    },
    {
      id: "loss-revenge",
      title: "Revenge Loading",
      message: `I lost this Garden Battles match ${score}, but my revenge arc has officially begun. Who wants the next battle? 🌳⚔️`,
    },
  ];
}

export function buildBattleResultShareText(
  message: string,
  battleUrl: string,
): string {
  return `${message}\n${battleUrl}`;
}

export function buildSmsShareUrl(message: string, isAppleDevice: boolean): string {
  const separator = isAppleDevice ? "&" : "?";
  return `sms:${separator}body=${encodeURIComponent(message)}`;
}
