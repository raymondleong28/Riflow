"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield } from "lucide-react";

export default function CoworkerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("alex@r-prm.example.com");
  const [password, setPassword] = useState("••••••••••••");
  const [role, setRole] = useState("Admin");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identityType: "coworker",
        email,
        role,
      }),
    });
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl space-y-5 text-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-extrabold text-xl flex items-center justify-center">
            R
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900">
              Sign In to R-PRM (Coworker Admin)
            </h1>
            <p className="text-slate-500">
              Internal Channel &amp; Partnership Workspace
            </p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-3.5">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Coworker Email
            </label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Password
            </label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Coworker Role (§3 Slice 0c)
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            >
              <option value="Admin">Administrator</option>
              <option value="Member">Member (Partner Account Manager)</option>
            </select>
          </div>
          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm"
          >
            Sign in
          </button>
        </form>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-slate-500">
          <span className="flex items-center space-x-1">
            <Shield className="w-3.5 h-3.5 text-blue-600" />
            <span>SAML 2.0 SSO Enabled</span>
          </span>
          <Link href="/p/login" className="text-blue-600 font-semibold">
            Partner Portal Login →
          </Link>
        </div>
      </div>
    </div>
  );
}
