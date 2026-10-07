"use client";

import Combobox, { ComboItem, ComboValue } from "@/components/Combobox";
import { fmtKg } from "@/lib/format";

export type StockTile = { id: string; name: string; qty: number };

/**
 * Избор на материал: плочки за материалите с наличност + търсачка за всички останали.
 * Плочките са подредени по наличност (най-голямата първа) и са удобни за палец.
 */
export default function MaterialPicker({
  all,
  inStock,
  value,
  onChange,
  placeholder = "Търси материал…",
  allowCreate = true,
  disabled,
  maxTiles = 8,
}: {
  all: ComboItem[];
  inStock: StockTile[];
  value: ComboValue;
  onChange: (v: ComboValue) => void;
  placeholder?: string;
  allowCreate?: boolean;
  disabled?: boolean;
  maxTiles?: number;
}) {
  const tiles = [...inStock]
    .filter((t) => t.qty > 0.001)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, maxTiles);

  return (
    <div className="min-w-0">
      {tiles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
          {tiles.map((t) => {
            const active = value.id === t.id;
            return (
              <button
                key={t.id}
                type="button"
                disabled={disabled}
                onClick={() => onChange({ id: t.id, name: t.name })}
                className={`min-w-0 rounded-lg border px-2.5 py-2 text-left transition min-h-[52px] disabled:opacity-50 ${
                  active
                    ? "border-brand-600 bg-brand-600 text-white shadow-sm"
                    : "border-slate-200 bg-white hover:border-brand-500 hover:bg-brand-50"
                }`}
              >
                <div className={`truncate text-sm font-medium ${active ? "text-white" : "text-slate-900"}`}>
                  {t.name}
                </div>
                <div className={`truncate text-[11px] tabular-nums ${active ? "text-brand-100" : "text-slate-400"}`}>
                  {fmtKg(t.qty)}
                </div>
              </button>
            );
          })}
        </div>
      )}
      <Combobox
        items={all}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        allowCreate={allowCreate}
        disabled={disabled}
      />
    </div>
  );
}
