"use client";

import React, { useState } from "react";
import { usePrm } from "@/context/PrmContext";
import { EntityListToolbar, StatusBadge } from "@/components/SharedEngines";
import { X } from "lucide-react";

export default function DataSourcesPage() {
  const { dataSources, partners, mutate } = usePrm();
  const [activeView, setActiveView] = useState("All");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const [form, setForm] = useState({
    name: "",
    sharedWith: "All Strategic Partners",
    type: "CSV Upload",
    accountType: "Customers & Prospects",
    partnerName: "Apex Cloud Solutions Pte Ltd",
    csvText:
      "Marina Bay Luxury Holdings, Prospect, Marina Bay Luxury Group, Customer\nSingTel Enterprise Cloud, Opportunity, SingTel Enterprise APAC, Customer",
  });

  const filtered = dataSources.filter(
    (ds) => !search || ds.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Parse CSV lines: YourAccountName, YourType, PartnerAccountName, PartnerType
    const csvAccounts = form.csvText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(",").map((s) => s.trim());
        return {
          accountName: parts[0] || "Imported Account",
          yourType: parts[1] || "Prospect",
          partnerName: form.partnerName,
          partnerAccountName: parts[2] || parts[0] || "Imported Account",
          partnerType: parts[3] || "Customer",
        };
      });

    await mutate(
      "CREATE_DATA_SOURCE",
      {
        ...form,
        csvAccounts,
      },
      `Imported data source "${form.name}" with ${csvAccounts.length} accounts & computed overlaps!`
    );
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
        primaryActionLabel="Add data source"
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
            className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden text-xs"
          >
            <div className="px-5 py-4 bg-blue-600 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                Add data source &amp; Compute Account Overlaps
              </h3>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Data source name *
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Q4 APAC Enterprise Target List (CSV)"
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
                <label className="block font-medium text-slate-700 mb-1">
                  CSV Account Rows (Your Account, Your Type, Partner Account,
                  Partner Type)
                </label>
                <textarea
                  rows={4}
                  value={form.csvText}
                  onChange={(e) =>
                    setForm({ ...form, csvText: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-[11px]"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Overlaps are automatically computed by matching normalized
                  company names &amp; domains.
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
                Import &amp; Compute Overlaps
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
