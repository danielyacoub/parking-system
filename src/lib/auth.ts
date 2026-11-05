// Manual cookie handling - the cookie is set by the login API route
// and read by the middleware and client components via next/headers

// Admin credentials from environment
export const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "admin";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin123";

// Token-based auth
// On login, a base64 token is set as an httpOnly cookie via the API route
// The token format: username:timestamp:hash where hash = fn(username:timestamp:AUTH_SECRET)

// Simple hash function
function computeHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h = ((h << 5) - h + c) | 0;
  }
  return h.toString(36);
}

// Auth token: username:timestamp:hash
export function generateAuthToken(username: string, timestamp: number): string {
  const hash = computeHash(`${username}:${timestamp}:${process.env.INTERNAL_BROADCAST_SECRET ?? "hk-parking-admin-secret-2026"}`);
  return `${username}:${timestamp}:${hash}`;
}

// Check if a token is valid
export function isValidAuthToken(token: string): boolean {
  try {
    const parts = token.split(":");
    if (parts.length !== 3) return false;
    const [username, timestampStr, hash] = parts;

    if (username !== ADMIN_USERNAME) return false;

    const timestamp = Number(timestampStr);
    if (isNaN(timestamp)) return false;

    // 7-day validity
    if (Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000) return false;

    const expectedHash = computeHash(`${username}:${timestamp}:${process.env.INTERNAL_BROADCAST_SECRET ?? "hk-parking-admin-secret-2026"}`);
    return hash === expectedHash;
  } catch {
    return false;
  }
}

// ============================================================
// Session cookie management - read/write via Next.js headers
// ============================================================

// Read the hk_admin_session cookie from the request/response
export function getAdminSessionCookie(
  cookies: Record<string, string> | undefined
): string | undefined {
  if (!cookies) return undefined;
  return cookies["hk_admin_session"];
}

// Verify the session cookie is valid
export function getAdminSessionFromCookies(
  cookies: Record<string, string> | undefined
): { valid: boolean; username: string } {
  const token = getAdminSessionCookie(cookies);
  if (!token) return { valid: false, username: "" };

  const isValid = isValidAuthToken(token);
  if (isValid) {
    const parts = token.split(":");
    return { valid: true, username: parts[0] };
  }
  return { valid: false, username: "" };
}

// Set the hk_admin_session cookie on a Next.js response
export function setAdminSessionCookie(
  response: Response,
  username: string,
  options: { httpOnly?: boolean; secure?: boolean; path?: string; maxAge?: number } = {}
): void {
  const {
    httpOnly = true,
    secure = process.env.NODE_ENV === "production",
    path = "/",
    maxAge = 7 * 24 * 60 * 60, // 7 days
  } = options;

  const token = generateAuthToken(username, Date.now());
  const attributes = [
    `hk_admin_session=${token}`,
    `Path=${path}`,
    `Max-Age=${maxAge}`,
    "SameSite=Strict",
  ];

  if (httpOnly) {
    attributes.push("HttpOnly");
  }

  if (secure) {
    attributes.push("Secure");
  }

  response.headers.append("Set-Cookie", attributes.join("; "));
}

// Clear the hk_admin_session cookie
export function clearAdminSessionCookie(
  response: Response,
  options: { path?: string; maxAge?: number } = {}
): void {
  const { path = "/", maxAge = 0 } = options;

  response.headers.append(
    "Set-Cookie",
    [
      "hk_admin_session=",
      `Path=${path}`,
      `Max-Age=${maxAge}`,
      "SameSite=Strict",
      "HttpOnly",
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ].join("; "),
  );
}

// Check if user is admin - used in middleware and client components
// Reads the hk_admin_session cookie and verifies it
export async function checkIsAdmin(
  cookies?: Record<string, string>
): Promise<boolean> {
  const { valid } = getAdminSessionFromCookies(cookies);
  return valid;
}

// Get admin credentials for validation
export function getAdminCredentials() {
  return {
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD,
  };
}

// Clear admin session (sets cookie to expired)
export async function clearAdminSession(
  response: Response
): Promise<void> {
  clearAdminSessionCookie(response);
}