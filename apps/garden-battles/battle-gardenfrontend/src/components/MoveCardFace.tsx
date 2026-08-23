import { Leaf } from "lucide-react";
import { appAsset } from "@/lib/assets";
import { MOVE_LABELS, MOVE_META } from "@/lib/sui-config";

const MOVE_ICON_ASSETS: Record<number, string> = {
  1: "01-wedgebreaker.png", 2: "02-skyreach-saw.png", 3: "03-chainsaw-cyclone.png",
  4: "04-rootpiercer.png", 5: "05-limbfall-slam.png", 6: "06-acorn-barrage.png",
  7: "07-log-swing-rampage.png", 8: "08-barklash-shield.png", 9: "09-root-siphon.png",
  10: "10-beetle-blight.png", 11: "11-lightning-crown.png", 12: "12-air-spade-blast.png",
  13: "13-fungal-doom.png", 14: "14-compost-cleanse.png", 15: "15-rootlink-surge.png",
  16: "16-pruning-fury.png", 17: "17-mulch-fortress.png", 18: "18-graft-fusion.png",
  19: "19-wildwood-gamble.png", 20: "20-root-revival.png", 21: "21-solar-bloom.png",
  22: "22-rainmaker.png", 23: "23-myco-might.png", 24: "24-canopy-downpour.png",
  25: "25-potassium-power.png", 26: "26-photosynthesis-overdrive.png", 27: "27-ironbark-armor.png",
  28: "28-sap-surge.png", 29: "29-gale-guard.png", 30: "30-shadow-canopy.png",
  31: "31-chainsaw-cataclysm.png", 32: "32-beetle-swarm-blitz.png", 33: "33-lightning-split.png",
  34: "34-ancient-root-awakening.png", 35: "35-canopy-explosion.png", 36: "36-solar-crown-surge.png",
  37: "37-ironwood-fortress.png", 38: "38-rootstorm-siphon.png", 39: "39-arborist-ascension.png",
};

export function getMoveIconUrl(moveId: number): string | null {
  const iconAsset = MOVE_ICON_ASSETS[moveId];
  return iconAsset ? appAsset(`assets/card-icons/v13/${iconAsset}`) : null;
}

function conditionLabel(effect: string) {
  if (/chance/i.test(effect)) return "Chance";
  if (/while behind|at least 40|10 Growth or below/i.test(effect)) return "Conditional";
  if (/after an opponent|after your Attack/i.test(effect)) return "Combo";
  if (/block|shield|armor|caps the next/i.test(effect)) return "Guard";
  if (/poison|next turn|pending damage/i.test(effect)) return "Status";
  if (/pierces|removes one block|breaks it/i.test(effect)) return "Piercing";
  return null;
}

type MoveCardFaceProps = {
  moveId: number;
  isFifth?: boolean;
  isPending?: boolean;
  compact?: boolean;
};

export default function MoveCardFace({
  moveId,
  isFifth = false,
  isPending = false,
  compact = false,
}: MoveCardFaceProps) {
  const meta = MOVE_META[moveId];
  const iconUrl = getMoveIconUrl(moveId);
  const condition = meta ? conditionLabel(meta.effect) : null;
  const typeLabel = meta?.type === "growth" ? "Growth" : meta?.type === "hybrid" ? "Hybrid" : "Attack";

  return (
    <span className={`gb-move-face gb-move-face-${meta?.type ?? "attack"}${compact ? " gb-move-face-compact" : ""}`}>
      <span className="gb-move-face-visual" aria-hidden="true">
        <span className="gb-move-face-rings" />
        {iconUrl ? (
          <img
            className="gb-move-face-icon gb-move-face-art"
            src={iconUrl}
            alt=""
            loading="lazy"
            decoding="async"
          />
        ) : (
          <Leaf className="gb-move-face-icon" strokeWidth={1.75} />
        )}
        <span className="gb-move-face-number">{String(moveId).padStart(2, "0")}</span>
      </span>
      <span className="gb-move-face-copy">
        <span className="gb-move-face-badges">
          <span>{isFifth ? "TREE Power" : typeLabel}</span>
          {condition && <span className="gb-move-condition">{condition}</span>}
        </span>
        <strong>{isPending ? "Pending: " : ""}{MOVE_LABELS[moveId] || `Move ${moveId}`}</strong>
        {meta?.effect && <small>{meta.effect}</small>}
      </span>
    </span>
  );
}
