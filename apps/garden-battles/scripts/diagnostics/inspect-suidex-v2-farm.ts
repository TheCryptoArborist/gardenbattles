import { runTreePowerDiagnostic } from "./tree-power-diagnostics";

runTreePowerDiagnostic("suidex-v2-farm").catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
