import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { isAdminRequest } from "@/lib/auth-server";

import {
  DEFAULT_LOG_LIMIT,
  getRecentGateLogs,
  recordGateEvent,
} from "@/lib/parking";
import { broadcast } from "@/lib/realtime";
import { GATE_EVENTS, GATE_TRIGGERS } from "@/types/parking";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_LOG_LIMIT),
});

const gateEventSchema = z.object({
  gateId: z.string().trim().min(1).max(64),
  event: z.enum(GATE_EVENTS),
  triggeredBy: z.enum(GATE_TRIGGERS).default("ADMIN_OVERRIDE"),
});

export async function GET(request: NextRequest) {
  // Public endpoint - no auth required for reading
  const parsed = querySchema.safeParse({
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const logs = await getRecentGateLogs(parsed.data.limit);
    return NextResponse.json({ logs }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[api/gates] GET failed:", error);
    return NextResponse.json(
      { error: "Unable to load gate activity." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  // Admin-only endpoint
  const isAdmin = await isAdminRequest();

  if (!isAdmin) {
    return NextResponse.json(
      { error: "Admin authentication required." },
      { status: 401 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = gateEventSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid gate event.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const log = await recordGateEvent(parsed.data);
    await broadcast("gateLogUpdate", log);

    return NextResponse.json({ log }, { status: 201 });
  } catch (error) {
    console.error("[api/gates] POST failed:", error);
    return NextResponse.json(
      { error: "Unable to record the gate event." },
      { status: 500 },
    );
  }
}