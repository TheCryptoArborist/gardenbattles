import { useEffect, useRef } from "react";
import { MOVE_LABELS } from "@/lib/sui-config";

export interface ActionEntry {
  id: string;
  timestamp: number;
  actor: "you" | "opponent" | "round";
  moveId: number;
  prevPlayerGrowth: number;
  nextPlayerGrowth: number;
  prevOpponentGrowth: number;
  nextOpponentGrowth: number;
  label?: string;
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

function getDetailLabel(entry: ActionEntry, detail: string, index: number) {
  const normalized = detail.toLowerCase();
  if (entry.actor === "round") {
    if (normalized.includes("->") || normalized.includes("/")) return "SCORE";
    return "RESULT";
  }

  if (index === 0) return "EFFECT";
  if (
    normalized.includes("gained") ||
    normalized.includes("lost") ||
    normalized.includes("reduced") ||
    normalized.includes("growth") ||
    normalized.includes("no visible")
  ) {
    return "SCORE CHANGE";
  }

  return "EFFECT";
}

export default function BattleLog({
  entries,
  isPlayer1,
  opponentLabel = "Opponent",
}: BattleLogProps) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const log = logRef.current;
    if (log) {
      log.scrollTop = log.scrollHeight;
    }
  }, [entries.length]);

  if (entries.length === 0) {
    return (
      <div className="gb-battle-log-empty">
        Battle log will appear here once moves are played...
      </div>
    );
  }

  return (
    <div ref={logRef} className="gb-battle-log">
      {entries.map((entry) => {
        const hasDetails = !!entry.details?.length;
        const label =
          entry.label ??
          (entry.actor === "round"
            ? "Round Result"
            : hasDetails && entry.moveId === 0
              ? "Round Result"
              : MOVE_LABELS[entry.moveId] ||
                (entry.actor === "you" ? "Your move" : `${opponentLabel} move`));

        const actorLabel =
          entry.actor === "round"
            ? "ROUND RESULT"
            : entry.actor === "you"
              ? "YOU"
              : opponentLabel.toUpperCase();

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

        const entryClass =
          entry.actor === "round"
            ? "gb-battle-log-entry-round"
            : entry.actor === "you"
              ? "gb-battle-log-entry-you"
              : "gb-battle-log-entry-opponent";

        return (
          <div key={entry.id} className={`gb-battle-log-entry ${entryClass}`}>
            <div className="gb-battle-log-header">
              <span className="gb-battle-log-actor">
                {actorLabel}
              </span>
              <span className="gb-battle-log-time">
                {new Date(entry.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </div>

            <div className="gb-battle-log-row gb-battle-log-row-move">
              <span className="gb-battle-log-kicker">MOVE</span>
              <span className="gb-battle-log-move-name">{label}</span>
            </div>

            <div className="gb-battle-log-body">
              {hasDetails ? (
                entry.details!.map((detail, index) => (
                  <div key={`${detail}-${index}`} className="gb-battle-log-row">
                    <span className="gb-battle-log-kicker">
                      {getDetailLabel(entry, detail, index)}
                    </span>
                    <span className="gb-battle-log-detail">{detail}</span>
                  </div>
                ))
              ) : (
                <div className="gb-battle-log-score-grid">
                  {selfDelta !== 0 && (
                    <span
                      className={`gb-battle-log-score ${
                        selfDelta > 0 ? "gb-battle-log-score-positive" : "gb-battle-log-score-negative"
                      }`}
                    >
                      {entry.actor === "you" ? "Your tree" : "Their tree"}:{" "}
                      {myPrev} {"->"} {myNext} ({formatDelta(myPrev, myNext)})
                    </span>
                  )}
                  {oppDelta !== 0 && (
                    <span
                      className={`gb-battle-log-score ${
                        oppDelta < 0 ? "gb-battle-log-score-negative" : "gb-battle-log-score-positive"
                      }`}
                    >
                      {entry.actor === "you" ? "Their tree" : "Your tree"}:{" "}
                      {oppPrev} {"->"} {oppNext} ({formatDelta(oppPrev, oppNext)})
                    </span>
                  )}
                  {selfDelta === 0 && oppDelta === 0 && (
                    <span className="gb-battle-log-score gb-battle-log-score-muted">
                      (Blocked or no effect)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
