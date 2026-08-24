"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MaterialBalance, Material } from "@/lib/types";
import { fmtKg, fmtLv, fmtPrice } from "@/lib/format";
import { PageHeader, Loading, Empty, Stat } from "@/components/ui";

type Tab = "stock" | "by_material" | "by_counterparty";

export default function ProfitPage() {
  const [tab, setTab] = useState<Tab>("stock");

  return (
    <div>
      <PageHeader
        title="Печалба"
        subtitle="Продажни цени, нереализирана печалба от запаса и справки по продажби"
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <button className={tab === "stock" ? "btn-primary" : "btn-secondary"} onClick={() => setTab("stock")}>
          Наличности (нереализирана)
        </button>
        <button className={tab === "by_material" ? "btn-primary" : "btn-secondary"} onClick={() => setTab("by_material")}>
          По материали
        </button>
        <button className={tab === "by_counterparty" ? "btn-primary" : "btn-secondary"} onClick={() => setTab("by_counterparty")}>
          По контрагенти
        </button>
      </div>

      {tab === "stock" ? (
        <StockView />
      ) : tab === "by_material" ? (
        <SalesReport groupBy="material" />
      ) : (
        <PurchasesBySupplier />
      )}
    </div>
  );
}

// ─── Помощни за оцветяване/форматиране на печалба ─────────────────────────────
const money = (n: number | null) => (n == null ? "—" : (n >= 0 ? "" : "−") + fmtLv(Math.abs(n)));
const price = (n: number | null) => (n == null ? "—" : (n >= 0 ? "" : "−") + fmtPrice(Math.abs(n)));
const profitCls = (n: number | null) => (n == null ? "" : n >= 0 ? "text-emerald-600" : "text-red-600");

// ══════════════════════════════════════════════════════════════════════════════
// Таб 1 — Наличности (нереализирана печалба)
// ══════════════════════════════════════════════════════════════════════════════
type StockRow = { id: string; name: string; quantity: number; avg: number; value: number };

