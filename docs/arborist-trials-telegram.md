# Arborist Trials Telegram completions

Source: the existing internal arborist_trial_results SQLite table used by the production results route. Saves require a valid wallet signature, current daily challenge, server replay, and NFTree access. The table has one result per challenge and wallet; practice does not write to it. No score-submission logic or player UI changes.

Read all saved participants with a bounded timestamp and challenge/wallet key cursor, independent of the public top-25 leaderboard. Individual notifications poll every 30 seconds in the existing @NFTreeHolderBot worker and use the existing chat/topic and primary SuiNS resolver. Wins and losses show score, challenge date (UTC), rounds, both growth totals, unique move count, and a Play Arborist Trials button. No borrowed game artwork is used. Existing mint, sale, game images, and PvP alerts remain intact.

Forward tracking starts at activation; individual history is skipped. The persisted completion cursor advances only after delivery. As with the other individual alerts, an ambiguous network timeout may be retried; the database prevents duplicate submissions and ordinary restart/retry processing does not duplicate delivered results. No production results are fabricated to test alerts. A clearly labeled activation notice verifies Telegram delivery.

Weekly collection reads the table using its own cursor, independent of individual delivery. Ranked scores use each player's best weekly result (score descending, earliest completion then stable wallet fingerprint for ties), with top three, result/rounds/date, total ranked trials, players and wins. Coverage start is labeled on the first partial week. A source outage is flagged rather than treated as zero participation. Sunday 19:00 America/Chicago schedule is unchanged. No prize eligibility is created.

Persistence uses the configured GARDEN_BATTLES_DB_PATH and existing mode-0600 notification state on the attached Railway volume. No new tables, migrations, public endpoints, secrets or environment changes.

Validation: 57 notifier tests passed, including seven new tests using an in-memory SQLite database for 205 tied-timestamp participants, duplicate inserts, baseline/history exclusion, delivery retry/restart, win/loss formatting and SuiNS, invalid data, database outage, and weekly collection while individual delivery fails. Deployment must show SUCCESS and the Arborist Trials activation-delivered runtime log before completion is reported.
