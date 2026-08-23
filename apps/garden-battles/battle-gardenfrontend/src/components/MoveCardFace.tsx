import type { LucideIcon } from "lucide-react";
import {
  Axe,
  Bug,
  CloudRain,
  Droplets,
  Hammer,
  Leaf,
  Recycle,
  Shield,
  Shovel,
  Sparkles,
  Sprout,
  Sun,
  TreePine,
  Wind,
  Zap,
} from "lucide-react";
import { MOVE_LABELS, MOVE_META } from "@/lib/sui-config";

const MOVE_ICONS: Record<number, LucideIcon> = {
  1: Hammer, 2: Axe, 3: Axe, 4: Shovel, 5: Hammer, 6: Sprout, 7: TreePine,
  8: Shield, 9: Droplets, 10: Bug, 11: Zap, 12: Wind, 13: Bug, 14: Recycle,
  15: TreePine, 16: Axe, 17: Shield, 18: Sprout, 19: Sparkles, 20: Recycle,
  21: Sun, 22: CloudRain, 23: Sprout, 24: CloudRain, 25: Sparkles,
  26: Sun, 27: Shield, 28: Droplets, 29: Wind, 30: TreePine,
  31: Axe, 32: Bug, 33: Zap, 34: TreePine, 35: Sparkles, 36: Sun,
  37: Shield, 38: Droplets, 39: Leaf,
};

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
  const Icon = MOVE_ICONS[moveId] ?? Leaf;
  const condition = meta ? conditionLabel(meta.effect) : null;
  const typeLabel = meta?.type === "growth" ? "Growth" : meta?.type === "hybrid" ? "Hybrid" : "Attack";

  return (
    <span className={`gb-move-face gb-move-face-${meta?.type ?? "attack"}${compact ? " gb-move-face-compact" : ""}`}>
      <span className="gb-move-face-visual" aria-hidden="true">
        <span className="gb-move-face-rings" />
        <Icon className="gb-move-face-icon" strokeWidth={1.75} />
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
