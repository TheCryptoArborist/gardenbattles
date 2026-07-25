import { runTreePowerDiagnostic } from "./tree-power-diagnostics";

runTreePowerDiagnostic("moonbags-tree-stake").catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
