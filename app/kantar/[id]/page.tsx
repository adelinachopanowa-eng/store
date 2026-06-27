"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Company } from "@/lib/types";
import { Loading } from "@/components/ui";

const kg = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("bg-BG", { maximumFractionDigits: 0 });
const t = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("bg-BG", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

function dateTime(iso?: string | null) {
  if (!iso) return { d: "—", tm: "" };
  const dt = new Date(iso);
  return {
    d: dt.toLocaleDateString("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric" }),
    tm: dt.toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" }),
  };
}

export default function WeighNotePrint() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [d, setD] = useState<any | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [del, comp] = await Promise.all([
        supabase
          .from("wh_deliveries")
          .select("*, wh_suppliers(name, eik, egn, city, address), wh_delivery_allocations(quantity_kg, wh_materials(name, code, waste_code))")
          .eq("id", id)
          .single(),
        supabase.from("wh_company").select("*").eq("id", 1).single(),
      ]);
      setD(del.data);
      setCompany(comp.data as Company);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <Loading />;
  if (!d) return <div className="p-10 text-center text-slate-400">Бележката не е намерена.</div>;

  const mat = d.wh_delivery_allocations?.[0]?.wh_materials;
  const sup = d.wh_suppliers;
  const wt = dateTime(d.weighed_at || d.doc_date);
  const clientName = sup?.name || d.supplier_name || "—";

  return (
    <div className="py-6 flex flex-col items-center">
      {/* лента с бутони (не се печата) */}
      <div className="no-print mb-4 flex gap-2">
        <button className="btn-secondary" onClick={() => router.push("/kantar")}>← Назад</button>
        <button className="btn-primary" onClick={() => window.print()}>🖨 Печат</button>
      </div>

      {/* A4 лист */}
      <div className="print-sheet bg-white shadow-sm border border-slate-200 mx-auto" style={{ width: "210mm", minHeight: "297mm", padding: "16mm" }}>
        {/* Хедър с фирмени данни */}
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-lg bg-slate-800 text-white flex items-center justify-center text-2xl font-black">
              {(company?.name || "P").slice(0, 1)}
            </div>
            <div>
              <div className="text-2xl font-black tracking-tight text-slate-900">{company?.name || "—"}</div>
              <div className="text-xs text-slate-600 mt-1 leading-relaxed">
                {company?.eik && <span>ЕИК: {company.eik}　</span>}
                {company?.vat_no && <span>ДДС: {company.vat_no}</span>}
                {(company?.address || company?.city) && (
                  <div>{[company?.address, company?.city].filter(Boolean).join(", ")}</div>
                )}
                {(company?.phone || company?.email) && (
                  <div>{[company?.phone && `тел. ${company.phone}`, company?.email].filter(Boolean).join("　·　")}</div>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest text-slate-500">Кантарна бележка</div>
            <div className="text-4xl font-black text-slate-900">№ {d.seq_no ?? "—"}</div>
            {company?.site_name && <div className="text-xs text-slate-500 mt-1">Площадка: {company.site_name}</div>}
          </div>
        </div>

        {/* Дата/час на измерване */}
        <div className="flex justify-between items-center bg-slate-50 rounded-lg px-4 py-3 mt-5 text-sm">
          <div>
            <span className="text-slate-500">Дата на измерване: </span>
            <span className="font-bold text-slate-900">{wt.d}</span>
          </div>
          <div>
            <span className="text-slate-500">Час: </span>
            <span className="font-bold text-slate-900">{wt.tm}</span>
          </div>
          {d.doc_number && (
            <div>
              <span className="text-slate-500">Документ №: </span>
              <span className="font-semibold text-slate-900">{d.doc_number}</span>
            </div>
          )}
        </div>

        {/* Реквизити: клиент / автомобил / материал */}
        <div className="grid grid-cols-2 gap-4 mt-5">
          <InfoBox label="Клиент">
            <div className="font-bold text-slate-900 text-base">{clientName}</div>
            <div className="text-xs text-slate-600 mt-0.5">
              {sup?.eik && <span>ЕИК: {sup.eik}　</span>}
              {sup?.egn && <span>ЕГН: {sup.egn}</span>}
              {(sup?.address || sup?.city) && <div>{[sup?.address, sup?.city].filter(Boolean).join(", ")}</div>}
            </div>
          </InfoBox>
          <InfoBox label="Материал">
            <div className="font-bold text-slate-900 text-base">{mat?.name || "—"}</div>
            <div className="text-xs text-slate-600 mt-0.5">
              {mat?.code && <span>Код: {mat.code}　</span>}
              {mat?.waste_code && <span>Код отпадък: {mat.waste_code}</span>}
            </div>
          </InfoBox>
          <InfoBox label="Рег. № на автомобил">
            <div className="font-bold text-slate-900 text-base tracking-wide">{d.vehicle_reg || "—"}</div>
          </InfoBox>
          <InfoBox label="Шофьор">
            <div className="font-bold text-slate-900 text-base">{d.driver_name || "—"}</div>
          </InfoBox>
        </div>

        {/* Тегла */}
        <div className="mt-6">
          <div className="grid grid-cols-3 gap-px bg-slate-300 rounded-lg overflow-hidden border border-slate-300">
            <WeightCell label="БРУТО" value={kg(d.gross_kg)} unit="кг" />
            <WeightCell label="ТАРА" value={kg(d.tare_kg)} unit="кг" />
            <WeightCell label="НЕТО" value={kg(d.net_kg)} unit="кг" highlight />
          </div>
          <div className="text-right text-sm text-slate-500 mt-2">
            Нето в тонове: <span className="font-bold text-slate-800">{t(d.net_quantity)} т</span>
          </div>
        </div>

        {/* Подписи */}
        <div className="grid grid-cols-3 gap-8 mt-16">
          <Signature label="Предал (клиент)" />
          <Signature label="Приел (оператор)" />
          <Signature label="Кантарджия" />
        </div>

        {/* Футър */}
        <div className="mt-10 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400">
          Документът е генериран от складовата система на {company?.name || ""} · {wt.d} {wt.tm}
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-slate-200 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">{label}</div>
      {children}
    </div>
  );
}

function WeightCell({ label, value, unit, highlight }: { label: string; value: string; unit: string; highlight?: boolean }) {
  return (
    <div className={`p-5 text-center ${highlight ? "bg-slate-800 text-white" : "bg-white text-slate-900"}`}>
      <div className={`text-xs uppercase tracking-widest ${highlight ? "text-slate-300" : "text-slate-500"}`}>{label}</div>
      <div className="text-3xl font-black mt-1 tabular-nums">{value}</div>
      <div className={`text-xs ${highlight ? "text-slate-300" : "text-slate-400"}`}>{unit}</div>
    </div>
  );
}

function Signature({ label }: { label: string }) {
  return (
    <div className="text-center">
      <div className="border-t border-slate-400 pt-1 text-xs text-slate-500">{label}</div>
    </div>
  );
}
