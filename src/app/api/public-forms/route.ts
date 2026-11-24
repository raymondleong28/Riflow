import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  resolvePartnerByLeadFormToken,
  getPartnerLeadFormToken,
} from "@/lib/prmEngine";
import { checkRateLimitKey, recordAuthFailure } from "@/lib/authSession";

export const dynamic = "force-dynamic";

// Public, unauthenticated endpoint ONLY for:
// 1. Validating an unguessable partner lead form token (/forms/lead/[token])
// 2. Validating a program ID for public application (/forms/apply/[programId])
// 3. Submitting a public referral lead (requires Eber General Terms 7.2 consent) or partner application
export async function GET(req: NextRequest) {
  try {
    const leadToken = req.nextUrl.searchParams.get("leadToken");
    const programId = req.nextUrl.searchParams.get("programId");

    if (leadToken) {
      const partners = await prisma.partner.findMany();
      const matched = resolvePartnerByLeadFormToken(leadToken, partners);
      if (!matched) {
        return NextResponse.json(
          {
            valid: false,
            lookupStatus: "not_found",
            reason: "This link isn't valid",
          },
          { status: 404 }
        );
      }
      return NextResponse.json({
        valid: true,
        lookupStatus: "found",
        partner: {
          id: matched.id,
          name: matched.name,
          programName: matched.programName,
          leadFormToken: getPartnerLeadFormToken(matched.id),
        },
      });
    }

    if (programId) {
      const prog = await prisma.program.findUnique({
        where: { id: programId },
      });
      if (!prog) {
        return NextResponse.json(
          {
            valid: false,
            lookupStatus: "not_found",
            reason: "Program not found",
          },
          { status: 404 }
        );
      }
      return NextResponse.json({
        valid: true,
        lookupStatus: "found",
        program: { id: prog.id, name: prog.name },
      });
    }

    return NextResponse.json(
      { valid: false, reason: "Missing query parameter" },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { valid: false, lookupStatus: "could_not_check", reason: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const rateKey = `public_form:${clientIp}`;
    const rateCheck = checkRateLimitKey(rateKey);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Rate limit exceeded for public form submissions. Retry in ${rateCheck.retryAfterSeconds}s.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { formType } = body;
    const payload = body.payload || body.data || {};

    if (formType === "public_lead") {
      if (!payload?.consentTerms72) {
        recordAuthFailure(rateKey);
        return NextResponse.json(
          {
            error:
              "Prospect data consent (Eber General Terms 7.2) is required before submitting a lead.",
          },
          { status: 400 }
        );
      }
      const partners = await prisma.partner.findMany();
      const matched = resolvePartnerByLeadFormToken(payload.token, partners);
      if (!matched) {
        recordAuthFailure(rateKey);
        return NextResponse.json(
          { error: "This link isn't valid" },
          { status: 404 }
        );
      }

      const lead = await prisma.lead.create({
        data: {
          firstName: payload.firstName,
          lastName: payload.lastName,
          company: payload.company,
          jobTitle: payload.jobTitle || "Decision Maker",
          email: payload.email,
          phone: payload.phone || "",
          country: payload.country || "Singapore",
          retailBrand: payload.retailBrand || payload.company,
          outletsCount: Number(payload.outletsCount) || 1,
          posSolution: payload.posSolution || "CloudPOS Pro",
          remarks: `${payload.remarks || ""} [Consent: Eber General Terms 7.2 verified]`.trim(),
          status: "Pending",
          source: "Public Partner Lead Form",
          sourcePartnerId: matched.id,
          sourcePartnerName: matched.name,
          assignedPartner: matched.name,
          assignedContact: `${matched.contactFirstName} ${matched.contactLastName}`,
          assignedDate: new Date().toISOString().slice(0, 10),
        },
      });

      await prisma.auditLog.create({
        data: {
          actor: payload.email,
          actorRole: "Public Lead Form",
          action: "CREATE",
          objectType: "Lead",
          objectId: lead.id,
          summary: `Public referral lead "${lead.firstName} ${lead.lastName}" (${lead.company}) submitted via token for ${matched.name} with Eber General Terms 7.2 consent`,
        },
      });

      return NextResponse.json({ ok: true, lead });
    }

    if (formType === "public_application") {
      const prog =
        (await prisma.program.findUnique({
          where: { id: payload.programId || "prog-strategic" },
        })) || (await prisma.program.findFirst());

      const partner = await prisma.partner.create({
        data: {
          name: payload.companyName,
          programId: prog?.id || "prog-strategic",
          programName: prog?.name || "R-Cloud Strategic Solution Partners",
          country: payload.country || "Singapore",
          contactFirstName: payload.contactFirstName,
          contactLastName: payload.contactLastName,
          contactEmail: payload.contactEmail,
          contactJobTitle: payload.contactJobTitle || "Partner Lead",
          contactPhone: payload.companyPhone || "",
          companyWebsite: payload.companyWebsite || "",
          industry: payload.industry || "Technology",
          status: "Pending",
          onboardingStatus: "Not started",
          prospectionStage: "New",
          portalAccess: false,
          activeSince: new Date().toISOString().slice(0, 10),
        },
      });

      await prisma.auditLog.create({
        data: {
          actor: payload.contactEmail,
          actorRole: "Public Applicant",
          action: "CREATE",
          objectType: "PartnerApplication",
          objectId: partner.id,
          summary: `Public partner application submitted for "${partner.name}" (${partner.programName})`,
        },
      });

      return NextResponse.json({ ok: true, partner });
    }

    return NextResponse.json({ error: "Unknown formType" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
