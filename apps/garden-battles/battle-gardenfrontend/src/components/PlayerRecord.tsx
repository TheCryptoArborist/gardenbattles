import { useEffect, useState, useRef } from "react";
import { fetchPlayerStats, type PlayerStats } from "@/lib/api";

interface PlayerRecordProps {
  address: string | null;
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

const BADGE_EMOJIS: Record<string, string> = {
  first_blood: "🩸",
  hot_streak: "🔥",
  undefeated: "🏆",
  battle_hardened: "⚔️",
  veteran: "🎖️",
  legend: "👑",
  sharp_pruner: "✂️",
  never_give_up: "💪",
  social_butterfly: "🦋",
};

const TITLE_COLORS: Record<string, string> = {
  Seedling: "#8B8B8B",
  "Sapling Scrapper": "#4CAF50",
  "Rooted Contender": "#2196F3",
  "Grove Champion": "#9C27B0",
  "Canopy Elite": "#FF9800",
  "Last Tree Standing": "#F44336",
};

export default function PlayerRecord({ address }: PlayerRecordProps) {
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const prevAddressRef = useRef<string | null>(null);

  useEffect(() => {
    if (!address) {
      setStats(null);
      return;
    }

    const addr = address.toLowerCase();
    if (prevAddressRef.current === addr) return;
    prevAddressRef.current = addr;

    setLoading(true);
    fetchPlayerStats(addr)
      .then((data) => {
        setStats(data);
      })
      .catch(() => {
        // Server might be down or no stats yet — silently handle
        setStats(null);
      })
      .finally(() => setLoading(false));
  }, [address]);

  if (!address || (!loading && !stats)) return null;
  if (loading && !stats) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 10px",
          background: "rgba(0,30,0,0.6)",
          border: "1px solid rgba(0,255,0,0.2)",
          borderRadius: "6px",
          fontSize: "11px",
          color: "#888",
        }}
      >
        <span>Loading stats...</span>
      </div>
    );
  }
  if (!stats) return null;

  const titleColor = TITLE_COLORS[stats.rank_title] || "#8B8B8B";
  const streakLabel =
    stats.current_streak > 0
      ? `🔥 ${stats.current_streak}W streak`
      : stats.current_streak < 0
        ? `💀 ${Math.abs(stats.current_streak)}L streak`
        : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        padding: "6px 12px",
        background: "rgba(0,20,0,0.8)",
        border: "1px solid rgba(0,255,0,0.25)",
        borderRadius: "8px",
        fontFamily: "Orbitron, sans-serif",
        fontSize: "11px",
        minWidth: "140px",
      }}
    >
      {/* Rank Title */}
      <div
        style={{
          color: titleColor,
          fontWeight: "bold",
          fontSize: "12px",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          textShadow: `0 0 8px ${titleColor}40`,
        }}
      >
        {stats.rank_title}
      </div>

      {/* W/L Record */}
      <div style={{ color: "#ccc", fontSize: "11px" }}>
        <span style={{ color: "#4CAF50" }}>{stats.wins}W</span>
        {" "}
        <span style={{ color: "#F44336" }}>{stats.losses}L</span>
        {stats.total_battles > 0 && (
          <span style={{ color: "#888", marginLeft: "6px" }}>
            ({Math.round(stats.win_rate * 100)}%)
          </span>
        )}
      </div>

      {/* Streak */}
      {streakLabel && (
        <div style={{ color: "#FF9800", fontSize: "10px" }}>
          {streakLabel}
        </div>
      )}

      {/* Total battles */}
      <div style={{ color: "#668", fontSize: "10px" }}>
        {stats.total_battles} battle{stats.total_battles !== 1 ? "s" : ""}
      </div>

      {/* Badges */}
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
                fontSize: "14px",
                cursor: "default",
                filter: "drop-shadow(0 0 2px rgba(0,255,0,0.3))",
              }}
            >
              {BADGE_EMOJIS[badge] || "🏅"}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
