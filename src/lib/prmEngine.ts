// Pure, deterministic R-PRM domain engine for:
// - Computed Dashboard & Partner KPIs (Fixes D4, D5)
// - Structured Commission & Reward Rule Evaluation, Lifecycle & Clawback (Fixes D1-D3, §4.1)
// - Multi-currency conversion with dated FX rates (§4.1.5)
// - Server-side Asset & Content Scoping (Fixes D6, §4.3)
// - Computed Account Mapping Overlaps (Fixes D11, §5.3)

export interface DatedFxTable {
  rateDate: string;
  source: string;
  ratesToSgd: Record<string, number>;
}

export const DEFAULT_FX_TABLE: DatedFxTable = {
  rateDate: "2026-11-24",
  source: "MAS Daily Reference FX",
  ratesToSgd: {
    SGD: 1.0,
    USD: 1.35,
    EUR: 1.45,
    MYR: 0.3,
  },
};

export function convertWithDatedFx(
  amount: number,
  currency = "SGD",
  fxTable: DatedFxTable = DEFAULT_FX_TABLE
) {
  if (!fxTable.rateDate) {
    throw new Error("FX conversion refused: missing FX rateDate (§4.1.5)");
  }
  const code = (currency || "SGD").toUpperCase();
  const fxRate = fxTable.ratesToSgd[code];
  if (typeof fxRate !== "number") {
    throw new Error(`FX conversion refused: unsupported currency ${code}`);
  }
  const amountSgd = Math.round(amount * fxRate * 100) / 100;
  return {
    originalAmount: amount,
    currency: code,
    amountSgd,
    fxRate,
    fxRateDate: fxTable.rateDate,
    fxSource: fxTable.source,
  };
}

export interface StructuredCondition {
  field:
    | "amount"
    | "dealType"
    | "subscriptionPlan"
    | "billingMonth"
    | "agreedBeforeAcceptance";
  operator: ">=" | "==" | "<=" | "between";
  value: string | number | boolean;
  valueTo?: number;
}

export interface RateStep {
  fromMonth: number;
  toMonth: number;
  ratePct: number;
}

export interface StructuredRewardRule {
  id: string;
  title: string;
  trigger:
    | "transaction_paid"
    | "deal_closed_won"
    | "lead_accepted"
    | "lead_converted";
  conditions?: StructuredCondition[];
  valueType: "Cash" | "Coupon" | "Gift card" | "Credit";
  amountMode: "percentage" | "fixed" | "one_month_subscription";
  rateOrAmount: number;
  currency?: string;
  duration: "one_off" | "recurring";
  startOffsetMonths?: number;
  durationMonths?: number;
  rateSteps?: RateStep[];
  requiresValidation: boolean;
  clawbackOnRefund: boolean;
}

// Upgrade legacy free-text reward JSON objects into StructuredRewardRule objects automatically
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeRewardRule(raw: any): StructuredRewardRule {
  if (raw && raw.amountMode && raw.valueType) {
    return raw as StructuredRewardRule;
  }
  const rateStr = String(raw?.rate || "10%");
  const isPct = rateStr.includes("%");
  const numericVal = parseFloat(rateStr.replace(/[^0-9.]/g, "")) || 10;
  const triggerText = String(raw?.trigger || "").toLowerCase();
  const trigger: StructuredRewardRule["trigger"] = triggerText.includes(
    "closed won"
  )
    ? "deal_closed_won"
    : triggerText.includes("lead")
    ? "lead_accepted"
    : "transaction_paid";

  return {
    id: raw?.id || `rule-${Date.now()}`,
    title: raw?.title || "Standard Commission Rule",
    trigger,
    conditions: [],
    valueType: "Cash",
    amountMode: isPct ? "percentage" : "fixed",
    rateOrAmount: numericVal,
    currency: "SGD",
    duration: isPct ? "recurring" : "one_off",
    startOffsetMonths: 1,
    durationMonths: isPct ? 12 : 1,
    rateSteps: [],
    requiresValidation: true,
    clawbackOnRefund: true,
  };
}

