"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import { BackBreadcrumb, StatusBadge } from "@/components/SharedEngines";
import {
  EBER_COMMISSION_FIXTURE_RULES,
  StructuredRewardRule,
  normalizeRewardRule,
} from "@/lib/prmEngine";
import {
  Plus,
  Gift,
  Award,
  CheckCircle2,
  Shield,
  Edit3,
  Trash2,
  Copy,
  ExternalLink,
  X,
  Check,
} from "lucide-react";

const PROGRAM_TABS = [
  "Members",
  "Applications",
  "Links",
  "Levels",
  "Settings",
] as const;

export default function ProgramDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || "prog-strategic");
  const {
    programs,
    partners,
    trackingLinks,
    manageItems,
    mutate,
    showToast,
    setGlobalModal,
  } = usePrm();

  const program = programs.find((p) => p.id === id) || programs[0];
  const [activeTab, setActiveTab] =
    useState<(typeof PROGRAM_TABS)[number]>("Levels");
  const [selectedLevelIdx, setSelectedLevelIdx] = useState(0);
  const [newLink, setNewLink] = useState({ name: "", targetUrl: "" });

  // Structured Reward Rule Builder Modal State (Fixes D1, D2, D3)
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [deleteConfirmRuleId, setDeleteConfirmRuleId] = useState<string | null>(
    null
  );
  const [ruleForm, setRuleForm] = useState<StructuredRewardRule>({
    id: "",
    title: "18% Recurring Deal Commission",
    trigger: "transaction_paid",
    valueType: "Cash",
    amountMode: "percentage",
    rateOrAmount: 18,
    currency: "SGD",
    duration: "recurring",
    startOffsetMonths: 1,
    durationMonths: 12,
    rateSteps: [],
    requiresValidation: true,
    clawbackOnRefund: true,
  });

  // Reject Application with Required Reason Modal (§4.6)
  const [rejectPartnerId, setRejectPartnerId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [reapplyAfterDate, setReapplyAfterDate] = useState("2027-03-01");

  if (!program) {
    return <div className="p-8 text-sm text-slate-500">Loading program...</div>;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let levels: any[] = [];
  try {
    levels = JSON.parse(program.levelsJson || "[]");
  } catch {
    levels = [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let permissions: Record<string, Record<string, any>> = {};
  try {
    permissions = JSON.parse(program.permissionsJson || "{}");
  } catch {
    permissions = {};
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let autoEmails: Record<string, any> = {};
  try {
    autoEmails = JSON.parse(program.autoEmailsJson || "{}");
  } catch {
    autoEmails = {};
  }

  const emailTemplates = manageItems.filter(
    (m) => m.category === "email_templates"
  );

  const currentLevel = levels[selectedLevelIdx] || levels[0];
  const members = partners.filter(
    (p) => p.programId === program.id || p.programName === program.name
  );
  const pendingApps = partners.filter((p) => p.status === "Pending");
  const progLinks = trackingLinks.filter((l) => l.programId === program.id);

  const openCreateRuleModal = () => {
    setEditingRuleId(null);
    setRuleForm({
      id: `rule-${Date.now()}`,
      title: "",
      trigger: "transaction_paid",
      valueType: "Cash",
      amountMode: "percentage",
      rateOrAmount: 15,
      currency: "SGD",
      duration: "recurring",
      startOffsetMonths: 1,
      durationMonths: 12,
      rateSteps: [],
      requiresValidation: true,
      clawbackOnRefund: true,
    });
    setRuleModalOpen(true);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openEditRuleModal = (rawRule: any) => {
    const norm = normalizeRewardRule(rawRule);
    setEditingRuleId(norm.id);
    setRuleForm(norm);
    setRuleModalOpen(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentLevel) return;
    const existingRewards: StructuredRewardRule[] = (
      currentLevel.rewards || []
    ).map(normalizeRewardRule);

    const updatedRewards = editingRuleId
      ? existingRewards.map((r) => (r.id === editingRuleId ? ruleForm : r))
      : [...existingRewards, { ...ruleForm, id: `rule-${Date.now()}` }];

    const nextLevels = levels.map((lvl, idx) =>
      idx === selectedLevelIdx ? { ...lvl, rewards: updatedRewards } : lvl
    );

    await mutate(
      "UPDATE_PROGRAM",
      { id: program.id, data: { levelsJson: JSON.stringify(nextLevels) } },
      editingRuleId
        ? `Updated commission rule "${ruleForm.title}"`
        : `Created structured commission rule "${ruleForm.title}"`
    );
    setRuleModalOpen(false);
    setEditingRuleId(null);
  };

  const handleConfirmDeleteRule = async () => {
    if (!currentLevel || !deleteConfirmRuleId) return;
    const nextRewards = (currentLevel.rewards || []).filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r: any) => r.id !== deleteConfirmRuleId
    );
    const nextLevels = levels.map((lvl, idx) =>
      idx === selectedLevelIdx ? { ...lvl, rewards: nextRewards } : lvl
    );
    await mutate(
      "UPDATE_PROGRAM",
      { id: program.id, data: { levelsJson: JSON.stringify(nextLevels) } },
      "Commission reward rule deleted"
    );
    setDeleteConfirmRuleId(null);
  };

  const handleAddLevel = async () => {
    const nextLevels = [
      ...levels,
      {
        id: `lvl-${Date.now()}`,
        name: `Tier Level ${levels.length + 1}`,
        badgeColor: "blue",
        rewards: [],
        benefits: [
          { id: `b-${Date.now()}`, title: "Priority Co-Selling Support" },
        ],
        requirements: [
          {
            id: `req-${Date.now()}`,
            metric: "Minimum annual revenue",
            target: "SGD 75,000",
          },
        ],
      },
    ];
    await mutate(
      "UPDATE_PROGRAM",
      { id: program.id, data: { levelsJson: JSON.stringify(nextLevels) } },
      "New program tier level added!"
    );
    setSelectedLevelIdx(nextLevels.length - 1);
  };

  const handleTogglePermission = async (
    groupName: string,
    permLabel: string,
    roleKey: "Manager" | "SalesRep" | "Stakeholder"
  ) => {
    const nextPerms = {
      ...permissions,
      [groupName]: {
        ...(permissions[groupName] || {}),
        [permLabel]: {
          ...(permissions[groupName]?.[permLabel] || {}),
          [roleKey]: !permissions[groupName]?.[permLabel]?.[roleKey],
        },
      },
    };
    await mutate(
      "UPDATE_PROGRAM",
      { id: program.id, data: { permissionsJson: JSON.stringify(nextPerms) } },
      `Updated "${permLabel}" permission for ${roleKey} (enforced in Partner Portal)`
    );
  };

  const handleSelectEmailTemplate = async (
    triggerKey: string,
    templateName: string
  ) => {
    const nextAuto = {
      ...autoEmails,
      [triggerKey]: templateName,
    };
    await mutate(
      "UPDATE_PROGRAM",
      { id: program.id, data: { autoEmailsJson: JSON.stringify(nextAuto) } },
      `Assigned template "${templateName}" to ${triggerKey}`
    );
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLink.name || !newLink.targetUrl) return;
    await mutate(
      "CREATE_TRACKING_LINK",
      {
        name: newLink.name,
        targetUrl: newLink.targetUrl,
        programId: program.id,
      },
      "Partner referral tracking link created!"
    );
    setNewLink({ name: "", targetUrl: "" });
  };

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-5 space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <BackBreadcrumb href="/programs/views/all" label="Programs" />
          <div className="flex items-center space-x-3 pt-1">
            <h1 className="text-xl font-bold text-slate-900">{program.name}</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              {levels.length} Tier Levels
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/forms/apply/${program.id}`}
            className="px-3.5 py-2 rounded-lg border border-blue-600 text-blue-700 bg-blue-50 hover:bg-blue-100 text-xs font-semibold flex items-center space-x-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Public Application Form</span>
          </Link>
          <button
            onClick={async () => {
              const res = await mutate(
                "DUPLICATE_PROGRAM",
                { id: program.id },
                `Duplicated program "${program.name}"!`
              );
              if (res?.program?.id) {
                router.push(`/programs/${res.program.id}`);
              }
            }}
            className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center space-x-1.5"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Duplicate</span>
          </button>
          <button
            onClick={() => showToast("Program renamed")}
            className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
          >
            Rename
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar (4 cols) */}
        <div className="lg:col-span-4 space-y-4 text-xs">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2.5">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
              About this program
            </h3>
            <div className="flex justify-between">
              <span className="text-slate-500"># of partners (computed)</span>
              <span className="font-bold text-slate-900">{members.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Owner</span>
              <span className="font-medium text-slate-900">{program.owner}</span>
            </div>
          </div>

          {/* D9 Fix: Per-Trigger Email Template Pickers */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
              Automated emails (Template per trigger)
            </h3>
            {[
              {
                key: "acknowledgeSignupTemplate",
                label: "Acknowledge partner signup",
                defaultTpl: "Partner Application Received",
              },
              {
                key: "notifyAcceptedTemplate",
                label: "Notify accepted partner (with activation link)",
                defaultTpl: "Partner Application Approved",
              },
              {
                key: "notifyRejectedTemplate",
                label: "Notify rejected partner",
                defaultTpl: "Partner Application Update",
              },
            ].map((trig) => (
              <div key={trig.key} className="space-y-1">
                <label className="block font-semibold text-slate-700">
                  {trig.label}
                </label>
                <select
                  value={autoEmails[trig.key] || trig.defaultTpl}
                  onChange={(e) =>
                    handleSelectEmailTemplate(trig.key, e.target.value)
                  }
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-slate-50 font-medium text-blue-700"
                >
                  <option value="Disabled">Disabled (Do not send)</option>
                  {emailTemplates.map((t) => (
                    <option key={t.id} value={t.name}>
                      Template: {t.name}
                    </option>
                  ))}
                  <option value="Partner Application Update">
                    Template: Partner Application Update
                  </option>
                </select>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
              Terms &amp; Conditions
            </h3>
            <p className="text-slate-600">
              Require partners to accept T&amp;Cs:{" "}
              <strong className="text-blue-700">Yes</strong>
            </p>
            <p className="text-blue-600 truncate">{program.termsUrl}</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
              Metrics
            </h3>
            <p className="text-slate-500">Revenue computation strategy:</p>
            <p className="font-bold text-slate-900">{program.revenueStrategy}</p>
          </div>
        </div>

        {/* Right Tabs (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-sm flex flex-wrap gap-1">
            {PROGRAM_TABS.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === t
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {t}
                {t === "Applications" && ` (${pendingApps.length})`}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm text-xs">
            {activeTab === "Members" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900">
                    Program Members ({members.length})
                  </h3>
                  <button
                    onClick={() => setGlobalModal("add_partner")}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
                  >
                    + Add partner to program
                  </button>
                </div>
                <div className="divide-y divide-slate-100">
                  {members.map((m) => (
                    <div
                      key={m.id}
                      className="py-3 flex items-center justify-between"
                    >
                      <div>
                        <Link
                          href={`/partners/${m.id}`}
                          className="font-bold text-blue-700 hover:underline"
                        >
                          {m.name}
                        </Link>
                        <p className="text-slate-500">
                          {m.qualifyingLevel} · Active since {m.activeSince} ·
                          Sourced SGD {m.sourcedRevenue365d.toLocaleString()}
                        </p>
                      </div>
                      <StatusBadge status={m.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* §4.6 Applications Review: Accept as Active, Accept as Prospect, Reject with Reason */}
            {activeTab === "Applications" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      Pending Applications ({pendingApps.length})
                    </h3>
                    <p className="text-slate-500">
                      Accept as Prospect (Prospection pipeline, no portal access)
                      or Active Partner (portal activation link sent), or Reject
                      with required reason.
                    </p>
                  </div>
                  <Link
                    href={`/forms/apply/${program.id}`}
                    className="px-3 py-1.5 rounded-lg border border-blue-600 text-blue-700 font-semibold"
                  >
                    Open Public Application Form →
                  </Link>
                </div>

                {pendingApps.length === 0 ? (
                  <p className="text-slate-500 py-6 text-center">
                    No pending applications. Submit one via the Public
                    Application Form!
                  </p>
                ) : (
                  pendingApps.map((app) => (
                    <div
                      key={app.id}
                      className="p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-bold text-sm text-slate-900">
                          {app.name}
                        </p>
                        <p className="text-slate-600">
                          Contact: {app.contactFirstName} {app.contactLastName} (
                          {app.contactEmail}) · {app.country}
                        </p>
                        <p className="text-slate-400 text-[11px]">
                          Industry: {app.industry} · Website:{" "}
                          {app.companyWebsite}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() =>
                            mutate(
                              "REVIEW_PARTNER_APPLICATION",
                              {
                                partnerId: app.id,
                                programId: program.id,
                                mode: "accept_prospect",
                              },
                              `Accepted "${app.name}" as Prospect (entered Prospection pipeline)`
                            )
                          }
                          className="px-3 py-1.5 rounded-lg border border-blue-600 text-blue-700 hover:bg-blue-50 font-semibold"
                        >
                          Accept as Prospect
                        </button>
                        <button
                          onClick={() =>
                            mutate(
                              "REVIEW_PARTNER_APPLICATION",
                              {
                                partnerId: app.id,
                                programId: program.id,
                                mode: "accept_active",
                              },
                              `Accepted "${app.name}" as Active Partner & sent activation link!`
                            )
                          }
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                        >
                          Accept as Active Partner
                        </button>
                        <button
                          onClick={() => {
                            setRejectPartnerId(app.id);
                            setRejectionReason("");
                          }}
                          className="px-3 py-1.5 rounded-lg border border-amber-500 text-amber-800 hover:bg-amber-50 font-semibold"
                        >
                          Reject...
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "Links" && (
              <div className="space-y-4">
                <form
                  onSubmit={handleCreateLink}
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap gap-2 items-end"
                >
                  <div className="flex-1 min-w-[180px]">
                    <label className="block font-medium text-slate-700 mb-1">
                      Link Name
                    </label>
                    <input
                      value={newLink.name}
                      onChange={(e) =>
                        setNewLink({ ...newLink, name: e.target.value })
                      }
                      placeholder="e.g. APAC Webinar Referral Page"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <div className="flex-1 min-w-[220px]">
                    <label className="block font-medium text-slate-700 mb-1">
                      Target URL
                    </label>
                    <input
                      value={newLink.targetUrl}
                      onChange={(e) =>
                        setNewLink({ ...newLink, targetUrl: e.target.value })
                      }
                      placeholder="https://r-prm.example.com/offer"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
                  >
                    + Add link
                  </button>
                </form>

                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2">Name</th>
                      <th className="py-2">Target URL</th>
                      <th className="py-2 text-right">Unique visitors</th>
                      <th className="py-2 text-right">Leads</th>
                      <th className="py-2 text-right">Customers</th>
                      <th className="py-2 text-right">Transactions</th>
                      <th className="py-2 text-right">Revenues</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {progLinks.map((lnk) => (
                      <tr key={lnk.id}>
                        <td className="py-2.5 font-bold text-slate-900">
                          {lnk.name}
                        </td>
                        <td className="py-2.5 text-blue-600">{lnk.targetUrl}</td>
                        <td className="py-2.5 text-right">
                          {lnk.uniqueVisitors}
                        </td>
                        <td className="py-2.5 text-right">{lnk.leadsCount}</td>
                        <td className="py-2.5 text-right">
                          {lnk.customersCount}
                        </td>
                        <td className="py-2.5 text-right">
                          {lnk.transactionsCount}
                        </td>
                        <td className="py-2.5 text-right font-bold">
                          SGD {lnk.revenuesSgd.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* D1, D2, D3 Fix: Structured Reward Rule Builder + Edit & Delete with Confirmation */}
            {activeTab === "Levels" && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
                  {levels.map((lvl, idx) => (
                    <button
                      key={lvl.id}
                      onClick={() => setSelectedLevelIdx(idx)}
                      className={`px-3.5 py-1.5 rounded-lg font-bold border ${
                        selectedLevelIdx === idx
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {lvl.name}
                    </button>
                  ))}
                  <button
                    onClick={handleAddLevel}
                    className="px-3 py-1.5 rounded-lg border border-dashed border-blue-400 text-blue-600 font-semibold hover:bg-blue-50 flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add new level</span>
                  </button>
                </div>

                {currentLevel && (
                  <div className="space-y-5">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 font-bold text-sm text-slate-900">
                          <Gift className="w-4 h-4 text-blue-600" />
                          <span>
                            Structured Commission Rules (
                            {currentLevel.rewards?.length || 0})
                          </span>
                        </div>
                        <button
                          onClick={openCreateRuleModal}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center space-x-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add reward</span>
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {(currentLevel.rewards || []).map(
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          (rawR: any) => {
                            const r = normalizeRewardRule(rawR);
                            return (
                              <div
                                key={r.id}
                                className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 flex flex-wrap items-center justify-between gap-3"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <p className="font-bold text-slate-900 text-sm">
                                      {r.title}
                                    </p>
                                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[10px]">
                                      {r.valueType} · {r.amountMode}
                                    </span>
                                  </div>
                                  <p className="text-slate-600">
                                    Trigger: <strong>{r.trigger}</strong> ·
                                    Duration: <strong>{r.duration}</strong> (Start
                                    Month {r.startOffsetMonths ?? 1}
                                    {r.duration === "recurring"
                                      ? ` for ${r.durationMonths || 12} mos`
                                      : ""}
                                    ) ·{" "}
                                    {r.requiresValidation
                                      ? "Requires Validation"
                                      : "Auto-Validated"}{" "}
                                    ·{" "}
                                    {r.clawbackOnRefund
                                      ? "Clawback on Refund"
                                      : "No Clawback"}
                                  </p>
                                  {r.rateSteps && r.rateSteps.length > 0 && (
                                    <p className="text-blue-700 font-semibold text-[11px]">
                                      Stepped Rates:{" "}
                                      {r.rateSteps
                                        .map(
                                          (s) =>
                                            `${s.ratePct}% (Months ${s.fromMonth}–${s.toMonth})`
                                        )
                                        .join(" → ")}
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center space-x-2">
                                  <span className="px-2.5 py-1 rounded bg-blue-600 text-white font-bold">
                                    {r.amountMode === "percentage"
                                      ? `${r.rateOrAmount}%`
                                      : r.amountMode === "one_month_subscription"
                                      ? "1 Month Fee"
                                      : `${r.currency || "SGD"} ${
                                          r.rateOrAmount
                                        }`}
                                  </span>
                                  <button
                                    onClick={() => openEditRuleModal(r)}
                                    className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold flex items-center space-x-1"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmRuleId(r.id)}
                                    className="px-2 py-1 rounded border border-red-200 bg-white hover:bg-red-50 text-red-600 font-semibold flex items-center space-x-1"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>

                    {/* Benefits */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 font-bold text-sm text-slate-900">
                        <Award className="w-4 h-4 text-blue-600" />
                        <span>Benefits</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {(currentLevel.benefits || []).map(
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          (b: any) => (
                            <div
                              key={b.id}
                              className="p-3 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-800"
                            >
                              ✓ {b.title}
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    {/* Requirements */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 font-bold text-sm text-slate-900">
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        <span>Requirements</span>
                      </div>
                      <div className="space-y-2">
                        {(currentLevel.requirements || []).map(
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          (req: any) => (
                            <div
                              key={req.id}
                              className="p-3 rounded-xl border border-slate-200 flex items-center justify-between"
                            >
                              <span className="text-slate-700 font-medium">
                                {req.metric}
                              </span>
                              <span className="font-bold text-blue-700">
                                {req.target}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* §4.3 Role-Based Partner Portal Permissions (Persisted & Enforced in /p) */}
            {activeTab === "Settings" && (
              <div className="space-y-5">
                {/* §14.2 Slice 4: Per-Program Payout Schedule & Threshold Override */}
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-3">
                  <h4 className="font-bold text-slate-900 text-sm">
                    Program Payout Schedule &amp; Threshold Override
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Payout Cadence (Default / Override)
                      </label>
                      <select
                        value={String(autoEmails.payoutCadence || "quarterly")}
                        onChange={(e) =>
                          handleSelectEmailTemplate(
                            "payoutCadence",
                            e.target.value
                          )
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="quarterly">
                          Quarterly (1 payout per partner per quarter)
                        </option>
                        <option value="monthly">
                          Monthly (1 payout per partner per month)
                        </option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Minimum Payout Threshold (SGD)
                      </label>
                      <input
                        type="number"
                        defaultValue={Number(autoEmails.payoutThresholdSgd ?? 250)}
                        onBlur={(e) =>
                          handleSelectEmailTemplate(
                            "payoutThresholdSgd",
                            e.target.value
                          )
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 font-bold text-sm text-slate-900">
                  <Shield className="w-4 h-4 text-blue-600" />
                  <span>
                    Role-Based Partner Portal Permissions (Enforced Live in /p
                    Partner Portal)
                  </span>
                </div>

                {Object.entries(permissions).map(([groupName, rules]) => (
                  <div key={groupName} className="space-y-2">
                    <h4 className="font-bold text-blue-700 uppercase tracking-wider text-[11px]">{groupName}</h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                            <th className="py-2 px-3">Permission</th>
                            <th className="py-2 px-3 text-center">Manager</th>
                            <th className="py-2 px-3 text-center">Sales Rep</th>
                            <th className="py-2 px-3 text-center">Stakeholder</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {Object.entries(rules).map(([permLabel, roles]) => (
                            <tr key={permLabel}>
                              <td className="py-2 px-3 font-medium text-slate-800">{permLabel}</td>
                              {(["Manager", "SalesRep", "Stakeholder"] as const).map((rKey) => (
                                <td key={rKey} className="py-2 px-3 text-center">
                                  <input type="checkbox" checked={Boolean(roles[rKey])} onChange={() => handleTogglePermission(groupName, permLabel, rKey)} className="rounded text-blue-600 cursor-pointer" />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* STRUCTURED REWARD RULE BUILDER MODAL (Fixes D1, D2, D3) */}
      {ruleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveRule}
            className="bg-white rounded-xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden text-xs"
          >
            <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingRuleId
                  ? "Edit Structured Commission Rule"
                  : "Create Structured Commission Rule"}
              </h3>
              <button type="button" onClick={() => setRuleModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 max-h-[80vh] overflow-y-auto">
              {/* Quick Preset Loader for Eber's 3 Real Commission Programs (§4.1.4) */}
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 space-y-1.5">
                <span className="text-[11px] font-bold text-blue-800">
                  Load Eber Commission Fixture Template:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setRuleForm({
                        ...EBER_COMMISSION_FIXTURE_RULES.biz_partner_one_off,
                        id: ruleForm.id,
                      })
                    }
                    className="px-2.5 py-1 rounded bg-white border border-blue-300 text-blue-700 font-semibold hover:bg-blue-100"
                  >
                    Biz Partner (Month-4 One-Off)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setRuleForm({
                        ...EBER_COMMISSION_FIXTURE_RULES.biz_partner_premium_recurring,
                        id: ruleForm.id,
                      })
                    }
                    className="px-2.5 py-1 rounded bg-white border border-blue-300 text-blue-700 font-semibold hover:bg-blue-100"
                  >
                    Biz Partner Premium (20% M4–15 / 10% M16–27)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setRuleForm({
                        ...EBER_COMMISSION_FIXTURE_RULES.referral_entry,
                        id: ruleForm.id,
                      })
                    }
                    className="px-2.5 py-1 rounded bg-white border border-blue-300 text-blue-700 font-semibold hover:bg-blue-100"
                  >
                    Referral Entry (Pre-Acceptance Override)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Rule Title *
                </label>
                <input
                  required
                  value={ruleForm.title}
                  onChange={(e) =>
                    setRuleForm({ ...ruleForm, title: e.target.value })
                  }
                  placeholder="e.g. 18% Recurring Enterprise Commission"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Trigger Event
                  </label>
                  <select
                    value={ruleForm.trigger}
                    onChange={(e) =>
                      setRuleForm({
                        ...ruleForm,
                        trigger: e.target
                          .value as StructuredRewardRule["trigger"],
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="transaction_paid">
                      On paid transaction from won deal
                    </option>
                    <option value="deal_closed_won">
                      When deal moves to Closed Won
                    </option>
                    <option value="lead_accepted">
                      When partner lead is accepted
                    </option>
                    <option value="lead_converted">
                      When lead converts to deal
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Value Type
                  </label>
                  <select
                    value={ruleForm.valueType}
                    onChange={(e) =>
                      setRuleForm({
                        ...ruleForm,
                        valueType: e.target
                          .value as StructuredRewardRule["valueType"],
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Coupon">Coupon (Config OPEN)</option>
                    <option value="Gift card">Gift card (Config OPEN)</option>
                    <option value="Credit">Credit (Config OPEN)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Amount Mode
                  </label>
                  <select
                    value={ruleForm.amountMode}
                    onChange={(e) =>
                      setRuleForm({
                        ...ruleForm,
                        amountMode: e.target
                          .value as StructuredRewardRule["amountMode"],
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount</option>
                    <option value="one_month_subscription">
                      1 Month Subscription Fee
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Rate (%) or Fixed Amount
                  </label>
                  <input
                    type="number"
                    value={ruleForm.rateOrAmount}
                    onChange={(e) =>
                      setRuleForm({
                        ...ruleForm,
                        rateOrAmount: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Currency
                  </label>
                  <select
                    value={ruleForm.currency || "SGD"}
                    onChange={(e) =>
                      setRuleForm({ ...ruleForm, currency: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option>SGD</option>
                    <option>USD</option>
                    <option>EUR</option>
                    <option>MYR</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Duration Mode
                  </label>
                  <select
                    value={ruleForm.duration}
                    onChange={(e) =>
                      setRuleForm({
                        ...ruleForm,
                        duration: e.target
                          .value as StructuredRewardRule["duration"],
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="one_off">One-off</option>
                    <option value="recurring">Recurring (N months)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Start at Billing Month
                  </label>
                  <input
                    type="number"
                    value={ruleForm.startOffsetMonths ?? 1}
                    onChange={(e) =>
                      setRuleForm({
                        ...ruleForm,
                        startOffsetMonths: Number(e.target.value) || 1,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Duration (Months)
                  </label>
                  <input
                    type="number"
                    value={ruleForm.durationMonths ?? 12}
                    onChange={(e) =>
                      setRuleForm({
                        ...ruleForm,
                        durationMonths: Number(e.target.value) || 1,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* P5: Visible & Editable Rate Steps in Rule Builder */}
              {ruleForm.duration === "recurring" && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">
                      Recurring Rate Steps (e.g. 20% M4–15, 10% M16–27)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setRuleForm({
                          ...ruleForm,
                          rateSteps: [
                            ...(ruleForm.rateSteps || []),
                            { fromMonth: 4, toMonth: 15, ratePct: 20 },
                          ],
                        })
                      }
                      className="px-2.5 py-1 rounded bg-blue-600 text-white font-semibold text-[11px]"
                    >
                      + Add Rate Step
                    </button>
                  </div>
                  {(ruleForm.rateSteps || []).length === 0 ? (
                    <p className="text-[11px] text-slate-500">
                      No rate steps defined (uses flat rate above for all recurring months). Click &ldquo;+ Add Rate Step&rdquo; to configure stepped rates.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {(ruleForm.rateSteps || []).map((step, sIdx) => (
                        <div
                          key={sIdx}
                          className="grid grid-cols-4 gap-2 items-center bg-white p-2 rounded-lg border border-slate-200"
                        >
                          <div>
                            <label className="block text-[10px] text-slate-500">
                              From Month
                            </label>
                            <input
                              type="number"
                              value={step.fromMonth}
                              onChange={(e) => {
                                const next = [...(ruleForm.rateSteps || [])];
                                next[sIdx] = {
                                  ...next[sIdx],
                                  fromMonth: Number(e.target.value) || 1,
                                };
                                setRuleForm({ ...ruleForm, rateSteps: next });
                              }}
                              className="w-full px-2 py-1 border border-slate-300 rounded"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500">
                              To Month
                            </label>
                            <input
                              type="number"
                              value={step.toMonth}
                              onChange={(e) => {
                                const next = [...(ruleForm.rateSteps || [])];
                                next[sIdx] = {
                                  ...next[sIdx],
                                  toMonth: Number(e.target.value) || 1,
                                };
                                setRuleForm({ ...ruleForm, rateSteps: next });
                              }}
                              className="w-full px-2 py-1 border border-slate-300 rounded"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500">
                              Rate (%)
                            </label>
                            <input
                              type="number"
                              value={step.ratePct}
                              onChange={(e) => {
                                const next = [...(ruleForm.rateSteps || [])];
                                next[sIdx] = {
                                  ...next[sIdx],
                                  ratePct: Number(e.target.value) || 0,
                                };
                                setRuleForm({ ...ruleForm, rateSteps: next });
                              }}
                              className="w-full px-2 py-1 border border-slate-300 rounded"
                            />
                          </div>
                          <div className="text-right pt-3">
                            <button
                              type="button"
                              onClick={() => {
                                const next = (ruleForm.rateSteps || []).filter(
                                  (_, i) => i !== sIdx
                                );
                                setRuleForm({ ...ruleForm, rateSteps: next });
                              }}
                              className="px-2 py-1 rounded text-red-600 hover:bg-red-50 font-semibold"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-4 pt-1">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={ruleForm.requiresValidation}
                    onChange={(e) =>
                      setRuleForm({
                        ...ruleForm,
                        requiresValidation: e.target.checked,
                      })
                    }
                  />
                  <span className="font-medium text-slate-800">
                    Create as Pending until Admin validates
                  </span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={ruleForm.clawbackOnRefund}
                    onChange={(e) =>
                      setRuleForm({
                        ...ruleForm,
                        clawbackOnRefund: e.target.checked,
                      })
                    }
                  />
                  <span className="font-medium text-slate-800">
                    Clawback (reverse) if underlying payment is refunded
                  </span>
                </label>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setRuleModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold flex items-center space-x-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{editingRuleId ? "Save Rule" : "Confirm & Add Rule"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DELETE RULE CONFIRMATION MODAL (Fixes D3) */}
      {deleteConfirmRuleId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 text-xs">
            <h3 className="font-bold text-base text-slate-900">Delete Commission Rule?</h3>
            <p className="text-slate-600">Are you sure you want to remove this commission rule from <strong>{currentLevel?.name}</strong>? Existing historical rewards will not be deleted.</p>
            <div className="flex justify-end space-x-2">
              <button onClick={() => setDeleteConfirmRuleId(null)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700">Cancel</button>
              <button onClick={handleConfirmDeleteRule} className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold">Confirm Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT APPLICATION WITH REQUIRED REASON MODAL (§4.6) */}
      {rejectPartnerId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!rejectionReason.trim()) return;
              await mutate("REVIEW_PARTNER_APPLICATION", { partnerId: rejectPartnerId, programId: program.id, mode: "reject", rejectionReason, reapplyAfterDate }, "Partner application rejected with reason & notification email sent");
              setRejectPartnerId(null);
            }}
            className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden text-xs"
          >
            <div className="px-5 py-4 bg-amber-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Reject Partner Application (Reason Required)</h3>
              <button type="button" onClick={() => setRejectPartnerId(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rejection Reason (sent in rejection email) *</label>
                <textarea required rows={3} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="e.g. Minimum regional technical headcount requirement not yet met." className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Eligible to re-apply after (optional)</label>
                <input type="date" value={reapplyAfterDate} onChange={(e) => setReapplyAfterDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button type="button" onClick={() => setRejectPartnerId(null)} className="px-3 py-1.5 rounded-lg text-slate-600">Cancel</button>
              <button type="submit" className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold">Confirm Rejection</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
