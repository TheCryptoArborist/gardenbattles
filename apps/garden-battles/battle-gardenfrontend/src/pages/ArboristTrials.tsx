import { useEffect, useMemo, useRef, useState } from "react";
import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import { ArrowLeft, CalendarDays, Flame, RotateCcw, ShieldCheck, Trophy } from "lucide-react";
import { Link } from "wouter";
import BattleLog, { type ActionEntry } from "@/components/BattleLog";
import MoveCardFace from "@/components/MoveCardFace";
import {
  fetchTodayArboristTrial,
  submitArboristTrialResult,
  type ArboristTrialTodayResponse,
} from "@/lib/api";
import { appAsset } from "@/lib/assets";
import { getBattleTreeAssetPath, resolveGrowthStage } from "@/lib/battleTreeArtwork";
import {
  createArboristTrialBattle,
  getArboristTrialResult,
} from "@/lib/arboristTrials";
import { playPracticeRound, type PracticeBattle } from "@/lib/practiceBattle";
import { useFifthMoveEligibility } from "@/hooks/useFifthMoveEligibility";
import "@/arborist-trials.css";

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
  const address = account?.address ?? null;
  const eligibility = useFifthMoveEligibility(address);
  const [today, setToday] = useState<ArboristTrialTodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [battle, setBattle] = useState<PracticeBattle | null>(null);
  const [log, setLog] = useState<ActionEntry[]>([]);
  const [rankedRun, setRankedRun] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(null);
  const submittedBattleRef = useRef<string | null>(null);

  const loadToday = async () => {
    setLoading(true);
    setError(null);
    try {
      setToday(await fetchTodayArboristTrial(address));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Today’s trial could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadToday(); }, [address]);

  const fifthUnlocked = eligibility.status === "qualified";
  const startTrial = (ranked: boolean) => {
    if (!today) return;
    setBattle(createArboristTrialBattle(today.challenge, fifthUnlocked));
    setLog([]);
    setRankedRun(ranked);
    setSubmissionMessage(null);
    submittedBattleRef.current = null;
  };

  const playMove = (moveId: number) => {
    if (!battle || battle.finished) return;
    try {
      const result = playPracticeRound(battle, moveId);
      setBattle(result.battle);
      setLog((entries) => [...entries, ...result.entries]);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That move could not be played.");
    }
  };

  useEffect(() => {
    if (!battle?.finished || !rankedRun || !address || !today) return;
    if (submittedBattleRef.current === battle.battleId) return;
    submittedBattleRef.current = battle.battleId;
    const result = getArboristTrialResult(battle);
    setSubmitting(true);
    void submitArboristTrialResult({
      challengeId: today.challenge.id,
      wallet: address,
      ...result,
    })
      .then((saved) => {
        setSubmissionMessage(`Ranked score saved: ${saved.result.score.toLocaleString()} points.`);
        return loadToday();
      })
      .catch((reason) => {
        setSubmissionMessage(reason instanceof Error ? reason.message : "The ranked score could not be saved.");
      })
      .finally(() => setSubmitting(false));
  }, [battle?.finished, battle?.battleId, rankedRun, address, today?.challenge.id]);

  const rounds = battle ? Math.ceil(battle.totalTurns / 2) : 0;
  const result = useMemo(() => battle?.finished ? getArboristTrialResult(battle) : null, [battle]);
  const lastBotMove = [...log].reverse().find((entry) => entry.actor === "opponent");

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
            <h1>Arborist Trials</h1>
            <p>One shared challenge. One ranked score per wallet each day. Unlimited practice after your official run.</p>
          </div>
          <div className="gb-trials-streak"><Flame size={27} /><span><strong>{today?.streak ?? 0}</strong> day streak</span></div>
        </section>

        {loading && <section className="gb-trials-message">Preparing today’s trial...</section>}
        {error && <section className="gb-trials-message gb-trials-message-error">{error}</section>}

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
              </div>
              <div className="gb-trials-start-actions">
                <button
                  type="button"
                  className="gb-trials-primary"
                  disabled={!address || today.rankedAttemptUsed}
                  onClick={() => startTrial(true)}
                >
                  <ShieldCheck size={18} />
                  {!address ? "Connect for Ranked Attempt" : today.rankedAttemptUsed ? "Ranked Attempt Complete" : "Start Ranked Attempt"}
                </button>
                <button type="button" className="gb-trials-secondary" onClick={() => startTrial(false)}>
                  Practice Today’s Trial
                </button>
              </div>
              {today.result && <p className="gb-trials-saved-score">Today’s official score: <strong>{today.result.score.toLocaleString()}</strong></p>}
            </section>

            <section className="gb-trials-leaderboard">
              <div className="gb-trials-section-heading"><Trophy size={20} /><div><small>TODAY’S CANOPY</small><h2>Daily Leaders</h2></div></div>
              {today.leaderboard.length === 0 ? <p>Be the first wallet to complete today’s ranked trial.</p> : (
                <ol>{today.leaderboard.slice(0, 10).map((entry) => (
                  <li key={entry.wallet}><b>#{entry.rank}</b><span>{shortWallet(entry.wallet)}</span><strong>{entry.score.toLocaleString()}</strong><small>{entry.rounds} rounds</small></li>
                ))}</ol>
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

            {!battle.finished ? (
              <div className="gb-trials-hand">
                <div className="gb-trials-hand-heading"><span>Choose your move</span><small>The same card cannot be played twice in a row.</small></div>
                <div className="gb-trials-move-grid">
                  {battle.player1Moves.map((moveId, index) => {
                    const usedLast = battle.playerMoveHistory.at(-1) === moveId;
                    const fifth = index === 4;
                    return (
                      <button key={moveId} type="button" className={`gb-trial-move-card${fifth ? " gb-trial-move-card-fifth" : ""}`} disabled={usedLast} onClick={() => playMove(moveId)}>
                        {fifth && <span className="gb-trial-fifth-banner">BONUS FIFTH MOVE</span>}
                        <MoveCardFace moveId={moveId} isFifth={fifth} />
                        {usedLast && <span className="gb-trial-used-last">Used last round</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className={`gb-trials-result ${result?.won ? "gb-trials-result-win" : "gb-trials-result-loss"}`}>
                <Trophy size={34} />
                <div><small>TRIAL COMPLETE</small><h2>{result?.won ? "Canopy Conquered" : "Garden Bot Held the Grove"}</h2><p>{rounds} rounds · {battle.player1Growth}–{battle.player2Growth} final Growth</p>{submissionMessage && <strong>{submitting ? "Saving ranked score..." : submissionMessage}</strong>}</div>
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
