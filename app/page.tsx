"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MaterialBalance } from "@/lib/types";
import { fmtKg, fmtLv, fmtPrice } from "@/lib/format";
import { PageHeader, Loading, Empty } from "@/components/ui";

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

  // Показваме само материали с реална наличност, подредени по стойност
  const inStock = useMemo(
    () =>
      rows
        .filter((r) => Number(r.quantity_kg) > 0.001)
        .sort((a, b) => Number(b.total_value) - Number(a.total_value)),
    [rows]
  );

  const totalQty = inStock.reduce((s, r) => s + Number(r.quantity_kg), 0);
  const totalVal = inStock.reduce((s, r) => s + Number(r.total_value), 0);
  const maxVal = inStock.length ? Number(inStock[0].total_value) : 0;

  return (
    <div>
      <PageHeader title="Табло" subtitle="Наличност и средна цена по материали" />

      {/* ─── Обобщение ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <HeroCard
          icon="⚖️"
          label="Общо наличност"
          value={fmtKg(totalQty)}
          tone="brand"
        />
        <HeroCard
          icon="💶"
          label="Складова стойност"
          value={fmtLv(totalVal)}
          tone="accent"
        />
      </div>

      {loading ? (
        <Loading />
      ) : inStock.length === 0 ? (
        <Empty text="Няма материали с наличност в момента." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] rtable">
              <thead>
                <tr>
                  <th className="th">Материал</th>
                  <th className="th text-right">Наличност</th>
                  <th className="th text-right">Средна цена</th>
                  <th className="th text-right">Стойност</th>
                </tr>
              </thead>
              <tbody>
                {inStock.map((r) => {
                  const val = Number(r.total_value);
                  const pct = maxVal > 0 ? Math.max((val / maxVal) * 100, 2) : 0;
                  const share = totalVal > 0 ? (val / totalVal) * 100 : 0;
                  return (
                    <tr key={r.material_id} className="hover:bg-brand-50/60 transition-colors">
                      <td className="td" data-label="Материал">
                        <div className="font-medium text-slate-900">{r.material_name}</div>
                        {/* дял от складовата стойност */}
                        <div className="hidden sm:flex items-center gap-2 mt-1.5">
                          <div className="h-1.5 w-28 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-brand-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-slate-400 tabular-nums">
                            {share.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="td text-right tabular-nums" data-label="Наличност">
                        {fmtKg(r.quantity_kg)}
                      </td>
                      <td className="td text-right tabular-nums text-slate-500" data-label="Средна цена">
                        {fmtPrice(r.avg_price)}
                      </td>
                      <td className="td text-right tabular-nums font-semibold text-slate-900" data-label="Стойност">
                        {fmtLv(val)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold border-t-2 border-slate-200">
                  <td className="td">Общо</td>
                  <td className="td text-right tabular-nums">{fmtKg(totalQty)}</td>
                  <td className="td text-right text-slate-300">—</td>
                  <td className="td text-right tabular-nums text-brand-700">{fmtLv(totalVal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Голяма карта за обобщение ───────────────────────────────────────────────
function HeroCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  tone: "brand" | "accent";
}) {
  const styles =
    tone === "brand"
      ? { wrap: "from-brand-700 to-brand-600", label: "text-brand-100", value: "text-white", badge: "bg-white/15" }
      : { wrap: "from-accent-400 to-accent-500", label: "text-brand-700/70", value: "text-brand-800", badge: "bg-white/30" };

  return (
    <div className={`rounded-xl bg-gradient-to-br ${styles.wrap} shadow-sm p-5 flex items-center gap-4`}>
      <div className={`shrink-0 h-12 w-12 rounded-xl ${styles.badge} grid place-items-center text-2xl`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className={`text-xs font-semibold uppercase tracking-wider ${styles.label}`}>{label}</div>
        <div className={`text-3xl font-bold leading-tight mt-0.5 tabular-nums truncate ${styles.value}`}>
          {value}
        </div>
      </div>
    </div>
  );
}
