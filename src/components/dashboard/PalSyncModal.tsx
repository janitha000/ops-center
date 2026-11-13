"use client";

import React, { useState } from "react";
import { X, Copy, Check, RefreshCw, Upload, AlertCircle } from "lucide-react";

interface PalSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  lastPalSync?: string;
  syncedFrom?: string;
  onSyncSuccess?: () => void;
}

export function PalSyncModal({
  isOpen,
  onClose,
  lastPalSync,
  syncedFrom,
  onSyncSuccess,
}: PalSyncModalProps) {
  const [copied, setCopied] = useState(false);
  const [pastedJson, setPastedJson] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!isOpen) return null;

  const appOrigin = typeof window !== "undefined" && window.location.origin && !window.location.origin.includes("localhost")
    ? window.location.origin
    : "https://ops-center-psi.vercel.app";

  const bookmarkletCode = `javascript:(async()=>{try{let items=[];const tbl=document.querySelector('table');if(tbl){const ths=Array.from(tbl.querySelectorAll('thead th,thead td')).map(t=>t.innerText.replace(/[\\u2191\\u2193\\s]+/g,' ').trim().toLowerCase());const sIdx=ths.findIndex(t=>t.startsWith('stock')||t.startsWith('symbol'));const qIdx=ths.findIndex(t=>t.startsWith('qty')||t.startsWith('quantity')||t.startsWith('shares'));const aIdx=ths.findIndex(t=>t.startsWith('avg'));const cIdx=ths.findIndex(t=>t.startsWith('cost'));const pIdx=ths.findIndex(t=>t==='price'||t.startsWith('price'));const vIdx=ths.findIndex(t=>t==='value'||t.startsWith('value'));const pnlIdx=ths.findIndex(t=>t==='p&l'||t.startsWith('p&l'));const rIdx=ths.findIndex(t=>t.startsWith('return'));const parseN=el=>{if(!el)return 0;const n=parseFloat(el.innerText.replace(/[,\\sRsLKR%\\u2191\\u2193+]/g,''));return isNaN(n)?0:n;};Array.from(tbl.querySelectorAll('tbody tr')).forEach(tr=>{const tds=Array.from(tr.querySelectorAll('td'));if(tds.length<2)return;const sCell=tds[sIdx!==-1?sIdx:0];const lines=(sCell.innerText||'').split('\\n').map(s=>s.trim()).filter(Boolean);const sym=(lines.find(l=>/^[A-Z]{2,6}(\\.[NX]\\d{4})?$/.test(l))||lines[0]||'').trim();if(!sym||sym.length>12)return;const name=lines.find(l=>l!==sym&&l.length>2)||sym;const qty=qIdx!==-1?parseN(tds[qIdx]):0;const avgP=aIdx!==-1?parseN(tds[aIdx]):0;const cost=cIdx!==-1?parseN(tds[cIdx]):(qty*avgP);const price=pIdx!==-1?parseN(tds[pIdx]):0;const val=vIdx!==-1?parseN(tds[vIdx]):Math.round(qty*price*(1-0.0112));const pnl=pnlIdx!==-1?parseN(tds[pnlIdx]):Math.round(val-cost);const pnlPct=rIdx!==-1?parseN(tds[rIdx]):(cost>0?Number(((pnl/cost)*100).toFixed(1)):0);items.push({symbol:sym.includes('.')?sym:\`\${sym}.N0000\`,displaySymbol:sym.split('.')[0],name,quantity:qty,price,marketValue:val,costBasis:cost,unrealizedPnl:pnl,pnlPercent:pnlPct});});}if(!items.length)throw new Error('No holdings table detected. Please make sure you are on pal.lk/portfolio-analysis.');let synced=false;const endpoints=['${appOrigin}/api/ops/stocks/sync','https://ops-center-psi.vercel.app/api/ops/stocks/sync','http://localhost:3000/api/ops/stocks/sync'];for(const url of endpoints){try{const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(items),mode:'cors'});if(res.ok){alert('✅ LifeOps Synced: '+items.length+' holdings updated with live PAL.lk values!');synced=true;break;}}catch(e){}}if(!synced){await navigator.clipboard.writeText(JSON.stringify(items,null,2));alert('📋 Extracted '+items.length+' holdings to clipboard! Click \\"Sync Clipboard Now\\" in LifeOps.');}}catch(err){alert('❌ Extraction Error: '+err.message);}})();`;

  const handleCopyBookmarklet = async () => {
    try {
      await navigator.clipboard.writeText(bookmarkletCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleManualSync = async (jsonText: string) => {
    if (!jsonText.trim()) {
      setStatusMessage({ type: "error", text: "Please paste the Pal.lk JSON payload first." });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const parsed = JSON.parse(jsonText.trim());
      const res = await fetch("/api/ops/stocks/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || resData.details || "Sync failed");
      }

      setStatusMessage({ type: "success", text: `Successfully synced ${resData.data?.count ?? "all"} CSE holdings!` });
      setPastedJson("");
      if (onSyncSuccess) onSyncSuccess();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Invalid JSON format" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setPastedJson(text);
        handleManualSync(text);
      }
    } catch (err) {
      setStatusMessage({ type: "error", text: "Clipboard read access denied. Please paste manually below." });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#090b0e] border border-[#133323] w-full max-w-lg rounded-md p-4 shadow-2xl relative font-sans">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#133323]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 bg-emerald-400 rounded-none animate-pulse" />
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-400">
              Pal.lk ⇄ CSE Holdings Sync Bridge
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sync Status Banner */}
        <div className="my-3 p-2 bg-[#040c08] border border-[#133323] rounded-sm text-[11px] font-mono flex items-center justify-between">
          <div className="text-slate-300">
            <span className="text-slate-500 uppercase text-[9px] block">Current Equities Source:</span>
            <span className="text-emerald-400 font-bold">{syncedFrom === "pal.lk" ? "pal.lk Active Sync" : "Default Baseline"}</span>
          </div>
          {lastPalSync && (
            <div className="text-right text-slate-400 text-[10px]">
              Last synced: {new Date(lastPalSync).toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Step-by-Step Instructions */}
        <div className="space-y-3 text-xs text-slate-300">
          <div className="bg-[#0b1612] border border-[#164e35]/60 p-3 rounded-sm space-y-2">
            <div className="font-mono text-[11px] font-bold text-emerald-300 uppercase tracking-wide flex items-center gap-1.5">
              <span>Method 1: 1-Click Bookmarklet (Instant)</span>
            </div>
            <ol className="list-decimal list-inside text-[11px] space-y-1 text-slate-300 font-sans">
              <li>Click <strong>Copy Bookmarklet</strong> below.</li>
              <li>In your browser, create a new Bookmark and paste this code as the URL.</li>
              <li>Open <a href="https://pal.lk/portfolio-analysis" target="_blank" rel="noreferrer" className="text-emerald-400 underline">pal.lk/portfolio-analysis</a> and click the bookmark!</li>
            </ol>

            <button
              onClick={handleCopyBookmarklet}
              className="w-full flex items-center justify-center gap-2 py-1.5 px-3 bg-[#10b981]/20 hover:bg-[#10b981]/30 border border-[#10b981]/50 text-emerald-300 rounded-sm font-mono text-[11px] font-semibold transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy 1-Click Bookmarklet Script</span>
                </>
              )}
            </button>
          </div>

          {/* Fallback Manual Paste / Clipboard */}
          <div className="bg-[#040c08] border border-[#133323] p-3 rounded-sm space-y-2">
            <div className="font-mono text-[11px] font-bold text-slate-300 uppercase tracking-wide flex items-center justify-between">
              <span>Method 2: Paste from Clipboard</span>
              <button
                onClick={handlePasteFromClipboard}
                className="text-emerald-400 hover:text-emerald-300 text-[10px] underline flex items-center gap-1"
              >
                <Upload className="w-3 h-3" />
                <span>Sync Clipboard Now</span>
              </button>
            </div>

            <textarea
              rows={3}
              value={pastedJson}
              onChange={(e) => setPastedJson(e.target.value)}
              placeholder="Paste Pal.lk summaries JSON here..."
              className="w-full bg-[#08140e] border border-[#133323] rounded-sm p-2 text-[10px] font-mono text-emerald-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />

            <button
              onClick={() => handleManualSync(pastedJson)}
              disabled={isSubmitting || !pastedJson.trim()}
              className="w-full py-1.5 px-3 bg-[#0b2419] hover:bg-[#133323] border border-[#164e35] text-emerald-300 disabled:opacity-50 rounded-sm font-mono text-[11px] font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>Sync Pasted Portfolio Data</span>
            </button>
          </div>
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div
            className={`mt-3 p-2 rounded-sm text-[11px] font-mono flex items-center gap-2 ${
              statusMessage.type === "success"
                ? "bg-emerald-950/80 border border-emerald-700 text-emerald-300"
                : "bg-rose-950/80 border border-rose-700 text-rose-300"
            }`}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}
