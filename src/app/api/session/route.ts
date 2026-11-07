import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/auth-server";

export async function GET() {
  const authenticated = await isAdminRequest();

  return NextResponse.json(
    { authenticated },
    { headers: { "Cache-Control": "no-store" } },
  );
}
