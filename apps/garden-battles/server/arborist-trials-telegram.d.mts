export const TRIAL_URL: string;
export const TRIAL_COMPLETIONS_SQL: string;
export function trialRecord(row: any): any;
export function trialCompletionMessage(row: any): {text: string; reply_markup: any};
export function pollTrialCompletions(options: any): Promise<void>;