export interface MerchantInvoiceEvent {
  invoiceId: string;
  merchantName: string;
  partnerName: string;
  billingMonth: number; // 1 = month 1, 4 = month 4, etc.
  invoiceAmount: number;
  monthlySubscriptionFee?: number;
  currency: string;
  paidDate: string;
  isStillPartnerClient?: boolean;
  isRefunded?: boolean;
  // For Referral Entry per-deal written override (§4.1.4)
  agreedOverrideRatePct?: number;
  agreedBeforeAcceptanceTimestamp?: string;
  orderAcceptedTimestamp?: string;
}

export interface GeneratedRewardResult {
  idempotencyKey: string;
  ruleId: string;
  ruleTitle: string;
  partnerName: string;
  fromActivity: string;
  valueType: "Cash" | "Coupon" | "Gift card" | "Credit";
  amount: number;
  currency: string;
  amountSgd: number;
  fxRate: number;
  fxRateDate: string;
  status: "Pending" | "Validated";
  billingMonth: number;
}

// Preset rules for Eber's 3 real commission programs (§4.1.4)
export const EBER_COMMISSION_FIXTURE_RULES: Record<
  "biz_partner_one_off" | "biz_partner_premium_recurring" | "referral_entry",
  StructuredRewardRule
> = {
  biz_partner_one_off: {
    id: "rule-eber-biz-oneoff",
    title: "Biz Partner — 1 Month Subscription at Month-4 Paid Invoice",
    trigger: "transaction_paid",
    valueType: "Cash",
    amountMode: "one_month_subscription",
    rateOrAmount: 100, // 100% of 1 month subscription
    currency: "SGD",
    duration: "one_off",
    startOffsetMonths: 4,
    durationMonths: 1,
    requiresValidation: true,
    clawbackOnRefund: true,
  },
  biz_partner_premium_recurring: {
    id: "rule-eber-biz-premium",
    title: "Biz Partner Premium — 20% Months 4–15, 10% Months 16–27",
    trigger: "transaction_paid",
    valueType: "Cash",
    amountMode: "percentage",
    rateOrAmount: 20,
    currency: "SGD",
    duration: "recurring",
    startOffsetMonths: 4,
    durationMonths: 24, // months 4..27 inclusive
    rateSteps: [
      { fromMonth: 4, toMonth: 15, ratePct: 20 },
      { fromMonth: 16, toMonth: 27, ratePct: 10 },
    ],
    requiresValidation: true,
    clawbackOnRefund: true,
  },
  referral_entry: {
    id: "rule-eber-referral-entry",
    title: "Referral Entry — Per-Deal Written Override Before Order Acceptance",
    trigger: "transaction_paid",
    conditions: [
      { field: "agreedBeforeAcceptance", operator: "==", value: true },
    ],
    valueType: "Cash",
    amountMode: "percentage",
    rateOrAmount: 0, // uses event.agreedOverrideRatePct when valid
    currency: "SGD",
    duration: "one_off",
    startOffsetMonths: 1,
    durationMonths: 1,
    requiresValidation: true,
    clawbackOnRefund: true,
  },
};

