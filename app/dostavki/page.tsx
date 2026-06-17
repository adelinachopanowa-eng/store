"use client";

import { useEffect, useMemo, useState } from "react";
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

type Alloc = { mat: ComboValue; mode: "pct" | "kg"; amount: string };
const emptyMat: ComboValue = { id: null, name: "" };

export default function DeliveriesPage() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<MaterialBalance[]>([]);

  async function loadRefs() {
    const [s, m] = await Promise.all([
      supabase.from("wh_suppliers").select("*").eq("active", true).order("name"),
      supabase.from("wh_material_balances").select("*").order("material_name"),
    ]);
    setSuppliers((s.data as Supplier[]) || []);
    setMaterials((m.data as MaterialBalance[]) || []);
  }
  async function loadList() {
    setLoading(true);
    const { data } = await supabase
      .from("wh_deliveries")
      .select("*, wh_suppliers(name)")
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
        title="Доставки"
        subtitle="Въвеждане на доставки с разпределение по материали"
        actions={
          <button
            className="btn-primary"
            onClick={() => {
              setEditItem(null);
              setOpen(true);
            }}
          >
            + Нова доставка
          </button>
        }
      />

      {loading ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty text="Няма въведени доставки." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Дата</th>
                <th className="th">№</th>
                <th className="th">Доставчик</th>
                <th className="th text-right">Нето</th>
                <th className="th text-right">Цена</th>
                <th className="th text-right">Стойност</th>
                <th className="th">Плащане</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id} className={`hover:bg-slate-50 ${d.voided ? "opacity-50" : ""}`}>
                  <td className="td whitespace-nowrap">{fmtDate(d.doc_date)}</td>
                  <td className="td">{d.doc_number || "—"}</td>
                  <td className="td">{d.wh_suppliers?.name || d.supplier_name || "—"}</td>
                  <td className="td text-right">{fmtKg(d.net_quantity)}</td>
                  <td className="td text-right">{d.unit_price != null ? fmtPrice(d.unit_price) : <span className="text-amber-500 text-xs">без цена</span>}</td>
                  <td className="td text-right font-medium">{d.total_value != null ? fmtLv(d.total_value) : "—"}</td>
                  <td className="td">
                    <span className={`badge ${d.paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {d.payment_method === "bank" ? "Банка" : "Брой"} · {d.paid ? "Платено" : "Не"}
                    </span>
                  </td>
                  <td className="td">
                    {d.voided ? (
                      <VoidedBadge />
                    ) : (
                      <div className="flex gap-1 items-center">
                        <button
                          className="text-xs text-slate-500 hover:text-brand-600 px-2 py-1 rounded hover:bg-slate-100"
                          onClick={() => { setEditItem(d); setOpen(true); }}
                        >
                          Редакция
                        </button>
                        <VoidButton
                          onVoid={async (reason) => {
                            const { error } = await supabase.rpc("wh_void_delivery", {
                              p_delivery_id: d.id,
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

      <DeliveryModal
        open={open}
        onClose={() => setOpen(false)}
        editItem={editItem}
        suppliers={suppliers}
        materials={materials}
        onSaved={() => { loadList(); loadRefs(); }}
      />
    </div>
  );
}

// ─── New / Edit modal ────────────────────────────────────────────────────────

function DeliveryModal({
  open,
  onClose,
  editItem,
  suppliers,
  materials,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editItem: any | null;
  suppliers: Supplier[];
  materials: MaterialBalance[];
  onSaved: () => void;
}) {
  const isEdit = !!editItem;

  const [supplier, setSupplier] = useState<ComboValue>({ id: null, name: "" });
  const [net, setNet] = useState("");
  const [price, setPrice] = useState("");
  const [pay, setPay] = useState<"cash" | "bank">("cash");
  const [paid, setPaid] = useState(false);
  const [docNumber, setDocNumber] = useState("");
  const [docDate, setDocDate] = useState("");
  const [note, setNote] = useState("");
  const [allocs, setAllocs] = useState<Alloc[]>([{ mat: { ...emptyMat }, mode: "pct", amount: "100" }]);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  // Populate form when editItem changes
  useEffect(() => {
    if (!open) return;
    if (editItem) {
      setSupplier(
        editItem.supplier_id
          ? { id: editItem.supplier_id, name: editItem.wh_suppliers?.name || "" }
          : { id: null, name: editItem.supplier_name || "" }
      );
      setNet(String(editItem.net_quantity ?? ""));
      setPrice(editItem.unit_price != null ? String(editItem.unit_price) : "");
      setPay(editItem.payment_method || "cash");
      setPaid(!!editItem.paid);
      setDocNumber(editItem.doc_number || "");
      setDocDate(editItem.doc_date ? editItem.doc_date.slice(0, 10) : "");
      setNote(editItem.note || "");
      setAllocs([{ mat: { ...emptyMat }, mode: "pct", amount: "100" }]);
    } else {
      setSupplier({ id: null, name: "" });
      setNet("");
      setPrice("");
      setPay("cash");
      setPaid(false);
      setDocNumber("");
      setDocDate("");
      setNote("");
      setAllocs([{ mat: { ...emptyMat }, mode: "pct", amount: "100" }]);
    }
    setErr("");
  }, [open, editItem]);

  const netN = Number(net) || 0;
  const priceN = price !== "" ? Number(price) : null;
  const total = priceN != null && netN > 0 ? netN * priceN : null;

  const allocKg = useMemo(
    () => allocs.map((a) => (a.mode === "pct" ? (netN * (Number(a.amount) || 0)) / 100 : Number(a.amount) || 0)),
    [allocs, netN]
  );
  const sumAlloc = allocKg.reduce((s, n) => s + n, 0);
  const allocOk = Math.abs(sumAlloc - netN) < 0.01 && netN > 0;

  async function save() {
    setErr("");
    if (netN <= 0) return setErr("Въведете нетно количество.");

    setSaving(true);
    try {
      if (isEdit) {
        // Edit mode: update metadata only
        const { error } = await supabase.rpc("wh_update_delivery", {
          p_delivery_id: editItem.id,
          p_doc_number: docNumber || null,
          p_doc_date: docDate ? new Date(docDate + "T12:00:00").toISOString() : null,
          p_supplier_id: supplier.id,
          p_supplier_name: supplier.id ? null : supplier.name || null,
          p_unit_price: priceN,
          p_payment_method: pay,
          p_paid: paid,
          p_note: note || null,
        });
        if (error) throw new Error(error.message);
      } else {
        // New delivery
        if (allocs.some((a) => !a.mat.name.trim())) return setErr("Изберете или въведете материал за всеки ред.");
        if (!allocOk)
          return setErr(`Сборът на материалите (${sumAlloc.toFixed(3)} т) трябва да е равен на нетното количество (${netN.toFixed(3)} т).`);

        const ids: string[] = [];
        for (const a of allocs) {
          if (a.mat.id) {
            ids.push(a.mat.id);
          } else {
            const { data, error } = await supabase.rpc("wh_get_or_create_material", { p_name: a.mat.name.trim() });
            if (error) throw new Error(error.message);
            ids.push(data as string);
          }
        }
        const { error } = await supabase.rpc("wh_record_delivery", {
          p_supplier_id: supplier.id,
          p_supplier_name: supplier.id ? null : supplier.name || null,
          p_net_quantity: netN,
          p_deduction_kg: 0,
          p_unit_price: priceN,
          p_payment_method: pay,
          p_paid: paid,
          p_doc_number: docNumber || null,
          p_doc_date: docDate ? new Date(docDate + "T12:00:00").toISOString() : new Date().toISOString(),
          p_note: note || null,
          p_operator_name: null,
          p_allocations: allocs.map((_, i) => ({ material_id: ids[i], quantity_kg: allocKg[i] })),
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
    <Modal open={open} onClose={onClose} title={isEdit ? "Редакция на доставка" : "Нова доставка"} wide>
      <div className="space-y-4">
        <FormGrid cols={2}>
          <Field label="Доставчик" hint="изберете от базата или въведете нов">
            <Combobox
              items={suppliers.map((s) => ({ id: s.id, name: s.name }))}
              value={supplier}
              onChange={setSupplier}
              placeholder="Име на доставчик"
            />
          </Field>
          <Field label="Документ №">
            <input className="input" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
          </Field>
        </FormGrid>

        <FormGrid cols={3}>
          <Field label="Нетно (т)" required hint="чисто тегло">
            <input
              className="input"
              type="number"
              step="0.001"
              value={net}
              onChange={(e) => setNet(e.target.value)}
              readOnly={isEdit}
              disabled={isEdit}
            />
          </Field>
          <Field label="Покупна цена (€/т)" hint="може да се добави по-късно">
            <input className="input" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <Field label="Дата">
            <input className="input" type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
          </Field>
        </FormGrid>

        {(netN > 0 || total != null) && (
          <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-3 text-sm">
            <div>
              <span className="text-slate-500">Нето: </span>
              <span className="font-semibold">{fmtKg(netN)}</span>
            </div>
            <div>
              <span className="text-slate-500">Стойност: </span>
              <span className="font-semibold">{total != null ? fmtLv(total) : "—"}</span>
            </div>
          </div>
        )}

        {!isEdit && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Разпределение по материали</label>
              <button
                type="button"
                className="text-sm text-brand-600 hover:underline"
                onClick={() => setAllocs([...allocs, { mat: { ...emptyMat }, mode: "kg", amount: "" }])}
              >
                + Добави материал
              </button>
            </div>
            <div className="grid grid-cols-[1fr_84px_104px_96px_32px] gap-2 px-1 pb-1 text-xs font-medium text-slate-400">
              <div>Материал</div>
              <div>Вид</div>
              <div>Стойност</div>
              <div className="text-right">= т</div>
              <div></div>
            </div>
            <div className="space-y-2">
              {allocs.map((a, i) => (
                <div key={i} className="grid grid-cols-[1fr_84px_104px_96px_32px] gap-2 items-center">
                  <Combobox
                    items={materials.map((m) => ({ id: m.material_id, name: m.material_name }))}
                    value={a.mat}
                    onChange={(v) => {
                      const c = [...allocs];
                      c[i].mat = v;
                      setAllocs(c);
                    }}
                    placeholder="Материал"
                  />
                  <select
                    className="input"
                    value={a.mode}
                    onChange={(e) => {
                      const c = [...allocs];
                      c[i].mode = e.target.value as any;
                      setAllocs(c);
                    }}
                  >
                    <option value="pct">%</option>
                    <option value="kg">т</option>
                  </select>
                  <input
                    className="input"
                    type="number"
                    step="0.001"
                    value={a.amount}
                    onChange={(e) => {
                      const c = [...allocs];
                      c[i].amount = e.target.value;
                      setAllocs(c);
                    }}
                  />
                  <div className="text-sm text-slate-500 text-right">{fmtKg(allocKg[i])}</div>
                  <button
                    type="button"
                    className="text-slate-400 hover:text-red-600 text-center"
                    onClick={() => setAllocs(allocs.filter((_, j) => j !== i))}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className={`mt-2 text-sm ${allocOk ? "text-emerald-600" : "text-amber-600"}`}>
              Сбор: {fmtKg(sumAlloc)} / {fmtKg(netN)} {allocOk ? "✓" : "(трябва да съвпадат)"}
            </div>
          </div>
        )}

        <FormGrid cols={2}>
          <Field label="Начин на плащане">
            <select className="input" value={pay} onChange={(e) => setPay(e.target.value as any)}>
              <option value="cash">В брой</option>
              <option value="bank">По банка</option>
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
          <button className="btn-secondary" onClick={onClose}>Отказ</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Запис…" : isEdit ? "Запази промените" : "Запиши доставка"}
          </button>
        </FormActions>
      </div>
    </Modal>
  );
}
