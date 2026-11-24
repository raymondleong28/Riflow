import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";
import {
  computePartnerKpis,
  computeAccountOverlaps,
  convertWithDatedFx,
  normalizeRewardRule,
  canPartnerAccessAsset,
  generateRewardsFromPartnerLevel,
} from "@/lib/prmEngine";
import { getServerSession, RprmSession } from "@/lib/authSession";
import { executePayoutConnector, syncDealToHubSpotConnector } from "@/lib/connectors";
import {
  serializePartnerForPartner,
  serializeProgramForPartner,
  serializeLeadForPartner,
  serializeDealForPartner,
  serializeCustomerForPartner,
  serializeTransactionForPartner,
  serializeRewardForPartner,
  serializePayoutForPartner,
  serializeManageItemForPartner,
  serializeBusinessPlanForPartner,
  serializeCollaborationForPartner,
  serializeTrackingLinkForPartner,
  serializeTeamMemberForPartner,
  serializeNoteForPartner,
  serializeSettingsForPartner,
} from "@/lib/partnerSerializer";

export const dynamic = "force-dynamic";

async function writeAudit({
  session,
  action,
  objectType,
  objectId,
  summary,
  diff = {},
}: {
  session: RprmSession;
  action: string;
  objectType: string;
  objectId: string;
  summary: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  diff?: Record<string, any>;
}) {
  await prisma.auditLog.create({
    data: {
      actor: session.email || "Alex Morgan",
      actorRole: `${session.identityType} (${session.role})`,
      action,
      objectType,
      objectId,
      summary,
      diffJson: JSON.stringify(diff),
    },
  });
}

