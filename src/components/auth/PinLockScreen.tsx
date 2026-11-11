"use client";

import React, { useState } from "react";
import { Lock, ShieldCheck, ArrowRight } from "lucide-react";

export function PinLockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;

    setLoading(true);
    setError(false);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      if (res.ok) {
        onUnlock();
      } else {
        setError(true);
        setPin("");
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-sm rounded-3xl border border-slate-800 bg-slate-900/80 p-8 backdrop-blur-xl shadow-2xl text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 shadow-lg shadow-cyan-500/20">
          <Lock className="h-8 w-8 text-white" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">Life Operations Center</h1>
        <p className="text-xs text-slate-400 mb-6">Enter your security PIN to access the synchronized operational dashboard.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => {
                setError(false);
                setPin(e.target.value);
              }}
              placeholder="Enter PIN (e.g. 5454)"
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3.5 text-center text-xl font-mono tracking-widest text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all"
              autoFocus
            />
            {error && <p className="mt-2 text-xs font-medium text-rose-400">Incorrect PIN. Please try again.</p>}
          </div>

          <button
            type="submit"
            disabled={loading || pin.length < 4}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 hover:from-cyan-400 hover:to-indigo-500 disabled:opacity-50 transition-all"
          >
            {loading ? "Verifying..." : "Unlock Dashboard"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>AES Protected Session</span>
        </div>
      </div>
    </div>
  );
}
