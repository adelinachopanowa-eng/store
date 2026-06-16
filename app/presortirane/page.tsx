"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MaterialBalance } from "@/lib/types";
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

export default function TransfersPage() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [materials, setMaterials] = useState<MaterialBalance[]>([]);

  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadRefs() {
    const { data } = await supabase.from("wh_material_balances").select("*").order("material_name");
    setMaterials((data as MaterialBalance[]) || []);
  }
  async function loadList() {
    setLoading(true);
    const { data } = await supabase
      .from("wh_transfers")
      .select("*, from_mat:from_material_id(name), to_mat:to_material_id(name)")
      .order("doc_date", { ascending: false })
      .limit(100);
    setList(data || []);
    setLoading(false);
  }
  useEffect(() => {
    loadRefs();
    loadList();
  }, []);

  const from = materials.find((m) => m.material_id === fromId);
  const qtyN = Number(qty) || 0;
  const moveVal = from ? qtyN * Number(from.avg_price) : 0;

  function reset() {
    setFromId("");
    setToId("");
    setQty("");
    setNote("");
    setErr("");
  }

  async function save() {
    setErr("");
    if (!fromId || !toId) return setErr("Изберете източник и цел.");
    if (fromId === toId) return setErr("Материалите трябва да са различни.");
    if (qtyN <= 0) return setErr("Въведете количество.");
    if (from && qtyN > Number(from.quantity_kg) + 0.001) return setErr(`Недостатъчна наличност (${fmtKg(from.quantity_kg)}).`);
    setSaving(true);
    const { error } = await supabase.rpc("wh_record_transfer", {
      p_from_material_id: fromId,
      p_to_material_id: toId,
      p_quantity_kg: qtyN,
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
        title="Пресортиране"
        subtitle="Прехвърляне между материали с коректно преизчисляване на средната цена"
        actions={
          <button
            className="btn-primary"
            onClick={() => {
              reset();
              setOpen(true);
            }}
          >
            + Ново пресортиране
          </button>
        }
      />

      {loading ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty text="Няма пресортирания." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Дата</th>
                <th className="th">От материал</th>
                <th className="th">Към материал</th>
                <th className="th text-right">Кол-во</th>
                <th className="th text-right">Ср. цена</th>
                <th className="th text-right">Стойност</th>
                <th className="th">Бележка</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className={`hover:bg-slate-50 ${t.voided ? "opacity-50" : ""}`}>
                  <td className="td whitespace-nowrap">{fmtDate(t.doc_date)}</td>
                  <td className="td">{t.from_mat?.name || "—"}</td>
                  <td className="td">{t.to_mat?.name || "—"}</td>
                  <td className="td text-right">{fmtKg(t.quantity_kg)}</td>
                  <td className="td text-right">{fmtPrice(t.avg_cost)}</td>
                  <td className="td text-right">{fmtLv(t.value)}</td>
                  <td className="td text-slate-500">{t.note || "—"}</td>
                  <td className="td">
                    {t.voided ? (
                      <VoidedBadge />
                    ) : (
                      <VoidButton
                        onVoid={async (reason) => {
                          const { error } = await supabase.rpc("wh_void_transfer", {
                            p_transfer_id: t.id,
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

      <Modal open={open} onClose={() => setOpen(false)} title="Пресортиране между материали">
        <div className="space-y-4">
          <FormGrid cols={1}>
            <Field label="От материал" required>
              <select className="input" value={fromId} onChange={(e) => setFromId(e.target.value)}>
                <option value="">— изберете —</option>
                {materials.map((m) => (
                  <option key={m.material_id} value={m.material_id}>
                    {m.material_name} · {fmtKg(m.quantity_kg)} · {fmtPrice(m.avg_price)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Към материал" required>
              <select className="input" value={toId} onChange={(e) => setToId(e.target.value)}>
                <option value="">— изберете —</option>
                {materials
                  .filter((m) => m.material_id !== fromId)
                  .map((m) => (
                    <option key={m.material_id} value={m.material_id}>
                      {m.material_name} · {fmtKg(m.quantity_kg)} · {fmtPrice(m.avg_price)}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Количество (т)" required>
              <input className="input" type="number" step="0.001" value={qty} onChange={(e) => setQty(e.target.value)} />
            </Field>
          </FormGrid>

          {from && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              Прехвърля се по средна цена <b>{fmtPrice(from.avg_price)}</b> на стойност <b>{fmtLv(moveVal)}</b>.
            </div>
          )}

          <Field label="Бележка">
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>

          <FormError msg={err} />
          <FormActions>
            <button className="btn-secondary" onClick={() => setOpen(false)}>
              Отказ
            </button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? "Запис…" : "Прехвърли"}
            </button>
          </FormActions>
        </div>
      </Modal>
    </div>
  );
}
