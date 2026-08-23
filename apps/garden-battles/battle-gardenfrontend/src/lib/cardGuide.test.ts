import test from "node:test";
import assert from "node:assert/strict";
import { CARD_GUIDE_CARDS, filterCardGuideCards } from "./cardGuide";

test("card guide exposes all 39 canonical cards", () => {
  assert.equal(CARD_GUIDE_CARDS.length, 39);
  assert.equal(CARD_GUIDE_CARDS[0].label, "Wedgebreaker");
  assert.equal(CARD_GUIDE_CARDS[38].label, "Arborist Ascension");
});

test("TREE Power filter contains the nine fifth-card candidates", () => {
  const cards = filterCardGuideCards({ filter: "tree-power" });
  assert.deepEqual(cards.map((card) => card.id), [31, 32, 33, 34, 35, 36, 37, 38, 39]);
});

test("search and current-hand filters compose", () => {
  const cards = filterCardGuideCards({
    query: "block",
    currentHand: [4, 8, 15, 35],
    currentHandOnly: true,
  });
  assert.deepEqual(cards.map((card) => card.id), [4, 8, 35]);
});
