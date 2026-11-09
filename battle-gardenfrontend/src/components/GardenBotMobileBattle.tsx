import { useState } from "react";
import { MOVE_LABELS, MOVE_META } from "@/lib/sui-config";
import BattleLog, { type ActionEntry } from "@/components/BattleLog";
import "./GardenBotMobileBattle.css";

interface GardenBotMobileBattleProps {
  playerGrowth: number;
  botGrowth: number;
  growthTarget: number;
  playerImage: string;
  botImage: string;
  playerMoves: number[];
  actionLog: ActionEntry[];
  pendingMoveId: number | null;
  isMyTurn: boolean;
  inlineError: string | null;
  handNeedsReroll: boolean;
  attacksAreStalled: boolean;
  isForfeiting: boolean;
  isStartingBot: boolean;
  onMove: (moveId: number) => void;
  onForfeit: () => void;
  onNewHand: () => void;
  onDismissError: () => void;
}

function progress(value: number, target: number) {
  return String(Math.max(0, Math.min(100, (value / Math.max(1, target)) * 100))) + "%";
}

/**
 * Garden Bot's portrait-only active-match surface. A separate component keeps
 * desktop and PvP untouched and reuses the existing wallet/contract handlers.
 */
export default function GardenBotMobileBattle({
  playerGrowth,
  botGrowth,
  growthTarget,
  playerImage,
  botImage,
  playerMoves,
  actionLog,
  pendingMoveId,
  isMyTurn,
  inlineError,
  handNeedsReroll,
  attacksAreStalled,
  isForfeiting,
  isStartingBot,
  onMove,
  onForfeit,
  onNewHand,
  onDismissError,
}: GardenBotMobileBattleProps) {
  const [showMovesHelp, setShowMovesHelp] = useState(false);
  const lastAction = actionLog.length ? actionLog[actionLog.length - 1] : null;
  const playerDelta = lastAction ? lastAction.nextPlayerGrowth - lastAction.prevPlayerGrowth : 0;
  const botDelta = lastAction ? lastAction.nextOpponentGrowth - lastAction.prevOpponentGrowth : 0;
  const lastActionText = lastAction?.details?.length
    ? lastAction.details.join(" · ")
    : lastAction
      ? (lastAction.actor === "you" ? "Your move" : "Garden Bot response") +
        ": You " + (playerDelta >= 0 ? "+" : "") + playerDelta +
        " / Bot " + (botDelta >= 0 ? "+" : "") + botDelta
      : "Choose a card to play your first move.";
  const statusText = pendingMoveId !== null
    ? "Confirm " + (MOVE_LABELS[pendingMoveId] || "move") + " in your wallet"
    : isMyTurn
      ? "Your turn — choose a move"
      : "Waiting for the round to update";

  return (
    <section className="gbm-stage" aria-label="Garden Bot mobile battle" data-testid="garden-bot-mobile-stage">
      <header className="gbm-toolbar">
        <span className="gbm-mode">🌳 GARDEN BOT <small>Practice match</small></span>
        <details className="gbm-menu">
          <summary aria-label="Open game menu">Menu</summary>
          <div className="gbm-menu-content">
            <a href="https://tree-token.xyz/play/">Tree Arcade</a>
            <a href="https://nftree.net/battle/leaderboard">Leaderboard</a>
            <button type="button" onClick={() => setShowMovesHelp(!showMovesHelp)}>
              {showMovesHelp ? "Hide rules" : "Quick rules"}
            </button>
          </div>
        </details>
      </header>

      {showMovesHelp && (
        <p className="gbm-help">First to {growthTarget} Growth wins. Growth cards raise your tree; attack cards reduce Garden Bot Growth. Each move requires a wallet confirmation.</p>
      )}

      <div className="gbm-arena">
        <article className="gbm-fighter gbm-player" aria-label={"You: " + playerGrowth + " of " + growthTarget + " Growth"}>
          <div className="gbm-fighter-heading"><span>YOU</span><strong>{playerGrowth}/{growthTarget}</strong></div>
          <div className="gbm-image-box"><img src={playerImage} alt="Your growing tree" /></div>
          <div className="gbm-progress"><div style={{ width: progress(playerGrowth, growthTarget) }} /></div>
        </article>
        <span className="gbm-versus" aria-hidden="true">VS</span>
        <article className="gbm-fighter gbm-bot" aria-label={"Garden Bot: " + botGrowth + " of " + growthTarget + " Growth"}>
          <div className="gbm-fighter-heading"><span>BOT</span><strong>{botGrowth}/{growthTarget}</strong></div>
          <div className="gbm-image-box"><img src={botImage} alt="Garden Bot growing tree" /></div>
          <div className="gbm-progress"><div style={{ width: progress(botGrowth, growthTarget) }} /></div>
        </article>
      </div>

      <div className="gbm-status" role="status" aria-live="polite">
        <strong>{statusText}</strong>
        <span>{lastActionText}</span>
      </div>

      {inlineError && (
        <div className="gbm-error" role="alert">
          <span>{inlineError}</span>
          <button type="button" aria-label="Dismiss error" onClick={onDismissError}>×</button>
        </div>
      )}

      {(handNeedsReroll || attacksAreStalled) && (
        <div className="gbm-warning" role="status">
          {handNeedsReroll
            ? "Low-growth hand: use New Bot Hand if needed."
            : "Bot is at zero Growth: attack cards cannot lower it further."}
        </div>
      )}

      <div className="gbm-hand-head"><strong>PLAY A CARD</strong><span>{playerMoves.length} available</span></div>
      <div className="gbm-hand" role="group" aria-label="Choose a Garden Bot move">
        {playerMoves.length === 0 && (
          <div className="gbm-loading" role="status">Loading move cards from Sui…</div>
        )}
        {playerMoves.map((moveId) => {
          const meta = MOVE_META[moveId];
          const category = meta?.type || "attack";
          const pending = pendingMoveId === moveId;
          const disabled = !isMyTurn || pendingMoveId !== null;
          return (
            <button
              type="button"
              key={moveId}
              className={"gbm-move gbm-" + category}
              disabled={disabled}
              aria-label={(MOVE_LABELS[moveId] || "Move " + moveId) + (meta?.effect ? ": " + meta.effect : "")}
              onClick={() => onMove(moveId)}
              data-testid={"mobile-button-ability-" + moveId}
            >
              <span className="gbm-move-category">{meta?.emoji} {category.toUpperCase()}</span>
              <strong>{pending ? "⏳ " : ""}{MOVE_LABELS[moveId] || "Move " + moveId}</strong>
              {meta?.effect && <span className="gbm-move-effect">{meta.effect}</span>}
            </button>
          );
        })}
      </div>

      <div className="gbm-actions">
        <button type="button" onClick={onForfeit} disabled={isForfeiting || pendingMoveId !== null}>
          {isForfeiting ? "Forfeiting…" : "Forfeit"}
        </button>
        <button type="button" className="gbm-new-hand" onClick={onNewHand} disabled={isStartingBot || pendingMoveId !== null}>
          {isStartingBot ? "Starting…" : "New Bot Hand"}
        </button>
      </div>

      <details className="gbm-history">
        <summary>Battle history <span>{actionLog.length} events</span></summary>
        <BattleLog entries={actionLog} isPlayer1={true} opponentLabel="Garden Bot" />
      </details>
    </section>
  );
}
