/**
 * Canonical Currency & Number Formatting Helpers for Sovereign Omni-Market Terminal
 * Enforces unified Intl formatting across JSE, US, and Crypto views.
 */

const zarFormatter = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const zarCompactFormatter = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdCompactFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatZar(
  amount: number | null | undefined,
  options?: { compact?: boolean; decimals?: number }
): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return "R 0.00";
  }
  if (options?.compact) {
    return zarCompactFormatter.format(amount);
  }
  if (options?.decimals !== undefined) {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
      minimumFractionDigits: options.decimals,
      maximumFractionDigits: options.decimals,
    }).format(amount);
  }
  return zarFormatter.format(amount);
}

export function formatUsd(
  amount: number | null | undefined,
  options?: { compact?: boolean; isUsdt?: boolean; decimals?: number }
): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return options?.isUsdt ? "$0.00 USDT" : "$0.00";
  }
  let base: string;
  if (options?.compact) {
    base = usdCompactFormatter.format(amount);
  } else if (options?.decimals !== undefined) {
    base = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: options.decimals,
      maximumFractionDigits: options.decimals,
    }).format(amount);
  } else {
    base = usdFormatter.format(amount);
  }
  return options?.isUsdt ? `${base} USDT` : base;
}

export function formatPercent(
  val: number | null | undefined,
  decimals = 2,
  showPlus = true
): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return "0.00%";
  const prefix = showPlus && val > 0 ? "+" : "";
  return `${prefix}${val.toFixed(decimals)}%`;
}

export function formatMetric(
  val: number | null | undefined,
  decimals = 2,
  suffix = ""
): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return "n/a";
  return `${val.toFixed(decimals)}${suffix}`;
}
