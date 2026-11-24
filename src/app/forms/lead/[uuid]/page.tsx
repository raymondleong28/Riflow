"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { usePrm } from "@/context/PrmContext";
import { CheckCircle2 } from "lucide-react";

export default function PublicPartnerLeadFormPage() {
  const params = useParams();
  const uuid = String(params?.uuid || "prt-1");
  const { partners, mutate } = usePrm();

  const partner =
    partners.find((p) => p.id === uuid || p.name === uuid) || partners[0];

  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    company: "",
    jobTitle: "",
    email: "",
    phone: "",
    country: "Singapore",
    retailBrand: "",
    outletsCount: "3",
    posSolution: "CloudPOS Pro",
    remarks: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await mutate(
      "CREATE_LEAD",
      {
        ...form,
        source: "Public Partner Lead Form",
        sourcePartnerId: partner?.id || uuid,
        sourcePartnerName: partner?.name || "Apex Cloud Solutions Pte Ltd",
        assignedPartner: partner?.name || "Apex Cloud Solutions Pte Ltd",
        assignedContact: partner
          ? `${partner.contactFirstName} ${partner.contactLastName}`
          : "Partner Representative",
      },
      `Lead submitted and attributed to ${partner?.name || uuid}!`
    );
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-100 py-12 px-4 flex items-center justify-center">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-xl border border-slate-200 overflow-hidden text-xs">
        <div className="p-6 bg-blue-600 text-white flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-white text-blue-700 font-extrabold text-xl flex items-center justify-center">
            R
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider bg-blue-800 px-2 py-0.5 rounded font-bold">
              Public Referral Lead Intake Form
            </span>
            <h1 className="text-lg font-extrabold mt-1">
              Referred by {partner?.name || "Authorized R-Cloud Partner"}
            </h1>
          </div>
        </div>

        {submitted ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h2 className="text-base font-bold text-slate-900">
              Thank you! Your inquiry has been registered.
            </h2>
            <p className="text-slate-600">
              Automatically attributed to{" "}
              <strong>{partner?.name || uuid}</strong> in R-PRM.
            </p>
            <button
              onClick={() => setSubmitted(false)}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold"
            >
              Submit Another Lead
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  First Name *
                </label>
                <input
                  required
                  value={form.firstName}
                  onChange={(e) =>
                    setForm({ ...form, firstName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Last Name *
                </label>
                <input
                  required
                  value={form.lastName}
                  onChange={(e) =>
                    setForm({ ...form, lastName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Company Name *
                </label>
                <input
                  required
                  value={form.company}
                  onChange={(e) =>
                    setForm({ ...form, company: e.target.value })
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
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Country
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
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Outlets Count
                </label>
                <input
                  type="number"
                  value={form.outletsCount}
                  onChange={(e) =>
                    setForm({ ...form, outletsCount: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Requirements / Notes
              </label>
              <textarea
                rows={3}
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow"
            >
              Submit Referral Inquiry
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
