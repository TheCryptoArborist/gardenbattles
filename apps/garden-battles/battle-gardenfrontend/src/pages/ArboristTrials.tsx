import { useEffect, useMemo, useRef, useState } from "react";
import { ConnectButton, useCurrentAccount, useSignPersonalMessage } from "@mysten/dapp-kit";
import { ArrowLeft, Bot, CalendarDays, Flame, RotateCcw, ShieldCheck, Swords, Trophy } from "lucide-react";
import { Link } from "wouter";
import BattleLog, { type ActionEntry } from "@/components/BattleLog";
import MoveCardFace from "@/components/MoveCardFace";
import TrialCheckInMeter from "@/components/TrialCheckInMeter";
import TrialAchievements from "@/components/TrialAchievements";
import {
  fetchTodayArboristTrial,
  submitArboristTrialResult,
  type ArboristTrialTodayResponse,
} from "@/lib/api";
import { appAsset } from "@/lib/assets";
import { getBattleTreeAssetPath, resolveGrowthStage } from "@/lib/battleTreeArtwork";
import {
  createArboristTrialBattle,
  getCanopyDiagnosisCounterType,
  getCanopyDiagnosisForecast,
  getArboristTrialResult,
  getToolbeltLockedMoveIds,
  isArboristTrialMoveDisabled,
  playArboristTrialRound,
} from "@/lib/arboristTrials";
import type { PracticeBattle } from "@/lib/practiceBattle";
import { useFifthMoveEligibility } from "@/hooks/useFifthMoveEligibility";
import { readCachedSuiName, resolveSuiNames } from "@/lib/suiNameService";
import {
  createArboristTrialProofMessage,
  getArboristTrialChallenge,
} from "@shared/arborist-trials";
import "@/arborist-trials.css";

const LOCAL_PREVIEW_ENABLED = import.meta.env.VITE_ARB_TRIAL_LOCAL_PREVIEW === "true";

