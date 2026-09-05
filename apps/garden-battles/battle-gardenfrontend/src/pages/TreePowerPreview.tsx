import TreePowerPanel from "@/components/TreePowerPanel";
import {
  getTreeRerollPresentation,
  type TreeRerollStatus,
} from "@/lib/treePowerPresentation";
import type { FifthMoveEligibilityResponse, FifthMoveSource, FifthMoveSourceResult } from "@/lib/api";
import type { FifthMoveEligibility } from "@/lib/suiDexTreePosition";
import { makeTreeBalanceView, type TreeBalanceView } from "@/lib/treeBalance";

const MOCK_WALLET = "0x1111111111111111111111111111111111111111111111111111111111111111";

const DISCONNECTED_BALANCE: TreeBalanceView = {
  status: "disconnected",
  label: "Connect wallet",
  exactLabel: null,
  amount: null,
};

const LOADING_BALANCE: TreeBalanceView = {
  status: "loading",
  label: "Loading",
  exactLabel: null,
  amount: null,
};

const UNAVAILABLE_BALANCE: TreeBalanceView = {
  status: "unavailable",
  label: "Unavailable",
  exactLabel: null,
  amount: null,
};

const ELIGIBILITY = {
  notConnected: { status: "not-connected", sources: [] },
  checking: { status: "checking", sources: [] },
  notQualified: { status: "not-qualified", sources: [] },
  v2: { status: "qualified", sources: ["suidex-v2"] },
  v3: { status: "qualified", sources: ["suidex-v3"] },
  treeLock: { status: "qualified", sources: ["tree-lock"] },
  v2TreeLock: { status: "qualified", sources: ["suidex-v2", "tree-lock"] },
  v3TreeLock: { status: "qualified", sources: ["suidex-v3", "tree-lock"] },
  all: { status: "qualified", sources: ["suidex-v2", "suidex-v3", "tree-lock"] },
  unavailable: { status: "unavailable", sources: [] },
} satisfies Record<string, FifthMoveEligibility>;

function source(
  sourceName: FifthMoveSource,
  status: FifthMoveSourceResult["status"],
  tree = "0",
): FifthMoveSourceResult {
  return {
    source: sourceName,
    status,
    underlyingTreeDisplay: status === "unavailable" ? undefined : tree,
    underlyingTreeRaw: status === "unavailable" ? undefined : `${BigInt(tree) * BigInt(1_000_000)}`,
    reason: status === "unavailable" ? "Provider verification unavailable in this mock scenario." : undefined,
  };
}

function eligibilityResponse(options: {
  status: FifthMoveEligibilityResponse["status"];
  verifiedTree: string;
  remainingTree?: string;
  sources: FifthMoveSourceResult[];
}): FifthMoveEligibilityResponse {
  return {
    wallet: MOCK_WALLET,
    status: options.status,
    thresholdTree: "1000000",
    thresholdRaw: "1000000000000",
    verifiedUnderlyingTree: options.verifiedTree,
    verifiedUnderlyingTreeRaw: `${BigInt(options.verifiedTree) * BigInt(1_000_000)}`,
    remainingTree: options.remainingTree,
    remainingTreeRaw:
      options.remainingTree === undefined ? undefined : `${BigInt(options.remainingTree) * BigInt(1_000_000)}`,
    sources: options.sources,
  };
}

