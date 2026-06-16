// Количествата са в ТОНОВЕ, паричните стойности в ЕВРО.
// (Имената fmtKg/fmtLv/fmtPrice са запазени, но извеждат т / € / €/т.)

export const fmtKg = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("bg-BG", { minimumFractionDigits: 0, maximumFractionDigits: 3 }) + " т";

export const fmtLv = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("bg-BG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

export const fmtPrice = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("bg-BG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €/т";

export const fmtPct = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("bg-BG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " %";

export const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString("bg-BG", { dateStyle: "short", timeStyle: "short" }) : "";

export const fmtDateShort = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("bg-BG", { dateStyle: "short" }) : "";
