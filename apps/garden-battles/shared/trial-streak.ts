export function dailyTrialWinStreak(history: ReadonlyArray<{ challenge_date: string; won: number }>, today: string): number {
  const previousDay = (date: string) => {
    const value = new Date(`${date}T12:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() - 1);
    return value.toISOString().slice(0, 10);
  };
  // Yesterday's streak remains active until today's opportunity has passed.
  let expected = history[0]?.challenge_date === today ? today : previousDay(today);
  let streak = 0;
  for (const row of history) {
    if (row.challenge_date !== expected || row.won !== 1) break;
    streak += 1;
    expected = previousDay(expected);
  }
  return streak;
}