export const TREE_POWER_PREVIEW_SCENARIOS = [
  {
    title: "Wallet disconnected",
    note: "No TREE balance, no active battle, connect wallet to verify SuiDex position.",
    props: {
      address: null,
      treeBalance: DISCONNECTED_BALANCE,
      fifthMoveEligibility: ELIGIBILITY.notConnected,
      isBattleActive: false,
      currentMoveCount: 0,
      rerollStatus: "unavailable" as TreeRerollStatus,
    },
  },
  {
    title: "Position verification loading",
    note: "Connected mock wallet while SuiDex and TREE Lock position checks are pending.",
    props: {
      address: MOCK_WALLET,
      treeBalance: LOADING_BALANCE,
      fifthMoveEligibility: ELIGIBILITY.checking,
      isBattleActive: true,
      currentMoveCount: 4,
      rerollStatus: "not-live" as TreeRerollStatus,
    },
  },
  {
    title: "0 TREE verified",
    note: "All providers verified with no qualifying underlying TREE.",
    props: {
      address: MOCK_WALLET,
      treeBalance: makeTreeBalanceView(128),
      fifthMoveEligibilityResponse: eligibilityResponse({
        status: "not-qualified",
        verifiedTree: "0",
        remainingTree: "1000000",
        sources: [
          source("suidex-v2", "verified-zero"),
          source("suidex-v3", "verified-zero"),
          source("tree-lock", "verified-zero"),
        ],
      }),
      isBattleActive: true,
      currentMoveCount: 4,
      rerollStatus: "not-live" as TreeRerollStatus,
      rerollCostTree: null,
    },
  },
  {
    title: "999,999 TREE",
    note: "One TREE below the threshold does not qualify when every provider is verified.",
    props: {
      address: MOCK_WALLET,
      treeBalance: makeTreeBalanceView(11_345.6789),
      fifthMoveEligibilityResponse: eligibilityResponse({
        status: "not-qualified",
        verifiedTree: "999999",
        remainingTree: "1",
        sources: [
          source("suidex-v2", "qualified-data", "999999"),
          source("suidex-v3", "verified-zero"),
          source("tree-lock", "verified-zero"),
        ],
      }),
      isBattleActive: true,
      currentMoveCount: 4,
      rerollStatus: "not-live" as TreeRerollStatus,
    },
  },
  {
    title: "Exactly 1,000,000 TREE",
    note: "The exact threshold qualifies, but activation is still not live in this checkpoint.",
    props: {
      address: MOCK_WALLET,
      treeBalance: makeTreeBalanceView(11_345.6789),
      fifthMoveEligibilityResponse: eligibilityResponse({
        status: "qualified",
        verifiedTree: "1000000",
        sources: [
          source("suidex-v2", "qualified-data", "1000000"),
          source("suidex-v3", "verified-zero"),
          source("tree-lock", "verified-zero"),
        ],
      }),
      isBattleActive: true,
      currentMoveCount: 4,
      rerollStatus: "not-live" as TreeRerollStatus,
    },
  },
  {
    title: "1,000,001 TREE",
    note: "Above-threshold verified TREE qualifies exactly one additional future move.",
    props: {
      address: MOCK_WALLET,
      treeBalance: makeTreeBalanceView(11_345.6789),
      fifthMoveEligibilityResponse: eligibilityResponse({
        status: "qualified",
        verifiedTree: "1000001",
        sources: [
          source("suidex-v2", "qualified-data", "1000001"),
          source("suidex-v3", "verified-zero"),
          source("tree-lock", "verified-zero"),
        ],
      }),
      isBattleActive: true,
      currentMoveCount: 4,
      rerollStatus: "not-live" as TreeRerollStatus,
    },
  },
  {
    title: "400K V2 + 300K V3 + 1M TREE Lock",
    note: "A wallet may combine all verified sources to reach the threshold.",
    props: {
      address: MOCK_WALLET,
      treeBalance: makeTreeBalanceView(11_345.6789),
      fifthMoveEligibilityResponse: eligibilityResponse({
        status: "qualified",
        verifiedTree: "1000000",
        sources: [
          source("suidex-v2", "qualified-data", "400000"),
          source("suidex-v3", "qualified-data", "300000"),
          source("tree-lock", "qualified-data", "1000000"),
        ],
      }),
      isBattleActive: true,
      currentMoveCount: 4,
      rerollStatus: "not-live" as TreeRerollStatus,
    },
  },
  {
    title: "600K V2, TREE Lock unavailable",
    note: "Below threshold plus an unavailable provider is verification incomplete, not not-qualified.",
    props: {
      address: MOCK_WALLET,
      treeBalance: makeTreeBalanceView(11_345.6789),
      fifthMoveEligibilityResponse: eligibilityResponse({
        status: "verification-incomplete",
        verifiedTree: "600000",
        remainingTree: "400000",
        sources: [
          source("suidex-v2", "qualified-data", "600000"),
          source("suidex-v3", "verified-zero"),
          source("tree-lock", "unavailable"),
        ],
      }),
      isBattleActive: true,
      currentMoveCount: 4,
      rerollStatus: "not-live" as TreeRerollStatus,
    },
  },
  {
    title: "1.1M V2, TREE Lock unavailable",
    note: "Verified total at or above threshold qualifies even if another source is unavailable.",
    props: {
      address: MOCK_WALLET,
      treeBalance: makeTreeBalanceView(11_345.6789),
      fifthMoveEligibilityResponse: eligibilityResponse({
        status: "qualified",
        verifiedTree: "1100000",
        sources: [
          source("suidex-v2", "qualified-data", "1100000"),
          source("suidex-v3", "verified-zero"),
          source("tree-lock", "unavailable"),
        ],
      }),
      isBattleActive: true,
      currentMoveCount: 4,
      rerollStatus: "not-live" as TreeRerollStatus,
    },
  },
  {
    title: "All providers unavailable",
    note: "No provider failure is converted into zero or a false not-qualified result.",
    props: {
      address: MOCK_WALLET,
      treeBalance: UNAVAILABLE_BALANCE,
      fifthMoveEligibilityResponse: eligibilityResponse({
        status: "unavailable",
        verifiedTree: "0",
        remainingTree: "1000000",
        sources: [
          source("suidex-v2", "unavailable"),
          source("suidex-v3", "unavailable"),
          source("tree-lock", "unavailable"),
        ],
      }),
      isBattleActive: true,
      currentMoveCount: 4,
      rerollStatus: "not-live" as TreeRerollStatus,
    },
  },
  {
    title: "Qualified via SuiDex V2",
    note: "Future display reference for a qualifying V2 LP/farm position.",
    props: {
      address: MOCK_WALLET,
      treeBalance: makeTreeBalanceView(11_345.6789),
      fifthMoveEligibilityResponse: eligibilityResponse({
        status: "qualified",
        verifiedTree: "1000000",
        sources: [
          source("suidex-v2", "qualified-data", "1000000"),
          source("suidex-v3", "verified-zero"),
          source("tree-lock", "verified-zero"),
        ],
      }),
      isBattleActive: true,
      currentMoveCount: 4,
      rerollStatus: "not-live" as TreeRerollStatus,
    },
  },
  {
    title: "Qualified via SuiDex V3",
    note: "Future display reference for an active nonzero V3 position.",
    props: {
      address: MOCK_WALLET,
      treeBalance: makeTreeBalanceView(11_345.6789),
      fifthMoveEligibilityResponse: eligibilityResponse({
        status: "qualified",
        verifiedTree: "1000000",
        sources: [
          source("suidex-v2", "verified-zero"),
          source("suidex-v3", "qualified-data", "1000000"),
          source("tree-lock", "verified-zero"),
        ],
      }),
      isBattleActive: true,
      currentMoveCount: 4,
      rerollStatus: "not-live" as TreeRerollStatus,
    },
  },
  {
    title: "30-Day TREE Lock only",
    note: "Display reference for a verified, non-yielding 1,000,000 TREE Lock.",
    props: {
      address: MOCK_WALLET,
      treeBalance: makeTreeBalanceView(11_345.6789),
      fifthMoveEligibilityResponse: eligibilityResponse({
        status: "qualified",
        verifiedTree: "1000000",
        sources: [
          source("suidex-v2", "verified-zero"),
          source("suidex-v3", "verified-zero"),
          source("tree-lock", "qualified-data", "1000000"),
        ],
      }),
      isBattleActive: true,
      currentMoveCount: 4,
      rerollStatus: "not-live" as TreeRerollStatus,
    },
  },
  {
    title: "V2 + TREE Lock",
    note: "Multiple qualifying TREE positions still grant only one fifth move.",
    props: {
      address: MOCK_WALLET,
      treeBalance: makeTreeBalanceView(11_345.6789),
      fifthMoveEligibilityResponse: eligibilityResponse({
        status: "qualified",
        verifiedTree: "1000000",
        sources: [
          source("suidex-v2", "qualified-data", "500000"),
          source("suidex-v3", "verified-zero"),
          source("tree-lock", "qualified-data", "500000"),
        ],
      }),
      isBattleActive: true,
      currentMoveCount: 4,
      rerollStatus: "not-live" as TreeRerollStatus,
    },
  },
  {
    title: "V3 + TREE Lock",
    note: "Multiple qualifying TREE positions still grant only one fifth move.",
    props: {
      address: MOCK_WALLET,
      treeBalance: makeTreeBalanceView(11_345.6789),
      fifthMoveEligibilityResponse: eligibilityResponse({
        status: "qualified",
        verifiedTree: "1000000",
        sources: [
          source("suidex-v2", "verified-zero"),
          source("suidex-v3", "qualified-data", "500000"),
          source("tree-lock", "qualified-data", "500000"),
        ],
      }),
      isBattleActive: true,
      currentMoveCount: 4,
      rerollStatus: "not-live" as TreeRerollStatus,
    },
  },
  {
    title: "V2 + V3 + TREE Lock",
    note: "All qualifying TREE sources are detected, but only one fifth slot is shown.",
    props: {
      address: MOCK_WALLET,
      treeBalance: makeTreeBalanceView(11_345.6789),
      fifthMoveEligibilityResponse: eligibilityResponse({
        status: "qualified",
        verifiedTree: "1500000",
        sources: [
          source("suidex-v2", "qualified-data", "500000"),
          source("suidex-v3", "qualified-data", "500000"),
          source("tree-lock", "qualified-data", "500000"),
        ],
      }),
      isBattleActive: true,
      currentMoveCount: 4,
      rerollStatus: "not-live" as TreeRerollStatus,
    },
  },
  {
    title: "TREE Lock verification unavailable",
    note: "A TREE Lock RPC failure is not displayed as not-qualified.",
    props: {
      address: MOCK_WALLET,
      treeBalance: UNAVAILABLE_BALANCE,
      fifthMoveEligibility: ELIGIBILITY.unavailable,
      isBattleActive: true,
      currentMoveCount: 4,
      rerollStatus: "not-live" as TreeRerollStatus,
    },
  },
  {
    title: "No active TREE Lock",
    note: "A withdrawn or missing TREE Lock does not qualify.",
    props: {
      address: MOCK_WALLET,
      treeBalance: makeTreeBalanceView(11_345.6789),
      fifthMoveEligibility: ELIGIBILITY.notQualified,
      isBattleActive: true,
      currentMoveCount: 4,
      rerollStatus: "not-live" as TreeRerollStatus,
    },
  },
  {
    title: "Unrelated token lock",
    note: "Unrelated token stakes and generic token locks do not qualify.",
    props: {
      address: MOCK_WALLET,
      treeBalance: makeTreeBalanceView(11_345.6789),
      fifthMoveEligibility: ELIGIBILITY.notQualified,
      isBattleActive: true,
      currentMoveCount: 4,
      rerollStatus: "not-live" as TreeRerollStatus,
    },
  },
  {
    title: "Qualified position, activation not live",
    note: "Eligibility is detected, but the frontend does not fake a fifth move.",
    props: {
      address: MOCK_WALLET,
      treeBalance: makeTreeBalanceView(11_345.6789),
      fifthMoveEligibility: ELIGIBILITY.treeLock,
      isBattleActive: true,
      currentMoveCount: 4,
      rerollStatus: "not-live" as TreeRerollStatus,
    },
  },
  {
    title: "Active five-move hand",
    note: "The active hand is the source of truth that the fifth slot is live.",
    props: {
      address: MOCK_WALLET,
      treeBalance: makeTreeBalanceView(2_500_000),
      fifthMoveEligibility: ELIGIBILITY.unavailable,
      isBattleActive: true,
      currentMoveCount: 5,
      rerollStatus: "not-live" as TreeRerollStatus,
    },
  },
  {
    title: "Large liquid TREE, no position",
    note: "A large liquid TREE balance does not qualify for Fifth Move Unlock.",
    props: {
      address: MOCK_WALLET,
      treeBalance: makeTreeBalanceView(11_283_000),
      fifthMoveEligibilityResponse: eligibilityResponse({
        status: "not-qualified",
        verifiedTree: "0",
        remainingTree: "1000000",
        sources: [
          source("suidex-v2", "verified-zero"),
          source("suidex-v3", "verified-zero"),
          source("tree-lock", "verified-zero"),
        ],
      }),
      isBattleActive: true,
      currentMoveCount: 4,
      rerollStatus: "not-live" as TreeRerollStatus,
    },
  },
  {
    title: "NFTree owned, zero qualifying position",
    note: "NFTree access does not qualify Fifth Move by itself.",
    props: {
      address: MOCK_WALLET,
      treeBalance: makeTreeBalanceView(0),
      fifthMoveEligibilityResponse: eligibilityResponse({
        status: "not-qualified",
        verifiedTree: "0",
        remainingTree: "1000000",
        sources: [
          source("suidex-v2", "verified-zero"),
          source("suidex-v3", "verified-zero"),
          source("tree-lock", "verified-zero"),
        ],
      }),
      isBattleActive: true,
      currentMoveCount: 4,
      rerollStatus: "not-live" as TreeRerollStatus,
    },
  },
  {
    title: "Practice Mode",
    note: "Practice battle active; TREE payment utilities are unavailable.",
    props: {
      address: null,
      treeBalance: DISCONNECTED_BALANCE,
      fifthMoveEligibility: ELIGIBILITY.notConnected,
      isBattleActive: true,
      isPracticeBattle: true,
      currentMoveCount: 4,
      rerollStatus: "available" as TreeRerollStatus,
    },
  },
];

