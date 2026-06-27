"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Supplier, Material } from "@/lib/types";
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

const fmtKgRaw = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("bg-BG", { maximumFractionDigits: 0 }) + " кг";

// ISO → стойност за datetime-local (по локално време)
function toLocalInput(iso?: string | null) {
  const d = iso ? new Date(iso) : new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export default function WeighNotesPage() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);

  async function loadRefs() {
    const [s, m] = await Promise.all([
      supabase.from("wh_suppliers").select("*").eq("active", true).order("name"),
      supabase.from("wh_materials").select("*").eq("active", true).order("name"),
    ]);
    setSuppliers((s.data as Supplier[]) || []);
    setMaterials((m.data as Material[]) || []);
  }
  async function loadList() {
    setLoading(true);
    const { data } = await supabase
      .from("wh_deliveries")
      .select("*, wh_suppliers(name), wh_delivery_allocations(material_id, wh_materials(name))")
      .eq("is_weigh_note", true)
      .order("weighed_at", { ascending: false })
      .limit(200);
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
        title="Кантарни бележки"
        subtitle="Издаване на кантарни бележки — всяка създава доставка (цената се добавя по-късно)"
        actions={
          <button className="btn-primary" onClick={() => { setEditItem(null); setOpen(true); }}>
            + Нова бележка
          </button>
        }
      />

      {loading ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty text="Няма издадени кантарни бележки." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">№</th>
                <th className="th">Дата/час</th>
                <th className="th">Рег. №</th>
                <th className="th">Клиент</th>
                <th className="th">Материал</th>
                <th className="th text-right">Бруто</th>
                <th className="th text-right">Тара</th>
                <th className="th text-right">Нето</th>
                <th className="th text-right">Цена</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((d) => {
                const mat = d.wh_delivery_allocations?.[0]?.wh_materials?.name;
                return (
                  <tr key={d.id} className={`hover:bg-slate-50 ${d.voided ? "opacity-50" : ""}`}>
                    <td className="td font-semibold text-slate-700">{d.seq_no ?? "—"}</td>
                    <td className="td whitespace-nowrap">{fmtDate(d.weighed_at || d.doc_date)}</td>
                    <td className="td font-medium">{d.vehicle_reg || "—"}</td>
                    <td className="td">{d.wh_suppliers?.name || d.supplier_name || "—"}</td>
                    <td className="td">{mat || "—"}</td>
                    <td className="td text-right">{fmtKgRaw(d.gross_kg)}</td>
                    <td className="td text-right">{fmtKgRaw(d.tare_kg)}</td>
                    <td className="td text-right font-medium">{fmtKg(d.net_quantity)}</td>
                    <td className="td text-right">
                      {d.unit_price != null ? fmtPrice(d.unit_price) : <span className="text-amber-500 text-xs">без цена</span>}
                    </td>
                    <td className="td">
                      {d.voided ? (
                        <VoidedBadge />
                      ) : (
                        <div className="flex gap-1 items-center">
                          <Link
                            href={`/kantar/${d.id}`}
                            className="text-xs text-brand-600 hover:underline px-2 py-1 rounded hover:bg-slate-100"
                          >
                            🖨 Печат
                          </Link>
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
                            }}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <WeighModal
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

function WeighModal({
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
  materials: Material[];
  onSaved: () => void;
}) {
  const isEdit = !!editItem;

  const [client, setClient] = useState<ComboValue>({ id: null, name: "" });
  const [material, setMaterial] = useState<ComboValue>({ id: null, name: "" });
  const [vehicle, setVehicle] = useState("");
  const [driver, setDriver] = useState("");
  const [gross, setGross] = useState("");
  const [tare, setTare] = useState("");
  const [weighedAt, setWeighedAt] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [price, setPrice] = useState("");
  const [pay, setPay] = useState<"cash" | "bank">("cash");
  const [paid, setPaid] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editItem) {
      setClient(
        editItem.supplier_id
          ? { id: editItem.supplier_id, name: editItem.wh_suppliers?.name || "" }
          : { id: null, name: editItem.supplier_name || "" }
      );
      const mat = editItem.wh_delivery_allocations?.[0];
      setMaterial(mat ? { id: mat.material_id, name: mat.wh_materials?.name || "" } : { id: null, name: "" });
      setVehicle(editItem.vehicle_reg || "");
      setDriver(editItem.driver_name || "");
      setGross(editItem.gross_kg != null ? String(editItem.gross_kg) : "");
      setTare(editItem.tare_kg != null ? String(editItem.tare_kg) : "");
      setWeighedAt(toLocalInput(editItem.weighed_at || editItem.doc_date));
      setDocNumber(editItem.doc_number || "");
      setPrice(editItem.unit_price != null ? String(editItem.unit_price) : "");
      setPay(editItem.payment_method || "cash");
      setPaid(!!editItem.paid);
      setNote(editItem.note || "");
    } else {
      setClient({ id: null, name: "" });
      setMaterial({ id: null, name: "" });
      setVehicle("");
      setDriver("");
      setGross("");
      setTare("");
      setWeighedAt(toLocalInput());
      setDocNumber("");
      setPrice("");
      setPay("cash");
      setPaid(false);
      setNote("");
    }
    setErr("");
  }, [open, editItem]);

  const grossN = Number(gross) || 0;
  const tareN = Number(tare) || 0;
  const netKg = grossN - tareN;
  const priceN = price !== "" ? Number(price) : null;

  async function save() {
    setErr("");
    if (!material.name.trim()) return setErr("Изберете материал.");
    if (netKg <= 0) return setErr("Нетото трябва да е положително (бруто минус тара).");
    setSaving(true);
    try {
      const weighedIso = weighedAt ? new Date(weighedAt).toISOString() : new Date().toISOString();
      if (isEdit) {
        const { error } = await supabase.rpc("wh_update_weigh_note", {
          p_delivery_id: editItem.id,
          p_supplier_id: client.id,
          p_supplier_name: client.id ? null : client.name || null,
          p_gross_kg: grossN,
          p_tare_kg: tareN,
          p_vehicle_reg: vehicle || null,
          p_driver_name: driver || null,
          p_weighed_at: weighedIso,
          p_doc_number: docNumber || null,
          p_unit_price: priceN,
          p_payment_method: pay,
          p_paid: paid,
          p_note: note || null,
        });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.rpc("wh_create_weigh_note", {
          p_supplier_id: client.id,
          p_supplier_name: client.id ? null : client.name || null,
          p_material_id: material.id,
          p_material_name: material.id ? null : material.name.trim(),
          p_gross_kg: grossN,
          p_tare_kg: tareN,
          p_vehicle_reg: vehicle || null,
          p_driver_name: driver || null,
          p_weighed_at: weighedIso,
          p_doc_number: docNumber || null,
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
    <Modal open={open} onClose={onClose} title={isEdit ? `Редакция на кантарна бележка №${editItem?.seq_no ?? ""}` : "Нова кантарна бележка"} wide>
      <div className="space-y-4">
        <FormGrid cols={2}>
          <Field label="Клиент" hint="изберете от базата или въведете нов">
            <Combobox
              items={suppliers.map((s) => ({ id: s.id, name: s.name }))}
              value={client}
              onChange={setClient}
              placeholder="Име на клиент"
            />
          </Field>
          <Field label="Материал" required>
            {isEdit ? (
              <input className="input bg-slate-50" value={material.name} readOnly disabled />
            ) : (
              <Combobox
                items={materials.map((m) => ({ id: m.id, name: m.name }))}
                value={material}
                onChange={setMaterial}
                placeholder="Материал"
              />
            )}
          </Field>
        </FormGrid>

        <FormGrid cols={2}>
          <Field label="Рег. № на автомобил">
            <input className="input" value={vehicle} onChange={(e) => setVehicle(e.target.value.toUpperCase())} placeholder="CA 1234 AB" />
          </Field>
          <Field label="Шофьор">
            <input className="input" value={driver} onChange={(e) => setDriver(e.target.value)} />
          </Field>
        </FormGrid>

        <FormGrid cols={3}>
          <Field label="Бруто (кг)" required>
            <input className="input" type="number" step="1" value={gross} onChange={(e) => setGross(e.target.value)} />
          </Field>
          <Field label="Тара (кг)" required>
            <input className="input" type="number" step="1" value={tare} onChange={(e) => setTare(e.target.value)} />
          </Field>
          <Field label="Нето">
            <div className="input bg-slate-50 font-semibold">
              {netKg > 0 ? `${netKg.toLocaleString("bg-BG")} кг · ${fmtKg(netKg / 1000)}` : "—"}
            </div>
          </Field>
        </FormGrid>

        <FormGrid cols={2}>
          <Field label="Дата и час на измерване">
            <input className="input" type="datetime-local" value={weighedAt} onChange={(e) => setWeighedAt(e.target.value)} />
          </Field>
          <Field label="Документ №">
            <input className="input" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
          </Field>
        </FormGrid>

        {isEdit && (
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-sm font-medium text-slate-600 mb-3">Допълнителни реквизити</div>
            <FormGrid cols={3}>
              <Field label="Покупна цена (€/т)" hint="може по-късно">
                <input className="input" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
              </Field>
              <Field label="Плащане">
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
            {priceN != null && netKg > 0 && (
              <div className="mt-3 text-sm text-slate-600">
                Стойност на доставката: <b>{fmtLv((netKg / 1000) * priceN)}</b>
              </div>
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
            {saving ? "Запис…" : isEdit ? "Запази промените" : "Издай бележка"}
          </button>
        </FormActions>
      </div>
    </Modal>
  );
}
