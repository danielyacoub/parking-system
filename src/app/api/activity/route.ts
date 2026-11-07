import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { isAdminRequest } from "@/lib/auth-server";

import {
  DEFAULT_LOG_LIMIT,
  getRecentActivityLogs,
} from "@/lib/parking";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_LOG_LIMIT),
  slotId: z.string().trim().min(1).max(64).optional(),
});

export async function GET(request: NextRequest) {
  // Admin-only endpoint
  const isAdmin = await isAdminRequest();

  if (!isAdmin) {
    return NextResponse.json(
      { error: "Admin authentication required." },
      { status: 401 },
    );
  }

  const parsed = querySchema.safeParse({
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
    slotId: request.nextUrl.searchParams.get("slotId") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const logs = await getRecentActivityLogs(
      parsed.data.limit,
      parsed.data.slotId,
    );

    return NextResponse.json({ logs }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[api/activity] GET failed:", error);
    return NextResponse.json(
      { error: "Unable to load slot activity." },
      { status: 500 },
    );
  }
}