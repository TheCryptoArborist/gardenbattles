import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { fetchPlayerStats, type LeaderboardMode, type PlayerStats } from "@/lib/api";
import { appRoute } from "@/lib/routes";
import TreeBadgeCrest from "@/components/TreeBadgeCrest";

interface PlayerRecordProps {
  address: string | null;
  mode?: LeaderboardMode;
}

function getBattleRankClass(rankTitle: string): string {
  return `gb-battle-rank-${rankTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function getDisplayRankTitle(stats: PlayerStats): string {
  if (stats.ranked === false || stats.total_battles < 3) return "Grove Recruit";
  return stats.rank_title;
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
        style={{
          alignItems: "center",
          background: "rgba(0,30,0,0.6)",
          border: "1px solid rgba(0,255,0,0.2)",
          borderRadius: "6px",
          color: "#888",
          display: "flex",
          fontSize: "11px",
          gap: "6px",
          padding: "4px 10px",
        }}
      >
        <span>Loading stats...</span>
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
      className={`gb-player-record-card ${getBattleRankClass(displayRankTitle)}`}
      title="View full leaderboard"
    >
      <div className={`gb-battle-rank-badge ${getBattleRankClass(displayRankTitle)}`}>
        <TreeBadgeCrest family="battle-rank" rankName={displayRankTitle} size="lg" />
        <span className="gb-rank-copy">
          <span className="gb-battle-rank-kicker">Battle Rank</span>
          <span className="gb-battle-rank-title">{displayRankTitle}</span>
        </span>
      </div>

      <div
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
      </div>

      {streakLabel && (
        <div className="gb-player-record-streak">
          {streakLabel}
        </div>
      )}

      <div className="gb-player-record-total">
        {stats.total_battles} battle{stats.total_battles !== 1 ? "s" : ""}
      </div>
    </div>
    </Link>
  );
}
