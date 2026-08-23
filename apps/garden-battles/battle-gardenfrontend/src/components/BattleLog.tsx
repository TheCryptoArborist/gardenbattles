import React, { useEffect, useMemo, useRef, useState } from "react";
import { MOVE_LABELS } from "@/lib/sui-config";
import { getMoveIconUrl } from "./MoveCardFace";

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

function isRoundResultEntry(entry: ActionEntry) {
  return (
    entry.actor === "round" ||
    (entry.moveId === 0 && entry.label === "Round Result") ||
    !!entry.details?.some((detail) =>
      detail.toLowerCase().startsWith("round result:"),
    )
  );
}

function resultSummary(entry: ActionEntry, opponentLabel: string): string {
  if (isRoundResultEntry(entry)) {
    return `You ${entry.nextPlayerGrowth} · ${opponentLabel} ${entry.nextOpponentGrowth}`;
  }

  const parts: string[] = [];
  const playerDelta = entry.nextPlayerGrowth - entry.prevPlayerGrowth;
  const opponentDelta = entry.nextOpponentGrowth - entry.prevOpponentGrowth;
  if (playerDelta !== 0) parts.push(`You ${formatDelta(entry.prevPlayerGrowth, entry.nextPlayerGrowth)} Growth`);
  if (opponentDelta !== 0) parts.push(`${opponentLabel} ${formatDelta(entry.prevOpponentGrowth, entry.nextOpponentGrowth)} Growth`);
  return parts.length > 0 ? parts.join(" · ") : "Blocked or no Growth change";
}

export default function BattleLog({
  entries,
  isPlayer1,
  opponentLabel = "Opponent",
}: BattleLogProps) {
  const logRef = useRef<HTMLDivElement>(null);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(() => new Set());

  const visibleEntries = useMemo(
    () => entries.filter((entry) => {
      const isRoundEntry = isRoundResultEntry(entry);
      return !(entry.actor === "you" && entry.moveId === 0 && !entry.label && !isRoundEntry);
    }),
    [entries],
  );

  useEffect(() => {
    const log = logRef.current;
    if (log) {
      log.scrollTop = log.scrollHeight;
    }
  }, [visibleEntries.length]);

  if (visibleEntries.length === 0) {
    return (
      <div className="gb-battle-log-empty">
        Battle log will appear here once moves are played...
      </div>
    );
  }

  return (
    <div ref={logRef} className="gb-battle-log">
      {visibleEntries.map((entry) => {
        const hasDetails = !!entry.details?.length;
        const isRoundEntry = isRoundResultEntry(entry);
        const isExpanded = expandedEntries.has(entry.id);

        const label =
          isRoundEntry
            ? "Round Result"
            : entry.label && entry.label !== "Round Result"
              ? entry.label
                : MOVE_LABELS[entry.moveId] ||
                (entry.actor === "you"
                  ? "Your move"
                  : `${opponentLabel} move resolved`);

        const actorLabel =
          isRoundEntry
            ? "ROUND RESULT"
            : entry.actor === "you"
              ? "YOU"
              : opponentLabel.toUpperCase();

        const entryClass =
          isRoundEntry
            ? "gb-battle-log-entry-round"
            : entry.actor === "you"
              ? "gb-battle-log-entry-you"
              : "gb-battle-log-entry-opponent";

        const iconUrl = !isRoundEntry && entry.moveId > 0 ? getMoveIconUrl(entry.moveId) : null;
        const summary = resultSummary(entry, opponentLabel);

        return (
          <article key={entry.id} className={`gb-battle-log-entry ${entryClass}`}>
            <button
              type="button"
              className="gb-battle-log-summary"
              aria-expanded={isExpanded}
              onClick={() => setExpandedEntries((current) => {
                const next = new Set(current);
                if (next.has(entry.id)) next.delete(entry.id);
                else next.add(entry.id);
                return next;
              })}
            >
              {iconUrl ? <img src={iconUrl} alt="" loading="lazy" decoding="async" /> : <span className="gb-battle-log-round-icon">↻</span>}
              <span className="gb-battle-log-summary-copy">
                <span className="gb-battle-log-header">
                  <span className="gb-battle-log-actor">{actorLabel}</span>
                  <span className="gb-battle-log-time">
                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </span>
                </span>
                <span className="gb-battle-log-move-name">{label}</span>
                <span className="gb-battle-log-result">{summary}</span>
              </span>
              <span className="gb-battle-log-chevron" aria-hidden="true">⌄</span>
            </button>

            {isExpanded && hasDetails && (
              <div className="gb-battle-log-body">
                {entry.details!.map((detail, index) => (
                  <p key={`${detail}-${index}`} className="gb-battle-log-detail">{detail}</p>
                ))}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
