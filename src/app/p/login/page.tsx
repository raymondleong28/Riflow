"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";

export default function PartnerPortalLoginPage() {
  const router = useRouter();
  const { partners } = usePrm();
  const [partnerId, setPartnerId] = useState("prt-1");
  const [role, setRole] = useState("Manager");

  const selectedPartner =
    partners.find((p) => p.id === partnerId) || partners[0];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identityType: "partner",
        email:
          selectedPartner?.contactEmail || "jordan.lee@apexcloud.example.com",
        partnerId: selectedPartner?.id || "prt-1",
        role,
      }),
    });
    router.push(`/p?partnerId=${selectedPartner?.id || "prt-1"}&role=${role}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl space-y-5 text-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-extrabold text-xl flex items-center justify-center">
            R
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-blue-600">
              https://partners.r-cloud.co
            </span>
            <h1 className="text-lg font-extrabold text-slate-900">
              Partner Portal Sign In
            </h1>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-3.5">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Select Partner Account
            </label>
            <select
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            >
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.contactEmail})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Partner User Role (§3 Slice 0c &amp; §4.3)
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            >
              <option value="Manager">Manager (Main Contact)</option>
              <option value="SalesRep">Sales Rep</option>
              <option value="Stakeholder">Stakeholder (View-Only)</option>
            </select>
          </div>
          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm"
          >
            Enter Partner Portal
          </button>
        </form>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <Link
            href="/forms/apply/prog-strategic"
            className="text-blue-600 font-semibold hover:underline"
          >
            Apply to Become a Partner →
          </Link>
          <Link href="/login" className="text-slate-400 hover:text-slate-600">
            Coworker Admin
          </Link>
        </div>
      </div>
    </div>
  );
}
