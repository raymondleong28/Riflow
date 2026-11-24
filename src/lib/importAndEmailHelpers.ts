import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import {
  convertWithDatedFx,
  generateRandomLeadFormToken,
  normalizeAccountKey,
  toMinorUnits,
} from "./prmEngine";
import { issuePartnerActivationLink, RprmSession } from "./authSession";
import { encryptBankDetails, sendEmailViaConnector } from "./connectors";

export async function writeAudit({
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

// §16.2 S9, S11, S12 & §16.3 G2, G5: Send email via unified Email Connector with escaped HTML + real single-use activation link
export async function sendAndLogTransactionalEmail({
  to,
  subject,
  body,
  templateName = "System Notification",
  mergeFields = {},
  issueActivationFor,
}: {
  to: string;
  subject: string;
  body: string;
  templateName?: string;
  mergeFields?: Record<string, string>;
  issueActivationFor?: {
    email: string;
    name: string;
    partnerId: string;
    partnerName: string;
    role: string;
  };
}) {
  let activationUrl = "";
  let rawToken = "";
  let expiresAt = "";

  if (issueActivationFor) {
    const issued = await issuePartnerActivationLink({
      email: issueActivationFor.email,
      name: issueActivationFor.name,
      partnerId: issueActivationFor.partnerId,
      partnerName: issueActivationFor.partnerName,
      role: issueActivationFor.role,
    });
    activationUrl = issued.activationUrl;
    rawToken = issued.rawToken;
    expiresAt = issued.expiresAt.toISOString();
  }

  const finalMergeFields = {
    ...mergeFields,
    "user.activationUrl": activationUrl,
  };

  const fullBody = activationUrl
    ? `${body}\n\nActivate your Partner Portal account here: ${activationUrl}`
    : body;

  const sent = await sendEmailViaConnector({
    to,
    subject,
    body: fullBody,
    mergeFields: finalMergeFields,
  });

  const emailLog = await prisma.manageItem.create({
    data: {
      category: "sent_emails",
      name: sent.escapedSubject,
      subtitle: `To: ${to} · ${sent.transportInfo}`,
      status: sent.driver === "smtp" ? "Delivered (SMTP)" : "Captured in Outbox",
      metadataJson: JSON.stringify({
        to,
        subject: sent.escapedSubject,
        html: sent.html,
        templateName,
        activationUrl,
        expiresAt,
        deliveryMode: sent.transportInfo,
        sentAt: new Date().toISOString(),
      }),
    },
  });

  return {
    emailLog,
    deliveryMode: sent.transportInfo,
    activationUrl,
    activationToken: rawToken,
    html: sent.html,
  };
}

// §16.3 G9 & §16.4 P4: CSV Parser & Multi-Object Importer with dryRun preview, row-level errors, and audit log
export function parseCsvText(csvText: string): Array<Record<string, string>> {
  const lines = String(csvText || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(",").map((v) => v.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = vals[idx] ?? "";
    });
    rows.push(obj);
  }
  return rows;
}

export async function handleCsvImportMutation(
  session: RprmSession,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any
) {
  const objectType = String(payload.objectType || "partners").toLowerCase();
  const dryRun = Boolean(payload.dryRun);
  const rows: Array<Record<string, string>> = Array.isArray(payload.rows)
    ? payload.rows
    : parseCsvText(payload.csvText || "");

  const validRows: Array<Record<string, string>> = [];
  const rowErrors: Array<{ rowNumber: number; error: string }> = [];

  rows.forEach((r, idx) => {
    const rowNumber = idx + 2;
    if (objectType === "partners" && !r.name) {
      rowErrors.push({ rowNumber, error: "Missing required column: name" });
    } else if (objectType === "contacts" && (!r.name || !r.email)) {
      rowErrors.push({ rowNumber, error: "Missing required columns: name, email" });
    } else if (objectType === "leads" && (!r.firstName || !r.company || !r.email)) {
      rowErrors.push({
        rowNumber,
        error: "Missing required columns: firstName, company, email",
      });
    } else if (objectType === "deals" && (!r.name || !r.company || !r.amount)) {
      rowErrors.push({
        rowNumber,
        error: "Missing required columns: name, company, amount",
      });
    } else if (objectType === "customers" && (!r.name || !r.email)) {
      rowErrors.push({ rowNumber, error: "Missing required columns: name, email" });
    } else if (objectType === "transactions" && (!r.name || !r.amount || !r.partnerName)) {
      rowErrors.push({
        rowNumber,
        error: "Missing required columns: name, amount, partnerName",
      });
    } else if (objectType === "rewards" && (!r.partnerName || !r.amount)) {
      rowErrors.push({
        rowNumber,
        error: "Missing required columns: partnerName, amount",
      });
    } else if (objectType === "payouts" && (!r.partnerName || !r.payoutNumber)) {
      rowErrors.push({
        rowNumber,
        error: "Missing required columns: partnerName, payoutNumber",
      });
    } else {
      validRows.push(r);
    }
  });

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      objectType,
      totalRows: rows.length,
      validCount: validRows.length,
      validRows: validRows.length,
      errorCount: rowErrors.length,
      rowErrors,
      preview: validRows.slice(0, 10),
    });
  }

  let importedCount = 0;
  for (const r of validRows) {
    if (objectType === "partners") {
      const lf = generateRandomLeadFormToken();
      await prisma.partner.create({
        data: {
          name: r.name,
          programId: r.programId || "prog-strategic",
          programName: r.programName || "R-Cloud Strategic Solution Partners",
          qualifyingLevel: r.qualifyingLevel || "Silver Tier",
          country: r.country || "Singapore",
          currency: r.currency || "SGD",
          contactFirstName: r.contactFirstName || "Main",
          contactLastName: r.contactLastName || "Contact",
          contactEmail: r.contactEmail || "contact@partner.example.com",
          leadFormTokenHash: lf.tokenHash,
          leadFormTokenCipher: encryptBankDetails(lf.rawToken),
          bankDetailsJson: r.bankDetailsJson
            ? encryptBankDetails(r.bankDetailsJson)
            : encryptBankDetails("{}"),
        },
      });
      importedCount++;
    } else if (objectType === "contacts") {
      await prisma.partnerTeamMember.create({
        data: {
          name: r.name,
          email: r.email,
          jobTitle: r.jobTitle || "Partner Contact",
          phone: r.phone || "",
          partnerName: r.partnerName || "Apex Cloud Solutions Pte Ltd",
          role: r.role || "Sales Rep",
        },
      });
      importedCount++;
    } else if (objectType === "leads") {
      await prisma.lead.create({
        data: {
          firstName: r.firstName,
          lastName: r.lastName || "Contact",
          company: r.company,
          email: r.email,
          country: r.country || "Singapore",
          sourcePartnerName: r.sourcePartnerName || "Apex Cloud Solutions Pte Ltd",
          assignedPartner: r.sourcePartnerName || "Apex Cloud Solutions Pte Ltd",
        },
      });
      importedCount++;
    } else if (objectType === "deals") {
      const amt = Number(r.amount) || 10000;
      const fx = convertWithDatedFx(amt, r.currency || "SGD");
      await prisma.deal.create({
        data: {
          name: r.name,
          company: r.company,
          clientName: r.clientName || r.company,
          amount: fx.originalAmountMinor,
          currency: fx.currency,
          amountSgd: fx.amountSgdMinor,
          partnerName: r.partnerName || "Apex Cloud Solutions Pte Ltd",
          sourcePartnerName: r.partnerName || "Apex Cloud Solutions Pte Ltd",
          stage: r.stage || "Discovery Stage",
        },
      });
      importedCount++;
    } else if (objectType === "customers") {
      await prisma.customer.create({
        data: {
          name: r.name,
          email: r.email,
          sourcePartnerName: r.sourcePartnerName || "Apex Cloud Solutions Pte Ltd",
          revenuesSgd: toMinorUnits(Number(r.revenuesSgd) || 0),
        },
      });
      importedCount++;
    } else if (objectType === "transactions") {
      const amt = Number(r.amount) || 1000;
      const fx = convertWithDatedFx(amt, r.currency || "SGD");
      await prisma.transaction.create({
        data: {
          name: r.name,
          amount: fx.originalAmountMinor,
          currency: fx.currency,
          amountSgd: fx.amountSgdMinor,
          partnerName: r.partnerName,
          customerName: r.customerName || "Enterprise Client",
          dealName: r.dealName || "Enterprise Deal",
        },
      });
      importedCount++;
    } else if (objectType === "rewards") {
      const amt = Number(r.amount) || 500;
      const fx = convertWithDatedFx(amt, r.currency || "SGD");
      await prisma.reward.create({
        data: {
          rewardNumber: r.rewardNumber || `RW-IMP-${Date.now().toString().slice(-4)}`,
          partnerName: r.partnerName,
          recipientName: r.partnerName,
          amount: fx.originalAmountMinor,
          currency: fx.currency,
          amountSgd: fx.amountSgdMinor,
          fromActivity: r.fromActivity || "CSV Import",
          status: r.status || "Pending",
        },
      });
      importedCount++;
    } else if (objectType === "payouts") {
      const amt = Number(r.amount) || 1000;
      const fx = convertWithDatedFx(amt, r.currency || "SGD");
      await prisma.payout.create({
        data: {
          payoutNumber: r.payoutNumber,
          name: r.name || `Imported Payout ${r.payoutNumber}`,
          partnerName: r.partnerName,
          amount: fx.originalAmountMinor,
          currency: fx.currency,
          amountSgd: fx.amountSgdMinor,
          status: r.status || "Ready",
        },
      });
      importedCount++;
    }
  }

  await writeAudit({
    session,
    action: "CSV_IMPORT",
    objectType: `Import:${objectType}`,
    objectId: `${objectType}-${Date.now()}`,
    summary: `Imported ${importedCount} ${objectType} record(s) via CSV (${rowErrors.length} row errors)`,
    diff: { objectType, importedCount, errorCount: rowErrors.length },
  });

  return NextResponse.json({
    ok: true,
    dryRun: false,
    objectType,
    importedCount,
    imported: importedCount,
    errorCount: rowErrors.length,
    rowErrors,
  });
}

