type TreeBadgeCrestFamily = "tree-status" | "battle-rank";
type TreeBadgeCrestSize = "sm" | "md" | "lg";

interface TreeBadgeCrestProps {
  family: TreeBadgeCrestFamily;
  rankName: string;
  size?: TreeBadgeCrestSize;
}

function rankSlug(rankName: string) {
  return rankName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function TreeStatusSymbol() {
  return (
    <svg className="gb-tree-badge-svg" viewBox="0 0 64 64" aria-hidden="true">
      <circle className="gb-tree-badge-ring-line" cx="32" cy="38" r="16" />
      <circle className="gb-tree-badge-ring-line gb-tree-badge-ring-line-inner" cx="32" cy="38" r="8" />
      <path className="gb-tree-badge-trunk" d="M32 50V29" />
      <path className="gb-tree-badge-branch" d="M32 38C25 35 21 30 19 22" />
      <path className="gb-tree-badge-branch" d="M32 36C40 33 44 27 46 18" />
      <path className="gb-tree-badge-leaf" d="M20 17C29 16 34 20 34 27C25 29 19 25 20 17Z" />
      <path className="gb-tree-badge-leaf" d="M45 13C51 20 50 27 43 31C38 24 39 17 45 13Z" />
      <path className="gb-tree-badge-root" d="M32 50C27 48 23 51 19 55" />
      <path className="gb-tree-badge-root" d="M32 50C37 48 41 51 45 55" />
    </svg>
  );
}

function BattleRankSymbol() {
  return (
    <svg className="gb-tree-badge-svg" viewBox="0 0 64 64" aria-hidden="true">
      <path className="gb-tree-badge-shield" d="M32 7L51 14V29C51 43 42 53 32 58C22 53 13 43 13 29V14L32 7Z" />
      <path className="gb-tree-badge-trunk" d="M32 48V24" />
      <path className="gb-tree-badge-branch" d="M32 34L20 23" />
      <path className="gb-tree-badge-branch" d="M32 34L44 23" />
      <path className="gb-tree-badge-thorn" d="M20 23L14 24L18 18Z" />
      <path className="gb-tree-badge-thorn" d="M44 23L50 24L46 18Z" />
      <path className="gb-tree-badge-leaf" d="M27 18C34 18 38 21 39 27C31 29 26 25 27 18Z" />
      <path className="gb-tree-badge-root" d="M32 48L23 54" />
      <path className="gb-tree-badge-root" d="M32 48L41 54" />
    </svg>
  );
}

export default function TreeBadgeCrest({
  family,
  rankName,
  size = "md",
}: TreeBadgeCrestProps) {
  const slug = rankSlug(rankName);
  const familyClass =
    family === "tree-status" ? "gb-holder-rank-crest" : "gb-battle-rank-crest";
  const label =
    family === "tree-status"
      ? `${rankName} TREE Status crest`
      : `${rankName} Battle Rank crest`;

  return (
    <span
      className={[
        "gb-rank-crest",
        "gb-tree-badge-crest",
        familyClass,
        `gb-tree-badge-crest-${family}`,
        `gb-tree-badge-crest-${size}`,
        `gb-tree-badge-crest-${slug}`,
      ].join(" ")}
      role="img"
      aria-label={label}
      title={label}
    >
      {family === "tree-status" ? <TreeStatusSymbol /> : <BattleRankSymbol />}
    </span>
  );
}
