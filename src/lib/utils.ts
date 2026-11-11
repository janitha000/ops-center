export function formatLKR(amount: number, compact = false): string {
  if (!Number.isFinite(amount)) return "Rs. 0";
  if (compact) {
    const abs = Math.abs(amount);
    if (abs >= 1_000_000_000) return `Rs. ${(amount / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `Rs. ${(amount / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `Rs. ${(amount / 1_000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(amount).replace("LKR", "Rs.");
}

export function formatUSD(amount: number, compact = false): string {
  if (!Number.isFinite(amount)) return "$0.00";
  if (compact && Math.abs(amount) >= 1_000) {
    return `$${(amount / 1_000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPercent(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "0%";
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

export function getCurrentFinancialYear(): string {
  const now = new Date();
  const m = now.getMonth(); // 0-indexed: Apr = 3
  const y = now.getFullYear();
  return m >= 3 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}
