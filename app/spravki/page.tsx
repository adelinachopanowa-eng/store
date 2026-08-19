"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MaterialBalance } from "@/lib/types";
import { fmtKg, fmtLv, fmtPrice, fmtDate } from "@/lib/format";
import { PageHeader, Loading, Stat } from "@/components/ui";

type Report = "stock" | "deliveries" | "sales" | "to_invoice" | "unpaid" | "audit";

function toCSV(rows: Record<string, any>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(";")];
  for (const r of rows) {
    lines.push(headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(";"));
  }
  return "﻿" + lines.join("\n");
}
function download(name: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [report, setReport] = useState<Report>("stock");
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);

  async function load() {
    setLoading(true);
    const fromTs = new Date(from + "T00:00:00").toISOString();
    const toTs = new Date(to + "T23:59:59").toISOString();
    if (report === "stock") {
      const { data: d } = await supabase.from("wh_material_balances").select("*").order("material_name");
      setData(d || []);
    } else if (report === "deliveries") {
      const { data: d } = await supabase
        .from("wh_deliveries")
        .select("*, wh_suppliers(name)")
        .gte("doc_date", fromTs)
        .lte("doc_date", toTs)
        .order("doc_date", { ascending: false });
      setData(d || []);
    } else if (report === "sales") {
      const { data: d } = await supabase
        .from("wh_sales")
        .select("*, wh_materials(name), wh_suppliers(name)")
        .gte("doc_date", fromTs)
        .lte("doc_date", toTs)
        .order("doc_date", { ascending: false });
      setData(d || []);
    } else if (report === "unpaid") {
      const [del, sal] = await Promise.all([
        supabase.from("wh_deliveries").select("*, wh_suppliers(name)").eq("paid", false).eq("voided", false),
        supabase.from("wh_sales").select("*, wh_suppliers(name)").eq("paid", false).eq("voided", false),
      ]);
      setData([
        ...(del.data || []).map((x: any) => ({ ...x, _kind: "Доставка", _party: x.wh_suppliers?.name || x.supplier_name, _amount: x.total_value })),
        ...(sal.data || []).map((x: any) => ({ ...x, _kind: "Продажба", _party: x.wh_suppliers?.name || x.buyer_name, _amount: x.sale_value })),
      ]);
    } else if (report === "to_invoice") {
      const [del, sal] = await Promise.all([
        supabase.from("wh_deliveries").select("*, wh_suppliers(name)").eq("needs_invoice", true).eq("invoiced", false).eq("voided", false),
        supabase.from("wh_sales").select("*, wh_suppliers(name)").eq("needs_invoice", true).eq("invoiced", false).eq("voided", false),
      ]);
      setData([
        ...(del.data || []).map((x: any) => ({ ...x, _kind: "Доставка", _party: x.wh_suppliers?.name || x.supplier_name, _amount: x.total_value, _date: x.doc_date, _paid: x.paid })),
        ...(sal.data || []).map((x: any) => ({ ...x, _kind: "Продажба", _party: x.wh_suppliers?.name || x.buyer_name, _amount: x.sale_value, _date: x.doc_date, _paid: x.paid })),
      ]);
    } else if (report === "audit") {
      const { data: d } = await supabase
        .from("wh_audit_log")
        .select("*")
        .order("at", { ascending: false })
        .limit(500);
      setData(d || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report]);

  function exportCSV() {
    let rows: any[] = [];
    if (report === "stock")
      rows = (data as MaterialBalance[]).map((r) => ({
        Материал: r.material_name,
        "Наличност т": Number(r.quantity_kg).toFixed(3),
        "Средна цена €/т": Number(r.avg_price).toFixed(2),
        "Стойност €": Number(r.total_value).toFixed(2),
      }));
    else if (report === "deliveries")
      rows = data.map((d) => ({
        Дата: fmtDate(d.doc_date),
        Документ: d.doc_number,
        Доставчик: d.wh_suppliers?.name || d.supplier_name,
        "Нето т": d.net_quantity,
        "Цена €/т": d.unit_price,
        "Стойност €": d.total_value,
        Плащане: d.payment_method === "bank" ? "Банка" : "Брой",
        Платено: d.paid ? "Да" : "Не",
      }));
    else if (report === "sales")
      rows = data.map((s) => ({
        Дата: fmtDate(s.doc_date),
        Документ: s.doc_number,
        Материал: s.wh_materials?.name,
        Купувач: s.wh_suppliers?.name || s.buyer_name,
        "Кол-во т": s.quantity_kg,
        "Себестойност €/т": s.avg_cost,
        "Прод. цена €/т": s.unit_price,
        "Приход €": s.sale_value,
        "Печалба €": s.sale_value != null ? (s.sale_value - s.cost_value).toFixed(2) : "",
        Платено: s.paid ? "Да" : "Не",
      }));
    else if (report === "unpaid")
      rows = data.map((x) => ({
        Тип: x._kind,
        Дата: fmtDate(x.doc_date),
        Контрагент: x._party,
        "Сума €": x._amount,
        Плащане: x.payment_method === "bank" ? "Банка" : "Брой",
      }));
    else if (report === "to_invoice")
      rows = data.map((x) => ({
        Тип: x._kind,
        Дата: fmtDate(x._date),
        Документ: x.doc_number,
        Контрагент: x._party,
        "Сума €": x._amount,
        Платено: x._paid ? "Да" : "Не",
      }));
    else if (report === "audit")
      rows = data.map((x) => ({
        "Дата/час": fmtDate(x.at),
        Документ: `${x.entity} ${x.doc_ref || ""}`.trim(),
        Действие: x.action === "void" ? "Анулиране" : "Редакция",
        Детайли: x.details || "",
        Причина: x.reason || "",
      }));
    download(`spravka_${report}_${today}.csv`, toCSV(rows));
  }

  return (
    <div>
      <PageHeader
        title="Справки"
        subtitle="Генериране и експорт на справки"
        actions={
          <button className="btn-secondary" onClick={exportCSV} disabled={!data.length}>
            ⬇ Експорт CSV
          </button>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        {([
          ["stock", "Складови наличности"],
          ["deliveries", "Доставки за период"],
          ["sales", "Продажби и печалба"],
          ["to_invoice", "За фактуриране"],
          ["unpaid", "Неплатени"],
          ["audit", "Корекции и анулирани"],
        ] as [Report, string][]).map(([v, l]) => (
          <button key={v} className={report === v ? "btn-primary" : "btn-secondary"} onClick={() => setReport(v)}>
            {l}
          </button>
        ))}
      </div>

      {(report === "deliveries" || report === "sales") && (
        <div className="flex gap-3 mb-4 items-end">
          <div>
            <label className="label">От дата</label>
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">До дата</label>
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={load}>
            Покажи
          </button>
        </div>
      )}

      {loading ? <Loading /> : <ReportTable report={report} data={data} />}
    </div>
  );
}

function ReportTable({ report, data }: { report: Report; data: any[] }) {
  if (report === "stock") {
    const totVal = data.reduce((s, r) => s + Number(r.total_value), 0);
    const totQty = data.reduce((s, r) => s + Number(r.quantity_kg), 0);
    return (
      <>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Stat label="Общо наличност" value={fmtKg(totQty)} color="blue" />
          <Stat label="Складова стойност" value={fmtLv(totVal)} color="green" />
          <Stat label="Материали" value={String(data.length)} />
        </div>
        <Table
          rightFrom={1}
          head={["Материал", "Наличност", "Средна цена", "Стойност"]}
          rows={data.map((r) => [r.material_name, fmtKg(r.quantity_kg), fmtPrice(r.avg_price), fmtLv(r.total_value)])}
        />
      </>
    );
  }
  if (report === "deliveries") {
    const tot = data.reduce((s, d) => s + Number(d.total_value), 0);
    const totKg = data.reduce((s, d) => s + Number(d.accounted_quantity), 0);
    return (
      <>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Stat label="Брой доставки" value={String(data.length)} />
          <Stat label="Нето (чисто)" value={fmtKg(totKg)} color="blue" />
          <Stat label="Обща стойност" value={fmtLv(tot)} color="green" />
        </div>
        <Table
          rightFrom={2}
          head={["Дата", "Доставчик", "Нето", "Цена", "Стойност", "Плащане"]}
          rows={data.map((d) => [
            fmtDate(d.doc_date),
            d.wh_suppliers?.name || d.supplier_name || "—",
            fmtKg(d.accounted_quantity),
            fmtPrice(d.unit_price),
            fmtLv(d.total_value),
            `${d.payment_method === "bank" ? "Банка" : "Брой"} · ${d.paid ? "Платено" : "Не"}`,
          ])}
        />
      </>
    );
  }
  if (report === "sales") {
    const rev = data.reduce((s, x) => s + Number(x.sale_value || 0), 0);
    const cost = data.reduce((s, x) => s + Number(x.cost_value || 0), 0);
    return (
      <>
        <div className="grid grid-cols-4 gap-4 mb-4">
          <Stat label="Брой продажби" value={String(data.length)} />
          <Stat label="Приход" value={fmtLv(rev)} color="green" />
          <Stat label="Себестойност" value={fmtLv(cost)} />
          <Stat label="Печалба" value={fmtLv(rev - cost)} color={rev - cost >= 0 ? "green" : "red"} />
        </div>
        <Table
          rightFrom={3}
          head={["Дата", "Материал", "Купувач", "Кол-во", "Себест.", "Приход", "Печалба"]}
          rows={data.map((s) => [
            fmtDate(s.doc_date),
            s.wh_materials?.name || "—",
            s.wh_suppliers?.name || s.buyer_name || "—",
            fmtKg(s.quantity_kg),
            fmtLv(s.cost_value),
            s.sale_value != null ? fmtLv(s.sale_value) : "—",
            s.sale_value != null ? fmtLv(s.sale_value - s.cost_value) : "—",
          ])}
        />
      </>
    );
  }
  if (report === "to_invoice") {
    const tot = data.reduce((s, x) => s + Number(x._amount || 0), 0);
    return (
      <>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Stat label="Брой за фактуриране" value={String(data.length)} color="amber" />
          <Stat label="Обща сума" value={fmtLv(tot)} color="blue" />
        </div>
        <Table
          rightFrom={4}
          head={["Тип", "Дата", "Документ", "Контрагент", "Сума", "Платено"]}
          rows={data.map((x) => [
            x._kind,
            fmtDate(x._date),
            x.doc_number || "—",
            x._party || "—",
            x._amount != null ? fmtLv(x._amount) : "—",
            x._paid ? "Да" : "Не",
          ])}
        />
      </>
    );
  }
  if (report === "audit") {
    const voids = data.filter((x) => x.action === "void").length;
    const edits = data.filter((x) => x.action === "edit").length;
    return (
      <>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Stat label="Редакции" value={String(edits)} color="amber" />
          <Stat label="Анулирани документи" value={String(voids)} color="red" />
        </div>
        <Table
          rightFrom={99}
          head={["Дата/час", "Документ", "Действие", "Детайли", "Причина"]}
          rows={data.map((x) => [
            fmtDate(x.at),
            `${x.entity} ${x.doc_ref || ""}`.trim(),
            x.action === "void" ? "🗑 Анулиране" : "✏ Редакция",
            x.details || "—",
            x.reason || "—",
          ])}
        />
      </>
    );
  }
  // unpaid
  const tot = data.reduce((s, x) => s + Number(x._amount || 0), 0);
  return (
    <>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Stat label="Брой неплатени" value={String(data.length)} color="amber" />
        <Stat label="Обща сума" value={fmtLv(tot)} color="red" />
      </div>
      <Table
        rightFrom={3}
        head={["Тип", "Дата", "Контрагент", "Сума", "Плащане"]}
        rows={data.map((x) => [
          x._kind,
          fmtDate(x.doc_date),
          x._party || "—",
          fmtLv(x._amount),
          x.payment_method === "bank" ? "Банка" : "Брой",
        ])}
      />
    </>
  );
}

function Table({
  head,
  rows,
  rightFrom = 3,
}: {
  head: string[];
  rows: (string | number)[][];
  rightFrom?: number;
}) {
  if (!rows.length) return <div className="card p-10 text-center text-slate-400 text-sm">Няма данни.</div>;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[640px] rtable">
        <thead className="bg-slate-50">
          <tr>
            {head.map((h, i) => (
              <th key={i} className={`th ${i >= rightFrom ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-slate-50">
              {r.map((c, j) => (
                <td key={j} data-label={head[j] ?? ""} className={`td ${j >= rightFrom ? "text-right" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
