import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { isAdminRequest } from "@/lib/auth-server";

import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  SlotNotFoundError,
  listSlots,
  setSlotOccupancy,
} from "@/lib/parking";
import { broadcast } from "@/lib/realtime";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

const updateSchema = z
  .object({
    slotId: z.string().trim().min(1).max(64),
    isOccupied: z.boolean().optional(),
    action: z.enum(["OCCUPIED", "VACATED"]).optional(),
  })
  .refine(
    (value) => value.isOccupied !== undefined || value.action !== undefined,
    { message: "Provide isOccupied or action." },
  );

export async function GET(request: NextRequest) {
  // Public endpoint - no auth required for reading
  const parsed = querySchema.safeParse({
    page: request.nextUrl.searchParams.get("page") ?? undefined,
    limit: request.nextUrl.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const data = await listSlots(parsed.data);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[api/slots] GET failed:", error);
    return NextResponse.json(
      { error: "Unable to load parking slots." },
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

  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid slot update.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const occupied =
    parsed.data.isOccupied ?? parsed.data.action === "OCCUPIED";

  try {
    const result = await setSlotOccupancy({
      slotId: parsed.data.slotId,
      occupied,
    });

    if (result.changed) {
      await broadcast("slotUpdate", {
        slot: result.slot,
        stats: result.stats,
      });

      if (result.activity) {
        await broadcast("activityLogUpdate", result.activity);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SlotNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error("[api/slots] POST failed:", error);
    return NextResponse.json(
      { error: "Unable to update the parking slot." },
      { status: 500 },
    );
  }
}