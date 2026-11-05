import { cookies } from "next/headers";

import { checkIsAdmin } from "@/lib/auth";

/**
 * Verify the admin session for a route handler.
 *
 * `checkIsAdmin` in `lib/auth.ts` is intentionally dependency-free so it can
 * also run in middleware. Route handlers need to read the request cookies via
 * `next/headers`, which this helper does.
 */
export async function isAdminRequest(): Promise<boolean> {
  const cookieStore = await cookies();
  const cookieMap: Record<string, string> = {};

  for (const cookie of cookieStore.getAll()) {
    cookieMap[cookie.name] = cookie.value;
  }

  return checkIsAdmin(cookieMap);
}