// §16.4 P4: Account Mapping Two-List CSV Matcher (Eber's account list vs Partner's account list matched by normalized domain & company name)
export function matchAccountListsByDomainAndName(
  eberAccounts: Array<{ accountName: string; domain?: string; type?: string; ownerName?: string; ownerEmail?: string }>,
  partnerAccounts: Array<{ partnerName: string; accountName: string; domain?: string; type?: string; ownerName?: string; ownerEmail?: string }>
) {
  const results: Array<{
    accountName: string;
    type: string;
    ownerName: string;
    ownerEmail: string;
    hasOverlap: boolean;
    partnerName: string;
    partnerAccountName: string;
    partnerAccountType: string;
    partnerOwnerName: string;
    partnerOwnerEmail: string;
    matchedBy: "domain" | "company_name" | "none";
  }> = [];

  const normDomain = (d?: string) =>
    String(d || "")
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .trim();

  for (const eber of eberAccounts) {
    const eKey = normalizeAccountKey(eber.accountName);
    const eDom = normDomain(eber.domain);

    let matchedPartnerRow: (typeof partnerAccounts)[number] | undefined;
    let matchedBy: "domain" | "company_name" | "none" = "none";

    for (const prt of partnerAccounts) {
      const pKey = normalizeAccountKey(prt.accountName);
      const pDom = normDomain(prt.domain);
      if (eDom && pDom && eDom === pDom) {
        matchedPartnerRow = prt;
        matchedBy = "domain";
        break;
      }
      if (
        eKey &&
        pKey &&
        (eKey === pKey || eKey.includes(pKey) || pKey.includes(eKey))
      ) {
        matchedPartnerRow = prt;
        matchedBy = "company_name";
        break;
      }
    }

    results.push({
      accountName: eber.accountName,
      type: eber.type || "Prospect",
      ownerName: eber.ownerName || "Alex Morgan",
      ownerEmail: eber.ownerEmail || "alex@r-prm.example.com",
      hasOverlap: Boolean(matchedPartnerRow),
      partnerName:
        matchedPartnerRow?.partnerName ||
        partnerAccounts[0]?.partnerName ||
        "Apex Cloud Solutions Pte Ltd",
      partnerAccountName: matchedPartnerRow?.accountName || "",
      partnerAccountType: matchedPartnerRow?.type || "Customer",
      partnerOwnerName: matchedPartnerRow?.ownerName || "Jordan Lee",
      partnerOwnerEmail:
        matchedPartnerRow?.ownerEmail || "jordan.lee@apexcloud.example.com",
      matchedBy,
    });
  }

  return results;
}
