"use client";

import React, { useState, useEffect } from "react";
import { X, SlidersHorizontal, Check, RefreshCw, AlertCircle, Trash2 } from "lucide-react";
import { CseStockTicker } from "@/lib/types";
import { formatLKR } from "@/lib/utils";

interface StockMinPriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  tickers: CseStockTicker[];
  minPrices: Record<string, number>;
  onSave: (newMinPrices: Record<string, number>) => Promise<void>;
}

export function StockMinPriceModal({
  isOpen,
  onClose,
  tickers,
  minPrices,
  onSave,
}: StockMinPriceModalProps) {
  const [formPrices, setFormPrices] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState(false);

  // Sync state whenever modal opens or props change
  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, string> = {};
      tickers.forEach((t) => {
        const cleanSym = t.symbol.split(".")[0].toUpperCase();
        const existing = minPrices[cleanSym] ?? minPrices[t.symbol.toUpperCase()];
        initial[cleanSym] = existing !== undefined && existing > 0 ? String(existing) : "";
      });
      setFormPrices(initial);
      setSuccessNotice(false);
    }
  }, [isOpen, tickers, minPrices]);

  if (!isOpen) return null;

  const handleChange = (cleanSymbol: string, value: string) => {
    setFormPrices((prev) => ({ ...prev, [cleanSymbol]: value }));
  };

  const handleClearAll = () => {
    const cleared: Record<string, string> = {};
    tickers.forEach((t) => {
      const cleanSym = t.symbol.split(".")[0].toUpperCase();
      cleared[cleanSym] = "";
    });
    setFormPrices(cleared);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessNotice(false);

    try {
      const cleanedMinPrices: Record<string, number> = {};
      Object.entries(formPrices).forEach(([sym, val]) => {
        const num = parseFloat(val);
        if (!isNaN(num) && num > 0) {
          cleanedMinPrices[sym.toUpperCase()] = Number(num.toFixed(2));
        }
      });

      await onSave(cleanedMinPrices);
      setSuccessNotice(true);
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      console.error("Failed to save stock min prices:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs font-sans">
      <div className="relative w-full max-w-2xl bg-[#060e0a] border border-[#164e35] rounded-md shadow-[0_0_25px_rgba(16,185,129,0.15)] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#133323] bg-[#040906]">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-emerald-400" />
            <div>
              <h2 className="text-xs font-mono font-bold tracking-wider text-slate-100 uppercase">
                CSE EQUITIES // MINIMUM PRICE SETTINGS
              </h2>
              <p className="text-[10px] text-slate-400">
                Current price displays in <strong className="text-emerald-400 font-semibold">Green</strong> if below min threshold, <strong className="text-white font-semibold">White</strong> if above min.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#133323] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="bg-[#030805] border border-[#133323] rounded p-2.5 text-[10px] font-mono text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <AlertCircle className="h-3 w-3" />
              <span>COLOR LOGIC RULES:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[9px] pt-1">
              <div className="bg-[#081810] p-1.5 rounded border border-emerald-900/60">
                <span className="text-emerald-400 font-bold">🟢 Current Price &lt; Min Price:</span>
                <span className="text-slate-300 ml-1">Highlights GREEN (accumulation bargain)</span>
              </div>
              <div className="bg-[#0e1612] p-1.5 rounded border border-slate-800">
                <span className="text-white font-bold">⚪ Current Price &ge; Min Price:</span>
                <span className="text-slate-300 ml-1">Displays WHITE (above threshold)</span>
              </div>
            </div>
          </div>

          {/* Stock Tickers List */}
          <div className="space-y-1.5">
            <div className="grid grid-cols-12 text-[9px] font-mono font-bold uppercase text-slate-500 px-2">
              <div className="col-span-5 sm:col-span-4">Stock / Security</div>
              <div className="col-span-3 sm:col-span-3 text-right">Current Mkt Price</div>
              <div className="col-span-4 sm:col-span-5 text-right">Min Target Price (LKR)</div>
            </div>

            {tickers.map((t) => {
              const cleanSym = t.symbol.split(".")[0].toUpperCase();
              const inputVal = formPrices[cleanSym] ?? "";
              const minVal = parseFloat(inputVal);
              const hasMin = !isNaN(minVal) && minVal > 0;
              const isBelowMin = hasMin && t.price < minVal;

              return (
                <div
                  key={t.symbol}
                  className={`grid grid-cols-12 items-center gap-2 p-2 rounded border font-mono transition-colors ${
                    isBelowMin
                      ? "bg-[#06180f] border-emerald-800/80"
                      : "bg-[#040a07] border-[#133323] hover:border-[#1c4832]"
                  }`}
                >
                  {/* Symbol & Name */}
                  <div className="col-span-5 sm:col-span-4 flex flex-col">
                    <span className="text-xs font-bold text-slate-100">{cleanSym}</span>
                    <span className="text-[9px] text-slate-500 truncate" title={t.name}>
                      {t.name}
                    </span>
                  </div>

                  {/* Current Market Price */}
                  <div className="col-span-3 sm:col-span-3 text-right flex flex-col items-end">
                    <span
                      className={`text-xs font-bold ${
                        hasMin
                          ? isBelowMin
                            ? "text-emerald-400"
                            : "text-white"
                          : "text-slate-200"
                      }`}
                    >
                      {formatLKR(t.price)}
                    </span>
                    {hasMin && (
                      <span
                        className={`text-[8px] font-bold px-1 rounded-2xs ${
                          isBelowMin
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-700/60"
                            : "bg-slate-900 text-slate-400 border border-slate-700"
                        }`}
                      >
                        {isBelowMin ? "BELOW MIN" : "ABOVE MIN"}
                      </span>
                    )}
                  </div>

                  {/* Min Price Input */}
                  <div className="col-span-4 sm:col-span-5 flex items-center justify-end gap-1.5">
                    <span className="text-[10px] text-slate-500 hidden sm:inline">Rs.</span>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      placeholder="e.g. 140.00"
                      value={inputVal}
                      onChange={(e) => handleChange(cleanSym, e.target.value)}
                      className="w-28 sm:w-32 bg-[#020503] border border-[#18462f] rounded px-2 py-1 text-xs text-right text-emerald-300 placeholder:text-slate-700 focus:outline-hidden focus:border-emerald-400"
                    />
                    {inputVal && (
                      <button
                        type="button"
                        onClick={() => handleChange(cleanSym, "")}
                        className="text-slate-600 hover:text-rose-400 p-0.5"
                        title="Clear min price"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Controls */}
          <div className="pt-2 border-t border-[#133323] flex items-center justify-between">
            <button
              type="button"
              onClick={handleClearAll}
              className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono rounded border border-rose-900/60 bg-rose-950/20 text-rose-300 hover:bg-rose-950/50 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              <span>Clear All</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1 text-xs font-mono rounded bg-slate-900 text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-4 py-1 text-xs font-mono font-bold rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : successNotice ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                <span>{successNotice ? "Saved!" : "Save Targets"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
