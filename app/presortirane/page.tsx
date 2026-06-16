"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { GroupBalance } from "@/lib/types";
import { fmtKg, fmtLv, fmtPrice, fmtDate } from "@/lib/format";
import { PageHeader, Loading, Empty, Modal } from "@/components/ui";

export default function TransfersPage() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<GroupBalance[]>([]);

  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadRefs() {
    const { data } = await supabase.from("wh_group_balances").select("*").eq("active", true).order("group_name");
    setGroups((data as GroupBalance[]) || []);
  }
  async function loadList() {
    setLoading(true);
    const { data } = await supabase
      .from("wh_transfers")
      .select("*, from_group:from_group_id(name), to_group:to_group_id(name)")
      .order("doc_date", { ascending: false })
      .limit(100);
    setList(data || []);
    setLoading(false);
  }
  useEffect(() => {
    loadRefs();
    loadList();
  }, []);

  const from = groups.find((g) => g.group_id === fromId);
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
    if (fromId === toId) return setErr("Групите трябва да са различни.");
    if (qtyN <= 0) return setErr("Въведете количество.");
    if (from && qtyN > Number(from.quantity_kg) + 0.001) return setErr(`Недостатъчна наличност (${fmtKg(from.quantity_kg)}).`);
    setSaving(true);
    const { error } = await supabase.rpc("wh_record_transfer", {
      p_from_group_id: fromId,
      p_to_group_id: toId,
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
        subtitle="Прехвърляне между групи с коректно преизчисляване на средната цена"
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
                <th className="th">От група</th>
                <th className="th">Към група</th>
                <th className="th text-right">Кол-во</th>
                <th className="th text-right">Ср. цена</th>
                <th className="th text-right">Стойност</th>
                <th className="th">Бележка</th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="td whitespace-nowrap">{fmtDate(t.doc_date)}</td>
                  <td className="td">{t.from_group?.name || "—"}</td>
                  <td className="td">{t.to_group?.name || "—"}</td>
                  <td className="td text-right">{fmtKg(t.quantity_kg)}</td>
                  <td className="td text-right">{fmtPrice(t.avg_cost)}</td>
                  <td className="td text-right">{fmtLv(t.value)}</td>
                  <td className="td text-slate-500">{t.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Пресортиране между групи">
        <div className="space-y-4">
          <div>
            <label className="label">От група *</label>
            <select className="input" value={fromId} onChange={(e) => setFromId(e.target.value)}>
              <option value="">— изберете —</option>
              {groups.map((g) => (
                <option key={g.group_id} value={g.group_id}>
                  {g.group_name} · налично {fmtKg(g.quantity_kg)} · {fmtPrice(g.avg_price)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Към група *</label>
            <select className="input" value={toId} onChange={(e) => setToId(e.target.value)}>
              <option value="">— изберете —</option>
              {groups
                .filter((g) => g.group_id !== fromId)
                .map((g) => (
                  <option key={g.group_id} value={g.group_id}>
                    {g.group_name} · налично {fmtKg(g.quantity_kg)} · {fmtPrice(g.avg_price)}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="label">Количество (кг) *</label>
            <input className="input" type="number" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          {from && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              Прехвърля се по средна цена <b>{fmtPrice(from.avg_price)}</b> на стойност <b>{fmtLv(moveVal)}</b>.
            </div>
          )}
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
              {saving ? "Запис…" : "Прехвърли"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
