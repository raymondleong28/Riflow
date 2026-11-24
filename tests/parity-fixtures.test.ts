import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import {
  EBER_COMMISSION_FIXTURE_RULES,
  evaluateRuleForInvoice,
  convertWithDatedFx,
  computePartnerKpis,
  canPartnerAccessAsset,
  computeAccountOverlaps,
} from "../src/lib/prmEngine";

async function runFixtures() {
  console.log("Running R-PRM Known-Answer Parity Fixtures (§3 Slice 0d & §4.1.4)...");

  // 1. Database baseline fixtures (Transactions & Deals)
  const [transactions, deals, partners, leads, rewards, manageItems, accounts] =
    await Promise.all([
      prisma.transaction.findMany(),
      prisma.deal.findMany(),
      prisma.partner.findMany(),
      prisma.lead.findMany(),
      prisma.reward.findMany(),
      prisma.manageItem.findMany(),
      prisma.accountRecord.findMany(),
    ]);

  // Fixture 1: Baseline 6 seed transactions total = SGD 82,100
  const seedTxIds = ["tx-1", "tx-2", "tx-3", "tx-4", "tx-5", "tx-6"];
  const seedTxs = transactions.filter((t) => seedTxIds.includes(t.id));
  const txSum = seedTxs.reduce((acc, t) => acc + t.amountSgd, 0);
  assert.equal(
    txSum,
    82100,
    `Fixture 1 failed: expected baseline transactions sum 82100, got ${txSum}`
  );
  console.log("✓ Fixture 1 passed: Baseline transactions chart total = SGD 82,100");

  // Fixture 2: Baseline 10 seed deals -> 10 registered, 2 won, 1 lost
  const seedDealIds = [
    "deal-1",
    "deal-2",
    "deal-3",
    "deal-4",
    "deal-5",
    "deal-6",
    "deal-7",
    "deal-8",
    "deal-9",
    "deal-10",
  ];
  const seedDeals = deals.filter((d) => seedDealIds.includes(d.id));
  const wonCount = seedDeals.filter((d) => d.stage === "Closed Won").length;
  const lostCount = seedDeals.filter((d) => d.stage === "Closed Lost").length;
  assert.equal(seedDeals.length, 10, "Expected 10 baseline registered deals");
  assert.equal(wonCount, 2, "Expected 2 baseline Closed Won deals");
  assert.equal(lostCount, 1, "Expected 1 baseline Closed Lost deal");
  console.log(
    "✓ Fixture 2 passed: Baseline deals stats = 10 registered, 2 won, 1 lost"
  );

  // Fixture 3a: Biz Partner (one-off at month 4)
  const bizOneOff = EBER_COMMISSION_FIXTURE_RULES.biz_partner_one_off;
  const seenKeys = new Set<string>();
  for (let m = 1; m <= 6; m++) {
    const res = evaluateRuleForInvoice(
      bizOneOff,
      {
        invoiceId: `INV-M${m}`,
        merchantName: "Merchant Alpha",
        partnerName: "Apex Cloud Solutions Pte Ltd",
        billingMonth: m,
        invoiceAmount: 1200,
        monthlySubscriptionFee: 1200,
        currency: "SGD",
        paidDate: "2026-11-24",
      },
      seenKeys
    );
    if (m === 4) {
      assert.ok(res, "Month 4 should generate one-off reward");
      assert.equal(res.amountSgd, 1200);
      seenKeys.add(res.idempotencyKey);
    } else {
      assert.equal(res, null, `Month ${m} must earn 0 for Biz Partner one-off`);
    }
  }
  // Idempotency check on Month 4
  const dupM4 = evaluateRuleForInvoice(
    bizOneOff,
    {
      invoiceId: "INV-M4",
      merchantName: "Merchant Alpha",
      partnerName: "Apex Cloud Solutions Pte Ltd",
      billingMonth: 4,
      invoiceAmount: 1200,
      monthlySubscriptionFee: 1200,
      currency: "SGD",
      paidDate: "2026-11-24",
    },
    seenKeys
  );
  assert.equal(dupM4, null, "Re-processing same Month-4 invoice must be idempotent");
  console.log(
    "✓ Fixture 3a passed: Biz Partner one-off (0 for M1-3, 1-month fee at M4, idempotent)"
  );

  // Fixture 3b: Biz Partner Premium (20% M4-15, 10% M16-27)
  const bizPremium = EBER_COMMISSION_FIXTURE_RULES.biz_partner_premium_recurring;
  for (const [m, expected] of [
    [1, null],
    [3, null],
    [4, 200],
    [15, 200],
    [16, 100],
    [27, 100],
    [28, null],
  ] as const) {
    const res = evaluateRuleForInvoice(bizPremium, {
      invoiceId: `PREM-M${m}`,
      merchantName: "Merchant Beta",
      partnerName: "Apex Cloud Solutions Pte Ltd",
      billingMonth: m,
      invoiceAmount: 1000,
      currency: "SGD",
      paidDate: "2026-11-24",
    });
    assert.equal(
      res ? res.amountSgd : null,
      expected,
      `Month ${m} expected ${expected}, got ${res?.amountSgd}`
    );
  }
  // Churned client stops earning immediately
  const churnedRes = evaluateRuleForInvoice(bizPremium, {
    invoiceId: "PREM-CHURN",
    merchantName: "Merchant Beta",
    partnerName: "Apex Cloud Solutions Pte Ltd",
    billingMonth: 8,
    invoiceAmount: 1000,
    currency: "SGD",
    paidDate: "2026-11-24",
    isStillPartnerClient: false,
  });
  assert.equal(churnedRes, null, "No reward if merchant is no longer partner client");
  console.log(
    "✓ Fixture 3b passed: Biz Partner Premium recurring (20% M4-15, 10% M16-27, stops on churn)"
  );

  // Fixture 3c: Referral entry (no commission unless agreed in writing before order acceptance)
  const referralRule = EBER_COMMISSION_FIXTURE_RULES.referral_entry;
  const noAgreement = evaluateRuleForInvoice(referralRule, {
    invoiceId: "REF-1",
    merchantName: "Merchant Gamma",
    partnerName: "BluePeak Commerce Advisory",
    billingMonth: 1,
    invoiceAmount: 5000,
    currency: "SGD",
    paidDate: "2026-11-24",
  });
  assert.equal(noAgreement, null, "Referral entry without agreement must earn 0");

  const validAgreement = evaluateRuleForInvoice(referralRule, {
    invoiceId: "REF-2",
    merchantName: "Merchant Gamma",
    partnerName: "BluePeak Commerce Advisory",
    billingMonth: 1,
    invoiceAmount: 5000,
    currency: "SGD",
    paidDate: "2026-11-24",
    agreedOverrideRatePct: 12,
    agreedBeforeAcceptanceTimestamp: "2026-11-01T10:00:00Z",
    orderAcceptedTimestamp: "2026-11-02T10:00:00Z",
  });
  assert.equal(validAgreement?.amountSgd, 600, "12% override on 5000 should equal 600");
  console.log(
    "✓ Fixture 3c passed: Referral entry pre-acceptance written agreement check"
  );

  // Fixture 3d: Dated FX check
  const fxUsd = convertWithDatedFx(1000, "USD");
  assert.equal(fxUsd.amountSgd, 1350);
  assert.equal(fxUsd.fxRate, 1.35);
  assert.ok(fxUsd.fxRateDate, "FX conversion must carry rateDate");
  console.log("✓ Fixture 3d passed: Multi-currency conversion carries dated FX rate");

  // Fixture 4 (D6): Asset scoping — Strategic partner must NOT see ISV & Tech asset
  const strategicPartner = partners.find((p) => p.id === "prt-1");
  const isvPartner = partners.find((p) => p.id === "prt-4");
  const isvOnlyAsset =
    manageItems.find(
      (m) =>
        m.category === "assets" &&
        m.subtitle.toLowerCase().includes("isv & tech partners")
    ) || {
      category: "assets",
      name: "ISV Technical Video",
      subtitle: "Training Video · ISV & Tech Partners",
      metadataJson: JSON.stringify({ programVisibility: "ISV & Tech Partners" }),
    };

  assert.equal(
    canPartnerAccessAsset(isvOnlyAsset, strategicPartner),
    false,
    "Strategic partner must NOT see asset scoped only to ISV & Tech Partners"
  );
  assert.equal(
    canPartnerAccessAsset(isvOnlyAsset, isvPartner),
    true,
    "ISV partner MUST see asset scoped to ISV & Tech Partners"
  );
  console.log(
    "✓ Fixture 4 passed (D6): Server-side asset scoping blocks cross-program leakage"
  );

  // Fixture 5 (D4 & D5): Computed Partner KPIs match actual Closed Won deals (2 won deals total, not 38)
  const computedPartners = partners.map((p) =>
    computePartnerKpis(p, leads, seedDeals, rewards)
  );
  const totalComputedWon = computedPartners.reduce(
    (sum, p) => sum + p.wonDealsCount,
    0
  );
  assert.equal(
    totalComputedWon,
    2,
    `Expected total computed won deals across partners to be 2, got ${totalComputedWon}`
  );
  console.log(
    "✓ Fixture 5 passed (D4/D5): Partner & Top Sales Partners KPIs are computed from records"
  );

  // Fixture 6 (D11): Computed Account Overlaps
  const computedOverlaps = computeAccountOverlaps(accounts);
  assert.ok(
    computedOverlaps.filter((a) => a.hasOverlap).length >= 5,
    "Computed overlaps should match normalized account names"
  );
  console.log("✓ Fixture 6 passed (D11): Account overlaps computed from account names");

  console.log("\nALL 6 KNOWN-ANSWER PARITY FIXTURES PASSED GREEN!");
  await prisma.$disconnect();
}

runFixtures().catch(async (err) => {
  console.error("Parity fixture failure:", err);
  await prisma.$disconnect();
  process.exit(1);
});
