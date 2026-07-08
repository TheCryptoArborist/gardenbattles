import { useEffect, useState } from "react";
import TreeBadgeCrest, { getTreeBadgeAssetPath } from "@/components/TreeBadgeCrest";

const TREE_STATUS_LABELS = [
  "Forest Sprout",
  "Rooted Holder",
  "Grove Builder",
  "Canopy Holder",
  "Ancient Grove",
  "Canopy Titan",
];

const BATTLE_RANK_LABELS = [
  "Grove Recruit",
  "Rooted Fighter",
  "Thorn Challenger",
  "Grove Striker",
  "Canopy Champion",
  "Elderroot Titan",
];

function rankClass(prefix: string, label: string) {
  return `${prefix}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function BadgePreviewCard({
  family,
  label,
}: {
  family: "tree-status" | "battle-rank";
  label: string;
}) {
  const assetPath = getTreeBadgeAssetPath(family, label);
  const [assetStatus, setAssetStatus] = useState<"checking" | "image asset" | "fallback SVG">(
    assetPath ? "checking" : "fallback SVG",
  );
  const badgeClass =
    family === "tree-status"
      ? `gb-holder-rank-badge ${rankClass("gb-holder-rank", label)}`
      : `gb-battle-rank-badge ${rankClass("gb-battle-rank", label)}`;
  const kicker = family === "tree-status" ? "TREE Status" : "Battle Rank";
  const familyName = family === "tree-status" ? "TREE Status" : "Battle Rank";

  useEffect(() => {
    if (!assetPath) {
      setAssetStatus("fallback SVG");
      return;
    }

    let cancelled = false;
    setAssetStatus("checking");
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setAssetStatus("image asset");
    };
    img.onerror = () => {
      if (!cancelled) setAssetStatus("fallback SVG");
    };
    img.src = assetPath;

    return () => {
      cancelled = true;
    };
  }, [assetPath]);

  return (
    <article className="gb-badge-gallery-card">
      <div className="gb-badge-gallery-card-head">
        <span className="gb-badge-gallery-family">{familyName}</span>
        <span className="gb-badge-gallery-label">{label}</span>
        <span
          className={`gb-badge-gallery-asset-status ${
            assetStatus === "image asset"
              ? "gb-badge-gallery-asset-ready"
              : "gb-badge-gallery-asset-fallback"
          }`}
        >
          {assetStatus}
        </span>
        {assetPath && <span className="gb-badge-gallery-asset-path">{assetPath}</span>}
      </div>

      <div className="gb-badge-gallery-size-row">
        <div className="gb-badge-gallery-size">
          <TreeBadgeCrest family={family} rankName={label} size="sm" />
          <span>Small</span>
        </div>
        <div className="gb-badge-gallery-size">
          <TreeBadgeCrest family={family} rankName={label} size="md" />
          <span>Medium</span>
        </div>
        <div className="gb-badge-gallery-size">
          <TreeBadgeCrest family={family} rankName={label} size="lg" />
          <span>HUD</span>
        </div>
      </div>

      <div className={badgeClass}>
        <TreeBadgeCrest family={family} rankName={label} />
        <span className="gb-rank-copy">
          <span className={family === "tree-status" ? "gb-holder-rank-kicker" : "gb-battle-rank-kicker"}>
            {kicker}
          </span>
          <span className={family === "tree-status" ? "gb-holder-rank-title" : "gb-battle-rank-title"}>
            {label}
          </span>
        </span>
      </div>
    </article>
  );
}

export default function BadgeGalleryPreview() {
  return (
    <main className="gb-badge-gallery-page">
      <section className="gb-badge-gallery-hero">
        <p className="gb-badge-gallery-kicker">Temporary QA Preview</p>
        <h1>Garden Battles Badge Crest Gallery</h1>
        <p>
          Current TREE Status and Battle Rank crest artwork using the live
          frontend component. This page is for local review before approval.
        </p>
      </section>

      <section className="gb-badge-gallery-section">
        <div className="gb-badge-gallery-section-title">
          <p>TREE Status Badges</p>
          <span>Wallet / ecosystem status</span>
        </div>
        <div className="gb-badge-gallery-grid">
          {TREE_STATUS_LABELS.map((label) => (
            <BadgePreviewCard key={label} family="tree-status" label={label} />
          ))}
        </div>
      </section>

      <section className="gb-badge-gallery-section">
        <div className="gb-badge-gallery-section-title">
          <p>Battle Rank Badges</p>
          <span>Combat performance rank</span>
        </div>
        <div className="gb-badge-gallery-grid">
          {BATTLE_RANK_LABELS.map((label) => (
            <BadgePreviewCard key={label} family="battle-rank" label={label} />
          ))}
        </div>
      </section>
    </main>
  );
}
