"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { GroupBalance } from "@/lib/types";
import { fmtKg, fmtLv, fmtPrice, fmtPct } from "@/lib/format";
import { PageHeader, Loading, Empty, Stat } from "@/components/ui";

export default function Dashboard() {
  const [rows, setRows] = useState<GroupBalance[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("wh_group_balances")
      .select("*")
      .order("group_name");
    setRows((data as GroupBalance[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const totalQty = rows.reduce((s, r) => s + Number(r.quantity_kg), 0);
  const totalVal = rows.reduce((s, r) => s + Number(r.total_value), 0);
  const avgAll = totalQty ? totalVal / totalQty : 0;
  const activeGroups = rows.filter((r) => Number(r.quantity_kg) > 0.001).length;

  return (
    <div>
      <PageHeader
        title="Табло"
        subtitle="Наличност, средна цена и среден отбив по групи"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Общо наличност" value={fmtKg(totalQty)} color="blue" />
        <Stat label="Складова стойност" value={fmtLv(totalVal)} color="green" />
        <Stat label="Обща средна цена" value={fmtPrice(avgAll)} />
        <Stat label="Активни групи" value={`${activeGroups} / ${rows.length}`} color="amber" />
      </div>

      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty text="Няма създадени групи. Създайте група от меню „Групи“." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Група</th>
                <th className="th">Материал</th>
                <th className="th text-right">Наличност</th>
                <th className="th text-right">Средна цена</th>
                <th className="th text-right">Стойност</th>
                <th className="th text-right">Среден отбив</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.group_id} className="hover:bg-slate-50">
                  <td className="td font-medium text-slate-900">{r.group_name}</td>
                  <td className="td text-slate-500">{r.material_name || "—"}</td>
                  <td className="td text-right">{fmtKg(r.quantity_kg)}</td>
                  <td className="td text-right font-medium">{fmtPrice(r.avg_price)}</td>
                  <td className="td text-right">{fmtLv(r.total_value)}</td>
                  <td className="td text-right">{fmtPct(r.avg_deduction_pct)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td className="td" colSpan={2}>
                  Общо
                </td>
                <td className="td text-right">{fmtKg(totalQty)}</td>
                <td className="td text-right">{fmtPrice(avgAll)}</td>
                <td className="td text-right">{fmtLv(totalVal)}</td>
                <td className="td"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
