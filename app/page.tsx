"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MaterialBalance } from "@/lib/types";
import { fmtKg, fmtLv, fmtPrice } from "@/lib/format";
import { PageHeader, Loading, Empty, Stat } from "@/components/ui";

export default function Dashboard() {
  const [rows, setRows] = useState<MaterialBalance[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("wh_material_balances")
      .select("*")
      .order("material_name");
    setRows((data as MaterialBalance[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const totalQty = rows.reduce((s, r) => s + Number(r.quantity_kg), 0);
  const totalVal = rows.reduce((s, r) => s + Number(r.total_value), 0);
  const avgAll = totalQty ? totalVal / totalQty : 0;
  const inStock = rows.filter((r) => Number(r.quantity_kg) > 0.001).length;

  return (
    <div>
      <PageHeader title="Табло" subtitle="Наличност и средна цена по материали" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Общо наличност" value={fmtKg(totalQty)} color="blue" />
        <Stat label="Складова стойност" value={fmtLv(totalVal)} color="green" />
        <Stat label="Обща средна цена" value={fmtPrice(avgAll)} />
        <Stat label="Материали с наличност" value={`${inStock} / ${rows.length}`} color="amber" />
      </div>

      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty text="Няма материали. Добавете материал от меню „Номенклатури“ или при въвеждане на доставка." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] rtable">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Материал</th>
                <th className="th text-right">Наличност</th>
                <th className="th text-right">Средна цена</th>
                <th className="th text-right">Стойност</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.material_id} className="hover:bg-slate-50">
                  <td className="td font-medium text-slate-900" data-label="Материал">{r.material_name}</td>
                  <td className="td text-right" data-label="Наличност">{fmtKg(r.quantity_kg)}</td>
                  <td className="td text-right font-medium" data-label="Средна цена">{fmtPrice(r.avg_price)}</td>
                  <td className="td text-right" data-label="Стойност">{fmtLv(r.total_value)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td className="td">Общо</td>
                <td className="td text-right">{fmtKg(totalQty)}</td>
                <td className="td text-right">{fmtPrice(avgAll)}</td>
                <td className="td text-right">{fmtLv(totalVal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
