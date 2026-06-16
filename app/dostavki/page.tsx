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

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<MaterialBalance[]>([]);

  // форма
  const [supplier, setSupplier] = useState<ComboValue>({ id: null, name: "" });
  const [net, setNet] = useState("");
  const [dedMode, setDedMode] = useState<"kg" | "pct">("kg");
  const [ded, setDed] = useState("");
  const [price, setPrice] = useState("");
  const [pay, setPay] = useState<"cash" | "bank">("cash");
  const [paid, setPaid] = useState(false);
  const [docNumber, setDocNumber] = useState("");
  const [note, setNote] = useState("");
  const [allocs, setAllocs] = useState<Alloc[]>([{ mat: { ...emptyMat }, mode: "pct", amount: "100" }]);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

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

  const netN = Number(net) || 0;
  const dedKg = dedMode === "kg" ? Number(ded) || 0 : (netN * (Number(ded) || 0)) / 100;
  const accounted = Math.max(netN - dedKg, 0);
  const priceN = Number(price) || 0;
  const total = accounted * priceN;

  const allocKg = useMemo(
    () => allocs.map((a) => (a.mode === "pct" ? (accounted * (Number(a.amount) || 0)) / 100 : Number(a.amount) || 0)),
    [allocs, accounted]
  );
  const sumAlloc = allocKg.reduce((s, n) => s + n, 0);
  const allocOk = Math.abs(sumAlloc - accounted) < 0.01 && accounted > 0;

  function resetForm() {
    setSupplier({ id: null, name: "" });
    setNet("");
    setDed("");
    setDedMode("kg");
    setPrice("");
    setPay("cash");
    setPaid(false);
    setDocNumber("");
    setNote("");
    setAllocs([{ mat: { ...emptyMat }, mode: "pct", amount: "100" }]);
    setErr("");
  }

  async function save() {
    setErr("");
    if (accounted <= 0) return setErr("Въведете нетно количество и отбив.");
    if (priceN <= 0) return setErr("Въведете изкупна цена.");
    if (allocs.some((a) => !a.mat.name.trim())) return setErr("Изберете или въведете материал за всеки ред.");
    if (!allocOk)
      return setErr(`Сборът на материалите (${sumAlloc.toFixed(2)} кг) трябва да е равен на заприходеното (${accounted.toFixed(2)} кг).`);

    setSaving(true);
    try {
      // резолюция на материали (ново име -> запис в базата)
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
        p_deduction_kg: dedKg,
        p_unit_price: priceN,
        p_payment_method: pay,
        p_paid: paid,
        p_doc_number: docNumber || null,
        p_doc_date: new Date().toISOString(),
        p_note: note || null,
        p_operator_name: null,
        p_allocations: allocs.map((_, i) => ({ material_id: ids[i], quantity_kg: allocKg[i] })),
      });
      if (error) throw new Error(error.message);
      resetForm();
      setOpen(false);
      loadList();
      loadRefs();
    } catch (e: any) {
      setErr(e.message || "Грешка при запис");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Доставки"
        subtitle="Въвеждане на доставки с разпределение по материали"
        actions={
          <button
            className="btn-primary"
            onClick={() => {
              resetForm();
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
                <th className="th text-right">Отбив</th>
                <th className="th text-right">Заприх.</th>
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
                  <td className="td text-right">{fmtKg(d.deduction_kg)}</td>
                  <td className="td text-right">{fmtKg(d.accounted_quantity)}</td>
                  <td className="td text-right">{fmtPrice(d.unit_price)}</td>
                  <td className="td text-right font-medium">{fmtLv(d.total_value)}</td>
                  <td className="td">
                    <span className={`badge ${d.paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {d.payment_method === "bank" ? "Банка" : "Брой"} · {d.paid ? "Платено" : "Не"}
                    </span>
                  </td>
                  <td className="td">
                    {d.voided ? (
                      <VoidedBadge />
                    ) : (
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
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Нова доставка" wide>
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

          <FormGrid cols={4}>
            <Field label="Нетно (кг)" required>
              <input className="input" type="number" step="0.01" value={net} onChange={(e) => setNet(e.target.value)} />
            </Field>
            <Field label="Отбив">
              <input className="input" type="number" step="0.01" value={ded} onChange={(e) => setDed(e.target.value)} />
            </Field>
            <Field label="Отбив в">
              <select className="input" value={dedMode} onChange={(e) => setDedMode(e.target.value as any)}>
                <option value="kg">кг</option>
                <option value="pct">%</option>
              </select>
            </Field>
            <Field label="Цена (лв/кг)" required>
              <input className="input" type="number" step="0.0001" value={price} onChange={(e) => setPrice(e.target.value)} />
            </Field>
          </FormGrid>

          <div className="grid grid-cols-3 gap-4 rounded-lg bg-slate-50 p-3 text-sm">
            <div>
              <span className="text-slate-500">Заприходено: </span>
              <span className="font-semibold">{fmtKg(accounted)}</span>
            </div>
            <div>
              <span className="text-slate-500">Отбив: </span>
              <span className="font-semibold">{fmtKg(dedKg)}</span>
            </div>
            <div>
              <span className="text-slate-500">Стойност: </span>
              <span className="font-semibold">{fmtLv(total)}</span>
            </div>
          </div>

          {/* разпределение по материали */}
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
              <div className="text-right">= кг</div>
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
                    <option value="kg">кг</option>
                  </select>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
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
              Сбор: {fmtKg(sumAlloc)} / {fmtKg(accounted)} {allocOk ? "✓" : "(трябва да съвпадат)"}
            </div>
          </div>

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
            <button className="btn-secondary" onClick={() => setOpen(false)}>
              Отказ
            </button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? "Запис…" : "Запиши доставка"}
            </button>
          </FormActions>
        </div>
      </Modal>
    </div>
  );
}
