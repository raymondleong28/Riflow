import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";
import {
  computePartnerKpis,
  computeAccountOverlaps,
  convertWithDatedFx,
  normalizeRewardRule,
  canPartnerAccessAsset,
} from "@/lib/prmEngine";

export const dynamic = "force-dynamic";

async function writeAudit({
  actor = "Alex Morgan",
  actorRole = "Coworker (Admin)",
  action,
  objectType,
  objectId,
  summary,
  diff = {},
}: {
  actor?: string;
  actorRole?: string;
  action: string;
  objectType: string;
  objectId: string;
  summary: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  diff?: Record<string, any>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actor,
        actorRole,
        action,
        objectType,
        objectId,
        summary,
        diffJson: JSON.stringify(diff),
      },
    });
  } catch (e) {
    console.error("Audit log error:", e);
  }
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
  let deliveryMode = "In-App Outbox Sandbox";
  let smtpError = "";

  // Generate time-limited activation token at send time (§4.6)
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
          <div style="display:flex;align-items:center;margin-bottom:16px;">
            <div style="background:#2563eb;color:#fff;font-weight:800;padding:8px 12px;border-radius:8px;margin-right:10px;">R</div>
            <strong style="font-size:16px;color:#0f172a;">R-PRM Partner Cloud</strong>
          </div>
          <h2 style="font-size:18px;color:#1e293b;">${subject}</h2>
          <div style="font-size:14px;color:#334155;line-height:1.6;white-space:pre-line;">${body}</div>
          ${
            tokenizedLink
              ? `<div style="margin-top:20px;"><a href="http://localhost:3000${tokenizedLink}" style="background:#2563eb;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Activate & Open Partner Portal →</a><p style="font-size:11px;color:#64748b;margin-top:6px;">Time-limited activation token expires ${expiresAt}</p></div>`
              : ""
          }
        </div>`,
      });
      deliveryMode = `Delivered via Gmail SMTP (${gmailUser})`;
    } catch (err) {
      smtpError = String(err);
      deliveryMode = `Logged to In-App Outbox (Gmail SMTP error: ${smtpError.slice(
        0,
        80
      )})`;
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

export async function GET(req: NextRequest) {
  try {
    const partnerScopeId = req.nextUrl.searchParams.get("partnerId");

    const [
      programsRaw,
      partnersRaw,
      teamMembers,
      leads,
      deals,
      customers,
      transactions,
      rewards,
      payouts,
      tasks,
      businessPlans,
      accountsRaw,
      collaborations,
      dataSources,
      trackingLinks,
      manageItemsRaw,
      notes,
      settingsRows,
      auditLogs,
    ] = await Promise.all([
      prisma.program.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.partner.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.partnerTeamMember.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.lead.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.deal.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.customer.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.transaction.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.reward.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.payout.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.task.findMany({ orderBy: { dueDate: "asc" } }),
      prisma.businessPlan.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.accountRecord.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.collaboration.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.dataSource.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.trackingLink.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.manageItem.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.noteItem.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.appSetting.findMany(),
      prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    ]);

    // D4 & D5 Fix: Compute Partner KPIs dynamically from leads, deals, rewards
    const partners = partnersRaw.map((p) =>
      computePartnerKpis(p, leads, deals, rewards)
    );

    // D1 Fix: Normalize program levels so all reward rules have structured fields,
    // and compute Program KPIs dynamically from members, leads, deals
    const programs = programsRaw.map((prog) => {
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

      const progPartners = partners.filter(
        (p) => p.programId === prog.id || p.programName === prog.name
      );
      const pendingApps = progPartners.filter(
        (p) => p.status === "Pending"
      ).length;
      const submittedLeads365d = progPartners.reduce(
        (acc, p) => acc + p.submittedLeads365d,
        0
      );
      const registeredDeals365d = progPartners.reduce(
        (acc, p) => acc + p.registeredDeals365d,
        0
      );
      const sourcedRevenue365d = progPartners.reduce(
        (acc, p) => acc + p.sourcedRevenue365d,
        0
      );
      const influencedRev365d = progPartners.reduce(
        (acc, p) => acc + p.influencedRev365d,
        0
      );

      return {
        ...prog,
        levelsJson: JSON.stringify(normalizedLevels),
        partnerCount: progPartners.length,
        pendingApplications: pendingApps,
        submittedLeads365d,
        registeredDeals365d,
        sourcedRevenue365d,
        influencedRev365d,
      };
    });

    // D11 Fix: Compute Account Mapping overlaps dynamically from account records
    const accounts = computeAccountOverlaps(accountsRaw);

    // D6 Fix: If partnerId query parameter is supplied (Partner Portal read),
    // filter assets server-side so partners ONLY receive assets they are authorized to access!
    const scopedPartner = partnerScopeId
      ? partners.find((p) => p.id === partnerScopeId)
      : null;

    const manageItems = scopedPartner
      ? manageItemsRaw.filter((item) => {
          if (item.category !== "assets") return true;
          return canPartnerAccessAsset(item, scopedPartner);
        })
      : manageItemsRaw;

    const settings: Record<string, unknown> = {};
    for (const row of settingsRows) {
      try {
        settings[row.key] = JSON.parse(row.valueJson);
      } catch {
        settings[row.key] = row.valueJson;
      }
    }

    return NextResponse.json({
      lookupStatus: "found",
      programs,
      partners,
      teamMembers,
      leads,
      deals,
      customers,
      transactions,
      rewards,
      payouts,
      tasks,
      businessPlans,
      accounts,
      collaborations,
      dataSources,
      trackingLinks,
      manageItems,
      notes,
      settings,
      auditLogs,
    });
  } catch (error) {
    console.error("GET /api/prm error:", error);
    return NextResponse.json(
      {
        lookupStatus: "could_not_check",
        reason: String(error),
        error: String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, payload } = body;

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
            body: `Hi ${partner.contactFirstName},\n\nYou have been enrolled in "${partner.programName}" (${partner.qualifyingLevel}).\n\nUse your personal time-limited activation link below to enter your Partner Portal.`,
            templateName: "Notify accepted partner",
            portalLink: `/p?partnerId=${partner.id}`,
          });
        } else if (partner.status === "Pending") {
          await sendOrLogEmail({
            to: partner.contactEmail,
            subject: `Application Received: ${partner.name} — R-PRM Partner Program`,
            body: `Hi ${partner.contactFirstName},\n\nWe have received your partner application for "${partner.programName}". Our channel team will review your application shortly.`,
            templateName: "Acknowledge partner signup",
          });
        }

        return NextResponse.json({ ok: true, partner });
      }

      case "REVIEW_PARTNER_APPLICATION": {
        // Supports §4.6:
        // mode: "accept_active" | "accept_prospect" | "reject"
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
            { error: "A rejection reason is required (§4.6)" },
            { status: 400 }
          );
        }

        const nextStatus =
          mode === "accept_active"
            ? "Active"
            : mode === "accept_prospect"
            ? "Onboarding"
            : "Inactive";
        const nextPortalAccess = mode === "accept_active";
        const nextProspection =
          mode === "accept_prospect"
            ? "New"
            : mode === "accept_active"
            ? "Active"
            : "New";

        const partner = await prisma.partner.update({
          where: { id: partnerId },
          data: {
            status: nextStatus,
            portalAccess: nextPortalAccess,
            prospectionStage: nextProspection,
          },
        });

        await writeAudit({
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
            body: `Hi ${partner.contactFirstName},\n\nYour application for ${partner.programName} has been accepted as an Active Partner! Click your time-limited activation link below to access your portal and complete bank payout setup.`,
            templateName: "Notify accepted partner",
            portalLink: `/p?partnerId=${partner.id}`,
          });
        } else if (mode === "accept_prospect") {
          await sendOrLogEmail({
            to: partner.contactEmail,
            subject: `Next Steps: ${partner.name} entered Partner Prospection`,
            body: `Hi ${partner.contactFirstName},\n\nYour application has been accepted into our Partner Prospection pipeline. Your Partner Account Manager (${partner.owner}) will schedule a discovery call before activating portal access.`,
            templateName: "Acknowledge partner signup",
          });
        } else if (mode === "reject") {
          await sendOrLogEmail({
            to: partner.contactEmail,
            subject: `Update on your R-PRM Partner Application (${partner.name})`,
            body: `Hi ${partner.contactFirstName},\n\nThank you for applying to ${partner.programName}. At this time we are unable to approve the application.\n\nReason: ${rejectionReason}${
              reapplyAfterDate
                ? `\nYou are welcome to re-apply after: ${reapplyAfterDate}`
                : ""
            }`,
            templateName: "Notify rejected partner",
          });
        }

        return NextResponse.json({ ok: true, partner });
      }

      case "UPDATE_PARTNER": {
        const partner = await prisma.partner.update({
          where: { id: payload.id },
          data: payload.data,
        });
        await writeAudit({
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
          action: "CREATE",
          objectType: "PartnerTeamMember",
          objectId: member.id,
          summary: `Added partner team member "${member.name}" (${member.role}) for ${member.partnerName}`,
          diff: payload,
        });

        if (payload.portalAccess !== false) {
          await sendOrLogEmail({
            to: member.email,
            subject: `Invitation: Join ${member.partnerName} on R-PRM Partner Portal`,
            body: `Hi ${member.name},\n\nYou have been invited as a ${member.role} for ${member.partnerName} on R-PRM.`,
            templateName: "Team Member Invitation",
            portalLink: `/p`,
          });
        }

        return NextResponse.json({ ok: true, member });
      }

      case "BULK_TEAM_MEMBERS": {
        // Supports §4.6: Bulk Delete, Change main contact, Update role
        const { memberIds, bulkAction, role } = payload;
        if (!Array.isArray(memberIds) || memberIds.length === 0) {
          return NextResponse.json({ error: "No members selected" }, { status: 400 });
        }
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
          action: "UPDATE",
          objectType: "PartnerTeamMember",
          objectId: memberIds.join(","),
          summary: `Executed bulk action "${bulkAction}" on ${memberIds.length} team member(s)`,
          diff: payload,
        });
        return NextResponse.json({ ok: true });
      }

      case "CREATE_LEAD": {
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
            sourcePartnerId: payload.sourcePartnerId || null,
            sourcePartnerName:
              payload.sourcePartnerName || "Apex Cloud Solutions Pte Ltd",
            assignedPartner:
              payload.assignedPartner ||
              payload.sourcePartnerName ||
              "Apex Cloud Solutions Pte Ltd",
            assignedContact: payload.assignedContact || "Jordan Lee",
            assignedDate: new Date().toISOString().slice(0, 10),
            deadline: payload.deadline || "2026-12-31",
          },
        });
        await writeAudit({
          action: "CREATE",
          objectType: "Lead",
          objectId: lead.id,
          summary: `Created lead "${lead.firstName} ${lead.lastName}" (${lead.company}) from ${lead.source}`,
          diff: payload,
        });
        return NextResponse.json({ ok: true, lead });
      }

      case "UPDATE_LEAD_STATUS": {
        const lead = await prisma.lead.update({
          where: { id: payload.id },
          data: {
            status: payload.status,
            acceptedBy: payload.status === "Accepted" ? "Alex Morgan" : "",
            acceptedDate:
              payload.status === "Accepted"
                ? new Date().toISOString().slice(0, 10)
                : "",
          },
        });
        await writeAudit({
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
          return NextResponse.json(
            { error: "Lead not found" },
            { status: 404 }
          );

        const amount = Number(payload.amount) || 18000;
        const currency = payload.currency || "SGD";
        const fx = convertWithDatedFx(amount, currency);

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
          action: "CREATE",
          objectType: "Deal",
          objectId: deal.id,
          summary: `Converted lead "${lead.firstName} ${lead.lastName}" to Deal "${deal.name}"`,
        });

        return NextResponse.json({ ok: true, deal });
      }

      case "CREATE_DEAL": {
        const amount = Number(payload.amount) || 15000;
        const currency = payload.currency || "SGD";
        const fx = convertWithDatedFx(amount, currency);
        const deal = await prisma.deal.create({
          data: {
            name: payload.name,
            owner: payload.owner || "Alex Morgan",
            clientName: payload.clientName || "Enterprise Buyer",
            company: payload.company || payload.name,
            amount,
            currency: fx.currency,
            amountSgd: fx.amountSgd,
            partnerName:
              payload.partnerName || "Apex Cloud Solutions Pte Ltd",
            assignedContact: payload.assignedContact || "Jordan Lee",
            status: payload.status || "Accepted",
            stage: payload.stage || "Discovery Stage",
            stageEnteredAt: new Date().toISOString().slice(0, 10),
            source: "Partner Registration",
            sourcePartnerName:
              payload.partnerName || "Apex Cloud Solutions Pte Ltd",
            closeDate: payload.closeDate || "2027-01-15",
            expirationDate: payload.expirationDate || "2027-04-15",
            dealType: payload.dealType || "New Business",
            subscriptionPlan:
              payload.subscriptionPlan || "Enterprise Annual",
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
          action: "CREATE",
          objectType: "Deal",
          objectId: deal.id,
          summary: `Registered deal "${deal.name}" (${fx.currency} ${amount} / SGD ${fx.amountSgd} @ FX ${fx.fxRate} on ${fx.fxRateDate})`,
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

        await writeAudit({
          action: "UPDATE",
          objectType: "Deal",
          objectId: deal.id,
          summary: `Deal "${deal.name}" moved to stage "${payload.stage}"`,
        });

        // Idempotent reward generation when moved to Closed Won (§4.1.2)
        if (payload.stage === "Closed Won") {
          const existingReward = await prisma.reward.findFirst({
            where: {
              fromActivity: deal.name,
              partnerName: deal.partnerName,
            },
          });
          if (!existingReward) {
            const fx = convertWithDatedFx(
              Math.round(deal.amount * 0.18 * 100) / 100,
              deal.currency
            );
            const newReward = await prisma.reward.create({
              data: {
                rewardNumber: `RW-${Math.floor(1050 + Math.random() * 8900)}`,
                partnerName: deal.partnerName,
                recipientName: deal.partnerName,
                type: "Cash",
                amount: fx.originalAmount,
                currency: fx.currency,
                amountSgd: fx.amountSgd,
                fromActivity: deal.name,
                fromRewardRule: "18% Recurring Deal Commission",
                status: "Pending",
                comment: `Auto-generated @ FX ${fx.fxRate} (${fx.fxRateDate})`,
              },
            });
            await writeAudit({
              action: "CREATE",
              objectType: "Reward",
              objectId: newReward.id,
              summary: `Auto-generated Pending reward ${newReward.rewardNumber} (SGD ${fx.amountSgd}) from Closed Won deal "${deal.name}"`,
            });
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
        const currency = existing?.currency || "SGD";
        const fx = convertWithDatedFx(newTotal, currency);
        const deal = await prisma.deal.update({
          where: { id: payload.dealId },
          data: {
            lineItemsJson: JSON.stringify(lineItems),
            amount: newTotal,
            amountSgd: fx.amountSgd,
          },
        });
        return NextResponse.json({ ok: true, deal });
      }

      case "ASSOCIATE_DEAL_CUSTOMER": {
        const deal = await prisma.deal.findUnique({
          where: { id: payload.dealId },
        });
        if (!deal)
          return NextResponse.json(
            { error: "Deal not found" },
            { status: 404 }
          );

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
            subscriptionPlan:
              payload.subscriptionPlan || "Enterprise Annual",
            billingFrequency: payload.billingFrequency || "Yearly",
            billingPeriod: payload.billingPeriod || "12 Months",
            revenuesSgd: Number(payload.revenuesSgd) || 12000,
          },
        });
        return NextResponse.json({ ok: true, customer });
      }

      case "CREATE_TRANSACTION": {
        const amount = Number(payload.amount) || 9500;
        const currency = payload.currency || "SGD";
        const fx = convertWithDatedFx(amount, currency);
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
            partnerName:
              payload.partnerName || "Apex Cloud Solutions Pte Ltd",
            customerName:
              payload.customerName || "Solaris Luxury Resort Group",
            dealName:
              payload.dealName ||
              "ENT - Solaris Luxury Resort Group (Annual)",
            monthKey: payload.monthKey || "11/2026",
          },
        });
        await writeAudit({
          action: "CREATE",
          objectType: "Transaction",
          objectId: tx.id,
          summary: `Recorded transaction "${tx.name}" (${fx.currency} ${amount} -> SGD ${fx.amountSgd} @ FX ${fx.fxRate} on ${fx.fxRateDate})`,
        });
        return NextResponse.json({ ok: true, transaction: tx });
      }

      case "CREATE_REWARD": {
        const amount = Number(payload.amount) || 1000;
        const currency = payload.currency || "SGD";
        const fx = convertWithDatedFx(amount, currency);
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
          action: "CREATE",
          objectType: "Reward",
          objectId: reward.id,
          summary: `Created reward ${reward.rewardNumber} (${fx.currency} ${amount} / SGD ${fx.amountSgd})`,
        });
        return NextResponse.json({ ok: true, reward });
      }

      case "UPDATE_REWARD_STATUS": {
        // Supports Pending -> Accepted (Validated) -> Paid, Pending -> Refused (with reason)
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
          action: payload.status === "Refused" ? "REFUSE" : "VALIDATE",
          objectType: "Reward",
          objectId: reward.id,
          summary: `Reward ${reward.rewardNumber} status changed to "${
            payload.status
          }"${payload.reason ? ` (Reason: ${payload.reason})` : ""}`,
        });
        return NextResponse.json({ ok: true, reward });
      }

      case "CLAWBACK_REWARD": {
        // §4.1.3: Validated/Paid -> Clawed back (creates a negative adjustment record, never deletes history)
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
          action: "CLAWBACK",
          objectType: "Reward",
          objectId: orig.id,
          summary: `Clawed back reward ${orig.rewardNumber} and created negative adjustment ${clawbackAdjustment.rewardNumber} (SGD ${clawbackAdjustment.amountSgd})`,
          diff: { origId: orig.id, adjustmentId: clawbackAdjustment.id },
        });

        return NextResponse.json({
          ok: true,
          clawbackAdjustment,
        });
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
          action: "CREATE",
          objectType: "Payout",
          objectId: payout.id,
          summary: `Created payout ${payout.payoutNumber} for ${partnerName} (SGD ${sumSgd}, ${eligibleRewards.length} rewards)`,
        });

        return NextResponse.json({ ok: true, payout });
      }

      case "MARK_PAYOUT_PAID": {
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
          action: "UPDATE",
          objectType: "Payout",
          objectId: payout.id,
          summary: `Marked payout ${payout.payoutNumber} as Paid`,
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
            completedBy: nextStatus === "Completed" ? "Alex Morgan" : "",
            completedDate:
              nextStatus === "Completed"
                ? new Date().toISOString().slice(0, 10)
                : "",
          },
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
          action: "CREATE",
          objectType: "Program",
          objectId: prog.id,
          summary: `Created partner program "${prog.name}"`,
        });
        return NextResponse.json({ ok: true, program: prog });
      }

      case "DUPLICATE_PROGRAM": {
        // §5.1 / §9 Enhancement: Duplicate program
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
          action: "CREATE",
          objectType: "Program",
          objectId: copy.id,
          summary: `Duplicated program "${source.name}" -> "${copy.name}"`,
        });
        return NextResponse.json({ ok: true, program: copy });
      }

      case "DELETE_PROGRAM": {
        await prisma.program.delete({ where: { id: payload.id } });
        await writeAudit({
          action: "DELETE",
          objectType: "Program",
          objectId: payload.id,
          summary: `Deleted program ${payload.id}`,
        });
        return NextResponse.json({ ok: true });
      }

      case "UPDATE_PROGRAM": {
        const prog = await prisma.program.update({
          where: { id: payload.id },
          data: payload.data,
        });
        await writeAudit({
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
        return NextResponse.json({ ok: true, link });
      }

      case "RECORD_LINK_CLICK": {
        const link = await prisma.trackingLink.update({
          where: { id: payload.id },
          data: { uniqueVisitors: { increment: 1 } },
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
            createdBy: "Alex Morgan",
          },
        });

        // If CSV rows were uploaded/pasted, create AccountRecords so overlaps compute automatically (D11)!
        if (Array.isArray(payload.csvAccounts)) {
          for (const row of payload.csvAccounts) {
            await prisma.accountRecord.create({
              data: {
                accountName: row.accountName,
                type: row.yourType || "Prospect",
                ownerName: "Alex Morgan",
                ownerEmail: "alex@r-prm.example.com",
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
        return NextResponse.json({ ok: true });
      }

      case "TOGGLE_MANAGE_ITEM_STATUS": {
        const item = await prisma.manageItem.update({
          where: { id: payload.id },
          data: { status: payload.status },
        });
        return NextResponse.json({ ok: true, item });
      }

      case "DELETE_MANAGE_ITEM": {
        await prisma.manageItem.delete({ where: { id: payload.id } });
        await writeAudit({
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
        return NextResponse.json({ ok: true, ...result });
      }

      case "LOG_IMPERSONATION": {
        await writeAudit({
          action: "IMPERSONATE",
          objectType: "PartnerPortal",
          objectId: payload.partnerId || "prt-1",
          summary: `Admin Alex Morgan opened Partner Portal impersonation session as "${payload.partnerName}"`,
        });
        return NextResponse.json({ ok: true });
      }

      case "CREATE_NOTE": {
        const note = await prisma.noteItem.create({
          data: {
            entityType: payload.entityType,
            entityId: payload.entityId,
            author: payload.author || "Alex Morgan",
            content: payload.content,
            isShared: payload.isShared ?? true,
          },
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
    console.error("POST /api/prm error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
