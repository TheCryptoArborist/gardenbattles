import { readFile } from "node:fs/promises";
import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { getCachedFifthMoveEligibility } from "../../server/tree-power-eligibility";
import { displayTreeToRaw } from "../../shared/tree-power-eligibility";

type CensusOptions = {
  walletFile?: string;
  rpcUrl: string;
};

function parseArgs(argv: string[]): CensusOptions {
  const options: CensusOptions = {
    rpcUrl: process.env.SUI_RPC_URL || getFullnodeUrl("mainnet"),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--wallet-file") {
      options.walletFile = next;
      index += 1;
    } else if (arg === "--rpc-url") {
      options.rpcUrl = next;
      index += 1;
    }
  }

  return options;
}

function percentile(values: bigint[], ratio: number): bigint {
  if (values.length === 0) return BigInt(0);
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio));
  return sorted[index];
}

async function readWallets(path?: string): Promise<string[]> {
  if (!path) {
    throw new Error("Provide --wallet-file with one NFTree owner wallet address per line.");
  }
  const text = await readFile(path, "utf8");
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const walletPattern = /^0x[0-9a-fA-F]{64}$/;
  return lines
    .filter((line) => !line.startsWith("#"))
    .map((line) => line.split(",")[0]?.trim() ?? "")
    .filter((wallet) => walletPattern.test(wallet))
    .map((wallet) => wallet.toLowerCase());
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const wallets = await readWallets(options.walletFile);
  const client = new SuiClient({ url: options.rpcUrl });
  const thresholds = ["500000", "1000000", "2500000", "5000000"].map((value) => ({
    label: value,
    raw: displayTreeToRaw(value),
  }));
  const report = {
    totalNftreeWalletsChecked: wallets.length,
    qualifiedAt1000000Tree: 0,
    notQualifiedAllSourcesVerified: 0,
    verificationIncomplete: 0,
    unavailable: 0,
    qualificationBySource: {
      "suidex-v2": 0,
      "suidex-v3": 0,
      "moonbags-staking": 0,
    },
    qualificationThroughCombinedSources: 0,
    medianVerifiedUnderlyingTreeRaw: "0",
    distribution: Object.fromEntries(thresholds.map((threshold) => [threshold.label, 0])),
  };
  const totals: bigint[] = [];

  for (const wallet of wallets) {
    const eligibility = await getCachedFifthMoveEligibility(client, wallet);
    const total = BigInt(eligibility.verifiedUnderlyingTreeRaw);
    totals.push(total);

    if (eligibility.status === "qualified") report.qualifiedAt1000000Tree += 1;
    if (eligibility.status === "not-qualified") report.notQualifiedAllSourcesVerified += 1;
    if (eligibility.status === "verification-incomplete") report.verificationIncomplete += 1;
    if (eligibility.status === "unavailable") report.unavailable += 1;

    const qualifyingSources = eligibility.sources.filter((source) => BigInt(source.underlyingTreeRaw ?? "0") > BigInt(0));
    for (const source of qualifyingSources) {
      report.qualificationBySource[source.source] += 1;
    }
    if (qualifyingSources.length > 1) report.qualificationThroughCombinedSources += 1;
    for (const threshold of thresholds) {
      if (total >= threshold.raw) report.distribution[threshold.label] += 1;
    }
  }

  report.medianVerifiedUnderlyingTreeRaw = percentile(totals, 0.5).toString();
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
