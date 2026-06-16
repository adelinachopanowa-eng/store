export const fmtKg = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("bg-BG", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " кг";

export const fmtLv = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("bg-BG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " лв.";

export const fmtPrice = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("bg-BG", { minimumFractionDigits: 4, maximumFractionDigits: 4 }) + " лв/кг";

export const fmtPct = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("bg-BG", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " %";

export const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString("bg-BG", { dateStyle: "short", timeStyle: "short" }) : "";

export const fmtDateShort = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("bg-BG", { dateStyle: "short" }) : "";
