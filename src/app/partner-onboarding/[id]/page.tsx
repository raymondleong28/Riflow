"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import { StatusBadge } from "@/components/SharedEngines";
import { ArrowRight, Plus, CheckCircle2, X, ShieldCheck } from "lucide-react";

const ONBOARDING_STAGES = [
  "Kickoff Welcome Call",
  "Book a Demo Account Training",
  "Technical Certification",
  "Completed",
];

// 6 Verified Onboarding Stage Action Types (§4.5 / D8)
const ONBOARDING_ACTION_TYPES = [
  {
    type: "view_asset",
    label: "1. View asset",
    defaultTitle: "Review 2026 Enterprise Partner Pitch Deck",
    requiresValidation: false,
  },
  {
    type: "read_article",
    label: "2. Read article",
    defaultTitle: "Read 'How to Register & Protect an Enterprise Deal'",
    requiresValidation: false,
  },
  {
    type: "upload_document",
    label: "3. Upload document",
    defaultTitle: "Upload Counter-Signed Master Reseller Agreement (PDF)",
    requiresValidation: true,
  },
  {
    type: "provide_information",
    label: "4. Provide information",
    defaultTitle: "Complete Regional Territory & Technical Headcount Form",
    requiresValidation: true,
  },
  {
    type: "book_meeting",
    label: "5. Book meeting",
    defaultTitle: "Book Kickoff Alignment Call via Calendly / HubSpot",
    requiresValidation: false,
  },
  {
    type: "self_invoicing_opt_in",
    label: "6. Opt-in/out from self-invoicing",
    defaultTitle: "Confirm Automated Self-Invoicing & GST/Tax Billing Preference",
    requiresValidation: false,
  },
] as const;

