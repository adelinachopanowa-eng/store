"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { GroupBalance, Material, Supplier } from "@/lib/types";
import { fmtKg, fmtLv, fmtPrice, fmtDate } from "@/lib/format";
import { PageHeader, Loading, Empty, Modal, VoidButton, VoidedBadge } from "@/components/ui";

type Alloc = { group_id: string; mode: "pct" | "kg"; amount: string };

export default function DeliveriesPage() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [groups, setGroups] = useState<GroupBalance[]>([]);

  // form
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [net, setNet] = useState("");
  const [dedMode, setDedMode] = useState<"kg" | "pct">("kg");
  const [ded, setDed] = useState("");
  const [price, setPrice] = useState("");
  const [pay, setPay] = useState<"cash" | "bank">("cash");
  const [paid, setPaid] = useState(false);
  const [docNumber, setDocNumber] = useState("");
  const [note, setNote] = useState("");
  const [allocs, setAllocs] = useState<Alloc[]>([{ group_id: "", mode: "pct", amount: "100" }]);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadRefs() {
    const [s, m, g] = await Promise.all([
      supabase.from("wh_suppliers").select("*").eq("active", true).order("name"),
      supabase.from("wh_materials").select("*").eq("active", true).order("name"),
      supabase.from("wh_group_balances").select("*").eq("active", true).order("group_name"),
    ]);
    setSuppliers((s.data as Supplier[]) || []);
    setMaterials((m.data as Material[]) || []);
    setGroups((g.data as GroupBalance[]) || []);
  }

  async function loadList() {
    setLoading(true);
    const { data } = await supabase
      .from("wh_deliveries")
      .select("*, wh_suppliers(name), wh_materials(name)")
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

  // изчислени кг по групи
  const allocKg = useMemo(
    () =>
      allocs.map((a) =>
        a.mode === "pct" ? (accounted * (Number(a.amount) || 0)) / 100 : Number(a.amount) || 0
      ),
    [allocs, accounted]
  );
  const sumAlloc = allocKg.reduce((s, n) => s + n, 0);
  const allocOk = Math.abs(sumAlloc - accounted) < 0.01 && accounted > 0;

  function resetForm() {
    setSupplierId("");
    setSupplierName("");
    setMaterialId("");
    setNet("");
    setDed("");
    setDedMode("kg");
    setPrice("");
    setPay("cash");
    setPaid(false);
    setDocNumber("");
    setNote("");
    setAllocs([{ group_id: "", mode: "pct", amount: "100" }]);
    setErr("");
  }

  async function save() {
    setErr("");
    if (accounted <= 0) return setErr("Въведете нетно количество и отбив.");
    if (priceN <= 0) return setErr("Въведете изкупна цена.");
    if (allocs.some((a) => !a.group_id)) return setErr("Изберете група за всеки ред на разпределение.");
    if (!allocOk)
      return setErr(
        `Сборът на групите (${sumAlloc.toFixed(2)} кг) трябва да е равен на заприходеното (${accounted.toFixed(2)} кг).`
      );

    setSaving(true);
    const payload = {
      p_supplier_id: supplierId || null,
      p_supplier_name: supplierId ? null : supplierName || null,
      p_material_id: materialId || null,
      p_net_quantity: netN,
      p_deduction_kg: dedKg,
      p_unit_price: priceN,
      p_payment_method: pay,
      p_paid: paid,
      p_doc_number: docNumber || null,
      p_doc_date: new Date().toISOString(),
      p_note: note || null,
      p_operator_name: null,
      p_allocations: allocs.map((a, i) => ({ group_id: a.group_id, quantity_kg: allocKg[i] })),
    };
    const { error } = await supabase.rpc("wh_record_delivery", payload);
    setSaving(false);
    if (error) return setErr(error.message);
    resetForm();
    setOpen(false);
    loadList();
    loadRefs();
  }

  return (
    <div>
      <PageHeader
        title="Доставки"
        subtitle="Въвеждане на доставки с разпределение по групи"
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
                <th className="th">Материал</th>
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
                  <td className="td">{d.wh_materials?.name || "—"}</td>
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
          {/* доставчик */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Доставчик (от база)</label>
              <select
                className="input"
                value={supplierId}
                onChange={(e) => {
                  setSupplierId(e.target.value);
                  if (e.target.value) setSupplierName("");
                }}
              >
                <option value="">— ad-hoc / ръчно —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">или име ръчно (ad-hoc)</label>
              <input
                className="input"
                value={supplierName}
                disabled={!!supplierId}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Нов доставчик"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Материал</label>
              <select className="input" value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
                <option value="">— изберете —</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Документ №</label>
              <input className="input" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="label">Нетно (кг) *</label>
              <input className="input" type="number" step="0.01" value={net} onChange={(e) => setNet(e.target.value)} />
            </div>
            <div>
              <label className="label">Отбив</label>
              <input className="input" type="number" step="0.01" value={ded} onChange={(e) => setDed(e.target.value)} />
            </div>
            <div>
              <label className="label">Отбив в</label>
              <select className="input" value={dedMode} onChange={(e) => setDedMode(e.target.value as any)}>
                <option value="kg">кг</option>
                <option value="pct">%</option>
              </select>
            </div>
            <div>
              <label className="label">Цена (лв/кг) *</label>
              <input className="input" type="number" step="0.0001" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3 text-sm">
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

          {/* разпределение по групи */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Разпределение по групи</label>
              <button
                className="text-sm text-brand-600 hover:underline"
                onClick={() => setAllocs([...allocs, { group_id: "", mode: "kg", amount: "" }])}
              >
                + Добави група
              </button>
            </div>
            <div className="space-y-2">
              {allocs.map((a, i) => (
                <div key={i} className="grid grid-cols-[1fr_90px_110px_90px_32px] gap-2 items-center">
                  <select
                    className="input"
                    value={a.group_id}
                    onChange={(e) => {
                      const c = [...allocs];
                      c[i].group_id = e.target.value;
                      setAllocs(c);
                    }}
                  >
                    <option value="">— група —</option>
                    {groups.map((g) => (
                      <option key={g.group_id} value={g.group_id}>
                        {g.group_name}
                      </option>
                    ))}
                  </select>
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
                    className="text-slate-400 hover:text-red-600"
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

          {/* плащане */}
          <div className="grid grid-cols-3 gap-3 items-end">
            <div>
              <label className="label">Начин на плащане</label>
              <select className="input" value={pay} onChange={(e) => setPay(e.target.value as any)}>
                <option value="cash">В брой</option>
                <option value="bank">По банка</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pb-2">
              <input id="paid" type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="h-4 w-4" />
              <label htmlFor="paid" className="text-sm text-slate-700">
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
              {saving ? "Запис…" : "Запиши доставка"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
