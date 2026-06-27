"use client";

import { ReactNode, useState } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-700">{title}</h1>
        <div className="mt-1 h-1 w-12 rounded bg-accent-400" />
        {subtitle && <p className="text-sm text-slate-500 mt-1.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className={`card my-8 w-full ${wide ? "max-w-3xl" : "max-w-lg"}`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="card p-10 text-center text-slate-400 text-sm">{text}</div>
  );
}

export function Loading() {
  return <div className="p-10 text-center text-slate-400 text-sm">Зареждане…</div>;
}

// ---- Единна система за форми (равномерно подравняване) ----

export function Field({
  label,
  required,
  hint,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col ${className}`}>
      <label className="label">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <span className="mt-1 text-xs text-slate-400">{hint}</span>}
    </div>
  );
}

export function FormGrid({ children, cols = 2 }: { children: ReactNode; cols?: 1 | 2 | 3 | 4 }) {
  const map = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" };
  return <div className={`grid ${map[cols]} gap-x-4 gap-y-4`}>{children}</div>;
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-2 pt-4 mt-2 border-t border-slate-200">{children}</div>;
}

export function FormError({ msg }: { msg: string }) {
  if (!msg) return null;
  return <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200">{msg}</div>;
}

export function VoidedBadge() {
  return <span className="badge bg-slate-200 text-slate-500 line-through">Анулиран</span>;
}

export function InvoiceBadge({ invoiced, number }: { invoiced: boolean; number?: string | null }) {
  if (invoiced)
    return (
      <span className="badge bg-brand-100 text-brand-700" title={number ? `Фактура № ${number}` : undefined}>
        ✓ Фактурирана{number ? ` · ${number}` : ""}
      </span>
    );
  return <span className="badge bg-amber-100 text-amber-700">Чака фактура</span>;
}

export function VoidButton({
  onVoid,
  label = "Анулирай",
}: {
  onVoid: (reason: string) => Promise<string | void>;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    setErr("");
    const error = await onVoid(reason);
    setBusy(false);
    if (error) {
      setErr(error);
      return;
    }
    setOpen(false);
    setReason("");
  }

  return (
    <>
      <button className="text-xs text-red-600 hover:underline" onClick={() => setOpen(true)}>
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Анулиране на документ">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Документът няма да бъде изтрит — ще остане в историята, но количеството и стойността му ще се
            извадят от наличността и средната цена. След анулиране можете да въведете коригиран документ.
          </p>
          <div>
            <label className="label">Причина за анулиране</label>
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="напр. грешно въведено количество" />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setOpen(false)}>
              Отказ
            </button>
            <button className="btn-danger" onClick={confirm} disabled={busy}>
              {busy ? "Анулиране…" : "Анулирай документа"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export function Stat({
  label,
  value,
  sub,
  color = "slate",
}: {
  label: string;
  value: string;
  sub?: string;
  color?: "slate" | "green" | "blue" | "amber" | "red";
}) {
  const colors: Record<string, string> = {
    slate: "text-slate-900",
    green: "text-emerald-600",
    blue: "text-brand-600",
    amber: "text-amber-600",
    red: "text-red-600",
  };
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${colors[color]}`}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}
