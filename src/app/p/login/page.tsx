"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default function PartnerPortalLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showDevLogins, setShowDevLogins] = useState(false);

  React.useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => setShowDevLogins(Boolean(d?.showDevLogins)))
      .catch(() => setShowDevLogins(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identityType: "partner",
          email,
          password,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Partner sign-in failed");
        setSubmitting(false);
        return;
      }
      window.location.href = "/p";
    } catch (err) {
      setError(String(err));
      setSubmitting(false);
    }
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

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-semibold flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-3.5">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Partner Work Email *
            </label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@partner-company.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Password *
            </label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-sm"
          >
            {submitting ? "Signing in..." : "Sign in to Partner Portal"}
          </button>
        </form>

        {showDevLogins && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
            <p className="font-bold text-slate-800">
              Local Environment Partner Logins (Role assigned by database):
            </p>
            <p>
              • Apex Cloud (Platinum Manager):{" "}
              <code>jordan.lee@apexcloud.example.com</code>
            </p>
            <p>
              • Apex Cloud (Sales Rep):{" "}
              <code>darren.koh@apexcloud.example.com</code>
            </p>
            <p>
              • Vanguard (Stakeholder):{" "}
              <code>sophia@vanguardmatrix.example.com</code>
            </p>
            <p>
              • Password: configured via <code>SEED_PARTNER_PASSWORD</code> in <code>.env</code>
            </p>
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <Link
            href="/forms/apply/prog-strategic"
            className="text-blue-600 font-semibold hover:underline"
          >
            Apply to Become a Partner →
          </Link>
          <Link href="/login" className="text-slate-400 hover:text-slate-600">
            Coworker Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
