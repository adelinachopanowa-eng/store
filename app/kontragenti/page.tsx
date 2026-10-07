"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Supplier } from "@/lib/types";
import { fmtKg, fmtLv, fmtDate } from "@/lib/format";
import { PageHeader, Loading, Empty, Stat } from "@/components/ui";

type Doc = {
  id: string;
  kind: "Доставка" | "Продажба";
  date: string;
  ref: string;
  material: string;
  qty: number;
  value: number | null;
  paid: boolean;
};

type Party = {
  key: string;
  name: string;
  city: string | null;
  supplierId: string | null;
  bought: number; // стойност на покупките
  sold: number; // стойност на продажбите
  unpaid: number;
  docs: Doc[];
};

const partyKey = (supplierId: string | null | undefined, name: string | null | undefined) =>
  supplierId ? "sup:" + supplierId : "name:" + (name || "—");

export default function CounterpartiesPage() {
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const since = new Date(Date.now() - 365 * 864e5).toISOString();
    const [sup, del, sal] = await Promise.all([
      supabase.from("wh_suppliers").select("*").eq("active", true).order("name"),
      supabase
        .from("wh_deliveries")
        .select("*, wh_suppliers(name), wh_delivery_allocations(quantity_kg, client_name, wh_materials(name))")
        .eq("voided", false)
        .gte("doc_date", since)
        .order("doc_date", { ascending: false }),
      supabase
        .from("wh_sales")
        .select("*, wh_suppliers(name), wh_materials(name)")
        .eq("voided", false)
        .gte("doc_date", since)
        .order("doc_date", { ascending: false }),
    ]);

    const map = new Map<string, Party>();
    const ensure = (sid: string | null, name: string, city: string | null) => {
      const k = partyKey(sid, name);
      let p = map.get(k);
      if (!p) {
        p = { key: k, name: name || "—", city, supplierId: sid, bought: 0, sold: 0, unpaid: 0, docs: [] };
        map.set(k, p);
      }
      return p;
    };

    // всички активни контрагенти, дори без движения
    for (const s of (sup.data as Supplier[]) || []) ensure(s.id, s.name, s.city);

    for (const d of (del.data as any[]) || []) {
      const name = d.wh_suppliers?.name || d.supplier_name || "—";
      const p = ensure(d.supplier_id || null, name, null);
      const mats = (d.wh_delivery_allocations || [])
        .map((a: any) => a.wh_materials?.name || a.client_name)
        .filter(Boolean);
      const val = d.total_value != null ? Number(d.total_value) : 0;
      p.bought += val;
      if (!d.paid) p.unpaid += val;
      p.docs.push({
        id: d.id,
        kind: "Доставка",
        date: d.weighed_at || d.doc_date,
        ref: d.seq_no != null ? `#${d.seq_no}` : d.doc_number || "—",
        material: mats.length ? (mats.length > 1 ? `${mats[0]} +${mats.length - 1}` : mats[0]) : "—",
        qty: Number(d.net_quantity || 0),
        value: d.total_value != null ? Number(d.total_value) : null,
        paid: !!d.paid,
      });
    }

    for (const s of (sal.data as any[]) || []) {
      const name = s.wh_suppliers?.name || s.buyer_name || "—";
      const p = ensure(s.supplier_id || null, name, null);
      const val = s.sale_value != null ? Number(s.sale_value) : 0;
      p.sold += val;
      if (!s.paid) p.unpaid += val;
      p.docs.push({
        id: s.id,
        kind: "Продажба",
        date: s.doc_date,
        ref: s.doc_number || "—",
        material: s.wh_materials?.name || "—",
        qty: Number(s.quantity_kg || 0),
        value: s.sale_value != null ? Number(s.sale_value) : null,
        paid: !!s.paid,
      });
    }

    const arr = Array.from(map.values());
    for (const p of arr) p.docs.sort((a, b) => +new Date(b.date) - +new Date(a.date));
    arr.sort((a, b) => b.docs.length - a.docs.length || a.name.localeCompare(b.name, "bg"));
    setParties(arr);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return parties;
    return parties.filter((p) => p.name.toLowerCase().includes(q) || (p.city || "").toLowerCase().includes(q));
  }, [parties, query]);

  const open = openKey ? parties.find((p) => p.key === openKey) || null : null;

  if (open) return <PartyDetail party={open} onBack={() => setOpenKey(null)} />;

  return (
    <div>
      <PageHeader title="Контрагенти" subtitle="Бърз достъп до доставките и продажбите по контрагент" />

      <div className="card p-3 mb-4">
        <label className="label">Търсене</label>
        <input
          className="input"
          type="search"
          value={query}
          placeholder="Име или град…"
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="mt-2 text-xs text-slate-400 tabular-nums">
          {query ? `Показани ${shown.length} от ${parties.length}` : `${parties.length} контрагента`}
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : shown.length === 0 ? (
        <Empty text="Няма намерени контрагенти." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {shown.map((p) => (
            <button
              key={p.key}
              onClick={() => setOpenKey(p.key)}
              className="card p-4 text-left hover:border-brand-500 hover:shadow transition min-w-0"
            >
              <div className="font-semibold text-slate-900 truncate">{p.name}</div>
              <div className="text-xs text-slate-400 truncate">
                {p.city || (p.supplierId ? "—" : "свободен текст")}
              </div>
              <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                <span className="tabular-nums text-slate-600">
                  <span className="text-slate-400">док.</span> {p.docs.length}
                </span>
                {p.bought > 0 && (
                  <span className="tabular-nums text-slate-600">
                    <span className="text-slate-400">купено</span> {fmtLv(p.bought)}
                  </span>
                )}
                {p.sold > 0 && (
                  <span className="tabular-nums text-slate-600">
                    <span className="text-slate-400">продадено</span> {fmtLv(p.sold)}
                  </span>
                )}
              </div>
              {p.unpaid > 0 && (
                <div className="mt-2 inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 tabular-nums">
                  неплатено {fmtLv(p.unpaid)}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PartyDetail({ party, onBack }: { party: Party; onBack: () => void }) {
  return (
    <div>
      <PageHeader
        title={party.name}
        subtitle={party.city || "Движения за последните 12 месеца"}
        actions={
          <button className="btn-secondary" onClick={onBack}>
            ← Назад
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Документи" value={String(party.docs.length)} />
        <Stat label="Купено от него" value={fmtLv(party.bought)} color="blue" />
        <Stat label="Продадено му" value={fmtLv(party.sold)} color="green" />
        <Stat label="Неплатено" value={fmtLv(party.unpaid)} color={party.unpaid > 0 ? "red" : "slate"} />
      </div>

      {party.docs.length === 0 ? (
        <Empty text="Няма движения за последните 12 месеца." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] rtable">
            <thead>
              <tr>
                <th className="th">Тип</th>
                <th className="th">Дата</th>
                <th className="th">Документ</th>
                <th className="th">Материал</th>
                <th className="th text-right">Количество</th>
                <th className="th text-right">Стойност</th>
                <th className="th">Плащане</th>
              </tr>
            </thead>
            <tbody>
              {party.docs.map((d) => (
                <tr key={d.kind + d.id} className="hover:bg-brand-50/60">
                  <td className="td" data-label="Тип">{d.kind}</td>
                  <td className="td whitespace-nowrap" data-label="Дата">{fmtDate(d.date)}</td>
                  <td className="td" data-label="Документ">{d.ref}</td>
                  <td className="td" data-label="Материал">{d.material}</td>
                  <td className="td text-right" data-label="Количество">{fmtKg(d.qty)}</td>
                  <td className="td text-right font-medium" data-label="Стойност">
                    {d.value != null ? fmtLv(d.value) : "—"}
                  </td>
                  <td className="td" data-label="Плащане">
                    <span
                      className={`badge ${
                        d.paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {d.paid ? "Платено" : "Не"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