export default function PartnerOnboardingPage() {
  const { partners, programs, manageItems, mutate, setGlobalModal, showToast } =
    usePrm();
  const [pipeline, setPipeline] = useState("Strategic Partner");
  const [assignedProgram, setAssignedProgram] = useState(
    "R-Cloud Strategic Solution Partners"
  );
  const [visibleToMainContacts, setVisibleToMainContacts] = useState(true);

  // Stage Action Builder Modal State (Fixes D8)
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionStage, setActionStage] = useState("Kickoff Welcome Call");
  const [actionType, setActionType] = useState("view_asset");
  const [actionTitle, setActionTitle] = useState(
    "Review 2026 Enterprise Partner Pitch Deck"
  );
  const [actionDesc, setActionDesc] = useState(
    "Required onboarding step before advancing to next stage."
  );
  const [requireValidation, setRequireValidation] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedArticleId, setSelectedArticleId] = useState("");
  const [documentTitle, setDocumentTitle] = useState(
    "Signed Partner Compliance Certificate"
  );
  const [dynamicFields, setDynamicFields] = useState<string[]>([
    "Number of Certified Engineers",
    "Primary APAC Territory",
  ]);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [calendarType, setCalendarType] = useState("Calendly");
  const [calendarLink, setCalendarLink] = useState(
    "https://calendly.com/r-cloud-alliances/kickoff"
  );

  const assets = manageItems.filter((m) => m.category === "assets");
  const articles = manageItems.filter((m) => m.category === "help_articles");
  const stageActions = manageItems.filter(
    (m) => m.category === "onboarding_action"
  );

  const moveStage = async (id: string, nextStage: string) => {
    await mutate(
      "UPDATE_PARTNER",
      {
        id,
        data: {
          onboardingStage: nextStage,
          onboardingStatus:
            nextStage === "Completed" ? "Completed" : "In progress",
        },
      },
      `Partner onboarding advanced to "${nextStage}"`
    );
  };

  const handleCreateStageAction = async (e: React.FormEvent) => {
    e.preventDefault();
    await mutate(
      "CREATE_MANAGE_ITEM",
      {
        category: "onboarding_action",
        name: actionTitle,
        subtitle: `Stage: ${actionStage} · Type: ${actionType} · ${
          requireValidation ? "Requires Admin Validation" : "Auto-Complete"
        }`,
        status: requireValidation ? "Pending Validation" : "Active",
        metadata: {
          pipeline,
          stage: actionStage,
          actionType,
          description: actionDesc,
          requireValidation,
          selectedAssetId,
          selectedArticleId,
          documentTitle,
          dynamicFields,
          calendarType,
          calendarLink,
        },
      },
      `Added "${actionType}" action to stage "${actionStage}"!`
    );
    setActionModalOpen(false);
  };

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-5 space-y-5">
      {/* Pipeline Header with Explicit Pipeline-to-Program Binding (§4.5) */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-bold text-slate-900">
            Partners onboarding
          </h1>
          <select
            value={pipeline}
            onChange={(e) => setPipeline(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50"
          >
            <option value="Strategic Partner">
              Pipeline: Strategic Partner
            </option>
            <option value="Fast-Track Referral">
              Pipeline: Fast-Track Referral
            </option>
          </select>

          <select
            value={assignedProgram}
            onChange={(e) => {
              setAssignedProgram(e.target.value);
              showToast(`Pipeline bound to program "${e.target.value}"`);
            }}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 bg-white"
          >
            {programs.map((prog) => (
              <option key={prog.id} value={prog.name}>
                Assigned Program: {prog.name}
              </option>
            ))}
          </select>

          <label className="flex items-center space-x-1.5 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={visibleToMainContacts}
              onChange={(e) => setVisibleToMainContacts(e.target.checked)}
              className="rounded text-blue-600"
            />
            <span>Visible to partner main contacts</span>
          </label>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setActionModalOpen(true)}
            className="px-3.5 py-2 rounded-lg border border-blue-600 text-blue-700 bg-blue-50 hover:bg-blue-100 text-xs font-semibold flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Stage Action (6 Types)</span>
          </button>
          <button
            onClick={() => setGlobalModal("add_partner")}
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Start onboarding</span>
          </button>
        </div>
      </div>

      {/* Onboarding Kanban Board — Actions Attached Per Individual Stage */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {ONBOARDING_STAGES.map((stage, idx) => {
          const items = partners.filter((p) => p.onboardingStage === stage);
          const nextStage = ONBOARDING_STAGES[idx + 1];
          const actionsForThisStage = stageActions.filter((sa) => {
            try {
              const meta = sa.metadataJson ? JSON.parse(sa.metadataJson) : sa.metadata;
              if (meta?.stage) return meta.stage === stage;
            } catch {}
            return (sa.subtitle || "").includes(`Stage: ${stage}`);
          });

          // Default stage-level action examples per stage so each stage shows its attached actions
          const defaultStageActionMap: Record<
            string,
            Array<{ type: string; label: string; title: string; requiresValidation: boolean }>
          > = {
            "Kickoff Welcome Call": [
              {
                type: "book_meeting",
                label: "Book meeting",
                title: "Book Kickoff Alignment Call via Calendly / HubSpot",
                requiresValidation: false,
              },
              {
                type: "view_asset",
                label: "View asset",
                title: "Review 2026 Enterprise Partner Pitch Deck",
                requiresValidation: false,
              },
            ],
            "Book a Demo Account Training": [
              {
                type: "read_article",
                label: "Read article",
                title: "Read 'How to Register & Protect an Enterprise Deal'",
                requiresValidation: false,
              },
              {
                type: "provide_information",
                label: "Provide information",
                title: "Complete Regional Territory & Technical Headcount Form",
                requiresValidation: true,
              },
            ],
            "Technical Certification": [
              {
                type: "upload_document",
                label: "Upload document",
                title: "Upload Counter-Signed Master Reseller Agreement (PDF)",
                requiresValidation: true,
              },
            ],
            Completed: [
              {
                type: "self_invoicing_opt_in",
                label: "Opt-in/out from self-invoicing",
                title: "Confirm Automated Self-Invoicing & GST/Tax Billing Preference",
                requiresValidation: false,
              },
            ],
          };
          const builtInStageActions = defaultStageActionMap[stage] || [];

          return (
            <div
              key={stage}
              className="bg-slate-100/80 rounded-xl border border-slate-200 p-4 space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="font-bold text-xs text-slate-900">
                    {stage}
                  </span>
                  <span className="px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-700 rounded-full">
                    {items.length}
                  </span>
                </div>

                {/* Stage-Scoped Actions Panel */}
                <div className="bg-white rounded-xl border border-blue-200 p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-blue-900 uppercase tracking-wider">
                      Stage Actions ({builtInStageActions.length + actionsForThisStage.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setActionStage(stage);
                        setActionModalOpen(true);
                      }}
                      className="text-blue-600 hover:underline font-semibold text-[11px] flex items-center space-x-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Action</span>
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {builtInStageActions.map((act) => (
                      <div
                        key={act.type + act.title}
                        onClick={() => {
                          setActionStage(stage);
                          setActionType(act.type);
                          setActionTitle(act.title);
                          setRequireValidation(act.requiresValidation);
                          setActionModalOpen(true);
                        }}
                        className="p-2 rounded-lg border border-slate-200 hover:border-blue-400 bg-slate-50 cursor-pointer space-y-0.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-blue-700 uppercase">
                            {act.label}
                          </span>
                          {act.requiresValidation && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                              Requires Validation
                            </span>
                          )}
                        </div>
                        <p className="font-medium text-slate-800 text-[11px]">
                          {act.title}
                        </p>
                      </div>
                    ))}

                    {actionsForThisStage.map((sa) => (
                      <div
                        key={sa.id}
                        className="p-2 rounded-lg bg-blue-50/60 border border-blue-200 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-[11px]">
                            {sa.name}
                          </span>
                          <StatusBadge status={sa.status} />
                        </div>
                        <p className="text-[10px] text-slate-500">{sa.subtitle}</p>
                        {sa.status === "Pending Validation" && (
                          <button
                            type="button"
                            onClick={() =>
                              mutate(
                                "TOGGLE_MANAGE_ITEM_STATUS",
                                { id: sa.id, status: "Validated" },
                                `Admin validated onboarding action "${sa.name}"!`
                              )
                            }
                            className="w-full mt-1 px-2 py-1 rounded bg-emerald-600 text-white font-semibold text-[10px] flex items-center justify-center space-x-1"
                          >
                            <ShieldCheck className="w-3 h-3" />
                            <span>Approve Validation</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Partner Cards in this Stage */}
                <div className="space-y-2.5">
                  {items.map((p) => (
                    <div
                      key={p.id}
                      className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm space-y-2 text-xs"
                    >
                      <Link
                        href={`/partners/${p.id}`}
                        className="font-bold text-blue-700 hover:underline block"
                      >
                        {p.name}
                      </Link>
                      <p className="text-slate-500">
                        {p.programName} · {p.qualifyingLevel}
                      </p>
                      <div className="text-[11px] text-emerald-700 flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {builtInStageActions.length + actionsForThisStage.length} stage actions assigned
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <StatusBadge status={p.onboardingStatus} />
                        {nextStage && (
                          <button
                            onClick={() => moveStage(p.id, nextStage)}
                            className="text-blue-600 hover:text-blue-800 font-semibold flex items-center space-x-1"
                          >
                            <span>Advance</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 6-ACTION-TYPE BUILDER MODAL (Fixes D8) */}
      {actionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateStageAction}
            className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden text-xs"
          >
            <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                Configure Onboarding Stage Action (6 Action Types)
              </h3>
              <button
                type="button"
                onClick={() => setActionModalOpen(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 max-h-[78vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Onboarding Stage
                  </label>
                  <select
                    value={actionStage}
                    onChange={(e) => setActionStage(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    {ONBOARDING_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Action Type (6 Verified Types)
                  </label>
                  <select
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="view_asset">View asset</option>
                    <option value="read_article">Read article</option>
                    <option value="upload_document">Upload document</option>
                    <option value="provide_information">
                      Provide information
                    </option>
                    <option value="book_meeting">Book meeting</option>
                    <option value="self_invoicing_opt_in">
                      Opt-in/out from self-invoicing
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Title *
                </label>
                <input
                  required
                  value={actionTitle}
                  onChange={(e) => setActionTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={actionDesc}
                  onChange={(e) => setActionDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              {/* Action Type 1: View Asset */}
              {actionType === "view_asset" && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Select Asset (from Manage &gt; Assets)
                  </label>
                  <select
                    value={selectedAssetId}
                    onChange={(e) => setSelectedAssetId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    {assets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Action Type 2: Read Article */}
              {actionType === "read_article" && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Select Article (from Help Center)
                  </label>
                  <select
                    value={selectedArticleId}
                    onChange={(e) => setSelectedArticleId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    {articles.map((art) => (
                      <option key={art.id} value={art.id}>
                        {art.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Action Type 3: Upload Document */}
              {actionType === "upload_document" && (
                <div className="space-y-2">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Required Document Title
                    </label>
                    <input
                      value={documentTitle}
                      onChange={(e) => setDocumentTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={requireValidation}
                      onChange={(e) => setRequireValidation(e.target.checked)}
                    />
                    <span className="font-medium text-slate-800">
                      Require admin validation before stage completes
                    </span>
                  </label>
                </div>
              )}

              {/* Action Type 4: Provide Information (Dynamic Form Builder) */}
              {actionType === "provide_information" && (
                <div className="space-y-2">
                  <label className="block font-semibold text-slate-700">
                    Dynamic Form Fields ({dynamicFields.length})
                  </label>
                  <div className="space-y-1">
                    {dynamicFields.map((fld, i) => (
                      <div
                        key={i}
                        className="px-3 py-1.5 rounded bg-slate-50 border border-slate-200 flex justify-between"
                      >
                        <span>
                          Field {i + 1}: <strong>{fld}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={newFieldLabel}
                      onChange={(e) => setNewFieldLabel(e.target.value)}
                      placeholder="Add field label..."
                      className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newFieldLabel.trim()) return;
                        setDynamicFields([
                          ...dynamicFields,
                          newFieldLabel.trim(),
                        ]);
                        setNewFieldLabel("");
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-200 font-semibold"
                    >
                      + Add field
                    </button>
                  </div>
                  <label className="flex items-center space-x-2 pt-1">
                    <input
                      type="checkbox"
                      checked={requireValidation}
                      onChange={(e) => setRequireValidation(e.target.checked)}
                    />
                    <span className="font-medium text-slate-800">
                      Require admin validation
                    </span>
                  </label>
                </div>
              )}

              {/* Action Type 5: Book Meeting */}
              {actionType === "book_meeting" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Calendar Type
                    </label>
                    <select
                      value={calendarType}
                      onChange={(e) => setCalendarType(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    >
                      <option>Calendly</option>
                      <option>HubSpot</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Calendar Booking Link
                    </label>
                    <input
                      value={calendarLink}
                      onChange={(e) => setCalendarLink(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              )}

              {/* Action Type 6: Opt-in/out from self-invoicing */}
              {actionType === "self_invoicing_opt_in" && (
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900">
                  Presents an Opt-In / Opt-Out toggle to the Partner Main
                  Contact during onboarding and sets the partner&apos;s{" "}
                  <strong>self-invoicing</strong> flag for automated payout
                  invoice generation.
                </div>
              )}
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setActionModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Save Stage Action
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
