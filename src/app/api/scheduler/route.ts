import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/authSession";
import { buildScheduledPayoutBatches } from "@/lib/prmEngine";

/**
 * Durable Scheduler Endpoint (§13.2 & §14.2 Slice 4 & Slice 6)
 * Processes:
 * 1. Invitation nurture sequence:
 *    - Day 2 Reminder 1
 *    - Day 5 Reminder 2
 *    - Day 7 Follow-up Task assigned to Partner Owner
 *    Persisted in ManageItem(category: "invitation_nurture") + Task so job state survives restarts.
 * 2. Configurable Monthly or Quarterly automatic payout creation per account & per program override.
 */
export async function GET(req: NextRequest) {
  const session = getServerSession(req);
  if (!session || session.identityType !== "coworker") {
    return NextResponse.json({ error: "Coworker session required" }, { status: 403 });
  }

  const jobs = await prisma.manageItem.findMany({
    where: {
      category: {
        in: ["scheduler_job", "workflows", "invitation_nurture"],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    schedulerStatus: "active",
    scheduleInterval: "60s durable tick",
    jobs,
  });
}

export async function POST(req: NextRequest) {
  const session = getServerSession(req);
  if (!session || session.identityType !== "coworker") {
    return NextResponse.json({ error: "Coworker session required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action || "RUN_TICK";
  const elapsedDays = Number(body.elapsedDays ?? 7);
  const results: string[] = [];

  // 1. Durable Invitation Nurture (Day 2 Reminder -> Day 5 Reminder -> Day 7 Task)
  const pendingPartners = await prisma.partner.findMany({
    where: { status: "Pending" },
  });

  for (const partner of pendingPartners) {
    let nurtureJob = await prisma.manageItem.findFirst({
      where: {
        category: "invitation_nurture",
        name: `Invitation Nurture: ${partner.name}`,
      },
    });

    let meta: {
      partnerId: string;
      day2Sent: boolean;
      day5Sent: boolean;
      day7TaskCreated: boolean;
    } = {
      partnerId: partner.id,
      day2Sent: false,
      day5Sent: false,
      day7TaskCreated: false,
    };

    if (nurtureJob) {
      try {
        meta = { ...meta, ...JSON.parse(nurtureJob.metadataJson || "{}") };
      } catch {
        // default meta
      }
    }

    if (elapsedDays >= 2 && !meta.day2Sent) {
      await prisma.manageItem.create({
        data: {
          category: "email_outbox",
          name: `[Day 2 Reminder] Activate your ${partner.programName} Partner Portal`,
          subtitle: `To: ${partner.contactFirstName} ${partner.contactLastName} <${partner.contactEmail}> · Day 2 Nurture`,
          status: "Sent",
          metadataJson: JSON.stringify({
            partnerId: partner.id,
            recipientEmail: partner.contactEmail,
            step: "Day 2 Reminder",
          }),
        },
      });
      meta.day2Sent = true;
      results.push(`Day 2 invitation reminder sent to ${partner.contactEmail} (${partner.name})`);
    }

    if (elapsedDays >= 5 && !meta.day5Sent) {
      await prisma.manageItem.create({
        data: {
          category: "email_outbox",
          name: `[Day 5 Reminder] Final reminder to activate ${partner.programName} Portal`,
          subtitle: `To: ${partner.contactFirstName} ${partner.contactLastName} <${partner.contactEmail}> · Day 5 Nurture`,
          status: "Sent",
          metadataJson: JSON.stringify({
            partnerId: partner.id,
            recipientEmail: partner.contactEmail,
            step: "Day 5 Reminder",
          }),
        },
      });
      meta.day5Sent = true;
      results.push(`Day 5 invitation reminder sent to ${partner.contactEmail} (${partner.name})`);
    }

    if (elapsedDays >= 7 && !meta.day7TaskCreated) {
      const taskName = `Follow up on pending partner invitation: ${partner.name}`;
      const existingTask = await prisma.task.findFirst({
        where: { name: taskName },
      });
      if (!existingTask) {
        await prisma.task.create({
          data: {
            name: taskName,
            status: "Due Today",
            type: "Follow-up",
            dueDate: "2026-11-26",
            description: `Day 2 + Day 5 invitation reminders sent to ${partner.contactEmail}. Follow up directly with ${partner.contactFirstName} ${partner.contactLastName}.`,
            assignedTo: partner.owner || "Alex Morgan",
            associationType: "Partner",
            associationName: partner.name,
          },
        });
      }
      meta.day7TaskCreated = true;
      results.push(`Day 7 internal follow-up task created for ${partner.name}`);
    }

    const jobStatus = meta.day7TaskCreated
      ? "Completed (Day 2, Day 5, Day 7 Done)"
      : meta.day5Sent
      ? "In Progress (Day 5 Sent)"
      : meta.day2Sent
      ? "In Progress (Day 2 Sent)"
      : "Queued";

    if (nurtureJob) {
      await prisma.manageItem.update({
        where: { id: nurtureJob.id },
        data: {
          status: jobStatus,
          subtitle: `Partner: ${partner.name} · Day2=${meta.day2Sent} · Day5=${meta.day5Sent} · Day7Task=${meta.day7TaskCreated}`,
          metadataJson: JSON.stringify(meta),
        },
      });
    } else {
      nurtureJob = await prisma.manageItem.create({
        data: {
          category: "invitation_nurture",
          name: `Invitation Nurture: ${partner.name}`,
          subtitle: `Partner: ${partner.name} · Day2=${meta.day2Sent} · Day5=${meta.day5Sent} · Day7Task=${meta.day7TaskCreated}`,
          status: jobStatus,
          metadataJson: JSON.stringify(meta),
        },
      });
    }
  }

  // 2. Configurable Monthly / Quarterly Automatic Payout Creation (§14.2 Slice 4)
  if (action === "RUN_AUTO_PAYOUTS" || action === "RUN_TICK") {
    const [unpaidAcceptedRewards, allPartners, allPrograms, acctRow, allTxs] =
      await Promise.all([
        prisma.reward.findMany({
          where: {
            status: "Accepted",
            payoutNumber: "",
          },
        }),
        prisma.partner.findMany(),
        prisma.program.findMany(),
        prisma.appSetting.findUnique({ where: { key: "account_settings" } }),
        prisma.transaction.findMany(),
      ]);

    let accountSettings: {
      autoPayoutSchedule?: string;
      autoPayoutThresholdSgd?: number;
    } = {};
    if (acctRow?.valueJson) {
      try {
        accountSettings = JSON.parse(acctRow.valueJson);
      } catch {
        accountSettings = {};
      }
    }
    if (body.minThreshold !== undefined) {
      accountSettings.autoPayoutThresholdSgd = Number(body.minThreshold);
    }

    const schedulable = unpaidAcceptedRewards.map((rw) => {
      const matchedTx = allTxs.find((t) => rw.fromActivity.includes(t.name));
      return {
        id: rw.id,
        rewardNumber: rw.rewardNumber,
        partnerName: rw.partnerName,
        amount: rw.amount,
        currency: rw.currency,
        amountSgd: rw.amountSgd,
        status: rw.status,
        payoutNumber: rw.payoutNumber,
        periodDate: matchedTx?.monthKey || "11/2026",
      };
    });

    const batches = buildScheduledPayoutBatches(
      schedulable,
      allPartners,
      allPrograms,
      accountSettings
    );

    for (const batch of batches) {
      await prisma.payout.create({
        data: {
          payoutNumber: batch.payoutNumber,
          name: batch.name,
          partnerName: batch.partnerName,
          amount: batch.amountSgd,
          currency: "SGD",
          amountSgd: batch.amountSgd,
          periodFrom: batch.periodFrom,
          periodTo: batch.periodTo,
          rewardsCount: batch.rewardsCount,
          invoiceRef: `INV-AUTO-${Date.now().toString().slice(-5)}`,
          status: "Ready",
        },
      });
      for (const rwId of batch.rewardIds) {
        await prisma.reward.update({
          where: { id: rwId },
          data: { payoutNumber: batch.payoutNumber },
        });
      }
      results.push(
        `Auto-created ${batch.cadence} payout ${batch.payoutNumber} (${batch.partnerName}, ${batch.periodKey}) for SGD ${batch.amountSgd.toLocaleString()} across ${batch.rewardsCount} accepted rewards`
      );
    }
  }

  await prisma.auditLog.create({
    data: {
      actor: session.email || "scheduler@r-prm.local",
      actorRole: `${session.identityType} (${session.role})`,
      action: "RUN_DURABLE_SCHEDULER_TICK",
      objectType: "Scheduler",
      objectId: "scheduler-tick",
      summary:
        results.length > 0
          ? results.join(" | ")
          : "Durable scheduler tick completed (0 pending jobs required action).",
      diffJson: JSON.stringify({ results }),
    },
  });

  return NextResponse.json({
    ok: true,
    executedAt: new Date().toISOString(),
    results,
  });
}
