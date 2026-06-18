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
  InvoiceBadge,
} from "@/components/ui";
import Combobox, { ComboValue } from "@/components/Combobox";

export default function SalesPage() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [materials, setMaterials] = useState<MaterialBalance[]>([]);
  const [customers, setCustomers] = useState<Supplier[]>([]);

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

  return (
    <div>
      <PageHeader
        title="Продажби / Експедиции"
        subtitle="Изписване на стоки по средна себестойност"
        actions={
          <button
            className="btn-primary"
            onClick={() => {
              setEditItem(null);
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
                <th className="th">Фактура</th>
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
                  <td className="td text-right">
                    {s.unit_price != null ? fmtPrice(s.unit_price) : <span className="text-amber-500 text-xs">без цена</span>}
                  </td>
                  <td className="td text-right font-medium">{s.sale_value != null ? fmtLv(s.sale_value) : "—"}</td>
                  <td className="td">
                    {s.needs_invoice && <InvoiceBadge invoiced={s.invoiced} number={s.invoice_number} />}
                  </td>
                  <td className="td">
                    <span className={`badge ${s.paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {s.payment_method === "bank" ? "Банка" : "Брой"} · {s.paid ? "Платено" : "Не"}
                    </span>
                  </td>
                  <td className="td">
                    {s.voided ? (
                      <VoidedBadge />
                    ) : (
                      <div className="flex gap-1 items-center">
                        <button
                          className="text-xs text-slate-500 hover:text-brand-600 px-2 py-1 rounded hover:bg-slate-100"
                          onClick={() => { setEditItem(s); setOpen(true); }}
                        >
                          Редакция
                        </button>
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
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SaleModal
        open={open}
        onClose={() => setOpen(false)}
        editItem={editItem}
        materials={materials}
        customers={customers}
        onSaved={() => { loadList(); loadRefs(); }}
      />
    </div>
  );
}

// ─── New / Edit modal ────────────────────────────────────────────────────────

function SaleModal({
  open,
  onClose,
  editItem,
  materials,
  customers,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editItem: any | null;
  materials: MaterialBalance[];
  customers: Supplier[];
  onSaved: () => void;
}) {
  const isEdit = !!editItem;

  const [materialId, setMaterialId] = useState("");
  const [buyer, setBuyer] = useState<ComboValue>({ id: null, name: "" });
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [pay, setPay] = useState<"cash" | "bank">("bank");
  const [paid, setPaid] = useState(false);
  const [needsInvoice, setNeedsInvoice] = useState(false);
  const [invoiced, setInvoiced] = useState(false);
  const [invNumber, setInvNumber] = useState("");
  const [invDate, setInvDate] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [docDate, setDocDate] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editItem) {
      setMaterialId(editItem.material_id || "");
      setBuyer(
        editItem.supplier_id
          ? { id: editItem.supplier_id, name: editItem.wh_suppliers?.name || "" }
          : { id: null, name: editItem.buyer_name || "" }
      );
      setQty(String(editItem.quantity_kg ?? ""));
      setPrice(editItem.unit_price != null ? String(editItem.unit_price) : "");
      setPay(editItem.payment_method || "bank");
      setPaid(!!editItem.paid);
      setNeedsInvoice(!!editItem.needs_invoice);
      setInvoiced(!!editItem.invoiced);
      setInvNumber(editItem.invoice_number || "");
      setInvDate(editItem.invoice_date ? editItem.invoice_date.slice(0, 10) : "");
      setDocNumber(editItem.doc_number || "");
      setDocDate(editItem.doc_date ? editItem.doc_date.slice(0, 10) : "");
      setNote(editItem.note || "");
    } else {
      setMaterialId("");
      setBuyer({ id: null, name: "" });
      setQty("");
      setPrice("");
      setPay("bank");
      setPaid(false);
      setNeedsInvoice(false);
      setInvoiced(false);
      setInvNumber("");
      setInvDate("");
      setDocNumber("");
      setDocDate("");
      setNote("");
    }
    setErr("");
  }, [open, editItem]);

  const sel = materials.find((m) => m.material_id === materialId);
  const qtyN = Number(qty) || 0;
  const priceN = price !== "" ? Number(price) : null;
  const cost = sel ? qtyN * Number(sel.avg_price) : 0;
  const revenue = priceN != null ? qtyN * priceN : null;
  const profit = revenue != null ? revenue - cost : null;

  async function save() {
    setErr("");
    setSaving(true);
    try {
      if (isEdit) {
        const { error } = await supabase.rpc("wh_update_sale", {
          p_sale_id: editItem.id,
          p_doc_number: docNumber || null,
          p_doc_date: docDate ? new Date(docDate + "T12:00:00").toISOString() : null,
          p_supplier_id: buyer.id,
          p_buyer_name: buyer.id ? null : buyer.name || null,
          p_unit_price: priceN,
          p_payment_method: pay,
          p_paid: paid,
          p_note: note || null,
          p_needs_invoice: needsInvoice,
          p_invoiced: needsInvoice ? invoiced : false,
          p_invoice_number: needsInvoice && invoiced ? invNumber || null : null,
          p_invoice_date: needsInvoice && invoiced && invDate ? new Date(invDate + "T12:00:00").toISOString() : null,
        });
        if (error) throw new Error(error.message);
      } else {
        if (!materialId) return setErr("Изберете материал.");
        if (qtyN <= 0) return setErr("Въведете количество.");
        if (sel && qtyN > Number(sel.quantity_kg) + 0.001) return setErr(`Недостатъчна наличност (${fmtKg(sel.quantity_kg)}).`);

        const { error } = await supabase.rpc("wh_record_sale", {
          p_material_id: materialId,
          p_supplier_id: buyer.id,
          p_buyer_name: buyer.id ? null : buyer.name || null,
          p_quantity_kg: qtyN,
          p_unit_price: priceN,
          p_payment_method: pay,
          p_paid: paid,
          p_doc_number: docNumber || null,
          p_doc_date: docDate ? new Date(docDate + "T12:00:00").toISOString() : new Date().toISOString(),
          p_note: note || null,
          p_operator_name: null,
        });
        if (error) throw new Error(error.message);
      }

      onSaved();
      onClose();
    } catch (e: any) {
      setErr(e.message || "Грешка при запис");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Редакция на продажба" : "Нова продажба / експедиция"} wide>
      <div className="space-y-4">
        <FormGrid cols={2}>
          <Field label="Материал" required={!isEdit}>
            <select
              className="input"
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              disabled={isEdit}
            >
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
          <Field label="Количество (т)" required={!isEdit}>
            <input
              className="input"
              type="number"
              step="0.001"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              readOnly={isEdit}
              disabled={isEdit}
            />
          </Field>
          <Field label="Продажна цена (€/т)" hint="може да се добави по-късно">
            <input className="input" type="number" step="0.0001" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <Field label="Документ №">
            <input className="input" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
          </Field>
        </FormGrid>

        <FormGrid cols={1}>
          <Field label="Дата">
            <input className="input" type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
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
              <span className="font-semibold">{revenue != null ? fmtLv(revenue) : "—"}</span>
            </div>
            <div>
              <span className="text-slate-500">Печалба: </span>
              <span className={`font-semibold ${profit != null ? (profit >= 0 ? "text-emerald-600" : "text-red-600") : ""}`}>
                {profit != null ? fmtLv(profit) : "—"}
              </span>
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

        {isEdit && (
          <div className="rounded-lg border border-slate-200 p-3 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={needsInvoice} onChange={(e) => { setNeedsInvoice(e.target.checked); if (!e.target.checked) setInvoiced(false); }} className="h-4 w-4" />
              <span className="text-sm font-medium text-slate-700">Очаква фактура</span>
            </label>
            {needsInvoice && (
              <>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={invoiced} onChange={(e) => setInvoiced(e.target.checked)} className="h-4 w-4" />
                  <span className="text-sm text-slate-700">Фактурирана</span>
                </label>
                {invoiced && (
                  <FormGrid cols={2}>
                    <Field label="Фактура №">
                      <input className="input" value={invNumber} onChange={(e) => setInvNumber(e.target.value)} />
                    </Field>
                    <Field label="Дата на фактура">
                      <input className="input" type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)} />
                    </Field>
                  </FormGrid>
                )}
              </>
            )}
          </div>
        )}

        <Field label="Бележка">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        <FormError msg={err} />
        <FormActions>
          <button className="btn-secondary" onClick={onClose}>Отказ</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Запис…" : isEdit ? "Запази промените" : "Запиши продажба"}
          </button>
        </FormActions>
      </div>
    </Modal>
  );
}
