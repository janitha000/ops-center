"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Mail,
  X,
  Send,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

interface EmailDigestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DigestType = "daily" | "monthly";

interface PreviewResponse {
  success: boolean;
  type: DigestType;
  subject: string;
  html: string;
  decisionsCount?: number;
  error?: string;
}

interface SendResponse {
  success: boolean;
  mocked?: boolean;
  messageId?: string;
  subject?: string;
  to?: string;
  error?: string;
}

export function EmailDigestModal({ isOpen, onClose }: EmailDigestModalProps) {
  const [digestType, setDigestType] = useState<DigestType>("daily");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [recipient, setRecipient] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendResponse | null>(null);

  const fetchPreview = useCallback(async (type: DigestType) => {
    setLoadingPreview(true);
    setPreviewError(null);
    setSendResult(null);
    try {
      const res = await fetch(`/api/ops/email/preview?type=${type}`, {
        cache: "no-store",
      });
      const data: PreviewResponse = await res.json();
      if (!res.ok || !data.success) {
        setPreviewError(data.error || `Failed to load ${type} digest preview.`);
        setPreview(null);
      } else {
        setPreview(data);
      }
    } catch (err) {
      setPreviewError(
        err instanceof Error ? err.message : "Network error loading digest preview."
      );
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) {
        fetchPreview(digestType);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, digestType, fetchPreview]);

  const handleSendNow = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch("/api/ops/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: digestType,
          ...(recipient.trim() ? { to: recipient.trim() } : {}),
        }),
      });
      const data: SendResponse = await res.json();
      setSendResult(data);
    } catch (err) {
      setSendResult({
        success: false,
        error: err instanceof Error ? err.message : "Failed to send email digest.",
      });
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-5">
      <div className="w-full max-w-4xl max-h-[90vh] bg-[#090b0e] border border-[#1e2633] border-t border-t-white/15 rounded-md shadow-2xl flex flex-col overflow-hidden">
        {/* ── MODAL HEADER ── */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#06080b] border-b border-[#161b22]">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-cyan-400" />
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-100">
              EXECUTIVE OPS MAIL DIGEST // PREVIEW &amp; DISPATCH
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-sm bg-[#0d1117] hover:bg-[#161b22] border border-[#1e2633] text-slate-400 hover:text-white"
            aria-label="Close modal"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* ── TABS & RELOAD ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 bg-[#080b10] border-b border-[#161b22] font-mono text-[10px]">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setDigestType("daily")}
              className={`px-3 py-1 rounded-sm font-bold border transition-colors ${
                digestType === "daily"
                  ? "bg-amber-600 text-slate-950 border-amber-400"
                  : "bg-[#0d1117] text-slate-400 hover:text-slate-200 border-[#1e2633]"
              }`}
            >
              DAILY EXECUTIVE DIGEST
            </button>
            <button
              onClick={() => setDigestType("monthly")}
              className={`px-3 py-1 rounded-sm font-bold border transition-colors ${
                digestType === "monthly"
                  ? "bg-indigo-600 text-white border-indigo-400"
                  : "bg-[#0d1117] text-slate-400 hover:text-slate-200 border-[#1e2633]"
              }`}
            >
              MONTHLY EXECUTIVE REPORT
            </button>
          </div>

          <div className="flex items-center gap-2">
            {preview?.decisionsCount !== undefined && (
              <span className="px-2 py-0.5 rounded-sm bg-cyan-950/80 border border-cyan-800/70 text-cyan-300 font-bold flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5" />
                {preview.decisionsCount} SIGNALS EMBEDDED
              </span>
            )}
            <button
              onClick={() => fetchPreview(digestType)}
              disabled={loadingPreview}
              className="px-2 py-1 rounded-sm bg-[#0d1117] hover:bg-[#161b22] border border-[#1e2633] text-slate-300 flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${loadingPreview ? "animate-spin text-cyan-400" : ""}`} />
              <span>REFRESH</span>
            </button>
          </div>
        </div>

        {/* ── SUBJECT LINE BAR ── */}
        <div className="px-4 py-2 bg-[#06080b] border-b border-[#161b22] font-mono text-[10px] flex items-center gap-2">
          <span className="text-slate-500 uppercase font-bold shrink-0">SUBJECT:</span>
          <span className="text-slate-200 font-semibold truncate">
            {loadingPreview
              ? "Rendering executive telemetry digest..."
              : preview?.subject || "—"}
          </span>
        </div>

        {/* ── HTML EMAIL PREVIEW AREA ── */}
        <div className="flex-1 min-h-[340px] bg-[#040608] p-3 overflow-hidden flex flex-col">
          {loadingPreview ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 font-mono text-xs text-slate-400">
              <RefreshCw className="h-5 w-5 text-cyan-400 animate-spin" />
              <span>COMPILING {digestType.toUpperCase()} TELEMETRY DIGEST...</span>
            </div>
          ) : previewError ? (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="bg-rose-950/60 border border-rose-800 rounded-sm p-4 max-w-md font-mono text-xs text-rose-200 flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold uppercase mb-1">Preview Unavailable</div>
                  <div className="text-[11px] text-rose-300/90">{previewError}</div>
                </div>
              </div>
            </div>
          ) : preview?.html ? (
            <iframe
              title="Executive Ops Digest Preview"
              srcDoc={preview.html}
              sandbox=""
              className="w-full flex-1 min-h-[360px] rounded-sm border border-[#1e2633] bg-white"
            />
          ) : null}
        </div>

        {/* ── SEND FORM & DELIVERY STATUS FOOTER ── */}
        <form
          onSubmit={handleSendNow}
          className="px-4 py-3 bg-[#06080b] border-t border-[#161b22] space-y-2 font-mono"
        >
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Optional recipient email (defaults to OPS_ALERT_EMAIL)..."
              className="flex-1 bg-[#0d1117] border border-[#1e2633] focus:border-cyan-500 rounded-sm px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={sending || loadingPreview}
              className="px-4 py-1.5 rounded-sm bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {sending ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>DISPATCHING...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>SEND DIGEST NOW</span>
                </>
              )}
            </button>
          </div>

          {sendResult && (
            <div
              className={`px-3 py-2 rounded-sm border text-[10px] flex items-center justify-between gap-2 ${
                sendResult.success
                  ? sendResult.mocked
                    ? "bg-amber-950/60 border-amber-700/80 text-amber-200"
                    : "bg-emerald-950/60 border-emerald-700/80 text-emerald-200"
                  : "bg-rose-950/60 border-rose-700/80 text-rose-200"
              }`}
            >
              <div className="flex items-center gap-2">
                {sendResult.success ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                )}
                <span>
                  {sendResult.success
                    ? sendResult.mocked
                      ? `Mocked Delivery (RESEND_API_KEY not configured) · Target: ${
                          sendResult.to || "default"
                        }`
                      : `Sent via Resend to ${sendResult.to || "configured recipient"}`
                    : `Delivery failed: ${sendResult.error || "Unknown error"}`}
                </span>
              </div>
              {sendResult.messageId && (
                <span className="text-[9px] text-slate-400 shrink-0">
                  ID: {sendResult.messageId}
                </span>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
