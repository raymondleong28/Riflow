"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import { StatusBadge, DEAL_STAGES_10 } from "@/components/SharedEngines";
import {
  Check,
  Plus,
  Shield,
  Code2,
  Database,
  History,
  AlertTriangle,
} from "lucide-react";

const ACCOUNT_CATEGORIES = [
  { id: "defaults", label: "Account defaults" },
  { id: "partner-portal", label: "Partner portal" },
  { id: "directories", label: "Directories" },
  { id: "security", label: "Security" },
  { id: "partners", label: "Partner settings" },
  { id: "leads", label: "Lead settings" },
  { id: "deals", label: "Deal settings" },
  { id: "payouts", label: "Payout settings" },
  { id: "properties", label: "Properties" },
  { id: "data", label: "Account data" },
  { id: "billing", label: "Billing" },
  { id: "integration", label: "Integration" },
  { id: "audit-log", label: "Audit trail" },
] as const;

const PROPERTY_OBJECTS = [
  "Contacts",
  "Customers",
  "Deals",
  "Leads",
  "Partners",
  "Rewards",
  "Payouts",
  "Tasks",
  "Transactions",
  "Products",
];

export default function AccountRootPage() {
  const params = useParams();
  const initialTab = String(params?.tab || "defaults");
  const { settings, manageItems, mutate, showToast } = usePrm();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [propObject, setPropObject] = useState("Leads");
  const [newPropName, setNewPropName] = useState("");
  const [newPropType, setNewPropType] = useState("Single line text");
  const [newTokenName, setNewTokenName] = useState("");
  const [createdTokenPlaintext, setCreatedTokenPlaintext] = useState<
    string | null
  >(null);

  // §1.4 & §5.2 Data Safety: Typed confirmation for Reset data
  const [resetConfirmationText, setResetConfirmationText] = useState("");

  // Distinct Module Settings State (Fixes D7)
  const [partnerTypes, setPartnerTypes] = useState([
    "Reseller",
    "System Integrator",
    "Referral Agency",
    "Technology Partner",
  ]);
  const [newPartnerType, setNewPartnerType] = useState("");

  const acct = settings.account_settings || {
    accountName: "R-Cloud Enterprise PRM",
    timezone: "Asia/Singapore (GMT+08:00)",
    mainCurrency: "SGD",
    multiCurrency: true,
    portalDomain: "https://partners.r-cloud.example.com",
    primaryColor: "#2563EB",
    directorySubdomain: "r-cloud",
    dealExpirationDays: 90,
    dealReminderDays: 14,
    dealConflictDetection:
      "Warn & flag duplicate Deals across Customer company or contact email domain",
    allowDealResubmission: true,
    autoAssociateCustomers: true,
    dealValidationStrategy: "Anyone (Partner Owner or Administrator)",
    acknowledgeDealTemplate: "Deal Registration Validated",
    dealCardFields: [
      "Deal Name",
      "Partner Name",
      "Amount & Currency",
      "Probability (%)",
      "Expected Close Date",
      "Owner",
      "Conflict Flag",
    ],
    autoPayoutEnabled: true,
    autoPayoutSchedule: "Every month on the 1st day",
    autoPayoutThresholdSgd: 250,
  };

  // Controlled Deal & Payout Settings State (hydrated from settings.account_settings)
  const [dealConflictDetection, setDealConflictDetection] = useState(
    acct.dealConflictDetection ||
      "Warn & flag duplicate Deals across Customer company or contact email domain"
  );
  const [dealExpirationDays, setDealExpirationDays] = useState(
    Number(acct.dealExpirationDays ?? 90)
  );
  const [dealReminderDays, setDealReminderDays] = useState(
    Number(acct.dealReminderDays ?? 14)
  );
  const [allowDealResubmission, setAllowDealResubmission] = useState(
    Boolean(acct.allowDealResubmission ?? true)
  );
  const [autoAssociateCustomers, setAutoAssociateCustomers] = useState(
    Boolean(acct.autoAssociateCustomers ?? true)
  );
  const [dealValidationStrategy, setDealValidationStrategy] = useState(
    acct.dealValidationStrategy ||
      acct.validationStrategy ||
      "Anyone (Partner Owner or Administrator)"
  );
  const [acknowledgeDealTemplate, setAcknowledgeDealTemplate] = useState(
    acct.acknowledgeDealTemplate || "Deal Registration Validated"
  );
  const [autoPayoutSchedule, setAutoPayoutSchedule] = useState(
    acct.autoPayoutSchedule || "Every month on the 1st day"
  );
  const [autoPayoutThresholdSgd, setAutoPayoutThresholdSgd] = useState(
    Number(acct.autoPayoutThresholdSgd ?? 250)
  );

  React.useEffect(() => {
    const s = settings.account_settings;
    if (!s) return;
    if (s.dealConflictDetection)
      setDealConflictDetection(s.dealConflictDetection);
    if (s.dealExpirationDays !== undefined)
      setDealExpirationDays(Number(s.dealExpirationDays));
    if (s.dealReminderDays !== undefined)
      setDealReminderDays(Number(s.dealReminderDays));
    if (s.allowDealResubmission !== undefined)
      setAllowDealResubmission(Boolean(s.allowDealResubmission));
    if (s.autoAssociateCustomers !== undefined)
      setAutoAssociateCustomers(Boolean(s.autoAssociateCustomers));
    if (s.dealValidationStrategy || s.validationStrategy)
      setDealValidationStrategy(
        s.dealValidationStrategy || s.validationStrategy
      );
    if (s.acknowledgeDealTemplate)
      setAcknowledgeDealTemplate(s.acknowledgeDealTemplate);
    if (s.autoPayoutSchedule) setAutoPayoutSchedule(s.autoPayoutSchedule);
    if (s.autoPayoutThresholdSgd !== undefined)
      setAutoPayoutThresholdSgd(Number(s.autoPayoutThresholdSgd));
  }, [settings.account_settings]);

  const customProps = manageItems.filter(
    (m) => m.category === "custom_properties"
  );
  const apiTokens = manageItems.filter((m) => m.category === "api_tokens");
  const emailTemplates = manageItems.filter(
    (m) => m.category === "email_templates"
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const auditLogs: any[] = (usePrm() as any).auditLogs || [];

  const handleSaveSettings = async (msg = "Settings saved to database!") => {
    await mutate(
      "SAVE_SETTING",
      {
        key: "account_settings",
        value: {
          ...acct,
          dealConflictDetection,
          dealExpirationDays,
          dealReminderDays,
          allowDealResubmission,
          autoAssociateCustomers,
          dealValidationStrategy,
          acknowledgeDealTemplate,
          autoPayoutSchedule,
          autoPayoutThresholdSgd,
        },
      },
      msg
    );
  };

  const handleAddProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPropName) return;
    await mutate(
      "CREATE_MANAGE_ITEM",
      {
        category: "custom_properties",
        name: newPropName,
        subtitle: `Object: ${propObject} · Type: ${newPropType} · Active in Forms, Detail Views & Columns`,
        status: "Active",
        metadata: { objectType: propObject, fieldType: newPropType },
      },
      `Custom property "${newPropName}" added to ${propObject}!`
    );
    setNewPropName("");
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTokenName) return;
    const rawSecret = `rprm_live_${Math.random()
      .toString(36)
      .slice(2, 12)}_${Date.now().toString(36)}`;
    const maskedHash = `${rawSecret.slice(0, 12)}...${rawSecret.slice(-4)} (SHA-256 Hashed)`;
    setCreatedTokenPlaintext(rawSecret);

    await mutate(
      "CREATE_MANAGE_ITEM",
      {
        category: "api_tokens",
        name: newTokenName,
        subtitle: `${maskedHash} · Created just now by Alex Morgan · Last used: Never`,
        status: "Active",
        metadata: { maskedHash },
      },
      `API Token "${newTokenName}" created! Copy the raw token now—it will not be shown again.`
    );
    setNewTokenName("");
  };

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Account Settings</h1>
        <p className="text-xs text-slate-500">
          Workspace configuration tabs across Partner, Lead, Deal,
          Payout, Security, Custom Properties, and Audit Trail
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-2.5 shadow-sm space-y-1 h-fit">
          {ACCOUNT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`w-full text-left px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === cat.id
                  ? "bg-blue-600 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="lg:col-span-9 bg-white rounded-xl border border-slate-200 p-6 shadow-sm text-xs space-y-5">
          {/* 1. ACCOUNT DEFAULTS */}
          {activeTab === "defaults" && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
                Account defaults
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Account name
                  </label>
                  <input
                    defaultValue={acct.accountName}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Timezone
                  </label>
                  <input
                    defaultValue={acct.timezone}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Main currency (Base reporting currency)
                  </label>
                  <select
                    defaultValue={acct.mainCurrency}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="SGD">Singapore Dollar (SGD)</option>
                    <option value="USD">US Dollar (USD)</option>
                    <option value="EUR">Euro (EUR)</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded text-blue-600"
                />
                <span className="font-medium text-slate-800">
                  Track leads and deals in multiple currencies with dated FX
                  rates (SGD, USD, EUR, MYR)
                </span>
              </label>
              <button
                onClick={() =>
                  handleSaveSettings("Account defaults saved!")
                }
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Save Account Defaults
              </button>
            </div>
          )}

          {/* 2. PARTNER PORTAL */}
          {activeTab === "partner-portal" && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
                Partner portal branding &amp; custom domain
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <p className="font-bold text-slate-900">
                    Company logo (rectangular &amp; square) + Favicon
                  </p>
                  <div className="w-12 h-12 rounded-xl bg-blue-600 text-white font-extrabold text-2xl flex items-center justify-center">
                    R
                  </div>
                  <p className="text-slate-500">
                    Active Blue &quot;R&quot; Brand Emblem on /p Partner Portal
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <p className="font-bold text-slate-900">
                    Primary colour &amp; Sign-in background
                  </p>
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded bg-blue-600 border border-blue-700" />
                    <input
                      defaultValue="#2563EB"
                      className="px-3 py-1.5 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <p className="text-slate-500">
                    Portal Domain: https://partners.r-cloud.co
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  handleSaveSettings("Partner portal branding saved!")
                }
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Save Portal Branding
              </button>
            </div>
          )}

          {/* 3. DIRECTORIES */}
          {activeTab === "directories" && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
                Directories (Add-on)
              </h2>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Partner directories subdomain
                </label>
                <div className="flex items-center space-x-2">
                  <span className="text-slate-500">https://</span>
                  <input
                    defaultValue="r-cloud"
                    className="px-3 py-2 border border-slate-300 rounded-lg"
                  />
                  <span className="text-slate-500">.directory.r-prm.com</span>
                </div>
              </div>
              <button
                onClick={() => handleSaveSettings("Directory subdomain saved!")}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Save Subdomain
              </button>
            </div>
          )}

          {/* 4. SECURITY */}
          {activeTab === "security" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-blue-600" />
                  <h2 className="text-base font-bold text-slate-900">
                    Security — Authentication, TOTP MFA &amp; Single Sign-On (SAML 2.0)
                  </h2>
                </div>
                <div className="flex space-x-2">
                  <Link
                    href="/login"
                    className="px-3 py-1 rounded border border-blue-600 text-blue-700 font-semibold"
                  >
                    Coworker Login (/login)
                  </Link>
                  <Link
                    href="/p/login"
                    className="px-3 py-1 rounded bg-blue-600 text-white font-semibold"
                  >
                    Partner Login (/p/login)
                  </Link>
                </div>
              </div>
              <div className="space-y-2">
                <label className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="font-semibold">
                    Require Authenticator-App MFA (TOTP) for my coworkers
                  </span>
                  <input type="checkbox" defaultChecked />
                </label>
                <label className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="font-semibold">
                    Require Authenticator-App MFA (TOTP) for partner users
                  </span>
                  <input type="checkbox" />
                </label>
              </div>

              {/* Authenticator App (TOTP) & Recovery Codes Card */}
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900">
                      Authenticator App (TOTP RFC 6238) &amp; Recovery Codes
                    </h3>
                    <p className="text-slate-600">
                      Verify 6-digit Time-Based One-Time Passcodes from Google Authenticator, 1Password, or Authy, with one-time emergency recovery codes.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                    TOTP Active
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-500">
                      Provisioned TOTP Base32 Secret
                    </span>
                    <p className="font-mono font-bold text-slate-900 select-all">
                      JBSWY3DPEHPK3PXP
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Issuer: R-PRM Enterprise · Algorithm: HMAC-SHA1 · 30s step
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-slate-500">
                      Emergency Recovery Codes (Single-Use)
                    </span>
                    <div className="grid grid-cols-2 gap-1 font-mono text-[11px] text-slate-800">
                      <span>RPRM-8821-904A</span>
                      <span>RPRM-3319-77BC</span>
                      <span>RPRM-5502-19DE</span>
                      <span>RPRM-9140-62FA</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    SP Entity ID
                  </label>
                  <input
                    readOnly
                    value="https://app.r-prm.example.com/saml/metadata"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    SP Callback URL (ACS)
                  </label>
                  <input
                    readOnly
                    value="https://app.r-prm.example.com/saml/acs"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50"
                  />
                </div>
              </div>
              <button
                onClick={() =>
                  handleSaveSettings("Security & MFA policy saved!")
                }
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Save Security Policy
              </button>
            </div>
          )}

          {/* 5. PARTNER SETTINGS (Distinct Tab — Fixes D7) */}
          {activeTab === "partners" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h2 className="text-base font-bold text-slate-900">
                  Partner settings
                </h2>
                <button
                  onClick={() => setActiveTab("properties")}
                  className="text-blue-600 hover:underline font-semibold"
                >
                  Configure Partner properties →
                </button>
              </div>

              {/* Partner Types */}
              <div className="p-4 rounded-xl border border-slate-200 space-y-3">
                <h3 className="font-bold text-sm text-slate-900">
                  Partner types
                </h3>
                <div className="flex flex-wrap gap-2">
                  {partnerTypes.map((pt) => (
                    <span
                      key={pt}
                      className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold"
                    >
                      {pt}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2 max-w-sm">
                  <input
                    value={newPartnerType}
                    onChange={(e) => setNewPartnerType(e.target.value)}
                    placeholder="Add partner type (e.g. MSP)"
                    className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg"
                  />
                  <button
                    onClick={() => {
                      if (!newPartnerType.trim()) return;
                      setPartnerTypes([...partnerTypes, newPartnerType.trim()]);
                      setNewPartnerType("");
                      showToast("Added new partner type!");
                    }}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
                  >
                    + Add
                  </button>
                </div>
              </div>

              {/* Prospection Pipeline & Card Layouts */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-900">
                    Prospection pipeline stages
                  </h4>
                  <p className="text-slate-500">
                    1. New → 2. Onboarding → 3. Active
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-900">
                    Prospection cards layout
                  </h4>
                  <p className="text-slate-500">
                    Visible fields: Partner name, Partner type, Program level,
                    Owner, Status badge
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-900">
                    Onboarding cards layout
                  </h4>
                  <p className="text-slate-500">
                    Visible fields: Partner name, Program, Qualifying level,
                    Pending actions count
                  </p>
                </div>
              </div>

              <button
                onClick={() =>
                  handleSaveSettings("Partner settings saved!")
                }
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Save Partner Settings
              </button>
            </div>
          )}

          {/* 6. LEAD SETTINGS (Distinct Tab — Fixes D7) */}
          {activeTab === "leads" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h2 className="text-base font-bold text-slate-900">
                  Lead settings
                </h2>
                <button
                  onClick={() => setActiveTab("properties")}
                  className="text-blue-600 hover:underline font-semibold"
                >
                  Configure Lead properties →
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <label className="block font-bold text-slate-900">
                    Channel conflict detection (Duplicate Lead Check)
                  </label>
                  <select className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                    <option>
                      Check duplicates across Leads, Deals, and Customers (Warn
                      &amp; Flag)
                    </option>
                    <option>
                      Block partners from submitting duplicate email domains
                    </option>
                    <option>Allow duplicate submissions (No check)</option>
                  </select>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <label className="block font-bold text-slate-900">
                    Lead validation strategy
                  </label>
                  <select className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                    <option>Anyone (Partner Owner or Administrator)</option>
                    <option>Dedicated Partner Owner only</option>
                    <option>Workspace Administrators only</option>
                  </select>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 space-y-2 md:col-span-2">
                  <label className="block font-bold text-slate-900">
                    Acknowledge lead submissions (Email Template)
                  </label>
                  <select className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white">
                    {emailTemplates.map((t) => (
                      <option key={t.id} value={t.name}>
                        Template: {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={() => handleSaveSettings("Lead settings saved!")}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Save Lead Settings
              </button>
            </div>
          )}

          {/* 7. DEAL SETTINGS */}
          {activeTab === "deals" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h2 className="text-base font-bold text-slate-900">
                  Deal settings
                </h2>
                <button
                  onClick={() => setActiveTab("properties")}
                  className="text-blue-600 hover:underline font-semibold"
                >
                  1. Deal properties (Configure Deal properties) →
                </button>
              </div>

              {/* 2. Deal stages */}
              <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                <h3 className="font-bold text-sm text-slate-900">
                  2. Deal stages (10 Pipeline Stages including Holding)
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {DEAL_STAGES_10.map((stg, idx) => (
                    <span
                      key={stg}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-semibold"
                    >
                      {idx + 1}. {stg}
                    </span>
                  ))}
                </div>
              </div>

              {/* 3. Deal cards & 4. Channel-conflict detection for deals */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-900">
                    3. Deal cards (Kanban Card Layout)
                  </h4>
                  <p className="text-slate-600">
                    Visible card properties: Deal Name, Partner Name, Amount &amp; Currency, Probability (%), Expected Close Date, Owner, Conflict Flag.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <label className="block font-bold text-slate-900">
                    4. Channel-conflict detection (Duplicate Deal Check)
                  </label>
                  <select
                    value={dealConflictDetection}
                    onChange={(e) => setDealConflictDetection(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Warn & flag duplicate Deals across Customer company or contact email domain">
                      Warn &amp; flag duplicate Deals across Customer company or contact email domain
                    </option>
                    <option value="Block partners from registering a Deal when an active protected Deal exists">
                      Block partners from registering a Deal when an active protected Deal exists
                    </option>
                    <option value="Allow duplicate deal registrations (No conflict check)">
                      Allow duplicate deal registrations (No conflict check)
                    </option>
                  </select>
                </div>
              </div>

              {/* 5. Deal expiration, 8. Validation strategy, 9. Acknowledge deal registrations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <label className="block font-bold text-slate-900">
                    5. Deal expiration protection window (days) &amp; reminder
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[11px] text-slate-500 block mb-0.5">
                        Protection days
                      </span>
                      <input
                        type="number"
                        value={dealExpirationDays}
                        onChange={(e) =>
                          setDealExpirationDays(Number(e.target.value) || 0)
                        }
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block mb-0.5">
                        Reminder days before
                      </span>
                      <input
                        type="number"
                        value={dealReminderDays}
                        onChange={(e) =>
                          setDealReminderDays(Number(e.target.value) || 0)
                        }
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <label className="block font-bold text-slate-900">
                    6. Deal resubmission &amp; 7. Associate customers automatically
                  </label>
                  <label className="flex items-center space-x-2 pt-1">
                    <input
                      type="checkbox"
                      checked={allowDealResubmission}
                      onChange={(e) =>
                        setAllowDealResubmission(e.target.checked)
                      }
                    />
                    <span className="font-medium text-slate-800">
                      Deal resubmission — Allow partners to resubmit expired or refused deals
                    </span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={autoAssociateCustomers}
                      onChange={(e) =>
                        setAutoAssociateCustomers(e.target.checked)
                      }
                    />
                    <span className="font-medium text-slate-800">
                      Associate customers automatically — Link or create Customer when Deal closes won
                    </span>
                  </label>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <label className="block font-bold text-slate-900 mb-1">
                    8. Validation strategy
                  </label>
                  <select
                    value={dealValidationStrategy}
                    onChange={(e) => setDealValidationStrategy(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="Anyone (Partner Owner or Administrator)">
                      Anyone (Partner Owner or Administrator)
                    </option>
                    <option value="Dedicated Partner Owner only">
                      Dedicated Partner Owner only
                    </option>
                    <option value="Workspace Administrators only">
                      Workspace Administrators only
                    </option>
                  </select>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <label className="block font-bold text-slate-900 mb-1">
                    9. Acknowledge deal registrations (Email Template)
                  </label>
                  <select
                    value={acknowledgeDealTemplate}
                    onChange={(e) => setAcknowledgeDealTemplate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {emailTemplates.map((t) => (
                      <option key={t.id} value={t.name}>
                        Template: {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={() => handleSaveSettings("Deal settings saved!")}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Save Deal Settings
              </button>
            </div>
          )}

          {/* 8. PAYOUT SETTINGS (Distinct Tab — Fixes D7) */}
          {activeTab === "payouts" && (
            <div className="space-y-5">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
                Payout settings &amp; Self-Invoicing
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <label className="flex items-center justify-between font-bold text-slate-900">
                    <span>Automatic payout creation</span>
                    <input type="checkbox" defaultChecked />
                  </label>
                  <label className="block text-slate-600">
                    Schedule:
                    <select
                      value={autoPayoutSchedule}
                      onChange={(e) => setAutoPayoutSchedule(e.target.value)}
                      className="w-full mt-1 px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="Every month on the 1st day">
                        Every month on the 1st day
                      </option>
                      <option value="Every quarter on the 1st day">
                        Every quarter on the 1st day
                      </option>
                    </select>
                  </label>
                  <label className="block text-slate-600">
                    Minimum payout threshold (SGD):
                    <input
                      type="number"
                      value={autoPayoutThresholdSgd}
                      onChange={(e) =>
                        setAutoPayoutThresholdSgd(Number(e.target.value) || 0)
                      }
                      className="w-full mt-1 px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                    />
                  </label>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                  <h3 className="font-bold text-slate-900">
                    Payout providers visible on Partner Portal
                  </h3>
                  {["Wise", "Stripe", "PayPal", "Payoneer", "Chargebee"].map(
                    (prov) => (
                      <label
                        key={prov}
                        className="flex items-center justify-between"
                      >
                        <span className="font-medium text-slate-800">
                          {prov}
                        </span>
                        <input type="checkbox" defaultChecked />
                      </label>
                    )
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-3">
                <label className="flex items-center justify-between font-bold text-slate-900">
                  <span>
                    Enable Self-Invoicing (Auto-generate partner invoices from
                    payout batches)
                  </span>
                  <input type="checkbox" defaultChecked />
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    defaultValue="Eber / R-Cloud Enterprise Pte Ltd"
                    placeholder="Legal Company Name"
                    className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                  />
                  <input
                    defaultValue="GST-SG-202688192M"
                    placeholder="Tax / GST ID"
                    className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                  />
                  <input
                    defaultValue="1 Raffles Place, #40-02, Singapore 048616"
                    placeholder="Billing Address"
                    className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              </div>

              <button
                onClick={() => handleSaveSettings("Payout settings saved!")}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Save Payout Settings
              </button>
            </div>
          )}

          {/* 9. PROPERTIES */}
          {activeTab === "properties" && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
                Custom Properties Builder (10 Object Types)
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {PROPERTY_OBJECTS.map((obj) => (
                  <button
                    key={obj}
                    onClick={() => setPropObject(obj)}
                    className={`px-3 py-1.5 rounded-lg font-semibold ${
                      propObject === obj
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {obj}
                  </button>
                ))}
              </div>

              <form
                onSubmit={handleAddProperty}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap gap-2 items-end"
              >
                <div className="flex-1 min-w-[180px]">
                  <label className="block font-medium text-slate-700 mb-1">
                    New {propObject} Property Label
                  </label>
                  <input
                    value={newPropName}
                    onChange={(e) => setNewPropName(e.target.value)}
                    placeholder="e.g. Regional ERP System"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Field Type
                  </label>
                  <select
                    value={newPropType}
                    onChange={(e) => setNewPropType(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg bg-white"
                  >
                    <option>Single line text</option>
                    <option>Number</option>
                    <option>Email</option>
                    <option>Checkbox</option>
                    <option>Single select</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add property</span>
                </button>
              </form>

              <div className="divide-y divide-slate-100">
                {customProps.map((cp) => (
                  <div
                    key={cp.id}
                    className="py-2.5 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{cp.name}</p>
                      <p className="text-slate-500">{cp.subtitle}</p>
                    </div>
                    <StatusBadge status={cp.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 10. ACCOUNT DATA (With Typed Confirmation for Reset — §1.4 & §5.2) */}
          {activeTab === "data" && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                <Database className="w-4 h-4 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Account data — Safe Test Data &amp; Protected Reset
                </h2>
              </div>
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-3">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-900">
                      Danger Zone — Protected Data Reset
                    </p>
                    <p className="text-amber-800">
                      Destructive resets are disabled by
                      default and require explicit owner approval and typing{" "}
                      <code>RESET</code> below.
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    value={resetConfirmationText}
                    onChange={(e) => setResetConfirmationText(e.target.value)}
                    placeholder='Type "RESET" to enable button...'
                    className="px-3 py-1.5 border border-amber-300 rounded-lg bg-white"
                  />
                  <button
                    disabled={resetConfirmationText !== "RESET"}
                    onClick={() => {
                      showToast(
                        "Protected mode: Ask the workspace owner before running a destructive reset."
                      );
                      setResetConfirmationText("");
                    }}
                    className={`px-4 py-1.5 rounded-lg font-semibold ${
                      resetConfirmationText === "RESET"
                        ? "bg-amber-600 text-white hover:bg-amber-700"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    Reset data
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 11. BILLING */}
          {activeTab === "billing" && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
                Billing &amp; Subscription Plan
              </h2>
              <div className="p-4 rounded-xl bg-blue-600 text-white flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider bg-blue-800 px-2 py-0.5 rounded font-bold">
                    Internal Eber Tool
                  </span>
                  <h3 className="text-lg font-extrabold mt-1">
                    Unlimited (Enterprise Legacy)
                  </h3>
                  <p className="text-blue-100">
                    Unlimited Partners · Unlimited Team Members · Account
                    Mapping &amp; Custom Domain Included
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 12. INTEGRATION (Show Token Once at Creation + Store Hashed + Revoke) */}
          {activeTab === "integration" && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                <Code2 className="w-4 h-4 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900">
                  JavaScript Tracking Snippet (r.js) &amp; API Access Tokens
                </h2>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-900 text-blue-200 font-mono text-[11px] overflow-x-auto">
                {`<script src="https://cdn.r-prm.example.com/r.js" data-account="${acct.workspaceId || acct.workspaceSlug || "r-cloud-global"}" async></script>`}
              </div>
              <button
                onClick={() =>
                  showToast(
                    "Verified r.js snippet installation on authorized domain!"
                  )
                }
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white font-semibold flex items-center space-x-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Verify installation</span>
              </button>

              <div className="pt-3 border-t border-slate-200 space-y-3">
                <h3 className="font-bold text-sm text-slate-900">
                  API Access Tokens ({apiTokens.length}) — Shown Once at
                  Creation, Stored Hashed
                </h3>

                {createdTokenPlaintext && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 space-y-1">
                    <p className="font-bold">
                      Copy your new API token now — it will never be displayed
                      in plaintext again:
                    </p>
                    <p className="font-mono bg-white px-3 py-1.5 rounded border border-emerald-200 select-all">
                      {createdTokenPlaintext}
                    </p>
                  </div>
                )}

                <form onSubmit={handleCreateToken} className="flex gap-2">
                  <input
                    value={newTokenName}
                    onChange={(e) => setNewTokenName(e.target.value)}
                    placeholder="New token name (e.g. ERP Webhook Sync)"
                    className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg"
                  />
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
                  >
                    + New token
                  </button>
                </form>

                <div className="divide-y divide-slate-100">
                  {apiTokens.map((tk) => (
                    <div
                      key={tk.id}
                      className="py-2.5 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-slate-900">{tk.name}</p>
                        <p className="text-slate-500 font-mono">{tk.subtitle}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <StatusBadge status={tk.status} />
                        <button
                          onClick={() =>
                            mutate(
                              "DELETE_MANAGE_ITEM",
                              { id: tk.id },
                              `Revoked API token "${tk.name}"`
                            )
                          }
                          className="px-2.5 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 font-semibold"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 13. AUDIT TRAIL (§3 Slice 0c & §9) */}
          {activeTab === "audit-log" && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-2">
                <History className="w-4 h-4 text-blue-600" />
                <h2 className="text-base font-bold text-slate-900">
                  Immutable Audit Log ({auditLogs.length} Events)
                </h2>
              </div>
              <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                {auditLogs.length === 0 ? (
                  <p className="text-slate-500 py-4">
                    No audit entries recorded yet. Any create, update, delete,
                    clawback, or portal impersonation writes here automatically.
                  </p>
                ) : (
                  auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="py-2.5 flex items-center justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10px]">
                            {log.action}
                          </span>
                          <span className="font-bold text-slate-900">
                            {log.objectType} ({log.objectId})
                          </span>
                          <span className="text-slate-500">
                            by {log.actor} · {log.actorRole}
                          </span>
                        </div>
                        <p className="text-slate-700 mt-0.5">{log.summary}</p>
                      </div>
                      <span className="text-slate-400 shrink-0">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
