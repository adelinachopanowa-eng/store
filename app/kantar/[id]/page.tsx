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
          .select("*, wh_suppliers(name, eik, egn, city, address), wh_delivery_allocations(gross_kg, tare_kg, net_kg, quantity_kg, wh_materials(name, code, waste_code))")
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

  const lines = (d.wh_delivery_allocations || []) as any[];
  const sup = d.wh_suppliers;
  const wt = dateTime(d.weighed_at || d.doc_date);
  const clientName = sup?.name || d.supplier_name || "—";
  const multi = lines.length > 1;

  return (
    <div className="py-6 flex flex-col items-center">
      <div className="no-print mb-4 flex gap-2">
        <button className="btn-secondary" onClick={() => router.push("/kantar")}>← Назад</button>
        <button className="btn-primary" onClick={() => window.print()}>🖨 Печат</button>
      </div>

      <div className="print-sheet bg-white shadow-sm border border-slate-200 mx-auto" style={{ width: "210mm", minHeight: "297mm", padding: "16mm" }}>
        {/* Хедър */}
        <div className="flex items-end justify-between border-b-4 border-brand-600 pb-4">
          <div>
            <div className="text-2xl font-black tracking-tight text-brand-700">{company?.name || "—"}</div>
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
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest text-slate-500">Кантарна бележка</div>
            <div className="text-4xl font-black text-brand-700">№ {d.seq_no ?? "—"}</div>
            {company?.site_name && <div className="text-xs text-slate-500 mt-1">Площадка: {company.site_name}</div>}
          </div>
        </div>

        {/* Дата/час */}
        <div className="flex justify-between items-center bg-brand-50 rounded-lg px-4 py-3 mt-5 text-sm">
          <div><span className="text-slate-500">Дата на измерване: </span><span className="font-bold text-slate-900">{wt.d}</span></div>
          <div><span className="text-slate-500">Час: </span><span className="font-bold text-slate-900">{wt.tm}</span></div>
          {d.doc_number && <div><span className="text-slate-500">Документ №: </span><span className="font-semibold text-slate-900">{d.doc_number}</span></div>}
        </div>

        {/* Реквизити */}
        <div className="grid grid-cols-3 gap-4 mt-5">
          <InfoBox label="Клиент">
            <div className="font-bold text-slate-900 text-base">{clientName}</div>
            <div className="text-xs text-slate-600 mt-0.5">
              {sup?.eik && <span>ЕИК: {sup.eik}　</span>}
              {sup?.egn && <span>ЕГН: {sup.egn}</span>}
              {(sup?.address || sup?.city) && <div>{[sup?.address, sup?.city].filter(Boolean).join(", ")}</div>}
            </div>
          </InfoBox>
          <InfoBox label="Рег. № на автомобил">
            <div className="font-bold text-slate-900 text-base tracking-wide">{d.vehicle_reg || "—"}</div>
          </InfoBox>
          <InfoBox label="Шофьор">
            <div className="font-bold text-slate-900 text-base">{d.driver_name || "—"}</div>
          </InfoBox>
        </div>

        {/* Таблица с измервания */}
        <div className="mt-6">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-brand-600 text-white">
                <th className="text-left font-semibold px-3 py-2 border border-brand-700">№</th>
                <th className="text-left font-semibold px-3 py-2 border border-brand-700">Материал</th>
                <th className="text-right font-semibold px-3 py-2 border border-brand-700">Бруто (кг)</th>
                <th className="text-right font-semibold px-3 py-2 border border-brand-700">Тара (кг)</th>
                <th className="text-right font-semibold px-3 py-2 border border-brand-700">Нето (кг)</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((a, i) => (
                <tr key={i} className={i % 2 ? "bg-cream" : "bg-white"}>
                  <td className="px-3 py-2 border border-slate-300">{i + 1}</td>
                  <td className="px-3 py-2 border border-slate-300 font-medium">
                    {a.wh_materials?.name || "—"}
                    {a.wh_materials?.waste_code && <span className="text-xs text-slate-500"> · код {a.wh_materials.waste_code}</span>}
                  </td>
                  <td className="px-3 py-2 border border-slate-300 text-right tabular-nums">{kg(a.gross_kg)}</td>
                  <td className="px-3 py-2 border border-slate-300 text-right tabular-nums">{kg(a.tare_kg)}</td>
                  <td className="px-3 py-2 border border-slate-300 text-right tabular-nums font-semibold">{kg(a.net_kg)}</td>
                </tr>
              ))}
            </tbody>
            {multi && (
              <tfoot>
                <tr className="bg-brand-50 font-bold">
                  <td className="px-3 py-2 border border-slate-300" colSpan={2}>ОБЩО</td>
                  <td className="px-3 py-2 border border-slate-300 text-right tabular-nums">{kg(d.gross_kg)}</td>
                  <td className="px-3 py-2 border border-slate-300 text-right tabular-nums">{kg(d.tare_kg)}</td>
                  <td className="px-3 py-2 border border-slate-300 text-right tabular-nums">{kg(d.net_kg)}</td>
                </tr>
              </tfoot>
            )}
          </table>

          {/* Акцент общо нето */}
          <div className="mt-4 flex justify-end">
            <div className="bg-brand-600 text-white rounded-lg px-6 py-3 text-right">
              <div className="text-xs uppercase tracking-widest text-accent-400">Общо нето</div>
              <div className="text-3xl font-black tabular-nums">{kg(d.net_kg)} <span className="text-lg">кг</span></div>
              <div className="text-xs text-brand-100">{t(d.net_quantity)} т</div>
            </div>
          </div>
        </div>

        {/* Подпис */}
        <div className="mt-20 flex justify-end">
          <div className="text-center w-64">
            <div className="border-t border-slate-400 pt-1 text-sm text-slate-600">Измерил (подпис)</div>
          </div>
        </div>

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