export function evaluateRuleForInvoice(
  rule: StructuredRewardRule,
  event: MerchantInvoiceEvent,
  existingIdempotencyKeys: Set<string> = new Set(),
  fxTable: DatedFxTable = DEFAULT_FX_TABLE
): GeneratedRewardResult | null {
  const idempotencyKey = `${event.invoiceId}::${rule.id}::M${event.billingMonth}`;
  if (existingIdempotencyKeys.has(idempotencyKey)) {
    return null; // Idempotent: never double-pay (§4.1.2)
  }

  // Stop if merchant is no longer the partner's client
  if (event.isStillPartnerClient === false) {
    return null;
  }

  const startMonth = rule.startOffsetMonths ?? 1;
  if (event.billingMonth < startMonth) {
    return null;
  }

  if (rule.duration === "one_off" && event.billingMonth !== startMonth) {
    return null;
  }

  if (rule.duration === "recurring" && rule.durationMonths) {
    const endMonth = startMonth + rule.durationMonths - 1;
    if (event.billingMonth > endMonth) {
      return null;
    }
  }

  // Check conditions (e.g., Referral entry written agreement before order acceptance)
  if (rule.conditions && rule.conditions.length > 0) {
    for (const cond of rule.conditions) {
      if (cond.field === "agreedBeforeAcceptance") {
        const hasRate =
          typeof event.agreedOverrideRatePct === "number" &&
          event.agreedOverrideRatePct > 0;
        const hasTimestamps =
          Boolean(event.agreedBeforeAcceptanceTimestamp) &&
          Boolean(event.orderAcceptedTimestamp) &&
          String(event.agreedBeforeAcceptanceTimestamp) <=
            String(event.orderAcceptedTimestamp);
        if (!hasRate || !hasTimestamps) {
          return null;
        }
      }
      if (cond.field === "amount" && cond.operator === ">=") {
        if (event.invoiceAmount < Number(cond.value)) return null;
      }
    }
  }

  let rewardAmount = 0;
  if (rule.amountMode === "one_month_subscription") {
    rewardAmount = event.monthlySubscriptionFee ?? event.invoiceAmount;
  } else if (rule.amountMode === "fixed") {
    rewardAmount = rule.rateOrAmount;
  } else if (rule.amountMode === "percentage") {
    let pct = rule.rateOrAmount;
    if (rule.rateSteps && rule.rateSteps.length > 0) {
      const step = rule.rateSteps.find(
        (s) =>
          event.billingMonth >= s.fromMonth && event.billingMonth <= s.toMonth
      );
      if (!step) return null;
      pct = step.ratePct;
    } else if (
      typeof event.agreedOverrideRatePct === "number" &&
      rule.rateOrAmount === 0
    ) {
      pct = event.agreedOverrideRatePct;
    }
    rewardAmount = Math.round(event.invoiceAmount * (pct / 100) * 100) / 100;
  }

  if (rewardAmount <= 0) return null;

  const fx = convertWithDatedFx(rewardAmount, event.currency, fxTable);

  return {
    idempotencyKey,
    ruleId: rule.id,
    ruleTitle: rule.title,
    partnerName: event.partnerName,
    fromActivity: `${event.invoiceId} · ${event.merchantName} (Month ${event.billingMonth})`,
    valueType: rule.valueType,
    amount: rewardAmount,
    currency: fx.currency,
    amountSgd: fx.amountSgd,
    fxRate: fx.fxRate,
    fxRateDate: fx.fxRateDate,
    status: rule.requiresValidation ? "Pending" : "Validated",
    billingMonth: event.billingMonth,
  };
}

// Compute Partner KPIs dynamically from leads, deals, rewards (Fixes D4 & D5)
export function computePartnerKpis(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  partner: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  leads: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deals: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rewards: any[]
) {
  const pLeads = leads.filter(
    (l) =>
      l.sourcePartnerName === partner.name || l.sourcePartnerId === partner.id
  );
  const pDeals = deals.filter(
    (d) => d.partnerName === partner.name || d.partnerId === partner.id
  );
  const wonDeals = pDeals.filter((d) => d.stage === "Closed Won");
  const openDeals = pDeals.filter(
    (d) => d.stage !== "Closed Won" && d.stage !== "Closed Lost"
  );
  const pRewards = rewards.filter((r) => r.partnerName === partner.name);
  const pendingRewards = pRewards.filter((r) => r.status === "Pending");

  const sourcedRevenue365d = wonDeals.reduce(
    (sum, d) => sum + Number(d.amountSgd || 0),
    0
  );
  const influencedRev365d = openDeals.reduce(
    (sum, d) => sum + Number(d.amountSgd || 0),
    0
  );
  const pendingRewardsAll = pendingRewards.reduce(
    (sum, r) => sum + Number(r.amountSgd || 0),
    0
  );
  const winRatePct =
    pDeals.length > 0 ? Math.round((wonDeals.length / pDeals.length) * 100) : 0;

  return {
    ...partner,
    submittedLeads365d: pLeads.length,
    registeredDeals365d: pDeals.length,
    wonDealsCount: wonDeals.length,
    wonDealsAmountSgd: sourcedRevenue365d,
    winRatePct,
    sourcedRevenue365d,
    influencedRev365d,
    pendingRewardsAll,
    _computedAt: new Date().toISOString(),
  };
}

