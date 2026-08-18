import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatRecord,
  getEarnedBadgeDisplay,
  getEmptyModeMessage,
  getModeLabel,
  getPlayerRecordHeading,
  getPvpTargetMixItems,
  getRankProgress,
  isConnectedWallet,
  orderPodiumForDesktop,
  selectTopPlayers,
} from "./leaderboardPresentation";
import type { LeaderboardEntry } from "./api";

function entry(rank: number, overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    rank,
    address: `0x${rank.toString().padStart(64, "0")}`,
    wins: rank,
    losses: 0,
    win_rate: 1,
    current_streak: rank,
    rank_title: "Rooted Fighter",
    badges: [],
    total_battles: 3,
    mode: "pvp",
    last_played: null,
    recent_result: null,
    ranked: true,
    ...overrides,
  };
}

describe("leaderboard presentation helpers", () => {
  it("formatRecord returns W-L text", () => {
    assert.equal(formatRecord(2, 1), "2W-1L");
  });

  it("calculates unranked progress by recorded battles", () => {
    const progress = getRankProgress({
      wins: 0,
      total_battles: 2,
      rank_title: "Grove Recruit",
      ranked: false,
    });

    assert.equal(progress.currentTitle, "Grove Recruit");
    assert.equal(progress.nextTitle, "Rooted Fighter");
    assert.equal(progress.remaining, 1);
    assert.equal(progress.progressLabel, "1 more battle to become ranked");
  });

  it("calculates Rooted Fighter progress toward 10 wins", () => {
    const progress = getRankProgress({
      wins: 6,
      total_battles: 12,
      rank_title: "Rooted Fighter",
      ranked: true,
    });

    assert.equal(progress.nextTitle, "Thorn Challenger");
    assert.equal(progress.remaining, 4);
  });

  it("calculates Thorn Challenger progress toward 25 wins", () => {
    const progress = getRankProgress({
      wins: 20,
      total_battles: 28,
      rank_title: "Thorn Challenger",
      ranked: true,
    });

    assert.equal(progress.nextTitle, "Grove Striker");
    assert.equal(progress.remaining, 5);
  });

  it("calculates Grove Striker progress toward 50 wins", () => {
    const progress = getRankProgress({
      wins: 40,
      total_battles: 60,
      rank_title: "Grove Striker",
      ranked: true,
    });

    assert.equal(progress.nextTitle, "Canopy Champion");
    assert.equal(progress.remaining, 10);
  });

  it("calculates Canopy Champion progress toward 100 wins", () => {
    const progress = getRankProgress({
      wins: 75,
      total_battles: 100,
      rank_title: "Canopy Champion",
      ranked: true,
    });

    assert.equal(progress.nextTitle, "Elderroot Titan");
    assert.equal(progress.remaining, 25);
  });

  it("reports Elderroot Titan as maximum rank", () => {
    const progress = getRankProgress({
      wins: 100,
      total_battles: 120,
      rank_title: "Elderroot Titan",
      ranked: true,
    });

    assert.equal(progress.isMaximumRank, true);
    assert.equal(progress.progressLabel, "Maximum battle rank reached");
  });

  it("top-three ordering preserves API order before desktop presentation", () => {
    const top = selectTopPlayers([entry(1), entry(2), entry(3), entry(4)]);

    assert.deepEqual(top.map((item) => item.rank), [1, 2, 3]);
    assert.deepEqual(orderPodiumForDesktop(top).map((item) => item.rank), [2, 1, 3]);
  });

  it("fewer than three players render safely", () => {
    assert.deepEqual(orderPodiumForDesktop([entry(1), entry(2)]).map((item) => item.rank), [1, 2]);
  });

  it("identifies connected wallets case-insensitively", () => {
    assert.equal(isConnectedWallet("0xABC", "0xabc"), true);
  });

  it("only displays earned badges and exposes overflow", () => {
    assert.deepEqual(getEarnedBadgeDisplay(["first_blood", "hot_streak", "veteran", "legend"]), {
      visible: ["first_blood", "hot_streak", "veteran"],
      overflow: 1,
    });
  });

  it("mode labels and headings are mode-specific", () => {
    assert.equal(getModeLabel("pvp"), "PvP Battle");
    assert.equal(getModeLabel("bot"), "Garden Bot");
    assert.equal(getModeLabel("overall"), "Overall");
    assert.equal(getPlayerRecordHeading("pvp"), "Your PvP Record");
    assert.equal(getPlayerRecordHeading("bot"), "Your Garden Bot Record");
    assert.equal(getPlayerRecordHeading("overall"), "Your Overall Record");
  });

  it("empty states point at the selected mode", () => {
    assert.match(getEmptyModeMessage("pvp"), /PvP/);
    assert.match(getEmptyModeMessage("bot"), /Garden Bot/);
  });

  it("pvp target mix only includes played match lengths", () => {
    assert.deepEqual(
      getPvpTargetMixItems({
        quick_50: 2,
        standard_75: 1,
        legacy_100: 0,
      }),
      [
        { label: "Quick 50", value: 2 },
        { label: "Standard 75", value: 1 },
      ],
    );
    assert.deepEqual(getPvpTargetMixItems(null), []);
  });
});