const REROLL_STATES: TreeRerollStatus[] = [
  "unavailable",
  "available",
  "insufficient-tree",
  "awaiting-approval",
  "submitted",
  "used",
  "not-live",
];

function ScenarioCard({ scenario }: { scenario: (typeof TREE_POWER_PREVIEW_SCENARIOS)[number] }) {
  return (
    <article className="gb-tree-power-preview-card">
      <div className="gb-tree-power-preview-card-copy">
        <span>Scenario</span>
        <h2>{scenario.title}</h2>
        <p>{scenario.note}</p>
      </div>
      <div className="gb-tree-power-preview-rail">
        <TreePowerPanel {...scenario.props} />
      </div>
    </article>
  );
}

export default function TreePowerPreview() {
  return (
    <main className="gb-tree-power-preview-page">
      <section className="gb-tree-power-preview-hero">
        <p className="gb-tree-power-preview-kicker">Dev-only QA Preview</p>
        <h1>Tree Power Panel States</h1>
        <p>
          Local presentation review for TREE balance, Fifth Move, and future TREE Reroll
          states. No wallet, Sui transaction, TREE payment, or leaderboard call is wired
          from this page.
        </p>
      </section>

      <section className="gb-tree-power-preview-layout" aria-label="Simulated battle rail preview">
        <div className="gb-tree-power-preview-side">
          <TreePowerPanel
            address={MOCK_WALLET}
            treeBalance={makeTreeBalanceView(11_345.6789)}
            fifthMoveEligibility={ELIGIBILITY.notQualified}
            isBattleActive
            currentMoveCount={4}
            rerollStatus="not-live"
          />
        </div>
        <div className="gb-tree-power-preview-arena">
          <span>Simulated Battle Arena</span>
          <strong>Central board placeholder</strong>
          <p>Use this row to judge side-HUD scale beside the battle area.</p>
        </div>
        <div className="gb-tree-power-preview-side gb-tree-power-preview-side-muted">
          <span>Prize / Payout Rail Placeholder</span>
        </div>
      </section>

      <section className="gb-tree-power-preview-section">
        <div className="gb-tree-power-preview-section-title">
          <p>Required Scenarios</p>
          <span>Real TreePowerPanel component with mocked safe props</span>
        </div>
        <div className="gb-tree-power-preview-grid">
          {TREE_POWER_PREVIEW_SCENARIOS.map((scenario) => (
            <ScenarioCard key={scenario.title} scenario={scenario} />
          ))}
        </div>
      </section>

      <section className="gb-tree-power-preview-section">
        <div className="gb-tree-power-preview-section-title">
          <p>Mobile Width Check</p>
          <span>Single rail constrained to phone width</span>
        </div>
        <div className="gb-tree-power-preview-mobile-shell">
          <TreePowerPanel
            address={MOCK_WALLET}
            treeBalance={makeTreeBalanceView(0)}
            fifthMoveEligibility={ELIGIBILITY.notQualified}
            isBattleActive
            currentMoveCount={4}
            rerollStatus="not-live"
          />
        </div>
      </section>

      <section className="gb-tree-power-preview-section">
        <div className="gb-tree-power-preview-section-title">
          <p>Future Reroll-State Reference</p>
          <span>Presentation only; no buttons execute transactions</span>
        </div>
        <div className="gb-tree-power-preview-reroll-grid">
          {REROLL_STATES.map((status) => {
            const presentation = getTreeRerollPresentation({
              isPracticeBattle: false,
              rerollStatus: status,
              rerollCostTree: status === "not-live" ? null : 25,
            });
            return (
              <article className="gb-tree-power-preview-reroll-card" key={status}>
                <span>{status}</span>
                <strong>{presentation.statusLabel}</strong>
                <p>{presentation.costLabel}</p>
                <em>{presentation.buttonLabel}</em>
                <small>{presentation.helperText}</small>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
