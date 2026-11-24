import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import {
  convertWithDatedFx,
  generateRewardsFromPartnerLevel,
  generateRandomLeadFormToken,
  resolveExplicitProgramAndPipeline,
  toMinorUnits,
  toMajorUnits,
} from "./prmEngine";
import { RprmSession } from "./authSession";
import {
  encryptBankDetails,
  executePayoutConnector,
  syncDealToHubSpotConnector,
} from "./connectors";
import {
  writeAudit,
  sendAndLogTransactionalEmail,
  parseCsvText,
  handleCsvImportMutation,
  matchAccountListsByDomainAndName,
} from "./importAndEmailHelpers";

export {
  writeAudit,
  sendAndLogTransactionalEmail,
  parseCsvText,
  handleCsvImportMutation,
  matchAccountListsByDomainAndName,
};

export async function executeResourceMutation(
  session: RprmSession,
  action: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any
) {
  switch (action) {
    case "CSV_IMPORT":
      return handleCsvImportMutation(session, payload);

    case "UPLOAD_ACCOUNT_MAPPING_LISTS": {
      // §16.4 P4: Upload Eber list & Partner list CSVs and compute overlaps by normalized domain & company name
      const eberList = Array.isArray(payload.eberList)
        ? payload.eberList
        : parseCsvText(payload.eberCsv || "");
      const partnerList = Array.isArray(payload.partnerList)
        ? payload.partnerList
        : parseCsvText(payload.partnerCsv || "");

      const matched = matchAccountListsByDomainAndName(
        eberList.map((r: Record<string, string>) => ({
          accountName: r.accountName || r.company || r.name,
          domain: r.domain || r.website,
          type: r.type || "Prospect",
          ownerName: r.ownerName || session.name,
          ownerEmail: r.ownerEmail || session.email,
        })),
        partnerList.map((r: Record<string, string>) => ({
          partnerName:
            r.partnerName ||
            payload.partnerName ||
            "Apex Cloud Solutions Pte Ltd",
          accountName: r.accountName || r.company || r.name,
          domain: r.domain || r.website,
          type: r.type || "Customer",
          ownerName: r.ownerName || "Jordan Lee",
          ownerEmail: r.ownerEmail || "jordan.lee@apexcloud.example.com",
        }))
      );

      const createdRecords = [];
      for (const m of matched) {
        const created = await prisma.accountRecord.create({
          data: {
            accountName: m.accountName,
            type: m.type,
            ownerName: m.ownerName,
            ownerEmail: m.ownerEmail,
            source: payload.sourceName || "CSV List Matching",
            importedDate: new Date().toISOString().slice(0, 10),
            hasOverlap: m.hasOverlap,
            partnerName: m.partnerName,
            partnerAccountName: m.partnerAccountName,
            partnerAccountType: m.partnerAccountType,
            partnerOwnerName: m.partnerOwnerName,
            partnerOwnerEmail: m.partnerOwnerEmail,
            overlapDate: new Date().toISOString().slice(0, 10),
          },
        });
        createdRecords.push({ ...created, matchedBy: m.matchedBy });
      }

      await writeAudit({
        session,
        action: "ACCOUNT_MAPPING_MATCH",
        objectType: "AccountRecord",
        objectId: `batch-${Date.now()}`,
        summary: `Matched ${eberList.length} Eber accounts against ${partnerList.length} partner accounts -> ${
          matched.filter((m) => m.hasOverlap).length
        } overlap(s)`,
      });

      return NextResponse.json({
        ok: true,
        matchedCount: matched.filter((m) => m.hasOverlap).length,
        records: createdRecords,
      });
    }

    case "CREATE_PARTNER": {
      const allPrograms = await prisma.program.findMany();
      let resolved: {
        programId: string;
        programName: string;
        onboardingPipeline: string;
      };
      try {
        resolved = resolveExplicitProgramAndPipeline(
          {
            programId: payload.programId,
            programName: payload.programName,
          },
          allPrograms
        );
      } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 400 });
      }

      const lf = generateRandomLeadFormToken();

      const partner = await prisma.partner.create({
        data: {
          name: payload.name,
          programId: resolved.programId,
          programName: resolved.programName,
          onboardingPipeline: resolved.onboardingPipeline,
          country: payload.country || "Singapore",
          language: payload.language || "English",
          currency: payload.currency || "SGD",
          partnerType: payload.partnerType || "Reseller",
          qualifyingLevel: payload.qualifyingLevel || "Silver Tier",
          status: payload.status || "Active",
          onboardingStatus: payload.onboardingStatus || "In progress",
          onboardingStage: payload.onboardingStage || "Kickoff Welcome Call",
          prospectionStage: payload.prospectionStage || "New",
          contactFirstName: payload.contactFirstName || "Alex",
          contactLastName: payload.contactLastName || "Partner",
          contactEmail: payload.contactEmail || "contact@partner.example.com",
          contactJobTitle: payload.contactJobTitle || "Partner Manager",
          contactPhone: payload.contactPhone || "+65 6000 0000",
          portalAccess: payload.portalAccess ?? true,
          companyWebsite:
            payload.companyWebsite || "https://partner.example.com",
          industry: payload.industry || "Cloud & SaaS Consulting",
          activeSince: new Date().toISOString().slice(0, 10),
          leadFormTokenHash: lf.tokenHash,
          leadFormTokenCipher: encryptBankDetails(lf.rawToken),
          bankDetailsJson: encryptBankDetails(
            typeof payload.bankDetailsJson === "string"
              ? payload.bankDetailsJson
              : JSON.stringify(payload.bankDetails || {})
          ),
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

      let activationUrl = "";
      let activationToken = "";
      if (partner.portalAccess) {
        const sent = await sendAndLogTransactionalEmail({
          to: partner.contactEmail,
          subject: `Welcome to R-PRM! Activate your Partner Portal for ${partner.name}`,
          body: `Hi ${partner.contactFirstName},\n\nYou have been enrolled in "${partner.programName}" (${partner.qualifyingLevel}).`,
          templateName: "Notify accepted partner",
          issueActivationFor: {
            email: partner.contactEmail,
            name: `${partner.contactFirstName} ${partner.contactLastName}`,
            partnerId: partner.id,
            partnerName: partner.name,
            role: "Manager",
          },
        });
        activationUrl = sent.activationUrl;
        activationToken = sent.activationToken;
      }
      return NextResponse.json({
        ok: true,
        partner,
        activationUrl,
        activationToken,
      });
    }

    case "ROTATE_PARTNER_LEAD_TOKEN": {
      if (session.identityType !== "coworker") {
        return NextResponse.json(
          { error: "Only coworkers can rotate a partner's lead-form token" },
          { status: 403 }
        );
      }
      const partnerId = String(payload.partnerId || payload.id || "").trim();
      const existing = await prisma.partner.findUnique({
        where: { id: partnerId },
      });
      if (!existing) {
        return NextResponse.json(
          { error: "Partner not found" },
          { status: 404 }
        );
      }
      const lf = generateRandomLeadFormToken();
      await prisma.partner.update({
        where: { id: existing.id },
        data: {
          leadFormTokenHash: lf.tokenHash,
          leadFormTokenCipher: encryptBankDetails(lf.rawToken),
        },
      });
      await writeAudit({
        session,
        action: "ROTATE_LEAD_FORM_TOKEN",
        objectType: "Partner",
        objectId: existing.id,
        summary: `Rotated public lead-form token for partner "${existing.name}"`,
      });
      return NextResponse.json({
        ok: true,
        partnerId: existing.id,
        leadFormToken: lf.rawToken,
      });
    }

    case "REVIEW_PARTNER_APPLICATION": {
      // §16.4 P2 & F8: Explicit program -> onboarding pipeline assignment; missing program is an error (never name-based or defaulting to first program!)
      const {
        partnerId,
        mode,
        rejectionReason,
        reapplyAfterDate,
        programId: overrideProgId,
        programName: overrideProgName,
      } = payload;
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

      const allPrograms = await prisma.program.findMany();
      let resolved: {
        programId: string;
        programName: string;
        onboardingPipeline: string;
      };
      try {
        resolved = resolveExplicitProgramAndPipeline(
          {
            programId:
              overrideProgId !== undefined ? overrideProgId : existing.programId,
            programName:
              overrideProgName !== undefined
                ? overrideProgName
                : overrideProgId !== undefined
                ? undefined
                : existing.programName,
          },
          allPrograms
        );
      } catch (err) {
        return NextResponse.json({ error: String(err) }, { status: 400 });
      }
      const resolvedProgramId = resolved.programId;
      const resolvedProgramName = resolved.programName;
      const resolvedPipeline = resolved.onboardingPipeline;

      const nextStatus =
        mode === "accept_active"
          ? "Active"
          : mode === "accept_prospect"
          ? "Onboarding"
          : "Inactive";

      const partner = await prisma.partner.update({
        where: { id: partnerId },
        data: {
          programId: resolvedProgramId,
          programName: resolvedProgramName,
          onboardingPipeline: resolvedPipeline,
          status: nextStatus,
          portalAccess: mode === "accept_active",
          prospectionStage: mode === "accept_active" ? "Active" : "New",
        },
      });

      await writeAudit({
        session,
        action: "UPDATE",
        objectType: "PartnerApplication",
        objectId: partner.id,
        summary: `Application for "${partner.name}" in "${resolvedProgramName}" reviewed: ${mode}${
          rejectionReason ? ` (Reason: ${rejectionReason})` : ""
        }`,
        diff: {
          mode,
          programId: resolvedProgramId,
          programName: resolvedProgramName,
          onboardingPipeline: resolvedPipeline,
          rejectionReason,
          reapplyAfterDate,
        },
      });

      let activationUrl = "";
      let activationToken = "";
      if (mode === "accept_active") {
        const sent = await sendAndLogTransactionalEmail({
          to: partner.contactEmail,
          subject: `Approved! Activate your ${resolvedProgramName} Partner Portal (${partner.name})`,
          body: `Hi ${partner.contactFirstName},\n\nYour application for ${resolvedProgramName} has been accepted as an Active Partner on pipeline "${resolvedPipeline}".`,
          templateName: "Notify accepted partner",
          issueActivationFor: {
            email: partner.contactEmail,
            name: `${partner.contactFirstName} ${partner.contactLastName}`,
            partnerId: partner.id,
            partnerName: partner.name,
            role: "Manager",
          },
        });
        activationUrl = sent.activationUrl;
        activationToken = sent.activationToken;
      } else if (mode === "reject") {
        await sendAndLogTransactionalEmail({
          to: partner.contactEmail,
          subject: `Update on your ${resolvedProgramName} Partner Application (${partner.name})`,
          body: `Hi ${partner.contactFirstName},\n\nReason: ${rejectionReason}`,
          templateName: "Notify rejected partner",
        });
      }
      return NextResponse.json({
        ok: true,
        partner,
        activationUrl,
        activationToken,
      });
    }

    case "UPDATE_PARTNER": {
      const targetId =
        session.identityType === "partner" ? session.partnerId : payload.id;
      const updateData = { ...(payload.data || {}) };
      // §16.2 S8: Always encrypt bankDetailsJson on write!
      if (typeof updateData.bankDetailsJson === "string") {
        updateData.bankDetailsJson = encryptBankDetails(
          updateData.bankDetailsJson
        );
      }
      const partner = await prisma.partner.update({
        where: { id: targetId! },
        data: updateData,
      });
      await writeAudit({
        session,
        action: "UPDATE",
        objectType: "Partner",
        objectId: partner.id,
        summary: `Updated partner "${partner.name}"`,
        diff: { ...updateData, bankDetailsJson: updateData.bankDetailsJson ? "[ENCRYPTED]" : undefined },
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
          partnerName: payload.partnerName || "Apex Cloud Solutions Pte Ltd",
          role: payload.role || "Sales Rep",
          status: payload.portalAccess === false ? "Inactive" : "Sent",
          invitedAt: new Date().toISOString().slice(0, 10),
        },
      });
      let activationUrl = "";
      let activationToken = "";
      if (payload.portalAccess !== false) {
        const linkedPartner = await prisma.partner.findFirst({
          where: { name: member.partnerName },
        });
        const sent = await sendAndLogTransactionalEmail({
          to: member.email,
          subject: `Invitation: Join ${member.partnerName} on R-PRM Partner Portal`,
          body: `Hi ${member.name},\n\nYou have been invited as ${member.role} for ${member.partnerName}.`,
          templateName: "Invite partner team member",
          issueActivationFor: {
            email: member.email,
            name: member.name,
            partnerId: linkedPartner?.id || "prt-1",
            partnerName: member.partnerName,
            role: member.role === "Sales Rep" ? "SalesRep" : member.role,
          },
        });
        activationUrl = sent.activationUrl;
        activationToken = sent.activationToken;
      }
      await writeAudit({
        session,
        action: "CREATE",
        objectType: "PartnerTeamMember",
        objectId: member.id,
        summary: `Added partner team member "${member.name}" (${member.role}) for ${member.partnerName}`,
      });
      return NextResponse.json({
        ok: true,
        member,
        activationUrl,
        activationToken,
      });
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
          remarks: payload.customProperties
            ? `${payload.remarks || ""} [CustomProps: ${JSON.stringify(
                payload.customProperties
              )}]`.trim()
            : payload.remarks || "",
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
          amount: fx.originalAmountMinor,
          currency: fx.currency,
          amountSgd: fx.amountSgdMinor,
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
          amount: fx.originalAmountMinor,
          currency: fx.currency,
          amountSgd: fx.amountSgdMinor,
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
          comment: payload.customProperties
            ? `${payload.comment || ""} [CustomProps: ${JSON.stringify(
                payload.customProperties
              )}]`.trim()
            : payload.comment || "",
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
                amount: toMajorUnits(deal.amount),
                currency: deal.currency,
                partnerName: deal.partnerName,
              },
              partner,
              programs
            );
            for (const g of generated) {
              const newReward = await prisma.reward.create({
                data: {
                  rewardNumber: `RW-${Math.floor(1050 + Math.random() * 8900)}`,
                  partnerName: g.partnerName,
                  recipientName: g.recipientName,
                  type: g.type,
                  amount: g.amountMinor,
                  currency: g.currency,
                  amountSgd: g.amountSgdMinor,
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
          amount: fx.originalAmountMinor,
          amountSgd: fx.amountSgdMinor,
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
            payload.becamePayingDate || new Date().toISOString().slice(0, 10),
          bbid: payload.bbid || `BB-${Math.floor(2100 + Math.random() * 900)}`,
          sourceDealId: payload.sourceDealId || "",
          subscriptionPlan: payload.subscriptionPlan || "Enterprise Annual",
          billingFrequency: payload.billingFrequency || "Yearly",
          billingPeriod: payload.billingPeriod || "12 Months",
          revenuesSgd: toMinorUnits(Number(payload.revenuesSgd) || 12000),
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
            `INV-2026-${Math.floor(910 + Math.random() * 90)} · Subscription Invoice`,
          amount: fx.originalAmountMinor,
          currency: fx.currency,
          amountSgd: fx.amountSgdMinor,
          partnerName,
          customerName: payload.customerName || "Solaris Luxury Resort Group",
          dealName:
            payload.dealName || "ENT - Solaris Luxury Resort Group (Annual)",
          monthKey: payload.monthKey || "11/2026",
        },
      });

      const [partner, programs] = await Promise.all([
        prisma.partner.findFirst({ where: { name: partnerName } }),
        prisma.program.findMany(),
      ]);
      if (partner) {
        const generated = generateRewardsFromPartnerLevel(
          {
            id: tx.id,
            name: tx.name,
            amount,
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
              amount: g.amountMinor,
              currency: g.currency,
              amountSgd: g.amountSgdMinor,
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
          partnerName: payload.partnerName || "Apex Cloud Solutions Pte Ltd",
          recipientName: payload.partnerName || "Apex Cloud Solutions Pte Ltd",
          type: payload.type || "Cash",
          amount: fx.originalAmountMinor,
          currency: fx.currency,
          amountSgd: fx.amountSgdMinor,
          fromActivity: payload.fromActivity || "Manual Bonus / Milestone",
          fromRewardRule: payload.fromRewardRule || "One-time Commission Bonus",
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
      // §16.4 P1: Real relation Reward -> Payout; payout amount is ALWAYS computed from linked rewards; cannot create/pay with zero rewards!
      const partnerName =
        payload.partnerName || "Apex Cloud Solutions Pte Ltd";
      const eligibleRewards = await prisma.reward.findMany({
        where: {
          partnerName,
          payoutId: null,
          status: { in: ["Pending", "Accepted"] },
        },
      });
      if (eligibleRewards.length === 0) {
        return NextResponse.json(
          {
            error: `Cannot create payout for "${partnerName}": 0 unbatched eligible rewards found (§16.4 P1)`,
          },
          { status: 400 }
        );
      }
      const sumMinorSgd = eligibleRewards.reduce(
        (acc, r) => acc + r.amountSgd,
        0
      );
      const payoutNumber = `PO-2026-${Math.floor(10 + Math.random() * 89)}`;
      const payout = await prisma.payout.create({
        data: {
          payoutNumber,
          name: payload.name || `Partner Payout Settlement — ${partnerName}`,
          partnerName,
          amount: sumMinorSgd,
          currency: "SGD",
          amountSgd: sumMinorSgd,
          periodFrom: payload.periodFrom || "2026-01-01",
          periodTo: payload.periodTo || "2026-11-30",
          rewardsCount: eligibleRewards.length,
          status: "Ready",
          invoiceRef: `SELF-INV-${Math.floor(100 + Math.random() * 899)}`,
        },
      });
      await prisma.reward.updateMany({
        where: { id: { in: eligibleRewards.map((r) => r.id) } },
        data: {
          status: "Accepted",
          payoutNumber,
          payoutId: payout.id,
        },
      });
      await writeAudit({
        session,
        action: "CREATE",
        objectType: "Payout",
        objectId: payout.id,
        summary: `Created payout ${payout.payoutNumber} for ${partnerName} (SGD ${toMajorUnits(sumMinorSgd)} across ${eligibleRewards.length} linked rewards)`,
      });
      return NextResponse.json({ ok: true, payout });
    }

    case "MARK_PAYOUT_PAID": {
      // §16.4 P1: A payout cannot be paid with zero linked rewards!
      const existing = await prisma.payout.findUnique({
        where: { id: payload.id },
        include: { rewards: true },
      });
      if (!existing)
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (!existing.rewards || existing.rewards.length === 0) {
        return NextResponse.json(
          {
            error: `Cannot mark payout ${existing.payoutNumber} Paid: 0 linked rewards (§16.4 P1)`,
          },
          { status: 400 }
        );
      }
      const computedSumMinorSgd = existing.rewards.reduce(
        (s, r) => s + r.amountSgd,
        0
      );
      const connectorRes = executePayoutConnector({
        ...existing,
        amountSgd: toMajorUnits(computedSumMinorSgd),
      });
      const payout = await prisma.payout.update({
        where: { id: payload.id },
        data: {
          amount: computedSumMinorSgd,
          amountSgd: computedSumMinorSgd,
          rewardsCount: existing.rewards.length,
          status: "Paid",
          paidDate: new Date().toISOString().slice(0, 10),
        },
      });
      await prisma.reward.updateMany({
        where: { payoutId: payout.id },
        data: { status: "Paid" },
      });
      await writeAudit({
        session,
        action: "UPDATE",
        objectType: "Payout",
        objectId: payout.id,
        summary: `Marked payout ${payout.payoutNumber} Paid (SGD ${toMajorUnits(computedSumMinorSgd)}) via ${connectorRes.driver} driver (${connectorRes.settlementReference})`,
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
          partnerName: payload.partnerName || "Apex Cloud Solutions Pte Ltd",
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
          partnerName: payload.partnerName || "Apex Cloud Solutions Pte Ltd",
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
          partnerName: payload.partnerName || "Apex Cloud Solutions Pte Ltd",
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
          partnerName: payload.partnerName || "Apex Cloud Solutions Pte Ltd",
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
              partnerName: row.partnerName || "Apex Cloud Solutions Pte Ltd",
              partnerAccountName: row.partnerAccountName || row.accountName,
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
      const result = await sendAndLogTransactionalEmail({
        to: payload.to,
        subject: payload.subject,
        body: payload.body,
        templateName: payload.templateName,
        mergeFields: payload.mergeFields,
      });
      await writeAudit({
        session,
        action: "EMAIL",
        objectType: "EmailOutbox",
        objectId: result.emailLog.id,
        summary: `Sent email "${result.emailLog.name}" to ${payload.to}`,
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
      // §16.2 S12: Never allow saving SMTP/Gmail credentials in AppSetting!
      if (payload.key === "smtp_config") {
        return NextResponse.json(
          {
            error:
              "SMTP credentials come from environment variables only (EMAIL_DRIVER, SMTP_HOST, SMTP_USER, SMTP_PASS) and are never stored in the database (§16.2 S12).",
          },
          { status: 400 }
        );
      }
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
}
