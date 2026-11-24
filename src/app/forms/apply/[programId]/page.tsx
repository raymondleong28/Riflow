"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { usePrm } from "@/context/PrmContext";
import { CheckCircle2, ShieldCheck } from "lucide-react";

export default function PublicPartnerApplicationFormPage() {
  const params = useParams();
  const programId = String(params?.programId || "prog-strategic");
  const { programs, mutate } = usePrm();

  const program =
    programs.find((p) => p.id === programId) || programs[0];

  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    companyWebsite: "https://",
    companyPhone: "+65 ",
    industry: "Cloud & SaaS Consulting",
    country: "Singapore",
    timezone: "Asia/Singapore (GMT+08:00)",
    contactFirstName: "",
    contactLastName: "",
    contactEmail: "",
    contactJobTitle: "VP of Partnerships",
    preferredContactMethod: "Email",
    linkedInUrl: "https://linkedin.com/company/",
    howHeard: "Customer Referral",
    reasonForInterest:
      "Expanding omnichannel loyalty & POS consulting practice in APAC.",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await mutate(
      "CREATE_PARTNER",
      {
        name: form.companyName,
        programId: program?.id || "prog-strategic",
        programName: program?.name || "R-Cloud Strategic Solution Partners",
        country: form.country,
        contactFirstName: form.contactFirstName,
        contactLastName: form.contactLastName,
        contactEmail: form.contactEmail,
        contactJobTitle: form.contactJobTitle,
        contactPhone: form.companyPhone,
        companyWebsite: form.companyWebsite,
        industry: form.industry,
        status: "Pending",
        onboardingStatus: "Not started",
        prospectionStage: "New",
        portalAccess: false, // Granted only upon admin acceptance (§4.6)
      },
      `Partner application for "${form.companyName}" submitted for review!`
    );
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4 flex items-center justify-center">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-xl border border-slate-200 overflow-hidden text-xs">
        <div className="p-6 bg-blue-600 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white text-blue-700 font-extrabold text-xl flex items-center justify-center">
              R
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider bg-blue-800 px-2 py-0.5 rounded font-bold">
                Public Partner Program Application
              </span>
              <h1 className="text-lg font-extrabold mt-1">
                Apply to {program?.name || "R-Cloud Partner Program"}
              </h1>
            </div>
          </div>
          <Link
            href="/p/login"
            className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white font-semibold"
          >
            Existing Partner Sign In
          </Link>
        </div>

        {submitted ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h2 className="text-base font-bold text-slate-900">
              Application Received!
            </h2>
            <p className="text-slate-600 max-w-md mx-auto">
              We have sent an acknowledgment receipt email to{" "}
              <strong>{form.contactEmail}</strong>. Once our channel team
              approves your application, you will receive a time-limited
              activation link to access your Partner Portal.
            </p>
            <div className="pt-2">
              <Link
                href={`/programs/${program?.id || "prog-strategic"}`}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold inline-block"
              >
                Review in Admin Applications Queue →
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center space-x-2 text-blue-900">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                <strong>Data Safety Policy (§4.6):</strong> Bank payout details
                are never collected on the public application form; they are
                collected securely inside your Partner Portal after acceptance.
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Registered Company Name *
                </label>
                <input
                  required
                  value={form.companyName}
                  onChange={(e) =>
                    setForm({ ...form, companyName: e.target.value })
                  }
                  placeholder="e.g. Pacific Cloud Consulting Pte Ltd"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Company Website *
                </label>
                <input
                  required
                  value={form.companyWebsite}
                  onChange={(e) =>
                    setForm({ ...form, companyWebsite: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Business Industry
                </label>
                <input
                  value={form.industry}
                  onChange={(e) =>
                    setForm({ ...form, industry: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Country &amp; Timezone
                </label>
                <select
                  value={form.country}
                  onChange={(e) =>
                    setForm({ ...form, country: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option>Singapore</option>
                  <option>Malaysia</option>
                  <option>Australia</option>
                  <option>United Kingdom</option>
                  <option>United States</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Main Contact First Name *
                </label>
                <input
                  required
                  value={form.contactFirstName}
                  onChange={(e) =>
                    setForm({ ...form, contactFirstName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Main Contact Last Name *
                </label>
                <input
                  required
                  value={form.contactLastName}
                  onChange={(e) =>
                    setForm({ ...form, contactLastName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Work Email *
                </label>
                <input
                  required
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) =>
                    setForm({ ...form, contactEmail: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  value={form.companyPhone}
                  onChange={(e) =>
                    setForm({ ...form, companyPhone: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Role / Job Title
                </label>
                <input
                  value={form.contactJobTitle}
                  onChange={(e) =>
                    setForm({ ...form, contactJobTitle: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Social Profile (LinkedIn / FB / IG)
                </label>
                <input
                  value={form.linkedInUrl}
                  onChange={(e) =>
                    setForm({ ...form, linkedInUrl: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Reason for interest &amp; How you heard about us
              </label>
              <textarea
                rows={2}
                value={form.reasonForInterest}
                onChange={(e) =>
                  setForm({ ...form, reasonForInterest: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow"
            >
              Submit Partner Application
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
