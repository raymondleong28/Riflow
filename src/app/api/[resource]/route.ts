import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  computePartnerKpis,
  computeAccountOverlaps,
  canPartnerAccessAsset,
} from "@/lib/prmEngine";

export const dynamic = "force-dynamic";

// Per-resource REST API handler (§3 Slice 0b / D13):
// Supports /api/partners, /api/programs, /api/leads, /api/deals, /api/customers,
// /api/transactions, /api/rewards, /api/payouts, /api/tasks, /api/assets,
// /api/business-plans, /api/accounts, /api/collaborations, /api/team-members
export async function GET(
  req: NextRequest,
  { params }: { params: { resource: string } }
) {
  try {
    const resource = params.resource;
    const id = req.nextUrl.searchParams.get("id");
    const partnerId = req.nextUrl.searchParams.get("partnerId");

    const scopedPartner = partnerId
      ? await prisma.partner.findUnique({ where: { id: partnerId } })
      : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let records: any[] = [];

    switch (resource) {
      case "partners": {
        const [partnersRaw, leads, deals, rewards] = await Promise.all([
          prisma.partner.findMany({ orderBy: { createdAt: "desc" } }),
          prisma.lead.findMany(),
          prisma.deal.findMany(),
          prisma.reward.findMany(),
        ]);
        records = partnersRaw.map((p) =>
          computePartnerKpis(p, leads, deals, rewards)
        );
        if (scopedPartner) {
          records = records.filter((p) => p.id === scopedPartner.id);
        }
        break;
      }
      case "programs":
        records = await prisma.program.findMany({
          orderBy: { createdAt: "asc" },
        });
        break;
      case "leads":
        records = await prisma.lead.findMany({
          orderBy: { createdAt: "desc" },
        });
        if (scopedPartner) {
          records = records.filter(
            (l) => l.sourcePartnerName === scopedPartner.name
          );
        }
        break;
      case "deals":
        records = await prisma.deal.findMany({
          orderBy: { createdAt: "desc" },
        });
        if (scopedPartner) {
          records = records.filter(
            (d) => d.partnerName === scopedPartner.name
          );
        }
        break;
      case "customers":
        records = await prisma.customer.findMany({
          orderBy: { createdAt: "desc" },
        });
        if (scopedPartner) {
          records = records.filter(
            (c) => c.sourcePartnerName === scopedPartner.name
          );
        }
        break;
      case "transactions":
        records = await prisma.transaction.findMany({
          orderBy: { createdAt: "desc" },
        });
        if (scopedPartner) {
          records = records.filter(
            (t) => t.partnerName === scopedPartner.name
          );
        }
        break;
      case "rewards":
        records = await prisma.reward.findMany({
          orderBy: { createdAt: "desc" },
        });
        if (scopedPartner) {
          records = records.filter(
            (r) => r.partnerName === scopedPartner.name
          );
        }
        break;
      case "payouts":
        records = await prisma.payout.findMany({
          orderBy: { createdAt: "desc" },
        });
        if (scopedPartner) {
          // §4.2 & §4.3: Partner-side payout list omits internal Invoice field
          records = records
            .filter((p) => p.partnerName === scopedPartner.name)
            .map(({ invoiceRef: _inv, ...rest }) => rest);
        }
        break;
      case "tasks":
        records = await prisma.task.findMany({ orderBy: { dueDate: "asc" } });
        break;
      case "assets": {
        const allAssets = await prisma.manageItem.findMany({
          where: { category: "assets" },
          orderBy: { createdAt: "desc" },
        });
        records = scopedPartner
          ? allAssets.filter((a) => canPartnerAccessAsset(a, scopedPartner))
          : allAssets;
        break;
      }
      case "business-plans":
        records = await prisma.businessPlan.findMany({
          orderBy: { createdAt: "desc" },
        });
        if (scopedPartner) {
          records = records.filter(
            (bp) => bp.partnerName === scopedPartner.name
          );
        }
        break;
      case "accounts": {
        const raw = await prisma.accountRecord.findMany({
          orderBy: { createdAt: "desc" },
        });
        records = computeAccountOverlaps(raw);
        break;
      }
      case "collaborations":
        records = await prisma.collaboration.findMany({
          orderBy: { createdAt: "desc" },
        });
        break;
      case "team-members":
        records = await prisma.partnerTeamMember.findMany({
          orderBy: { createdAt: "desc" },
        });
        if (scopedPartner) {
          records = records.filter(
            (m) => m.partnerName === scopedPartner.name
          );
        }
        break;
      default:
        return NextResponse.json(
          {
            lookupStatus: "not_found",
            reason: `Unknown resource endpoint: /api/${resource}`,
          },
          { status: 404 }
        );
    }

    if (id) {
      const found = records.find((r) => r.id === id);
      if (!found) {
        return NextResponse.json(
          {
            lookupStatus: "not_found",
            reason: `No ${resource} record found with id "${id}"`,
          },
          { status: 404 }
        );
      }
      return NextResponse.json({ lookupStatus: "found", data: found });
    }

    return NextResponse.json({
      lookupStatus: "found",
      count: records.length,
      data: records,
    });
  } catch (error) {
    return NextResponse.json(
      {
        lookupStatus: "could_not_check",
        reason: String(error),
      },
      { status: 500 }
    );
  }
}
