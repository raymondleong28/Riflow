"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { usePrm } from "@/context/PrmContext";
import { AppShellDrawersAndModals } from "./AppShellModals";
import {
  ChevronDown,
  Bell,
  HelpCircle,
  Sparkles,
  MoreHorizontal,
  Users,
  UserPlus,
  Kanban,
  GitBranch,
  Layers,
  Share2,
  Database,
  Briefcase,
  Building2,
  Receipt,
  CheckSquare,
  FileSpreadsheet,
  Award,
  Wallet,
  Gift,
  Sliders,
  Settings,
  UserCog,
  LogOut,
  X,
  Check,
  Mail,
  ExternalLink,
} from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    programs,
    partners,
    manageItems,
    settings,
    session,
    mutate,
    toast,
    globalModal,
    setGlobalModal,
    showToast,
  } = usePrm();

  const acct = settings?.account_settings || {};
  const brandName = acct.accountName || "R-PRM";
  const brandLogoText =
    acct.logoText || (brandName.charAt(0) || "R").toUpperCase();
  const brandColor = acct.primaryColor || "#2563EB";
  const userName = session?.name || "Administrator";
  const userFirstName = userName.split(" ")[0] || userName;
  const userInitial = (userFirstName.charAt(0) || "A").toUpperCase();

  const [openMenu, setOpenMenu] = useState<
    "partners" | "mapping" | "more" | "user" | "whatsnew" | "notifications" | "outbox" | "beacon" | null
  >(null);

  const sentEmails = manageItems.filter((m) => m.category === "sent_emails");

  // Add Partner Modal State
  const [partnerForm, setPartnerForm] = useState({
    name: "",
    programId: "prog-strategic",
    country: "Singapore",
    language: "English",
    contactFirstName: "",
    contactLastName: "",
    contactEmail: "",
    contactJobTitle: "",
    contactPhone: "",
    portalAccess: true,
  });

  // Submit / Share Lead Modal State
  const [leadForm, setLeadForm] = useState({
    sourcePartnerName: "Apex Cloud Solutions Pte Ltd",
    firstName: "",
    lastName: "",
    company: "",
    jobTitle: "",
    email: "",
    phone: "",
    country: "Singapore",
    retailBrand: "",
    outletsCount: "5",
    website: "",
    posSolution: "CloudPOS Pro",
    remarks: "",
    deadline: "2026-12-31",
  });

  // 3-Step Register Deal Wizard State
  const [dealStep, setDealStep] = useState<1 | 2 | 3>(1);
  const [dealForm, setDealForm] = useState({
    partnerName: "Apex Cloud Solutions Pte Ltd",
    name: "",
    amount: "24000",
    currency: "SGD",
    stage: "Discovery Stage",
    dealType: "New Business",
    subscriptionPlan: "Enterprise Annual",
    closeDate: "2027-01-31",
    comment: "",
    clientName: "",
    company: "",
    assignedContact: "Jordan Lee",
  });

  const closeMenus = () => setOpenMenu(null);

  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    const prog = programs.find((p) => p.id === partnerForm.programId);
    await mutate(
      "CREATE_PARTNER",
      {
        ...partnerForm,
        programName: prog?.name || "R-Cloud Strategic Solution Partners",
      },
      `Partner "${partnerForm.name}" created with portal access!`
    );
    setGlobalModal(null);
    setPartnerForm({
      name: "",
      programId: "prog-strategic",
      country: "Singapore",
      language: "English",
      contactFirstName: "",
      contactLastName: "",
      contactEmail: "",
      contactJobTitle: "",
      contactPhone: "",
      portalAccess: true,
    });
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    const isShared = globalModal === "share_lead";
    await mutate(
      "CREATE_LEAD",
      {
        ...leadForm,
        source: isShared ? "Shared" : "Partner Portal",
      },
      isShared
        ? `Lead "${leadForm.firstName} ${leadForm.lastName}" shared with ${leadForm.sourcePartnerName}`
        : `Lead "${leadForm.firstName} ${leadForm.lastName}" submitted!`
    );
    setGlobalModal(null);
  };

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dealStep < 3) {
      setDealStep((s) => (s === 1 ? 2 : 3));
      return;
    }
    await mutate(
      "CREATE_DEAL",
      dealForm,
      `Deal "${dealForm.name}" registered for ${dealForm.partnerName}!`
    );
    setDealStep(1);
    setGlobalModal(null);
  };

  const isActive = (prefixes: string[]) =>
    prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));

  // D12 Fix (§4.4 & §4.6): Partner portal (/p/*), public forms (/forms/*), and login screens (/login)
  // have their own dedicated layouts and NEVER display the Admin navigation header!
  const isStandaloneSurface =
    pathname === "/setup" ||
    pathname.startsWith("/setup/") ||
    pathname === "/login" ||
    pathname === "/p" ||
    pathname.startsWith("/p/") ||
    pathname === "/portal" ||
    pathname.startsWith("/portal/") ||
    pathname.startsWith("/forms/");

  if (isStandaloneSurface) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        <main className="flex-1">{children}</main>
        {toast && (
          <div className="fixed bottom-6 right-5 z-50 bg-blue-700 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center space-x-2 text-sm font-medium">
            <Check className="w-4 h-4" />
            <span>{toast}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Global Navigation Bar (Blue Theme + "R" Emblem Logo) */}
      <header className="sticky top-0 z-40 h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-1">
          {/* Brand Emblem Logo */}
          <Link
            href="/dashboard"
            onClick={closeMenus}
            className="flex items-center space-x-2.5 mr-4 group"
          >
            <div
              style={{ backgroundColor: brandColor }}
              className="w-9 h-9 rounded-lg transition-colors flex items-center justify-center text-white font-extrabold text-xl shadow-sm"
            >
              {brandLogoText}
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="font-bold text-slate-900 text-sm leading-tight tracking-tight">
                {brandName}
              </span>
              <span className="text-[10px] font-medium text-blue-600 uppercase tracking-wider">
                Partner Cloud
              </span>
            </div>
          </Link>

          {/* Home */}
          <Link
            href="/dashboard"
            onClick={closeMenus}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive(["/dashboard"])
                ? "bg-blue-50 text-blue-700"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Home
          </Link>

          {/* Partners Dropdown */}
          <div className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === "partners" ? null : "partners")}
              className={`px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-1 transition-colors ${
                isActive([
                  "/partners",
                  "/team-members",
                  "/partner-prospection",
                  "/partner-onboarding",
                ])
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span>Partners</span>
              <ChevronDown className="w-4 h-4 opacity-70" />
            </button>
            {openMenu === "partners" && (
              <div className="absolute left-0 mt-1.5 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1.5 z-50">
                <Link
                  href="/partners/views/all"
                  onClick={closeMenus}
                  className="flex items-center space-x-2.5 px-3.5 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>Partners</span>
                </Link>
                <Link
                  href="/team-members/views/all"
                  onClick={closeMenus}
                  className="flex items-center space-x-2.5 px-3.5 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  <UserPlus className="w-4 h-4 text-blue-600" />
                  <span>Team Members</span>
                </Link>
                <Link
                  href="/partner-prospection/views/all"
                  onClick={closeMenus}
                  className="flex items-center space-x-2.5 px-3.5 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  <Kanban className="w-4 h-4 text-blue-600" />
                  <span>Prospection</span>
                </Link>
                <Link
                  href="/partner-onboarding/9"
                  onClick={closeMenus}
                  className="flex items-center space-x-2.5 px-3.5 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  <GitBranch className="w-4 h-4 text-blue-600" />
                  <span>Onboarding</span>
                </Link>
              </div>
            )}
          </div>

          {/* Account Mapping Dropdown */}
          <div className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === "mapping" ? null : "mapping")}
              className={`px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-1 transition-colors ${
                isActive([
                  "/account-mapping-overview",
                  "/accounts",
                  "/overlaps",
                  "/collaborations",
                  "/data-sources",
                ])
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span>Account Mapping</span>
              <ChevronDown className="w-4 h-4 opacity-70" />
            </button>
            {openMenu === "mapping" && (
              <div className="absolute left-0 mt-1.5 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1.5 z-50">
                <Link
                  href="/account-mapping-overview"
                  onClick={closeMenus}
                  className="flex items-center space-x-2.5 px-3.5 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>Overview</span>
                </Link>
                <Link
                  href="/accounts/views/all"
                  onClick={closeMenus}
                  className="flex items-center space-x-2.5 px-3.5 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>Accounts</span>
                </Link>
                <Link
                  href="/overlaps/views/all"
                  onClick={closeMenus}
                  className="flex items-center space-x-2.5 px-3.5 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  <GitBranch className="w-4 h-4 text-blue-600" />
                  <span>Overlaps</span>
                </Link>
                <Link
                  href="/collaborations/views/all"
                  onClick={closeMenus}
                  className="flex items-center space-x-2.5 px-3.5 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  <Share2 className="w-4 h-4 text-blue-600" />
                  <span>Collaborations</span>
                </Link>
                <Link
                  href="/data-sources"
                  onClick={closeMenus}
                  className="flex items-center space-x-2.5 px-3.5 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  <Database className="w-4 h-4 text-blue-600" />
                  <span>Data sources</span>
                </Link>
              </div>
            )}
          </div>

          {/* Leads */}
          <Link
            href="/leads/views/all"
            onClick={closeMenus}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive(["/leads"])
                ? "bg-blue-50 text-blue-700"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Leads
          </Link>

          {/* "..." Overflow Menu (9 Modules) */}
          <div className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === "more" ? null : "more")}
              className={`px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-1 transition-colors ${
                isActive([
                  "/deals",
                  "/customers",
                  "/transactions",
                  "/tasks",
                  "/business-plans",
                  "/programs",
                  "/payouts",
                  "/rewards",
                  "/manage",
                ])
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
              title="More modules"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            {openMenu === "more" && (
              <div className="absolute left-0 mt-1.5 w-60 bg-white rounded-lg shadow-lg border border-slate-200 py-1.5 z-50">
                <Link
                  href="/deals/views/all"
                  onClick={closeMenus}
                  className="flex items-center space-x-2.5 px-3.5 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  <Briefcase className="w-4 h-4 text-blue-600" />
                  <span>Deals</span>
                </Link>
                <Link
                  href="/customers/views/all"
                  onClick={closeMenus}
                  className="flex items-center space-x-2.5 px-3.5 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>Customers</span>
                </Link>
                <Link
                  href="/transactions/views/all"
                  onClick={closeMenus}
                  className="flex items-center space-x-2.5 px-3.5 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  <Receipt className="w-4 h-4 text-blue-600" />
                  <span>Transactions</span>
                </Link>
                <Link
                  href="/tasks/views/all"
                  onClick={closeMenus}
                  className="flex items-center space-x-2.5 px-3.5 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                  <span>Tasks</span>
                </Link>
                <Link
                  href="/business-plans/views/all"
                  onClick={closeMenus}
                  className="flex items-center space-x-2.5 px-3.5 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                  <span>Business Plans</span>
                </Link>
                <Link
                  href="/programs/views/all"
                  onClick={closeMenus}
                  className="flex items-center space-x-2.5 px-3.5 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  <Award className="w-4 h-4 text-blue-600" />
                  <span>Programs</span>
                </Link>
                <Link
                  href="/payouts/views/all"
                  onClick={closeMenus}
                  className="flex items-center space-x-2.5 px-3.5 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  <Wallet className="w-4 h-4 text-blue-600" />
                  <span>Payouts</span>
                </Link>
                <Link
                  href="/rewards/views/all"
                  onClick={closeMenus}
                  className="flex items-center space-x-2.5 px-3.5 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  <Gift className="w-4 h-4 text-blue-600" />
                  <span>Rewards</span>
                </Link>
                <div className="my-1 border-t border-slate-100" />
                <Link
                  href="/manage"
                  onClick={closeMenus}
                  className="flex items-center space-x-2.5 px-3.5 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                >
                  <Sliders className="w-4 h-4 text-blue-600" />
                  <span>Manage</span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right Utility Controls */}
        <div className="flex items-center space-x-2">
          {/* Sent Emails Outbox / Partner Portal Switcher */}
          <button
            onClick={() => setOpenMenu(openMenu === "outbox" ? null : "outbox")}
            className="relative px-2.5 py-1.5 rounded-md text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 flex items-center space-x-1.5"
            title="View Sent Emails & Partner Invite Links"
          >
            <Mail className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden md:inline">Sent Emails</span>
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded-full">
              {sentEmails.length}
            </span>
          </button>

          {/* What's new */}
          <button
            onClick={() => setOpenMenu(openMenu === "whatsnew" ? null : "whatsnew")}
            className="relative px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-700 hover:bg-slate-100 flex items-center space-x-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden md:inline">What&apos;s new</span>
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded-full">
              10
            </span>
          </button>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() =>
                setOpenMenu(openMenu === "notifications" ? null : "notifications")
              }
              className="relative p-2 rounded-md text-slate-600 hover:bg-slate-100"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute -top-0.5 -right-0.5 px-1.5 py-0.2 text-[10px] font-bold bg-blue-600 text-white rounded-full">
                14
              </span>
            </button>
            {openMenu === "notifications" && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Notifications (14 Unread)
                  </span>
                  <button
                    onClick={() => {
                      showToast("All notifications marked as read");
                      closeMenus();
                    }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto text-xs">
                  <div
                    onClick={() => {
                      closeMenus();
                      router.push("/deals/views/all");
                    }}
                    className="p-2 rounded-lg bg-blue-50/70 hover:bg-blue-100/60 cursor-pointer"
                  >
                    <p className="font-semibold text-slate-800">
                      New Deal Registered by Apex Cloud
                    </p>
                    <p className="text-slate-600 mt-0.5">
                      ENT - Vertex Department Stores Omnichannel (SGD 36,000)
                    </p>
                  </div>
                  <div
                    onClick={() => {
                      closeMenus();
                      router.push("/leads/views/all");
                    }}
                    className="p-2 rounded-lg bg-blue-50/70 hover:bg-blue-100/60 cursor-pointer"
                  >
                    <p className="font-semibold text-slate-800">
                      Lead Pending Validation
                    </p>
                    <p className="text-slate-600 mt-0.5">
                      Nadia Khoury · Velvet &amp; Vine Boutique Retail
                    </p>
                  </div>
                  <div
                    onClick={() => {
                      closeMenus();
                      router.push("/rewards/views/all");
                    }}
                    className="p-2 rounded-lg hover:bg-slate-100 cursor-pointer"
                  >
                    <p className="font-semibold text-slate-800">
                      4 Pending Rewards Awaiting Approval
                    </p>
                    <p className="text-slate-500 mt-0.5">
                      Totaling SGD 10,544 across 3 partners
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Help ? */}
          <Link
            href="/help"
            onClick={closeMenus}
            className="p-2 rounded-md text-slate-600 hover:bg-slate-100"
            title="Help & Documentation"
          >
            <HelpCircle className="w-4 h-4" />
          </Link>

          {/* User / Workspace Menu */}
          <div className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === "user" ? null : "user")}
              className="pl-2.5 pr-2 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 flex items-center space-x-2 text-xs font-medium text-slate-800"
            >
              <div
                style={{ backgroundColor: brandColor }}
                className="w-6 h-6 rounded-full text-white flex items-center justify-center font-bold text-xs"
              >
                {userInitial}
              </div>
              <div className="hidden sm:flex items-center space-x-1">
                <span className="font-semibold">{userFirstName}</span>
                <span className="text-slate-400">·</span>
                <span className="text-blue-700 font-medium">{brandName}</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {openMenu === "user" && (
              <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1.5 z-50">
                <div className="px-3.5 py-2 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-900">{userName}</p>
                  <p className="text-[11px] text-slate-500">
                    Workspace: {brandName}
                  </p>
                </div>
                <Link
                  href="/account"
                  onClick={closeMenus}
                  className="flex items-center space-x-2.5 px-3.5 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  <Settings className="w-4 h-4 text-blue-600" />
                  <span>Account Settings</span>
                </Link>
                <Link
                  href="/settings"
                  onClick={closeMenus}
                  className="flex items-center space-x-2.5 px-3.5 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                >
                  <UserCog className="w-4 h-4 text-blue-600" />
                  <span>User Preferences</span>
                </Link>
                <div className="my-1 border-t border-slate-100" />
                <button
                  onClick={async () => {
                    closeMenus();
                    await fetch("/api/auth", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "logout" }),
                    });
                    window.location.href = "/login";
                  }}
                  className="w-full flex items-center space-x-2.5 px-3.5 py-2 text-sm text-slate-600 hover:bg-slate-100 text-left"
                >
                  <LogOut className="w-4 h-4 text-slate-500" />
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1">{children}</main>

      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed bottom-16 right-5 z-50 bg-blue-700 text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center space-x-2 text-sm font-medium animate-fade-in">
          <Check className="w-4 h-4" />
          <span>{toast}</span>
        </div>
      )}

      {/* Floating Bottom-Right Help Beacon Button */}
      <div className="fixed bottom-4 right-4 z-40">
        {openMenu === "beacon" && (
          <div className="mb-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-blue-600 text-white p-3.5 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm">R-PRM Support Beacon</h4>
                <p className="text-[11px] text-blue-100">
                  Instant docs, API guides &amp; partner help
                </p>
              </div>
              <button onClick={() => setOpenMenu(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3.5 space-y-2 text-xs">
              <Link
                href="/help"
                onClick={closeMenus}
                className="block p-2 rounded border border-slate-200 hover:border-blue-500 hover:bg-blue-50 font-medium text-slate-800"
              >
                Open Full Help Center &amp; Guides →
              </Link>
              <Link
                href="/account/integration"
                onClick={closeMenus}
                className="block p-2 rounded border border-slate-200 hover:border-blue-500 hover:bg-blue-50 font-medium text-slate-800"
              >
                JS Tracking Snippet &amp; API Tokens →
              </Link>
            </div>
          </div>
        )}
        <button
          onClick={() => setOpenMenu(openMenu === "beacon" ? null : "beacon")}
          className="px-4 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-lg flex items-center space-x-1.5 transition-transform active:scale-95"
        >
          <HelpCircle className="w-4 h-4" />
          <span>Help</span>
        </button>
      </div>

      <AppShellDrawersAndModals
        openMenu={openMenu}
        closeMenus={closeMenus}
        showToast={showToast}
        sentEmails={sentEmails}
        globalModal={globalModal}
        setGlobalModal={setGlobalModal}
        programs={programs}
        partners={partners}
        partnerForm={partnerForm}
        setPartnerForm={setPartnerForm}
        handleCreatePartner={handleCreatePartner}
        leadForm={leadForm}
        setLeadForm={setLeadForm}
        handleCreateLead={handleCreateLead}
        dealStep={dealStep}
        setDealStep={setDealStep}
        dealForm={dealForm}
        setDealForm={setDealForm}
        handleCreateDeal={handleCreateDeal}
      />
    </div>
  );
}
