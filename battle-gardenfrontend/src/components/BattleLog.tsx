import { useEffect, useRef } from "react";
import { MOVE_LABELS, MOVE_META } from "@/lib/sui-config";

export interface ActionEntry {
  id: string;
  timestamp: number;
  actor: "you" | "opponent";
  moveId: number;
  prevPlayerGrowth: number;
  nextPlayerGrowth: number;
  prevOpponentGrowth: number;
  nextOpponentGrowth: number;
  details?: string[];
}

interface BattleLogProps {
  entries: ActionEntry[];
  isPlayer1: boolean;
  opponentLabel?: string;
}

function formatDelta(prev: number, next: number): string {
  const diff = next - prev;
  if (diff === 0) return "no change";
  return diff > 0 ? `+${diff}` : `${diff}`;
}

export default function BattleLog({
  entries,
  opponentLabel = "Opponent",
}: BattleLogProps) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [entries.length]);

  if (entries.length === 0) {
    return (
      <div
        style={{
          padding: "20px",
          textAlign: "center",
          color: "rgba(0,255,204,0.4)",
          fontFamily: "Orbitron, sans-serif",
          fontSize: "13px",
          fontStyle: "italic",
        }}
      >
        Battle log will appear here once moves are played...
      </div>
    );
  }

  return (
    <div
      ref={logRef}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        maxHeight: "220px",
        overflowY: "auto",
        padding: "8px 4px",
      }}
    >
      {entries.map((entry) => {
        const meta = MOVE_META[entry.moveId];
        const label =
          MOVE_LABELS[entry.moveId] ||
          (entry.actor === "you"
            ? "Your move"
            : `${opponentLabel} response`);

        const myPrev =
          entry.actor === "you"
            ? entry.prevPlayerGrowth
            : entry.prevOpponentGrowth;
        const myNext =
          entry.actor === "you"
            ? entry.nextPlayerGrowth
            : entry.nextOpponentGrowth;
        const oppPrev =
          entry.actor === "you"
            ? entry.prevOpponentGrowth
            : entry.prevPlayerGrowth;
        const oppNext =
          entry.actor === "you"
            ? entry.nextOpponentGrowth
            : entry.nextPlayerGrowth;

        const selfDelta = myNext - myPrev;
        const oppDelta = oppNext - oppPrev;
        const hasDetails = !!entry.details?.length;
        const accentColor = entry.actor === "you" ? "#00ff00" : "#ff6600";
        const bgColor =
          entry.actor === "you"
            ? "rgba(0,100,0,0.3)"
            : "rgba(120,30,0,0.3)";
        const badgeLabel =
          meta?.type === "growth"
            ? "GROWTH"
            : meta?.type === "hybrid"
              ? "HYBRID"
              : meta?.type === "attack"
                ? "ATTACK"
                : "MOVE";

        return (
          <div
            key={entry.id}
            style={{
              background: bgColor,
              border: `1px solid ${accentColor}`,
              borderRadius: "8px",
              padding: "8px 12px",
              display: "flex",
              flexDirection: "column",
              gap: "3px",
              animation: "slideInLog 0.3s ease-out",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
              }}
            >
              <span
                style={{
                  fontFamily: "Orbitron, sans-serif",
                  fontSize: "11px",
                  fontWeight: "bold",
                  color: accentColor,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {entry.actor === "you" ? "YOU" : opponentLabel}
              </span>
              <span
                style={{
                  fontFamily: "Orbitron, sans-serif",
                  fontSize: "10px",
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                {new Date(entry.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </div>
            <span
              style={{
                fontFamily: "Orbitron, sans-serif",
                fontSize: "12px",
                color: "#fff",
              }}
            >
              {label}
              {meta && (
                <span style={{ color: accentColor, marginLeft: "8px" }}>
                  {badgeLabel}
                </span>
              )}
            </span>
            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                marginTop: "2px",
              }}
            >
              {entry.details?.map((detail) => (
                <span
                  key={detail}
                  style={{
                    fontFamily: "Orbitron, sans-serif",
                    fontSize: "11px",
                    color: "#b7fff1",
                  }}
                >
                  {detail}
                </span>
              ))}
              {!hasDetails && selfDelta !== 0 && (
                <span
                  style={{
                    fontSize: "11px",
                    color: selfDelta > 0 ? "#00ff88" : "#ff4444",
                    fontFamily: "Orbitron, sans-serif",
                  }}
                >
                  {entry.actor === "you" ? "Your tree" : "Their tree"}:{" "}
                  {myPrev} -&gt; {myNext} ({formatDelta(myPrev, myNext)})
                </span>
              )}
              {!hasDetails && oppDelta !== 0 && (
                <span
                  style={{
                    fontSize: "11px",
                    color: oppDelta < 0 ? "#ff4444" : "#00ff88",
                    fontFamily: "Orbitron, sans-serif",
                  }}
                >
                  {entry.actor === "you" ? "Their tree" : "Your tree"}:{" "}
                  {oppPrev} -&gt; {oppNext} ({formatDelta(oppPrev, oppNext)})
                </span>
              )}
              {selfDelta === 0 && oppDelta === 0 && (
                <span
                  style={{
                    fontSize: "11px",
                    color: "rgba(255,255,255,0.5)",
                    fontFamily: "Orbitron, sans-serif",
                  }}
                >
                  Blocked or no visible growth change
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
