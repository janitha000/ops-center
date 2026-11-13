"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaRegister() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) {
      setIsInstalled(true);
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => {
          console.warn("Service worker registration failed:", err);
        });
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (isInstalled || !installPrompt) return null;

  const handleInstallClick = async () => {
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstallPrompt(null);
      }
    } catch {
      // ignore dismissed/cancelled prompt
    }
  };

  return (
    <button
      onClick={handleInstallClick}
      className="fixed bottom-4 right-4 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[#061810]/95 hover:bg-[#0b2a1c] border border-emerald-500/60 text-emerald-300 font-mono text-[11px] font-bold shadow-lg backdrop-blur-sm transition-colors cursor-pointer"
      title="Install Life Operations Center as a standalone app"
    >
      <Download className="w-3.5 h-3.5 text-emerald-400" />
      <span>INSTALL APP</span>
    </button>
  );
}
