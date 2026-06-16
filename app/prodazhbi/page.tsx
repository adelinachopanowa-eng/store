"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MaterialBalance, Supplier } from "@/lib/types";
import { fmtKg, fmtLv, fmtPrice, fmtDate } from "@/lib/format";
import {
  PageHeader,
  Loading,
  Empty,
  Modal,
  Field,
  FormGrid,
  FormActions,
  FormError,
  VoidButton,
  VoidedBadge,
} from "@/components/ui";
import Combobox, { ComboValue } from "@/components/Combobox";

export default function SalesPage() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [materials, setMaterials] = useState<MaterialBalance[]>([]);
  const [customers, setCustomers] = useState<Supplier[]>([]);

  const [materialId, setMaterialId] = useState("");
  const [buyer, setBuyer] = useState<ComboValue>({ id: null, name: "" });
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [pay, setPay] = useState<"cash" | "bank">("bank");
  const [paid, setPaid] = useState(false);
  const [docNumber, setDocNumber] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadRefs() {
    const [m, c] = await Promise.all([
      supabase.from("wh_material_balances").select("*").order("material_name"),
      supabase.from("wh_suppliers").select("*").eq("active", true).order("name"),
    ]);
    setMaterials((m.data as MaterialBalance[]) || []);
    setCustomers((c.data as Supplier[]) || []);
  }
  async function loadList() {
    setLoading(true);
    const { data } = await supabase
      .from("wh_sales")
      .select("*, wh_materials(name), wh_suppliers(name)")
      .order("doc_date", { ascending: false })
      .limit(100);
    setList(data || []);
    setLoading(false);
  }
  useEffect(() => {
    loadRefs();
    loadList();
  }, []);

  const sel = materials.find((m) => m.material_id === materialId);
  const qtyN = Number(qty) || 0;
  const priceN = Number(price) || 0;
  const cost = sel ? qtyN * Number(sel.avg_price) : 0;
  const revenue = qtyN * priceN;
  const profit = revenue - cost;

  function reset() {
    setMaterialId("");
    setBuyer({ id: null, name: "" });
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
    if (!materialId) return setErr("Изберете материал.");
    if (qtyN <= 0) return setErr("Въведете количество.");
    if (sel && qtyN > Number(sel.quantity_kg) + 0.001) return setErr(`Недостатъчна наличност (${fmtKg(sel.quantity_kg)}).`);
    setSaving(true);
    const { error } = await supabase.rpc("wh_record_sale", {
      p_material_id: materialId,
      p_supplier_id: buyer.id,
      p_buyer_name: buyer.id ? null : buyer.name || null,
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
                <th className="th">Материал</th>
                <th className="th">Купувач</th>
                <th className="th text-right">Кол-во</th>
                <th className="th text-right">Себест.</th>
                <th className="th text-right">Прод. цена</th>
                <th className="th text-right">Приход</th>
                <th className="th">Плащане</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className={`hover:bg-slate-50 ${s.voided ? "opacity-50" : ""}`}>
                  <td className="td whitespace-nowrap">{fmtDate(s.doc_date)}</td>
                  <td className="td">{s.doc_number || "—"}</td>
                  <td className="td">{s.wh_materials?.name || "—"}</td>
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
                  <td className="td">
                    {s.voided ? (
                      <VoidedBadge />
                    ) : (
                      <VoidButton
                        onVoid={async (reason) => {
                          const { error } = await supabase.rpc("wh_void_sale", {
                            p_sale_id: s.id,
                            p_reason: reason || null,
                            p_operator_name: null,
                          });
                          if (error) return error.message;
                          loadList();
                          loadRefs();
                        }}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Нова продажба / експедиция" wide>
        <div className="space-y-4">
          <FormGrid cols={2}>
            <Field label="Материал" required>
              <select className="input" value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
                <option value="">— изберете —</option>
                {materials.map((m) => (
                  <option key={m.material_id} value={m.material_id}>
                    {m.material_name} · {fmtKg(m.quantity_kg)} · {fmtPrice(m.avg_price)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Купувач" hint="изберете от базата или въведете нов">
              <Combobox
                items={customers.map((c) => ({ id: c.id, name: c.name }))}
                value={buyer}
                onChange={setBuyer}
                placeholder="Име на купувач"
              />
            </Field>
          </FormGrid>

          <FormGrid cols={3}>
            <Field label="Количество (т)" required>
              <input className="input" type="number" step="0.001" value={qty} onChange={(e) => setQty(e.target.value)} />
            </Field>
            <Field label="Продажна цена (€/т)">
              <input className="input" type="number" step="0.0001" value={price} onChange={(e) => setPrice(e.target.value)} />
            </Field>
            <Field label="Документ №">
              <input className="input" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
            </Field>
          </FormGrid>

          {sel && (
            <div className="grid grid-cols-3 gap-4 rounded-lg bg-slate-50 p-3 text-sm">
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

          <FormGrid cols={2}>
            <Field label="Начин на плащане">
              <select className="input" value={pay} onChange={(e) => setPay(e.target.value as any)}>
                <option value="bank">По банка</option>
                <option value="cash">В брой</option>
              </select>
            </Field>
            <Field label="Статус">
              <label className="input flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="h-4 w-4" />
                <span className="text-sm text-slate-700">Платено</span>
              </label>
            </Field>
          </FormGrid>

          <Field label="Бележка">
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>

          <FormError msg={err} />
          <FormActions>
            <button className="btn-secondary" onClick={() => setOpen(false)}>
              Отказ
            </button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? "Запис…" : "Запиши продажба"}
            </button>
          </FormActions>
        </div>
      </Modal>
    </div>
  );
}
