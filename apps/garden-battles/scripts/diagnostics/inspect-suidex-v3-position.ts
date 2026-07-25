import { runTreePowerDiagnostic } from "./tree-power-diagnostics";

runTreePowerDiagnostic("suidex-v3-position").catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
