import TreePowerPanel from "@/components/TreePowerPanel";
import {
  getTreeRerollPresentation,
  type TreeRerollStatus,
} from "@/lib/treePowerPresentation";
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
  moonbags: { status: "qualified", sources: ["moonbags-staking"] },
  v2Moonbags: { status: "qualified", sources: ["suidex-v2", "moonbags-staking"] },
  v3Moonbags: { status: "qualified", sources: ["suidex-v3", "moonbags-staking"] },
  all: { status: "qualified", sources: ["suidex-v2", "suidex-v3", "moonbags-staking"] },
  unavailable: { status: "unavailable", sources: [] },
} satisfies Record<string, FifthMoveEligibility>;

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
    note: "Connected mock wallet while SuiDex and Moonbags position checks are pending.",
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
    title: "No qualifying position",
    note: "No SuiDex TREE V2 or V3 liquidity position detected.",
    props: {
      address: MOCK_WALLET,
      treeBalance: makeTreeBalanceView(128),
      fifthMoveEligibility: ELIGIBILITY.notQualified,
      isBattleActive: true,
      currentMoveCount: 4,
      rerollStatus: "not-live" as TreeRerollStatus,
      rerollCostTree: null,
    },
  },
  {
    title: "Qualified via SuiDex V2",
    note: "Future display reference for a qualifying V2 LP/farm position.",
    props: {
      address: MOCK_WALLET,
      treeBalance: makeTreeBalanceView(11_345.6789),
      fifthMoveEligibility: ELIGIBILITY.v2,
      isFifthMoveActivationLive: true,
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
      fifthMoveEligibility: ELIGIBILITY.v3,
      isFifthMoveActivationLive: true,
      isBattleActive: true,
      currentMoveCount: 4,
      rerollStatus: "not-live" as TreeRerollStatus,
    },
  },
  {
    title: "Moonbags TREE stake only",
    note: "Future display reference for an active, verifiable, nonzero Moonbags TREE stake.",
    props: {
      address: MOCK_WALLET,
      treeBalance: makeTreeBalanceView(11_345.6789),
      fifthMoveEligibility: ELIGIBILITY.moonbags,
      isFifthMoveActivationLive: true,
      isBattleActive: true,
      currentMoveCount: 4,
      rerollStatus: "not-live" as TreeRerollStatus,
    },
  },
  {
    title: "V2 + Moonbags",
    note: "Multiple qualifying TREE positions still grant only one fifth move.",
    props: {
      address: MOCK_WALLET,
      treeBalance: makeTreeBalanceView(11_345.6789),
      fifthMoveEligibility: ELIGIBILITY.v2Moonbags,
      isFifthMoveActivationLive: true,
      isBattleActive: true,
      currentMoveCount: 4,
      rerollStatus: "not-live" as TreeRerollStatus,
    },
  },
  {
    title: "V3 + Moonbags",
    note: "Multiple qualifying TREE positions still grant only one fifth move.",
    props: {
      address: MOCK_WALLET,
      treeBalance: makeTreeBalanceView(11_345.6789),
      fifthMoveEligibility: ELIGIBILITY.v3Moonbags,
      isFifthMoveActivationLive: true,
      isBattleActive: true,
      currentMoveCount: 4,
      rerollStatus: "not-live" as TreeRerollStatus,
    },
  },
  {
    title: "V2 + V3 + Moonbags",
    note: "All qualifying TREE sources are detected, but only one fifth slot is shown.",
    props: {
      address: MOCK_WALLET,
      treeBalance: makeTreeBalanceView(11_345.6789),
      fifthMoveEligibility: ELIGIBILITY.all,
      isFifthMoveActivationLive: true,
      isBattleActive: true,
      currentMoveCount: 4,
      rerollStatus: "not-live" as TreeRerollStatus,
    },
  },
  {
    title: "Moonbags stake verification unavailable",
    note: "Moonbags RPC or indexer failure is not displayed as not-qualified.",
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
    title: "Zero Moonbags stake",
    note: "A zero-value or withdrawn Moonbags TREE stake does not qualify.",
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
    title: "Unrelated Moonbags token stake",
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
      fifthMoveEligibility: ELIGIBILITY.moonbags,
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
      fifthMoveEligibility: ELIGIBILITY.notQualified,
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
