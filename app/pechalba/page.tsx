"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MaterialBalance, Material } from "@/lib/types";
import { fmtKg, fmtLv, fmtPrice } from "@/lib/format";
import { PageHeader, Loading, Empty, Stat } from "@/components/ui";

type Row = {
  id: string;
  name: string;
  quantity: number; // наличност (т)
  avg: number; // ср. себестойност (€/т)
  value: number; // складова стойност (€)
};

export default function ProfitPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, "ok" | "err" | "saving" | undefined>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [bRes, mRes] = await Promise.all([
      supabase.from("wh_material_balances").select("*"),
      supabase.from("wh_materials").select("id, name, sell_price, active").eq("active", true).order("name"),
    ]);
    const balances = (bRes.data as MaterialBalance[]) || [];
    const mats = (mRes.data as Material[]) || [];
    const balById = new Map(balances.map((b) => [b.material_id, b]));

    const merged: Row[] = mats.map((m) => {
      const b = balById.get(m.id);
      return {
        id: m.id,
        name: m.name,
        quantity: b ? Number(b.quantity_kg) : 0,
        avg: b ? Number(b.avg_price) : 0,
        value: b ? Number(b.total_value) : 0,
      };
    });

    const initPrices: Record<string, string> = {};
    for (const m of mats) initPrices[m.id] = m.sell_price != null ? String(m.sell_price) : "";

    setRows(merged);
    setPrices(initPrices);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function savePrice(id: string) {
    const raw = prices[id]?.trim() ?? "";
    const val = raw === "" ? null : Number(raw);
    if (val != null && !isFinite(val)) {
      setSaved((s) => ({ ...s, [id]: "err" }));
      return;
    }
    setSaved((s) => ({ ...s, [id]: "saving" }));
    const { error } = await supabase.from("wh_materials").update({ sell_price: val }).eq("id", id);
    setSaved((s) => ({ ...s, [id]: error ? "err" : "ok" }));
    if (!error) setTimeout(() => setSaved((s) => ({ ...s, [id]: undefined })), 1800);
  }

  // Изчисления на реда
  function calc(r: Row) {
    const raw = prices[r.id]?.trim() ?? "";
    const sell = raw === "" ? null : Number(raw);
    const hasSell = sell != null && isFinite(sell);
    const profitPerT = hasSell ? sell - r.avg : null;
    const unreal = hasSell && r.quantity > 0 ? r.quantity * (sell - r.avg) : hasSell ? 0 : null;
    const margin = hasSell && sell !== 0 ? ((sell - r.avg) / sell) * 100 : null;
    return { sell, hasSell, profitPerT, unreal, margin };
  }

  const totals = useMemo(() => {
    let qty = 0;
    let value = 0;
    let unreal = 0;
    let priced = 0;
    for (const r of rows) {
      qty += r.quantity;
      value += r.value;
      const raw = prices[r.id]?.trim() ?? "";
      if (raw !== "" && isFinite(Number(raw))) {
        priced += 1;
        if (r.quantity > 0) unreal += r.quantity * (Number(raw) - r.avg);
      }
    }
    return { qty, value, unreal, priced };
  }, [rows, prices]);

  const money = (n: number | null) =>
    n == null ? "—" : (n >= 0 ? "" : "−") + fmtLv(Math.abs(n));
  const price = (n: number | null) =>
    n == null ? "—" : (n >= 0 ? "" : "−") + fmtPrice(Math.abs(n));
  const cls = (n: number | null) =>
    n == null ? "" : n >= 0 ? "text-emerald-600" : "text-red-600";

  return (
    <div>
      <PageHeader
        title="Печалба"
        subtitle="Ефективни продажни цени и нереализирана брутна печалба от наличния запас"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Общо наличност" value={fmtKg(totals.qty)} color="blue" />
        <Stat label="Складова стойност" value={fmtLv(totals.value)} color="slate" />
        <Stat
          label="Нереализирана печалба"
          value={money(totals.unreal)}
          color={totals.unreal >= 0 ? "green" : "red"}
          sub="при въведените продажни цени"
        />
        <Stat label="С въведена цена" value={`${totals.priced} / ${rows.length}`} color="amber" />
      </div>

      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty text="Няма активни материали. Добавете материал от меню „Номенклатури“." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[860px] rtable">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Материал</th>
                <th className="th text-right">Наличност</th>
                <th className="th text-right">Ср. себестойност</th>
                <th className="th text-right">Продажна цена</th>
                <th className="th text-right">Печалба/т</th>
                <th className="th text-right">Нереализирана печалба</th>
                <th className="th text-right">Марж</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const c = calc(r);
                const st = saved[r.id];
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="td font-medium text-slate-900" data-label="Материал">{r.name}</td>
                    <td className="td text-right" data-label="Наличност">{fmtKg(r.quantity)}</td>
                    <td className="td text-right" data-label="Ср. себестойност">{fmtPrice(r.avg)}</td>
                    <td className="td text-right" data-label="Продажна цена">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          className="input max-w-[130px] text-right"
                          type="number"
                          step="0.0001"
                          inputMode="decimal"
                          placeholder="—"
                          value={prices[r.id] ?? ""}
                          onChange={(e) => setPrices((p) => ({ ...p, [r.id]: e.target.value }))}
                          onBlur={() => savePrice(r.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                        />
                        <span className="text-xs text-slate-400">€/т</span>
                      </div>
                    </td>
                    <td className={`td text-right font-medium ${cls(c.profitPerT)}`} data-label="Печалба/т">
                      {price(c.profitPerT)}
                    </td>
                    <td className={`td text-right font-semibold ${cls(c.unreal)}`} data-label="Нереализирана печалба">
                      {money(c.unreal)}
                    </td>
                    <td className={`td text-right ${cls(c.margin)}`} data-label="Марж">
                      {c.margin == null ? "—" : `${c.margin.toFixed(1)} %`}
                    </td>
                    <td className="td rtable-actions">
                      {st === "saving" ? (
                        <span className="text-xs text-slate-400">запис…</span>
                      ) : st === "ok" ? (
                        <span className="text-xs text-emerald-600">✓ записано</span>
                      ) : st === "err" ? (
                        <span className="text-xs text-red-600">грешка</span>
                      ) : (
                        <button
                          className="text-xs text-slate-500 hover:text-brand-600 px-2 py-1 rounded hover:bg-slate-100"
                          onClick={() => savePrice(r.id)}
                        >
                          Запази
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td className="td">Общо</td>
                <td className="td text-right">{fmtKg(totals.qty)}</td>
                <td className="td text-right">—</td>
                <td className="td text-right">—</td>
                <td className="td text-right">—</td>
                <td className={`td text-right ${cls(totals.unreal)}`}>{money(totals.unreal)}</td>
                <td className="td text-right">—</td>
                <td className="td"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400 mt-3">
        Нереализирана печалба = наличност × (продажна цена − средна себестойност). Отчита се само за
        материали с наличност и въведена продажна цена. Цената се записва автоматично при напускане на полето.
      </p>
    </div>
  );
}
