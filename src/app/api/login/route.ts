import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { setAdminSessionCookie, getAdminCredentials } from "@/lib/auth";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().trim().min(1, "Password is required"),
});

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid credentials format.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { username, password } = parsed.data;
  const credentials = getAdminCredentials();

  if (
    username.toLowerCase() !== credentials.username.toLowerCase() ||
    password !== credentials.password
  ) {
    return NextResponse.json(
      { error: "Invalid username or password." },
      { status: 401 },
    );
  }

  // Set the admin session cookie
  const response = NextResponse.json({
    success: true,
    message: "Admin authenticated successfully.",
    user: { username: credentials.username, role: "admin" },
  });

  setAdminSessionCookie(response, username);

  return response;
}