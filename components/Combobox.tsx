"use client";

import { useEffect, useRef, useState } from "react";

export type ComboItem = { id: string; name: string; hint?: string };
export type ComboValue = { id: string | null; name: string };

/**
 * Combobox: избор от съществуващи записи ИЛИ въвеждане на ново име.
 * Ако се въведе ново име (id == null), извикващият го записва в базата при запис.
 */
export default function Combobox({
  items,
  value,
  onChange,
  placeholder,
  allowCreate = true,
  disabled,
}: {
  items: ComboItem[];
  value: ComboValue;
  onChange: (v: ComboValue) => void;
  placeholder?: string;
  allowCreate?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value.name);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value.name);
  }, [value.name]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? items.filter((i) => i.name.toLowerCase().includes(q))
    : items;
  const exact = items.find((i) => i.name.toLowerCase() === q);
  const showCreate = allowCreate && q.length > 0 && !exact;

  return (
    <div className="relative" ref={ref}>
      <input
        className="input"
        disabled={disabled}
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange({ id: null, name: e.target.value });
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && (filtered.length > 0 || showCreate) && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {filtered.slice(0, 50).map((i) => (
            <button
              key={i.id}
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-brand-50"
              onClick={() => {
                onChange({ id: i.id, name: i.name });
                setQuery(i.name);
                setOpen(false);
              }}
            >
              <span className="text-slate-800">{i.name}</span>
              {i.hint && <span className="text-xs text-slate-400">{i.hint}</span>}
            </button>
          ))}
          {showCreate && (
            <button
              type="button"
              className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm text-brand-600 hover:bg-brand-50"
              onClick={() => {
                onChange({ id: null, name: query.trim() });
                setOpen(false);
              }}
            >
              <span className="font-medium">+ Добави нов:</span> „{query.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}
