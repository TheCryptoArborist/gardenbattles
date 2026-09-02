import React from "react";
import { Trophy } from "lucide-react";
import type { ArboristTrialTodayResponse } from "@/lib/api";

const shortWallet = (wallet: string) => `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;

export default function TrialLeaderboard({ today, address, names, refreshing, onRefresh }: {
  today: ArboristTrialTodayResponse;
  address: string | null;
  names: Record<string, string | null>;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const own = today.result?.wallet.toLowerCase() === address?.toLowerCase() ? today.result : null;
  return (
    <section id="trial-leaderboard" className="gb-trials-leaderboard" aria-labelledby="trial-leaders-title">
      <div className="gb-trials-leaderboard-head">
        <div className="gb-trials-section-heading"><Trophy size={22} /><div><small>{today.challenge.date} · UTC</small><h2 id="trial-leaders-title">Daily Leaders</h2></div></div>
        <button type="button" className="gb-trials-refresh" disabled={refreshing} onClick={onRefresh}>{refreshing ? "Refreshing…" : "Refresh standings"}</button>
      </div>
      <p>Official Trials only. Wins first, then score, fewer rounds, and earliest save. Standings can change until the day ends.</p>
      <div className="gb-trials-own-standing" role="status">
        <strong>Your daily standing</strong>
        {!address ? <span>Connect your wallet to see your rank and achievements.</span>
          : own ? <span>{own.rank ? `#${own.rank}${today.leaderboardTotal ? ` of ${today.leaderboardTotal}` : ""}` : "Rank updating"} · {own.score.toLocaleString()} points · {own.rounds} rounds · {own.won ? "Win" : "Completed"}</span>
            : <span>Not ranked yet — finish and sign to save an official Trial. Practice does not count.</span>}
      </div>
      {!today.leaderboard.length ? <p>No saved results yet. Be the first on today’s board.</p> : (
        <ol>{today.leaderboard.slice(0, 10).map((entry, index) => {
          const rank = entry.rank ?? index + 1;
          const wallet = entry.wallet.toLowerCase();
          const name = names[wallet];
          const ownRow = wallet === address?.toLowerCase();
          return <li key={wallet} className={`${rank <= 3 ? `gb-trials-leader-rank-${rank}` : ""}${ownRow ? " gb-trials-leader-current" : ""}`}>
            <b>#{rank}</b>
            <span className="gb-trials-leader-identity" title={entry.wallet}>
              <strong>{name || shortWallet(entry.wallet)}</strong>
              <small>{entry.won ? "Win" : "Completed"}{name ? ` · ${shortWallet(entry.wallet)}` : ""}</small>
              {ownRow && <em>YOU</em>}
            </span>
            <span className="gb-trials-leader-score"><strong>{entry.score.toLocaleString()}</strong><small>points</small></span>
            <span className="gb-trials-leader-rounds"><strong>{entry.rounds}</strong><small>rounds</small></span>
          </li>;
        })}</ol>
      )}
      <p className="gb-trials-achievement-note">Showing the top 10{today.leaderboardTotal !== undefined ? ` of ${today.leaderboardTotal} saved runs` : ""}. Your standing is always shown above, even outside the top 10. Separate from Garden Bot and PvP rankings.</p>
    </section>
  );
}