// Server-side Asset & Content Scoping (Fixes D6, §4.3)
// Combination logic for "some_partners": OR across program/level, group, and partnerId
export function canPartnerAccessAsset(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assetItem: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  partner: any
): boolean {
  if (!assetItem || !partner) return false;
  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(assetItem.metadataJson || "{}");
  } catch {
    meta = {};
  }

  const accessScope = String(meta.accessScope || "");
  if (accessScope === "my_team") {
    return false; // Internal coworkers only
  }
  if (accessScope === "everyone") {
    return true;
  }

  if (accessScope === "some_partners") {
    const allowedPrograms = Array.isArray(meta.allowedPrograms)
      ? (meta.allowedPrograms as string[])
      : [];
    const allowedLevels = Array.isArray(meta.allowedLevels)
      ? (meta.allowedLevels as string[])
      : [];
    const allowedGroups = Array.isArray(meta.allowedGroups)
      ? (meta.allowedGroups as string[])
      : [];
    const allowedPartnerIds = Array.isArray(meta.allowedPartnerIds)
      ? (meta.allowedPartnerIds as string[])
      : [];

    const matchProgram =
      allowedPrograms.includes(partner.programName) ||
      allowedPrograms.includes(partner.programId);
    const matchLevel = allowedLevels.includes(partner.qualifyingLevel);
    const matchGroup = allowedGroups.includes(partner.groupName);
    const matchPartner =
      allowedPartnerIds.includes(partner.id) ||
      allowedPartnerIds.includes(partner.name);

    return matchProgram || matchLevel || matchGroup || matchPartner;
  }

  // Fallback check on subtitle / programVisibility string (e.g. "ISV & Tech Partners" vs "Strategic Partners")
  const vis = String(
    meta.programVisibility || assetItem.subtitle || "All Programs"
  ).toLowerCase();

  if (vis.includes("all programs") || vis.includes("everyone")) {
    return true;
  }
  const pProg = String(partner.programName || "").toLowerCase();
  const pGroup = String(partner.groupName || "").toLowerCase();

  if (vis.includes("isv") && !pProg.includes("isv") && !pGroup.includes("isv")) {
    return false;
  }
  if (
    vis.includes("strategic") &&
    !pProg.includes("strategic") &&
    !pGroup.includes("cloud")
  ) {
    return false;
  }
  if (
    vis.includes("referral") &&
    !pProg.includes("referral") &&
    !pGroup.includes("growth")
  ) {
    return false;
  }

  return true;
}

// Compute Account Mapping Overlaps by matching normalized company key/domain (Fixes D11, §5.3)
export function normalizeAccountKey(name: string): string {
  return (name || "")
    .toLowerCase()
    .replace(
      /\b(pte|ltd|inc|corp|group|holdings|apac|my|sg|global|supermarkets|resorts|hotels|spas|retail)\b/g,
      ""
    )
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function computeAccountOverlaps(accounts: any[]) {
  return accounts.map((acc) => {
    const yourKey = normalizeAccountKey(acc.accountName);
    const partnerKey = normalizeAccountKey(
      acc.partnerAccountName || acc.accountName
    );
    const computedOverlap =
      Boolean(yourKey && partnerKey) &&
      (yourKey === partnerKey ||
        yourKey.includes(partnerKey) ||
        partnerKey.includes(yourKey));
    return {
      ...acc,
      hasOverlap: computedOverlap,
      matchConfidence: computedOverlap ? "Exact Normalized Match" : "No Overlap",
    };
  });
}
