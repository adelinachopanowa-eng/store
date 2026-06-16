"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { GroupBalance, Material } from "@/lib/types";
import { fmtKg, fmtLv, fmtPrice } from "@/lib/format";
import { PageHeader, Loading, Empty, Modal } from "@/components/ui";

export default function GroupsPage() {
  const [rows, setRows] = useState<GroupBalance[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    const [b, m] = await Promise.all([
      supabase.from("wh_group_balances").select("*").order("group_name"),
      supabase.from("wh_materials").select("*").eq("active", true).order("name"),
    ]);
    setRows((b.data as GroupBalance[]) || []);
    setMaterials((m.data as Material[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!name.trim()) {
      setErr("Въведете име на групата");
      return;
    }
    setSaving(true);
    setErr("");
    const { error } = await supabase.from("wh_groups").insert({
      name: name.trim(),
      material_id: materialId || null,
      description: description || null,
    });
    setSaving(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setName("");
    setMaterialId("");
    setDescription("");
    setOpen(false);
    load();
  }

  return (
    <div>
      <PageHeader
        title="Групи / Партиди"
        subtitle="Складови групи със собствена средно претеглена цена"
        actions={
          <button className="btn-primary" onClick={() => setOpen(true)}>
            + Нова група
          </button>
        }
      />

      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty text="Все още няма групи. Създайте първата си група." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Група</th>
                <th className="th">Материал</th>
                <th className="th text-right">Наличност</th>
                <th className="th text-right">Средна цена</th>
                <th className="th text-right">Стойност</th>
                <th className="th">Статус</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.group_id} className="hover:bg-slate-50">
                  <td className="td font-medium text-slate-900">{r.group_name}</td>
                  <td className="td text-slate-500">{r.material_name || "—"}</td>
                  <td className="td text-right">{fmtKg(r.quantity_kg)}</td>
                  <td className="td text-right font-medium">{fmtPrice(r.avg_price)}</td>
                  <td className="td text-right">{fmtLv(r.total_value)}</td>
                  <td className="td">
                    <span
                      className={`badge ${
                        r.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {r.active ? "Активна" : "Неактивна"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Нова група">
        <div className="space-y-4">
          <div>
            <label className="label">Име на групата *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="напр. Стружки желязо" />
          </div>
          <div>
            <label className="label">Материал (по избор)</label>
            <select className="input" value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
              <option value="">— без —</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Описание</label>
            <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setOpen(false)}>
              Отказ
            </button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? "Запис…" : "Запази"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
