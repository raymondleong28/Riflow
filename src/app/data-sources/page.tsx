"use client";

import React, { useState } from "react";
import { usePrm } from "@/context/PrmContext";
import { EntityListToolbar, StatusBadge } from "@/components/SharedEngines";
import { X } from "lucide-react";

export default function DataSourcesPage() {
  const { dataSources, partners, mutate, showToast } = usePrm();
  const [activeView, setActiveView] = useState("All");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const [form, setForm] = useState({
    name: "",
    sharedWith: "All Strategic Partners",
    type: "CSV Upload",
    accountType: "Customers & Prospects",
    partnerName: "Apex Cloud Solutions Pte Ltd",
    eberCsv:
      "Marina Bay Luxury Holdings, marinabayluxury.example.com, Prospect, Alex Morgan\nSingTel Enterprise Cloud, singtelcloud.example.com, Opportunity, Alex Morgan\nVertex Logistics APAC, vertexlogistics.example.com, Customer, Sarah Chen",
    partnerCsv:
      "Marina Bay Luxury Group, marinabayluxury.example.com, Customer\nSingTel Enterprise Cloud, singtel-other.example.com, Customer\nUnmatched Partner Co, unmatched.example.com, Prospect",
  });

  const filtered = dataSources.filter(
    (ds) => !search || ds.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await mutate("UPLOAD_ACCOUNT_MAPPING_LISTS", {
      dataSourceName: form.name,
      partnerName: form.partnerName,
      eberCsv: form.eberCsv,
      partnerCsv: form.partnerCsv,
    });
    if (res?.ok) {
      showToast(
        `Imported "${form.name}" (${res.eberCount} Eber rows vs ${res.partnerCount} Partner rows) — found ${res.overlapsFound} overlap(s)!`
      );
    }
    setModalOpen(false);
    setForm({ ...form, name: "" });
  };

  return (
    <div>
      <EntityListToolbar
        title="Data sources"
        countLabel={`${filtered.length} sources`}
        views={["All"]}
        activeView={activeView}
        onSelectView={setActiveView}
        search={search}
        onSearchChange={setSearch}
        primaryActionLabel="Upload & match CSV lists"
        onPrimaryAction={() => setModalOpen(true)}
      />

      <div className="max-w-[1440px] mx-auto px-6 py-5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 whitespace-nowrap">
                <th className="py-3 px-4 font-semibold">Name</th>
                <th className="py-3 px-3 font-semibold">Status</th>
                <th className="py-3 px-3 font-semibold">Shared with</th>
                <th className="py-3 px-3 font-semibold">Type</th>
                <th className="py-3 px-3 font-semibold">Account type</th>
                <th className="py-3 px-3 font-semibold">Last imported date</th>
                <th className="py-3 px-4 font-semibold">Created by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 whitespace-nowrap">
              {filtered.map((ds) => (
                <tr key={ds.id} className="hover:bg-blue-50/40">
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {ds.name}
                  </td>
                  <td className="py-3 px-3">
                    <StatusBadge status={ds.status} />
                  </td>
                  <td className="py-3 px-3 text-blue-700 font-medium">
                    {ds.sharedWith}
                  </td>
                  <td className="py-3 px-3 text-slate-600">{ds.type}</td>
                  <td className="py-3 px-3 text-slate-700">{ds.accountType}</td>
                  <td className="py-3 px-3 text-slate-500">
                    {ds.lastImportedDate}
                  </td>
                  <td className="py-3 px-4 text-slate-600">{ds.createdBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden text-xs"
          >
            <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                Upload Eber &amp; Partner CSV Account Lists (Domain &amp; Name Matching)
              </h3>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Data source name *
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Q4 APAC Enterprise Account Match (CSV)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Type
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option>CSV Upload</option>
                    <option>CRM Connected</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Compare against Partner
                  </label>
                  <select
                    value={form.partnerName}
                    onChange={(e) =>
                      setForm({ ...form, partnerName: e.target.value })
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
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  1. Eber Account List CSV (Company Name, Domain, Type, Owner)
                </label>
                <textarea
                  rows={3}
                  value={form.eberCsv}
                  onChange={(e) =>
                    setForm({ ...form, eberCsv: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-[11px]"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  2. Partner Account List CSV (Company Name, Domain, Partner Type)
                </label>
                <textarea
                  rows={3}
                  value={form.partnerCsv}
                  onChange={(e) =>
                    setForm({ ...form, partnerCsv: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-[11px]"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Overlaps are computed automatically by matching normalized domains first and normalized company names second.
                </p>
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
              >
                Upload &amp; Compute Overlaps
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
