"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export interface PrmState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  programs: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  partners: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  teamMembers: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  leads: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deals: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customers: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transactions: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rewards: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payouts: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tasks: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  businessPlans: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  accounts: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  collaborations: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dataSources: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trackingLinks: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  manageItems: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  notes: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings: Record<string, any>;
}

interface PrmContextValue extends PrmState {
  loading: boolean;
  toast: string | null;
  showToast: (msg: string) => void;
  refresh: () => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mutate: (action: string, payload?: any, successMessage?: string) => Promise<any>;
  globalModal: "add_partner" | "submit_lead" | "share_lead" | "register_deal" | null;
  setGlobalModal: (m: "add_partner" | "submit_lead" | "share_lead" | "register_deal" | null) => void;
}

const emptyState: PrmState = {
  programs: [],
  partners: [],
  teamMembers: [],
  leads: [],
  deals: [],
  customers: [],
  transactions: [],
  rewards: [],
  payouts: [],
  tasks: [],
  businessPlans: [],
  accounts: [],
  collaborations: [],
  dataSources: [],
  trackingLinks: [],
  manageItems: [],
  notes: [],
  settings: {},
};

const PrmContext = createContext<PrmContextValue>({
  ...emptyState,
  loading: true,
  toast: null,
  showToast: () => {},
  refresh: async () => {},
  mutate: async () => {},
  globalModal: null,
  setGlobalModal: () => {},
});

export function PrmProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<PrmState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [globalModal, setGlobalModal] = useState<
    "add_partner" | "submit_lead" | "share_lead" | "register_deal" | null
  >(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/prm", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error("Failed to fetch PRM data", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const mutate = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (action: string, payload: any = {}, successMessage?: string) => {
      const res = await fetch("/api/prm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      const json = await res.json();
      await refresh();
      if (successMessage) {
        showToast(successMessage);
      }
      return json;
    },
    [refresh, showToast]
  );

  return (
    <PrmContext.Provider
      value={{
        ...data,
        loading,
        toast,
        showToast,
        refresh,
        mutate,
        globalModal,
        setGlobalModal,
      }}
    >
      {children}
    </PrmContext.Provider>
  );
}

export function usePrm() {
  return useContext(PrmContext);
}
