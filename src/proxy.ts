import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { checkIsAdmin } from "@/lib/auth";

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  cookieHeader.split(";").forEach((cookie) => {
    const [key, value] = cookie.split("=").map((part) => part.trim());

    if (key && value) {
      cookies[key] = value;
    }
  });

  return cookies;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isLoginPage =
    pathname === "/admin/login" || pathname === "/admin/login/";

  const cookies = parseCookies(request.headers.get("cookie") ?? "");
  const isAdmin = await checkIsAdmin(cookies);

  // The login page is public, but signed-in admins go straight to the console.
  if (isLoginPage) {
    if (isAdmin) {
      return NextResponse.redirect(new URL("/admin", request.nextUrl.origin));
    }

    return NextResponse.next();
  }

  if (!isAdmin) {
    const loginUrl = new URL("/admin/login", request.nextUrl.origin);
    loginUrl.searchParams.set(
      "redirect",
      `${pathname}${request.nextUrl.search}`,
    );

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Protect every admin page. API route handlers validate the session
  // themselves so public reads (slots and gate logs) keep working.
  matcher: ["/admin/:path*"],
};
