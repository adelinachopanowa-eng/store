"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { HistoryRow } from "@/lib/types";
import { fmtKg, fmtLv, fmtDate, fmtPrice } from "@/lib/format";
import { PageHeader, Loading, Empty } from "@/components/ui";

const TYPES = [
  { v: "", l: "Всички" },
  { v: "delivery", l: "Доставки" },
  { v: "sale", l: "Продажби" },
  { v: "transfer_in", l: "Прехвърляне вход" },
  { v: "transfer_out", l: "Прехвърляне изход" },
];

export default function HistoryPage() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("");

  async function load() {
    setLoading(true);
    let q = supabase.from("wh_history").select("*").limit(500);
    if (type) q = q.eq("type", type);
    const { data } = await q;
    setRows((data as HistoryRow[]) || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [type]);

  return (
    <div>
      <PageHeader title="История" subtitle="Пълен одит на всички движения (неизменим дневник)" />
      <div className="flex gap-2 mb-4">
        {TYPES.map((t) => (
          <button key={t.v} className={type === t.v ? "btn-primary" : "btn-secondary"} onClick={() => setType(t.v)}>
            {t.l}
          </button>
        ))}
      </div>
      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty text="Няма записи." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] rtable">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Дата</th>
                <th className="th">Движение</th>
                <th className="th">Материал</th>
                <th className="th">Контрагент</th>
                <th className="th text-right">Кол-во</th>
                <th className="th text-right">Цена</th>
                <th className="th text-right">Стойност</th>
                <th className="th">Бележка</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isIn = Number(r.quantity_kg) >= 0;
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="td whitespace-nowrap" data-label="Дата">{fmtDate(r.entry_date)}</td>
                    <td className="td" data-label="Движение">
                      <span className={`badge ${isIn ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {r.type_bg}
                      </span>
                    </td>
                    <td className="td" data-label="Материал">{r.material_name || "—"}</td>
                    <td className="td" data-label="Контрагент">{r.supplier_name || "—"}</td>
                    <td className={`td text-right font-medium ${isIn ? "text-emerald-600" : "text-red-600"}`} data-label="Кол-во">
                      {isIn ? "+" : ""}
                      {fmtKg(r.quantity_kg)}
                    </td>
                    <td className="td text-right" data-label="Цена">{r.unit_price != null ? fmtPrice(r.unit_price) : "—"}</td>
                    <td className="td text-right" data-label="Стойност">{fmtLv(r.value)}</td>
                    <td className="td text-slate-500" data-label="Бележка">{r.note || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
