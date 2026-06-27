"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Company } from "@/lib/types";
import { PageHeader, Loading, Field, FormGrid, FormError } from "@/components/ui";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const [f, setF] = useState<Partial<Company>>({});

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("wh_company").select("*").eq("id", 1).single();
    setF((data as Company) || { id: 1 });
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    setErr("");
    setOk(false);
    const { error } = await supabase.from("wh_company").update({
      name: f.name || null,
      eik: f.eik || null,
      vat_no: f.vat_no || null,
      mol: f.mol || null,
      address: f.address || null,
      city: f.city || null,
      phone: f.phone || null,
      email: f.email || null,
      site_name: f.site_name || null,
    }).eq("id", 1);
    setSaving(false);
    if (error) return setErr(error.message);
    setOk(true);
    setTimeout(() => setOk(false), 2500);
  }

  if (loading) return <Loading />;

  return (
    <div className="max-w-3xl">
      <PageHeader title="Настройки" subtitle="Данни за фирмата (отпечатват се върху кантарните бележки)" />

      <div className="card p-5 space-y-4">
        <Field label="Наименование на фирмата">
          <input className="input" value={f.name || ""} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <FormGrid cols={2}>
          <Field label="ЕИК">
            <input className="input" value={f.eik || ""} onChange={(e) => setF({ ...f, eik: e.target.value })} />
          </Field>
          <Field label="ИН по ДДС">
            <input className="input" value={f.vat_no || ""} onChange={(e) => setF({ ...f, vat_no: e.target.value })} />
          </Field>
          <Field label="МОЛ">
            <input className="input" value={f.mol || ""} onChange={(e) => setF({ ...f, mol: e.target.value })} />
          </Field>
          <Field label="Площадка / обект">
            <input className="input" value={f.site_name || ""} onChange={(e) => setF({ ...f, site_name: e.target.value })} />
          </Field>
          <Field label="Адрес">
            <input className="input" value={f.address || ""} onChange={(e) => setF({ ...f, address: e.target.value })} />
          </Field>
          <Field label="Град">
            <input className="input" value={f.city || ""} onChange={(e) => setF({ ...f, city: e.target.value })} />
          </Field>
          <Field label="Телефон">
            <input className="input" value={f.phone || ""} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </Field>
          <Field label="Имейл">
            <input className="input" value={f.email || ""} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
        </FormGrid>
        <FormError msg={err} />
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Запис…" : "Запази"}
          </button>
          {ok && <span className="text-emerald-600 text-sm">✓ Запазено</span>}
        </div>
      </div>
    </div>
  );
}
