"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import { StatusBadge } from "@/components/SharedEngines";
import {
  canPartnerAccessAsset,
  getPartnerLevelRules,
  getPartnerLeadFormToken,
} from "@/lib/prmEngine";
import {
  Award,
  Download,
  Paperclip,
  Briefcase,
  Users,
  Gift,
  ExternalLink,
  ShieldAlert,
  LogOut,
  CheckCircle2,
} from "lucide-react";

const PORTAL_NAV = [
  "Home",
  "Leads",
  "Deals",
  "Rewards",
  "Payouts",
  "Onboarding",
  "Assets",
  "Help Center",
  "News",
  "Team",
  "Profile & Bank",
] as const;

function StandalonePartnerPortalContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    partners,
    programs,
    deals,
    leads,
    rewards,
    payouts,
    manageItems,
    teamMembers,
    session,
    mutate,
  } = usePrm();

  const [activeNav, setActiveNav] =
    useState<(typeof PORTAL_NAV)[number]>("Home");

  // Determine partner strictly from server session (or impersonated partner)
  const targetPartnerId =
    session?.identityType === "partner"
      ? session.partnerId
      : session?.impersonatingPartnerId ||
        searchParams.get("partnerId") ||
        "prt-1";

  const partner =
    partners.find((p) => p.id === targetPartnerId) || partners[0];
  const program =
    programs.find(
      (pr) => pr.id === partner?.programId || pr.name === partner?.programName
    ) || programs[0];

  const role: "Manager" | "SalesRep" | "Stakeholder" =
    session?.identityType === "partner"
      ? session.role === "Sales Rep"
        ? "SalesRep"
        : (session.role as "Manager" | "SalesRep" | "Stakeholder") || "Manager"
      : "Manager";

  const isImpersonating =
    session?.identityType === "coworker" ||
    searchParams.get("impersonate") === "true";

  // Form states
  const [dealName, setDealName] = useState("");
  const [dealCompany, setDealCompany] = useState("");
  const [dealAmount, setDealAmount] = useState("22000");

  const [leadFirst, setLeadFirst] = useState("");
  const [leadLast, setLeadLast] = useState("");
  const [leadCompany, setLeadCompany] = useState("");
  const [leadEmail, setLeadEmail] = useState("");

  const [selfInvoicingOptIn, setSelfInvoicingOptIn] = useState(true);
  const [bankName, setBankName] = useState("DBS Corporate Bank Singapore");
  const [swiftCode, setSwiftCode] = useState("DBSSSGSG");
  const [accountNumber, setAccountNumber] = useState("003-948271-8");

  if (!partner) {
    return (
      <div className="p-8 text-xs text-slate-500">Loading Partner Portal...</div>
    );
  }

  // §13.1 Fix: Read the partner's ACTUAL level rules from their Program!
  // (e.g. Apex on Platinum Elite displays "25% Recurring Deal Commission + 5% Annual Milestone Kickback", never hardcoded 18%!)
  const levelRules = getPartnerLevelRules(partner, programs);
  const levelRulesSummary =
    levelRules.length > 0
      ? levelRules.map((r) => r.title).join(" + ")
      : "Standard Tier Commission";

  const personalLeadFormUrl = `/forms/lead/${
    partner.leadFormToken || getPartnerLeadFormToken(partner.id)
  }`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let perms: Record<string, Record<string, any>> = {};
  try {
    perms = JSON.parse(program?.permissionsJson || "{}");
  } catch {
    perms = {};
  }

  const canViewLeads = perms?.Leads?.["Can view leads"]?.[role] ?? true;
  const canSubmitLeads = perms?.Leads?.["Can submit leads"]?.[role] ?? true;
  const canViewDeals = perms?.Deals?.["Can view deals"]?.[role] ?? true;
  const canRegisterDeals = perms?.Deals?.["Can register deals"]?.[role] ?? true;

  const myDeals = deals.filter((d) => d.partnerName === partner.name);
  const myLeads = leads.filter((l) => l.sourcePartnerName === partner.name);
  const myRewards = rewards.filter((r) => r.partnerName === partner.name);
  const myPayouts = payouts.filter((p) => p.partnerName === partner.name);
  const myTeam = teamMembers.filter((m) => m.partnerName === partner.name);

  const scopedAssets = manageItems.filter(
    (m) => m.category === "assets" && canPartnerAccessAsset(m, partner)
  );
  const helpArticles = manageItems.filter(
    (m) => m.category === "help_articles"
  );
  const newsItems = manageItems.filter((m) => m.category === "news");

  const handlePortalRegisterDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canRegisterDeals) return;
    await mutate(
      "CREATE_DEAL",
      {
        name: dealName,
        company: dealCompany,
        clientName: `${dealCompany} Buyer`,
        amount: Number(dealAmount) || 15000,
        currency: partner.currency || "SGD",
        partnerName: partner.name,
        assignedContact: `${partner.contactFirstName} ${partner.contactLastName}`,
        stage: "Discovery Stage",
      },
      `Deal "${dealName}" registered from ${partner.name} Partner Portal!`
    );
    setDealName("");
    setDealCompany("");
  };

  const handlePortalSubmitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitLeads) return;
    await mutate(
      "CREATE_LEAD",
      {
        firstName: leadFirst,
        lastName: leadLast || "Contact",
        company: leadCompany,
        email: leadEmail || "prospect@client.example.com",
        sourcePartnerName: partner.name,
        assignedPartner: partner.name,
        assignedContact: `${partner.contactFirstName} ${partner.contactLastName}`,
        source: "Partner Portal",
      },
      `Lead "${leadFirst} ${leadLast}" submitted from Partner Portal!`
    );
    setLeadFirst("");
    setLeadLast("");
    setLeadCompany("");
    setLeadEmail("");
  };

  const handleExitImpersonation = async () => {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "exit_impersonate" }),
    });
    router.push(`/partners/${partner.id}`);
  };

  const handleLogout = async () => {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    window.location.href = "/p/login";
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {isImpersonating && (
        <div className="bg-amber-500 text-slate-950 px-6 py-2 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4" />
            <span>
              Viewing as <strong>{partner.name}</strong> ({partner.contactEmail}
              ) — Impersonation session recorded in Audit Log
            </span>
          </div>
          <button
            onClick={handleExitImpersonation}
            className="px-3 py-1 rounded bg-slate-900 text-white font-semibold"
          >
            Exit Impersonation →
          </button>
        </div>
      )}

      {/* Standalone Partner Portal Header */}
      <header className="bg-white border-b border-slate-200 px-6 h-14 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-extrabold text-lg flex items-center justify-center">
            R
          </div>
          <div>
            <span className="font-bold text-sm text-slate-900">
              {partner.name}
            </span>
            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {partner.qualifyingLevel}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-1 overflow-x-auto">
          {PORTAL_NAV.filter((nav) => {
            if (nav === "Leads" && !canViewLeads) return false;
            if (nav === "Deals" && !canViewDeals) return false;
            return true;
          }).map((nav) => (
            <button
              key={nav}
              onClick={() => setActiveNav(nav)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                activeNav === nav
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {nav}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold">
            Role: {role}
          </span>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded text-slate-500 hover:bg-slate-100"
            title="Sign out of Partner Portal"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="max-w-[1380px] w-full mx-auto px-6 py-6 space-y-6 text-xs">
        {activeNav === "Home" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-blue-200 p-4 shadow-sm">
                <div className="flex items-center justify-between text-blue-700 font-bold">
                  <span>Qualifying Tier</span>
                  <Award className="w-4 h-4" />
                </div>
                <p className="text-xl font-extrabold text-slate-900 mt-1">
                  {partner.qualifyingLevel}
                </p>
                <p className="text-blue-700 font-semibold mt-0.5">
                  {levelRulesSummary}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center justify-between text-slate-600 font-bold">
                  <span>My Registered Deals</span>
                  <Briefcase className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-xl font-extrabold text-slate-900 mt-1">
                  {myDeals.length} Deals
                </p>
                <p className="text-slate-500 mt-0.5">
                  Won Sourced: SGD {partner.sourcedRevenue365d.toLocaleString()}
                </p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center justify-between text-slate-600 font-bold">
                  <span>My Submitted Leads</span>
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-xl font-extrabold text-slate-900 mt-1">
                  {myLeads.length} Leads
                </p>
                <Link
                  href={personalLeadFormUrl}
                  className="text-blue-600 hover:underline font-semibold inline-flex items-center space-x-1 mt-0.5"
                >
                  <span>Use your personal lead form</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
              <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-sm">
                <div className="flex items-center justify-between text-emerald-700 font-bold">
                  <span>My Commissions</span>
                  <Gift className="w-4 h-4" />
                </div>
                <p className="text-xl font-extrabold text-emerald-700 mt-1">
                  SGD {partner.pendingRewardsAll.toLocaleString()}
                </p>
                <p className="text-slate-500 mt-0.5">
                  {myRewards.length} total reward records
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {canViewDeals && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-sm text-slate-900">
                      Quick Deal Registration
                    </h2>
                    {!canRegisterDeals && (
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold text-[10px]">
                        View-only for {role} role
                      </span>
                    )}
                  </div>
                  {canRegisterDeals && (
                    <form
                      onSubmit={handlePortalRegisterDeal}
                      className="grid grid-cols-1 md:grid-cols-3 gap-2 p-3 rounded-xl bg-blue-50/50 border border-blue-100"
                    >
                      <input
                        required
                        value={dealName}
                        onChange={(e) => setDealName(e.target.value)}
                        placeholder="Deal title *"
                        className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                      />
                      <input
                        required
                        value={dealCompany}
                        onChange={(e) => setDealCompany(e.target.value)}
                        placeholder="Client company *"
                        className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                      />
                      <div className="flex space-x-1.5">
                        <input
                          type="number"
                          value={dealAmount}
                          onChange={(e) => setDealAmount(e.target.value)}
                          className="w-20 px-2 py-1.5 border border-slate-300 rounded-lg bg-white"
                        />
                        <button
                          type="submit"
                          className="flex-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
                        >
                          Register
                        </button>
                      </div>
                    </form>
                  )}
                  <div className="divide-y divide-slate-100">
                    {myDeals.map((d) => (
                      <div
                        key={d.id}
                        className="py-2.5 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-bold text-slate-900">{d.name}</p>
                          <p className="text-slate-500">
                            {d.company} · Stage: {d.stage}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-blue-700">
                            {d.currency} {d.amount.toLocaleString()}
                          </span>
                          <StatusBadge status={d.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {canViewLeads && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-sm text-slate-900">
                      Submit a Referral Lead
                    </h2>
                    <Link
                      href={personalLeadFormUrl}
                      className="text-blue-600 hover:underline font-semibold flex items-center space-x-1"
                    >
                      <span>Use your personal lead form</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                  {canSubmitLeads ? (
                    <form
                      onSubmit={handlePortalSubmitLead}
                      className="grid grid-cols-1 md:grid-cols-4 gap-2 p-3 rounded-xl bg-blue-50/50 border border-blue-100"
                    >
                      <input
                        required
                        value={leadFirst}
                        onChange={(e) => setLeadFirst(e.target.value)}
                        placeholder="First name *"
                        className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                      />
                      <input
                        value={leadLast}
                        onChange={(e) => setLeadLast(e.target.value)}
                        placeholder="Last name"
                        className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                      />
                      <input
                        required
                        value={leadCompany}
                        onChange={(e) => setLeadCompany(e.target.value)}
                        placeholder="Company *"
                        className="px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
                      >
                        + Submit
                      </button>
                    </form>
                  ) : (
                    <p className="text-amber-800 bg-amber-50 p-2.5 rounded-lg">
                      Lead submission is disabled for the {role} role.
                    </p>
                  )}
                  <div className="divide-y divide-slate-100">
                    {myLeads.map((l) => (
                      <div
                        key={l.id}
                        className="py-2.5 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-bold text-slate-900">
                            {l.firstName} {l.lastName} · {l.company}
                          </p>
                          <p className="text-slate-500">
                            Submitted {l.assignedDate} · Deadline {l.deadline}
                          </p>
                        </div>
                        <StatusBadge status={l.status} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {activeNav === "Leads" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-base text-slate-900">
                My Leads ({myLeads.length})
              </h2>
              <Link
                href={personalLeadFormUrl}
                className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-semibold"
              >
                Use your personal lead form ↗
              </Link>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                  <th className="py-2.5 px-3">Contact Name</th>
                  <th className="py-2.5 px-3">Company</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Assigned Contact</th>
                  <th className="py-2.5 px-3">Deadline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {myLeads.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {l.firstName} {l.lastName}
                    </td>
                    <td className="py-2.5 px-3">{l.company}</td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={l.status} />
                    </td>
                    <td className="py-2.5 px-3">{l.assignedContact}</td>
                    <td className="py-2.5 px-3">{l.deadline}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeNav === "Deals" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-base text-slate-900">
              My Registered Deals ({myDeals.length})
            </h2>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                  <th className="py-2.5 px-3">Deal Name</th>
                  <th className="py-2.5 px-3">Company</th>
                  <th className="py-2.5 px-3">Stage</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3">Protection Expiry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {myDeals.map((d) => (
                  <tr key={d.id}>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {d.name}
                    </td>
                    <td className="py-2.5 px-3">{d.company}</td>
                    <td className="py-2.5 px-3 font-semibold text-blue-700">
                      {d.stage}
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      {d.currency} {d.amount.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">{d.expirationDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeNav === "Rewards" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-base text-slate-900">
              My Commission Rewards ({myRewards.length})
            </h2>
            <div className="divide-y divide-slate-100">
              {myRewards.map((r) => (
                <div
                  key={r.id}
                  className="py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="font-bold text-slate-900">
                      {r.rewardNumber} · {r.fromActivity}
                    </p>
                    <p className="text-slate-500">{r.fromRewardRule}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-blue-700">
                      {r.currency} {r.amount.toLocaleString()} (SGD{" "}
                      {r.amountSgd.toLocaleString()})
                    </span>
                    <StatusBadge status={r.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeNav === "Payouts" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-base text-slate-900">
              My Payout Settlements ({myPayouts.length})
            </h2>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                  <th className="py-2.5 px-3">Payout #</th>
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Period</th>
                  <th className="py-2.5 px-3 text-right">Rewards</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Paid Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {myPayouts.map((po) => (
                  <tr key={po.id}>
                    <td className="py-2.5 px-3 font-bold text-blue-700">
                      {po.payoutNumber}
                    </td>
                    <td className="py-2.5 px-3 font-semibold">{po.name}</td>
                    <td className="py-2.5 px-3">
                      {po.periodFrom} → {po.periodTo}
                    </td>
                    <td className="py-2.5 px-3 text-right">{po.rewardsCount}</td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      SGD {po.amountSgd.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={po.status} />
                    </td>
                    <td className="py-2.5 px-3">{po.paidDate || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeNav === "Onboarding" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-base text-slate-900">
                  My Onboarding Checklist — {partner.onboardingPipeline}
                </h2>
                <p className="text-slate-500">
                  Current Stage: <strong>{partner.onboardingStage}</strong> (
                  {partner.onboardingStatus})
                </p>
              </div>
              <StatusBadge status={partner.onboardingStatus} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                {
                  type: "View asset",
                  title: "1. Review 2026 Enterprise Partner Pitch Deck",
                  status: "Completed",
                },
                {
                  type: "Read article",
                  title: "2. Read Deal Registration Protection Guidelines",
                  status: "Completed",
                },
                {
                  type: "Upload document",
                  title: "3. Upload Signed Master Reseller Agreement",
                  status: "Completed",
                },
                {
                  type: "Provide information",
                  title: "4. Submit Regional Sales Headcount & Territory Form",
                  status: "Completed",
                },
                {
                  type: "Book meeting",
                  title: "5. Book Kickoff Call via Calendly",
                  status: "Completed",
                },
                {
                  type: "Opt-in/out from self-invoicing",
                  title: "6. Confirm Self-Invoicing Preference",
                  status: selfInvoicingOptIn ? "Opted In" : "Opted Out",
                },
              ].map((act) => (
                <div
                  key={act.title}
                  className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between"
                >
                  <div>
                    <span className="text-[10px] font-bold uppercase text-blue-700">
                      {act.type}
                    </span>
                    <p className="font-bold text-slate-900">{act.title}</p>
                  </div>
                  <span className="text-emerald-700 font-semibold flex items-center space-x-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{act.status}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeNav === "Assets" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div>
              <h2 className="font-bold text-base text-slate-900">
                Scoped Enablement Assets ({scopedAssets.length})
              </h2>
              <p className="text-slate-500">
                Showing only assets authorized for{" "}
                <strong>{partner.programName}</strong> ({partner.qualifyingLevel}
                ) and group <strong>{partner.groupName}</strong>.
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {scopedAssets.map((a) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const assetAny = a as any;
                let fileUrl =
                  assetAny.fileUrl ||
                  "/uploads/R-PRM_2026_Enterprise_Pitch_Deck.pdf";
                let fileName = assetAny.fileName || a.name;
                if (a.metadataJson) {
                  try {
                    const meta = JSON.parse(a.metadataJson);
                    if (meta.fileUrl) fileUrl = meta.fileUrl;
                    if (meta.fileName) fileName = meta.fileName;
                  } catch {
                    // fallback
                  }
                }
                return (
                  <div
                    key={a.id}
                    className="py-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{a.name}</p>
                      <p className="text-slate-500">{a.subtitle}</p>
                    </div>
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      download={fileName}
                      className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-semibold border border-blue-200 flex items-center space-x-1"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>Download</span>
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeNav === "Help Center" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h2 className="font-bold text-base text-slate-900">
              Partner Help Center Articles ({helpArticles.length})
            </h2>
            {helpArticles.map((art) => (
              <div
                key={art.id}
                className="p-3.5 rounded-xl border border-slate-200 space-y-1"
              >
                <p className="font-bold text-slate-900">{art.name}</p>
                <p className="text-slate-500">{art.subtitle}</p>
              </div>
            ))}
          </div>
        )}

        {activeNav === "News" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h2 className="font-bold text-base text-slate-900">
              Partner Announcements &amp; News ({newsItems.length})
            </h2>
            {newsItems.map((n) => (
              <div
                key={n.id}
                className="p-3.5 rounded-xl border border-slate-200 space-y-1"
              >
                <p className="font-bold text-slate-900">{n.name}</p>
                <p className="text-slate-500">{n.subtitle}</p>
              </div>
            ))}
          </div>
        )}

        {activeNav === "Team" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h2 className="font-bold text-base text-slate-900">
              My Organization Team Members ({myTeam.length})
            </h2>
            {myTeam.map((m) => (
              <div
                key={m.id}
                className="p-3 rounded-xl border border-slate-200 flex items-center justify-between"
              >
                <div>
                  <p className="font-bold text-slate-900">{m.name}</p>
                  <p className="text-slate-500">
                    {m.email} · {m.jobTitle} ({m.role})
                  </p>
                </div>
                <StatusBadge status={m.status} />
              </div>
            ))}
          </div>
        )}

        {activeNav === "Profile & Bank" && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-base text-slate-900">
              Banking &amp; Self-Invoicing Setup
            </h2>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selfInvoicingOptIn}
                onChange={(e) => setSelfInvoicingOptIn(e.target.checked)}
              />
              <span className="font-semibold text-slate-800">
                Opt-in to Automated Self-Invoicing for Commission Payouts
              </span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Bank Name
                </label>
                <input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  SWIFT / BIC Code
                </label>
                <input
                  value={swiftCode}
                  onChange={(e) => setSwiftCode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Bank Account Number
                </label>
                <input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <button
              onClick={() =>
                mutate(
                  "UPDATE_PARTNER",
                  {
                    id: partner.id,
                    data: {
                      bankDetailsJson: JSON.stringify({
                        bankName,
                        swiftCode,
                        accountNumber,
                        selfInvoicingOptIn,
                      }),
                    },
                  },
                  "Partner banking & self-invoicing details saved!"
                )
              }
              className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
            >
              Save Banking &amp; Self-Invoicing Details
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StandalonePartnerPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-xs text-slate-500">
          Loading Partner Portal...
        </div>
      }
    >
      <StandalonePartnerPortalContent />
    </Suspense>
  );
}
