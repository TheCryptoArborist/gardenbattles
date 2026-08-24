import { Check, Flame, WalletCards } from "lucide-react";
import type { ArboristTrialTodayResponse } from "@/lib/api";

type Props = {
  checkIns?: ArboristTrialTodayResponse["checkIns"];
  connected: boolean;
  streak?: number;
  compact?: boolean;
};

function dayLabel(date: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" })
    .format(new Date(`${date}T12:00:00.000Z`))
    .slice(0, 2);
}

export default function TrialCheckInMeter({ checkIns = [], connected, streak = 0, compact = false }: Props) {
  const completed = checkIns.filter((day) => day.completed).length;
  const displayDays = checkIns.length
    ? checkIns
    : Array.from({ length: 7 }, (_, index) => ({ date: "", completed: false, won: false, index }));
  return (
    <section className={`gb-trial-checkin${compact ? " gb-trial-checkin-compact" : ""}`} aria-label="Seven-day Arborist Trials check-in meter">
      <div className="gb-trial-checkin-head">
        <span><Flame size={compact ? 14 : 17} /> Wallet Check-In</span>
        <strong>{connected ? `${completed}/7 days · ${streak} day streak` : "Connect wallet to track"}</strong>
      </div>
      <div className="gb-trial-checkin-days">
        {displayDays.map((day, index) => (
          <span
            className={`${day.completed ? "is-complete" : ""}${index === displayDays.length - 1 ? " is-today" : ""}`}
            key={day.date || index}
            title={day.date ? `${day.date}: ${day.completed ? "official trial completed" : "not checked in"}` : "Check-in pending"}
          >
            <small>{day.date ? dayLabel(day.date) : "--"}</small>
            <i>{day.completed ? <Check size={compact ? 12 : 15} strokeWidth={3} /> : index + 1}</i>
          </span>
        ))}
        {!connected && <span className="gb-trial-checkin-connect"><WalletCards size={16} /> Connect to save daily check-ins</span>}
      </div>
      {!compact && <p>Complete one official ranked Trial each day to fill the meter. Practice runs do not count.</p>}
    </section>
  );
}
