import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { fetchPlayerStats, type LeaderboardMode, type PlayerStats } from "@/lib/api";
import { appRoute } from "@/lib/routes";
import TreeBadgeCrest from "@/components/TreeBadgeCrest";

interface PlayerRecordProps {
  address: string | null;
  mode?: LeaderboardMode;
  label?: string;
}

function getBattleRankClass(rankTitle: string): string {
  return `gb-battle-rank-${rankTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function getDisplayRankTitle(stats: PlayerStats): string {
  if (stats.ranked === false || stats.total_battles < 3) return "Grove Recruit";
  return stats.rank_title;
}

function formatBadgeTitle(badge: string): string {
  return badge
    .split("_")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function getEmptyStats(address: string, mode: LeaderboardMode): PlayerStats {
  return {
    address,
    wins: 0,
    losses: 0,
    total_battles: 0,
    current_streak: 0,
    max_win_streak: 0,
    rank_title: "Grove Recruit",
    badges: [],
    win_rate: 0,
    total_bot_wins: 0,
    total_bot_losses: 0,
    mode,
    last_played: null,
    recent_result: null,
    ranked: false,
  };
}

export default function PlayerRecord({
  address,
  mode = "overall",
  label = "Battle Rank",
}: PlayerRecordProps) {
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const prevRequestRef = useRef<string | null>(null);

  useEffect(() => {
    if (!address) {
      setStats(null);
      prevRequestRef.current = null;
      return;
    }

    const addr = address.toLowerCase();
    const requestKey = `${addr}:${mode}`;
    if (prevRequestRef.current === requestKey) return;
    prevRequestRef.current = requestKey;

    setLoading(true);
    fetchPlayerStats(addr, mode)
      .then((data) => {
        setStats(data);
      })
      .catch(() => {
        setStats(getEmptyStats(addr, mode));
      })
      .finally(() => setLoading(false));
  }, [address, mode]);

  if (!address) return null;
  if (loading && !stats) {
    return (
      <div
        className="gb-player-record-card gb-hud-rank-card gb-hud-rank-loading"
        aria-label="Loading battle rank"
      >
        <span className="gb-hud-rank-loading-crest" />
        <span className="gb-hud-rank-content">
          <span className="gb-battle-rank-kicker">{label}</span>
          <span className="gb-hud-rank-loading-line gb-hud-rank-loading-line-title" />
          <span className="gb-hud-rank-loading-line" />
        </span>
      </div>
    );
  }
  if (!stats) {
    return null;
  }

  const streakLabel =
    stats.current_streak > 0
      ? `+${stats.current_streak}W streak`
      : stats.current_streak < 0
        ? `${Math.abs(stats.current_streak)}L streak`
        : null;
  const displayRankTitle = getDisplayRankTitle(stats);

  return (
    <Link
      href={appRoute("leaderboard")}
      aria-label="View full leaderboard"
      style={{ display: "block", textDecoration: "none" }}
    >
    <div
      className={`gb-player-record-card gb-hud-rank-card ${getBattleRankClass(displayRankTitle)}`}
      title="View full leaderboard"
    >
      <span className="gb-hud-rank-crest-shell">
        <TreeBadgeCrest family="battle-rank" rankName={displayRankTitle} size="lg" />
      </span>

      <span className="gb-hud-rank-content">
        <span className="gb-battle-rank-kicker">{label}</span>
        <span className="gb-battle-rank-title">{displayRankTitle}</span>

        <span
          className="gb-player-record-stats"
          aria-label={`${stats.wins} wins, ${stats.losses} losses`}
        >
          <span className="gb-player-record-wins">{stats.wins}W</span>
          <span className="gb-player-record-losses">{stats.losses}L</span>
          {stats.total_battles > 0 && (
            <span className="gb-player-record-win-rate">
              ({Math.round(stats.win_rate * 100)}%)
            </span>
          )}
        </span>

        {streakLabel && (
          <span className="gb-player-record-streak">
            {streakLabel}
          </span>
        )}

        <span className="gb-player-record-meta">
          <span className="gb-player-record-total">
            {stats.total_battles} battle{stats.total_battles !== 1 ? "s" : ""}
          </span>
        </span>
        {stats.badges.length > 0 && (
          <span className="gb-player-record-badges" aria-label={`${stats.badges.length} earned battle badges`}>
            {stats.badges.slice(0, 3).map((badge) => (
              <span key={badge} title={formatBadgeTitle(badge)}>{formatBadgeTitle(badge)}</span>
            ))}
            {stats.badges.length > 3 && <span>+{stats.badges.length - 3}</span>}
          </span>
        )}
        <span className="gb-player-record-leaderboard-cue">View full leaderboard</span>
      </span>
    </div>
    </Link>
  );
}
