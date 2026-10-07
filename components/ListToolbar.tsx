"use client";

/**
 * Обща лента за филтриране над списък: търсене по текст + период + брояч.
 * Филтрирането се прави от извикващата страница (виж helpers по-долу).
 */
export default function ListToolbar({
  query,
  onQuery,
  from,
  onFrom,
  to,
  onTo,
  shown,
  total,
  placeholder = "Търси…",
}: {
  query: string;
  onQuery: (v: string) => void;
  from: string;
  onFrom: (v: string) => void;
  to: string;
  onTo: (v: string) => void;
  shown: number;
  total: number;
  placeholder?: string;
}) {
  const dirty = query !== "" || from !== "" || to !== "";

  return (
    <div className="card p-3 mb-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-full sm:basis-64">
          <label className="label">Търсене</label>
          <input
            className="input"
            type="search"
            value={query}
            placeholder={placeholder}
            onChange={(e) => onQuery(e.target.value)}
          />
        </div>
        <div>
          <label className="label">От дата</label>
          <input className="input" type="date" value={from} onChange={(e) => onFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">До дата</label>
          <input className="input" type="date" value={to} onChange={(e) => onTo(e.target.value)} />
        </div>
        {dirty && (
          <button
            className="btn-secondary"
            onClick={() => {
              onQuery("");
              onFrom("");
              onTo("");
            }}
          >
            Изчисти
          </button>
        )}
      </div>
      <div className="mt-2 text-xs text-slate-400 tabular-nums">
        {dirty ? `Показани ${shown} от ${total}` : `${total} записа`}
      </div>
    </div>
  );
}

/** Съвпада ли редът с търсения текст (проверява подадените полета). */
export function matchesQuery(query: string, fields: (string | number | null | undefined)[]) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => f != null && String(f).toLowerCase().includes(q));
}

/** Попада ли датата в избрания период (празно = без ограничение). */
export function inPeriod(dateStr: string | null | undefined, from: string, to: string) {
  if (!from && !to) return true;
  if (!dateStr) return false;
  const d = new Date(dateStr).getTime();
  if (from && d < new Date(from + "T00:00:00").getTime()) return false;
  if (to && d > new Date(to + "T23:59:59").getTime()) return false;
  return true;
}
