import assert from "node:assert/strict";
import test from "node:test";
import { dailyTrialWinStreak } from "./trial-streak";
const win = (date: string) => ({ challenge_date: date, won: 1 });
test("saved wins yesterday remain active before today's run", () => {
  assert.equal(dailyTrialWinStreak([win("2026-09-01"), win("2026-08-31")], "2026-09-02"), 2);
});
test("today's saved win extends the streak", () => {
  assert.equal(dailyTrialWinStreak([win("2026-09-02"), win("2026-09-01")], "2026-09-02"), 2);
});
test("a lost official trial or missed day breaks the streak", () => {
  assert.equal(dailyTrialWinStreak([{ challenge_date: "2026-09-02", won: 0 }, win("2026-09-01")], "2026-09-02"), 0);
  assert.equal(dailyTrialWinStreak([win("2026-08-31")], "2026-09-02"), 0);
  assert.equal(dailyTrialWinStreak([win("2026-09-02"), win("2026-08-31")], "2026-09-02"), 1);
  assert.equal(dailyTrialWinStreak([], "2026-09-02"), 0);
});
