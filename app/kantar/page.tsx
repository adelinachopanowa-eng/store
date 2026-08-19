"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Supplier, Material, ClientMaterial } from "@/lib/types";
import { fmtKg, fmtLv, fmtDate } from "@/lib/format";
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
} from "@/components/ui";
import Combobox, { ComboValue } from "@/components/Combobox";

const kgRaw = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("bg-BG", { maximumFractionDigits: 0 }) + " кг";

function toLocalInput(iso?: string | null) {
  const d = iso ? new Date(iso) : new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

type Line = { clientMat: ComboValue; mat: ComboValue; gross: string; tare: string; price: string };
const emptyLine = (): Line => ({ clientMat: { id: null, name: "" }, mat: { id: null, name: "" }, gross: "", tare: "", price: "" });

export default function WeighNotesPage() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [clientMaterials, setClientMaterials] = useState<ClientMaterial[]>([]);

  async function loadRefs() {
    const [s, m, c] = await Promise.all([
      supabase.from("wh_suppliers").select("*").eq("active", true).order("name"),
      supabase.from("wh_materials").select("*").eq("active", true).order("name"),
      supabase.from("wh_client_materials").select("*").eq("active", true).order("name"),
    ]);
    setSuppliers((s.data as Supplier[]) || []);
    setMaterials((m.data as Material[]) || []);
    setClientMaterials((c.data as ClientMaterial[]) || []);
  }
  async function loadList() {
    setLoading(true);
    const { data } = await supabase
      .from("wh_deliveries")
      .select("*, wh_suppliers(name), wh_delivery_allocations(material_id, client_material_id, client_name, gross_kg, tare_kg, net_kg, unit_price, wh_materials(name))")
      .eq("is_weigh_note", true)
      .eq("voided", false)
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
        subtitle="Едно или няколко измервания на бележка — всяка създава доставка (цените се добавят по-късно)"
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
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] rtable">
            <thead>
              <tr>
                <th className="th">№</th>
                <th className="th">Дата/час</th>
                <th className="th">Рег. №</th>
                <th className="th">Клиент</th>
                <th className="th">Материали</th>
                <th className="th text-right">Бруто</th>
                <th className="th text-right">Тара</th>
                <th className="th text-right">Нето</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((d) => {
                const lines = d.wh_delivery_allocations || [];
                const mats = lines.map((a: any) => a.client_name || a.wh_materials?.name).filter(Boolean);
                const matLabel = mats.length <= 1 ? (mats[0] || "—") : `${mats[0]} +${mats.length - 1}`;
                return (
                  <tr key={d.id} className="hover:bg-brand-50">
                    <td className="td font-semibold text-brand-700" data-label="№">{d.seq_no ?? "—"}</td>
                    <td className="td whitespace-nowrap" data-label="Дата/час">{fmtDate(d.weighed_at || d.doc_date)}</td>
                    <td className="td font-medium" data-label="Рег. №">{d.vehicle_reg || "—"}</td>
                    <td className="td" data-label="Клиент">{d.wh_suppliers?.name || d.supplier_name || "—"}</td>
                    <td className="td" data-label="Материали" title={mats.join(", ")}>{matLabel}</td>
                    <td className="td text-right" data-label="Бруто">{kgRaw(d.gross_kg)}</td>
                    <td className="td text-right" data-label="Тара">{kgRaw(d.tare_kg)}</td>
                    <td className="td text-right font-medium" data-label="Нето">{fmtKg(d.net_quantity)}</td>
                    <td className="td rtable-actions">
                      <div className="flex gap-1 items-center">
                        <Link
                          href={`/kantar/${d.id}`}
                          className="text-xs text-brand-600 hover:underline px-2 py-1 rounded hover:bg-brand-50"
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
        clientMaterials={clientMaterials}
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
  clientMaterials,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editItem: any | null;
  suppliers: Supplier[];
  materials: Material[];
  clientMaterials: ClientMaterial[];
  onSaved: () => void;
}) {
  const isEdit = !!editItem;

  const [client, setClient] = useState<ComboValue>({ id: null, name: "" });
  const [vehicle, setVehicle] = useState("");
  const [driver, setDriver] = useState("");
  const [weighedAt, setWeighedAt] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [pay, setPay] = useState<"cash" | "bank">("cash");
  const [paid, setPaid] = useState(false);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
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
      setVehicle(editItem.vehicle_reg || "");
      setDriver(editItem.driver_name || "");
      setWeighedAt(toLocalInput(editItem.weighed_at || editItem.doc_date));
      setDocNumber(editItem.doc_number || "");
      setPay(editItem.payment_method || "cash");
      setPaid(!!editItem.paid);
      setNote(editItem.note || "");
      const al = (editItem.wh_delivery_allocations || []) as any[];
      setLines(
        al.length
          ? al.map((a) => ({
              clientMat: { id: a.client_material_id || null, name: a.client_name || "" },
              mat: { id: a.material_id, name: a.wh_materials?.name || "" },
              gross: a.gross_kg != null ? String(a.gross_kg) : "",
              tare: a.tare_kg != null ? String(a.tare_kg) : "",
              price: a.unit_price != null ? String(a.unit_price) : "",
            }))
          : [emptyLine()]
      );
    } else {
      setClient({ id: null, name: "" });
      setVehicle("");
      setDriver("");
      setWeighedAt(toLocalInput());
      setDocNumber("");
      setPay("cash");
      setPaid(false);
      setNote("");
      setLines([emptyLine()]);
    }
    setErr("");
  }, [open, editItem]);

  const netKg = (l: Line) => (Number(l.gross) || 0) - (Number(l.tare) || 0);
  const totalNetKg = lines.reduce((s, l) => s + Math.max(0, netKg(l)), 0);
  const totalValue = lines.reduce((s, l) => {
    const p = l.price !== "" ? Number(l.price) : null;
    return p != null ? s + (Math.max(0, netKg(l)) / 1000) * p : s;
  }, 0);

  function setLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  // Избор на клиентско наименование → авто-попълва вътрешния материал от мапинга
  function pickClient(i: number, v: ComboValue) {
    const cm = v.id ? clientMaterials.find((c) => c.id === v.id) : undefined;
    const def = cm?.default_material_id ? materials.find((m) => m.id === cm.default_material_id) : undefined;
    setLines((prev) =>
      prev.map((l, j) => {
        if (j !== i) return l;
        // попълва вътрешния само ако е празен или сме сменили към мапнат клиентски материал
        const mat = def ? { id: def.id, name: def.name } : l.mat;
        return { ...l, clientMat: v, mat };
      })
    );
  }

  async function save() {
    setErr("");
    if (lines.some((l) => !l.clientMat.name.trim())) return setErr("Въведете клиентско наименование на всеки ред.");
    if (lines.some((l) => !l.mat.name.trim())) return setErr("Изберете вътрешна номенклатура на всеки ред.");
    if (lines.some((l) => netKg(l) <= 0)) return setErr("Нетото на всеки ред трябва да е положително (бруто минус тара).");
    setSaving(true);
    try {
      const weighedIso = weighedAt ? new Date(weighedAt).toISOString() : new Date().toISOString();
      const payloadLines = lines.map((l) => ({
        client_material_id: l.clientMat.id,
        client_material_name: l.clientMat.id ? null : l.clientMat.name.trim(),
        material_id: l.mat.id,
        material_name: l.mat.id ? null : l.mat.name.trim(),
        gross_kg: Number(l.gross) || 0,
        tare_kg: Number(l.tare) || 0,
        ...(isEdit ? { unit_price: l.price !== "" ? Number(l.price) : null } : {}),
      }));

      if (isEdit) {
        const { error } = await supabase.rpc("wh_update_weigh_note", {
          p_delivery_id: editItem.id,
          p_supplier_id: client.id,
          p_supplier_name: client.id ? null : client.name || null,
          p_vehicle_reg: vehicle || null,
          p_driver_name: driver || null,
          p_weighed_at: weighedIso,
          p_doc_number: docNumber || null,
          p_payment_method: pay,
          p_paid: paid,
          p_note: note || null,
          p_lines: payloadLines,
        });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.rpc("wh_create_weigh_note", {
          p_supplier_id: client.id,
          p_supplier_name: client.id ? null : client.name || null,
          p_vehicle_reg: vehicle || null,
          p_driver_name: driver || null,
          p_weighed_at: weighedIso,
          p_doc_number: docNumber || null,
          p_note: note || null,
          p_operator_name: null,
          p_lines: payloadLines,
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
          <Field label="Рег. № на автомобил">
            <input className="input" value={vehicle} onChange={(e) => setVehicle(e.target.value.toUpperCase())} placeholder="CA 1234 AB" />
          </Field>
          <Field label="Шофьор">
            <input className="input" value={driver} onChange={(e) => setDriver(e.target.value)} />
          </Field>
          <Field label="Дата и час на измерване">
            <input className="input" type="datetime-local" value={weighedAt} onChange={(e) => setWeighedAt(e.target.value)} />
          </Field>
        </FormGrid>

        {/* измервания */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Измервания</label>
            <button type="button" className="text-sm text-brand-600 hover:underline" onClick={() => setLines([...lines, emptyLine()])}>
              + Добави измерване
            </button>
          </div>

          <div className="space-y-2">
            {lines.map((l, i) => {
              const nkg = netKg(l);
              return (
                <div key={i} className="rounded-lg border border-slate-200 p-2 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
                      <Field label="Клиентско наименование (на бележката)">
                        <Combobox
                          items={clientMaterials.map((c) => ({ id: c.id, name: c.name }))}
                          value={l.clientMat}
                          onChange={(v) => pickClient(i, v)}
                          placeholder="Клиентско наименование"
                        />
                      </Field>
                      <Field label="Вътрешна номенклатура (за склада)">
                        <Combobox
                          items={materials.map((m) => ({ id: m.id, name: m.name }))}
                          value={l.mat}
                          onChange={(v) => setLine(i, { mat: v })}
                          placeholder="Вътрешен материал"
                        />
                      </Field>
                    </div>
                    <button
                      type="button"
                      className="text-slate-400 hover:text-red-600 mt-7 px-1"
                      onClick={() => setLines(lines.length > 1 ? lines.filter((_, j) => j !== i) : lines)}
                      title="Премахни реда"
                    >
                      ×
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-[96px_96px_110px_1fr] gap-2 items-end">
                    <Field label="Бруто (кг)">
                      <input className="input" type="number" step="1" value={l.gross} onChange={(e) => setLine(i, { gross: e.target.value })} />
                    </Field>
                    <Field label="Тара (кг)">
                      <input className="input" type="number" step="1" value={l.tare} onChange={(e) => setLine(i, { tare: e.target.value })} />
                    </Field>
                    {isEdit ? (
                      <Field label="Цена (€/т)">
                        <input className="input" type="number" step="0.01" value={l.price} onChange={(e) => setLine(i, { price: e.target.value })} placeholder="по-късно" />
                      </Field>
                    ) : (
                      <div />
                    )}
                    <div className="text-sm text-slate-500 pb-2 text-right">
                      {nkg > 0 ? `нето ${nkg.toLocaleString("bg-BG")} кг · ${fmtKg(nkg / 1000)}` : "—"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex flex-wrap justify-end gap-4 text-sm">
            <span className="text-slate-600">Общо нето: <b className="text-slate-900">{totalNetKg.toLocaleString("bg-BG")} кг · {fmtKg(totalNetKg / 1000)}</b></span>
            {isEdit && totalValue > 0 && (
              <span className="text-slate-600">Стойност: <b className="text-slate-900">{fmtLv(totalValue)}</b></span>
            )}
          </div>
        </div>

        <FormGrid cols={isEdit ? 3 : 1}>
          <Field label="Документ №">
            <input className="input" value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
          </Field>
          {isEdit && (
            <>
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
            </>
          )}
        </FormGrid>

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
