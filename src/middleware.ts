import { NextRequest, NextResponse } from "next/server";

// Edge-compatible HMAC-SHA256 verification of the httpOnly rprm_session cookie (§13.1 & §13.3):
// Enforces a session check on every Admin page, Partner Portal page, and API route.
const SESSION_SECRET =
  process.env.SESSION_SECRET || "r-prm-local-complete-hmac-session-secret-2026";

async function verifyCookieEdge(token?: string) {
  if (!token || !token.includes(".")) return null;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(payloadB64));
  const bytes = new Uint8Array(mac);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const expectedSig = btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  if (sig !== expectedSig) return null;
  try {
    const jsonStr = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public surfaces that do not require an authenticated session
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/uploads") ||
    pathname === "/favicon.ico" ||
    pathname === "/login" ||
    pathname === "/p/login" ||
    pathname.startsWith("/forms/") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/public-forms")
  ) {
    return NextResponse.next();
  }

  const cookieVal = req.cookies.get("rprm_session")?.value;
  const session = await verifyCookieEdge(cookieVal);

  // API routes: return 401 JSON if no valid session cookie
  if (pathname.startsWith("/api/")) {
    if (!session) {
      return NextResponse.json(
        {
          lookupStatus: "could_not_check",
          error: "Authentication required: missing or invalid httpOnly session cookie",
        },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // Partner Portal pages (/p or /portal): require authenticated session
  if (
    pathname === "/p" ||
    pathname.startsWith("/p/") ||
    pathname === "/portal" ||
    pathname.startsWith("/portal/")
  ) {
    if (!session) {
      return NextResponse.redirect(new URL("/p/login", req.url));
    }
    return NextResponse.next();
  }

  // Admin pages: require authenticated Coworker session
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (session.identityType === "partner") {
    // Partner users can never reach admin routes (§3 Slice 0c & §13.3)
    return NextResponse.redirect(new URL("/p", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
