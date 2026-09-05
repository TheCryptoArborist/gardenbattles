import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import TrialLeaderboard from "./TrialLeaderboard";
import TrialAchievements from "./TrialAchievements";
import type { ArboristTrialTodayResponse } from "../lib/api";
import { getArboristTrialChallenge } from "../../../shared/arborist-trials";

const wallet = `0x${"1".repeat(64)}`;
const own = { wallet, rank: 32, score: 2400, won: true, rounds: 12, playerGrowth: 50, botGrowth: 20, uniqueMoves: 3, completedAt: 1 };
const today: ArboristTrialTodayResponse = {
  challenge: getArboristTrialChallenge(new Date("2026-09-02T12:00:00Z")),
  nftreeAccess: "eligible", fifthMoveAccess: "qualified", fifthMoveUnlocked: true,
  rankedAttemptUsed: true, result: own, streak: 1,
  checkInStreak: 1, totalCheckIns: 1, checkIns: [], achievements: [], leaderboardTotal: 32,
  leaderboard: [{ ...own, wallet: `0x${"2".repeat(64)}`, rank: 1 }],
};
const board = (data = today, address: string | null = wallet) => renderToStaticMarkup(React.createElement(TrialLeaderboard, {
  today: data, address, names: { [`0x${"2".repeat(64)}`]: "gardener.sui" }, refreshing: false, onRefresh: () => {},
}));

test("leaderboard shows own rank outside the leaders, SuiNS names, scores and rounds", () => {
  const html = board();
  assert.match(html, /#32 of 32/);
  assert.match(html, /gardener\.sui/);
  assert.match(html, /2,400 points · 12 rounds/);
  assert.match(html, /gb-trials-leader-rounds/);
  assert.match(html, /Separate from Garden Bot and PvP/);
});
test("disconnected or switched wallets never inherit another wallet's rank", () => {
  assert.doesNotMatch(board(today, null), /#32 of 32/);
  assert.match(board(today, `0x${"3".repeat(64)}`), /Not ranked yet/);
});
test("empty board explains saved official runs without inventing a rank", () => {
  const html = board({ ...today, result: null, rankedAttemptUsed: false, leaderboard: [], leaderboardTotal: 0 });
  assert.match(html, /No saved results yet/);
  assert.match(html, /Practice does not count/);
});
test("achievement progress and 30 total days are distinct from the winning streak", () => {
  const html = renderToStaticMarkup(React.createElement(TrialAchievements, {
    connected: true, achievements: [
      { id: "thirty_checkins", earned: false, progress: 29, target: 30 },
      { id: "master_arborist", earned: false, progress: 2, target: 30 },
    ],
  }));
  assert.match(html, /Next milestone: <strong>Seasoned Arborist/);
  assert.match(html, /Gaps are welcome/);
  assert.match(html, /30-day winning streak/);
  assert.match(html, /value="29" max="30"/);
});
