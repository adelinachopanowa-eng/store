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
  const [editItem, setEditItem] = useState<any | null>(null);
  const [materials, setMaterials] = useState<MaterialBalance[]>([]);

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

  return (
    <div>
      <PageHeader
        title="Пресортиране"
        subtitle="Прехвърляне между материали с коректно преизчисляване на средната цена"
        actions={
          <button
            className="btn-primary"
            onClick={() => {
              setEditItem(null);
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
                      <div className="flex gap-1 items-center">
                        <button
                          className="text-xs text-slate-500 hover:text-brand-600 px-2 py-1 rounded hover:bg-slate-100"
                          onClick={() => { setEditItem(t); setOpen(true); }}
                        >
                          Редакция
                        </button>
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
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TransferModal
        open={open}
        onClose={() => setOpen(false)}
        editItem={editItem}
        materials={materials}
        onSaved={() => { loadList(); loadRefs(); }}
      />
    </div>
  );
}

function TransferModal({
  open,
  onClose,
  editItem,
  materials,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editItem: any | null;
  materials: MaterialBalance[];
  onSaved: () => void;
}) {
  const isEdit = !!editItem;

  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [qty, setQty] = useState("");
  const [docDate, setDocDate] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editItem) {
      setFromId(editItem.from_material_id || "");
      setToId(editItem.to_material_id || "");
      setQty(String(editItem.quantity_kg ?? ""));
      setDocDate(editItem.doc_date ? editItem.doc_date.slice(0, 10) : "");
      setNote(editItem.note || "");
    } else {
      setFromId("");
      setToId("");
      setQty("");
      setDocDate(new Date().toISOString().slice(0, 10));
      setNote("");
    }
    setErr("");
  }, [open, editItem]);

  const from = materials.find((m) => m.material_id === fromId);
  const qtyN = Number(qty) || 0;
  const moveVal = from ? qtyN * Number(from.avg_price) : 0;

  async function save() {
    setErr("");
    setSaving(true);
    try {
      if (isEdit) {
        const { error } = await supabase.rpc("wh_update_transfer", {
          p_transfer_id: editItem.id,
          p_doc_date: docDate ? new Date(docDate + "T12:00:00").toISOString() : null,
          p_note: note || null,
        });
        if (error) throw new Error(error.message);
      } else {
        if (!fromId || !toId) return setErr("Изберете източник и цел.");
        if (fromId === toId) return setErr("Материалите трябва да са различни.");
        if (qtyN <= 0) return setErr("Въведете количество.");
        if (from && qtyN > Number(from.quantity_kg) + 0.001)
          return setErr(`Недостатъчна наличност (${fmtKg(from.quantity_kg)}).`);

        const { error } = await supabase.rpc("wh_record_transfer", {
          p_from_material_id: fromId,
          p_to_material_id: toId,
          p_quantity_kg: qtyN,
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
    <Modal open={open} onClose={onClose} title={isEdit ? "Редакция на пресортиране" : "Пресортиране между материали"}>
      <div className="space-y-4">
        {isEdit ? (
          <div className="rounded-lg bg-slate-50 p-3 text-sm space-y-1">
            <div><span className="text-slate-500">От: </span><span className="font-medium">{editItem?.from_mat?.name}</span></div>
            <div><span className="text-slate-500">Към: </span><span className="font-medium">{editItem?.to_mat?.name}</span></div>
            <div><span className="text-slate-500">Количество: </span><span className="font-medium">{fmtKg(editItem?.quantity_kg)}</span></div>
          </div>
        ) : (
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
        )}

        {!isEdit && from && (
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            Прехвърля се по средна цена <b>{fmtPrice(from.avg_price)}</b> на стойност <b>{fmtLv(moveVal)}</b>.
          </div>
        )}

        <FormGrid cols={2}>
          <Field label="Дата">
            <input className="input" type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
          </Field>
          <Field label="Бележка">
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </FormGrid>

        <FormError msg={err} />
        <FormActions>
          <button className="btn-secondary" onClick={onClose}>Отказ</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Запис…" : isEdit ? "Запази промените" : "Прехвърли"}
          </button>
        </FormActions>
      </div>
    </Modal>
  );
}
