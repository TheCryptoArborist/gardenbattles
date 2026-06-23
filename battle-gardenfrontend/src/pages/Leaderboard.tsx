import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ConnectButton } from "@mysten/dapp-kit";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { SUI_CONFIG } from "@/lib/sui-config";
import { fetchLeaderboard, fetchPlayerStats, type LeaderboardEntry, type PlayerStats } from "@/lib/api";
import ForestPower from "@/components/ForestPower";
import PlayerRecord from "@/components/PlayerRecord";

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

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function Leaderboard() {
  const currentAccount = useCurrentAccount();
  const address = currentAccount?.address ?? null;

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myStats, setMyStats] = useState<PlayerStats | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchLeaderboard(100, 0)
      .then((data) => {
        setLeaderboard(data.leaderboard);
        setTotalPlayers(data.total);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!address) {
      setMyStats(null);
      return;
    }
    fetchPlayerStats(address)
      .then(setMyStats)
      .catch(() => setMyStats(null));
  }, [address]);

  return (
    <div
      style={{
        backgroundImage: "url(/assets/background4.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center center",
        backgroundAttachment: "fixed",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#000",
        color: "white",
        fontFamily: "Orbitron, sans-serif",
        margin: 0,
        padding: 0,
        minHeight: "100vh",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "clamp(10px, 2vw, 15px) clamp(15px, 3vw, 30px)",
          background: "rgba(0, 50, 0, 0.8)",
          borderBottom: "2px solid #00ff00",
          boxShadow: "0 0 15px #00ff00",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <Link href="/">
          <img
            src="/assets/thick.png"
            alt="Thickquidity Logo"
            style={{
              width: "clamp(60px, 10vw, 80px)",
              cursor: "pointer",
              filter: "drop-shadow(0 0 15px #00ff00)",
            }}
            data-testid="logo-home"
          />
        </Link>

        <nav style={{ display: "flex", gap: "clamp(8px, 2vw, 10px)", flexWrap: "wrap" }}>
          <Link
            href="/"
            style={{ color: "#00ff00", margin: "0", textDecoration: "none", fontSize: "clamp(14px, 2.5vw, 16px)" }}
          >
            Home
          </Link>
          <Link
            href="/battle"
            style={{ color: "#00ff00", margin: "0", textDecoration: "none", fontSize: "clamp(14px, 2.5vw, 16px)" }}
          >
            Battle
          </Link>
          <Link
            href="/mint"
            style={{ color: "#00ff00", margin: "0", textDecoration: "none", fontSize: "clamp(14px, 2.5vw, 16px)" }}
          >
            Arboretum
          </Link>
        </nav>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {address && <ForestPower address={address} />}
          {address && <PlayerRecord address={address} />}
          <ConnectButton connectText="Connect Wallet" />
        </div>
      </header>

      {/* Main Content */}
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px 15px" }}>
        <h1
          style={{
            textAlign: "center",
            color: "#00ff00",
            fontSize: "clamp(24px, 5vw, 36px)",
            textShadow: "0 0 20px #00ff00",
            marginBottom: "8px",
            fontFamily: "FantasyBattles, sans-serif",
          }}
        >
          🌳 Garden Leaderboard
        </h1>
        <p
          style={{
            textAlign: "center",
            color: "#00ffcc",
            fontSize: "clamp(12px, 2.5vw, 14px)",
            marginBottom: "20px",
          }}
        >
          Ranked by PvP wins — tracked from on-chain battle results
        </p>

        {/* My Stats Card */}
        {address && myStats && myStats.total_battles > 0 && (
          <div
            style={{
              background: "rgba(0, 40, 0, 0.9)",
              border: "2px solid #00ff00",
              borderRadius: "12px",
              padding: "16px 20px",
              marginBottom: "20px",
              boxShadow: "0 0 20px rgba(0,255,0,0.2)",
            }}
          >
            <h3 style={{ color: "#00ff00", fontSize: "14px", textTransform: "uppercase", marginBottom: "10px" }}>
              Your Record
            </h3>
            <div style={{ display: "flex", gap: "clamp(16px, 4vw, 32px)", flexWrap: "wrap" }}>
              <div>
                <div style={{ color: "#888", fontSize: "11px", textTransform: "uppercase" }}>Rank Title</div>
                <div style={{ color: TITLE_COLORS[myStats.rank_title] || "#fff", fontSize: "16px", fontWeight: "bold" }}>
                  {myStats.rank_title}
                </div>
              </div>
              <div>
                <div style={{ color: "#888", fontSize: "11px", textTransform: "uppercase" }}>Wins</div>
                <div style={{ color: "#4CAF50", fontSize: "16px", fontWeight: "bold" }}>{myStats.wins}</div>
              </div>
              <div>
                <div style={{ color: "#888", fontSize: "11px", textTransform: "uppercase" }}>Losses</div>
                <div style={{ color: "#F44336", fontSize: "16px", fontWeight: "bold" }}>{myStats.losses}</div>
              </div>
              <div>
                <div style={{ color: "#888", fontSize: "11px", textTransform: "uppercase" }}>Win Rate</div>
                <div style={{ color: "#FF9800", fontSize: "16px", fontWeight: "bold" }}>
                  {Math.round(myStats.win_rate * 100)}%
                </div>
              </div>
              <div>
                <div style={{ color: "#888", fontSize: "11px", textTransform: "uppercase" }}>Streak</div>
                <div
                  style={{
                    color: myStats.current_streak > 0 ? "#4CAF50" : myStats.current_streak < 0 ? "#F44336" : "#888",
                    fontSize: "16px",
                    fontWeight: "bold",
                  }}
                >
                  {myStats.current_streak > 0
                    ? `🔥 ${myStats.current_streak}W`
                    : myStats.current_streak < 0
                      ? `💀 ${Math.abs(myStats.current_streak)}L`
                      : "—"}
                </div>
              </div>
              <div>
                <div style={{ color: "#888", fontSize: "11px", textTransform: "uppercase" }}>Total</div>
                <div style={{ color: "#fff", fontSize: "16px", fontWeight: "bold" }}>{myStats.total_battles}</div>
              </div>
              {myStats.badges.length > 0 && (
                <div>
                  <div style={{ color: "#888", fontSize: "11px", textTransform: "uppercase" }}>Badges</div>
                  <div style={{ display: "flex", gap: "4px", fontSize: "16px" }}>
                    {myStats.badges.map((b) => (
                      <span key={b} title={b}>
                        {BADGE_EMOJIS[b] || "🏅"}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Leaderboard Table */}
        <div
          style={{
            background: "rgba(0, 10, 0, 0.85)",
            border: "2px solid rgba(0, 255, 0, 0.3)",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#888" }}>Loading leaderboard...</div>
          ) : error ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#F44336" }}>
              Failed to load leaderboard: {error}
            </div>
          ) : leaderboard.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#888" }}>
              No battles recorded yet. Be the first to play!
              <br />
              <Link
                href="/battle"
                style={{ color: "#00ff00", textDecoration: "underline", display: "inline-block", marginTop: "12px" }}
              >
                Join Battle →
              </Link>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "clamp(11px, 2.2vw, 13px)" }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid rgba(0,255,0,0.2)",
                      color: "#00ff00",
                      textTransform: "uppercase",
                      fontSize: "clamp(10px, 2vw, 11px)",
                      letterSpacing: "0.5px",
                    }}
                  >
                    <th style={{ padding: "12px 8px", textAlign: "center" }}>#</th>
                    <th style={{ padding: "12px 8px", textAlign: "left" }}>Player</th>
                    <th style={{ padding: "12px 8px", textAlign: "center" }}>Title</th>
                    <th style={{ padding: "12px 8px", textAlign: "center" }}>W</th>
                    <th style={{ padding: "12px 8px", textAlign: "center" }}>L</th>
                    <th style={{ padding: "12px 8px", textAlign: "center" }}>Win%</th>
                    <th style={{ padding: "12px 8px", textAlign: "center" }}>Streak</th>
                    <th style={{ padding: "12px 8px", textAlign: "center" }}>Total</th>
                    <th style={{ padding: "12px 8px", textAlign: "center" }}>Badges</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry) => {
                    const isMe = address && entry.address === address.toLowerCase();
                    const titleColor = TITLE_COLORS[entry.rank_title] || "#8B8B8B";

                    return (
                      <tr
                        key={entry.address}
                        style={{
                          borderBottom: "1px solid rgba(0,255,0,0.08)",
                          background: isMe ? "rgba(0,255,0,0.06)" : "transparent",
                          transition: "background 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(0,255,0,0.1)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = isMe ? "rgba(0,255,0,0.06)" : "transparent";
                        }}
                      >
                        <td style={{ padding: "10px 8px", textAlign: "center", color: "#888" }}>
                          {entry.rank <= 3 ? (
                            <span style={{ fontSize: "18px" }}>
                              {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : "🥉"}
                            </span>
                          ) : (
                            entry.rank
                          )}
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "left" }}>
                          <span style={{ color: isMe ? "#00ff00" : "#ccc", fontWeight: isMe ? "bold" : "normal" }}>
                            {shortenAddress(entry.address)}
                            {isMe && (
                              <span style={{ color: "#00ff00", marginLeft: "6px", fontSize: "10px" }}>
                                (you)
                              </span>
                            )}
                          </span>
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "center" }}>
                          <span style={{ color: titleColor, fontWeight: "bold", fontSize: "clamp(10px, 2vw, 11px)" }}>
                            {entry.rank_title}
                          </span>
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "center", color: "#4CAF50", fontWeight: "bold" }}>
                          {entry.wins}
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "center", color: "#F44336" }}>
                          {entry.losses}
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "center", color: "#FF9800" }}>
                          {Math.round(entry.win_rate * 100)}%
                        </td>
                        <td
                          style={{
                            padding: "10px 8px",
                            textAlign: "center",
                            color: entry.current_streak > 0 ? "#4CAF50" : entry.current_streak < 0 ? "#F44336" : "#888",
                          }}
                        >
                          {entry.current_streak > 0
                            ? `🔥 ${entry.current_streak}`
                            : entry.current_streak < 0
                              ? `💀 ${Math.abs(entry.current_streak)}`
                              : "—"}
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "center", color: "#aaa" }}>
                          {entry.total_battles}
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: "2px", justifyContent: "center" }}>
                            {entry.badges.slice(0, 3).map((b) => (
                              <span key={b} style={{ fontSize: "14px" }}>
                                {BADGE_EMOJIS[b] || "🏅"}
                              </span>
                            ))}
                            {entry.badges.length > 3 && (
                              <span style={{ color: "#888", fontSize: "10px" }}>+{entry.badges.length - 3}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div
          style={{
            marginTop: "20px",
            textAlign: "center",
            color: "#555",
            fontSize: "clamp(10px, 2vw, 12px)",
            padding: "15px",
          }}
        >
          <p>Leaderboard tracks PvP battles only (bot battles excluded from rankings).</p>
          <p>Rank titles earned through PvP wins: Rooted Contender (10), Grove Champion (25), Canopy Elite (50), Last Tree Standing (100).</p>
          <p style={{ marginTop: "8px" }}>
            <Link
              href="/battle"
              style={{ color: "#00ff00", textDecoration: "underline", fontSize: "13px" }}
            >
              ← Back to Battle
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
