"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { usePrm } from "@/context/PrmContext";
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
    mutate,
    toast,
    globalModal,
    setGlobalModal,
    showToast,
  } = usePrm();

  const [openMenu, setOpenMenu] = useState<
    "partners" | "mapping" | "more" | "user" | "whatsnew" | "notifications" | "outbox" | "refer" | "beacon" | null
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
          {/* "R" Logo replacing Kiflo's red "K" */}
          <Link
            href="/dashboard"
            onClick={closeMenus}
            className="flex items-center space-x-2.5 mr-4 group"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-600 group-hover:bg-blue-700 transition-colors flex items-center justify-center text-white font-extrabold text-xl shadow-sm">
              R
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="font-bold text-slate-900 text-sm leading-tight tracking-tight">
                R-PRM
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

          {/* User / Workspace Menu (Alex · R-Cloud) */}
          <div className="relative">
            <button
              onClick={() => setOpenMenu(openMenu === "user" ? null : "user")}
              className="pl-2.5 pr-2 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 flex items-center space-x-2 text-xs font-medium text-slate-800"
            >
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                A
              </div>
              <div className="hidden sm:flex items-center space-x-1">
                <span className="font-semibold">Alex</span>
                <span className="text-slate-400">·</span>
                <span className="text-blue-700 font-medium">R-Cloud</span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {openMenu === "user" && (
              <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1.5 z-50">
                <div className="px-3.5 py-2 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-900">Alex Morgan</p>
                  <p className="text-[11px] text-slate-500">
                    Workspace: R-Cloud Enterprise
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
                <button
                  onClick={() => setOpenMenu("refer")}
                  className="w-full flex items-center space-x-2.5 px-3.5 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 text-left"
                >
                  <Gift className="w-4 h-4 text-blue-600" />
                  <span>Refer R-PRM</span>
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  onClick={() => {
                    closeMenus();
                    showToast("Signed out preview (Demo session remains active)");
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

      {/* Sent Emails / Outbox Slide-Over Drawer */}
      {openMenu === "outbox" && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 flex justify-end">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-blue-600 text-white">
              <div className="flex items-center space-x-2">
                <Mail className="w-5 h-5" />
                <div>
                  <h3 className="font-bold text-base">
                    Sent Emails Outbox ({sentEmails.length})
                  </h3>
                  <p className="text-[11px] text-blue-100">
                    Every Partner Invite, Notification &amp; Gmail SMTP delivery
                  </p>
                </div>
              </div>
              <button onClick={closeMenus}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between">
                <span className="text-blue-900 font-medium">
                  Want to send via real Gmail SMTP? Configure it in{" "}
                  <strong>Manage &gt; Email setup</strong>.
                </span>
                <Link
                  href="/portal"
                  onClick={closeMenus}
                  className="px-2.5 py-1 rounded bg-blue-600 text-white font-semibold shrink-0"
                >
                  Open Partner Portal
                </Link>
              </div>

              {sentEmails.length === 0 ? (
                <p className="text-slate-500 text-center py-8">
                  No emails sent yet. Register a new partner or test an email
                  template in Manage &gt; Email templates!
                </p>
              ) : (
                sentEmails.map((em) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  let meta: any = {};
                  try {
                    meta = JSON.parse(em.metadataJson || "{}");
                  } catch {
                    meta = {};
                  }
                  return (
                    <div
                      key={em.id}
                      className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10px]">
                          {meta.templateName || "System Email"}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {meta.deliveryMode || em.status}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900">
                        {em.name}
                      </h4>
                      <p className="text-slate-600 font-medium">
                        To: <span className="text-blue-700">{meta.to}</span>
                      </p>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 whitespace-pre-line">
                        {meta.body}
                      </div>
                      {meta.portalLink && (
                        <div className="pt-1">
                          <Link
                            href={meta.portalLink}
                            onClick={closeMenus}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                          >
                            <span>Accept Invite &amp; Open Partner Portal</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* What's New Slide-Over Drawer */}
      {openMenu === "whatsnew" && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-blue-600 text-white">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5" />
                <h3 className="font-bold text-base">What&apos;s New in R-PRM</h3>
              </div>
              <button onClick={closeMenus}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-4 text-sm">
              {[
                {
                  date: "Nov 2026",
                  tag: "AI & MCP",
                  title: "ChatGPT & Claude Partner Portal Assistants",
                  desc: "Partners can now draft joint business plans and summarize deal histories directly inside the portal.",
                },
                {
                  date: "Nov 2026",
                  tag: "Account Mapping",
                  title: "3×3 Real-Time Overlap Matrix & Co-Selling Collaborations",
                  desc: "Cross-reference your CRM Customers, Opportunities, and Prospects against partner rosters in one click.",
                },
                {
                  date: "Oct 2026",
                  tag: "Payouts",
                  title: "Automated Multi-Currency Threshold Payouts & Self-Invoicing",
                  desc: "Batch pending rewards into SGD, USD, EUR, or MYR settlement runs automatically.",
                },
              ].map((item, idx) => (
                <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">
                      {item.tag}
                    </span>
                    <span className="text-slate-500">{item.date}</span>
                  </div>
                  <h4 className="font-bold text-slate-900 mt-1">{item.title}</h4>
                  <p className="text-xs text-slate-600 mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Refer Modal */}
      {openMenu === "refer" && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg text-slate-900">Refer R-PRM</h3>
              <button onClick={closeMenus}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Invite another channel leader to R-PRM and earn SGD 500 in platform credits when they launch their partner portal.
            </p>
            <div className="flex items-center space-x-2">
              <input
                readOnly
                value="https://r-prm.example.com/invite?ref=r-cloud-alex"
                className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50"
              />
              <button
                onClick={() => {
                  showToast("Referral link copied to clipboard!");
                  closeMenus();
                }}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"
              >
                Copy Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL MODAL 1: Add a New Partner */}
      {globalModal === "add_partner" && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreatePartner}
            className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="px-6 py-4 bg-blue-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-base">Add a new partner</h3>
              <button type="button" onClick={() => setGlobalModal(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-sm">
              <div className="font-semibold text-xs uppercase tracking-wider text-blue-700">
                Partner details
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Partner name *
                </label>
                <input
                  required
                  value={partnerForm.name}
                  onChange={(e) =>
                    setPartnerForm({ ...partnerForm, name: e.target.value })
                  }
                  placeholder="e.g. CloudScale Asia Consulting"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Partner program
                  </label>
                  <select
                    value={partnerForm.programId}
                    onChange={(e) =>
                      setPartnerForm({ ...partnerForm, programId: e.target.value })
                    }
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                  >
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Country
                  </label>
                  <select
                    value={partnerForm.country}
                    onChange={(e) =>
                      setPartnerForm({ ...partnerForm, country: e.target.value })
                    }
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                  >
                    <option>Singapore</option>
                    <option>Malaysia</option>
                    <option>Australia</option>
                    <option>United Kingdom</option>
                    <option>United States</option>
                    <option>Japan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Language
                  </label>
                  <select
                    value={partnerForm.language}
                    onChange={(e) =>
                      setPartnerForm({ ...partnerForm, language: e.target.value })
                    }
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-xs"
                  >
                    <option>English</option>
                    <option>French</option>
                    <option>Japanese</option>
                    <option>Spanish</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 font-semibold text-xs uppercase tracking-wider text-blue-700">
                Main contact
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    First name *
                  </label>
                  <input
                    required
                    value={partnerForm.contactFirstName}
                    onChange={(e) =>
                      setPartnerForm({
                        ...partnerForm,
                        contactFirstName: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Last name *
                  </label>
                  <input
                    required
                    value={partnerForm.contactLastName}
                    onChange={(e) =>
                      setPartnerForm({
                        ...partnerForm,
                        contactLastName: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Email *
                  </label>
                  <input
                    required
                    type="email"
                    value={partnerForm.contactEmail}
                    onChange={(e) =>
                      setPartnerForm({
                        ...partnerForm,
                        contactEmail: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Job title
                  </label>
                  <input
                    value={partnerForm.contactJobTitle}
                    onChange={(e) =>
                      setPartnerForm({
                        ...partnerForm,
                        contactJobTitle: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Phone number
                  </label>
                  <input
                    value={partnerForm.contactPhone}
                    onChange={(e) =>
                      setPartnerForm({
                        ...partnerForm,
                        contactPhone: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
              <label className="flex items-center space-x-2 text-xs text-slate-700 pt-1">
                <input
                  type="checkbox"
                  checked={partnerForm.portalAccess}
                  onChange={(e) =>
                    setPartnerForm({
                      ...partnerForm,
                      portalAccess: e.target.checked,
                    })
                  }
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>
                  <strong>Access to R-PRM:</strong> This contact has access to the partner portal
                </span>
              </label>
            </div>
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setGlobalModal(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Create Partner
              </button>
            </div>
          </form>
        </div>
      )}

      {/* GLOBAL MODAL 2: Submit Lead / Share Lead */}
      {(globalModal === "submit_lead" || globalModal === "share_lead") && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateLead}
            className="bg-white rounded-xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="px-6 py-4 bg-blue-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-base">
                {globalModal === "share_lead" ? "Share lead with partner" : "Submit lead"}
              </h3>
              <button type="button" onClick={() => setGlobalModal(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3 max-h-[80vh] overflow-y-auto text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  {globalModal === "share_lead" ? "Assign to partner *" : "Source partner *"}
                </label>
                <select
                  value={leadForm.sourcePartnerName}
                  onChange={(e) =>
                    setLeadForm({ ...leadForm, sourcePartnerName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  {partners.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    First name *
                  </label>
                  <input
                    required
                    value={leadForm.firstName}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, firstName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Last name *
                  </label>
                  <input
                    required
                    value={leadForm.lastName}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, lastName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Company Name *
                  </label>
                  <input
                    required
                    value={leadForm.company}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, company: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Job title
                  </label>
                  <input
                    value={leadForm.jobTitle}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, jobTitle: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Email *
                  </label>
                  <input
                    required
                    type="email"
                    value={leadForm.email}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, email: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Mobile number
                  </label>
                  <input
                    value={leadForm.phone}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Country
                  </label>
                  <select
                    value={leadForm.country}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, country: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option>Singapore</option>
                    <option>Malaysia</option>
                    <option>Australia</option>
                    <option>United Kingdom</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Retail brand name
                  </label>
                  <input
                    value={leadForm.retailBrand}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, retailBrand: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Number of outlets
                  </label>
                  <input
                    type="number"
                    value={leadForm.outletsCount}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, outletsCount: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    POS Solution (If Any)
                  </label>
                  <input
                    value={leadForm.posSolution}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, posSolution: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Website / Social URL
                  </label>
                  <input
                    value={leadForm.website}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, website: e.target.value })
                    }
                    placeholder="https://"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Deadline
                  </label>
                  <input
                    type="date"
                    value={leadForm.deadline}
                    onChange={(e) =>
                      setLeadForm({ ...leadForm, deadline: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Feature Requirements / Remark:
                </label>
                <textarea
                  rows={2}
                  value={leadForm.remarks}
                  onChange={(e) =>
                    setLeadForm({ ...leadForm, remarks: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setGlobalModal(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                {globalModal === "share_lead" ? "Share Lead" : "Submit Lead"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* GLOBAL MODAL 3: 3-Step Register Deal Wizard */}
      {globalModal === "register_deal" && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateDeal}
            className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden"
          >
            <div className="px-6 py-4 bg-blue-600 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Register deal</h3>
                <p className="text-[11px] text-blue-100">
                  Step {dealStep} of 3:{" "}
                  {dealStep === 1
                    ? "Associated partner"
                    : dealStep === 2
                    ? "New deal"
                    : "Client information"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDealStep(1);
                  setGlobalModal(null);
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step Indicator */}
            <div className="px-6 pt-4 flex items-center space-x-2 text-xs">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`flex-1 h-1.5 rounded-full ${
                    s <= dealStep ? "bg-blue-600" : "bg-slate-200"
                  }`}
                />
              ))}
            </div>

            <div className="p-6 space-y-4 text-xs">
              {dealStep === 1 && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Select Associated Partner *
                  </label>
                  <select
                    value={dealForm.partnerName}
                    onChange={(e) =>
                      setDealForm({ ...dealForm, partnerName: e.target.value })
                    }
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm"
                  >
                    {partners.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name} ({p.qualifyingLevel})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {dealStep === 2 && (
                <>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Deal Name *
                    </label>
                    <input
                      required
                      value={dealForm.name}
                      onChange={(e) =>
                        setDealForm({ ...dealForm, name: e.target.value })
                      }
                      placeholder="e.g. ENT - Marina Hospitality Loyalty Cloud"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Total Amount *
                      </label>
                      <input
                        required
                        type="number"
                        value={dealForm.amount}
                        onChange={(e) =>
                          setDealForm({ ...dealForm, amount: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Currency
                      </label>
                      <select
                        value={dealForm.currency}
                        onChange={(e) =>
                          setDealForm({ ...dealForm, currency: e.target.value })
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
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Pipeline Stage
                      </label>
                      <select
                        value={dealForm.stage}
                        onChange={(e) =>
                          setDealForm({ ...dealForm, stage: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      >
                        <option>To Work On</option>
                        <option>Appointment Scheduled</option>
                        <option>Holding</option>
                        <option>Discovery Stage</option>
                        <option>Presentation Stage</option>
                        <option>Quotation Stage</option>
                        <option>Negotiation Stage</option>
                        <option>Closing Stage</option>
                        <option>Closed Won</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Subscription Plan
                      </label>
                      <select
                        value={dealForm.subscriptionPlan}
                        onChange={(e) =>
                          setDealForm({
                            ...dealForm,
                            subscriptionPlan: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      >
                        <option>Enterprise Multi-Region</option>
                        <option>Enterprise Annual</option>
                        <option>Growth Pro Annual</option>
                        <option>Starter Annual</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {dealStep === 3 && (
                <>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Client Company Name *
                    </label>
                    <input
                      required
                      value={dealForm.company}
                      onChange={(e) =>
                        setDealForm({ ...dealForm, company: e.target.value })
                      }
                      placeholder="e.g. Marina Bay Grand Holdings"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Primary Client Contact *
                      </label>
                      <input
                        required
                        value={dealForm.clientName}
                        onChange={(e) =>
                          setDealForm({ ...dealForm, clientName: e.target.value })
                        }
                        placeholder="e.g. Raymond Sterling"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Expected Close Date
                      </label>
                      <input
                        type="date"
                        value={dealForm.closeDate}
                        onChange={(e) =>
                          setDealForm({ ...dealForm, closeDate: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-between">
              {dealStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setDealStep((s) => (s === 3 ? 2 : 1))}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded-lg"
                >
                  Back
                </button>
              ) : (
                <div />
              )}
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setDealStep(1);
                    setGlobalModal(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  {dealStep < 3 ? "Next Step →" : "Register Deal"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
