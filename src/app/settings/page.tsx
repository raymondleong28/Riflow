"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { usePrm } from "@/context/PrmContext";
import { StatusBadge } from "@/components/SharedEngines";

const PREF_TABS = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security" },
  { id: "notifications", label: "Notifications" },
  { id: "calendar", label: "Calendar" },
  { id: "connected-apps", label: "Connected apps" },
] as const;

export default function UserPreferencesRootPage() {
  const params = useParams();
  const initialTab = String(params?.tab || "profile");
  const { settings, mutate, showToast } = usePrm();
  const [activeTab, setActiveTab] = useState(initialTab);

  const prefs = settings.user_preferences || {
    firstName: "Alex",
    lastName: "Morgan",
    email: "alex@r-prm.example.com",
    jobTitle: "VP of Global Channels",
    phone: "+65 9100 2200",
    calendarLink: "https://cal.example.com/alex-morgan/partner-qbr",
    language: "English (US)",
    timezone: "Asia/Singapore (GMT+08:00)",
    googleCalendarConnected: true,
    notifications: {
      "New Lead Submitted by Partner": { inApp: true, email: true },
      "Shared Lead Accepted or Refused": { inApp: true, email: true },
      "New Deal Registered": { inApp: true, email: true },
      "Deal Stage Updated": { inApp: true, email: false },
      "Deal Expiring Soon": { inApp: true, email: true },
      "New Partner Application": { inApp: true, email: true },
      "Reward Pending Validation": { inApp: true, email: false },
      "Account Overlap Detected": { inApp: true, email: true },
    },
  };

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">User Preferences</h1>
        <p className="text-xs text-slate-500">
          Manage your personal profile, MFA security, notification matrix, calendar sync, and OAuth apps
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-2.5 shadow-sm space-y-1 h-fit">
          {PREF_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`w-full text-left px-3.5 py-2 rounded-lg text-xs font-semibold ${
                activeTab === t.id
                  ? "bg-blue-600 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="lg:col-span-9 bg-white rounded-xl border border-slate-200 p-6 shadow-sm text-xs space-y-5">
          {activeTab === "profile" && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
                Profile
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    First name
                  </label>
                  <input
                    defaultValue={prefs.firstName}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Last name
                  </label>
                  <input
                    defaultValue={prefs.lastName}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Job title
                  </label>
                  <input
                    defaultValue={prefs.jobTitle}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Phone number
                  </label>
                  <input
                    defaultValue={prefs.phone}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Calendar link
                  </label>
                  <input
                    defaultValue={prefs.calendarLink}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Timezone
                  </label>
                  <input
                    defaultValue={prefs.timezone}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <button
                onClick={() =>
                  mutate(
                    "SAVE_SETTING",
                    { key: "user_preferences", value: prefs },
                    "User profile preferences saved!"
                  )
                }
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Save Profile
              </button>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
                Security — Password &amp; Authenticator MFA
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="password"
                  placeholder="Current password"
                  className="px-3 py-2 border border-slate-300 rounded-lg"
                />
                <input
                  type="password"
                  placeholder="New password"
                  className="px-3 py-2 border border-slate-300 rounded-lg"
                />
                <input
                  type="password"
                  placeholder="Confirm password"
                  className="px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <button
                onClick={() => showToast("Password & MFA settings verified")}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Update Password
              </button>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
                Notifications Matrix (In-App vs Email)
              </h2>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600 bg-slate-50">
                    <th className="py-2.5 px-3">Event</th>
                    <th className="py-2.5 px-3 text-center">In-App</th>
                    <th className="py-2.5 px-3 text-center">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Object.entries(prefs.notifications || {}).map(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ([evt, val]: [string, any]) => (
                      <tr key={evt}>
                        <td className="py-2.5 px-3 font-medium text-slate-800">
                          {evt}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            defaultChecked={val.inApp}
                            onChange={() =>
                              showToast(`Updated In-App alert for "${evt}"`)
                            }
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            defaultChecked={val.email}
                            onChange={() =>
                              showToast(`Updated Email alert for "${evt}"`)
                            }
                          />
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "calendar" && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
                Google Calendar Integration
              </h2>
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">
                    Google Calendar (alex@r-prm.example.com)
                  </p>
                  <p className="text-slate-600">
                    Automatically logs meetings onto Partner, Lead, and Deal
                    activity timelines.
                  </p>
                </div>
                <StatusBadge status="Connected" />
              </div>
            </div>
          )}

          {activeTab === "connected-apps" && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
                Connected OAuth Applications
              </h2>
              {[
                "HubSpot CRM OAuth 2.0 Connector",
                "Slack Workspace Bot (#channel-wins)",
                "Google Workspace Calendar & SSO",
              ].map((app) => (
                <div
                  key={app}
                  className="p-3.5 rounded-xl border border-slate-200 flex items-center justify-between"
                >
                  <span className="font-bold text-slate-900">{app}</span>
                  <StatusBadge status="Active" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
