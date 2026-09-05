import assert from "node:assert/strict";
import test from "node:test";
import { formatGardenBotStartFailureMessage } from "./battleStartErrors";

test("Garden Bot start failures preserve actionable wallet details", () => {
  assert.match(formatGardenBotStartFailureMessage("MoveAbort at battle::create"), /MoveAbort/);
  assert.match(formatGardenBotStartFailureMessage("Load failed"), /Sui network/);
  assert.match(formatGardenBotStartFailureMessage("Insufficient gas balance"), /more SUI/);
  assert.equal(formatGardenBotStartFailureMessage("User rejected the request"), "Start cancelled in wallet.");
});
