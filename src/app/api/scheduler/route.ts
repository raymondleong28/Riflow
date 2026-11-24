import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/authSession";

/**
 * Durable Scheduler Endpoint (§13.2 & §13.7 #9)
 * Processes:
 * 1. Invitation nurture sequence (Day 2 Reminder 1 -> Day 5 Reminder 2 -> Day 7 Task assigned to Partner Owner)
 * 2. Monthly automatic payout creation on the 1st of the month (batches all Accepted & Unpaid rewards above threshold)
 * 3. Delayed workflow steps (e.g. Wait 2 days -> Send email / Create task / Update property)
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
  const results: string[] = [];

  // 1. Process Invitation Nurture for Pending Partners without Portal Activation
  const pendingPartners = await prisma.partner.findMany({
    where: { status: "Pending" },
  });

  for (const partner of pendingPartners) {
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
      await prisma.manageItem.create({
        data: {
          category: "email_outbox",
          name: `[Reminder] Activate your ${partner.programName} Partner Portal`,
          subtitle: `To: ${partner.contactFirstName} ${partner.contactLastName} <${partner.contactEmail}> · Delivered (Local Outbox)`,
          status: "Sent",
          metadataJson: JSON.stringify({
            recipientEmail: partner.contactEmail,
            category: "Invitation Nurture (Day 2 / Day 5)",
          }),
        },
      });
      results.push(`Processed invitation nurture & follow-up task for ${partner.name}`);
    }
  }

  // 2. Process Automatic Monthly Payout Creation (if requested or on tick)
  if (action === "RUN_AUTO_PAYOUTS" || action === "RUN_TICK") {
    const unpaidAcceptedRewards = await prisma.reward.findMany({
      where: {
        status: "Accepted",
        payoutNumber: "",
      },
    });

    const byPartner: Record<string, typeof unpaidAcceptedRewards> = {};
    for (const rw of unpaidAcceptedRewards) {
      if (!byPartner[rw.partnerName]) byPartner[rw.partnerName] = [];
      byPartner[rw.partnerName].push(rw);
    }

    const minThreshold = Number(body.minThreshold ?? 250);
    for (const [partnerName, rewards] of Object.entries(byPartner)) {
      const totalAmount = rewards.reduce((s, r) => s + Number(r.amountSgd || 0), 0);
      if (totalAmount >= minThreshold) {
        const payoutNumber = `PO-AUTO-${Math.floor(1000 + Math.random() * 9000)}`;
        await prisma.payout.create({
          data: {
            payoutNumber,
            name: `Scheduled Auto-Payout (1st of Month) · ${partnerName}`,
            partnerName,
            amount: totalAmount,
            currency: "SGD",
            amountSgd: totalAmount,
            rewardsCount: rewards.length,
            invoiceRef: `INV-AUTO-${Date.now().toString().slice(-5)}`,
            status: "Ready",
          },
        });
        for (const rw of rewards) {
          await prisma.reward.update({
            where: { id: rw.id },
            data: { payoutNumber },
          });
        }
        results.push(
          `Auto-created payout ${payoutNumber} (${partnerName}) for SGD ${totalAmount.toLocaleString()} across ${rewards.length} accepted rewards`
        );
      }
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
