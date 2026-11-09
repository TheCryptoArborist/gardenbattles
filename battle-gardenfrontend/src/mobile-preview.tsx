/**
 * Developer-only, wallet-free layout fixture served by Vite dev server at
 * /mobile-preview.html. Not included in the production single-page build.
 */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import GardenBotMobileBattle from "@/components/GardenBotMobileBattle";
import type { ActionEntry } from "@/components/BattleLog";

function Fixture() {
  const [playerGrowth, setPlayerGrowth] = useState(32);
  const [botGrowth, setBotGrowth] = useState(21);
  const [log, setLog] = useState<ActionEntry[]>([
    {
      id: "fixture-1",
      timestamp: Date.now(),
      actor: "opponent",
      moveId: 11,
      prevPlayerGrowth: 37,
      nextPlayerGrowth: 32,
      prevOpponentGrowth: 21,
      nextOpponentGrowth: 21,
      details: ["Garden Bot used Wither Touch", "You lost 5 Growth"],
    },
  ]);

  const onMove = (moveId: number) => {
    const before = playerGrowth;
    const next = Math.min(50, playerGrowth + (moveId >= 20 ? 8 : 0));
    const botNext = Math.max(0, botGrowth - (moveId < 20 ? 5 : 0));
    setPlayerGrowth(next);
    setBotGrowth(botNext);
    setLog((previous) => [
      ...previous,
      {
        id: "fixture-" + (previous.length + 1),
        timestamp: Date.now(),
        actor: "you",
        moveId,
        prevPlayerGrowth: before,
        nextPlayerGrowth: next,
        prevOpponentGrowth: botGrowth,
        nextOpponentGrowth: botNext,
        details: ["Local UI fixture: move effect simulated, no wallet used"],
      },
    ]);
  };

  return (
    <div className="garden-bot-active" style={{ margin: 0 }}>
      <GardenBotMobileBattle
        playerGrowth={playerGrowth}
        botGrowth={botGrowth}
        growthTarget={50}
        playerImage="/assets/sapling2.jpg"
        botImage="/assets/sapling.jpg"
        playerMoves={[25, 26, 9, 11]}
        actionLog={log}
        pendingMoveId={null}
        isMyTurn
        inlineError={null}
        handNeedsReroll={false}
        attacksAreStalled={false}
        isForfeiting={false}
        isStartingBot={false}
        onMove={onMove}
        onForfeit={() => {}}
        onNewHand={() => {
          setPlayerGrowth(0);
          setBotGrowth(0);
          setLog([]);
        }}
        onDismissError={() => {}}
      />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
