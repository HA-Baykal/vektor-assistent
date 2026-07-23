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
  equipmentMargin: number;
  workMargin: number;
  totalMargin: number;
  notes: string | null;
};

type Task = {
  id: number;
  date: string;
  time: string | null;
  text: string;
  status: string;
};

type ReportData = {
  period: string;
  from: string;
  to: string;
  deals: Deal[];
  tasks: Task[];
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

const PRESETS = [
  { value: "today", label: "Сегодня", icon: "📅" },
  { value: "yesterday", label: "Вчера", icon: "⬅️" },
  { value: "week", label: "Неделя", icon: "📊" },
  { value: "month", label: "Месяц", icon: "📈" },
  { value: "lastmonth", label: "Прошлый", icon: "🗃️" },
  { value: "custom", label: "Свой", icon: "📆" },
];

export default function ReportsPage() {
  const [period, setPeriod] = useState("week");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [showTasks, setShowTasks] = useState(true);

  const fetchReport = async (p: string) => {
    setLoading(true);
    let url = `/api/reports?period=${p}`;
    if (p === "custom") {
      url = `/api/reports?period=week&from=${customFrom}&to=${customTo}`;
    }
    const res = await fetch(url);
    const json = await res.json();
    setData(json);
    setLoading(false);
  };

  useEffect(() => {
    fetchReport(period);
  }, [period]);

  const applyCustom = () => {
    if (customFrom && customTo) {
      setPeriod("custom");
      fetchReport("custom");
    }
  };

  const exportCSV = () => {
    if (!data) return;

    const summaryLine = [
      `Чистая маржа,${data.summary.totalMargin}`,
      `Выручка,${data.summary.revenue}`,
      `Маржа оборудования,${data.summary.equipmentMargin}`,
      `Маржа работы,${data.summary.workMargin}`,
      `Всего сделок,${data.summary.count}`,
    ];

    const headers = [
      "Дата", "Категория",
      "Продажа (₽)", "Закупка (₽)", "Монтаж (₽)", "Материалы (₽)",
      "Маржа обор. (₽)", "Маржа работы (₽)", "Чистая маржа (₽)",
      "Заметки"
    ];

    const rows = data.deals.map((d) => [
      d.date, d.category, d.saleAmount, d.purchaseAmount,
      d.workAmount, d.materialsAmount, d.equipmentMargin,
      d.workMargin, d.totalMargin, d.notes || "",
    ]);

    const csvContent = [
      `Отчёт: ${formatDateRu(data.from)} — ${formatDateRu(data.to)}`,
      "",
      ...summaryLine,
      "",
      headers.map((h) => `"${h}"`).join(","),
      ...rows.map((r) => r.map((c) => `"${c}"`).join(",")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vektor-otchyot-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-slate-900 md:text-2xl">📊 Отчёты</h1>
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
        </div>
      </div>
    );
  }

  const s = data.summary;
  const maxMargin = Math.max(
    ...Object.values(data.byCategory).map((c) => c.margin),
    1
  );

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 md:text-2xl">📊 Отчёты</h1>
          <p className="text-xs text-slate-500 md:text-sm">
            {formatDateRu(data.from)} — {formatDateRu(data.to)}
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition active:scale-95 hover:bg-slate-50 hover:shadow-md md:px-5 md:text-sm"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Excel
        </button>
      </div>

      {/* Period presets */}
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:gap-2 md:px-0">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => { setPeriod(p.value); if (p.value !== "custom") fetchReport(p.value); }}
            className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-all md:px-4 md:text-sm ${
              period === p.value
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                : "bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-800"
            }`}
          >
            {p.icon} {p.label}
          </button>
        ))}
      </div>

      {/* Custom date range */}
      {period === "custom" && (
        <div className="animate-fade-in-up flex flex-wrap items-end gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-400">От</label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-400">До</label>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>
          <button
            onClick={applyCustom}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition active:scale-95 hover:bg-indigo-700"
          >
            📊 Показать
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="animate-fade-in-up grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4" style={{ animationDelay: "0.05s" }}>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 text-white shadow-lg md:p-5">
          <p className="text-[10px] font-medium opacity-80 md:text-xs">Чистая маржа</p>
          <p className="mt-1 text-lg font-black md:text-2xl">{formatRub(s.totalMargin)}</p>
          {s.count > 0 && (
            <p className="mt-0.5 text-[9px] opacity-60 md:text-[10px]">
              Средняя: {formatRub(Math.round(s.totalMargin / s.count))} / сд.
            </p>
          )}
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-4 text-white shadow-lg md:p-5">
          <p className="text-[10px] font-medium opacity-80 md:text-xs">Выручка</p>
          <p className="mt-1 text-lg font-black md:text-2xl">{formatRub(s.revenue)}</p>
          <p className="mt-0.5 text-[9px] opacity-60 md:text-[10px]">{s.count} сделок</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 p-4 text-white shadow-lg md:p-5">
          <p className="text-[10px] font-medium opacity-80 md:text-xs">Маржа оборудования</p>
          <p className="mt-1 text-lg font-black md:text-2xl">{formatRub(s.equipmentMargin)}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 p-4 text-white shadow-lg md:p-5">
          <p className="text-[10px] font-medium opacity-80 md:text-xs">Маржа работы</p>
          <p className="mt-1 text-lg font-black md:text-2xl">{formatRub(s.workMargin)}</p>
        </div>
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        {/* Detailed breakdown */}
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900 md:mb-4">📊 Детализация</h3>
          <div className="space-y-2 md:space-y-3">
            <BreakdownRow label="Продажа оборудования" value={s.revenue} positive />
            <BreakdownRow label="Закупка оборудования" value={s.purchase} />
            <BreakdownRow label="Маржа оборудования" value={s.equipmentMargin} positive bold />
            <div className="border-t border-slate-100" />
            <BreakdownRow label="Оплата работы (монтаж)" value={s.work} positive />
            <BreakdownRow label="Комплектация монтажа" value={s.materials} />
            <BreakdownRow label="Маржа работы" value={s.workMargin} positive bold />
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 p-3 md:mt-4 md:p-4">
            <span className="text-xs font-bold text-emerald-800 md:text-sm">ЧИСТАЯ МАРЖА</span>
            <span className="text-base font-black text-emerald-600 md:text-lg">{formatRub(s.totalMargin)}</span>
          </div>
        </div>

        {/* By category */}
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900 md:mb-4">📈 По категориям</h3>
          <div className="space-y-3 md:space-y-4">
            {Object.entries(data.byCategory).length === 0 ? (
              <div className="py-6 text-center md:py-8">
                <p className="text-3xl">📭</p>
                <p className="mt-2 text-xs text-slate-400 md:text-sm">Нет данных за период</p>
              </div>
            ) : (
              Object.entries(data.byCategory)
                .sort(([, a], [, b]) => b.margin - a.margin)
                .map(([cat, info]) => (
                  <div key={cat}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700 md:text-sm">
                        {cat}
                      </span>
                      <span className="text-[11px] text-slate-500 md:text-xs">
                        {info.count} сд. · {formatRub(info.margin)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 md:h-3">
                      <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                        style={{ width: `${Math.max((info.margin / maxMargin) * 100, 2)}%` }}
                      />
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>

      {/* Tasks for period */}
      <div className="animate-fade-in-up rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:p-5" style={{ animationDelay: "0.1s" }}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            ✅ Задачи за период
          </h3>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-600 md:px-3 md:py-1 md:text-xs">
              {data.tasks.length} шт.
            </span>
            <button
              onClick={() => setShowTasks(!showTasks)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              {showTasks ? "▲ Скрыть" : "▼ Показать"}
            </button>
          </div>
        </div>

        {showTasks && (
          <div className="space-y-1.5 md:space-y-2">
            {data.tasks.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-3xl">📭</p>
                <p className="mt-2 text-xs text-slate-400">Задач за период нет</p>
              </div>
            ) : (
              <>
                {/* Сгруппируем по датам */}
                {Object.entries(
                  data.tasks.reduce((acc: Record<string, Task[]>, t) => {
                    if (!acc[t.date]) acc[t.date] = [];
                    acc[t.date].push(t);
                    return acc;
                  }, {})
                ).sort(([a], [b]) => a.localeCompare(b)).map(([date, tasks]) => (
                  <div key={date} className="pt-1 first:pt-0">
                    <p className="mb-1 text-[10px] font-semibold text-slate-400 md:text-[11px]">
                      {formatDateRu(date)}
                    </p>
                    {tasks.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2 mb-1">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${t.status === "done" ? "bg-emerald-400" : "bg-amber-400"}`} />
                        <p className={`flex-1 text-xs ${t.status === "done" ? "text-slate-400 line-through" : "text-slate-700"}`}>
                          {t.text}
                        </p>
                        {t.time && (
                          <span className="text-[10px] text-slate-400">{t.time}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Deals list */}
      <div className="animate-fade-in-up rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:p-5" style={{ animationDelay: "0.15s" }}>
        <div className="mb-3 flex items-center justify-between md:mb-4">
          <h3 className="text-sm font-semibold text-slate-900">📋 Сделки за период</h3>
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-600 md:px-3 md:py-1 md:text-xs">
            {data.deals.length} шт.
          </span>
        </div>
        <div className="space-y-1.5 md:space-y-2">
          {data.deals.length === 0 ? (
            <div className="py-6 text-center md:py-8">
              <p className="text-3xl">📭</p>
              <p className="mt-2 text-xs text-slate-400">Сделок за период нет</p>
            </div>
          ) : (
            data.deals.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 transition active:scale-[0.99] hover:bg-slate-100">
                <div className="flex items-center gap-1.5">
                  <span className="rounded-lg bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 md:px-2 md:text-xs">
                    {d.category}
                  </span>
                  <span className="text-[10px] text-slate-400 md:text-xs">{formatDateRu(d.date)}</span>
                </div>
                <div className="flex items-center gap-2 md:gap-4">
                  <span className={`text-xs font-bold md:text-sm ${d.totalMargin >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatRub(d.totalMargin)}
                  </span>
                  <span className="text-[10px] text-slate-400 md:text-xs">из {formatRub(d.saleAmount)}</span>
                </div>
              </div>
            ))
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
  const isPositive = positive;
  const colorClass = value >= 0 && isPositive ? "text-emerald-600" : "text-red-500";
  return (
    <div className="flex items-center justify-between text-xs md:text-sm">
      <span className={bold ? "font-semibold text-slate-800" : "text-slate-500"}>{label}</span>
      <span className={`${bold ? "font-bold" : "font-medium"} ${colorClass}`}>
        {value >= 0 && isPositive ? "+" : ""}{formatRub(value)}
      </span>
    </div>
  );
}
