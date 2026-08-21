import { fromBase64 } from "@mysten/sui/utils";

function validMoveIds(values: unknown[]): number[] {
  return values
    .map((value) => Number(value))
    .filter(
      (value) =>
        Number.isInteger(value) && value >= 0 && value <= 255,
    );
}

export function normalizeSuiMoveList(value: unknown): number[] {
  if (Array.isArray(value)) return validMoveIds(value);

  if (typeof value === "string") {
    if (!value.trim()) return [];
    try {
      return validMoveIds(Array.from(fromBase64(value)));
    } catch {
      return [];
    }
  }

  if (value && typeof value === "object") {
    const wrapped = value as {
      vec?: unknown;
      fields?: { vec?: unknown; value?: unknown };
      value?: unknown;
    };
    return normalizeSuiMoveList(
      wrapped.vec ??
        wrapped.fields?.vec ??
        wrapped.fields?.value ??
        wrapped.value,
    );
  }

  return [];
}
