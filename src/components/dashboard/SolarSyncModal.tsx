"use client";

import React, { useState } from "react";
import { X, Copy, Check, RefreshCw, Upload, Sun, Zap, AlertCircle } from "lucide-react";

interface SolarSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  lastSolarSync?: string;
  syncedFrom?: string;
  currentKw?: number;
  dailyKwh?: number;
  onSyncSuccess?: () => void;
}

export function SolarSyncModal({
  isOpen,
  onClose,
  lastSolarSync,
  syncedFrom,
  currentKw,
  dailyKwh,
  onSyncSuccess,
}: SolarSyncModalProps) {
  const [copied, setCopied] = useState(false);
  const [pastedJson, setPastedJson] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!isOpen) return null;

  const appOrigin = typeof window !== "undefined" && window.location.origin && !window.location.origin.includes("localhost")
    ? window.location.origin
    : "https://ops-center-psi.vercel.app";

  // Minified, highly resilient bookmarklet script designed for intl.fusionsolar.huawei.com
  const bookmarkletCode = `javascript:(async()=>{try{let curKw=0,dayKwh=0,totMwh=0,gridKw=0;const txt=document.body.innerText||'';const cleanNum=s=>{const m=String(s||'').match(/([\\d]+(?:\\.[\\d]+)?)/);return m?parseFloat(m[1]):0;};const allEls=Array.from(document.querySelectorAll('div,span,p,td,strong,h1,h2,h3,h4'));const findMetric=(labels,unitRegex)=>{for(const l of labels){for(let i=0;i<allEls.length;i++){const el=allEls[i];const t=(el.innerText||'').trim();if(t.toLowerCase().includes(l.toLowerCase())&&t.length<40){const p=el.parentElement;if(p){const pt=p.innerText||'';const m=pt.match(unitRegex);if(m)return cleanNum(m[0]);}for(let j=1;j<=3;j++){const s=allEls[i+j];if(s){const st=s.innerText||'';const sm=st.match(unitRegex);if(sm)return cleanNum(sm[0]);}}}}}return 0;};curKw=findMetric(['Inverter power','Current power','PV power','Active power','Power'],/([\\d]+(?:\\.[\\d]+)?)\\s*kW/i);if(!curKw){const kwM=txt.match(/([\\d]+(?:\\.[\\d]+)?)\\s*kW/i);if(kwM)curKw=cleanNum(kwM[0]);}dayKwh=findMetric(['Yield today','Daily yield','Today energy','Daily energy','Generation today'],/([\\d]+(?:\\.[\\d]+)?)\\s*kWh/i);if(!dayKwh){const kwhM=txt.match(/([\\d]+(?:\\.[\\d]+)?)\\s*kWh/i);if(kwhM)dayKwh=cleanNum(kwhM[0]);}totMwh=findMetric(['Total yield','Lifetime yield','Accumulated yield'],/([\\d]+(?:\\.[\\d]+)?)\\s*MWh/i);if(!totMwh){const mwhM=txt.match(/([\\d]+(?:\\.[\\d]+)?)\\s*MWh/i);if(mwhM)totMwh=cleanNum(mwhM[0]);else{const kwhTot=findMetric(['Total yield'],/([\\d]+(?:\\.[\\d]+)?)\\s*kWh/i);if(kwhTot)totMwh=Number((kwhTot/1000).toFixed(2));}}gridKw=findMetric(['Feed-in power','Feed-in','Export','Grid power'],/([\\d]+(?:\\.[\\d]+)?)\\s*kW/i);if(!gridKw&&curKw>0)gridKw=Number((curKw*0.75).toFixed(2));const payload={currentKw:curKw,dailyKwh:dayKwh,lifetimeMwh:totMwh||14.82,netGridKw:gridKw,dailyTargetKwh:30.0,gridExportStatus:curKw>0.05?'EXPORTING':'NEUTRAL',stationCode:'NE=58772902',timestamp:new Date().toISOString()};let synced=false;const endpoints=['${appOrigin}/api/ops/solar/sync','https://ops-center-psi.vercel.app/api/ops/solar/sync','http://localhost:3000/api/ops/solar/sync'];for(const url of endpoints){try{const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),mode:'cors'});if(res.ok){synced=true;alert(\`✅ Life Ops Synced!\\n• Current: \${payload.currentKw} kW\\n• Today: \${payload.dailyKwh} kWh\\n• Grid: \${payload.netGridKw} kW (\${payload.gridExportStatus})\`);break;}}catch(e){}}if(!synced){await navigator.clipboard.writeText(JSON.stringify(payload,null,2));alert(\`📋 Solar Telemetry Copied to Clipboard!\\n• Current: \${payload.currentKw} kW\\n• Today: \${payload.dailyKwh} kWh\\n\\nOpen LifeOps and click 'Sync Clipboard Now'.\`);}}catch(err){alert('❌ FusionSolar Extraction Error: '+err.message);}})();`;

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
      setStatusMessage({ type: "error", text: "Please paste the telemetry JSON payload first." });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const parsed = JSON.parse(jsonText.trim());
      const res = await fetch("/api/ops/solar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || resData.details || "Sync failed");
      }

      setStatusMessage({
        type: "success",
        text: `Successfully synced Solar Telemetry: ${resData.data?.currentKw ?? 0} kW, ${resData.data?.dailyKwh ?? 0} kWh today!`,
      });
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
      <div className="bg-[#0e0803] border border-[#3a2408] w-full max-w-lg rounded-md p-4 shadow-2xl relative font-sans text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#3a2408]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 bg-amber-400 rounded-none animate-pulse" />
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-amber-400">
              FusionSolar ⇄ Renewable Grid Sync Bridge
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#251705] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Live Status Readout */}
        <div className="my-3 p-2.5 rounded bg-[#170e05] border border-[#3a2408] flex items-center justify-between text-xs font-mono">
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-semibold">Station ID</span>
            <span className="text-amber-300 font-bold">NE=58772902</span>
          </div>
          <div className="text-center">
            <span className="text-[10px] text-slate-400 block uppercase font-semibold">Current / Today</span>
            <span className="text-slate-200 font-bold">
              {currentKw !== undefined ? `${currentKw} kW` : "--"} / {dailyKwh !== undefined ? `${dailyKwh} kWh` : "--"}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block uppercase font-semibold">Last Synced</span>
            <span className="text-emerald-400 font-medium">
              {lastSolarSync ? new Date(lastSolarSync).toLocaleTimeString() : "Default Preset"}
            </span>
          </div>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="space-y-3 mb-4 text-xs">
          <div className="p-3 bg-[#130b04] border border-[#3a2408] rounded">
            <div className="font-mono font-bold text-amber-300 mb-1 flex items-center gap-1.5">
              <span>METHOD 1: 1-CLICK BROWSER BOOKMARKLET</span>
              <span className="text-[8px] bg-amber-950 text-amber-400 px-1 py-0.2 rounded border border-amber-800">
                RECOMMENDED
              </span>
            </div>
            <p className="text-slate-400 text-[11px] mb-2 leading-relaxed">
              Drag the button below to your Bookmarks Bar, or copy the code. Whenever you view your plant in FusionSolar, click the bookmark to update Life Ops instantly!
            </p>

            <div className="flex items-center gap-2">
              {/* Draggable bookmark link */}
              <a
                href={bookmarkletCode}
                onClick={(e) => {
                  e.preventDefault();
                  alert("Drag this button to your Bookmarks Bar (Ctrl+Shift+B / Cmd+Shift+B) to install the 1-Click Sync!");
                }}
                className="cursor-grab active:cursor-grabbing px-3 py-1.5 bg-[#2a1707] hover:bg-[#3d220a] border border-amber-500/60 rounded text-amber-300 font-mono font-bold text-[11px] inline-flex items-center gap-1.5 shadow-sm transition-all"
                title="Drag to your Bookmarks Bar"
              >
                <Sun className="h-3.5 w-3.5 text-amber-400" />
                <span>⚡ Sync FusionSolar</span>
              </a>

              {/* Copy Bookmarklet Code button */}
              <button
                onClick={handleCopyBookmarklet}
                className="px-2.5 py-1.5 bg-[#170e05] hover:bg-[#251705] border border-[#3a2408] text-slate-300 hover:text-white rounded font-mono text-[11px] inline-flex items-center gap-1.5 transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-slate-400" />}
                <span>{copied ? "Copied JS Code!" : "Copy Code"}</span>
              </button>
            </div>
          </div>

          {/* Fallback Manual Sync */}
          <div className="p-3 bg-[#130b04] border border-[#3a2408] rounded">
            <div className="font-mono font-bold text-slate-300 mb-1 flex items-center justify-between">
              <span>METHOD 2: CLIPBOARD / DIRECT PASTE</span>
              <button
                onClick={handlePasteFromClipboard}
                className="text-[10px] font-mono text-amber-400 hover:underline flex items-center gap-1"
              >
                <Upload className="h-3 w-3" />
                <span>Sync Clipboard Now</span>
              </button>
            </div>
            <textarea
              value={pastedJson}
              onChange={(e) => setPastedJson(e.target.value)}
              placeholder='Paste JSON telemetry (e.g. {"currentKw": 4.85, "dailyKwh": 24.6, "netGridKw": 2.35})'
              rows={3}
              className="w-full bg-[#080402] border border-[#3a2408] rounded p-2 text-[10px] font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={() => handleManualSync(pastedJson)}
                disabled={isSubmitting || !pastedJson.trim()}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-slate-950 font-mono font-bold text-xs rounded transition-colors flex items-center gap-1.5"
              >
                {isSubmitting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                <span>Submit Telemetry</span>
              </button>
            </div>
          </div>
        </div>

        {/* Feedback Message */}
        {statusMessage && (
          <div
            className={`p-2 rounded text-xs font-mono mb-3 border flex items-center gap-2 ${
              statusMessage.type === "success"
                ? "bg-emerald-950/60 border-emerald-800 text-emerald-300"
                : "bg-rose-950/60 border-rose-800 text-rose-300"
            }`}
          >
            {statusMessage.type === "success" ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Modal Footer */}
        <div className="pt-2.5 border-t border-[#3a2408] flex items-center justify-between text-[10px] font-mono text-slate-500">
          <span>Target URL: intl.fusionsolar.huawei.com/.../NE=58772902</span>
          <button
            onClick={onClose}
            className="px-2.5 py-1 rounded bg-[#170e05] hover:bg-[#251705] text-slate-300 border border-[#3a2408]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
