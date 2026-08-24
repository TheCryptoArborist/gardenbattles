import { Flame, WalletCards } from "lucide-react";

type Props = {
  connected: boolean;
  checkInStreak?: number;
  todayCheckedIn?: boolean;
  compact?: boolean;
};

function boundedProgress(value: number | undefined, maximum: number) {
  return Math.min(maximum, Math.max(0, Number.isFinite(value) ? Math.floor(value ?? 0) : 0));
}

export default function TrialCheckInMeter({ connected, checkInStreak = 0, todayCheckedIn = false, compact = false }: Props) {
  const sevenDayProgress = boundedProgress(checkInStreak, 7);
  const thirtyDayProgress = boundedProgress(checkInStreak, 30);
  return (
    <section className={`gb-trial-checkin${compact ? " gb-trial-checkin-compact" : ""}`} aria-label="Arborist Trials wallet check-in progress">
      <div className="gb-trial-checkin-head">
        <span><Flame size={compact ? 14 : 17} /> Wallet Check-In</span>
        <strong>{connected ? `${checkInStreak} day streak` : "Connect wallet to track"}</strong>
      </div>
      <div className="gb-trial-checkin-track">
        <div className="gb-trial-checkin-track-head"><strong>7-Day Check-In</strong><span>{sevenDayProgress}/7</span></div>
        <div className="gb-trial-seven-steps">
          {Array.from({ length: 7 }, (_, index) => {
            const day = index + 1;
            return <span className={day <= sevenDayProgress ? "is-complete" : ""} key={day} aria-label={`Day ${day}${day <= sevenDayProgress ? " complete" : ""}`}>{day}</span>;
          })}
        </div>
      </div>
      <div className="gb-trial-checkin-track gb-trial-checkin-thirty">
        <div className="gb-trial-checkin-track-head"><strong>30-Day Check-In</strong><span>{thirtyDayProgress}/30</span></div>
        <div className="gb-trial-thirty-steps" aria-label={`${thirtyDayProgress} of 30 daily check-ins complete`}>
          {Array.from({ length: 30 }, (_, index) => <i className={index < thirtyDayProgress ? "is-complete" : ""} key={index} />)}
        </div>
        {!compact && <div className="gb-trial-thirty-milestones"><span>1</span><span>7</span><span>14</span><span>21</span><span>30</span></div>}
      </div>
      {connected ? (
        !compact && <p className="gb-trial-checkin-status">{todayCheckedIn ? "Today’s official NFTree check-in is complete." : "Complete today’s official NFTree-gated Trial to continue your streak. Practice runs do not count."}</p>
      ) : (
        <span className="gb-trial-checkin-connect"><WalletCards size={16} /> Connect to save daily check-ins</span>
      )}
    </section>
  );
}
