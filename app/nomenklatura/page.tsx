"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Material, Supplier } from "@/lib/types";
import { fmtPrice } from "@/lib/format";
import { PageHeader, Loading, Empty, Modal, Field, FormGrid, FormActions, FormError } from "@/components/ui";

type Tab = "materials" | "suppliers";

export default function NomenclaturePage() {
  const [tab, setTab] = useState<Tab>("materials");
  return (
    <div>
      <PageHeader title="Номенклатури" subtitle="База данни за бързо въвеждане" />
      <div className="flex gap-2 mb-4">
        <button className={tab === "materials" ? "btn-primary" : "btn-secondary"} onClick={() => setTab("materials")}>
          Материали
        </button>
        <button className={tab === "suppliers" ? "btn-primary" : "btn-secondary"} onClick={() => setTab("suppliers")}>
          Контрагенти
        </button>
      </div>
      {tab === "materials" ? <Materials /> : <Suppliers />}
    </div>
  );
}

// ─── Materials ───────────────────────────────────────────────────────────────

function Materials() {
  const [rows, setRows] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<Material | null>(null);
  const [f, setF] = useState({ name: "", code: "", waste_code: "", unit: "т", default_price: "" });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("wh_materials").select("*").order("name");
    setRows((data as Material[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openNew() {
    setEditItem(null);
    setF({ name: "", code: "", waste_code: "", unit: "т", default_price: "" });
    setErr("");
    setOpen(true);
  }
  function openEdit(m: Material) {
    setEditItem(m);
    setF({
      name: m.name,
      code: m.code || "",
      waste_code: m.waste_code || "",
      unit: m.unit || "т",
      default_price: m.default_price != null ? String(m.default_price) : "",
    });
    setErr("");
    setOpen(true);
  }

  async function save() {
    if (!f.name.trim()) { setErr("Въведете ime"); return; }
    setSaving(true);
    setErr("");
    if (editItem) {
      const { error } = await supabase.rpc("wh_update_material", {
        p_id: editItem.id,
        p_name: f.name.trim(),
        p_code: f.code || "",
        p_waste_code: f.waste_code || "",
        p_unit: f.unit || "т",
        p_default_price: f.default_price ? Number(f.default_price) : null,
      });
      setSaving(false);
      if (error) return setErr(error.message);
    } else {
      const { error } = await supabase.from("wh_materials").insert({
        name: f.name.trim(),
        code: f.code || null,
        waste_code: f.waste_code || null,
        unit: f.unit || "т",
        default_price: f.default_price ? Number(f.default_price) : null,
      });
      setSaving(false);
      if (error) return setErr(error.message);
    }
    setOpen(false);
    load();
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={openNew}>+ Нов материал</button>
      </div>
      {loading ? <Loading /> : rows.length === 0 ? <Empty text="Няма материали." /> : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Код</th>
                <th className="th">Наименование</th>
                <th className="th">Код отпадък</th>
                <th className="th">Мярка</th>
                <th className="th text-right">Ориент. цена</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="td">{m.code || "—"}</td>
                  <td className="td font-medium text-slate-900">{m.name}</td>
                  <td className="td">{m.waste_code || "—"}</td>
                  <td className="td">{m.unit}</td>
                  <td className="td text-right">{m.default_price != null ? fmtPrice(m.default_price) : "—"}</td>
                  <td className="td">
                    <button
                      className="text-xs text-slate-500 hover:text-brand-600 px-2 py-1 rounded hover:bg-slate-100"
                      onClick={() => openEdit(m)}
                    >
                      Редакция
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editItem ? "Редакция на материал" : "Нов материал"}>
        <div className="space-y-4">
          <Field label="Наименование" required>
            <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </Field>
          <FormGrid cols={2}>
            <Field label="Код">
              <input className="input" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
            </Field>
            <Field label="Код отпадък">
              <input className="input" value={f.waste_code} onChange={(e) => setF({ ...f, waste_code: e.target.value })} />
            </Field>
            <Field label="Мярка">
              <input className="input" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />
            </Field>
            <Field label="Ориент. цена (€/т)">
              <input className="input" type="number" step="0.0001" value={f.default_price} onChange={(e) => setF({ ...f, default_price: e.target.value })} />
            </Field>
          </FormGrid>
          <FormError msg={err} />
          <FormActions>
            <button className="btn-secondary" onClick={() => setOpen(false)}>Отказ</button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? "Запис…" : editItem ? "Запази промените" : "Запази"}
            </button>
          </FormActions>
        </div>
      </Modal>
    </div>
  );
}

// ─── Suppliers ───────────────────────────────────────────────────────────────

function Suppliers() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<Supplier | null>(null);
  const [f, setF] = useState({ name: "", kind: "supplier", eik: "", egn: "", city: "", phone: "" });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("wh_suppliers").select("*").order("name");
    setRows((data as Supplier[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openNew() {
    setEditItem(null);
    setF({ name: "", kind: "supplier", eik: "", egn: "", city: "", phone: "" });
    setErr("");
    setOpen(true);
  }
  function openEdit(s: Supplier) {
    setEditItem(s);
    setF({ name: s.name, kind: s.kind, eik: s.eik || "", egn: s.egn || "", city: s.city || "", phone: s.phone || "" });
    setErr("");
    setOpen(true);
  }

  async function save() {
    if (!f.name.trim()) { setErr("Въведете ime"); return; }
    setSaving(true);
    setErr("");
    if (editItem) {
      const { error } = await supabase.rpc("wh_update_supplier", {
        p_id: editItem.id,
        p_name: f.name.trim(),
        p_kind: f.kind,
        p_eik: f.eik || "",
        p_egn: f.egn || "",
        p_city: f.city || "",
        p_phone: f.phone || "",
      });
      setSaving(false);
      if (error) return setErr(error.message);
    } else {
      const { error } = await supabase.from("wh_suppliers").insert({
        name: f.name.trim(),
        kind: f.kind,
        eik: f.eik || null,
        egn: f.egn || null,
        city: f.city || null,
        phone: f.phone || null,
      });
      setSaving(false);
      if (error) return setErr(error.message);
    }
    setOpen(false);
    load();
  }

  const kindBg: Record<string, string> = { supplier: "Доставчик", customer: "Клиент", both: "Доставчик/Клиент" };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={openNew}>+ Нов контрагент</button>
      </div>
      {loading ? <Loading /> : rows.length === 0 ? <Empty text="Няма контрагенти." /> : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Ime</th>
                <th className="th">Тип</th>
                <th className="th">ЕИК</th>
                <th className="th">ЕГН</th>
                <th className="th">Град</th>
                <th className="th">Телефон</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="td font-medium text-slate-900">{s.name}</td>
                  <td className="td">{kindBg[s.kind]}</td>
                  <td className="td">{s.eik || "—"}</td>
                  <td className="td">{s.egn || "—"}</td>
                  <td className="td">{s.city || "—"}</td>
                  <td className="td">{s.phone || "—"}</td>
                  <td className="td">
                    <button
                      className="text-xs text-slate-500 hover:text-brand-600 px-2 py-1 rounded hover:bg-slate-100"
                      onClick={() => openEdit(s)}
                    >
                      Редакция
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editItem ? "Редакция на контрагент" : "Нов контрагент"}>
        <div className="space-y-4">
          <FormGrid cols={2}>
            <Field label="Ime" required>
              <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </Field>
            <Field label="Тип">
              <select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
                <option value="supplier">Доставчик</option>
                <option value="customer">Клиент</option>
                <option value="both">Доставчик/Клиент</option>
              </select>
            </Field>
            <Field label="ЕИК">
              <input className="input" value={f.eik} onChange={(e) => setF({ ...f, eik: e.target.value })} />
            </Field>
            <Field label="ЕГН">
              <input className="input" value={f.egn} onChange={(e) => setF({ ...f, egn: e.target.value })} />
            </Field>
            <Field label="Град">
              <input className="input" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
            </Field>
            <Field label="Телефон">
              <input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            </Field>
          </FormGrid>
          <FormError msg={err} />
          <FormActions>
            <button className="btn-secondary" onClick={() => setOpen(false)}>Отказ</button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? "Запис…" : editItem ? "Запази промените" : "Запази"}
            </button>
          </FormActions>
        </div>
      </Modal>
    </div>
  );
}
