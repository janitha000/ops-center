"use client";

import React, { useState, useEffect } from "react";
import { X, Check, ExternalLink, Copy, Scale, Flame, KeyRound } from "lucide-react";

interface GoogleFitModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWeightKg: number;
  targetWeightKg: number;
  currentCaloriesExpended: number;
  targetCaloriesExpended: number;
  googleFitConnected: boolean;
  onSaved: () => void;
}

export function GoogleFitModal({
  isOpen,
  onClose,
  currentWeightKg,
  targetWeightKg,
  currentCaloriesExpended,
  targetCaloriesExpended,
  googleFitConnected,
  onSaved,
}: GoogleFitModalProps) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [hasClientSecret, setHasClientSecret] = useState(false);
  const [redirectUri, setRedirectUri] = useState("https://ops-center-psi.vercel.app/api/ops/biometrics/google-fit/callback");
  const [weightInput, setWeightInput] = useState(String(currentWeightKg));
  const [targetWeightInput, setTargetWeightInput] = useState(String(targetWeightKg));
  const [expendedInput, setExpendedInput] = useState(String(currentCaloriesExpended));
  const [targetExpendedInput, setTargetExpendedInput] = useState(String(targetCaloriesExpended));
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setWeightInput(String(currentWeightKg));
    setTargetWeightInput(String(targetWeightKg));
    setExpendedInput(String(currentCaloriesExpended));
    setTargetExpendedInput(String(targetCaloriesExpended));
    setStatusMsg(null);

    fetch("/api/ops/biometrics/google-fit")
      .then((r) => r.json())
      .then((data) => {
        if (data.clientId) setClientId(data.clientId);
        if (data.hasClientSecret) setHasClientSecret(true);
        if (data.redirectUri) setRedirectUri(data.redirectUri);
      })
      .catch(() => {});
  }, [isOpen, currentWeightKg, targetWeightKg, currentCaloriesExpended, targetCaloriesExpended]);

  if (!isOpen) return null;

  const handleCopyRedirect = () => {
    navigator.clipboard.writeText(redirectUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveSettings = async (andAuthorize = false) => {
    if (andAuthorize) {
      setConnecting(true);
    } else {
      setSaving(true);
    }
    setStatusMsg(null);

    try {
      const payload: Record<string, any> = {
        targetWeightKg: parseFloat(targetWeightInput) || 72.0,
        targetCaloriesExpended: parseInt(targetExpendedInput, 10) || 2200,
        dailyEntry: {
          weightKg: parseFloat(weightInput) || currentWeightKg,
          caloriesExpended: parseInt(expendedInput, 10) || currentCaloriesExpended,
        },
      };

      if (clientId.trim()) payload.clientId = clientId.trim();
      if (clientSecret.trim()) payload.clientSecret = clientSecret.trim();

      const res = await fetch("/api/ops/biometrics/google-fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStatusMsg(data.error || "Failed to save settings");
        setSaving(false);
        setConnecting(false);
        return;
      }

      if (andAuthorize) {
        if (data.authUrl) {
          window.location.href = data.authUrl;
          return;
        } else {
          setStatusMsg("Please enter your Google OAuth Client ID and Client Secret first.");
          setConnecting(false);
          return;
        }
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setStatusMsg(err?.message || "Network error");
    } finally {
      setSaving(false);
      setConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono">
      <div className="bg-[#031211] border border-teal-500/40 rounded-md w-full max-w-md shadow-[0_0_30px_rgba(20,184,166,0.2)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#0d3b38] bg-[#041d1b]">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-teal-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-teal-300">
              Google Fit OAuth &amp; Biometric Sync
            </h3>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                googleFitConnected
                  ? "bg-emerald-950 text-emerald-400 border border-emerald-700/60"
                  : "bg-amber-950/80 text-amber-300 border border-amber-700/60"
              }`}
            >
              {googleFitConnected ? "GFIT CONNECTED" : "SETUP REQUIRED"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#0d3b38]/50 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[82vh] overflow-y-auto text-[11px]">
          {/* Section 1: Google Cloud OAuth 2.0 Credentials (Approach A) */}
          <div className="bg-[#020b0a] border border-[#0d3b38] rounded p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                1. Google Fit OAuth 2.0 (OKOK &amp; Samsung Health)
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
              In <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-teal-400 underline">Google Cloud Console</a>, enable the <strong>Fitness API</strong> and create an OAuth 2.0 Web Client with this Redirect URI:
            </p>

            {/* Redirect URI Copy Box */}
            <div className="flex items-center gap-1.5 bg-[#041816] border border-[#0d3b38] px-2 py-1.5 rounded text-[9.5px] text-teal-200">
              <span className="truncate flex-1 select-all">{redirectUri}</span>
              <button
                type="button"
                onClick={handleCopyRedirect}
                className="px-1.5 py-0.5 rounded bg-teal-900/60 hover:bg-teal-800 text-teal-300 flex items-center gap-1 shrink-0"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>

            <div className="space-y-2 pt-1">
              <div>
                <label className="block text-[9px] uppercase text-slate-400 mb-1">
                  Google OAuth Client ID
                </label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="xxxx.apps.googleusercontent.com"
                  className="w-full bg-[#041816] border border-[#0d3b38] focus:border-teal-400 rounded px-2.5 py-1.5 text-slate-200 text-[11px] outline-none"
                />
              </div>

              <div>
                <label className="block text-[9px] uppercase text-slate-400 mb-1">
                  Google OAuth Client Secret {hasClientSecret && <span className="text-emerald-400">(Saved)</span>}
                </label>
                <input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={hasClientSecret ? "•••••••••••••••••••• (leave blank to keep)" : "GOCSPX-..."}
                  className="w-full bg-[#041816] border border-[#0d3b38] focus:border-teal-400 rounded px-2.5 py-1.5 text-slate-200 text-[11px] outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleSaveSettings(true)}
              disabled={connecting}
              className="w-full mt-1 py-2 px-3 rounded bg-teal-600 hover:bg-teal-500 text-white font-bold uppercase tracking-wider text-[10px] flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(20,184,166,0.3)] transition-all disabled:opacity-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>{connecting ? "Redirecting to Google..." : googleFitConnected ? "Reconnect Google Fit OAuth" : "Authorize & Connect Google Fit"}</span>
            </button>
          </div>

          {/* Section 2: Today's Weight & Expenditure + Targets */}
          <div className="bg-[#020b0a] border border-[#0d3b38] rounded p-3 space-y-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5" />
              2. Today&apos;s Telemetry &amp; Targets
            </span>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[9px] uppercase text-slate-400 mb-1">
                  Today Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  className="w-full bg-[#041816] border border-[#0d3b38] focus:border-teal-400 rounded px-2.5 py-1.5 text-teal-300 font-bold text-xs outline-none"
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase text-slate-400 mb-1">
                  Target Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={targetWeightInput}
                  onChange={(e) => setTargetWeightInput(e.target.value)}
                  className="w-full bg-[#041816] border border-[#0d3b38] focus:border-teal-400 rounded px-2.5 py-1.5 text-slate-200 text-xs outline-none"
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase text-slate-400 mb-1">
                  Today Expenditure (kcal)
                </label>
                <input
                  type="number"
                  step="10"
                  value={expendedInput}
                  onChange={(e) => setExpendedInput(e.target.value)}
                  className="w-full bg-[#041816] border border-[#0d3b38] focus:border-teal-400 rounded px-2.5 py-1.5 text-amber-300 font-bold text-xs outline-none"
                />
              </div>
              <div>
                <label className="block text-[9px] uppercase text-slate-400 mb-1">
                  Daily Burn Goal (kcal)
                </label>
                <input
                  type="number"
                  step="50"
                  value={targetExpendedInput}
                  onChange={(e) => setTargetExpendedInput(e.target.value)}
                  className="w-full bg-[#041816] border border-[#0d3b38] focus:border-teal-400 rounded px-2.5 py-1.5 text-slate-200 text-xs outline-none"
                />
              </div>
            </div>
          </div>

          {statusMsg && (
            <div className="p-2 rounded bg-rose-950/70 border border-rose-700 text-rose-300 text-[10px]">
              {statusMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-[#0d3b38] bg-[#041d1b]">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-[#0d3b38] text-slate-400 hover:text-white text-[10px] uppercase font-bold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSaveSettings(false)}
            disabled={saving}
            className="px-3.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] uppercase font-bold shadow-[0_0_10px_rgba(16,185,129,0.3)] disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Telemetry"}
          </button>
        </div>
      </div>
    </div>
  );
}
