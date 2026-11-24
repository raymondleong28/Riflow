import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ lookupStatus: "found", count: logs.length, data: logs });
  } catch (error) {
    return NextResponse.json(
      { lookupStatus: "could_not_check", reason: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const entry = await prisma.auditLog.create({
      data: {
        actor: body.actor || "Alex Morgan",
        actorRole: body.actorRole || "Coworker (Admin)",
        action: body.action || "EVENT",
        objectType: body.objectType || "System",
        objectId: body.objectId || "global",
        summary: body.summary || "Audit log event",
        diffJson: JSON.stringify(body.diff || {}),
      },
    });
    return NextResponse.json({ ok: true, entry });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
