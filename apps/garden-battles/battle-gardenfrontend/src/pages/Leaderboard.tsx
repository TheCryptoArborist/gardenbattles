import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import { Award, ChevronDown, Crown, Medal, RefreshCw, Swords, Trophy } from "lucide-react";
import {
  fetchLeaderboard,
  fetchPlayerStats,
  type LeaderboardEntry,
  type LeaderboardMode,
  type PlayerStats,
} from "@/lib/api";
import ForestPower from "@/components/ForestPower";
import PlayerRecord from "@/components/PlayerRecord";
import TreeBadgeCrest from "@/components/TreeBadgeCrest";
import { appAsset } from "@/lib/assets";
import {
  formatRecord,
  formatStreak,
  formatWinRate,
  getDisplayRankTitle,
  getEarnedBadgeDisplay,
  getEmptyModeMessage,
  getModeLabel,
  getPlayerRecordHeading,
  getPvpTargetMixItems,
  getRankProgress,
  isConnectedWallet,
  orderPodiumForDesktop,
  selectTopPlayers,
} from "@/lib/leaderboardPresentation";

const BADGE_LABELS: Record<string, string> = {
  first_blood: "First Blood",
  hot_streak: "Hot Streak",
  undefeated: "Undefeated",
  battle_hardened: "Battle Hardened",
  veteran: "Veteran",
  legend: "Legend",
  sharp_pruner: "Sharp Pruner",
  never_give_up: "Never Give Up",
  social_butterfly: "Social Butterfly",
};

const BADGE_GUIDE = [
  { id: "first_blood", description: "Win your first recorded battle." },
  { id: "hot_streak", description: "Reach a five-win streak." },
  { id: "undefeated", description: "Reach a ten-win streak." },
  { id: "battle_hardened", description: "Complete 100 recorded battles." },
  { id: "veteran", description: "Earn 50 recorded wins." },
  { id: "legend", description: "Earn 100 recorded wins." },
  { id: "sharp_pruner", description: "Maintain at least a 70% win rate after 10 battles." },
  { id: "never_give_up", description: "Keep battling through 50 matches with a win rate below 30%." },
  { id: "social_butterfly", description: "Battle 10 different opponents." },
] as const;

const SUINS_CACHE_PREFIX = "garden-battles:suins:v3:";
const suinsNameCache = new Map<string, string | null>();
const SUI_GRAPHQL_URL = "https://graphql.mainnet.sui.io/graphql";

const LEADERBOARD_MODES: Array<{
  id: LeaderboardMode;
  label: string;
}> = [
  { id: "pvp", label: "PvP Battle" },
  { id: "bot", label: "Garden Bot" },
  { id: "overall", label: "Overall" },
];

