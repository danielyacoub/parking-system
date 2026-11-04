const REALTIME_EVENTS = [
  "slotUpdate",
  "gateLogUpdate",
  "activityLogUpdate",
] as const;

export type RealtimeEventName = (typeof REALTIME_EVENTS)[number];

export function isRealtimeEventName(
  value: unknown,
): value is RealtimeEventName {
  return (
    typeof value === "string" &&
    (REALTIME_EVENTS as readonly string[]).includes(value)
  );
}

let hasWarnedAboutBridge = false;

/**
 * Route handlers and server actions run inside Next.js, while the Socket.io
 * server lives in the custom Node server. This tiny internal bridge lets API
 * code emit to connected browsers without sharing module state.
 */
export async function broadcast(
  event: RealtimeEventName,
  payload: unknown,
): Promise<void> {
  const port = process.env.PORT ?? "3000";
  const secret =
    process.env.INTERNAL_BROADCAST_SECRET ?? "hk-parking-internal-dev";

  try {
    const response = await fetch(
      `http://127.0.0.1:${port}/internal/broadcast`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": secret,
        },
        body: JSON.stringify({ event, payload }),
        cache: "no-store",
        signal: AbortSignal.timeout(2_000),
      },
    );

    if (!response.ok) {
      console.warn(
        `[realtime] Broadcast bridge returned ${response.status} for ${event}.`,
      );
    }
  } catch (error) {
    if (!hasWarnedAboutBridge) {
      hasWarnedAboutBridge = true;
      console.warn(
        "[realtime] Socket.io bridge unavailable. Run `pnpm dev` (custom server) for live updates.",
        error instanceof Error ? error.message : error,
      );
    }
  }
}