function StockView() {
  const [rows, setRows] = useState<StockRow[]>([]);
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
    const merged: StockRow[] = mats.map((m) => {
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
  useEffect(() => { load(); }, []);

  async function savePrice(id: string) {
    const raw = prices[id]?.trim() ?? "";
    const val = raw === "" ? null : Number(raw);
    if (val != null && !isFinite(val)) { setSaved((s) => ({ ...s, [id]: "err" })); return; }
    setSaved((s) => ({ ...s, [id]: "saving" }));
    const { error } = await supabase.from("wh_materials").update({ sell_price: val }).eq("id", id);
    setSaved((s) => ({ ...s, [id]: error ? "err" : "ok" }));
    if (!error) setTimeout(() => setSaved((s) => ({ ...s, [id]: undefined })), 1800);
  }

  function calc(r: StockRow) {
    const raw = prices[r.id]?.trim() ?? "";
    const sell = raw === "" ? null : Number(raw);
    const hasSell = sell != null && isFinite(sell);
    const profitPerT = hasSell ? sell - r.avg : null;
    const unreal = hasSell && r.quantity > 0 ? r.quantity * (sell - r.avg) : hasSell ? 0 : null;
    const margin = hasSell && sell !== 0 ? ((sell - r.avg) / sell) * 100 : null;
    return { profitPerT, unreal, margin };
  }

  const totals = useMemo(() => {
    let qty = 0, value = 0, unreal = 0, priced = 0;
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

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Общо наличност" value={fmtKg(totals.qty)} color="blue" />
        <Stat label="Складова стойност" value={fmtLv(totals.value)} color="slate" />
        <Stat label="Нереализирана печалба" value={money(totals.unreal)} color={totals.unreal >= 0 ? "green" : "red"} sub="при въведените продажни цени" />
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
                          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        />
                        <span className="text-xs text-slate-400">€/т</span>
                      </div>
                    </td>
                    <td className={`td text-right font-medium ${profitCls(c.profitPerT)}`} data-label="Печалба/т">{price(c.profitPerT)}</td>
                    <td className={`td text-right font-semibold ${profitCls(c.unreal)}`} data-label="Нереализирана печалба">{money(c.unreal)}</td>
                    <td className={`td text-right ${profitCls(c.margin)}`} data-label="Марж">{c.margin == null ? "—" : `${c.margin.toFixed(1)} %`}</td>
                    <td className="td rtable-actions">
                      {st === "saving" ? (
                        <span className="text-xs text-slate-400">запис…</span>
                      ) : st === "ok" ? (
                        <span className="text-xs text-emerald-600">✓ записано</span>
                      ) : st === "err" ? (
                        <span className="text-xs text-red-600">грешка</span>
                      ) : (
                        <button className="text-xs text-slate-500 hover:text-brand-600 px-2 py-1 rounded hover:bg-slate-100" onClick={() => savePrice(r.id)}>
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
                <td className={`td text-right ${profitCls(totals.unreal)}`}>{money(totals.unreal)}</td>
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

// ══════════════════════════════════════════════════════════════════════════════
// Табове 2 и 3 — реализирана печалба от продажби, групирана
// ══════════════════════════════════════════════════════════════════════════════
type SubAgg = { key: string; label: string; qty: number; revenue: number; cost: number };
type GroupAgg = { key: string; label: string; qty: number; revenue: number; cost: number; subs: SubAgg[] };
type SortKey = "profit" | "revenue" | "qty" | "margin";

const isoStart = (d: string) => new Date(d + "T00:00:00").toISOString();
const isoEnd = (d: string) => new Date(d + "T23:59:59").toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

function SalesReport({ groupBy }: { groupBy: "material" | "counterparty" }) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("profit");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("wh_sales")
      .select("*, wh_materials(name), wh_suppliers(name)")
      .eq("voided", false)
      .gte("doc_date", isoStart(from))
      .lte("doc_date", isoEnd(to))
      .order("doc_date", { ascending: false });
    setSales(data || []);
    setExpanded(new Set());
    setLoading(false);
  }
  // презарежда при смяна на таб (groupBy) или при първо зареждане
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [groupBy]);

  function keysFor(s: any) {
    const matKey = s.material_id || "—";
    const matLabel = s.wh_materials?.name || "—";
    const cpKey = s.supplier_id ? "sup:" + s.supplier_id : "buyer:" + (s.buyer_name || "—");
    const cpLabel = s.wh_suppliers?.name || s.buyer_name || "—";
    if (groupBy === "material") {
      return { gKey: matKey, gLabel: matLabel, sKey: cpKey, sLabel: cpLabel };
    }
    return { gKey: cpKey, gLabel: cpLabel, sKey: matKey, sLabel: matLabel };
  }

  const groups = useMemo(() => {
    const map = new Map<string, GroupAgg>();
    for (const s of sales) {
      if (s.sale_value == null) continue; // без цена → без печалба
      const { gKey, gLabel, sKey, sLabel } = keysFor(s);
      const qty = Number(s.quantity_kg || 0);
      const revenue = Number(s.sale_value || 0);
      const cost = Number(s.cost_value || 0);
      let g = map.get(gKey);
      if (!g) { g = { key: gKey, label: gLabel, qty: 0, revenue: 0, cost: 0, subs: [] }; map.set(gKey, g); }
      g.qty += qty; g.revenue += revenue; g.cost += cost;
      let sub = g.subs.find((x) => x.key === sKey);
      if (!sub) { sub = { key: sKey, label: sLabel, qty: 0, revenue: 0, cost: 0 }; g.subs.push(sub); }
      sub.qty += qty; sub.revenue += revenue; sub.cost += cost;
    }
    return Array.from(map.values());
    // eslint-disable-next-line
  }, [sales, groupBy]);

  const profitOf = (x: { revenue: number; cost: number }) => x.revenue - x.cost;
  const marginOf = (x: { revenue: number; cost: number }) => (x.revenue ? (profitOf(x) / x.revenue) * 100 : null);

  const sortVal = (x: { qty: number; revenue: number; cost: number }) =>
    sortKey === "qty" ? x.qty : sortKey === "revenue" ? x.revenue : sortKey === "margin" ? (marginOf(x) ?? -Infinity) : profitOf(x);

  const sorted = useMemo(() => {
    const arr = [...groups];
    arr.sort((a, b) => (sortVal(a) - sortVal(b)) * (sortDir === "asc" ? 1 : -1));
    for (const g of arr) g.subs.sort((a, b) => (sortVal(a) - sortVal(b)) * (sortDir === "asc" ? 1 : -1));
    return arr;
    // eslint-disable-next-line
  }, [groups, sortKey, sortDir]);

  const totals = useMemo(() => {
    let qty = 0, revenue = 0, cost = 0;
    for (const g of groups) { qty += g.qty; revenue += g.revenue; cost += g.cost; }
    return { qty, revenue, cost, profit: revenue - cost, margin: revenue ? ((revenue - cost) / revenue) * 100 : null };
  }, [groups]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  }
  function toggleExpand(k: string) {
    setExpanded((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  }
  const arrow = (k: SortKey) => (sortKey === k ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  const groupHead = groupBy === "material" ? "Материал" : "Контрагент";
  const subHead = groupBy === "material" ? "контрагент" : "материал";

  return (
    <div>
      {/* Период */}
      <div className="card p-3 mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">От дата</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">До дата</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={load}>Покажи</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Общо приход" value={fmtLv(totals.revenue)} color="blue" />
        <Stat label="Обща себестойност" value={fmtLv(totals.cost)} color="slate" />
        <Stat label="Реализирана печалба" value={money(totals.profit)} color={totals.profit >= 0 ? "green" : "red"} />
        <Stat label="Марж" value={totals.margin == null ? "—" : `${totals.margin.toFixed(1)} %`} color="amber" />
      </div>

      {loading ? (
        <Loading />
      ) : sorted.length === 0 ? (
        <Empty text="Няма продажби с цена за избрания период." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] rtable">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">{groupHead}</th>
                <th className="th text-right cursor-pointer select-none" onClick={() => toggleSort("qty")}>Количество{arrow("qty")}</th>
                <th className="th text-right cursor-pointer select-none" onClick={() => toggleSort("revenue")}>Приход{arrow("revenue")}</th>
                <th className="th text-right">Себестойност</th>
                <th className="th text-right cursor-pointer select-none" onClick={() => toggleSort("profit")}>Печалба{arrow("profit")}</th>
                <th className="th text-right cursor-pointer select-none" onClick={() => toggleSort("margin")}>Марж{arrow("margin")}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((g) => {
                const gp = profitOf(g);
                const gm = marginOf(g);
                const isOpen = expanded.has(g.key);
                return (
                  <FragmentRows key={g.key}>
                    <tr className="hover:bg-slate-50 cursor-pointer" onClick={() => toggleExpand(g.key)}>
                      <td className="td font-medium text-slate-900" data-label={groupHead}>
                        <span className="text-slate-400 mr-1">{isOpen ? "▾" : "▸"}</span>{g.label}
                      </td>
                      <td className="td text-right" data-label="Количество">{fmtKg(g.qty)}</td>
                      <td className="td text-right" data-label="Приход">{fmtLv(g.revenue)}</td>
                      <td className="td text-right" data-label="Себестойност">{fmtLv(g.cost)}</td>
                      <td className={`td text-right font-semibold ${profitCls(gp)}`} data-label="Печалба">{money(gp)}</td>
                      <td className={`td text-right ${profitCls(gm)}`} data-label="Марж">{gm == null ? "—" : `${gm.toFixed(1)} %`}</td>
                    </tr>
                    {isOpen &&
                      g.subs.map((sub) => {
                        const sp = profitOf(sub);
                        const sm = marginOf(sub);
                        return (
                          <tr key={g.key + "|" + sub.key} className="bg-slate-50/60 text-sm">
                            <td className="td pl-8 text-slate-600" data-label={subHead}>↳ {sub.label}</td>
                            <td className="td text-right text-slate-600" data-label="Количество">{fmtKg(sub.qty)}</td>
                            <td className="td text-right text-slate-600" data-label="Приход">{fmtLv(sub.revenue)}</td>
                            <td className="td text-right text-slate-600" data-label="Себестойност">{fmtLv(sub.cost)}</td>
                            <td className={`td text-right ${profitCls(sp)}`} data-label="Печалба">{money(sp)}</td>
                            <td className={`td text-right ${profitCls(sm)}`} data-label="Марж">{sm == null ? "—" : `${sm.toFixed(1)} %`}</td>
                          </tr>
                        );
                      })}
                  </FragmentRows>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td className="td">Общо</td>
                <td className="td text-right">{fmtKg(totals.qty)}</td>
                <td className="td text-right">{fmtLv(totals.revenue)}</td>
                <td className="td text-right">{fmtLv(totals.cost)}</td>
                <td className={`td text-right ${profitCls(totals.profit)}`}>{money(totals.profit)}</td>
                <td className="td text-right">{totals.margin == null ? "—" : `${totals.margin.toFixed(1)} %`}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400 mt-3">
        Реализирана печалба = приход (продажна стойност) − себестойност (по средна цена). Клик върху ред
        разгъва разбивка по {subHead}; клик върху заглавие на колона сортира. Продажби без цена не се включват.
      </p>
    </div>
  );
}

// Помощник за групиране на няколко <tr> без обвиващ елемент
function FragmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// ══════════════════════════════════════════════════════════════════════════════
// Таб 3 — По контрагенти (доставчици): закупувания + потенциална печалба
// ══════════════════════════════════════════════════════════════════════════════
type PSub = { key: string; label: string; qty: number; cost: number; pRev: number; pCost: number };
type PGroup = { key: string; label: string; qty: number; cost: number; pRev: number; pCost: number; subs: PSub[] };
type PSortKey = "profit" | "cost" | "qty" | "margin";

function PurchasesBySupplier() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [sellMap, setSellMap] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<PSortKey>("profit");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  async function load() {
    setLoading(true);
    const [dRes, mRes] = await Promise.all([
      supabase
        .from("wh_deliveries")
        .select("*, wh_suppliers(name), wh_delivery_allocations(material_id, quantity_kg, value, wh_materials(name))")
        .eq("voided", false)
        .gte("doc_date", isoStart(from))
        .lte("doc_date", isoEnd(to))
        .order("doc_date", { ascending: false }),
      supabase.from("wh_materials").select("id, sell_price"),
    ]);
    const sm: Record<string, number | null> = {};
    for (const m of (mRes.data as any[]) || []) sm[m.id] = m.sell_price != null ? Number(m.sell_price) : null;
    setSellMap(sm);
    setDeliveries(dRes.data || []);
    setExpanded(new Set());
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const groups = useMemo(() => {
    const map = new Map<string, PGroup>();
    for (const d of deliveries) {
      const gKey = d.supplier_id ? "sup:" + d.supplier_id : "name:" + (d.supplier_name || "—");
      const gLabel = d.wh_suppliers?.name || d.supplier_name || "—";
      const dUnit = d.unit_price != null ? Number(d.unit_price) : null;
      const allocs = d.wh_delivery_allocations || [];
      for (const a of allocs) {
        const qty = Number(a.quantity_kg || 0);
        // изкупна стойност: alloc.value, иначе delivery.unit_price × qty
        const cost = a.value != null ? Number(a.value) : dUnit != null ? dUnit * qty : null;
        if (cost == null) continue; // само с цена
        const sell = a.material_id != null ? sellMap[a.material_id] ?? null : null;
        const pRev = sell != null ? qty * sell : 0;
        const pCost = sell != null ? cost : 0;
        const sKey = a.material_id || "—";
        const sLabel = a.wh_materials?.name || "—";
        let g = map.get(gKey);
        if (!g) { g = { key: gKey, label: gLabel, qty: 0, cost: 0, pRev: 0, pCost: 0, subs: [] }; map.set(gKey, g); }
        g.qty += qty; g.cost += cost; g.pRev += pRev; g.pCost += pCost;
        let sub = g.subs.find((x) => x.key === sKey);
        if (!sub) { sub = { key: sKey, label: sLabel, qty: 0, cost: 0, pRev: 0, pCost: 0 }; g.subs.push(sub); }
        sub.qty += qty; sub.cost += cost; sub.pRev += pRev; sub.pCost += pCost;
      }
    }
    return Array.from(map.values());
  }, [deliveries, sellMap]);

  const profitOf = (x: { pRev: number; pCost: number }) => x.pRev - x.pCost;
  const marginOf = (x: { pRev: number; pCost: number }) => (x.pRev ? ((x.pRev - x.pCost) / x.pRev) * 100 : null);
  const avgPrice = (x: { qty: number; cost: number }) => (x.qty ? x.cost / x.qty : 0);

  const sortVal = (x: PGroup | PSub) =>
    sortKey === "qty" ? x.qty : sortKey === "cost" ? x.cost : sortKey === "margin" ? (marginOf(x) ?? -Infinity) : profitOf(x);

  const sorted = useMemo(() => {
    const arr = [...groups];
    arr.sort((a, b) => (sortVal(a) - sortVal(b)) * (sortDir === "asc" ? 1 : -1));
    for (const g of arr) g.subs.sort((a, b) => (sortVal(a) - sortVal(b)) * (sortDir === "asc" ? 1 : -1));
    return arr;
    // eslint-disable-next-line
  }, [groups, sortKey, sortDir]);

  const totals = useMemo(() => {
    let qty = 0, cost = 0, pRev = 0, pCost = 0;
    for (const g of groups) { qty += g.qty; cost += g.cost; pRev += g.pRev; pCost += g.pCost; }
    return { qty, cost, pRev, pCost, profit: pRev - pCost, margin: pRev ? ((pRev - pCost) / pRev) * 100 : null };
  }, [groups]);

  function toggleSort(k: PSortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  }
  function toggleExpand(k: string) {
    setExpanded((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  }
  const arrow = (k: PSortKey) => (sortKey === k ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  return (
    <div>
      <div className="card p-3 mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">От дата</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">До дата</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={load}>Покажи</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Общо закупено" value={fmtKg(totals.qty)} color="blue" />
        <Stat label="Стойност на покупките" value={fmtLv(totals.cost)} color="slate" />
        <Stat label="Потенциална печалба" value={money(totals.profit)} color={totals.profit >= 0 ? "green" : "red"} sub="при текущите продажни цени" />
        <Stat label="Марж" value={totals.margin == null ? "—" : `${totals.margin.toFixed(1)} %`} color="amber" />
      </div>

      {loading ? (
        <Loading />
      ) : sorted.length === 0 ? (
        <Empty text="Няма доставки с изкупна цена за избрания период." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] rtable">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Доставчик</th>
                <th className="th text-right cursor-pointer select-none" onClick={() => toggleSort("qty")}>Количество{arrow("qty")}</th>
                <th className="th text-right cursor-pointer select-none" onClick={() => toggleSort("cost")}>Стойност (покупка){arrow("cost")}</th>
                <th className="th text-right">Ср. изкупна цена</th>
                <th className="th text-right cursor-pointer select-none" onClick={() => toggleSort("profit")}>Потенц. печалба{arrow("profit")}</th>
                <th className="th text-right cursor-pointer select-none" onClick={() => toggleSort("margin")}>Марж{arrow("margin")}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((g) => {
                const gp = profitOf(g);
                const gm = marginOf(g);
                const isOpen = expanded.has(g.key);
                return (
                  <FragmentRows key={g.key}>
                    <tr className="hover:bg-slate-50 cursor-pointer" onClick={() => toggleExpand(g.key)}>
                      <td className="td font-medium text-slate-900" data-label="Доставчик">
                        <span className="text-slate-400 mr-1">{isOpen ? "▾" : "▸"}</span>{g.label}
                      </td>
                      <td className="td text-right" data-label="Количество">{fmtKg(g.qty)}</td>
                      <td className="td text-right" data-label="Стойност (покупка)">{fmtLv(g.cost)}</td>
                      <td className="td text-right" data-label="Ср. изкупна цена">{fmtPrice(avgPrice(g))}</td>
                      <td className={`td text-right font-semibold ${profitCls(g.pRev ? gp : null)}`} data-label="Потенц. печалба">{g.pRev ? money(gp) : "—"}</td>
                      <td className={`td text-right ${profitCls(gm)}`} data-label="Марж">{gm == null ? "—" : `${gm.toFixed(1)} %`}</td>
                    </tr>
                    {isOpen &&
                      g.subs.map((sub) => {
                        const sp = profitOf(sub);
                        const sm = marginOf(sub);
                        return (
                          <tr key={g.key + "|" + sub.key} className="bg-slate-50/60 text-sm">
                            <td className="td pl-8 text-slate-600" data-label="Материал">↳ {sub.label}</td>
                            <td className="td text-right text-slate-600" data-label="Количество">{fmtKg(sub.qty)}</td>
                            <td className="td text-right text-slate-600" data-label="Стойност (покупка)">{fmtLv(sub.cost)}</td>
                            <td className="td text-right text-slate-600" data-label="Ср. изкупна цена">{fmtPrice(avgPrice(sub))}</td>
                            <td className={`td text-right ${profitCls(sub.pRev ? sp : null)}`} data-label="Потенц. печалба">{sub.pRev ? money(sp) : "—"}</td>
                            <td className={`td text-right ${profitCls(sm)}`} data-label="Марж">{sm == null ? "—" : `${sm.toFixed(1)} %`}</td>
                          </tr>
                        );
                      })}
                  </FragmentRows>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td className="td">Общо</td>
                <td className="td text-right">{fmtKg(totals.qty)}</td>
                <td className="td text-right">{fmtLv(totals.cost)}</td>
                <td className="td text-right">{fmtPrice(avgPrice(totals))}</td>
                <td className={`td text-right ${profitCls(totals.pRev ? totals.profit : null)}`}>{totals.pRev ? money(totals.profit) : "—"}</td>
                <td className="td text-right">{totals.margin == null ? "—" : `${totals.margin.toFixed(1)} %`}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400 mt-3">
        Справка по доставчик (от кого купуваме). Потенциална печалба = закупено количество × (текуща
        продажна цена − изкупна цена), само за материали с въведена продажна цена. Доставки/кантарни
        бележки без изкупна цена не се включват. Клик върху ред разгъва материалите; клик върху заглавие сортира.
      </p>
    </div>
  );
}
