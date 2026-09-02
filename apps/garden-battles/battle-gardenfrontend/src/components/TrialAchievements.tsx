import React from "react";
import { Award, CalendarCheck2, Crown, Gauge, LockKeyhole, ShieldCheck, Sprout, Wrench } from "lucide-react";
import type { ArboristTrialTodayResponse } from "@/lib/api";

type BadgeDefinition = {
  title: string;
  description: string;
  icon: typeof Award;
  tone: string;
};

export const TRIAL_BADGES: Record<string, BadgeDefinition> = {
  first_checkin: { title: "First Day on the Crew", description: "Submit your first official Trial.", icon: Sprout, tone: "green" },
  canopy_conqueror: { title: "Canopy Conqueror", description: "Win your first official Trial.", icon: Crown, tone: "gold" },
  steady_hands: { title: "Steady Hands", description: "Check in three days in a row.", icon: CalendarCheck2, tone: "teal" },
  toolbelt_tactician: { title: "Toolbelt Tactician", description: "Win using at least four different cards.", icon: Wrench, tone: "orange" },
  speed_pruner: { title: "Speed Pruner", description: "Win an official Trial in eight rounds or fewer.", icon: Gauge, tone: "red" },
  perfect_week: { title: "Perfect Week", description: "Check in seven days in a row.", icon: ShieldCheck, tone: "violet" },
  thirty_checkins: { title: "Seasoned Arborist", description: "Save official Trials on 30 different days. Gaps are welcome.", icon: CalendarCheck2, tone: "gold" },
  master_arborist: { title: "Master Arborist", description: "Build a 30-day winning streak.", icon: Award, tone: "legendary" },
};

export default function TrialAchievements({ achievements = [], connected }: { achievements?: ArboristTrialTodayResponse["achievements"]; connected: boolean }) {
  const display = achievements.length
    ? achievements
    : Object.keys(TRIAL_BADGES).map((id) => ({ id, earned: false, progress: 0, target: id === "steady_hands" ? 3 : id === "perfect_week" ? 7 : ["master_arborist", "thirty_checkins"].includes(id) ? 30 : 1 }));
  const earned = display.filter((badge) => badge.earned).length;
  const next = display.filter((badge) => !badge.earned).sort((a, b) => b.progress / b.target - a.progress / a.target)[0];
  return (
    <section className="gb-trials-achievements" aria-labelledby="trial-achievements-title">
      <header>
        <div><small>CAREER MILESTONES</small><h2 id="trial-achievements-title">Arborist Achievements</h2></div>
        <strong>{connected ? `${earned} / ${display.length} earned` : "Connect wallet to begin"}</strong>
      </header>
      {connected && next && <p className="gb-trials-next-badge">Next milestone: <strong>{TRIAL_BADGES[next.id]?.title ?? next.id}</strong> · {next.progress} / {next.target}. {TRIAL_BADGES[next.id]?.description}</p>}
      {connected && !next && <p className="gb-trials-next-badge">All Arborist achievements earned!</p>}
      <div className="gb-trials-badge-grid">
        {display.map((badge) => {
          const definition = TRIAL_BADGES[badge.id] ?? { title: badge.id, description: "Complete the requirement to earn this badge.", icon: Award, tone: "green" };
          const Icon = definition.icon;
          return (
            <article className={`gb-trials-badge gb-trials-badge-${definition.tone}${badge.earned ? " is-earned" : ""}`} key={badge.id} title={definition.title}>
              <span className="gb-trials-badge-icon">{badge.earned ? <Icon size={25} /> : <LockKeyhole size={20} />}</span>
              <div><strong>{definition.title}</strong><p>{definition.description}</p></div>
              <span className="gb-trials-badge-progress">{badge.earned ? "Earned" : `${badge.progress}/${badge.target}`}</span>
              <progress className="gb-trials-badge-meter" value={badge.progress} max={badge.target} aria-label={`${definition.title} progress`} />
            </article>
          );
        })}
      </div>
      <p className="gb-trials-achievement-note">Only signed official runs count. Badges stay with this wallet; practice is always available for training.</p>
    </section>
  );
}
