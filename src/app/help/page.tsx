"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Search, BookOpen, Code2, ShieldCheck, Layers } from "lucide-react";

export default function HelpPage() {
  const [q, setQ] = useState("");

  const guides = [
    {
      title: "Getting Started with Partner Programs & Tier Levels",
      category: "Programs",
      desc: "Configure Silver, Gold, and Platinum commission structures, requirements, and role permissions.",
      href: "/programs/views/all",
      icon: BookOpen,
    },
    {
      title: "3×3 Account Mapping & Co-Selling Overlaps",
      category: "Account Mapping",
      desc: "Sync your CRM or upload CSV account rosters to spot mutual customer/prospect overlaps.",
      href: "/account-mapping-overview",
      icon: Layers,
    },
    {
      title: "Installing the r.js Referral Tracking Snippet & API Tokens",
      category: "Developers",
      desc: "Embed referral tracking on your marketing site and authenticate REST webhooks.",
      href: "/account/integration",
      icon: Code2,
    },
    {
      title: "Automating Multi-Currency Commission Rewards & Payouts",
      category: "Finance",
      desc: "Validate pending rewards and generate batch settlements in SGD, USD, EUR, or MYR.",
      href: "/payouts/views/all",
      icon: ShieldCheck,
    },
  ].filter(
    (g) =>
      !q ||
      `${g.title} ${g.desc} ${g.category}`
        .toLowerCase()
        .includes(q.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <div className="bg-gradient-to-r from-blue-700 to-blue-600 rounded-2xl p-8 text-white shadow-lg space-y-4">
        <h1 className="text-2xl font-extrabold">
          Need help Alex? We got you — R-PRM Knowledge Base
        </h1>
        <p className="text-xs text-blue-100">
          Search step-by-step partner management guides, API documentation, and onboarding checklists
        </p>
        <div className="relative max-w-xl">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search articles, e.g. Deal Registration, Account Mapping, r.js..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs text-slate-900 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {guides.map((g) => {
          const Icon = g.icon;
          return (
            <Link
              key={g.title}
              href={g.href}
              className="bg-white rounded-xl border border-slate-200 hover:border-blue-500 p-5 shadow-sm transition-all flex items-start space-x-3.5"
            >
              <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
                <Icon className="w-5 h-5" />
              </div>
              <div className="text-xs space-y-1">
                <span className="text-[10px] font-bold uppercase text-blue-700">
                  {g.category}
                </span>
                <h3 className="font-bold text-sm text-slate-900">{g.title}</h3>
                <p className="text-slate-600 leading-relaxed">{g.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
