import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import {
  fetchLeaderboard,
  fetchPlayerStats,
  type LeaderboardEntry,
  type LeaderboardMode,
  type PlayerStats,
} from "@/lib/api";
import ForestPower from "@/components/ForestPower";
import PlayerRecord from "@/components/PlayerRecord";
import { appAsset } from "@/lib/assets";

const TITLE_COLORS: Record<string, string> = {
  "Grove Recruit": "#8B8B8B",
  "Rooted Fighter": "#4CAF50",
  "Thorn Challenger": "#2196F3",
  "Grove Striker": "#9C27B0",
  "Canopy Champion": "#FF9800",
  "Elderroot Titan": "#F44336",
};

function getBattleRankClass(rankTitle: string): string {
  return `gb-battle-rank-${rankTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

const COSMETIC_PLACEHOLDERS: Record<string, string> = {
  "Grove Recruit": "Recruit badge",
  "Rooted Fighter": "Root-frame border",
  "Thorn Challenger": "Thorn trim",
  "Grove Striker": "Leaf-slash accent",
  "Canopy Champion": "Premium canopy glow",
  "Elderroot Titan": "Final-boss aura",
};

const BADGE_LABELS: Record<string, string> = {
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

const LEADERBOARD_MODES: Array<{
  id: LeaderboardMode;
  label: string;
  note: string;
}> = [
  { id: "pvp", label: "PvP Battle", note: "Ranked player-vs-player results" },
  { id: "bot", label: "Garden Bot", note: "Practice battles against Garden Bot" },
  { id: "overall", label: "Overall", note: "PvP plus Garden Bot totals" },
];

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatMode(mode: LeaderboardMode): string {
  if (mode === "bot") return "Garden Bot";
  if (mode === "overall") return "Overall";
  return "PvP";
}

function formatLastPlayed(value: number | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statColor(value: number): string {
  if (value > 0) return "#4CAF50";
  if (value < 0) return "#F44336";
  return "#888";
}

export default function Leaderboard() {
  const currentAccount = useCurrentAccount();
  const address = currentAccount?.address ?? null;

  const [mode, setMode] = useState<LeaderboardMode>("pvp");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myStats, setMyStats] = useState<PlayerStats | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchLeaderboard(100, 0, mode)
      .then((data) => {
        setLeaderboard(data.leaderboard);
        setTotalPlayers(data.total);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [mode]);

  useEffect(() => {
    if (!address) {
      setMyStats(null);
      return;
    }
    fetchPlayerStats(address, mode)
      .then(setMyStats)
      .catch(() => setMyStats(null));
  }, [address, mode]);

  const activeMode = LEADERBOARD_MODES.find((item) => item.id === mode);

  return (
    <div
      style={{
        backgroundImage: `url(${appAsset("assets/background4.jpg")})`,
        backgroundSize: "cover",
        backgroundPosition: "center center",
        backgroundAttachment: "fixed",
        backgroundRepeat: "no-repeat",
        backgroundColor: "#000",
        color: "white",
        fontFamily: "Orbitron, sans-serif",
        margin: 0,
        minHeight: "100vh",
        padding: 0,
      }}
    >
      <header
        style={{
          alignItems: "center",
          background: "rgba(0, 35, 24, 0.88)",
          borderBottom: "2px solid #00ff88",
          boxShadow: "0 0 15px rgba(0,255,136,0.55)",
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          justifyContent: "space-between",
          padding: "clamp(10px, 2vw, 15px) clamp(15px, 3vw, 30px)",
        }}
      >
        <Link href="/">
          <img
            src={appAsset("assets/thick.png")}
            alt="Thickquidity Logo"
            style={{
              cursor: "pointer",
              filter: "drop-shadow(0 0 15px #00ff88)",
              width: "clamp(60px, 10vw, 80px)",
            }}
            data-testid="logo-home"
          />
        </Link>

        <nav style={{ display: "flex", flexWrap: "wrap", gap: "clamp(8px, 2vw, 10px)" }}>
          <a
            href="https://tree-token.net/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#00ff88",
              fontSize: "clamp(14px, 2.5vw, 16px)",
              margin: 0,
              textDecoration: "none",
            }}
          >
            Home
          </a>
          <Link
            href="/battle"
            style={{
              color: "#00ff88",
              fontSize: "clamp(14px, 2.5vw, 16px)",
              margin: 0,
              textDecoration: "none",
            }}
          >
            Battle
          </Link>
          <a
            href="https://nftree.net"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#00ff88",
              fontSize: "clamp(14px, 2.5vw, 16px)",
              margin: 0,
              textDecoration: "none",
            }}
          >
            Buy NFTree
          </a>
        </nav>

        <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {address && <ForestPower address={address} />}
          {address && <PlayerRecord address={address} />}
          <ConnectButton connectText="Connect Wallet" />
        </div>
      </header>

      <main style={{ margin: "0 auto", maxWidth: "1120px", padding: "20px 15px" }}>
        <h1
          style={{
            color: "#00ff88",
            fontFamily: "FantasyBattles, sans-serif",
            fontSize: "clamp(26px, 5vw, 42px)",
            margin: "0 0 8px",
            textAlign: "center",
            textShadow: "0 0 20px rgba(0,255,136,0.72)",
          }}
        >
          Garden Leaderboard
        </h1>
        <p
          style={{
            color: "#00ffcc",
            fontSize: "clamp(12px, 2.5vw, 14px)",
            margin: "0 0 18px",
            textAlign: "center",
          }}
        >
          {activeMode?.note} - tracked from verified battle records
        </p>

        <div
          aria-label="Leaderboard mode"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            justifyContent: "center",
            marginBottom: "18px",
          }}
        >
          {LEADERBOARD_MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              style={{
                background:
                  mode === item.id ? "rgba(0,255,136,0.22)" : "rgba(0,20,18,0.72)",
                border: `1px solid ${
                  mode === item.id ? "#00ff88" : "rgba(0,255,136,0.28)"
                }`,
                borderRadius: "8px",
                color: mode === item.id ? "#eafff6" : "#9bd9bd",
                cursor: "pointer",
                fontFamily: "Orbitron, sans-serif",
                fontSize: "12px",
                fontWeight: 800,
                minHeight: "40px",
                padding: "9px 12px",
                textTransform: "uppercase",
              }}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            disabled
            style={{
              background: "rgba(255,203,79,0.08)",
              border: "1px solid rgba(255,203,79,0.28)",
              borderRadius: "8px",
              color: "rgba(255,233,166,0.62)",
              cursor: "not-allowed",
              fontFamily: "Orbitron, sans-serif",
              fontSize: "12px",
              fontWeight: 800,
              minHeight: "40px",
              padding: "9px 12px",
              textTransform: "uppercase",
            }}
          >
            Canopy Clash - Coming Soon
          </button>
        </div>

        {address && myStats && myStats.total_battles > 0 && (
          <section
            style={{
              background: "rgba(0, 40, 24, 0.9)",
              border: "2px solid #00ff88",
              borderRadius: "12px",
              boxShadow: "0 0 20px rgba(0,255,136,0.2)",
              marginBottom: "20px",
              padding: "16px 20px",
            }}
          >
            <h2
              style={{
                color: "#00ff88",
                fontSize: "14px",
                margin: "0 0 10px",
                textTransform: "uppercase",
              }}
            >
              Your {formatMode(mode)} Record
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "clamp(16px, 4vw, 32px)" }}>
              {[
                ["Rank Title", myStats.rank_title, TITLE_COLORS[myStats.rank_title] || "#fff"],
                [
                  "Planned Cosmetic",
                  COSMETIC_PLACEHOLDERS[myStats.rank_title] || "Cosmetic placeholder",
                  "#00ffcc",
                ],
                ["Wins", myStats.wins, "#4CAF50"],
                ["Losses", myStats.losses, "#F44336"],
                ["Win Rate", `${Math.round(myStats.win_rate * 100)}%`, "#FF9800"],
                ["Total", myStats.total_battles, "#fff"],
                ["Recent", myStats.recent_result ?? "-", myStats.recent_result === "Win" ? "#4CAF50" : "#F44336"],
              ].map(([label, value, color]) => (
                <div key={label}>
                  <div style={{ color: "#888", fontSize: "11px", textTransform: "uppercase" }}>
                    {label}
                  </div>
                  <div style={{ color: String(color), fontSize: "16px", fontWeight: "bold" }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section
          style={{
            background: "rgba(0, 10, 8, 0.88)",
            border: "2px solid rgba(0, 255, 136, 0.3)",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          {loading ? (
            <div style={{ color: "#888", padding: "40px", textAlign: "center" }}>
              Loading leaderboard...
            </div>
          ) : error ? (
            <div style={{ color: "#9bd9bd", padding: "40px", textAlign: "center" }}>
              <strong style={{ color: "#00ff88", display: "block", marginBottom: "10px" }}>
                Leaderboard data unavailable
              </strong>
              {error}
            </div>
          ) : leaderboard.length === 0 ? (
            <div style={{ color: "#888", padding: "40px", textAlign: "center" }}>
              No {formatMode(mode)} battles recorded yet.
              <br />
              <Link
                href="/battle"
                style={{
                  color: "#00ff88",
                  display: "inline-block",
                  marginTop: "12px",
                  textDecoration: "underline",
                }}
              >
                Join Battle
              </Link>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  borderCollapse: "collapse",
                  fontSize: "clamp(11px, 2.2vw, 13px)",
                  minWidth: "980px",
                  width: "100%",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid rgba(0,255,136,0.2)",
                      color: "#00ff88",
                      fontSize: "clamp(10px, 2vw, 11px)",
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                    }}
                  >
                    {[
                      "#",
                      "Player",
                      "Mode",
                      "Title",
                      "Planned Cosmetic",
                      "Wins",
                      "Losses",
                      "Win%",
                      "Streak",
                      "Total",
                      "Recent",
                      "Last Played",
                      "Badges",
                    ].map((header) => (
                      <th
                        key={header}
                        style={{
                          padding: "12px 8px",
                          textAlign: header === "Player" ? "left" : "center",
                        }}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry) => {
                    const isMe = address && entry.address === address.toLowerCase();
                    return (
                      <tr
                        key={`${entry.mode}-${entry.address}`}
                        style={{
                          background: isMe ? "rgba(0,255,136,0.06)" : "transparent",
                          borderBottom: "1px solid rgba(0,255,136,0.08)",
                        }}
                      >
                        <td style={{ color: "#888", padding: "10px 8px", textAlign: "center" }}>
                          {entry.ranked ? entry.rank : "UR"}
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "left" }}>
                          <span
                            style={{
                              color: isMe ? "#00ff88" : "#ccc",
                              fontWeight: isMe ? "bold" : "normal",
                            }}
                          >
                            {shortenAddress(entry.address)}
                            {isMe && (
                              <span style={{ color: "#00ff88", fontSize: "10px", marginLeft: "6px" }}>
                                (you)
                              </span>
                            )}
                          </span>
                        </td>
                        <td style={{ color: "#00ffcc", padding: "10px 8px", textAlign: "center" }}>
                          {formatMode(entry.mode)}
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "center" }}>
                          <span
                            className={`gb-battle-rank-badge gb-battle-rank-table ${getBattleRankClass(entry.rank_title)}`}
                            style={{
                              fontSize: "clamp(10px, 2vw, 11px)",
                            }}
                          >
                            <span className="gb-rank-crest gb-battle-rank-crest" aria-hidden="true">
                              <span className="gb-rank-crest-core" />
                            </span>
                            <span className="gb-battle-rank-title">{entry.rank_title}</span>
                          </span>
                        </td>
                        <td style={{ color: "#00ffcc", padding: "10px 8px", textAlign: "center" }}>
                          <span className={`gb-cosmetic-placeholder ${getBattleRankClass(entry.rank_title)}`}>
                            {COSMETIC_PLACEHOLDERS[entry.rank_title] || "Cosmetic placeholder"}
                          </span>
                        </td>
                        <td style={{ color: "#4CAF50", fontWeight: "bold", padding: "10px 8px", textAlign: "center" }}>
                          {entry.wins}
                        </td>
                        <td style={{ color: "#F44336", padding: "10px 8px", textAlign: "center" }}>
                          {entry.losses}
                        </td>
                        <td style={{ color: "#FF9800", padding: "10px 8px", textAlign: "center" }}>
                          {Math.round(entry.win_rate * 100)}%
                        </td>
                        <td
                          style={{
                            color: statColor(entry.current_streak),
                            padding: "10px 8px",
                            textAlign: "center",
                          }}
                        >
                          {entry.current_streak > 0
                            ? `+${entry.current_streak}W`
                            : entry.current_streak < 0
                              ? `${entry.current_streak}L`
                              : "-"}
                        </td>
                        <td style={{ color: "#aaa", padding: "10px 8px", textAlign: "center" }}>
                          {entry.total_battles}
                        </td>
                        <td
                          style={{
                            color:
                              entry.recent_result === "Win"
                                ? "#4CAF50"
                                : entry.recent_result === "Loss"
                                  ? "#F44336"
                                  : "#888",
                            padding: "10px 8px",
                            textAlign: "center",
                          }}
                        >
                          {entry.recent_result ?? "-"}
                        </td>
                        <td style={{ color: "#aaa", padding: "10px 8px", textAlign: "center" }}>
                          {formatLastPlayed(entry.last_played)}
                        </td>
                        <td style={{ padding: "10px 8px", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                            {entry.badges.slice(0, 3).map((badge) => (
                              <span key={badge} title={badge}>
                                {BADGE_LABELS[badge] || "BDG"}
                              </span>
                            ))}
                            <span style={{ color: "#777", fontSize: "10px" }} title="NFTree rarity slot pending">
                              RAR
                            </span>
                            <span style={{ color: "#777", fontSize: "10px" }} title="VICTORY Locked status pending">
                              VLK
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer
          style={{
            color: "#8aa898",
            fontSize: "clamp(10px, 2vw, 12px)",
            marginTop: "20px",
            padding: "15px",
            textAlign: "center",
          }}
        >
          <p>
            PvP, Garden Bot, and Overall rankings are separated so Garden Bot practice does not
            dominate PvP rankings.
          </p>
          <p>UR means unranked until at least 3 battles are recorded in the selected mode.</p>
          <p>
            Battle-rank cosmetic labels are planned visual rewards only; no NFT metadata changes
            are live.
          </p>
          <p>NFTree rarity and VICTORY Locked badge slots are placeholders only.</p>
          <p>
            Battle ranks are earned through wins: Thorn Challenger at 10, Grove Striker at 25,
            Canopy Champion at 50, and Elderroot Titan at 100. Grove Recruit marks new or
            unranked fighters.
          </p>
          <p style={{ marginTop: "8px" }}>
            <Link href="/battle" style={{ color: "#00ff88", fontSize: "13px", textDecoration: "underline" }}>
              Back to Battle
            </Link>
          </p>
          <p style={{ marginTop: "8px" }}>{totalPlayers} players in this view.</p>
        </footer>
      </main>
    </div>
  );
}
