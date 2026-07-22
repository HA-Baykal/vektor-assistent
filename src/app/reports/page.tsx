"use client";

import { useState, useEffect } from "react";
import { formatRub, formatDateRu, formatDateFull } from "@/lib/parser";

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
  { value: "today", label: "Сегодня", icon: "📅" },
  { value: "yesterday", label: "Вчера", icon: "⬅️" },
  { value: "week", label: "Неделя", icon: "📊" },
  { value: "month", label: "Месяц", icon: "📈" },
  { value: "lastmonth", label: "Прошлый месяц", icon: "🗃️" },
];

const CATEGORY_ICONS: Record<string, string> = {
  "Кондиционер": "❄️",
  "Окна": "🪟",
  "Вентиляция": "💨",
  "Бурение": "🛠️",
  "Объект": "🏗️",
};

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

    // Строка с периодом
    const headerInfo = [`Отчёт: ${formatDateRu(data.from)} — ${formatDateRu(data.to)}`];
    
    // Строка с итогами
    const summaryLine = [
      `Чистая маржа,${data.summary.totalMargin}`,
      `Выручка,${data.summary.revenue}`,
      `Маржа оборудования,${data.summary.equipmentMargin}`,
      `Маржа работы,${data.summary.workMargin}`,
      `Всего сделок,${data.summary.count}`,
    ];

    // Заголовки таблицы
    const headers = [
      "Дата", "Категория",
      "Продажа (₽)", "Закупка (₽)", "Монтаж (₽)", "Материалы (₽)",
      "Маржа обор. (₽)", "Маржа работы (₽)", "Чистая маржа (₽)",
      "Заметки"
    ];

    // Данные сделок
    const rows = data.deals.map((d) => [
      d.date,
      d.category,
      d.saleAmount,
      d.purchaseAmount,
      d.workAmount,
      d.materialsAmount,
      d.equipmentMargin,
      d.workMargin,
      d.totalMargin,
      d.notes || "",
    ]);

    // Собираем CSV
    const csvContent = [
      headerInfo.join(","),
      "",
      ...summaryLine,
      "",
      headers.map((h) => `"${h}"`).join(","),
      ...rows.map((r) => r.map((c) => `"${c}"`).join(",")),
    ].join("\n");

    // Добавляем BOM для корректного отображения русских букв в Excel
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `vektor-otchyot-${period}-${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading || !data) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">📊 Отчёты</h1>
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
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">📊 Отчёты</h1>
          <p className="text-sm text-slate-500">
            {formatDateRu(data.from)} — {formatDateRu(data.to)}
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:shadow-md active:scale-95"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Экспорт в Excel
        </button>
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              period === p.value
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                : "bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-800"
            }`}
          >
            {p.icon} {p.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white shadow-lg">
          <p className="text-xs font-medium opacity-80">Чистая маржа</p>
          <p className="mt-1.5 text-2xl font-black">{formatRub(s.totalMargin)}</p>
          {s.count > 0 && (
            <p className="mt-1 text-[10px] opacity-60">
              Средняя маржа: {formatRub(Math.round(s.totalMargin / s.count))} / сделка
            </p>
          )}
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-5 text-white shadow-lg">
          <p className="text-xs font-medium opacity-80">Выручка</p>
          <p className="mt-1.5 text-2xl font-black">{formatRub(s.revenue)}</p>
          <p className="mt-1 text-[10px] opacity-60">{s.count} сделок</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 p-5 text-white shadow-lg">
          <p className="text-xs font-medium opacity-80">Маржа оборудования</p>
          <p className="mt-1.5 text-2xl font-black">{formatRub(s.equipmentMargin)}</p>
          <p className="mt-1 text-[10px] opacity-60">
            Продажа: {formatRub(s.revenue)} - Закупка: {formatRub(s.purchase)}
          </p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 p-5 text-white shadow-lg">
          <p className="text-xs font-medium opacity-80">Маржа работы</p>
          <p className="mt-1.5 text-2xl font-black">{formatRub(s.workMargin)}</p>
          <p className="mt-1 text-[10px] opacity-60">
            Работа: {formatRub(s.work)} - Материалы: {formatRub(s.materials)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Detailed breakdown */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
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
            <span className="text-lg font-black text-emerald-600">
              {formatRub(s.totalMargin)}
            </span>
          </div>
        </div>

        {/* By category */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">
            📈 По категориям
          </h3>
          <div className="space-y-4">
            {Object.entries(data.byCategory).map(([cat, info]) => (
              <div key={cat}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                    {CATEGORY_ICONS[cat] || "📦"} {cat}
                  </span>
                  <span className="text-xs text-slate-500">
                    {info.count} сделок · {formatRub(info.margin)}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                    style={{
                      width: `${Math.max((info.margin / maxMargin) * 100, 2)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            {Object.keys(data.byCategory).length === 0 && (
              <div className="py-8 text-center">
                <p className="text-3xl">📭</p>
                <p className="mt-2 text-sm text-slate-400">Нет данных за период</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Deals list */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            📋 Сделки за период
          </h3>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
            {data.deals.length} шт.
          </span>
        </div>
        <div className="space-y-2">
          {data.deals.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-3xl">📭</p>
              <p className="mt-2 text-sm text-slate-400">Сделок за период нет</p>
            </div>
          ) : (
            data.deals.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 transition hover:bg-slate-100"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{CATEGORY_ICONS[d.category] || "📦"}</span>
                  <span className="rounded-lg bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-600">
                    {d.category}
                  </span>
                  <span className="text-xs text-slate-400">{formatDateRu(d.date)}</span>
                  {d.notes && (
                    <span className="hidden max-w-[200px] truncate text-xs text-slate-400 md:inline">
                      · {d.notes}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className={`text-sm font-bold ${
                      d.totalMargin >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}>
                      {formatRub(d.totalMargin)}
                    </span>
                    <span className="ml-1.5 text-xs text-slate-400">
                      из {formatRub(d.saleAmount)}
                    </span>
                  </div>
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
  // Если positive=true и значение должно отображаться со знаком +
  const isPositive = positive;
  const colorClass = value >= 0 && isPositive ? "text-emerald-600" : "text-red-500";
  
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={bold ? "font-semibold text-slate-800" : "text-slate-500"}>
        {label}
      </span>
      <span
        className={`${bold ? "font-bold" : "font-medium"} ${colorClass}`}
      >
        {value >= 0 && isPositive ? "+" : ""}{formatRub(value)}
      </span>
    </div>
  );
}
