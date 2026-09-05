import { useEffect, useMemo, useRef, useState } from "react";
import { ConnectButton, useCurrentAccount, useSignPersonalMessage } from "@mysten/dapp-kit";
import { ArrowLeft, Bot, CalendarDays, Flame, RotateCcw, ShieldCheck, Swords, Trophy } from "lucide-react";
import { Link } from "wouter";
import BattleLog, { type ActionEntry } from "@/components/BattleLog";
import MoveCardFace from "@/components/MoveCardFace";
import TrialCheckInMeter from "@/components/TrialCheckInMeter";
import TrialAchievements, { TRIAL_BADGES } from "@/components/TrialAchievements";
import TrialLeaderboard from "@/components/TrialLeaderboard";
import TreeLockControl from "@/components/TreeLockControl";
import {
  fetchTodayArboristTrial,
  submitArboristTrialResult,
  type ArboristTrialTodayResponse,
} from "@/lib/api";
import { appAsset } from "@/lib/assets";
import { encodeTrialDraft, restoreTrialDraft, trialDraftKey, trialSaveError } from "@/lib/trialScoreDraft";
import { getBattleTreeAssetPath, resolveGrowthStage } from "@/lib/battleTreeArtwork";
import {
  applyArboristTrialFifthMove,
  createArboristTrialBattle,
  getCanopyDiagnosisCounterType,
  getCanopyDiagnosisForecast,
  getArboristTrialResult,
  getToolbeltLockedMoveIds,
  isArboristTrialMoveDisabled,
  playArboristTrialRound,
} from "@/lib/arboristTrials";
import type { PracticeBattle } from "@/lib/practiceBattle";
import { readCachedSuiName, resolveSuiNames } from "@/lib/suiNameService";
import {
  createArboristTrialProofMessage,
  getArboristTrialChallenge,
} from "@shared/arborist-trials";
import "@/arborist-trials.css";
import "@/trial-score-save.css";
import "@/trial-progression.css";

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
  const [today, setToday] = useState<ArboristTrialTodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [battle, setBattle] = useState<PracticeBattle | null>(null);
  const [log, setLog] = useState<ActionEntry[]>([]);
  const [rankedRun, setRankedRun] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scoreSaved, setScoreSaved] = useState(false);
  const [saveReceipt, setSaveReceipt] = useState<{ rank?: number; total?: number; badges: string[] } | null>(null);
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState(false);
  const [startingTrial, setStartingTrial] = useState(false);
  const [suiNames, setSuiNames] = useState<Record<string, string | null>>({});
  const submittedBattleRef = useRef<string | null>(null);
  const restoredWalletRef = useRef<string | null>(null);
  const currentAddressRef = useRef(address);
  const todayWalletRef = useRef<string | null | undefined>(undefined);
  currentAddressRef.current = address;
  const [runWallet, setRunWallet] = useState<string | null>(null);
  const [runChallenge, setRunChallenge] = useState<ArboristTrialTodayResponse["challenge"] | null>(null);
  const [savePhase, setSavePhase] = useState<"wallet" | "server" | null>(null);
  const savePanelRef = useRef<HTMLElement | null>(null);
  const unsavedResult = !!battle?.finished && rankedRun && !scoreSaved;
  const activeChallenge = runChallenge ?? today?.challenge;
  const wrongWallet = !!runWallet && runWallet.toLowerCase() !== address?.toLowerCase();

  const confirmLeaving = () => !unsavedResult || (!submitting && window.confirm(
    "Your official score has not been saved. Leave without saving? It will not count toward your daily check-in or streak until you sign and save it.",
  ));

  useEffect(() => {
    if (!unsavedResult) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    savePanelRef.current?.scrollIntoView({ block: "center" });
    savePanelRef.current?.focus({ preventScroll: true });
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsavedResult]);

  useEffect(() => {
    if (!unsavedResult || !battle || !runWallet || !runChallenge) return;
    try {
      localStorage.setItem(trialDraftKey(runWallet), encodeTrialDraft(
        runWallet, runChallenge.id, battle.player1Moves.length === 5, battle.allPlayerMoves, battle.trialEngine,
      ));
    } catch {
      setSubmissionMessage("Browser storage is unavailable. Keep this page open until you sign and save your score.");
    }
  }, [unsavedResult, battle, runWallet, runChallenge]);

  const loadToday = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchTodayArboristTrial(address);
      if (currentAddressRef.current !== address) return;
      todayWalletRef.current = address;
      setToday(response);
      setLocalPreview(false);
    } catch (reason) {
      if (currentAddressRef.current !== address) return;
      if (LOCAL_PREVIEW_ENABLED) {
        setToday({
          challenge: getArboristTrialChallenge(),
          nftreeAccess: "unavailable",
          fifthMoveAccess: "unavailable",
          fifthMoveUnlocked: false,
          rankedAttemptUsed: false,
          result: null,
          streak: 0,
          checkInStreak: 0,
          totalCheckIns: 0,
          checkIns: [],
          achievements: [],
          leaderboard: [],
        });
        setLocalPreview(true);
      } else {
        setError(reason instanceof Error ? reason.message : "Today’s trial could not be loaded.");
      }
    } finally {
      if (currentAddressRef.current === address) setLoading(false);
    }
  };

  useEffect(() => { void loadToday(); }, [address]);

  useEffect(() => {
    if (!today?.fifthMoveUnlocked || !battle || !activeChallenge || battle.player1Moves.length >= 5) return;
    setBattle((current) => current
      ? applyArboristTrialFifthMove(current, activeChallenge, true)
      : current);
  }, [today?.fifthMoveUnlocked, battle?.battleId, battle?.player1Moves.length, activeChallenge?.id]);

  useEffect(() => {
    if (!address || !today || todayWalletRef.current !== address || loading || battle || restoredWalletRef.current === address) return;
    restoredWalletRef.current = address;
    try {
      if (today.rankedAttemptUsed) {
        localStorage.removeItem(trialDraftKey(address));
        return;
      }
      const restored = restoreTrialDraft(localStorage.getItem(trialDraftKey(address)), address, today.challenge);
      if (!restored) return;
      setRunWallet(address);
      setRunChallenge(today.challenge);
      setBattle(restored.battle);
      setLog(restored.entries);
      setRankedRun(true);
      setScoreSaved(false);
      setSubmissionMessage("Your unsaved official result was restored. Sign below to save it before today's challenge expires.");
    } catch { /* Storage may be disabled by the wallet browser. */ }
  }, [address, today, loading, battle]);

  useEffect(() => {
    if (!today) return;
    let cancelled = false;
    const addresses = Array.from(new Set([...today.leaderboard.map((entry) => entry.wallet.toLowerCase()), ...(today.result ? [today.result.wallet.toLowerCase()] : [])]));
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
  }, [today?.leaderboard, today?.result]);

  const fifthUnlocked = today?.fifthMoveUnlocked ?? false;
  const fifthMoveAccess = today?.fifthMoveAccess ?? (address ? "unavailable" : "not_connected");
  const rankedAccess = today?.nftreeAccess ?? (address ? "unavailable" : "not_connected");
  const rankedEligible = rankedAccess === "eligible";
  const startTrial = async (ranked: boolean) => {
    if (!today || loading || (ranked && (todayWalletRef.current !== address || today.rankedAttemptUsed))) return;
    if (!confirmLeaving()) return;
    setStartingTrial(true);
    let currentToday = today;
    try {
      if (address && !localPreview) {
        currentToday = await fetchTodayArboristTrial(address);
        if (currentAddressRef.current !== address) return;
        todayWalletRef.current = address;
        setToday(currentToday);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Fifth-card eligibility could not be refreshed.");
      return;
    } finally {
      setStartingTrial(false);
    }
    const currentRankedAccess = currentToday.nftreeAccess;
    if (ranked && currentRankedAccess !== "eligible") {
      setError(currentRankedAccess === "ineligible"
        ? "An NFTree must be held by this wallet to enter the official ranked Trial. Practice remains open to everyone."
        : "NFTree ownership could not be verified right now. Please try again before starting the official Trial.");
      return;
    }
    setBattle(createArboristTrialBattle(currentToday.challenge, currentToday.fifthMoveUnlocked));
    setRunWallet(ranked ? address : null);
    setRunChallenge(currentToday.challenge);
    setLog([]);
    setRankedRun(ranked);
    setSubmissionMessage(null);
    setScoreSaved(false);
    setSaveReceipt(null);
    submittedBattleRef.current = null;
  };

  const playMove = (moveId: number) => {
    if (!battle || battle.finished || !activeChallenge) return;
    try {
      const result = playArboristTrialRound(battle, activeChallenge, moveId);
      setBattle(result.battle);
      setLog((entries) => [...entries, ...result.entries]);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That move could not be played.");
    }
  };

  const submitRankedScore = async () => {
    if (!battle?.finished || !rankedRun || !address || !runWallet || !runChallenge || scoreSaved || wrongWallet) return;
    if (submittedBattleRef.current === battle.battleId) return;
    submittedBattleRef.current = battle.battleId;
    setSubmitting(true);
    setSavePhase("wallet");
    setSubmissionMessage("Approve the free wallet signature to submit your official score.");
    const markSaved = (score: number, alreadySaved = false) => {
      setScoreSaved(true);
      setSubmissionMessage(`${alreadySaved ? "Today's official score is already saved" : "Official score saved"}: ${score.toLocaleString()} points. Daily check-in recorded.`);
      try { localStorage.removeItem(trialDraftKey(runWallet)); } catch { /* No persistent storage. */ }
    };
    try {
      const proofMessage = createArboristTrialProofMessage(
        runChallenge.id,
        runWallet,
        battle.allPlayerMoves,
        battle.trialEngine,
      );
      const proof = await signPersonalMessage.mutateAsync({
        message: new TextEncoder().encode(proofMessage),
      });
      if (currentAddressRef.current?.toLowerCase() !== runWallet.toLowerCase()) throw new Error("wallet_changed");
      setSavePhase("server");
      setSubmissionMessage("Signature approved. Waiting for the server to confirm your saved score...");
      const saved = await submitArboristTrialResult({
        challengeId: runChallenge.id,
        wallet: runWallet,
        playerMoves: battle.allPlayerMoves,
        replayVersion: battle.trialEngine,
        signature: proof.signature,
      });
      if (!saved.ok || !saved.recorded || !saved.result) throw new Error("save_not_confirmed");
      markSaved(saved.result.score);
      setSaveReceipt({ rank: saved.result.rank, total: saved.leaderboardTotal, badges: saved.newAchievements ?? [] });
      if (currentAddressRef.current === runWallet) setToday((current) => current?.challenge.id === runChallenge.id ? {
        ...current, result: saved.result, rankedAttemptUsed: true, streak: saved.streak,
        leaderboardTotal: saved.leaderboardTotal ?? current.leaderboardTotal,
        achievements: saved.achievements ?? current.achievements,
      } : current);
      await loadToday();
    } catch (reason) {
      submittedBattleRef.current = null;
      // A response can be lost after the server commits the result. Check before
      // asking for another signature; never infer success from the wallet alone.
      let confirmed = false;
      try {
        const latest = await fetchTodayArboristTrial(runWallet);
        if (latest.challenge.id === runChallenge.id && latest.rankedAttemptUsed && latest.result
          && latest.result.wallet.toLowerCase() === runWallet.toLowerCase()) {
          markSaved(latest.result.score, true);
          // An ambiguous response confirms saved state, not a new badge event.
          setSaveReceipt({ rank: latest.result.rank, total: latest.leaderboardTotal, badges: [] });
          if (currentAddressRef.current === address) setToday(latest);
          confirmed = true;
        }
      } catch { /* Keep the result available for an explicit retry. */ }
      if (!confirmed) setSubmissionMessage(trialSaveError(reason));
    } finally {
      setSubmitting(false);
      setSavePhase(null);
    }
  };

  const rounds = battle ? Math.ceil(battle.totalTurns / 2) : 0;
  const result = useMemo(
    () => battle?.finished && activeChallenge ? getArboristTrialResult(battle, activeChallenge) : null,
    [battle, activeChallenge],
  );
  const lastBotMove = [...log].reverse().find((entry) => entry.actor === "opponent");
  const diagnosisForecast = battle && activeChallenge
    ? getCanopyDiagnosisForecast(battle, activeChallenge)
    : null;
  const toolbeltLockedMoves = battle && activeChallenge
    ? getToolbeltLockedMoveIds(battle, activeChallenge)
    : new Set<number>();

  return (
    <div className="gb-trials-page">
      <header className="gb-trials-header">
        <Link href="/battle" className="gb-trials-back" onClick={(event) => { if (!confirmLeaving()) event.preventDefault(); }}><ArrowLeft size={17} /> Garden Battles</Link>
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
            <div className="gb-trials-streak" aria-label="Daily check-ins and Trial win streak">
              <span title="Every saved official ranked Trial counts as one daily check-in.">
                <CalendarDays size={22} />
                <small>DAILY CHECK-INS</small>
                <strong>{today?.totalCheckIns ?? 0}</strong>
                <em>{today?.checkInStreak ?? 0}-day current streak</em>
              </span>
              <span title="Consecutive UTC days with a saved official Trial win.">
                <Flame size={22} />
                <small>WIN STREAK</small>
                <strong>{today?.streak ?? 0}</strong>
                <em>consecutive Trial wins</em>
              </span>
            </div>
          </div>
        </section>

        {today && <nav className="gb-trials-progression-nav" aria-label="Trials sections">
          <a href="#trial-gameplay">{battle ? "Gameplay" : "Today’s Trial"}</a>
          <a href="#trial-leaderboard">Daily leaderboard</a>
          <a href="#trial-achievements">Achievements</a>
        </nav>}

        {loading && <section className="gb-trials-message">Preparing today’s trial...</section>}
        {error && <section className="gb-trials-message gb-trials-message-error">{error}</section>}
        {localPreview && <section className="gb-trials-message gb-trials-message-preview">Preview mode: gameplay and layout are live; official scores and streaks remain disabled until the ranked server is deployed.</section>}

        {today && !battle && (
          <>
            <section id="trial-gameplay" className="gb-trials-briefing">
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
                <span className="gb-trials-fifth-rule">
                  <b>Fifth card</b>
                  {fifthUnlocked
                    ? "Unlocked · 1,000,000 TREE verified"
                    : fifthMoveAccess === "unavailable" || fifthMoveAccess === "verification-incomplete"
                      ? "Verification unavailable · retry before starting"
                      : <Link className="gb-trials-unlock-fifth" href="/battle/garden-bot?unlock=fifth-card">Unlock Fifth Card</Link>}
                </span>
                <span><b>Special rule</b> {today.challenge.ruleDescription}</span>
              </div>
              <div className="gb-trials-start-actions">
                <button
                  type="button"
                  className="gb-trials-primary"
                  disabled={startingTrial || localPreview || !address || !rankedEligible || today.rankedAttemptUsed}
                  onClick={() => void startTrial(true)}
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
                            : startingTrial ? "Verifying Benefits…" : "Start Ranked Attempt"}
                </button>
                <button type="button" className="gb-trials-secondary" disabled={startingTrial} onClick={() => void startTrial(false)}>
                  {startingTrial ? "Verifying Benefits…" : "Practice Today’s Trial"}
                </button>
              </div>
              {address && fifthMoveAccess === "not-qualified" && (
                <section className="gb-trials-inline-lock" aria-label="Unlock the Arborist Trials fifth card">
                  <div>
                    <small>FIFTH-CARD ACCESS</small>
                    <h3>Unlock your fifth card here</h3>
                    <p>Lock 1,000,000 liquid TREE for 30 days. The TREE stays in your wallet-owned lock, earns no rewards, and can be withdrawn when the lock ends.</p>
                  </div>
                  <TreeLockControl
                    address={address}
                    onEligibilityChange={(eligibility) => {
                      setToday((current) => current ? {
                        ...current,
                        fifthMoveAccess: eligibility.status,
                        fifthMoveUnlocked: eligibility.status === "qualified",
                      } : current);
                    }}
                  />
                </section>
              )}
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
              <p className="gb-trials-save-explainer">Finish → Sign &amp; Save Score → Get your daily check-in. This is a free message signature, not a payment. Only saved official Trials count; the win streak counts consecutive UTC days, not matches.</p>
            </section>

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

          </>
        )}

        {today && battle && activeChallenge && (
          <section id="trial-gameplay" className="gb-trials-arena">
            <div className="gb-trials-live-heading">
              <div><small>{rankedRun ? "OFFICIAL DAILY RUN" : "UNRANKED PRACTICE"}</small><h2>{activeChallenge.title}</h2></div>
              <span>Round {Math.max(1, rounds)}</span>
            </div>
            {rankedRun && !battle.finished && <p className="gb-trials-save-explainer">At the end, tap Sign &amp; Save Score and approve a free message in your wallet. Your check-in counts only after the server confirms it.</p>}
            {rankedRun && battle.finished && (
              <section ref={savePanelRef} tabIndex={-1} className={`gb-trials-save-panel${scoreSaved ? " gb-trials-save-panel-saved" : ""}`} aria-labelledby="trial-save-title">
                <div role="status" aria-live="polite">
                  <h2 id="trial-save-title">{scoreSaved ? "Official score saved" : submitting ? (savePhase === "server" ? "Saving your score…" : "Approve in your wallet") : "Trial complete — score not saved"}</h2>
                  <p>{scoreSaved ? "Your official result counts toward the daily leaderboard and achievements below." : "One step left: sign a free message to record your official score and daily check-in. No SUI or TREE is spent."}</p>
                  {submissionMessage && <p>{submissionMessage}</p>}
                  {wrongWallet && !scoreSaved && <p>Reconnect {shortWallet(runWallet!)} to save this run. The connected wallet is different.</p>}
                </div>
                {!scoreSaved && <button type="button" className="gb-trials-primary" disabled={submitting || wrongWallet || !address} onClick={() => void submitRankedScore()}><ShieldCheck size={20} />{submitting ? (savePhase === "server" ? "Confirming save…" : "Waiting for wallet…") : "Sign & Save Score"}</button>}
                {scoreSaved && saveReceipt && <div className="gb-trials-save-receipt" role="status">
                  <strong>{saveReceipt.rank ? `Daily rank at save: #${saveReceipt.rank}${saveReceipt.total ? ` of ${saveReceipt.total}` : ""}` : "Score saved — refresh standings for your rank."}</strong>
                  {saveReceipt.badges.length > 0 ? <><p>New achievements unlocked</p><ul>{saveReceipt.badges.map((id) => <li key={id}>{TRIAL_BADGES[id]?.title ?? id}</li>)}</ul></> : <p>View your earned badges and next milestone below.</p>}
                  <a href="#trial-leaderboard">View leaderboard</a> · <a href="#trial-achievements">View achievements</a>
                </div>}
              </section>
            )}
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
                  <small>{activeChallenge.rule === "toolbelt_rotation"
                    ? "Use all four standard cards to reset your Toolbelt. The fifth move stays separate."
                    : activeChallenge.rule === "integrated_pest_management"
                      ? "Win with two or fewer Attack plays for the full IPM bonus."
                      : activeChallenge.rule === "storm_response"
                        ? "Storm damage strikes both trees after every third completed round."
                        : "The same card cannot be played twice in a row."}</small>
                </div>
                <div className="gb-trials-move-grid">
                  {battle.player1Moves.map((moveId, index) => {
                    const usedLast = battle.playerMoveHistory.at(-1) === moveId;
                    const toolLocked = toolbeltLockedMoves.has(moveId);
                    const fifth = index === 4;
                    return (
                      <button key={moveId} type="button" className={`gb-trial-move-card${fifth ? " gb-trial-move-card-fifth" : ""}`} disabled={isArboristTrialMoveDisabled(battle, activeChallenge, moveId)} onClick={() => playMove(moveId)}>
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
                <button type="button" disabled={submitting || startingTrial} onClick={() => void startTrial(false)}><RotateCcw size={16} /> Practice Again</button>
                <button type="button" disabled={submitting} onClick={() => { if (confirmLeaving()) setBattle(null); }}>Return to Daily Board</button>
              </div>
            )}

            <section className="gb-trials-log"><div className="gb-trials-section-heading"><span>📜</span><div><small>COUNTER INTELLIGENCE</small><h2>Battle Log</h2></div></div><BattleLog entries={log} isPlayer1 opponentLabel="Garden Bot" /></section>
          </section>
        )}
        {today && todayWalletRef.current === address && <>
          <TrialLeaderboard today={today} address={address} names={suiNames} refreshing={loading} onRefresh={() => void loadToday()} />
          <div id="trial-achievements" className="gb-trials-progress-row">
            <TrialAchievements achievements={today.achievements} connected={!!address} />
            <TrialCheckInMeter connected={!!address} checkInStreak={today.checkInStreak} todayCheckedIn={today.rankedAttemptUsed} />
          </div>
        </>}
      </main>
    </div>
  );
}
