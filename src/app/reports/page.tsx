"use client";

import { useState, useEffect } from "react";
import { formatRub, formatDateRu } from "@/lib/parser";

type Deal = {
  id: number;
  date: string;
  category: string;
  saleAmount: number;
  purchaseAmount: number;
  workAmount: number;
  materialsAmount: number;
  totalMargin: number;
};

type ReportData = {
  period: string;
  from: string;
  to: string;
  deals: Deal[];
  summary: {
    count: number;
    revenue: number;
    purchase: number;
    work: number;
    materials: number;
    equipmentMargin: number;
    workMargin: number;
    totalMargin: number;
  };
  byCategory: Record<string, { count: number; margin: number; revenue: number }>;
};

const PERIODS = [
  { value: "today", label: "Сегодня" },
  { value: "yesterday", label: "Вчера" },
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
  { value: "lastmonth", label: "Прошлый месяц" },
];

export default function ReportsPage() {
  const [period, setPeriod] = useState("week");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = async (p: string) => {
    setLoading(true);
    const res = await fetch(`/api/reports?period=${p}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  };

  useEffect(() => {
    fetchReport(period);
  }, [period]);

  const exportCSV = () => {
    if (!data) return;
    const rows = [
      ["Дата", "Категория", "Продажа", "Закупка", "Монтаж", "Материалы", "Маржа"],
      ...data.deals.map((d) => [
        d.date,
        d.category,
        d.saleAmount,
        d.purchaseAmount,
        d.workAmount,
        d.materialsAmount,
        d.totalMargin,
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${c}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `otchyot-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Отчёты</h1>
        <p className="py-8 text-center text-sm text-slate-400">Загрузка...</p>
      </div>
    );
  }

  const s = data.summary;
  const maxMargin = Math.max(
    ...Object.values(data.byCategory).map((c) => c.margin),
    1
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Отчёты</h1>
          <p className="text-sm text-slate-500">
            {formatDateRu(data.from)} — {formatDateRu(data.to)}
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          📥 Экспорт CSV
        </button>
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              period === p.value
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 text-white shadow-md">
          <p className="text-xs opacity-80">Чистая маржа</p>
          <p className="mt-1 text-xl font-bold">{formatRub(s.totalMargin)}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-4 text-white shadow-md">
          <p className="text-xs opacity-80">Выручка</p>
          <p className="mt-1 text-xl font-bold">{formatRub(s.revenue)}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 p-4 text-white shadow-md">
          <p className="text-xs opacity-80">Маржа оборудования</p>
          <p className="mt-1 text-xl font-bold">
            {formatRub(s.equipmentMargin)}
          </p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 p-4 text-white shadow-md">
          <p className="text-xs opacity-80">Маржа работы</p>
          <p className="mt-1 text-xl font-bold">{formatRub(s.workMargin)}</p>
        </div>
      </div>

      {/* Detailed breakdown */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">
          📊 Детализация
        </h3>
        <div className="space-y-3">
          <BreakdownRow label="Продажа оборудования" value={s.revenue} positive />
          <BreakdownRow label="Закупка оборудования" value={s.purchase} />
          <BreakdownRow
            label="Маржа оборудования"
            value={s.equipmentMargin}
            positive
            bold
          />
          <div className="border-t border-slate-100" />
          <BreakdownRow label="Оплата работы (монтаж)" value={s.work} positive />
          <BreakdownRow label="Комплектация монтажа" value={s.materials} />
          <BreakdownRow
            label="Маржа работы"
            value={s.workMargin}
            positive
            bold
          />
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-50 p-4">
          <span className="text-sm font-bold text-emerald-800">
            ЧИСТАЯ МАРЖА
          </span>
          <span className="text-lg font-bold text-emerald-600">
            {formatRub(s.totalMargin)}
          </span>
        </div>
      </div>

      {/* By category */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">
          📈 По категориям
        </h3>
        <div className="space-y-3">
          {Object.entries(data.byCategory).map(([cat, info]) => (
            <div key={cat}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{cat}</span>
                <span className="text-slate-500">
                  {info.count} сделок · {formatRub(info.margin)}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                  style={{
                    width: `${(info.margin / maxMargin) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))}
          {Object.keys(data.byCategory).length === 0 && (
            <p className="py-4 text-center text-sm text-slate-400">
              Нет данных за период
            </p>
          )}
        </div>
      </div>

      {/* Deals list */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-slate-900">
          📋 Сделки за период ({data.deals.length})
        </h3>
        <div className="space-y-2">
          {data.deals.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3"
            >
              <div>
                <span className="rounded-lg bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
                  {d.category}
                </span>
                <span className="ml-2 text-xs text-slate-400">
                  {formatDateRu(d.date)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-emerald-600">
                  {formatRub(d.totalMargin)}
                </span>
                <span className="ml-2 text-xs text-slate-400">
                  из {formatRub(d.saleAmount)}
                </span>
              </div>
            </div>
          ))}
          {data.deals.length === 0 && (
            <p className="py-4 text-center text-sm text-slate-400">
              Сделок за период нет
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  positive,
  bold,
}: {
  label: string;
  value: number;
  positive?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={bold ? "font-semibold text-slate-800" : "text-slate-500"}>
        {label}
      </span>
      <span
        className={`${bold ? "font-bold" : "font-medium"} ${
          positive ? "text-emerald-600" : "text-red-500"
        }`}
      >
        {positive ? "+" : "-"}
        {formatRub(value)}
      </span>
    </div>
  );
}