function getBattleRankClass(rankTitle: string): string {
  return `gb-battle-rank-${rankTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function readCachedSuiName(address: string): string | null | undefined {
  const normalizedAddress = address.toLowerCase();
  if (suinsNameCache.has(normalizedAddress)) {
    return suinsNameCache.get(normalizedAddress) ?? null;
  }

  try {
    const stored = window.sessionStorage.getItem(`${SUINS_CACHE_PREFIX}${normalizedAddress}`);
    if (stored === null) return undefined;
    if (!stored) return undefined;
    const value = stored;
    suinsNameCache.set(normalizedAddress, value);
    return value;
  } catch {
    return undefined;
  }
}

function writeCachedSuiName(address: string, name: string | null) {
  const normalizedAddress = address.toLowerCase();
  if (name) suinsNameCache.set(normalizedAddress, name);
  else suinsNameCache.delete(normalizedAddress);

  try {
    if (name) window.sessionStorage.setItem(`${SUINS_CACHE_PREFIX}${normalizedAddress}`, name);
    else window.sessionStorage.removeItem(`${SUINS_CACHE_PREFIX}${normalizedAddress}`);
  } catch {
    // sessionStorage can be unavailable in strict privacy contexts.
  }
}

async function resolveSuiNames(addresses: string[]): Promise<Record<string, string | null>> {
  const resolved: Record<string, string | null> = {};
  for (let offset = 0; offset < addresses.length; offset += 25) {
    const batch = addresses.slice(offset, offset + 25);
    const variableDefinitions = batch.map((_, index) => `$address${index}: SuiAddress!`).join(", ");
    const selections = batch
      .map((_, index) => `address${index}: address(address: $address${index}) { defaultNameRecord { domain } }`)
      .join("\n");
    const variables = Object.fromEntries(batch.map((address, index) => [`address${index}`, address]));
    try {
      const response = await fetch(SUI_GRAPHQL_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: `query LeaderboardSuiNames(${variableDefinitions}) { ${selections} }`, variables }),
      });
      const payload = await response.json();
      for (let index = 0; index < batch.length; index += 1) {
        const address = batch[index];
        const name = payload?.data?.[`address${index}`]?.defaultNameRecord?.domain || null;
        resolved[address] = name;
        writeCachedSuiName(address, name);
      }
    } catch {
      for (const address of batch) resolved[address] = null;
    }
  }
  return resolved;
}

function formatLastPlayed(value: number | null | undefined): string {
  if (!value) return "Not yet";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function streakClass(value: number): string {
  if (value > 0) return "gb-leaderboard-positive";
  if (value < 0) return "gb-leaderboard-negative";
  return "gb-leaderboard-muted";
}

function resultLabel(result: "Win" | "Loss" | null | undefined): string {
  if (result === "Win") return "W";
  if (result === "Loss") return "L";
  return "-";
}

function PlayerIdentity({
  address,
  isMe,
  suinsName,
}: {
  address: string;
  isMe: boolean;
  suinsName: string | null | undefined;
}) {
  const shortAddress = shortenAddress(address);
  const displayName = suinsName || shortAddress;

  return (
    <span
      className={`gb-leaderboard-player-identity ${suinsName ? "gb-leaderboard-player-identity-suins" : ""}`}
      title={suinsName ? `${suinsName} (${shortAddress})` : address}
    >
      <span className="gb-leaderboard-player-primary">
        <span className="gb-leaderboard-player-name-text">{displayName}</span>
        {isMe && <span className="gb-leaderboard-player-you">YOU</span>}
      </span>
      {suinsName && (
        <span className="gb-leaderboard-player-secondary">{shortAddress}</span>
      )}
    </span>
  );
}

function BadgeChips({ badges }: { badges: string[] }) {
  const display = getEarnedBadgeDisplay(badges);
  if (display.visible.length === 0) {
    return <span className="gb-leaderboard-no-badges">No badges yet</span>;
  }

  return (
    <span className="gb-leaderboard-badges">
      {display.visible.map((badge) => (
        <span
          className="gb-leaderboard-badge-chip"
          key={badge}
          title={BADGE_LABELS[badge] || badge}
        >
          {BADGE_LABELS[badge] || badge.replace(/_/g, " ")}
        </span>
      ))}
      {display.overflow > 0 && (
        <span className="gb-leaderboard-badge-chip" title={`${display.overflow} more earned badges`}>
          +{display.overflow}
        </span>
      )}
    </span>
  );
}

function PvpTargetMix({
  counts,
  compact = false,
}: {
  counts: LeaderboardEntry["pvp_target_counts"] | PlayerStats["pvp_target_counts"];
  compact?: boolean;
}) {
  const items = getPvpTargetMixItems(counts);
  if (items.length === 0) return null;

  return (
    <div className={`gb-leaderboard-target-mix ${compact ? "gb-leaderboard-target-mix-compact" : ""}`}>
      {!compact && <span className="gb-leaderboard-target-mix-label">Match Mix</span>}
      <span className="gb-leaderboard-target-mix-items">
        {items.map((item) => (
          <span key={item.label}>
            <strong>{item.value}</strong>
            {item.label}
          </span>
        ))}
      </span>
    </div>
  );
}

function RankBadge({ entry, compact = false }: { entry: Pick<LeaderboardEntry | PlayerStats, "rank_title" | "ranked" | "total_battles">; compact?: boolean }) {
  const rankTitle = getDisplayRankTitle(entry);
  const isProvisional = entry.ranked === false || entry.total_battles < 3;
  return (
    <span className={`gb-leaderboard-rank-badge ${getBattleRankClass(rankTitle)}`}>
      <TreeBadgeCrest family="battle-rank" rankName={rankTitle} size={compact ? "sm" : "md"} />
      <span>
        <span>{rankTitle}</span>
        {isProvisional && <small>Provisional</small>}
      </span>
    </span>
  );
}

function CurrentPlayerCard({
  stats,
  mode,
}: {
  stats: PlayerStats | null;
  mode: LeaderboardMode;
}) {
  if (!stats) {
    return (
      <section className="gb-leaderboard-current-card gb-leaderboard-current-card-empty">
        <div>
          <p className="gb-leaderboard-section-kicker">{getPlayerRecordHeading(mode)}</p>
          <h2>Connect wallet to view your record</h2>
          <p>Your selected-mode record appears here after verified battles are recorded.</p>
        </div>
      </section>
    );
  }

  const progress = getRankProgress(stats);
  const rankTitle = getDisplayRankTitle(stats);

  return (
    <section className="gb-leaderboard-current-card">
      <div className="gb-leaderboard-current-crest">
        <TreeBadgeCrest family="battle-rank" rankName={rankTitle} size="lg" />
      </div>
      <div className="gb-leaderboard-current-main">
        <p className="gb-leaderboard-section-kicker">{getPlayerRecordHeading(mode)}</p>
        <h2>{rankTitle}</h2>
        <p>{getModeLabel(mode)} Rank</p>
        <div className="gb-leaderboard-current-stats">
          <span><strong>{formatRecord(stats.wins, stats.losses)}</strong><small>Record</small></span>
          <span><strong>{formatWinRate(stats.win_rate)}</strong><small>Win Rate</small></span>
          <span><strong className={streakClass(stats.current_streak)}>{formatStreak(stats.current_streak)}</strong><small>Streak</small></span>
          <span><strong>{stats.total_battles}</strong><small>Battles</small></span>
          <span><strong>{stats.recent_result ?? "-"}</strong><small>Recent</small></span>
        </div>
        {mode === "pvp" && <PvpTargetMix counts={stats.pvp_target_counts} />}
        <div className="gb-leaderboard-current-badges">
          <span>Earned Battle Badges</span>
          <BadgeChips badges={stats.badges} />
        </div>
        <div className="gb-leaderboard-progress-block">
          <div className="gb-leaderboard-progress-head">
            <span>
              {progress.isMaximumRank
                ? "Maximum battle rank reached"
                : `Next Rank: ${progress.nextTitle}`}
            </span>
            <span>{progress.progressPercent}%</span>
          </div>
          <div className="gb-leaderboard-progress-track" aria-label={progress.progressLabel}>
            <span style={{ width: `${progress.progressPercent}%` }} />
          </div>
          <p>{progress.progressLabel}</p>
        </div>
      </div>
    </section>
  );
}

function PodiumCard({
  entry,
  address,
  suinsName,
}: {
  entry: LeaderboardEntry;
  address: string | null;
  suinsName: string | null | undefined;
}) {
  const isMe = isConnectedWallet(entry.address, address);
  const placeClass = entry.rank === 1 ? "first" : entry.rank === 2 ? "second" : "third";
  const Icon = entry.rank === 1 ? Crown : entry.rank === 2 ? Trophy : Medal;

  return (
    <article className={`gb-leaderboard-podium-card gb-leaderboard-podium-${placeClass} ${isMe ? "gb-leaderboard-is-me" : ""}`}>
      <div className="gb-leaderboard-podium-place">
        <Icon aria-hidden="true" size={18} />
        <span>#{entry.ranked ? entry.rank : "UR"}</span>
      </div>
      <PlayerIdentity address={entry.address} isMe={isMe} suinsName={suinsName} />
      <RankBadge entry={entry} />
      <div className="gb-leaderboard-podium-stats">
        <span>{formatRecord(entry.wins, entry.losses)}</span>
        <span>{formatWinRate(entry.win_rate)}</span>
        <span className={streakClass(entry.current_streak)}>{formatStreak(entry.current_streak)}</span>
      </div>
      <PvpTargetMix counts={entry.pvp_target_counts} compact />
      <BadgeChips badges={entry.badges.slice(0, 1)} />
    </article>
  );
}

function LoadingState() {
  return (
    <div className="gb-leaderboard-loading" aria-label="Loading leaderboard">
      <div className="gb-leaderboard-skeleton gb-leaderboard-skeleton-current" />
      <div className="gb-leaderboard-skeleton-grid">
        <span />
        <span />
        <span />
      </div>
      <div className="gb-leaderboard-skeleton-table">
        {Array.from({ length: 5 }).map((_, index) => (
          <span key={index} />
        ))}
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const currentAccount = useCurrentAccount();
  const address = currentAccount?.address ?? null;

  const [mode, setMode] = useState<LeaderboardMode>("pvp");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myStats, setMyStats] = useState<PlayerStats | null>(null);
  const [suinsNames, setSuinsNames] = useState<Record<string, string | null>>({});

  const loadLeaderboard = useCallback(() => {
    setLoading(true);
    setError(null);

    const leaderboardRequest = fetchLeaderboard(100, 0, mode)
      .then((data) => {
        setLeaderboard(data.leaderboard);
        setTotalPlayers(data.total);
      });

    const statsRequest = address
      ? fetchPlayerStats(address, mode)
          .then(setMyStats)
          .catch(() => setMyStats(null))
      : Promise.resolve(setMyStats(null));

    Promise.all([leaderboardRequest, statsRequest])
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [address, mode]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  useEffect(() => {
    if (leaderboard.length === 0) return;

    let cancelled = false;
    const uniqueAddresses = Array.from(
      new Set(leaderboard.map((entry) => entry.address.toLowerCase())),
    );
    const unresolved = uniqueAddresses.filter((entryAddress) => {
      const cached = readCachedSuiName(entryAddress);
      return cached === undefined;
    });

    const cachedNames = uniqueAddresses.reduce<Record<string, string | null>>((next, entryAddress) => {
      const cached = readCachedSuiName(entryAddress);
      if (cached !== undefined) next[entryAddress] = cached;
      return next;
    }, {});

    if (Object.keys(cachedNames).length > 0) {
      setSuinsNames((current) => ({ ...current, ...cachedNames }));
    }

    if (unresolved.length === 0) {
      return () => {
        cancelled = true;
      };
    }

    resolveSuiNames(unresolved).then((resolvedNames) => {
      if (cancelled) return;
      setSuinsNames((current) => {
        return { ...current, ...resolvedNames };
      });
    });

    return () => {
      cancelled = true;
    };
  }, [leaderboard]);

  const topPlayers = useMemo(() => selectTopPlayers(leaderboard), [leaderboard]);
  const desktopPodium = useMemo(() => orderPodiumForDesktop(topPlayers), [topPlayers]);

  return (
    <div
      className="gb-leaderboard-page"
      style={{
        backgroundImage: `linear-gradient(rgba(0, 24, 19, 0.35), rgba(0, 24, 19, 0.62)), url(${appAsset("assets/background4.jpg")})`,
      }}
    >
      <header className="gb-leaderboard-header">
        <div className="gb-leaderboard-header-inner">
          <div className="gb-leaderboard-brand" aria-label="Garden Battles">
            <img
              src={appAsset("assets/thick.png")}
              alt="Thickquidity Logo"
              className="gb-leaderboard-logo"
              data-testid="logo-brand"
            />
            <span className="gb-leaderboard-brand-text">Garden Battles</span>
          </div>

          <nav className="gb-leaderboard-nav">
            <a href="https://www.tree-token.xyz/" target="_blank" rel="noopener noreferrer">Home</a>
            <Link href="/battle">Battle</Link>
            <a href="https://nftree.net" target="_blank" rel="noopener noreferrer">Buy NFTree</a>
          </nav>

          <div className="gb-leaderboard-status-cluster">
            {address && <ForestPower address={address} />}
            {address && <PlayerRecord address={address} label="Overall Battle Rank" />}
          </div>

          <div className="gb-leaderboard-wallet-control">
            <ConnectButton connectText="Connect Wallet" />
          </div>
        </div>
      </header>

      <main className="gb-leaderboard-shell">
        <section className="gb-leaderboard-hero">
          <p className="gb-leaderboard-section-kicker">Verified on-chain battle records</p>
          <h1 className="gb-visually-hidden">Garden Leaderboard</h1>
          <img
            className="gb-leaderboard-hero-logo"
            src={appAsset("assets/garden-leaderboard-logo.png")}
            alt=""
            aria-hidden="true"
            draggable={false}
          />
          <p>Track the strongest NFTree fighters across PvP, Garden Bot, and Overall records.</p>
        </section>

        <div className="gb-leaderboard-tabs" aria-label="Leaderboard mode">
          {LEADERBOARD_MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={mode === item.id}
              className={mode === item.id ? "gb-leaderboard-tab-active" : ""}
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
          <button type="button" disabled aria-disabled="true">
            Canopy Clash - Soon
          </button>
        </div>

        <details className="gb-leaderboard-badge-guide" open>
          <summary>
            <span className="gb-leaderboard-badge-guide-heading">
              <span className="gb-leaderboard-badge-guide-icon" aria-hidden="true">
                <Award size={21} />
              </span>
              <span>
                <strong>Battle Badge Guide</strong>
                <small>See all nine achievements and exactly how each one is earned.</small>
              </span>
            </span>
            <span className="gb-leaderboard-badge-guide-toggle">
              9 Badges
              <ChevronDown size={17} aria-hidden="true" />
            </span>
          </summary>
          <div className="gb-leaderboard-badge-guide-grid">
            {BADGE_GUIDE.map((badge) => (
              <article key={badge.id}>
                <span className="gb-leaderboard-badge-chip" title={BADGE_LABELS[badge.id]}>
                  {BADGE_LABELS[badge.id]}
                </span>
                <p>{badge.description}</p>
              </article>
            ))}
          </div>
        </details>

        <CurrentPlayerCard stats={address ? myStats : null} mode={mode} />

        {loading ? (
          <LoadingState />
        ) : error ? (
          <section className="gb-leaderboard-state-card gb-leaderboard-error-card">
            <h2>Leaderboard data unavailable</h2>
            <p>{error}</p>
            <button type="button" onClick={loadLeaderboard}>
              <RefreshCw size={16} aria-hidden="true" />
              Retry
            </button>
          </section>
        ) : leaderboard.length === 0 ? (
          <section className="gb-leaderboard-state-card">
            <Swords size={26} aria-hidden="true" />
            <h2>{getEmptyModeMessage(mode)}</h2>
            <p>Start a verified battle to put your NFTree on the board.</p>
            <Link href="/battle">Join Battle</Link>
          </section>
        ) : (
          <>
            <section className="gb-leaderboard-section">
              <div className="gb-leaderboard-section-head">
                <div>
                  <p className="gb-leaderboard-section-kicker">{getModeLabel(mode)}</p>
                  <h2>Top Players</h2>
                </div>
                <span>{totalPlayers} players</span>
              </div>
              <div className="gb-leaderboard-podium gb-leaderboard-podium-desktop">
                {desktopPodium.map((entry) => (
                  <PodiumCard
                    key={`podium-${entry.address}`}
                    entry={entry}
                    address={address}
                    suinsName={suinsNames[entry.address.toLowerCase()]}
                  />
                ))}
              </div>
              <div className="gb-leaderboard-podium gb-leaderboard-podium-mobile">
                {topPlayers.map((entry) => (
                  <PodiumCard
                    key={`mobile-podium-${entry.address}`}
                    entry={entry}
                    address={address}
                    suinsName={suinsNames[entry.address.toLowerCase()]}
                  />
                ))}
              </div>
            </section>

            <section className="gb-leaderboard-section">
              <div className="gb-leaderboard-section-head">
                <div>
                  <p className="gb-leaderboard-section-kicker">Full Rankings</p>
                  <h2>{getModeLabel(mode)} Standings</h2>
                </div>
              </div>

              <div className="gb-leaderboard-table-wrap">
                <table className="gb-leaderboard-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Player</th>
                      <th>Rank</th>
                      <th>Record</th>
                      <th>Win Rate</th>
                      {mode === "pvp" && <th>Match Mix</th>}
                      <th>Streak</th>
                      <th>Last Played</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((entry) => {
                      const isMe = isConnectedWallet(entry.address, address);
                      return (
                        <tr
                          key={`${entry.mode}-${entry.address}`}
                          className={isMe ? "gb-leaderboard-row-current" : ""}
                        >
                          <td>{entry.ranked ? entry.rank : "UR"}</td>
                          <td>
                            <PlayerIdentity
                              address={entry.address}
                              isMe={isMe}
                              suinsName={suinsNames[entry.address.toLowerCase()]}
                            />
                            <BadgeChips badges={entry.badges} />
                          </td>
                          <td><RankBadge entry={entry} compact /></td>
                          <td>
                            <span className="gb-leaderboard-record">
                              <span className="gb-leaderboard-positive">{entry.wins}W</span>
                              <span>-</span>
                              <span className="gb-leaderboard-negative">{entry.losses}L</span>
                            </span>
                          </td>
                          <td>{formatWinRate(entry.win_rate)}</td>
                          {mode === "pvp" && (
                            <td>
                              <PvpTargetMix counts={entry.pvp_target_counts} compact />
                            </td>
                          )}
                          <td className={streakClass(entry.current_streak)}>
                            {formatStreak(entry.current_streak)}
                          </td>
                          <td>
                            <span className={`gb-leaderboard-result-pill gb-leaderboard-result-${entry.recent_result?.toLowerCase() || "none"}`}>
                              {resultLabel(entry.recent_result)}
                            </span>
                            {formatLastPlayed(entry.last_played)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="gb-leaderboard-mobile-cards" aria-label="Mobile leaderboard entries">
                {leaderboard.map((entry) => {
                  const isMe = isConnectedWallet(entry.address, address);
                  return (
                    <article
                      key={`mobile-${entry.mode}-${entry.address}`}
                      className={`gb-leaderboard-mobile-card ${isMe ? "gb-leaderboard-mobile-card-current" : ""}`}
                    >
                      <div className="gb-leaderboard-mobile-card-head">
                        <span className="gb-leaderboard-mobile-rank">
                          {entry.ranked ? `#${entry.rank}` : "UR"}
                        </span>
                        <PlayerIdentity
                          address={entry.address}
                          isMe={isMe}
                          suinsName={suinsNames[entry.address.toLowerCase()]}
                        />
                      </div>
                      <RankBadge entry={entry} />
                      <dl className="gb-leaderboard-mobile-stats">
                        <div><dt>Record</dt><dd>{formatRecord(entry.wins, entry.losses)}</dd></div>
                        <div><dt>Win Rate</dt><dd>{formatWinRate(entry.win_rate)}</dd></div>
                        {mode === "pvp" && (
                          <div className="gb-leaderboard-mobile-span">
                            <dt>Match Mix</dt>
                            <dd><PvpTargetMix counts={entry.pvp_target_counts} compact /></dd>
                          </div>
                        )}
                        <div><dt>Streak</dt><dd className={streakClass(entry.current_streak)}>{formatStreak(entry.current_streak)}</dd></div>
                        <div><dt>Last Played</dt><dd>{formatLastPlayed(entry.last_played)}</dd></div>
                      </dl>
                      <BadgeChips badges={entry.badges} />
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        )}

        <details className="gb-leaderboard-rules">
          <summary>How rankings work</summary>
          <div>
            <p>PvP, Garden Bot, and Overall records are tracked separately from verified battle records.</p>
            <p>Three recorded battles are required for official ranking. Before that, players are shown as Grove Recruit / provisional.</p>
            <ul>
              <li>Rooted Fighter: ranked with fewer than 10 wins</li>
              <li>Thorn Challenger: 10 wins</li>
              <li>Grove Striker: 25 wins</li>
              <li>Canopy Champion: 50 wins</li>
              <li>Elderroot Titan: 100 wins</li>
            </ul>
            <p>Earned badges come from recorded battle achievements. Battle-rank cosmetics are planned visual rewards and are not active yet.</p>
            <p>Canopy Clash is a future tournament mode and is not live yet.</p>
          </div>
        </details>

        <div className="gb-leaderboard-bottom-actions">
          <Link href="/battle">Back to Battle</Link>
        </div>
      </main>
    </div>
  );
}
