import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildBattleResultShareText,
  buildSmsShareUrl,
  getBattleResultShareOptions,
} from "./battleResultShare";

describe("battle result sharing", () => {
  it("offers three score-aware winner messages", () => {
    const options = getBattleResultShareOptions({
      outcome: "win",
      playerGrowth: 50,
      opponentGrowth: 32,
      targetGrowth: 50,
    });

    assert.equal(options.length, 3);
    assert.deepEqual(
      options.map((option) => option.title),
      ["Victory", "Challenge", "Leaderboard"],
    );
    assert.ok(options.every((option) => option.message.includes("50-32")));
  });

  it("offers three playful defeat messages", () => {
    const options = getBattleResultShareOptions({
      outcome: "loss",
      playerGrowth: 32,
      opponentGrowth: 50,
      targetGrowth: 50,
    });

    assert.equal(options.length, 3);
    assert.deepEqual(
      options.map((option) => option.title),
      ["Got Pruned", "Composted", "Revenge Loading"],
    );
    assert.match(options[0].message, /professionally pruned/);
  });

  it("adds the battle URL once and builds mobile SMS links", () => {
    const text = buildBattleResultShareText(
      "My NFTree survived the arena.",
      "https://nftree.net/battle",
    );

    assert.equal(
      text,
      "My NFTree survived the arena.\nhttps://nftree.net/battle",
    );
    assert.match(buildSmsShareUrl(text, false), /^sms:\?body=/);
    assert.match(buildSmsShareUrl(text, true), /^sms:&body=/);
  });
});
