"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Material, Supplier } from "@/lib/types";
import { fmtPrice } from "@/lib/format";
import { PageHeader, Loading, Empty, Modal } from "@/components/ui";

type Tab = "materials" | "suppliers";

export default function NomenclaturePage() {
  const [tab, setTab] = useState<Tab>("materials");

  return (
    <div>
      <PageHeader title="Номенклатури" subtitle="База данни за бързо въвеждане" />
      <div className="flex gap-2 mb-4">
        <button
          className={tab === "materials" ? "btn-primary" : "btn-secondary"}
          onClick={() => setTab("materials")}
        >
          Материали
        </button>
        <button
          className={tab === "suppliers" ? "btn-primary" : "btn-secondary"}
          onClick={() => setTab("suppliers")}
        >
          Контрагенти
        </button>
      </div>
      {tab === "materials" ? <Materials /> : <Suppliers />}
    </div>
  );
}

function Materials() {
  const [rows, setRows] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", code: "", waste_code: "", unit: "кг", default_price: "" });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("wh_materials").select("*").order("name");
    setRows((data as Material[]) || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!f.name.trim()) {
      setErr("Въведете име");
      return;
    }
    setSaving(true);
    setErr("");
    const { error } = await supabase.from("wh_materials").insert({
      name: f.name.trim(),
      code: f.code || null,
      waste_code: f.waste_code || null,
      unit: f.unit || "кг",
      default_price: f.default_price ? Number(f.default_price) : null,
    });
    setSaving(false);
    if (error) return setErr(error.message);
    setF({ name: "", code: "", waste_code: "", unit: "кг", default_price: "" });
    setOpen(false);
    load();
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setOpen(true)}>
          + Нов материал
        </button>
      </div>
      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty text="Няма материали." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Код</th>
                <th className="th">Наименование</th>
                <th className="th">Код отпадък</th>
                <th className="th">Мярка</th>
                <th className="th text-right">Ориент. цена</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Нов материал">
        <div className="space-y-4">
          <div>
            <label className="label">Наименование *</label>
            <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Код</label>
              <input className="input" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
            </div>
            <div>
              <label className="label">Код отпадък</label>
              <input className="input" value={f.waste_code} onChange={(e) => setF({ ...f, waste_code: e.target.value })} />
            </div>
            <div>
              <label className="label">Мярка</label>
              <input className="input" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />
            </div>
            <div>
              <label className="label">Ориент. цена (лв/кг)</label>
              <input className="input" type="number" step="0.0001" value={f.default_price} onChange={(e) => setF({ ...f, default_price: e.target.value })} />
            </div>
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

function Suppliers() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", kind: "supplier", eik: "", egn: "", city: "", phone: "" });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("wh_suppliers").select("*").order("name");
    setRows((data as Supplier[]) || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!f.name.trim()) {
      setErr("Въведете име");
      return;
    }
    setSaving(true);
    setErr("");
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
    setF({ name: "", kind: "supplier", eik: "", egn: "", city: "", phone: "" });
    setOpen(false);
    load();
  }

  const kindBg: Record<string, string> = { supplier: "Доставчик", customer: "Клиент", both: "Доставчик/Клиент" };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button className="btn-primary" onClick={() => setOpen(true)}>
          + Нов контрагент
        </button>
      </div>
      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty text="Няма контрагенти." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Име</th>
                <th className="th">Тип</th>
                <th className="th">ЕИК</th>
                <th className="th">ЕГН</th>
                <th className="th">Град</th>
                <th className="th">Телефон</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Нов контрагент">
        <div className="space-y-4">
          <div>
            <label className="label">Име *</label>
            <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Тип</label>
            <select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
              <option value="supplier">Доставчик</option>
              <option value="customer">Клиент</option>
              <option value="both">Доставчик/Клиент</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">ЕИК</label>
              <input className="input" value={f.eik} onChange={(e) => setF({ ...f, eik: e.target.value })} />
            </div>
            <div>
              <label className="label">ЕГН</label>
              <input className="input" value={f.egn} onChange={(e) => setF({ ...f, egn: e.target.value })} />
            </div>
            <div>
              <label className="label">Град</label>
              <input className="input" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
            </div>
            <div>
              <label className="label">Телефон</label>
              <input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            </div>
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