async function sendOrLogEmail({
  to,
  subject,
  body,
  templateName = "System Notification",
  portalLink = "",
}: {
  to: string;
  subject: string;
  body: string;
  templateName?: string;
  portalLink?: string;
}) {
  let deliveryMode = "Local Mail Catcher / Outbox";
  let smtpError = "";

  const expiresAt = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
  const activationToken = `act_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  const tokenizedLink = portalLink
    ? `${portalLink}${portalLink.includes("?") ? "&" : "?"}token=${activationToken}&expires=${encodeURIComponent(
        expiresAt
      )}`
    : "";

  const smtpRow = await prisma.appSetting.findUnique({
    where: { key: "smtp_config" },
  });
  let smtpConfig: {
    gmailUser?: string;
    gmailAppPassword?: string;
    enabled?: boolean;
  } = {};
  if (smtpRow) {
    try {
      smtpConfig = JSON.parse(smtpRow.valueJson);
    } catch {
      smtpConfig = {};
    }
  }

  const gmailUser = smtpConfig.gmailUser || process.env.GMAIL_USER;
  const gmailPass =
    smtpConfig.gmailAppPassword || process.env.GMAIL_APP_PASSWORD;

  if (gmailUser && gmailPass && smtpConfig.enabled !== false) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser,
          pass: gmailPass.replace(/\s+/g, ""),
        },
      });
      await transporter.sendMail({
        from: `"R-PRM Partner Cloud" <${gmailUser}>`,
        to,
        subject,
        html: `<div style="font-family:sans-serif;max-width:600px;padding:20px;border:1px solid #e2e8f0;border-radius:12px;">
          <h2 style="font-size:18px;color:#1e293b;">${subject}</h2>
          <div style="font-size:14px;color:#334155;line-height:1.6;white-space:pre-line;">${body}</div>
          ${
            tokenizedLink
              ? `<div style="margin-top:20px;"><a href="http://127.0.0.1:3000${tokenizedLink}" style="background:#2563eb;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Activate & Open Partner Portal →</a></div>`
              : ""
          }
        </div>`,
      });
      deliveryMode = `Delivered via Gmail SMTP (${gmailUser})`;
    } catch (err) {
      smtpError = String(err);
      deliveryMode = `Logged to Outbox (SMTP error: ${smtpError.slice(0, 60)})`;
    }
  }

  const emailLog = await prisma.manageItem.create({
    data: {
      category: "sent_emails",
      name: subject,
      subtitle: `To: ${to} · ${deliveryMode}`,
      status: deliveryMode.startsWith("Delivered")
        ? "Delivered (SMTP)"
        : "Captured in Outbox",
      metadataJson: JSON.stringify({
        to,
        subject,
        body,
        templateName,
        portalLink: tokenizedLink,
        activationToken,
        expiresAt,
        deliveryMode,
        smtpError,
        sentAt: new Date().toISOString(),
      }),
    },
  });

  return { emailLog, deliveryMode, smtpError, activationToken };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { resource: string } }
) {
  // §13.1 & §13.3: Enforce server-side session check on EVERY API request!
  // Unauthenticated requests with no session cookie receive 401 Unauthorized.
  const session = getServerSession(req);
  if (!session) {
    return NextResponse.json(
      {
        lookupStatus: "could_not_check",
        error: "Authentication required: missing or invalid httpOnly session cookie",
      },
      { status: 401 }
    );
  }

  try {
    const resource = params.resource;
    const id = req.nextUrl.searchParams.get("id");

    // §13.1 & §13.3: Scope on the server from the session, NEVER from a query parameter!
    const effectivePartnerId =
      session.identityType === "partner"
        ? session.partnerId
        : session.impersonatingPartnerId || null;

    const scopedPartner = effectivePartnerId
      ? await prisma.partner.findUnique({ where: { id: effectivePartnerId } })
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
        const computed = partnersRaw.map((p) =>
          computePartnerKpis(p, leads, deals, rewards)
        );
        const scoped = scopedPartner
          ? computed.filter((p) => p.id === scopedPartner.id)
          : computed;

        if (session.identityType === "partner") {
          records = scoped.map((p) =>
            serializePartnerForPartner(p, Boolean(id && session.role === "Manager"))
          );
          break;
        }

        // §13.1 Bank details lockdown: strip bankDetailsJson from all collection list responses!
        // Return bankDetailsJson ONLY on single-partner requests (?id=...) to authorized roles.
        if (!id) {
          records = scoped.map(({ bankDetailsJson: _bank, ...rest }) => rest);
        } else {
          records = scoped;
        }
        break;
      }

      case "programs": {
        const [programsRaw, partnersRaw, leads, deals, rewards] =
          await Promise.all([
            prisma.program.findMany({ orderBy: { createdAt: "asc" } }),
            prisma.partner.findMany(),
            prisma.lead.findMany(),
            prisma.deal.findMany(),
            prisma.reward.findMany(),
          ]);
        const computedPartners = partnersRaw.map((p) =>
          computePartnerKpis(p, leads, deals, rewards)
        );

        // §14.2 Slice 2 & §15.2 Slice 2: Partner sessions receive ONLY their own program, and within it ONLY the level they are on!
        if (session.identityType === "partner" && scopedPartner) {
          const ownProg = programsRaw.find(
            (pr) =>
              pr.id === scopedPartner.programId ||
              pr.name === scopedPartner.programName
          );
          records = ownProg
            ? [serializeProgramForPartner(ownProg, scopedPartner.qualifyingLevel)]
            : [];
          break;
        }

        records = programsRaw.map((prog) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let levels: any[] = [];
          try {
            levels = JSON.parse(prog.levelsJson || "[]");
          } catch {
            levels = [];
          }
          const normalizedLevels = levels.map((lvl) => ({
            ...lvl,
            rewards: Array.isArray(lvl.rewards)
              ? lvl.rewards.map(normalizeRewardRule)
              : [],
          }));
          const progPartners = computedPartners.filter(
            (p) => p.programId === prog.id || p.programName === prog.name
          );
          return {
            ...prog,
            levelsJson: JSON.stringify(normalizedLevels),
            partnerCount: progPartners.length,
            pendingApplications: progPartners.filter(
              (p) => p.status === "Pending"
            ).length,
            submittedLeads365d: progPartners.reduce(
              (s, p) => s + p.submittedLeads365d,
              0
            ),
            registeredDeals365d: progPartners.reduce(
              (s, p) => s + p.registeredDeals365d,
              0
            ),
            sourcedRevenue365d: progPartners.reduce(
              (s, p) => s + p.sourcedRevenue365d,
              0
            ),
            influencedRev365d: progPartners.reduce(
              (s, p) => s + p.influencedRev365d,
              0
            ),
          };
        });
        break;
      }

      case "leads":
        records = await prisma.lead.findMany({
          orderBy: { createdAt: "desc" },
        });
        if (scopedPartner) {
          records = records.filter(
            (l) => l.sourcePartnerName === scopedPartner.name
          );
          if (session.identityType === "partner") {
            records = records.map(serializeLeadForPartner);
          }
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
          if (session.identityType === "partner") {
            records = records.map(serializeDealForPartner);
          }
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
          if (session.identityType === "partner") {
            records = records.map(serializeCustomerForPartner);
          }
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
          if (session.identityType === "partner") {
            records = records.map(serializeTransactionForPartner);
          }
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
          if (session.identityType === "partner") {
            records = records.map(serializeRewardForPartner);
          }
        }
        break;

      case "payouts":
        records = await prisma.payout.findMany({
          orderBy: { createdAt: "desc" },
        });
        if (scopedPartner) {
          // §4.2 & §15.2 Slice 2: Partner-side list omits internal Invoice field via allowlist serializer
          records = records
            .filter((p) => p.partnerName === scopedPartner.name)
            .map(serializePayoutForPartner);
        }
        break;

      case "tasks":
        if (session.identityType === "partner") {
          return NextResponse.json(
            { lookupStatus: "could_not_check", error: "Forbidden for partner role" },
            { status: 403 }
          );
        }
        records = await prisma.task.findMany({ orderBy: { dueDate: "asc" } });
        break;

      case "assets": {
        // §13.1 D6 & §15.2 Slice 2: Scope on server from session and return explicit partner allowlist (no metadataJson!)
        const allAssets = await prisma.manageItem.findMany({
          where: { category: "assets" },
          orderBy: { createdAt: "desc" },
        });
        if (scopedPartner) {
          const allowed = allAssets.filter((a) =>
            canPartnerAccessAsset(a, scopedPartner)
          );
          records =
            session.identityType === "partner"
              ? allowed.map((a) =>
                  serializeManageItemForPartner(
                    a,
                    scopedPartner.name,
                    scopedPartner.programName
                  )
                )
              : allowed;
        } else {
          records = allAssets;
        }
        break;
      }

      case "manage-items": {
        const allItems = await prisma.manageItem.findMany({
          orderBy: { createdAt: "desc" },
        });
        if (scopedPartner) {
          const allowed = allItems.filter((item) => {
            if (item.category === "assets") {
              return canPartnerAccessAsset(item, scopedPartner);
            }
            return ["news", "help_articles", "certifications"].includes(
              item.category
            );
          });
          records =
            session.identityType === "partner"
              ? allowed.map((item) =>
                  serializeManageItemForPartner(
                    item,
                    scopedPartner.name,
                    scopedPartner.programName
                  )
                )
              : allowed;
        } else {
          records = allItems;
        }
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
          if (session.identityType === "partner") {
            records = records.map(serializeBusinessPlanForPartner);
          }
        }
        break;

      case "accounts": {
        if (session.identityType === "partner") {
          return NextResponse.json(
            { lookupStatus: "could_not_check", error: "Forbidden for partner role" },
            { status: 403 }
          );
        }
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
        if (scopedPartner) {
          records = records.filter(
            (c) => c.partnerName === scopedPartner.name
          );
          if (session.identityType === "partner") {
            records = records.map(serializeCollaborationForPartner);
          }
        }
        break;

      case "data-sources":
        if (session.identityType === "partner") {
          return NextResponse.json(
            { lookupStatus: "could_not_check", error: "Forbidden for partner role" },
            { status: 403 }
          );
        }
        records = await prisma.dataSource.findMany({
          orderBy: { createdAt: "desc" },
        });
        break;

      case "tracking-links":
        records = await prisma.trackingLink.findMany({
          orderBy: { createdAt: "desc" },
        });
        if (scopedPartner) {
          records = records.filter(
            (l) => l.partnerName === scopedPartner.name
          );
          if (session.identityType === "partner") {
            records = records.map(serializeTrackingLinkForPartner);
          }
        }
        break;

      case "team-members":
        records = await prisma.partnerTeamMember.findMany({
          orderBy: { createdAt: "desc" },
        });
        if (scopedPartner) {
          records = records.filter(
            (m) => m.partnerName === scopedPartner.name
          );
          if (session.identityType === "partner") {
            records = records.map(serializeTeamMemberForPartner);
          }
        }
        break;

      case "notes":
        records = await prisma.noteItem.findMany({
          orderBy: { createdAt: "desc" },
        });
        if (scopedPartner) {
          records = records.filter(
            (n) =>
              n.isShared &&
              (n.entityId === scopedPartner.id ||
                n.author
                  .toLowerCase()
                  .includes(scopedPartner.contactFirstName.toLowerCase()))
          );
          if (session.identityType === "partner") {
            records = records.map(serializeNoteForPartner);
          }
        }
        break;

      case "settings": {
        const rows = await prisma.appSetting.findMany();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const settingsMap: Record<string, any> = {};
        for (const row of rows) {
          try {
            settingsMap[row.key] = JSON.parse(row.valueJson);
          } catch {
            settingsMap[row.key] = row.valueJson;
          }
        }
        // §15.2 Slice 3: Partner sessions receive ONLY portal branding, main currency, payout providers, self-invoicing enabled, and their own user_preferences!
        if (session.identityType === "partner") {
          return NextResponse.json({
            lookupStatus: "found",
            data: serializeSettingsForPartner(
              settingsMap,
              scopedPartner,
              session.email
            ),
          });
        }
        return NextResponse.json({
          lookupStatus: "found",
          data: settingsMap,
        });
      }

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

export async function POST(req: NextRequest) {
  const session = getServerSession(req);
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { action, payload } = body;

    // Partner users may only submit leads, register deals, or update their own banking/self-invoicing
    if (
      session.identityType === "partner" &&
      ![
        "CREATE_LEAD",
        "CREATE_DEAL",
        "UPDATE_PARTNER",
        "CREATE_NOTE",
      ].includes(action)
    ) {
      return NextResponse.json(
        { error: `Forbidden: Partner role cannot execute ${action}` },
        { status: 403 }
      );
    }

    switch (action) {
      case "CREATE_PARTNER": {
        const partner = await prisma.partner.create({
          data: {
            name: payload.name,
            programId: payload.programId || "prog-strategic",
            programName:
              payload.programName || "R-Cloud Strategic Solution Partners",
            country: payload.country || "Singapore",
            language: payload.language || "English",
            currency: payload.currency || "SGD",
            partnerType: payload.partnerType || "Reseller",
            qualifyingLevel: payload.qualifyingLevel || "Silver Tier",
            status: payload.status || "Active",
            onboardingStatus: payload.onboardingStatus || "In progress",
            onboardingStage:
              payload.onboardingStage || "Kickoff Welcome Call",
            prospectionStage: payload.prospectionStage || "New",
            contactFirstName: payload.contactFirstName || "Alex",
            contactLastName: payload.contactLastName || "Partner",
            contactEmail:
              payload.contactEmail || "contact@partner.example.com",
            contactJobTitle: payload.contactJobTitle || "Partner Manager",
            contactPhone: payload.contactPhone || "+65 6000 0000",
            portalAccess: payload.portalAccess ?? true,
            companyWebsite:
              payload.companyWebsite || "https://partner.example.com",
            industry: payload.industry || "Cloud & SaaS Consulting",
            activeSince: new Date().toISOString().slice(0, 10),
          },
        });

        await writeAudit({
          session,
          action: "CREATE",
          objectType: "Partner",
          objectId: partner.id,
          summary: `Enrolled partner "${partner.name}" (portalAccess=${partner.portalAccess}, status=${partner.status})`,
          diff: payload,
        });

        if (partner.portalAccess) {
          await sendOrLogEmail({
            to: partner.contactEmail,
            subject: `Welcome to R-PRM! Activate your Partner Portal for ${partner.name}`,
            body: `Hi ${partner.contactFirstName},\n\nYou have been enrolled in "${partner.programName}" (${partner.qualifyingLevel}).`,
            templateName: "Notify accepted partner",
            portalLink: `/p?partnerId=${partner.id}`,
          });
        }
        return NextResponse.json({ ok: true, partner });
      }

      case "REVIEW_PARTNER_APPLICATION": {
        const { partnerId, mode, rejectionReason, reapplyAfterDate } = payload;
        const existing = await prisma.partner.findUnique({
          where: { id: partnerId },
        });
        if (!existing) {
          return NextResponse.json(
            { error: "Partner not found" },
            { status: 404 }
          );
        }
        if (mode === "reject" && !String(rejectionReason || "").trim()) {
          return NextResponse.json(
            { error: "A rejection reason is required" },
            { status: 400 }
          );
        }
        const nextStatus =
          mode === "accept_active"
            ? "Active"
            : mode === "accept_prospect"
            ? "Onboarding"
            : "Inactive";
        const partner = await prisma.partner.update({
          where: { id: partnerId },
          data: {
            status: nextStatus,
            portalAccess: mode === "accept_active",
            prospectionStage:
              mode === "accept_active" ? "Active" : "New",
          },
        });

        await writeAudit({
          session,
          action: "UPDATE",
          objectType: "PartnerApplication",
          objectId: partner.id,
          summary: `Application for "${partner.name}" reviewed: ${mode}${
            rejectionReason ? ` (Reason: ${rejectionReason})` : ""
          }`,
          diff: { mode, rejectionReason, reapplyAfterDate },
        });

        if (mode === "accept_active") {
          await sendOrLogEmail({
            to: partner.contactEmail,
            subject: `Approved! Activate your R-PRM Partner Portal for ${partner.name}`,
            body: `Hi ${partner.contactFirstName},\n\nYour application for ${partner.programName} has been accepted as an Active Partner.`,
            templateName: "Notify accepted partner",
            portalLink: `/p?partnerId=${partner.id}`,
          });
        } else if (mode === "reject") {
          await sendOrLogEmail({
            to: partner.contactEmail,
            subject: `Update on your R-PRM Partner Application (${partner.name})`,
            body: `Hi ${partner.contactFirstName},\n\nReason: ${rejectionReason}`,
            templateName: "Notify rejected partner",
          });
        }
        return NextResponse.json({ ok: true, partner });
      }

      case "UPDATE_PARTNER": {
        const targetId =
          session.identityType === "partner" ? session.partnerId : payload.id;
        const partner = await prisma.partner.update({
          where: { id: targetId! },
          data: payload.data,
        });
        await writeAudit({
          session,
          action: "UPDATE",
          objectType: "Partner",
          objectId: partner.id,
          summary: `Updated partner "${partner.name}"`,
          diff: payload.data,
        });
        return NextResponse.json({ ok: true, partner });
      }

      case "CREATE_TEAM_MEMBER": {
        const member = await prisma.partnerTeamMember.create({
          data: {
            name: payload.name,
            email: payload.email,
            jobTitle: payload.jobTitle || "Partner Rep",
            phone: payload.phone || "+65 6000 1111",
            partnerName:
              payload.partnerName || "Apex Cloud Solutions Pte Ltd",
            role: payload.role || "Sales Rep",
            status: payload.portalAccess === false ? "Inactive" : "Sent",
            invitedAt: new Date().toISOString().slice(0, 10),
          },
        });
        await writeAudit({
          session,
          action: "CREATE",
          objectType: "PartnerTeamMember",
          objectId: member.id,
          summary: `Added partner team member "${member.name}" (${member.role}) for ${member.partnerName}`,
        });
        return NextResponse.json({ ok: true, member });
      }

      case "BULK_TEAM_MEMBERS": {
        const { memberIds, bulkAction, role } = payload;
        if (bulkAction === "delete") {
          await prisma.partnerTeamMember.deleteMany({
            where: { id: { in: memberIds } },
          });
        } else if (bulkAction === "update_role" && role) {
          await prisma.partnerTeamMember.updateMany({
            where: { id: { in: memberIds } },
            data: { role },
          });
        } else if (bulkAction === "set_main_contact") {
          const first = await prisma.partnerTeamMember.findUnique({
            where: { id: memberIds[0] },
          });
          if (first) {
            const parts = first.name.split(" ");
            await prisma.partner.updateMany({
              where: { name: first.partnerName },
              data: {
                contactFirstName: parts[0] || first.name,
                contactLastName: parts.slice(1).join(" ") || "Contact",
                contactEmail: first.email,
                contactJobTitle: first.jobTitle,
                contactPhone: first.phone,
              },
            });
          }
        }
        await writeAudit({
          session,
          action: "UPDATE",
          objectType: "PartnerTeamMember",
          objectId: memberIds.join(","),
          summary: `Executed bulk action "${bulkAction}" on ${memberIds.length} team member(s)`,
        });
        return NextResponse.json({ ok: true });
      }

      case "CREATE_LEAD": {
        const partnerName =
          session.identityType === "partner" && session.partnerName
            ? session.partnerName
            : payload.sourcePartnerName || "Apex Cloud Solutions Pte Ltd";
        const lead = await prisma.lead.create({
          data: {
            firstName: payload.firstName,
            lastName: payload.lastName,
            company: payload.company,
            jobTitle: payload.jobTitle || "Decision Maker",
            email: payload.email || "lead@company.example.com",
            phone: payload.phone || "+65 9000 0000",
            country: payload.country || "Singapore",
            retailBrand: payload.retailBrand || payload.company,
            outletsCount: Number(payload.outletsCount) || 1,
            website: payload.website || "https://company.example.com",
            posSolution: payload.posSolution || "CloudPOS Pro",
            remarks: payload.remarks || "",
            status: "Pending",
            source: payload.source || "Partner Portal",
            sourcePartnerName: partnerName,
            assignedPartner: payload.assignedPartner || partnerName,
            assignedContact: payload.assignedContact || session.name,
            assignedDate: new Date().toISOString().slice(0, 10),
            deadline: payload.deadline || "2026-12-31",
          },
        });
        await writeAudit({
          session,
          action: "CREATE",
          objectType: "Lead",
          objectId: lead.id,
          summary: `Created lead "${lead.firstName} ${lead.lastName}" (${lead.company}) for ${partnerName}`,
        });
        return NextResponse.json({ ok: true, lead });
      }

      case "UPDATE_LEAD_STATUS": {
        const lead = await prisma.lead.update({
          where: { id: payload.id },
          data: {
            status: payload.status,
            acceptedBy: payload.status === "Accepted" ? session.name : "",
            acceptedDate:
              payload.status === "Accepted"
                ? new Date().toISOString().slice(0, 10)
                : "",
          },
        });
        await writeAudit({
          session,
          action: "UPDATE",
          objectType: "Lead",
          objectId: lead.id,
          summary: `Lead "${lead.firstName} ${lead.lastName}" marked ${payload.status}`,
        });
        return NextResponse.json({ ok: true, lead });
      }

      case "CONVERT_LEAD_TO_DEAL": {
        const lead = await prisma.lead.findUnique({
          where: { id: payload.leadId },
        });
        if (!lead)
          return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        const amount = Number(payload.amount) || 18000;
        const fx = convertWithDatedFx(amount, payload.currency || "SGD");
        const deal = await prisma.deal.create({
          data: {
            name:
              payload.dealName ||
              `OPP - ${lead.company} (${lead.retailBrand || "Rollout"})`,
            owner: lead.owner || "Alex Morgan",
            clientName: `${lead.firstName} ${lead.lastName}`,
            company: lead.company,
            amount,
            currency: fx.currency,
            amountSgd: fx.amountSgd,
            partnerName: lead.sourcePartnerName,
            assignedContact: lead.assignedContact,
            status: "Accepted",
            stage: "Discovery Stage",
            stageEnteredAt: new Date().toISOString().slice(0, 10),
            source: "Lead Conversion",
            sourcePartnerName: lead.sourcePartnerName,
            closeDate: payload.closeDate || "2027-01-31",
            expirationDate: "2027-04-30",
            sourceLeadId: lead.id,
          },
        });
        await prisma.lead.update({
          where: { id: lead.id },
          data: { status: "Converted", convertedDealId: deal.id },
        });
        await writeAudit({
          session,
          action: "CREATE",
          objectType: "Deal",
          objectId: deal.id,
          summary: `Converted lead "${lead.firstName} ${lead.lastName}" to Deal "${deal.name}"`,
        });
        return NextResponse.json({ ok: true, deal });
      }

      case "CREATE_DEAL": {
        const amount = Number(payload.amount) || 15000;
        const fx = convertWithDatedFx(amount, payload.currency || "SGD");
        const partnerName =
          session.identityType === "partner" && session.partnerName
            ? session.partnerName
            : payload.partnerName || "Apex Cloud Solutions Pte Ltd";
        const deal = await prisma.deal.create({
          data: {
            name: payload.name,
            owner: payload.owner || "Alex Morgan",
            clientName: payload.clientName || "Enterprise Buyer",
            company: payload.company || payload.name,
            amount,
            currency: fx.currency,
            amountSgd: fx.amountSgd,
            partnerName,
            assignedContact: payload.assignedContact || session.name,
            status: payload.status || "Accepted",
            stage: payload.stage || "Discovery Stage",
            stageEnteredAt: new Date().toISOString().slice(0, 10),
            source: "Partner Registration",
            sourcePartnerName: partnerName,
            closeDate: payload.closeDate || "2027-01-15",
            expirationDate: payload.expirationDate || "2027-04-15",
            dealType: payload.dealType || "New Business",
            subscriptionPlan: payload.subscriptionPlan || "Enterprise Annual",
            comment: payload.comment || "",
            lineItemsJson: JSON.stringify([
              {
                id: "li-1",
                product: "R-PRM Platform Annual Subscription",
                qty: 1,
                unitPrice: amount,
                total: amount,
              },
            ]),
          },
        });
        await writeAudit({
          session,
          action: "CREATE",
          objectType: "Deal",
          objectId: deal.id,
          summary: `Registered deal "${deal.name}" for ${partnerName} (SGD ${fx.amountSgd})`,
        });
        return NextResponse.json({ ok: true, deal });
      }

      case "UPDATE_DEAL_STAGE": {
        const deal = await prisma.deal.update({
          where: { id: payload.id },
          data: {
            stage: payload.stage,
            status: payload.status || undefined,
            stageEnteredAt: new Date().toISOString().slice(0, 10),
          },
        });

        const hsSync = syncDealToHubSpotConnector(deal);
        await writeAudit({
          session,
          action: "UPDATE",
          objectType: "Deal",
          objectId: deal.id,
          summary: `Deal "${deal.name}" moved to stage "${payload.stage}" (HubSpot mapped stage: ${hsSync.mappedStage})`,
        });

        // §13.1 Reward generation fix: use Partner's ACTUAL tier level rules (e.g. Platinum 25% + 5%)!
        if (payload.stage === "Closed Won") {
          const existingReward = await prisma.reward.findFirst({
            where: {
              fromActivity: deal.name,
              partnerName: deal.partnerName,
            },
          });
          if (!existingReward) {
            const [partner, programs] = await Promise.all([
              prisma.partner.findFirst({ where: { name: deal.partnerName } }),
              prisma.program.findMany(),
            ]);
            if (partner) {
              const generated = generateRewardsFromPartnerLevel(
                {
                  id: deal.id,
                  name: deal.name,
                  amount: deal.amount,
                  currency: deal.currency,
                  partnerName: deal.partnerName,
                },
                partner,
                programs
              );
              for (const g of generated) {
                const newReward = await prisma.reward.create({
                  data: {
                    rewardNumber: `RW-${Math.floor(
                      1050 + Math.random() * 8900
                    )}`,
                    partnerName: g.partnerName,
                    recipientName: g.recipientName,
                    type: g.type,
                    amount: g.amount,
                    currency: g.currency,
                    amountSgd: g.amountSgd,
                    fromActivity: g.fromActivity,
                    fromRewardRule: g.fromRewardRule,
                    status: g.status,
                    comment: g.comment,
                  },
                });
                await writeAudit({
                  session,
                  action: "CREATE",
                  objectType: "Reward",
                  objectId: newReward.id,
                  summary: `Generated tier reward ${newReward.rewardNumber} (SGD ${g.amountSgd}, ${g.fromRewardRule}) for ${g.partnerName}`,
                });
              }
            }
          }
        }
        return NextResponse.json({ ok: true, deal });
      }

      case "UPDATE_DEAL_LINE_ITEMS": {
        const lineItems = payload.lineItems || [];
        const newTotal = lineItems.reduce(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (sum: number, item: any) => sum + Number(item.total || 0),
          0
        );
        const existing = await prisma.deal.findUnique({
          where: { id: payload.dealId },
        });
        const fx = convertWithDatedFx(newTotal, existing?.currency || "SGD");
        const deal = await prisma.deal.update({
          where: { id: payload.dealId },
          data: {
            lineItemsJson: JSON.stringify(lineItems),
            amount: newTotal,
            amountSgd: fx.amountSgd,
          },
        });
        await writeAudit({
          session,
          action: "UPDATE",
          objectType: "DealLineItems",
          objectId: deal.id,
          summary: `Updated line items on deal "${deal.name}" (New total: SGD ${fx.amountSgd})`,
        });
        return NextResponse.json({ ok: true, deal });
      }

      case "ASSOCIATE_DEAL_CUSTOMER": {
        const deal = await prisma.deal.findUnique({
          where: { id: payload.dealId },
        });
        if (!deal)
          return NextResponse.json({ error: "Deal not found" }, { status: 404 });
        const customer = await prisma.customer.create({
          data: {
            name: deal.company,
            email:
              payload.email ||
              `billing@${deal.company
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "")}.example.com`,
            status: "Paying",
            source: "Deal Conversion",
            sourcePartnerName: deal.partnerName,
            becamePayingDate: new Date().toISOString().slice(0, 10),
            bbid: `BB-${Math.floor(2100 + Math.random() * 900)}`,
            sourceDealId: deal.id,
            subscriptionPlan: deal.subscriptionPlan,
            billingFrequency: "Yearly",
            billingPeriod: "12 Months",
            transactionsCount: 1,
            revenuesSgd: deal.amountSgd,
          },
        });
        await writeAudit({
          session,
          action: "CREATE",
          objectType: "Customer",
          objectId: customer.id,
          summary: `Associated customer "${customer.name}" from deal "${deal.name}"`,
        });
        return NextResponse.json({ ok: true, customer });
      }

      case "CREATE_CUSTOMER": {
        const customer = await prisma.customer.create({
          data: {
            name: payload.name,
            email: payload.email,
            status: payload.status || "Paying",
            source: payload.source || "Manual Entry",
            sourcePartnerName:
              payload.sourcePartnerName || "Apex Cloud Solutions Pte Ltd",
            becamePayingDate:
              payload.becamePayingDate ||
              new Date().toISOString().slice(0, 10),
            bbid: payload.bbid || `BB-${Math.floor(2100 + Math.random() * 900)}`,
            sourceDealId: payload.sourceDealId || "",
            subscriptionPlan: payload.subscriptionPlan || "Enterprise Annual",
            billingFrequency: payload.billingFrequency || "Yearly",
            billingPeriod: payload.billingPeriod || "12 Months",
            revenuesSgd: Number(payload.revenuesSgd) || 12000,
          },
        });
        await writeAudit({
          session,
          action: "CREATE",
          objectType: "Customer",
          objectId: customer.id,
          summary: `Created customer "${customer.name}"`,
        });
        return NextResponse.json({ ok: true, customer });
      }

      case "CREATE_TRANSACTION": {
        const amount = Number(payload.amount) || 9500;
        const fx = convertWithDatedFx(amount, payload.currency || "SGD");
        const partnerName =
          payload.partnerName || "Apex Cloud Solutions Pte Ltd";
        const tx = await prisma.transaction.create({
          data: {
            name:
              payload.name ||
              `INV-2026-${Math.floor(
                910 + Math.random() * 90
              )} · Subscription Invoice`,
            amount,
            currency: fx.currency,
            amountSgd: fx.amountSgd,
            partnerName,
            customerName:
              payload.customerName || "Solaris Luxury Resort Group",
            dealName:
              payload.dealName ||
              "ENT - Solaris Luxury Resort Group (Annual)",
            monthKey: payload.monthKey || "11/2026",
          },
        });

        // Generate rewards from the Partner's actual tier level rules (§13.1)!
        const [partner, programs] = await Promise.all([
          prisma.partner.findFirst({ where: { name: partnerName } }),
          prisma.program.findMany(),
        ]);
        if (partner) {
          const generated = generateRewardsFromPartnerLevel(
            {
              id: tx.id,
              name: tx.name,
              amount: tx.amount,
              currency: tx.currency,
              partnerName: tx.partnerName,
            },
            partner,
            programs
          );
          for (const g of generated) {
            await prisma.reward.create({
              data: {
                rewardNumber: `RW-${Math.floor(1050 + Math.random() * 8900)}`,
                partnerName: g.partnerName,
                recipientName: g.recipientName,
                type: g.type,
                amount: g.amount,
                currency: g.currency,
                amountSgd: g.amountSgd,
                fromActivity: g.fromActivity,
                fromRewardRule: g.fromRewardRule,
                status: g.status,
                comment: g.comment,
              },
            });
          }
        }

        await writeAudit({
          session,
          action: "CREATE",
          objectType: "Transaction",
          objectId: tx.id,
          summary: `Recorded transaction "${tx.name}" (SGD ${fx.amountSgd}) and computed tier rewards`,
        });
        return NextResponse.json({ ok: true, transaction: tx });
      }

      case "CREATE_REWARD": {
        const amount = Number(payload.amount) || 1000;
        const fx = convertWithDatedFx(amount, payload.currency || "SGD");
        const reward = await prisma.reward.create({
          data: {
            rewardNumber: `RW-${Math.floor(1050 + Math.random() * 8900)}`,
            partnerName:
              payload.partnerName || "Apex Cloud Solutions Pte Ltd",
            recipientName:
              payload.partnerName || "Apex Cloud Solutions Pte Ltd",
            type: payload.type || "Cash",
            amount,
            currency: fx.currency,
            amountSgd: fx.amountSgd,
            fromActivity: payload.fromActivity || "Manual Bonus / Milestone",
            fromRewardRule:
              payload.fromRewardRule || "One-time Commission Bonus",
            status: "Pending",
            comment: `${
              payload.comment || ""
            } [FX ${fx.fxRate} dated ${fx.fxRateDate}]`.trim(),
          },
        });
        await writeAudit({
          session,
          action: "CREATE",
          objectType: "Reward",
          objectId: reward.id,
          summary: `Created reward ${reward.rewardNumber} (SGD ${fx.amountSgd})`,
        });
        return NextResponse.json({ ok: true, reward });
      }

      case "UPDATE_REWARD_STATUS": {
        const existing = await prisma.reward.findUnique({
          where: { id: payload.id },
        });
        if (!existing)
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        const nextComment = payload.reason
          ? `${existing.comment || ""} | Refusal reason: ${payload.reason}`.trim()
          : existing.comment;
        const reward = await prisma.reward.update({
          where: { id: payload.id },
          data: {
            status: payload.status,
            comment: nextComment,
          },
        });
        await writeAudit({
          session,
          action: payload.status === "Refused" ? "REFUSE" : "VALIDATE",
          objectType: "Reward",
          objectId: reward.id,
          summary: `Reward ${reward.rewardNumber} status changed to "${payload.status}"`,
        });
        return NextResponse.json({ ok: true, reward });
      }

      case "CLAWBACK_REWARD": {
        const orig = await prisma.reward.findUnique({
          where: { id: payload.id },
        });
        if (!orig)
          return NextResponse.json(
            { error: "Original reward not found" },
            { status: 404 }
          );
        await prisma.reward.update({
          where: { id: orig.id },
          data: {
            status: "Clawed back",
            comment: `${orig.comment || ""} | Reversed via Clawback (${
              payload.reason || "Underlying invoice refunded"
            })`.trim(),
          },
        });
        const clawbackAdjustment = await prisma.reward.create({
          data: {
            rewardNumber: `${orig.rewardNumber}-CB`,
            partnerName: orig.partnerName,
            recipientName: orig.recipientName,
            type: orig.type,
            amount: -Math.abs(orig.amount),
            currency: orig.currency,
            amountSgd: -Math.abs(orig.amountSgd),
            fromActivity: `CLAWBACK: ${orig.fromActivity}`,
            fromRewardRule: orig.fromRewardRule,
            status: "Clawed back",
            comment: `Negative clawback adjustment for ${orig.rewardNumber}: ${
              payload.reason || "Payment refunded"
            }`,
          },
        });
        await writeAudit({
          session,
          action: "CLAWBACK",
          objectType: "Reward",
          objectId: orig.id,
          summary: `Clawed back reward ${orig.rewardNumber} -> negative adjustment ${clawbackAdjustment.rewardNumber} (SGD ${clawbackAdjustment.amountSgd})`,
        });
        return NextResponse.json({ ok: true, clawbackAdjustment });
      }

      case "CREATE_PAYOUT": {
        const partnerName =
          payload.partnerName || "Apex Cloud Solutions Pte Ltd";
        const eligibleRewards = await prisma.reward.findMany({
          where: {
            partnerName,
            status: { in: ["Pending", "Accepted"] },
          },
        });
        const sumSgd =
          eligibleRewards.reduce((acc, r) => acc + r.amountSgd, 0) ||
          Number(payload.amount) ||
          2500;
        const payoutNumber = `PO-2026-${Math.floor(10 + Math.random() * 89)}`;
        const payout = await prisma.payout.create({
          data: {
            payoutNumber,
            name:
              payload.name || `Partner Payout Settlement — ${partnerName}`,
            partnerName,
            amount: sumSgd,
            currency: payload.currency || "SGD",
            amountSgd: sumSgd,
            periodFrom: payload.periodFrom || "2026-01-01",
            periodTo: payload.periodTo || "2026-11-30",
            rewardsCount: Math.max(eligibleRewards.length, 1),
            status: "Ready",
            invoiceRef: `SELF-INV-${Math.floor(100 + Math.random() * 899)}`,
          },
        });
        if (eligibleRewards.length > 0) {
          await prisma.reward.updateMany({
            where: { id: { in: eligibleRewards.map((r) => r.id) } },
            data: { status: "Accepted", payoutNumber },
          });
        }
        await writeAudit({
          session,
          action: "CREATE",
          objectType: "Payout",
          objectId: payout.id,
          summary: `Created payout ${payout.payoutNumber} for ${partnerName} (SGD ${sumSgd})`,
        });
        return NextResponse.json({ ok: true, payout });
      }

      case "MARK_PAYOUT_PAID": {
        const existing = await prisma.payout.findUnique({
          where: { id: payload.id },
        });
        if (!existing)
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        const connectorRes = executePayoutConnector(existing);
        const payout = await prisma.payout.update({
          where: { id: payload.id },
          data: {
            status: "Paid",
            paidDate: new Date().toISOString().slice(0, 10),
          },
        });
        await prisma.reward.updateMany({
          where: { payoutNumber: payout.payoutNumber },
          data: { status: "Paid" },
        });
        await writeAudit({
          session,
          action: "UPDATE",
          objectType: "Payout",
          objectId: payout.id,
          summary: `Marked payout ${payout.payoutNumber} Paid via ${connectorRes.driver} driver (${connectorRes.settlementReference})`,
        });
        return NextResponse.json({ ok: true, payout });
      }

      case "CREATE_TASK": {
        const task = await prisma.task.create({
          data: {
            name: payload.name,
            status: payload.status || "Upcoming",
            type: payload.type || "Follow-up",
            dueDate: payload.dueDate || "2026-12-01",
            dueTime: payload.dueTime || "09:00 AM",
            description: payload.description || "",
            assignedTo: payload.assignedTo || "Alex Morgan",
            associationType: payload.associationType || "Partner",
            associationName:
              payload.associationName || "Apex Cloud Solutions Pte Ltd",
          },
        });
        await writeAudit({
          session,
          action: "CREATE",
          objectType: "Task",
          objectId: task.id,
          summary: `Created task "${task.name}"`,
        });
        return NextResponse.json({ ok: true, task });
      }

      case "TOGGLE_TASK": {
        const existing = await prisma.task.findUnique({
          where: { id: payload.id },
        });
        if (!existing)
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        const nextStatus =
          existing.status === "Completed" ? "Upcoming" : "Completed";
        const task = await prisma.task.update({
          where: { id: payload.id },
          data: {
            status: nextStatus,
            completedBy: nextStatus === "Completed" ? session.name : "",
            completedDate:
              nextStatus === "Completed"
                ? new Date().toISOString().slice(0, 10)
                : "",
          },
        });
        await writeAudit({
          session,
          action: "UPDATE",
          objectType: "Task",
          objectId: task.id,
          summary: `Task "${task.name}" marked ${nextStatus}`,
        });
        return NextResponse.json({ ok: true, task });
      }

      case "CREATE_BUSINESS_PLAN": {
        const plan = await prisma.businessPlan.create({
          data: {
            name: payload.name,
            partnerName:
              payload.partnerName || "Apex Cloud Solutions Pte Ltd",
            partnerOwner: payload.partnerOwner || "Alex Morgan",
            status: payload.status || "Active",
            description: payload.description || "",
            startDate: payload.startDate || "2026-11-01",
            endDate: payload.endDate || "2027-10-31",
            achievedPct: Number(payload.achievedPct) || 25,
          },
        });
        await writeAudit({
          session,
          action: "CREATE",
          objectType: "BusinessPlan",
          objectId: plan.id,
          summary: `Created business plan "${plan.name}"`,
        });
        return NextResponse.json({ ok: true, plan });
      }

      case "CREATE_PROGRAM": {
        const first = await prisma.program.findFirst();
        const prog = await prisma.program.create({
          data: {
            name: payload.name,
            owner: payload.owner || "Alex Morgan",
            levelsJson: first?.levelsJson || "[]",
            autoEmailsJson: first?.autoEmailsJson || "{}",
            permissionsJson: first?.permissionsJson || "{}",
            partnerCount: 0,
          },
        });
        await writeAudit({
          session,
          action: "CREATE",
          objectType: "Program",
          objectId: prog.id,
          summary: `Created partner program "${prog.name}"`,
        });
        return NextResponse.json({ ok: true, program: prog });
      }

      case "DUPLICATE_PROGRAM": {
        const source = await prisma.program.findUnique({
          where: { id: payload.id },
        });
        if (!source)
          return NextResponse.json(
            { error: "Program not found" },
            { status: 404 }
          );
        const copy = await prisma.program.create({
          data: {
            name: `${source.name} (Copy)`,
            owner: source.owner,
            levelsJson: source.levelsJson,
            autoEmailsJson: source.autoEmailsJson,
            termsRequired: source.termsRequired,
            termsUrl: source.termsUrl,
            revenueStrategy: source.revenueStrategy,
            permissionsJson: source.permissionsJson,
          },
        });
        await writeAudit({
          session,
          action: "CREATE",
          objectType: "Program",
          objectId: copy.id,
          summary: `Duplicated program "${source.name}" -> "${copy.name}"`,
        });
        return NextResponse.json({ ok: true, program: copy });
      }

      case "UPDATE_PROGRAM": {
        const prog = await prisma.program.update({
          where: { id: payload.id },
          data: payload.data,
        });
        await writeAudit({
          session,
          action: "UPDATE",
          objectType: "Program",
          objectId: prog.id,
          summary: `Updated program "${prog.name}" configuration`,
        });
        return NextResponse.json({ ok: true, program: prog });
      }

      case "CREATE_TRACKING_LINK": {
        const link = await prisma.trackingLink.create({
          data: {
            name: payload.name,
            targetUrl: payload.targetUrl,
            programId: payload.programId || "prog-strategic",
            partnerName:
              payload.partnerName || "Apex Cloud Solutions Pte Ltd",
            uniqueVisitors: 1,
            leadsCount: 0,
            customersCount: 0,
            transactionsCount: 0,
            revenuesSgd: 0,
          },
        });
        await writeAudit({
          session,
          action: "CREATE",
          objectType: "TrackingLink",
          objectId: link.id,
          summary: `Created referral tracking link "${link.name}"`,
        });
        return NextResponse.json({ ok: true, link });
      }

      case "CREATE_ACCOUNT_RECORD": {
        const acc = await prisma.accountRecord.create({
          data: {
            accountName: payload.accountName,
            type: payload.type || "Prospect",
            ownerName: payload.ownerName || "Alex Morgan",
            ownerEmail: payload.ownerEmail || "alex@r-prm.example.com",
            source: payload.source || "CSV Account Import",
            importedDate: new Date().toISOString().slice(0, 10),
            hasOverlap: true,
            partnerName:
              payload.partnerName || "Apex Cloud Solutions Pte Ltd",
            partnerAccountName:
              payload.partnerAccountName || payload.accountName,
            partnerAccountType: payload.partnerAccountType || "Customer",
            partnerOwnerName: payload.partnerOwnerName || "Jordan Lee",
            partnerOwnerEmail: "jordan.lee@apexcloud.example.com",
            overlapDate: new Date().toISOString().slice(0, 10),
          },
        });
        await writeAudit({
          session,
          action: "CREATE",
          objectType: "AccountRecord",
          objectId: acc.id,
          summary: `Mapped account "${acc.accountName}"`,
        });
        return NextResponse.json({ ok: true, account: acc });
      }

      case "CREATE_COLLABORATION": {
        const col = await prisma.collaboration.create({
          data: {
            name: payload.name,
            status: payload.status || "New",
            owner: payload.owner || "Alex Morgan",
            partnerName:
              payload.partnerName || "Apex Cloud Solutions Pte Ltd",
            assignedContact: payload.assignedContact || "Jordan Lee",
            accountName:
              payload.accountName || "Aura Luxury Hospitality Group",
            lastActivityDate: new Date().toISOString().slice(0, 10),
          },
        });
        await writeAudit({
          session,
          action: "CREATE",
          objectType: "Collaboration",
          objectId: col.id,
          summary: `Created collaboration "${col.name}"`,
        });
        return NextResponse.json({ ok: true, collaboration: col });
      }

      case "CREATE_DATA_SOURCE": {
        const ds = await prisma.dataSource.create({
          data: {
            name: payload.name,
            status: "Active",
            sharedWith: payload.sharedWith || "All Strategic Partners",
            type: payload.type || "CSV Upload",
            accountType: payload.accountType || "Customers & Prospects",
            lastImportedDate: new Date().toISOString().slice(0, 10),
            createdBy: session.name,
          },
        });
        if (Array.isArray(payload.csvAccounts)) {
          for (const row of payload.csvAccounts) {
            await prisma.accountRecord.create({
              data: {
                accountName: row.accountName,
                type: row.yourType || "Prospect",
                ownerName: session.name,
                ownerEmail: session.email,
                source: payload.name,
                importedDate: new Date().toISOString().slice(0, 10),
                hasOverlap: true,
                partnerName:
                  row.partnerName || "Apex Cloud Solutions Pte Ltd",
                partnerAccountName:
                  row.partnerAccountName || row.accountName,
                partnerAccountType: row.partnerType || "Customer",
                partnerOwnerName: "Jordan Lee",
                partnerOwnerEmail: "jordan.lee@apexcloud.example.com",
                overlapDate: new Date().toISOString().slice(0, 10),
              },
            });
          }
        }
        await writeAudit({
          session,
          action: "CREATE",
          objectType: "DataSource",
          objectId: ds.id,
          summary: `Imported account mapping data source "${ds.name}"`,
        });
        return NextResponse.json({ ok: true, dataSource: ds });
      }

      case "CREATE_MANAGE_ITEM": {
        const item = await prisma.manageItem.create({
          data: {
            category: payload.category,
            name: payload.name,
            subtitle: payload.subtitle || "",
            status: payload.status || "Active",
            metadataJson: JSON.stringify(payload.metadata || {}),
          },
        });
        await writeAudit({
          session,
          action: "CREATE",
          objectType: `Manage:${payload.category}`,
          objectId: item.id,
          summary: `Created ${payload.category} item "${item.name}"`,
        });
        return NextResponse.json({ ok: true, item });
      }

      case "UPDATE_MANAGE_ITEM": {
        const existing = await prisma.manageItem.findUnique({
          where: { id: payload.id },
        });
        let mergedMeta = {};
        if (existing?.metadataJson) {
          try {
            mergedMeta = JSON.parse(existing.metadataJson);
          } catch {
            mergedMeta = {};
          }
        }
        if (payload.metadata) {
          mergedMeta = { ...mergedMeta, ...payload.metadata };
        }
        const item = await prisma.manageItem.update({
          where: { id: payload.id },
          data: {
            name: payload.name ?? existing?.name,
            subtitle: payload.subtitle ?? existing?.subtitle,
            status: payload.status ?? existing?.status,
            metadataJson: JSON.stringify(mergedMeta),
          },
        });
        await writeAudit({
          session,
          action: "UPDATE",
          objectType: `Manage:${item.category}`,
          objectId: item.id,
          summary: `Updated ${item.category} item "${item.name}"`,
        });
        return NextResponse.json({ ok: true, item });
      }

      case "ASSIGN_GROUP_PARTNERS": {
        const { groupName, partnerIds } = payload;
        if (Array.isArray(partnerIds) && partnerIds.length > 0) {
          await prisma.partner.updateMany({
            where: { id: { in: partnerIds } },
            data: { groupName },
          });
        }
        await writeAudit({
          session,
          action: "UPDATE",
          objectType: "PartnerGroup",
          objectId: groupName,
          summary: `Assigned ${partnerIds?.length || 0} partners to group "${groupName}"`,
        });
        return NextResponse.json({ ok: true });
      }

      case "TOGGLE_MANAGE_ITEM_STATUS": {
        const item = await prisma.manageItem.update({
          where: { id: payload.id },
          data: { status: payload.status },
        });
        await writeAudit({
          session,
          action: "UPDATE",
          objectType: `Manage:${item.category}`,
          objectId: item.id,
          summary: `Toggled ${item.name} status to ${payload.status}`,
        });
        return NextResponse.json({ ok: true, item });
      }

      case "DELETE_MANAGE_ITEM": {
        await prisma.manageItem.delete({ where: { id: payload.id } });
        await writeAudit({
          session,
          action: "DELETE",
          objectType: "ManageItem",
          objectId: payload.id,
          summary: `Deleted manage item ${payload.id}`,
        });
        return NextResponse.json({ ok: true });
      }

      case "SEND_EMAIL": {
        const result = await sendOrLogEmail({
          to: payload.to,
          subject: payload.subject,
          body: payload.body,
          templateName: payload.templateName,
          portalLink: payload.portalLink,
        });
        await writeAudit({
          session,
          action: "EMAIL",
          objectType: "EmailOutbox",
          objectId: result.emailLog.id,
          summary: `Sent email "${payload.subject}" to ${payload.to}`,
        });
        return NextResponse.json({ ok: true, ...result });
      }

      case "LOG_IMPERSONATION": {
        await writeAudit({
          session,
          action: "IMPERSONATE",
          objectType: "PartnerPortal",
          objectId: payload.partnerId || "prt-1",
          summary: `Admin ${session.email} opened Partner Portal impersonation session as "${payload.partnerName}"`,
        });
        return NextResponse.json({ ok: true });
      }

      case "CREATE_NOTE": {
        const note = await prisma.noteItem.create({
          data: {
            entityType: payload.entityType,
            entityId: payload.entityId,
            author: session.name || "Alex Morgan",
            content: payload.content,
            isShared: payload.isShared ?? true,
          },
        });
        await writeAudit({
          session,
          action: "CREATE",
          objectType: "Note",
          objectId: note.id,
          summary: `Added note on ${payload.entityType} (${payload.entityId})`,
        });
        return NextResponse.json({ ok: true, note });
      }

      case "SAVE_SETTING": {
        const setting = await prisma.appSetting.upsert({
          where: { key: payload.key },
          update: {
            valueJson: JSON.stringify(payload.value),
            updatedAt: new Date(),
          },
          create: {
            key: payload.key,
            valueJson: JSON.stringify(payload.value),
          },
        });
        await writeAudit({
          session,
          action: "UPDATE",
          objectType: "AppSetting",
          objectId: payload.key,
          summary: `Updated workspace setting "${payload.key}"`,
        });
        return NextResponse.json({ ok: true, setting });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("POST /api/[resource] error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
