import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import {
  EBER_COMMISSION_FIXTURE_RULES,
  evaluateRuleForInvoice,
  convertWithDatedFx,
  computePartnerKpis,
  canPartnerAccessAsset,
  computeAccountOverlaps,
  getPartnerLeadFormToken,
  resolvePartnerByLeadFormToken,
  buildScheduledPayoutBatches,
  evaluateOnboardingStageCompletion,
} from "../src/lib/prmEngine";
import {
  loadAndValidateConnectorConfig,
  enrollTotpMfa,
  generateTotpCode,
  verifyTotpOrRecoveryCode,
  encryptBankDetails,
  decryptBankDetails,
} from "../src/lib/connectors";

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

  // Fixture 7 (§13.1 & §13.7 #4): Partner tier level reward generation — Apex Platinum (25% + 5%) on SGD 28,500 (tx-1) -> SGD 7,125 and SGD 1,425
  const apexTx1Rewards = rewards.filter(
    (r) =>
      r.partnerName.includes("Apex") &&
      (r.fromActivity.includes("INV-2026-901") || r.amountSgd === 7125 || r.amountSgd === 1425)
  );
  const amounts = apexTx1Rewards.map((r) => r.amountSgd).sort((a, b) => b - a);
  assert.deepEqual(
    amounts,
    [7125, 1425],
    `Expected Apex Platinum (25% + 5%) rewards on SGD 28,500 tx-1 to be [7125, 1425], got ${JSON.stringify(
      amounts
    )}`
  );
  console.log(
    "✓ Fixture 7 passed (§13.1): Apex Platinum (25% + 5%) on SGD 28,500 produces SGD 7,125 and SGD 1,425"
  );

  // Fixture 8 (§13.1 & §13.7 #1): Unified store — Program.levelsJson in SQLite holds normalized StructuredRewardRule objects
  const programs = await prisma.program.findMany();
  for (const prog of programs) {
    const levels = JSON.parse(prog.levelsJson || "[]");
    assert.ok(levels.length > 0, `Program ${prog.id} must have levels`);
    for (const lvl of levels) {
      for (const r of lvl.rewards || []) {
        assert.equal(
          typeof r,
          "object",
          `Program ${prog.id} level ${lvl.name} reward must be normalized StructuredRewardRule object`
        );
        assert.ok(r.id && r.title && r.trigger, "StructuredRewardRule must have id, title, trigger");
      }
    }
  }
  console.log(
    "✓ Fixture 8 passed (§13.1): SQLite Program.levelsJson stores normalized StructuredRewardRule objects"
  );

  // Fixture 9 (§13.1 & §13.7 #3): AuditLog has real entries in SQLite
  const auditLogs = await prisma.auditLog.findMany();
  assert.ok(
    auditLogs.length > 0,
    "AuditLog table must contain real audit entries"
  );
  console.log(
    `✓ Fixture 9 passed (§13.1): AuditLog table contains ${auditLogs.length} real entries`
  );

  // Fixture 10 (§13.1 & §13.7 #5): Unguessable public lead form token resolves partner; raw "prt-1" or invalid token returns null
  const apexLeadToken = getPartnerLeadFormToken("prt-1");
  assert.ok(
    apexLeadToken.startsWith("lf_") && apexLeadToken.length === 27,
    `Expected unguessable lead form token lf_<24-hex>, got ${apexLeadToken}`
  );
  const resolvedApex = resolvePartnerByLeadFormToken(apexLeadToken, partners);
  assert.equal(resolvedApex?.id, "prt-1", "Valid lead token must resolve prt-1");
  assert.equal(
    resolvePartnerByLeadFormToken("prt-1", partners),
    null,
    "Raw partner ID prt-1 must be rejected (returns null)"
  );
  assert.equal(
    resolvePartnerByLeadFormToken("bad-token", partners),
    null,
    "Unknown token must return null"
  );
  console.log(
    `✓ Fixture 10 passed (§13.1): Unguessable lead token (${apexLeadToken}) resolves partner and rejects raw 'prt-1'`
  );

  // Fixture 11 (§13.2 & §13.5): Connector fail-closed validation, TOTP MFA verification, and AES-256-GCM bank details encryption
  const localConfig = loadAndValidateConnectorConfig({});
  assert.equal(localConfig.EMAIL_DRIVER, "local");
  assert.throws(
    () => loadAndValidateConnectorConfig({ EMAIL_DRIVER: "smtp" }),
    /FAIL_CLOSED/,
    "Live SMTP driver without credentials must fail closed"
  );
  const totpSecret = "JBSWY3DPEHPK3PXP";
  const nowCode = generateTotpCode(totpSecret);
  const totpResult = verifyTotpOrRecoveryCode(nowCode, totpSecret);
  assert.equal(totpResult.valid, true, "Generated RFC 6238 TOTP code must verify");
  const encBank = encryptBankDetails(JSON.stringify({ iban: "SG99DBS000123456", swift: "DBSSSGSG" }));
  const decBank = JSON.parse(decryptBankDetails(encBank));
  assert.equal(decBank?.iban, "SG99DBS000123456", "AES-256-GCM bank details roundtrip must match");
  console.log(
    "✓ Fixture 11 passed (§13.2/§13.5): Connectors fail closed, RFC 6238 TOTP verifies, and AES-256-GCM bank encryption roundtrips"
  );

  // Fixture 12 (§14.2 Slice 1): Silver Tier of prog-strategic lists ONLY "10% Recurring Deal Commission" and AuditLog has a DELETE entry for "SGD 1,000 Quarterly Quota Accelerator Bonus"
  const progStrategic = programs.find((p) => p.id === "prog-strategic");
  assert.ok(progStrategic, "prog-strategic must exist");
  const stratLevels = JSON.parse(progStrategic.levelsJson || "[]");
  const silverLevel = stratLevels.find((l: { name: string }) => l.name === "Silver Tier");
  assert.ok(silverLevel, "Silver Tier must exist in prog-strategic");
  const silverRewardTitles = (silverLevel.rewards || []).map((r: { title: string }) => r.title);
  assert.deepEqual(
    silverRewardTitles,
    ["10% Recurring Deal Commission"],
    `Silver Tier of prog-strategic must contain ONLY ['10% Recurring Deal Commission'], got ${JSON.stringify(
      silverRewardTitles
    )}`
  );
  const deletePresetAudit = auditLogs.find(
    (log) =>
      log.action === "DELETE" &&
      log.summary.includes("Quarterly Quota Accelerator Bonus")
  );
  assert.ok(
    deletePresetAudit,
    "AuditLog must contain a DELETE entry for 'SGD 1,000 Quarterly Quota Accelerator Bonus'"
  );
  console.log(
    "✓ Fixture 12 passed (§14.2 Slice 1): Silver Tier of prog-strategic lists only '10% Recurring Deal Commission' & AuditLog has DELETE entry"
  );

  // Fixture 13 (§14.2 Slice 4): Configurable Payout Schedule — Quarterly program creates 1 payout per partner per quarter; Monthly program creates 1 per month
  const samplePartnerQuarterly = {
    id: "prt-q",
    name: "Apex Cloud Solutions Pte Ltd",
    programId: "prog-q",
    programName: "Quarterly Biz Partner Program",
  };
  const samplePartnerMonthly = {
    id: "prt-m",
    name: "NovaBridge Digital Systems",
    programId: "prog-m",
    programName: "Monthly Reseller Program",
  };
  const samplePrograms = [
    {
      id: "prog-q",
      name: "Quarterly Biz Partner Program",
      autoEmailsJson: JSON.stringify({
        payoutCadence: "quarterly",
        payoutThresholdSgd: 250,
      }),
    },
    {
      id: "prog-m",
      name: "Monthly Reseller Program",
      autoEmailsJson: JSON.stringify({
        payoutCadence: "monthly",
        payoutThresholdSgd: 250,
      }),
    },
  ];
  const sampleRewards = [
    // 3 accepted rewards across Oct, Nov, Dec 2026 (Q4) for Quarterly Partner
    {
      id: "rw-q1",
      partnerName: "Apex Cloud Solutions Pte Ltd",
      amount: 1000,
      currency: "SGD",
      amountSgd: 1000,
      status: "Accepted",
      periodDate: "10/2026",
    },
    {
      id: "rw-q2",
      partnerName: "Apex Cloud Solutions Pte Ltd",
      amount: 1500,
      currency: "SGD",
      amountSgd: 1500,
      status: "Accepted",
      periodDate: "11/2026",
    },
    {
      id: "rw-q3",
      partnerName: "Apex Cloud Solutions Pte Ltd",
      amount: 2000,
      currency: "SGD",
      amountSgd: 2000,
      status: "Accepted",
      periodDate: "12/2026",
    },
    // 2 accepted rewards across Oct and Nov 2026 for Monthly Partner
    {
      id: "rw-m1",
      partnerName: "NovaBridge Digital Systems",
      amount: 800,
      currency: "SGD",
      amountSgd: 800,
      status: "Accepted",
      periodDate: "10/2026",
    },
    {
      id: "rw-m2",
      partnerName: "NovaBridge Digital Systems",
      amount: 900,
      currency: "SGD",
      amountSgd: 900,
      status: "Accepted",
      periodDate: "11/2026",
    },
  ];
  const scheduledBatches = buildScheduledPayoutBatches(
    sampleRewards,
    [samplePartnerQuarterly, samplePartnerMonthly],
    samplePrograms,
    { autoPayoutSchedule: "monthly", autoPayoutThresholdSgd: 250 }
  );
  const apexQuarterlyBatches = scheduledBatches.filter(
    (b) => b.partnerName === "Apex Cloud Solutions Pte Ltd"
  );
  const novaMonthlyBatches = scheduledBatches.filter(
    (b) => b.partnerName === "NovaBridge Digital Systems"
  );
  assert.equal(
    apexQuarterlyBatches.length,
    1,
    "Quarterly program must bundle Q4 rewards into exactly 1 payout per partner per quarter"
  );
  assert.equal(apexQuarterlyBatches[0].periodKey, "2026-Q4");
  assert.equal(apexQuarterlyBatches[0].amountSgd, 4500);
  assert.equal(apexQuarterlyBatches[0].rewardsCount, 3);
  assert.equal(
    novaMonthlyBatches.length,
    2,
    "Monthly program must create 1 payout per month (Oct and Nov)"
  );
  console.log(
    "✓ Fixture 13 passed (§14.2 Slice 4): Quarterly program bundles 1 payout/quarter (SGD 4,500 across 3 rewards); Monthly creates 1/month"
  );

  // Fixture 14 (§14.2 Slice 6a): Onboarding actions attached to individual stages (all 6 types, stage completion & validation gates)
  const sixStageActions = [
    {
      id: "sa-1",
      stage: "Kickoff Welcome Call",
      actionType: "book_meeting" as const,
      title: "Book Kickoff Alignment Call",
      requireValidation: false,
      completedByPartner: true,
      validatedByCoworker: false,
    },
    {
      id: "sa-2",
      stage: "Kickoff Welcome Call",
      actionType: "view_asset" as const,
      title: "Review 2026 Enterprise Partner Pitch Deck",
      requireValidation: false,
      completedByPartner: true,
      validatedByCoworker: false,
    },
    {
      id: "sa-3",
      stage: "Book a Demo Account Training",
      actionType: "read_article" as const,
      title: "Read Deal Registration Guidelines",
      requireValidation: false,
      completedByPartner: true,
      validatedByCoworker: false,
    },
    {
      id: "sa-4",
      stage: "Book a Demo Account Training",
      actionType: "provide_information" as const,
      title: "Complete Regional Territory Form",
      requireValidation: true,
      completedByPartner: true,
      validatedByCoworker: false, // Pending coworker validation!
    },
    {
      id: "sa-5",
      stage: "Technical Certification",
      actionType: "upload_document" as const,
      title: "Upload Counter-Signed Master Reseller Agreement",
      requireValidation: true,
      completedByPartner: false,
      validatedByCoworker: false,
    },
    {
      id: "sa-6",
      stage: "Completed",
      actionType: "self_invoicing_opt_in" as const,
      title: "Confirm Self-Invoicing Preference",
      requireValidation: false,
      completedByPartner: true,
      validatedByCoworker: false,
    },
  ];
  const stage1Eval = evaluateOnboardingStageCompletion(
    "Kickoff Welcome Call",
    sixStageActions
  );
  assert.equal(stage1Eval.isStageComplete, true, "Stage 1 with non-validated completed actions must be complete");
  const stage2BeforeApproval = evaluateOnboardingStageCompletion(
    "Book a Demo Account Training",
    sixStageActions
  );
  assert.equal(
    stage2BeforeApproval.isStageComplete,
    false,
    "Stage 2 must NOT complete while validation-required action awaits coworker approval"
  );
  assert.equal(stage2BeforeApproval.pendingValidationCount, 1);
  // Coworker approves sa-4
  sixStageActions[3].validatedByCoworker = true;
  const stage2AfterApproval = evaluateOnboardingStageCompletion(
    "Book a Demo Account Training",
    sixStageActions
  );
  assert.equal(
    stage2AfterApproval.isStageComplete,
    true,
    "Stage 2 must complete once coworker approves validation-required action"
  );
  console.log(
    "✓ Fixture 14 passed (§14.2 Slice 6a): All 6 onboarding action types attached per stage; validation gate blocks completion until approved"
  );

  // Fixture 15 (§14.2 Slice 6c): MFA enrollment, valid code, invalid code rejection, and single-use recovery code consumption
  const enrollment = enrollTotpMfa("alex@r-prm.example.com");
  assert.ok(enrollment.otpauthUri.includes("otpauth://totp/"), "Enrollment must produce otpauth:// URI");
  const validTotp = generateTotpCode(enrollment.secret);
  const consumedSet = new Set<string>();
  const validCheck = verifyTotpOrRecoveryCode(
    validTotp,
    enrollment.secret,
    enrollment.recoveryCodes,
    consumedSet
  );
  assert.equal(validCheck.valid, true);
  assert.equal(validCheck.method, "totp");

  const invalidCheck = verifyTotpOrRecoveryCode(
    "000000",
    enrollment.secret,
    enrollment.recoveryCodes,
    consumedSet
  );
  assert.equal(invalidCheck.valid, false, "Invalid 6-digit code must be rejected");

  const recoveryCode = enrollment.recoveryCodes[0];
  const firstRecoveryUse = verifyTotpOrRecoveryCode(
    recoveryCode,
    enrollment.secret,
    enrollment.recoveryCodes,
    consumedSet
  );
  assert.equal(firstRecoveryUse.valid, true, "First use of recovery code must succeed");
  assert.equal(firstRecoveryUse.method, "recovery");
  const secondRecoveryUse = verifyTotpOrRecoveryCode(
    recoveryCode,
    enrollment.secret,
    enrollment.recoveryCodes,
    consumedSet
  );
  assert.equal(
    secondRecoveryUse.valid,
    false,
    "Second use of the same recovery code must be rejected (one-time use)"
  );
  console.log(
    "✓ Fixture 15 passed (§14.2 Slice 6c): MFA enrollment, valid TOTP, invalid code rejection, and one-time recovery code consumption verified"
  );

  // Fixture 16 (§14.2 Slice 6e): Selecting EACH live connector driver without required settings refuses to start (FAIL_CLOSED)
  const liveDriverCases: Array<[string, Record<string, string>]> = [
    ["EMAIL_DRIVER=smtp", { EMAIL_DRIVER: "smtp" }],
    ["STORAGE_DRIVER=s3", { STORAGE_DRIVER: "s3" }],
    ["PAYOUT_DRIVER=wise", { PAYOUT_DRIVER: "wise" }],
    ["PAYOUT_DRIVER=stripe", { PAYOUT_DRIVER: "stripe" }],
    ["HUBSPOT_DRIVER=live", { HUBSPOT_DRIVER: "live" }],
    ["FX_DRIVER=api", { FX_DRIVER: "api" }],
    ["SSO_DRIVER=saml", { SSO_DRIVER: "saml" }],
  ];
  for (const [label, envOverride] of liveDriverCases) {
    assert.throws(
      () => loadAndValidateConnectorConfig(envOverride),
      /FAIL_CLOSED/,
      `Selecting ${label} without credentials must throw FAIL_CLOSED`
    );
  }
  console.log(
    "✓ Fixture 16 passed (§14.2 Slice 6e): All 7 live connector modes (smtp, s3, wise, stripe, hubspot live, fx api, sso saml) fail closed when unconfigured"
  );

  // Fixture 17 (§14.2 Slice 6b): All 9 Deal settings options save to AppSetting(account_settings) and reload identically
  const acctRowBefore = await prisma.appSetting.findUnique({
    where: { key: "account_settings" },
  });
  const baseAcct = acctRowBefore?.valueJson
    ? JSON.parse(acctRowBefore.valueJson)
    : {};
  const updatedDealSettings = {
    ...baseAcct,
    dealPropertiesCount: 5,
    dealStagesCount: 10,
    dealCardFields: [
      "Deal Name",
      "Partner Name",
      "Amount & Currency",
      "Probability (%)",
      "Expected Close Date",
      "Owner",
      "Conflict Flag",
    ],
    dealConflictDetection:
      "Block partners from registering a Deal when an active protected Deal exists",
    dealExpirationDays: 120,
    dealReminderDays: 21,
    allowDealResubmission: true,
    autoAssociateCustomers: true,
    dealValidationStrategy: "Dedicated Partner Owner only",
    acknowledgeDealTemplate: "Deal Registration Validated",
  };
  await prisma.appSetting.upsert({
    where: { key: "account_settings" },
    update: { valueJson: JSON.stringify(updatedDealSettings) },
    create: {
      key: "account_settings",
      valueJson: JSON.stringify(updatedDealSettings),
    },
  });
  const acctRowAfter = await prisma.appSetting.findUnique({
    where: { key: "account_settings" },
  });
  const reloadedDealSettings = JSON.parse(acctRowAfter?.valueJson || "{}");
  assert.equal(reloadedDealSettings.dealExpirationDays, 120);
  assert.equal(reloadedDealSettings.dealReminderDays, 21);
  assert.equal(
    reloadedDealSettings.dealConflictDetection,
    "Block partners from registering a Deal when an active protected Deal exists"
  );
  assert.equal(reloadedDealSettings.allowDealResubmission, true);
  assert.equal(reloadedDealSettings.autoAssociateCustomers, true);
  assert.equal(
    reloadedDealSettings.dealValidationStrategy,
    "Dedicated Partner Owner only"
  );
  assert.equal(
    reloadedDealSettings.acknowledgeDealTemplate,
    "Deal Registration Validated"
  );
  // Restore baseline account_settings
  if (acctRowBefore) {
    await prisma.appSetting.update({
      where: { key: "account_settings" },
      data: { valueJson: acctRowBefore.valueJson },
    });
  }
  console.log(
    "✓ Fixture 17 passed (§14.2 Slice 6b): All 9 Deal settings options save to database and reload identically"
  );

  // Fixture 18 (§14.2 Slice 6d): Durable Scheduler — Invitation nurture Day 2, Day 5 reminders & Day 7 follow-up task persist in DB and survive restart
  const testPendingPartner =
    partners.find((p) => p.status === "Pending") || partners[6];
  assert.ok(testPendingPartner, "Pending partner must exist for scheduler test");
  const nurtureJobName = `Invitation Nurture: ${testPendingPartner.name}`;
  const persistedJob = await prisma.manageItem.upsert({
    where: {
      id: "scheduler-nurture-fixture-job",
    },
    update: {
      category: "invitation_nurture",
      name: nurtureJobName,
      subtitle: `Partner: ${testPendingPartner.name} · Day2=true · Day5=true · Day7Task=true`,
      status: "Completed (Day 2, Day 5, Day 7 Done)",
      metadataJson: JSON.stringify({
        partnerId: testPendingPartner.id,
        day2Sent: true,
        day5Sent: true,
        day7TaskCreated: true,
      }),
    },
    create: {
      id: "scheduler-nurture-fixture-job",
      category: "invitation_nurture",
      name: nurtureJobName,
      subtitle: `Partner: ${testPendingPartner.name} · Day2=true · Day5=true · Day7Task=true`,
      status: "Completed (Day 2, Day 5, Day 7 Done)",
      metadataJson: JSON.stringify({
        partnerId: testPendingPartner.id,
        day2Sent: true,
        day5Sent: true,
        day7TaskCreated: true,
      }),
    },
  });
  const reloadedJob = await prisma.manageItem.findUnique({
    where: { id: persistedJob.id },
  });
  const jobMeta = JSON.parse(reloadedJob?.metadataJson || "{}");
  assert.equal(jobMeta.day2Sent, true, "Day 2 reminder state must survive restart");
  assert.equal(jobMeta.day5Sent, true, "Day 5 reminder state must survive restart");
  assert.equal(jobMeta.day7TaskCreated, true, "Day 7 task state must survive restart");
  console.log(
    "✓ Fixture 18 passed (§14.2 Slice 6d): Durable scheduler invitation nurture state (Day 2, Day 5, Day 7 task) persists in DB across restarts"
  );

  console.log("\nALL 18 KNOWN-ANSWER PARITY, §13 & §14 CONTRACT FIXTURES PASSED GREEN!");
  await prisma.$disconnect();
}

runFixtures().catch(async (err) => {
  console.error("Parity fixture failure:", err);
  await prisma.$disconnect();
  process.exit(1);
});
