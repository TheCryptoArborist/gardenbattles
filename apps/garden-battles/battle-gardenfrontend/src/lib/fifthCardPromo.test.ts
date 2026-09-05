import assert from "node:assert/strict";
import test from "node:test";
import { getFifthCardPromoPresentation } from "./fifthCardPromo";

test("qualified wallets receive a battle-ready fifth-card message", () => {
  const promo = getFifthCardPromoPresentation("qualified");
  assert.equal(promo.tone, "qualified");
  assert.equal(promo.title, "Fifth Battle Card Unlocked");
  assert.equal(promo.action, "View Your Benefits");
  assert.equal(promo.badge, "check");
});

test("not-qualified wallets receive a direct fifth-card unlock action", () => {
  const promo = getFifthCardPromoPresentation("not-qualified");
  assert.equal(promo.tone, "not-qualified");
  assert.equal(promo.action, "Unlock Fifth Card");
});

test("disconnected wallets are asked to connect for a read-only check", () => {
  const promo = getFifthCardPromoPresentation("not-connected");
  assert.equal(promo.tone, "disconnected");
  assert.match(promo.title, /Connect/);
});

test("checking and unavailable states never imply a locked card", () => {
  const checking = getFifthCardPromoPresentation("checking");
  const unavailable = getFifthCardPromoPresentation("unavailable");
  const incomplete = getFifthCardPromoPresentation("verification-incomplete");

  assert.equal(checking.badge, "checking");
  assert.doesNotMatch(checking.title, /locked/i);
  assert.equal(unavailable.badge, "alert");
  assert.doesNotMatch(unavailable.title, /locked/i);
  assert.equal(incomplete.badge, "alert");
  assert.doesNotMatch(incomplete.title, /locked/i);
});
