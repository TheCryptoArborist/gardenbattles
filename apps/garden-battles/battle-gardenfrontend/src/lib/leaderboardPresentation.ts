import type { LeaderboardEntry, LeaderboardMode, PlayerStats } from "./api";

export const BATTLE_RANKS = [
  "Grove Recruit",
  "Rooted Fighter",
  "Thorn Challenger",
  "Grove Striker",
  "Canopy Champion",
  "Elderroot Titan",
] as const;

export type BattleRankTitle = (typeof BATTLE_RANKS)[number];

export interface RankProgress {
  currentTitle: string;
  nextTitle: string | null;
  currentValue: number;
  targetValue: number;
  remaining: number;
  progressPercent: number;
  progressLabel: string;
  isMaximumRank: boolean;
}

export interface BadgeDisplay {
  visible: string[];
  overflow: number;
}

export function formatRecord(wins: number, losses: number): string {
  return `${wins}W-${losses}L`;
}

export function formatWinRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function formatStreak(value: number): string {
  if (value > 0) return `+${value}W`;
  if (value < 0) return `${value}L`;
  return "0";
}

export function getModeLabel(mode: LeaderboardMode): string {
  if (mode === "bot") return "Garden Bot";
  if (mode === "overall") return "Overall";
  return "PvP Battle";
}

export function getPlayerRecordHeading(mode: LeaderboardMode): string {
  if (mode === "bot") return "Your Garden Bot Record";
  if (mode === "overall") return "Your Overall Record";
  return "Your PvP Record";
}

export function getDisplayRankTitle(
  stats: Pick<PlayerStats | LeaderboardEntry, "rank_title" | "ranked" | "total_battles">,
): BattleRankTitle | string {
  if (stats.ranked === false || stats.total_battles < 3) return "Grove Recruit";
  return stats.rank_title;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getRankProgress(
  stats: Pick<PlayerStats | LeaderboardEntry, "wins" | "total_battles" | "rank_title" | "ranked">,
): RankProgress {
  const displayTitle = getDisplayRankTitle(stats);

  if (stats.ranked === false || stats.total_battles < 3) {
    const remaining = Math.max(0, 3 - stats.total_battles);
    return {
      currentTitle: "Grove Recruit",
      nextTitle: "Rooted Fighter",
      currentValue: stats.total_battles,
      targetValue: 3,
      remaining,
      progressPercent: clampPercent((stats.total_battles / 3) * 100),
      progressLabel:
        remaining === 1
          ? "1 more battle to become ranked"
          : `${remaining} more battles to become ranked`,
      isMaximumRank: false,
    };
  }

  const wins = stats.wins;
  const ladder = [
    { title: "Rooted Fighter", nextTitle: "Thorn Challenger", floor: 0, target: 10 },
    { title: "Thorn Challenger", nextTitle: "Grove Striker", floor: 10, target: 25 },
    { title: "Grove Striker", nextTitle: "Canopy Champion", floor: 25, target: 50 },
    { title: "Canopy Champion", nextTitle: "Elderroot Titan", floor: 50, target: 100 },
  ];
  const current = ladder.find((item) => item.title === displayTitle);

  if (!current || displayTitle === "Elderroot Titan" || wins >= 100) {
    return {
      currentTitle: "Elderroot Titan",
      nextTitle: null,
      currentValue: wins,
      targetValue: 100,
      remaining: 0,
      progressPercent: 100,
      progressLabel: "Maximum battle rank reached",
      isMaximumRank: true,
    };
  }

  const remaining = Math.max(0, current.target - wins);
  const span = current.target - current.floor;
  return {
    currentTitle: current.title,
    nextTitle: current.nextTitle,
    currentValue: wins,
    targetValue: current.target,
    remaining,
    progressPercent: clampPercent(((wins - current.floor) / span) * 100),
    progressLabel:
      remaining === 1
        ? `1 more win to reach ${current.nextTitle}`
        : `${remaining} more wins required`,
    isMaximumRank: false,
  };
}

export function selectTopPlayers(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return entries.slice(0, 3);
}

export function orderPodiumForDesktop(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  if (entries.length < 3) return entries;
  return [entries[1], entries[0], entries[2]];
}

export function isConnectedWallet(
  entryAddress: string,
  connectedAddress: string | null | undefined,
): boolean {
  return !!connectedAddress && entryAddress.toLowerCase() === connectedAddress.toLowerCase();
}

export function getEarnedBadgeDisplay(badges: string[] = [], limit = 3): BadgeDisplay {
  const earned = badges.filter(Boolean);
  return {
    visible: earned.slice(0, limit),
    overflow: Math.max(0, earned.length - limit),
  };
}

export function getEmptyModeMessage(mode: LeaderboardMode): string {
  if (mode === "bot") return "No verified Garden Bot battles have been recorded yet.";
  if (mode === "overall") return "No verified Garden Battles have been recorded yet.";
  return "No verified PvP battles have been recorded yet.";
}
