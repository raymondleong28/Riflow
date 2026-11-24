import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { identityType, email, partnerId, role } = body;

    await prisma.auditLog.create({
      data: {
        actor: email || "user@r-prm.example.com",
        actorRole:
          identityType === "partner"
            ? `Partner (${role || "Manager"})`
            : `Coworker (${role || "Admin"})`,
        action: "AUTH",
        objectType: "Session",
        objectId: partnerId || "admin",
        summary: `Authenticated ${identityType || "coworker"} session for ${email}`,
      },
    });

    const res = NextResponse.json({
      ok: true,
      session: {
        identityType: identityType || "coworker",
        email,
        partnerId: partnerId || null,
        role: role || (identityType === "partner" ? "Manager" : "Admin"),
      },
    });

    res.cookies.set(
      "rprm_session",
      JSON.stringify({
        identityType: identityType || "coworker",
        email,
        partnerId: partnerId || null,
        role: role || "Admin",
      }),
      { path: "/", httpOnly: false, maxAge: 86400 * 7 }
    );

    return res;
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
