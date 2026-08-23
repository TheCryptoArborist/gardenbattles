import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BattleLog, { type ActionEntry } from "./BattleLog";

function entry(overrides: Partial<ActionEntry> = {}): ActionEntry {
  return {
    id: "entry-1",
    timestamp: 0,
    actor: "opponent",
    moveId: 0,
    prevPlayerGrowth: 20,
    nextPlayerGrowth: 12,
    prevOpponentGrowth: 30,
    nextOpponentGrowth: 34,
    details: ["Opponent gained +4 growth.", "Your growth was reduced by 8."],
    ...overrides,
  };
}

describe("BattleLog PvP opponent labels", () => {
  it("displays exact opponent move names from MOVE_LABELS", () => {
    const html = renderToStaticMarkup(
      <BattleLog entries={[entry({ moveId: 29 })]} isPlayer1 />,
    );

    assert.match(html, /Gale Guard/);
    assert.doesNotMatch(html, /Opponent move unavailable/);
  });

  it("uses truthful unresolved fallback wording", () => {
    const html = renderToStaticMarkup(
      <BattleLog
        entries={[entry({ label: "Opponent move resolved" })]}
        isPlayer1
      />,
    );

    assert.match(html, /Opponent move resolved/);
    assert.match(html, /Opponent gained \+4 growth/);
    assert.match(html, /Your growth was reduced by 8/);
    assert.doesNotMatch(html, /Opponent move unavailable/);
  });

  it("describes no visible growth without inventing a move", () => {
    const html = renderToStaticMarkup(
      <BattleLog
        entries={[
          entry({
            prevPlayerGrowth: 20,
            nextPlayerGrowth: 20,
            prevOpponentGrowth: 30,
            nextOpponentGrowth: 30,
            label: "Opponent move resolved",
            details: [
              "No visible growth changed. The move may have been blocked, missed, or applied a status effect.",
            ],
          }),
        ]}
        isPlayer1
      />,
    );

    assert.match(html, /Opponent move resolved/);
    assert.match(html, /blocked, missed, or applied a status effect/);
    assert.doesNotMatch(html, /Cloud Cover|Life Absorb|Shadow Canopy/);
  });
});
