import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { fetchPlayerStats, type LeaderboardMode, type PlayerStats } from "@/lib/api";
import { appRoute } from "@/lib/routes";

interface PlayerRecordProps {
  address: string | null;
  mode?: LeaderboardMode;
}

const BADGE_LABELS: Record<string, string> = {
  first_blood: "First Blood",
  hot_streak: "Hot Streak",
  undefeated: "Undefeated",
  battle_hardened: "Battle Hardened",
  veteran: "Veteran",
  legend: "Legend",
  sharp_pruner: "Sharp Pruner",
  never_give_up: "Never Give Up",
  social_butterfly: "Social Butterfly",
};

const BADGE_CODES: Record<string, string> = {
  first_blood: "FB",
  hot_streak: "HOT",
  undefeated: "UNB",
  battle_hardened: "B100",
  veteran: "VET",
  legend: "LEG",
  sharp_pruner: "PRN",
  never_give_up: "NGU",
  social_butterfly: "SOC",
};

const TITLE_COLORS: Record<string, string> = {
  Seedling: "#8B8B8B",
  "Sapling Scrapper": "#4CAF50",
  "Rooted Contender": "#2196F3",
  "Grove Champion": "#9C27B0",
  "Canopy Elite": "#FF9800",
  "Last Tree Standing": "#F44336",
};

function getEmptyStats(address: string, mode: LeaderboardMode): PlayerStats {
  return {
    address,
    wins: 0,
    losses: 0,
    total_battles: 0,
    current_streak: 0,
    max_win_streak: 0,
    rank_title: "Seedling",
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

  const titleColor = TITLE_COLORS[stats.rank_title] || "#8B8B8B";
  const streakLabel =
    stats.current_streak > 0
      ? `+${stats.current_streak}W streak`
      : stats.current_streak < 0
        ? `${Math.abs(stats.current_streak)}L streak`
        : null;

  return (
    <Link
      href={appRoute("leaderboard")}
      aria-label="View full leaderboard"
      style={{ display: "block", textDecoration: "none" }}
    >
    <div
      style={{
        background: "rgba(0,20,0,0.8)",
        border: "1px solid rgba(0,255,0,0.25)",
        borderRadius: "8px",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Orbitron, sans-serif",
        fontSize: "11px",
        gap: "4px",
        minWidth: "140px",
        padding: "6px 12px",
      }}
      title="View full leaderboard"
    >
      <div
        style={{
          color: titleColor,
          fontSize: "12px",
          fontWeight: "bold",
          letterSpacing: "0.5px",
          textShadow: `0 0 8px ${titleColor}40`,
          textTransform: "uppercase",
        }}
      >
        {stats.rank_title}
      </div>

      <div style={{ color: "#ccc", fontSize: "11px" }}>
        <span style={{ color: "#4CAF50" }}>{stats.wins}W</span>{" "}
        <span style={{ color: "#F44336" }}>{stats.losses}L</span>
        {stats.total_battles > 0 && (
          <span style={{ color: "#888", marginLeft: "6px" }}>
            ({Math.round(stats.win_rate * 100)}%)
          </span>
        )}
      </div>

      {streakLabel && (
        <div style={{ color: "#FF9800", fontSize: "10px" }}>
          {streakLabel}
        </div>
      )}

      <div style={{ color: "#668", fontSize: "10px" }}>
        {stats.total_battles} battle{stats.total_battles !== 1 ? "s" : ""}
      </div>

      {stats.badges.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "3px",
            marginTop: "2px",
          }}
        >
          {stats.badges.map((badge) => (
            <span
              key={badge}
              title={BADGE_LABELS[badge] || badge}
              style={{
                color: "#9bd9bd",
                cursor: "default",
                fontSize: "10px",
                fontWeight: 800,
              }}
            >
              {BADGE_CODES[badge] || "BDG"}
            </span>
          ))}
        </div>
      )}
    </div>
    </Link>
  );
}
