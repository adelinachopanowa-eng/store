"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { GroupBalance, Supplier } from "@/lib/types";
import { fmtKg, fmtLv, fmtPrice, fmtDate } from "@/lib/format";
import { PageHeader, Loading, Empty, Modal } from "@/components/ui";

export default function SalesPage() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<GroupBalance[]>([]);
  const [customers, setCustomers] = useState<Supplier[]>([]);

  const [groupId, setGroupId] = useState("");
  const [buyerId, setBuyerId] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [pay, setPay] = useState<"cash" | "bank">("bank");
  const [paid, setPaid] = useState(false);
  const [docNumber, setDocNumber] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadRefs() {
    const [g, c] = await Promise.all([
      supabase.from("wh_group_balances").select("*").eq("active", true).order("group_name"),
      supabase.from("wh_suppliers").select("*").eq("active", true).order("name"),
    ]);
    setGroups((g.data as GroupBalance[]) || []);
    setCustomers((c.data as Supplier[]) || []);
  }
  async function loadList() {
    setLoading(true);
    const { data } = await supabase
      .from("wh_sales")
      .select("*, wh_groups(name), wh_suppliers(name)")
      .order("doc_date", { ascending: false })
      .limit(100);
    setList(data || []);
    setLoading(false);
  }
  useEffect(() => {
    loadRefs();
    loadList();
  }, []);

  const sel = groups.find((g) => g.group_id === groupId);
  const qtyN = Number(qty) || 0;
  const priceN = Number(price) || 0;
  const cost = sel ? qtyN * Number(sel.avg_price) : 0;
  const revenue = qtyN * priceN;
  const profit = revenue - cost;

  function reset() {
    setGroupId("");
    setBuyerId("");
    setBuyerName("");
    setQty("");
    setPrice("");
    setPay("bank");
    setPaid(false);
    setDocNumber("");
    setNote("");
    setErr("");
  }

  async function save() {
    setErr("");
    if (!groupId) return setErr("Изберете група.");
    if (qtyN <= 0) return setErr("Въведете количество.");
    if (sel && qtyN > Number(sel.quantity_kg) + 0.001)
      return setErr(`Недостатъчна наличност (${fmtKg(sel.quantity_kg)}).`);
    setSaving(true);
    const { error } = await supabase.rpc("wh_record_sale", {
      p_group_id: groupId,
      p_supplier_id: buyerId || null,
      p_buyer_name: buyerId ? null : buyerName || null,
      p_quantity_kg: qtyN,
      p_unit_price: priceN || null,
      p_payment_method: pay,
      p_paid: paid,
      p_doc_number: docNumber || null,
      p_doc_date: new Date().toISOString(),
      p_note: note || null,
      p_operator_name: null,
    });
    setSaving(false);
    if (error) return setErr(error.message);
    reset();
    setOpen(false);
    loadList();
    loadRefs();
  }

  return (
    <div>
      <PageHeader
        title="Продажби / Експедиции"
        subtitle="Изписване на стоки по средна себестойност"
        actions={
          <button
            className="btn-primary"
            onClick={() => {
              reset();
              setOpen(true);
            }}
          >
            + Нова продажба
          </button>
        }
      />

      {loading ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty text="Няма продажби." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Дата</th>
                <th className="th">№</th>
                <th className="th">Група</th>
                <th className="th">Купувач</th>
                <th className="th text-right">Кол-во</th>
                <th className="th text-right">Себест.</th>
                <th className="th text-right">Прод. цена</th>
                <th className="th text-right">Приход</th>
                <th className="th">Плащане</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="td whitespace-nowrap">{fmtDate(s.doc_date)}</td>
                  <td className="td">{s.doc_number || "—"}</td>
                  <td className="td">{s.wh_groups?.name || "—"}</td>
                  <td className="td">{s.wh_suppliers?.name || s.buyer_name || "—"}</td>
                  <td className="td text-right">{fmtKg(s.quantity_kg)}</td>
                  <td className="td text-right">{fmtPrice(s.avg_cost)}</td>
                  <td className="td text-right">{s.unit_price != null ? fmtPrice(s.unit_price) : "—"}</td>
                  <td className="td text-right font-medium">{s.sale_value != null ? fmtLv(s.sale_value) : "—"}</td>
                  <td className="td">
                    <span className={`badge ${s.paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {s.payment_method === "bank" ? "Банка" : "Брой"} · {s.paid ? "Платено" : "Не"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Нова продажба / експедиция">
        <div className="space-y-4">
          <div>
            <label className="label">Група *</label>
            <select className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">— изберете —</option>
              {groups.map((g) => (
                <option key={g.group_id} value={g.group_id}>
                  {g.group_name} · налично {fmtKg(g.quantity_kg)} · ср.цена {fmtPrice(g.avg_price)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Купувач (от база)</label>
              <select
                className="input"
                value={buyerId}
                onChange={(e) => {
                  setBuyerId(e.target.value);
                  if (e.target.value) setBuyerName("");
                }}
              >
                <option value="">— ad-hoc —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">или ръчно</label>
              <input className="input" value={buyerName} disabled={!!buyerId} onChange={(e) => setBuyerName(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Количество (кг) *</label>
              <input className="input" type="number" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div>
              <label className="label">Продажна цена (лв/кг)</label>
              <input className="input" type="number" step="0.0001" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div>
              <label className="label">Документ №</label>
              <input className="input" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
            </div>
          </div>

          {sel && (
            <div className="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3 text-sm">
              <div>
                <span className="text-slate-500">Себестойност: </span>
                <span className="font-semibold">{fmtLv(cost)}</span>
              </div>
              <div>
                <span className="text-slate-500">Приход: </span>
                <span className="font-semibold">{fmtLv(revenue)}</span>
              </div>
              <div>
                <span className="text-slate-500">Печалба: </span>
                <span className={`font-semibold ${profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmtLv(profit)}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className="label">Начин на плащане</label>
              <select className="input" value={pay} onChange={(e) => setPay(e.target.value as any)}>
                <option value="bank">По банка</option>
                <option value="cash">В брой</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pb-2">
              <input id="paidS" type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="h-4 w-4" />
              <label htmlFor="paidS" className="text-sm text-slate-700">
                Платено
              </label>
            </div>
          </div>
          <div>
            <label className="label">Бележка</label>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button className="btn-secondary" onClick={() => setOpen(false)}>
              Отказ
            </button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? "Запис…" : "Запиши продажба"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
