import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "./prisma";

const SESSION_SECRET =
  process.env.SESSION_SECRET || "r-prm-local-complete-hmac-session-secret-2026";
const PASSWORD_SALT = "r-prm-scrypt-password-salt-2026";

export interface RprmSession {
  userId: string;
  email: string;
  name: string;
  identityType: "coworker" | "partner";
  role: string; // Looked up from DB, NEVER self-selected at login
  isMainContact?: boolean;
  partnerId?: string | null;
  partnerName?: string | null;
  impersonatingPartnerId?: string | null;
  mfaVerified?: boolean;
  issuedAt: number;
}

export function hashPassword(plain: string): string {
  return crypto
    .scryptSync(plain, PASSWORD_SALT, 32)
    .toString("hex");
}

export function verifyPassword(plain: string, expectedHash: string): boolean {
  const actual = hashPassword(plain);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(actual, "hex"),
      Buffer.from(expectedHash, "hex")
    );
  } catch {
    return false;
  }
}

// Pre-computed scrypt hashes for local dev accounts:
// Coworkers: "RprmAdmin2026!"
// Partners:  "RprmPartner2026!"
export const DEFAULT_COWORKER_HASH = hashPassword("RprmAdmin2026!");
export const DEFAULT_PARTNER_HASH = hashPassword("RprmPartner2026!");

export function signSessionToken(session: RprmSession): string {
  const payloadB64 = Buffer.from(JSON.stringify(session), "utf8").toString(
    "base64url"
  );
  const sig = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifySessionToken(token?: string | null): RprmSession | null {
  if (!token || !token.includes(".")) return null;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;
  const expectedSig = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payloadB64)
    .digest("base64url");
  if (sig !== expectedSig) return null;
  try {
    return JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    ) as RprmSession;
  } catch {
    return null;
  }
}

export function getServerSession(req: NextRequest): RprmSession | null {
  const cookieVal = req.cookies.get("rprm_session")?.value;
  return verifySessionToken(cookieVal);
}

// Look up user identity and role strictly from the SQLite database by email (§13.3: never chosen at login)
export async function authenticateUserFromDatabase(
  emailInput: string,
  passwordInput: string,
  expectedSurface: "coworker" | "partner"
): Promise<
  | { ok: true; session: RprmSession }
  | { ok: false; error: string }
> {
  const email = (emailInput || "").trim().toLowerCase();
  if (!email || !passwordInput) {
    return { ok: false, error: "Email and password are required" };
  }

  if (expectedSurface === "coworker") {
    const teamRows = await prisma.manageItem.findMany({
      where: { category: "team" },
    });
    const matchedCoworker = teamRows.find((row) =>
      row.subtitle.toLowerCase().includes(email)
    );
    if (!matchedCoworker) {
      return {
        ok: false,
        error: "No coworker account found for this email address",
      };
    }
    let meta: Record<string, string> = {};
    try {
      meta = JSON.parse(matchedCoworker.metadataJson || "{}");
    } catch {
      meta = {};
    }
    const storedHash = meta.passwordHash || DEFAULT_COWORKER_HASH;
    if (!verifyPassword(passwordInput, storedHash)) {
      return { ok: false, error: "Invalid password" };
    }

    const assignedRole =
      meta.role || matchedCoworker.status || "Administrator";
    return {
      ok: true,
      session: {
        userId: matchedCoworker.id,
        email,
        name: matchedCoworker.name,
        identityType: "coworker",
        role: assignedRole,
        partnerId: null,
        partnerName: null,
        mfaVerified: true,
        issuedAt: Date.now(),
      },
    };
  }

  // Partner user login: check Partner main contact first, then PartnerTeamMember
  const partners = await prisma.partner.findMany();
  const mainContactPartner = partners.find(
    (p) => p.contactEmail.toLowerCase() === email
  );
  if (mainContactPartner) {
    if (!mainContactPartner.portalAccess) {
      return {
        ok: false,
        error: "Portal access is not enabled for this partner contact",
      };
    }
    if (!verifyPassword(passwordInput, DEFAULT_PARTNER_HASH)) {
      return { ok: false, error: "Invalid password" };
    }
    return {
      ok: true,
      session: {
        userId: `main-${mainContactPartner.id}`,
        email,
        name: `${mainContactPartner.contactFirstName} ${mainContactPartner.contactLastName}`,
        identityType: "partner",
        role: "Manager",
        isMainContact: true,
        partnerId: mainContactPartner.id,
        partnerName: mainContactPartner.name,
        mfaVerified: true,
        issuedAt: Date.now(),
      },
    };
  }

  const members = await prisma.partnerTeamMember.findMany();
  const member = members.find((m) => m.email.toLowerCase() === email);
  if (!member) {
    return {
      ok: false,
      error: "No partner user found with this email address",
    };
  }
  if (!verifyPassword(passwordInput, DEFAULT_PARTNER_HASH)) {
    return { ok: false, error: "Invalid password" };
  }
  const linkedPartner = partners.find((p) => p.name === member.partnerName);
  return {
    ok: true,
    session: {
      userId: member.id,
      email,
      name: member.name,
      identityType: "partner",
      role: member.role === "Sales Rep" ? "SalesRep" : member.role,
      isMainContact: false,
      partnerId: linkedPartner?.id || "prt-1",
      partnerName: member.partnerName,
      mfaVerified: true,
      issuedAt: Date.now(),
    },
  };
}
