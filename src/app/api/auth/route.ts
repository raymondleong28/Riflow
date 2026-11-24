import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  authenticateUserFromDatabase,
  getServerSession,
  signSessionToken,
} from "@/lib/authSession";
import { verifyTotpOrRecoveryCode } from "@/lib/connectors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const showDevLogins =
    process.env.NODE_ENV !== "production" &&
    process.env.SHOW_DEV_LOGINS === "true";

  const session = getServerSession(req);
  if (!session) {
    return NextResponse.json(
      { authenticated: false, session: null, showDevLogins },
      { status: 401 }
    );
  }
  return NextResponse.json({ authenticated: true, session, showDevLogins });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "logout") {
      const current = getServerSession(req);
      if (current) {
        await prisma.auditLog.create({
          data: {
            actor: current.email,
            actorRole: `${current.identityType} (${current.role})`,
            action: "LOGOUT",
            objectType: "Session",
            objectId: current.userId,
            summary: `User ${current.email} signed out`,
          },
        });
      }
      const res = NextResponse.json({ ok: true });
      res.cookies.delete("rprm_session");
      return res;
    }

    if (action === "impersonate") {
      const current = getServerSession(req);
      if (!current || current.identityType !== "coworker") {
        return NextResponse.json(
          { error: "Only authenticated coworkers may impersonate a partner" },
          { status: 403 }
        );
      }
      const partner = await prisma.partner.findUnique({
        where: { id: body.partnerId },
      });
      if (!partner) {
        return NextResponse.json(
          { error: "Partner not found" },
          { status: 404 }
        );
      }
      const updatedSession = {
        ...current,
        impersonatingPartnerId: partner.id,
        partnerId: partner.id,
        partnerName: partner.name,
      };
      await prisma.auditLog.create({
        data: {
          actor: current.email,
          actorRole: `Coworker (${current.role})`,
          action: "IMPERSONATE",
          objectType: "PartnerPortal",
          objectId: partner.id,
          summary: `Coworker ${current.email} started impersonation session as "${partner.name}"`,
        },
      });
      const res = NextResponse.json({ ok: true, session: updatedSession });
      res.cookies.set("rprm_session", signSessionToken(updatedSession), {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 86400,
      });
      return res;
    }

    if (action === "exit_impersonate") {
      const current = getServerSession(req);
      if (!current) {
        return NextResponse.json({ error: "Not signed in" }, { status: 401 });
      }
      const restoredSession = {
        ...current,
        impersonatingPartnerId: null,
        partnerId: null,
        partnerName: null,
      };
      const res = NextResponse.json({ ok: true, session: restoredSession });
      res.cookies.set("rprm_session", signSessionToken(restoredSession), {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 86400,
      });
      return res;
    }

    // Standard login (Coworker or Partner User)
    const surface = body.identityType === "partner" ? "partner" : "coworker";
    const authResult = await authenticateUserFromDatabase(
      body.email,
      body.password,
      surface
    );

    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    // Optional TOTP MFA verification if mfaCode is supplied
    if (body.mfaCode) {
      const mfaCheck = verifyTotpOrRecoveryCode(body.mfaCode);
      if (!mfaCheck.valid) {
        return NextResponse.json(
          { error: "Invalid TOTP authenticator or recovery code" },
          { status: 401 }
        );
      }
    }

    const session = authResult.session;
    await prisma.auditLog.create({
      data: {
        actor: session.email,
        actorRole: `${session.identityType} (${session.role})`,
        action: "AUTH",
        objectType: "Session",
        objectId: session.userId,
        summary: `Authenticated ${session.identityType} session for ${session.email} (DB-assigned role: ${session.role})`,
      },
    });

    const token = signSessionToken(session);
    const res = NextResponse.json({ ok: true, session });
    res.cookies.set("rprm_session", token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 86400,
    });
    return res;
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
