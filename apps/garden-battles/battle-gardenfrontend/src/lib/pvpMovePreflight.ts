export const PVP_MOVE_PREFLIGHT_TIMEOUT_MS = 8_000;

export type TimedPreflightResult<T> =
  | { status: "completed"; value: T }
  | { status: "timed-out" };

export async function awaitPvpMovePreflight<T>(
  read: Promise<T>,
  timeoutMs = PVP_MOVE_PREFLIGHT_TIMEOUT_MS,
): Promise<TimedPreflightResult<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      read.then((value) => ({ status: "completed" as const, value })),
      new Promise<TimedPreflightResult<T>>((resolve) => {
        timeoutId = setTimeout(
          () => resolve({ status: "timed-out" }),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}