function shortWallet(wallet: string) {
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function TreePortrait({ growth, bot }: { growth: number; bot?: boolean }) {
  const stage = resolveGrowthStage(growth, 50);
  return (
    <div className={`gb-trial-tree-card ${bot ? "gb-trial-tree-card-bot" : ""}`}>
      <small>{bot ? "DAILY GARDEN BOT" : "YOUR TREE"}</small>
      <div className="gb-trial-tree-art">
        <img src={appAsset(getBattleTreeAssetPath(stage, !!bot))} alt={`${bot ? "Garden Bot" : "Player"} tree at stage ${stage}`} />
      </div>
      <div className="gb-trial-growth-label"><span>Growth</span><strong>{growth} / 50</strong></div>
      <div className="gb-trial-growth-track"><span style={{ width: `${Math.min(100, growth * 2)}%` }} /></div>
    </div>
  );
}

export default function ArboristTrials() {
  const account = useCurrentAccount();
  const signPersonalMessage = useSignPersonalMessage();
  const address = account?.address ?? null;
  const eligibility = useFifthMoveEligibility(address);
  const [today, setToday] = useState<ArboristTrialTodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [battle, setBattle] = useState<PracticeBattle | null>(null);
  const [log, setLog] = useState<ActionEntry[]>([]);
  const [rankedRun, setRankedRun] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scoreSaved, setScoreSaved] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState(false);
  const [suiNames, setSuiNames] = useState<Record<string, string | null>>({});
  const submittedBattleRef = useRef<string | null>(null);

  const loadToday = async () => {
    setLoading(true);
    setError(null);
    try {
      setToday(await fetchTodayArboristTrial(address));
      setLocalPreview(false);
    } catch (reason) {
      if (LOCAL_PREVIEW_ENABLED) {
        setToday({
          challenge: getArboristTrialChallenge(),
          nftreeAccess: "unavailable",
          rankedAttemptUsed: false,
          result: null,
          streak: 0,
          checkInStreak: 0,
          checkIns: [],
          achievements: [],
          leaderboard: [],
        });
        setLocalPreview(true);
      } else {
        setError(reason instanceof Error ? reason.message : "Today’s trial could not be loaded.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadToday(); }, [address]);

  useEffect(() => {
    if (!today?.leaderboard.length) return;
    let cancelled = false;
    const addresses = Array.from(new Set(today.leaderboard.map((entry) => entry.wallet.toLowerCase())));
    const cached = addresses.reduce<Record<string, string | null>>((next, entryAddress) => {
      const name = readCachedSuiName(entryAddress);
      if (name) next[entryAddress] = name;
      return next;
    }, {});
    if (Object.keys(cached).length) setSuiNames((current) => ({ ...current, ...cached }));

    const unresolved = addresses.filter((entryAddress) => !readCachedSuiName(entryAddress));
    if (!unresolved.length) return;
    void resolveSuiNames(unresolved).then((resolved) => {
      if (!cancelled) setSuiNames((current) => ({ ...current, ...resolved }));
    });
    return () => { cancelled = true; };
  }, [today?.leaderboard]);

  const fifthUnlocked = eligibility.status === "qualified";
  const rankedAccess = today?.nftreeAccess ?? (address ? "unavailable" : "not_connected");
  const rankedEligible = rankedAccess === "eligible";
  const startTrial = (ranked: boolean) => {
    if (!today) return;
    if (ranked && !rankedEligible) {
      setError(rankedAccess === "ineligible"
        ? "An NFTree must be held by this wallet to enter the official ranked Trial. Practice remains open to everyone."
        : "NFTree ownership could not be verified right now. Please try again before starting the official Trial.");
      return;
    }
    setBattle(createArboristTrialBattle(today.challenge, fifthUnlocked));
    setLog([]);
    setRankedRun(ranked);
    setSubmissionMessage(null);
    setScoreSaved(false);
    submittedBattleRef.current = null;
  };

  const playMove = (moveId: number) => {
    if (!battle || battle.finished) return;
    try {
      const result = playArboristTrialRound(battle, today!.challenge, moveId);
      setBattle(result.battle);
      setLog((entries) => [...entries, ...result.entries]);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That move could not be played.");
    }
  };

  const submitRankedScore = async () => {
    if (!battle?.finished || !rankedRun || !address || !today || scoreSaved) return;
    if (submittedBattleRef.current === battle.battleId) return;
    submittedBattleRef.current = battle.battleId;
    setSubmitting(true);
    setSubmissionMessage("Approve the free wallet signature to submit your official score.");
    try {
      const proofMessage = createArboristTrialProofMessage(
        today.challenge.id,
        address,
        battle.allPlayerMoves,
      );
      const proof = await signPersonalMessage.mutateAsync({
        message: new TextEncoder().encode(proofMessage),
      });
      const saved = await submitArboristTrialResult({
        challengeId: today.challenge.id,
        wallet: address,
        playerMoves: battle.allPlayerMoves,
        signature: proof.signature,
      });
      setScoreSaved(true);
      setSubmissionMessage(`Ranked score saved: ${saved.result.score.toLocaleString()} points.`);
      await loadToday();
    } catch (reason) {
      submittedBattleRef.current = null;
      const message = reason instanceof Error ? reason.message : "";
      setSubmissionMessage(message === "nftree_required"
        ? "This wallet no longer has a verified NFTree, so the official score was not saved."
        : message === "nftree_access_unavailable"
          ? "NFTree ownership could not be verified. Nothing was submitted; please try again."
          : message || "The ranked score could not be saved.");
    } finally {
      setSubmitting(false);
    }
  };

  const rounds = battle ? Math.ceil(battle.totalTurns / 2) : 0;
  const result = useMemo(
    () => battle?.finished && today ? getArboristTrialResult(battle, today.challenge) : null,
    [battle, today],
  );
  const lastBotMove = [...log].reverse().find((entry) => entry.actor === "opponent");
  const diagnosisForecast = battle && today
    ? getCanopyDiagnosisForecast(battle, today.challenge)
    : null;
  const toolbeltLockedMoves = battle && today
    ? getToolbeltLockedMoveIds(battle, today.challenge)
    : new Set<number>();

  return (
    <div className="gb-trials-page">
      <header className="gb-trials-header">
        <Link href="/battle" className="gb-trials-back"><ArrowLeft size={17} /> Garden Battles</Link>
        <img src={appAsset("assets/garden.png")} alt="Garden Battles" />
        <ConnectButton connectText="Connect Wallet" />
      </header>

      <main className="gb-trials-shell">
        <section className="gb-trials-hero">
          <div>
            <span className="gb-trials-kicker"><CalendarDays size={16} /> Daily ranked challenge</span>
            <h1 className="gb-visually-hidden">Arborist Trials</h1>
            <img
              className="gb-trials-hero-logo"
              src={appAsset("assets/arborist-trials-logo.webp")}
              alt="Arborist Trials"
            />
            <p>One shared challenge. One ranked score per wallet each day. Unlimited practice after your official run.</p>
          </div>
          <div className="gb-trials-hero-status">
            <div className={`gb-trials-access-badge gb-trials-access-badge-${rankedAccess}`}>
              <ShieldCheck size={20} />
              <span>
                <small>OFFICIAL TRIAL ACCESS</small>
                <strong>{rankedAccess === "eligible" ? "NFTree Verified" : rankedAccess === "ineligible" ? "NFTree Required" : rankedAccess === "unavailable" ? "Verification Unavailable" : "Connect Wallet"}</strong>
              </span>
            </div>
            <div className="gb-trials-streak"><Flame size={27} /><span><strong>{today?.streak ?? 0}</strong> day streak</span></div>
          </div>
        </section>

        {loading && <section className="gb-trials-message">Preparing today’s trial...</section>}
        {error && <section className="gb-trials-message gb-trials-message-error">{error}</section>}
        {localPreview && <section className="gb-trials-message gb-trials-message-preview">Preview mode: gameplay and layout are live; official scores and streaks remain disabled until the ranked server is deployed.</section>}

        {today && !battle && (
          <>
            <section className="gb-trials-briefing">
              <div>
                <small>TODAY · {today.challenge.date}</small>
                <h2>{today.challenge.title}</h2>
                <strong>{today.challenge.subtitle}</strong>
                <p>{today.challenge.description}</p>
              </div>
              <div className="gb-trials-rules">
                <span><b>Target</b> 50 Growth</span>
                <span><b>You start</b> {today.challenge.playerStartGrowth} Growth</span>
                <span><b>Bot starts</b> {today.challenge.botStartGrowth} Growth</span>
                <span><b>Fifth card</b> {fifthUnlocked ? "Unlocked" : "Requires TREE eligibility"}</span>
                <span><b>Special rule</b> {today.challenge.ruleDescription}</span>
              </div>
              <div className="gb-trials-start-actions">
                <button
                  type="button"
                  className="gb-trials-primary"
                  disabled={localPreview || !address || !rankedEligible || today.rankedAttemptUsed}
                  onClick={() => startTrial(true)}
                >
                  <ShieldCheck size={18} />
                  {localPreview
                    ? "Ranked Scoring Not Active in Preview"
                    : !address
                      ? "Connect for Ranked Attempt"
                      : today.rankedAttemptUsed
                        ? "Ranked Attempt Complete"
                        : rankedAccess === "ineligible"
                          ? "NFTree Required for Ranked Trial"
                          : rankedAccess === "unavailable"
                            ? "NFTree Check Unavailable — Retry"
                            : "Start Ranked Attempt"}
                </button>
                <button type="button" className="gb-trials-secondary" onClick={() => startTrial(false)}>
                  Practice Today’s Trial
                </button>
              </div>
              <p className={`gb-trials-access-status gb-trials-access-${rankedAccess}`}>
                {rankedAccess === "eligible"
                  ? "NFTree verified — this wallet can enter today’s official ranked Trial."
                  : rankedAccess === "ineligible"
                    ? "Official ranking is NFTree-gated. Add an NFTree to this wallet or use unlimited practice."
                    : rankedAccess === "unavailable"
                      ? "The NFTree ownership check is temporarily unavailable. Refresh and try again."
                      : "Connect a wallet holding an NFTree to unlock today’s official ranked attempt."}
              </p>
              {today.result && <p className="gb-trials-saved-score">Today’s official score: <strong>{today.result.score.toLocaleString()}</strong></p>}
            </section>

            <div className="gb-trials-progress-row">
              <TrialCheckInMeter connected={!!address} checkInStreak={today?.checkInStreak} todayCheckedIn={today?.rankedAttemptUsed} />
              <TrialAchievements achievements={today?.achievements} connected={!!address} />
            </div>

            <details className="gb-trials-difference gb-trials-difference-collapsed">
              <summary>Why Arborist Trials is different from Garden Battles</summary>
              <div className="gb-trials-difference-heading">
                <small>CHOOSE YOUR EXPERIENCE</small>
                <h2>How Arborist Trials differs</h2>
                <p>Trials is the same daily strategy puzzle for everyone. Garden Battles is the main arena for repeat matches and PvP competition.</p>
              </div>
              <div className="gb-trials-difference-grid">
                <article className="gb-trials-difference-card gb-trials-difference-card-trials">
                  <Trophy size={24} />
                  <div><strong>Arborist Trials</strong><span>One shared challenge each day</span></div>
                  <ul>
                    <li>Every player receives the same challenge setup.</li>
                    <li>NFTree owners receive one official ranked attempt per wallet each day.</li>
                    <li>Practice is open to everyone and remains unlimited.</li>
                    <li>No SUI entry fee; sign once after the run to save your score.</li>
                  </ul>
                </article>
                <article className="gb-trials-difference-card">
                  <Swords size={24} />
                  <div><strong>Garden Battles</strong><span>Play full matches whenever you want</span></div>
                  <ul>
                    <li>Fight Garden Bot or challenge another player in PvP.</li>
                    <li>Hands, opponents, and match strategy change from battle to battle.</li>
                    <li>PvP uses a 3 SUI entry; Garden Bot does not.</li>
                  </ul>
                  <Link href="/battle" className="gb-trials-difference-link"><Bot size={15} /> Go to Garden Battles</Link>
                </article>
              </div>
            </details>

            <section className="gb-trials-leaderboard">
              <div className="gb-trials-leaderboard-head">
                <div className="gb-trials-section-heading"><Trophy size={20} /><div><small>TODAY’S CANOPY</small><h2>Daily Leaders</h2></div></div>
                <p>Ranked by score. Faster wins and a more varied hand improve your result.</p>
              </div>
              {today.leaderboard.length === 0 ? <p>Be the first wallet to complete today’s ranked trial.</p> : (
                <ol>{today.leaderboard.slice(0, 10).map((entry, index) => {
                  const normalizedWallet = entry.wallet.toLowerCase();
                  const suiName = suiNames[normalizedWallet];
                  const isCurrentWallet = normalizedWallet === address?.toLowerCase();
                  const rank = entry.rank ?? index + 1;
                  return (
                    <li key={entry.wallet} className={`${rank <= 3 ? `gb-trials-leader-rank-${rank}` : ""}${isCurrentWallet ? " gb-trials-leader-current" : ""}`}>
                      <b>#{rank}</b>
                      <span className="gb-trials-leader-identity" title={suiName ? `${suiName} (${entry.wallet})` : entry.wallet}>
                        <strong>{suiName || shortWallet(entry.wallet)}</strong>
                        {suiName && <small>{shortWallet(entry.wallet)}</small>}
                        {isCurrentWallet && <em>YOU</em>}
                      </span>
                      <span className="gb-trials-leader-score"><strong>{entry.score.toLocaleString()}</strong><small>points</small></span>
                      <span className="gb-trials-leader-rounds"><strong>{entry.rounds}</strong><small>rounds</small></span>
                    </li>
                  );
                })}</ol>
              )}
            </section>
          </>
        )}

        {today && battle && (
          <section className="gb-trials-arena">
            <div className="gb-trials-live-heading">
              <div><small>{rankedRun ? "OFFICIAL DAILY RUN" : "UNRANKED PRACTICE"}</small><h2>{today.challenge.title}</h2></div>
              <span>Round {Math.max(1, rounds)}</span>
            </div>
            <div className="gb-trials-versus">
              <TreePortrait growth={battle.player1Growth} />
              <strong>VS</strong>
              <TreePortrait growth={battle.player2Growth} bot />
            </div>

            {!battle.finished && lastBotMove && (
              <div className="gb-trials-last-move">Last Garden Bot card: <strong>{lastBotMove.label}</strong></div>
            )}

            {!battle.finished && diagnosisForecast && (
              <div className="gb-trials-last-move gb-trials-forecast">
                Canopy diagnosis: Garden Bot is preparing a <strong>{diagnosisForecast.toUpperCase()}</strong> card.
                Best response: <strong>{getCanopyDiagnosisCounterType(diagnosisForecast).toUpperCase()}</strong>.
              </div>
            )}

            {!battle.finished ? (
              <div className="gb-trials-hand">
                <div className="gb-trials-hand-heading">
                  <span>Choose your move</span>
                  <small>{today.challenge.rule === "toolbelt_rotation"
                    ? "Use all four standard cards to reset your Toolbelt. The fifth move stays separate."
                    : today.challenge.rule === "integrated_pest_management"
                      ? "Win with two or fewer Attack plays for the full IPM bonus."
                      : today.challenge.rule === "storm_response"
                        ? "Storm damage strikes both trees after every third completed round."
                        : "The same card cannot be played twice in a row."}</small>
                </div>
                <div className="gb-trials-move-grid">
                  {battle.player1Moves.map((moveId, index) => {
                    const usedLast = battle.playerMoveHistory.at(-1) === moveId;
                    const toolLocked = toolbeltLockedMoves.has(moveId);
                    const fifth = index === 4;
                    return (
                      <button key={moveId} type="button" className={`gb-trial-move-card${fifth ? " gb-trial-move-card-fifth" : ""}`} disabled={isArboristTrialMoveDisabled(battle, today.challenge, moveId)} onClick={() => playMove(moveId)}>
                        {fifth && <span className="gb-trial-fifth-banner">BONUS FIFTH MOVE</span>}
                        <MoveCardFace moveId={moveId} isFifth={fifth} />
                        {usedLast && <span className="gb-trial-used-last">Used last round</span>}
                        {!usedLast && toolLocked && <span className="gb-trial-used-last">Tool locked this cycle</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className={`gb-trials-result ${result?.won ? "gb-trials-result-win" : "gb-trials-result-loss"}`}>
                <Trophy size={34} />
                <div><small>TRIAL COMPLETE · {rankedRun ? "OFFICIAL RUN" : "PRACTICE"}</small><h2>{result?.won ? "Canopy Conquered" : "Garden Bot Held the Grove"}</h2><p>{rounds} rounds · {battle.player1Growth}–{battle.player2Growth} final Growth</p>{result?.specialtySummary && <p>{result.specialtySummary} · {result.specialtyBonus.toLocaleString()} specialty points</p>}{submissionMessage && <strong>{submissionMessage}</strong>}{!rankedRun && <strong>Practice result only — no score or streak was submitted.</strong>}</div>
                {rankedRun && !scoreSaved && (
                  <button type="button" className="gb-trials-primary" disabled={submitting} onClick={() => void submitRankedScore()}>
                    <ShieldCheck size={16} /> {submitting ? "Waiting for Wallet..." : "Sign & Submit Official Score"}
                  </button>
                )}
                <button type="button" onClick={() => startTrial(false)}><RotateCcw size={16} /> Practice Again</button>
                <button type="button" onClick={() => setBattle(null)}>Return to Daily Board</button>
              </div>
            )}

            <section className="gb-trials-log"><div className="gb-trials-section-heading"><span>📜</span><div><small>COUNTER INTELLIGENCE</small><h2>Battle Log</h2></div></div><BattleLog entries={log} isPlayer1 opponentLabel="Garden Bot" /></section>
          </section>
        )}
      </main>
    </div>
  );
}
