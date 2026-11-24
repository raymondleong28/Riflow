import { prisma } from "../src/lib/prisma";
import {
  normalizeRewardRule,
  generateRewardsFromPartnerLevel,
} from "../src/lib/prmEngine";

async function syncSingleStore() {
  console.log("1. Normalizing Program.levelsJson in SQLite to StructuredRewardRule objects...");
  const programs = await prisma.program.findMany();
  for (const prog of programs) {
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
    await prisma.program.update({
      where: { id: prog.id },
      data: { levelsJson: JSON.stringify(normalizedLevels) },
    });
  }

  console.log("2. Re-computing transaction rewards from each partner's actual Program Level rules (§13.1)...");
  const [updatedPrograms, partners, transactions] = await Promise.all([
    prisma.program.findMany(),
    prisma.partner.findMany(),
    prisma.transaction.findMany({ orderBy: { id: "asc" } }),
  ]);

  // Clear old miscalculated 18%-for-everyone rewards and regenerate from actual tier rules
  await prisma.reward.deleteMany();

  let seq = 1041;
  for (const tx of transactions) {
    const partner = partners.find((p) => p.name === tx.partnerName);
    if (!partner) continue;
    const generated = generateRewardsFromPartnerLevel(
      {
        id: tx.id,
        name: tx.name,
        amount: tx.amount,
        currency: tx.currency,
        partnerName: tx.partnerName,
      },
      partner,
      updatedPrograms
    );

    for (const g of generated) {
      const rewardNumber = `RW-${seq--}`;
      const isPaidTx = tx.id === "tx-6";
      const isBatchReadyTx = tx.id === "tx-4";
      await prisma.reward.create({
        data: {
          rewardNumber,
          partnerName: g.partnerName,
          recipientName: g.recipientName,
          type: g.type,
          amount: g.amount,
          currency: g.currency,
          amountSgd: g.amountSgd,
          fromActivity: g.fromActivity,
          fromRewardRule: g.fromRewardRule,
          status: isPaidTx ? "Paid" : isBatchReadyTx ? "Accepted" : "Pending",
          payoutNumber: isPaidTx
            ? "PO-2026-03"
            : isBatchReadyTx
            ? "PO-2026-04"
            : "",
          comment: g.comment,
        },
      });
    }
  }

  console.log("3. Writing AuditLog entries so /api/audit reflects store operations...");
  const existingLogs = await prisma.auditLog.count();
  if (existingLogs === 0) {
    await prisma.auditLog.createMany({
      data: [
        {
          actor: "System Engine",
          actorRole: "Coworker (Admin)",
          action: "UPDATE",
          objectType: "Program",
          objectId: "prog-strategic",
          summary:
            "Normalized all program tier levels to StructuredRewardRule schema in single database store",
          diffJson: JSON.stringify({ programsUpdated: updatedPrograms.length }),
        },
        {
          actor: "System Engine",
          actorRole: "Coworker (Admin)",
          action: "CREATE",
          objectType: "Reward",
          objectId: "tx-1",
          summary:
            "Computed Platinum Elite rewards for Apex Cloud Solutions (SGD 28,500 -> 25% SGD 7,125 + 5% SGD 1,425)",
          diffJson: JSON.stringify({
            transaction: "INV-2026-901 · Solaris Annual License",
            rewardsSgd: [7125, 1425],
          }),
        },
        {
          actor: "System Engine",
          actorRole: "Coworker (Admin)",
          action: "CREATE",
          objectType: "Reward",
          objectId: "tx-4",
          summary:
            "Computed Platinum Elite rewards for Synthetix POS & Retail Tech (SGD 12,600 -> 25% SGD 3,150 + 5% SGD 630)",
          diffJson: JSON.stringify({
            transaction: "INV-2026-790 · KL Gourmet POS Suite",
            rewardsSgd: [3150, 630],
          }),
        },
      ],
    });
  }

  const allRewards = await prisma.reward.findMany();
  console.log(
    `Done! Generated ${allRewards.length} tier-accurate rewards. Apex rewards on tx-1:`,
    allRewards
      .filter((r) => r.partnerName.includes("Apex"))
      .map((r) => `${r.rewardNumber}: SGD ${r.amountSgd} (${r.fromRewardRule})`)
  );
  await prisma.$disconnect();
}

syncSingleStore().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
