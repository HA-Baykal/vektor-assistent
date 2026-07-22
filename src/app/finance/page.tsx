"use client";

import { useState, useEffect, useCallback } from "react";
import VoiceInput from "@/components/VoiceInput";
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
  createdAt: string;
};

const CATEGORIES = ["Кондиционер", "Окна", "Вентиляция", "Бурение", "Объект"];

const CATEGORY_ICONS: Record<string, string> = {
  "Кондиционер": "❄️",
  "Окна": "🪟",
  "Вентиляция": "💨",
  "Бурение": "🛠️",
  "Объект": "🏗️",
};

export default function FinancePage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all");
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: "Кондиционер",
    saleAmount: "",
    purchaseAmount: "",
    workAmount: "",
    materialsAmount: "",
    notes: "",
  });

  const fetchDeals = useCallback(async () => {
    const res = await fetch("/api/deals");
    const data = await res.json();
    setDeals(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  const showMessage = (text: string, type: "success" | "error" = "success") => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(""), 6000);
  };

  const handleVoiceResult = async (text: string) => {
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.deals && data.deals.length > 0) {
        const total = data.deals.reduce((s: number, d: Deal) => s + d.totalMargin, 0);
        showMessage(
          `✅ Записал ${data.deals.length} сделок(и)\n💰 Итого маржа: ${formatRub(total)}`
        );
      } else {
        showMessage("❌ Не удалось распознать сделку. Попробуйте иначе.", "error");
      }
      fetchDeals();
    } catch {
      showMessage("❌ Ошибка при обработке", "error");
    }
  };

  const handleCreate = async () => {
    const body = {
      date: form.date,
      category: form.category,
      saleAmount: parseInt(form.saleAmount) || 0,
      purchaseAmount: parseInt(form.purchaseAmount) || 0,
      workAmount: parseInt(form.workAmount) || 0,
      materialsAmount: parseInt(form.materialsAmount) || 0,
      notes: form.notes || null,
    };
    await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setForm({
      date: new Date().toISOString().slice(0, 10),
      category: "Кондиционер",
      saleAmount: "",
      purchaseAmount: "",
      workAmount: "",
      materialsAmount: "",
      notes: "",
    });
    setShowForm(false);
    showMessage("✅ Сделка создана");
    fetchDeals();
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const idToDelete = deleteConfirm;
    setDeleteConfirm(null);
    try {
      await fetch(`/api/deals?id=${idToDelete}`, { method: "DELETE" });
      showMessage("🗑️ Сделка удалена");
      if (selectedDeal?.id === idToDelete) setSelectedDeal(null);
      fetchDeals();
    } catch {
      showMessage("❌ Ошибка при удалении", "error");
    }
  };

  const filtered =
    filter === "all" ? deals : deals.filter((d) => d.category === filter);

  const totalMargin = filtered.reduce((s, d) => s + d.totalMargin, 0);
  const totalRevenue = filtered.reduce((s, d) => s + d.saleAmount, 0);
  const totalDeals = filtered.length;

  const sortedFiltered = [...filtered].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 md:text-2xl">💰 Финансы</h1>
          <p className="text-xs text-slate-500 md:text-sm">Учёт сделок и маржинальность</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition active:scale-95 hover:bg-indigo-700"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {showForm ? "Закрыть" : "Сделка"}
        </button>
      </div>

      {/* Voice input */}
      <div className="animate-fade-in-up rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 p-4 shadow-xl md:p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-lg">🎙️</span>
          <h2 className="text-sm font-semibold text-white">Голосовой ввод сделки</h2>
        </div>
        <VoiceInput
          onResult={handleVoiceResult}
          placeholder='Например: "Продал кондиционер за 40 тысяч, купил за 30, монтаж 20, расходка 10"'
        />
        {message && (
          <div className={`mt-3 whitespace-pre-line rounded-xl p-3 text-xs leading-relaxed md:text-sm ${
            messageType === "success" ? "bg-white/15 text-white" : "bg-red-500/20 text-red-100"
          }`}>
            {message}
          </div>
        )}
      </div>

      {/* Summary cards — на мобилке 3 колонки с меньшим padding */}
      <div className="animate-fade-in-up grid grid-cols-3 gap-2 md:gap-4" style={{ animationDelay: "0.05s" }}>
        <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm md:p-4">
          <div className="mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-xs md:h-8 md:w-8 md:text-sm">💰</div>
          <p className="text-[10px] text-center text-slate-500 md:text-xs">Маржа</p>
          <p className="mt-0.5 text-center text-sm font-bold text-emerald-600 md:text-xl">{formatRub(totalMargin)}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm md:p-4">
          <div className="mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-xs md:h-8 md:w-8 md:text-sm">📈</div>
          <p className="text-[10px] text-center text-slate-500 md:text-xs">Выручка</p>
          <p className="mt-0.5 text-center text-sm font-bold text-blue-600 md:text-xl">{formatRub(totalRevenue)}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm md:p-4">
          <div className="mx-auto mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-xs md:h-8 md:w-8 md:text-sm">📋</div>
          <p className="text-[10px] text-center text-slate-500 md:text-xs">Сделок</p>
          <p className="mt-0.5 text-center text-sm font-bold text-slate-900 md:text-xl">{totalDeals}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="animate-fade-in-up flex flex-wrap gap-1.5 md:gap-2" style={{ animationDelay: "0.1s" }}>
        <button
          onClick={() => setFilter("all")}
          className={`rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-all md:px-4 md:py-1.5 md:text-xs ${
            filter === "all"
              ? "bg-slate-900 text-white shadow-md"
              : "bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-700"
          }`}
        >
          Все
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-all md:px-4 md:py-1.5 md:text-xs ${
              filter === cat
                ? "bg-slate-900 text-white shadow-md"
                : "bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-700"
            }`}
          >
            {CATEGORY_ICONS[cat] || "📦"} {cat}
          </button>
        ))}
      </div>

      {/* Manual form */}
      {showForm && (
        <div className="animate-fade-in-up rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:p-6">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">📝 Новая сделка</h3>
          <div className="space-y-3 md:space-y-4">
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-400">Дата</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-400">Категория</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-400">Продажа (₽)</label>
                <input
                  type="number"
                  value={form.saleAmount}
                  onChange={(e) => setForm({ ...form, saleAmount: e.target.value })}
                  placeholder="0"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-400">Закупка (₽)</label>
                <input
                  type="number"
                  value={form.purchaseAmount}
                  onChange={(e) => setForm({ ...form, purchaseAmount: e.target.value })}
                  placeholder="0"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-400">Монтаж (₽)</label>
                <input
                  type="number"
                  value={form.workAmount}
                  onChange={(e) => setForm({ ...form, workAmount: e.target.value })}
                  placeholder="0"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-400">Расход (₽)</label>
                <input
                  type="number"
                  value={form.materialsAmount}
                  onChange={(e) => setForm({ ...form, materialsAmount: e.target.value })}
                  placeholder="0"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-400">Заметки</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Описание сделки..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {/* Предпросмотр маржи */}
            {(() => {
              const s = parseInt(form.saleAmount) || 0;
              const p = parseInt(form.purchaseAmount) || 0;
              const w = parseInt(form.workAmount) || 0;
              const m = parseInt(form.materialsAmount) || 0;
              const margin = s - p + w - m;
              return (
                <div className={`rounded-xl p-3 md:p-4 ${
                  margin >= 0 ? "bg-emerald-50" : "bg-red-50"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 md:text-sm">Предварительная маржа:</span>
                    <span className={`text-base font-bold md:text-lg ${
                      margin >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}>
                      {formatRub(margin)}
                    </span>
                  </div>
                </div>
              );
            })()}

            <div className="flex gap-2 md:gap-3">
              <button
                onClick={handleCreate}
                className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-200 transition active:scale-95 hover:bg-emerald-600"
              >
                💾 Создать
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-medium text-slate-600 transition active:scale-95 hover:bg-slate-200"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deals list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
        </div>
      ) : (
        <div className="space-y-2 md:space-y-3">
          {sortedFiltered.length === 0 && (
            <div className="animate-fade-in-up rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
              <p className="text-4xl">💰</p>
              <p className="mt-3 text-sm font-medium text-slate-400">
                Сделок пока нет
              </p>
              <p className="mt-1 text-xs text-slate-300">
                Добавьте голосом или через кнопку «Сделка»
              </p>
            </div>
          )}
          {sortedFiltered.map((deal) => (
            <div
              key={deal.id}
              className="group animate-fade-in-up cursor-pointer rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm transition-all active:scale-[0.99] hover:border-indigo-100 hover:shadow-md md:p-4"
              onClick={() => setSelectedDeal(deal)}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <span className="text-sm md:text-lg">{CATEGORY_ICONS[deal.category] || "📦"}</span>
                    <span className="rounded-lg bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 md:text-xs">
                      {deal.category}
                    </span>
                    <span className="text-[11px] text-slate-400 md:text-xs">{formatDateRu(deal.date)}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 md:gap-x-6">
                    <div className="flex items-center gap-1">
                      <span className="h-1 w-1 rounded-full bg-emerald-400 md:h-1.5 md:w-1.5" />
                      <span className="text-[11px] text-slate-400 md:text-xs">Прод:</span>
                      <span className="text-[11px] font-semibold text-slate-700 md:text-xs">{formatRub(deal.saleAmount)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="h-1 w-1 rounded-full bg-red-400 md:h-1.5 md:w-1.5" />
                      <span className="text-[11px] text-slate-400 md:text-xs">Зак:</span>
                      <span className="text-[11px] font-semibold text-red-500 md:text-xs">-{formatRub(deal.purchaseAmount)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="h-1 w-1 rounded-full bg-blue-400 md:h-1.5 md:w-1.5" />
                      <span className="text-[11px] text-slate-400 md:text-xs">Монт:</span>
                      <span className="text-[11px] font-semibold text-slate-700 md:text-xs">{formatRub(deal.workAmount)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="h-1 w-1 rounded-full bg-amber-400 md:h-1.5 md:w-1.5" />
                      <span className="text-[11px] text-slate-400 md:text-xs">Расх:</span>
                      <span className="text-[11px] font-semibold text-amber-600 md:text-xs">-{formatRub(deal.materialsAmount)}</span>
                    </div>
                  </div>
                  {deal.notes && (
                    <p className="mt-1.5 truncate text-[11px] text-slate-400 md:text-xs">{deal.notes}</p>
                  )}
                </div>
                <div className="ml-2 flex shrink-0 flex-col items-end gap-0.5 md:ml-4 md:gap-1">
                  <div
                    className={`rounded-xl px-2 py-1 md:px-3 md:py-1.5 ${
                      deal.totalMargin >= 0 ? "bg-emerald-50" : "bg-red-50"
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className={`text-xs font-bold md:text-sm ${
                      deal.totalMargin >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}>
                      {deal.totalMargin >= 0 ? "+" : ""}{formatRub(deal.totalMargin)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm(deal.id);
                    }}
                    className="touch-target flex items-center justify-center rounded-lg px-1.5 py-1 text-xs text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 md:px-2"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Deal Detail Modal */}
      {selectedDeal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center"
          onClick={() => setSelectedDeal(null)}
        >
          <div
            className="w-full max-w-lg animate-slide-up rounded-2xl rounded-b-none bg-white p-5 shadow-2xl md:rounded-b-2xl md:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle для мобильного свайпа */}
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 md:hidden" />

            <div className="flex items-start justify-between mb-4 md:mb-5">
              <div className="flex items-center gap-2 md:gap-3">
                <span className="text-xl md:text-2xl">{CATEGORY_ICONS[selectedDeal.category] || "📦"}</span>
                <div>
                  <h2 className="text-base font-bold text-slate-900 md:text-lg">{selectedDeal.category}</h2>
                  <p className="text-[11px] text-slate-400 md:text-xs">
                    {formatDateFull(selectedDeal.date)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDeal(null)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400 transition hover:bg-slate-200 hover:text-slate-600 md:h-8 md:w-8"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 md:space-y-3">
              {/* Доходы */}
              <div className="rounded-xl bg-emerald-50 p-3 md:p-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 md:text-xs">Доходы</p>
                <div className="space-y-1.5 md:space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600 md:text-sm">Продажа оборудования</span>
                    <span className="text-xs font-bold text-emerald-600 md:text-sm">+{formatRub(selectedDeal.saleAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600 md:text-sm">Монтаж и работы</span>
                    <span className="text-xs font-bold text-emerald-600 md:text-sm">+{formatRub(selectedDeal.workAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-emerald-200 pt-1.5 md:pt-2">
                    <span className="text-xs font-semibold text-slate-700 md:text-sm">Итого доход</span>
                    <span className="text-xs font-bold text-emerald-700 md:text-sm">
                      +{formatRub(selectedDeal.saleAmount + selectedDeal.workAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Расходы */}
              <div className="rounded-xl bg-red-50 p-3 md:p-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-red-600 md:text-xs">Расходы</p>
                <div className="space-y-1.5 md:space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600 md:text-sm">Закупка оборудования</span>
                    <span className="text-xs font-bold text-red-500 md:text-sm">-{formatRub(selectedDeal.purchaseAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600 md:text-sm">Материалы и комплектация</span>
                    <span className="text-xs font-bold text-red-500 md:text-sm">-{formatRub(selectedDeal.materialsAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-red-200 pt-1.5 md:pt-2">
                    <span className="text-xs font-semibold text-slate-700 md:text-sm">Итого расход</span>
                    <span className="text-xs font-bold text-red-600 md:text-sm">
                      -{formatRub(selectedDeal.purchaseAmount + selectedDeal.materialsAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Итоговая маржа */}
              <div className={`rounded-xl p-3 md:p-4 ${
                selectedDeal.totalMargin >= 0 ? "bg-slate-900 text-white" : "bg-red-600 text-white"
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80 md:text-xs">Чистая маржа</p>
                    <p className="mt-0.5 text-[10px] opacity-70 md:text-xs">
                      Оборудование: {formatRub(selectedDeal.equipmentMargin)} · Работа: {formatRub(selectedDeal.workMargin)}
                    </p>
                  </div>
                  <p className="text-lg font-black md:text-2xl">
                    {selectedDeal.totalMargin >= 0 ? "+" : ""}{formatRub(selectedDeal.totalMargin)}
                  </p>
                </div>
              </div>

              {/* Заметки */}
              {selectedDeal.notes && (
                <div className="rounded-xl bg-slate-50 p-3 md:p-4">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 md:text-xs">Заметки</p>
                  <p className="text-xs text-slate-700 md:text-sm">{selectedDeal.notes}</p>
                </div>
              )}
            </div>

            {/* Действия */}
            <div className="mt-4 flex gap-2 md:mt-5 md:gap-3">
              <button
                onClick={() => {
                  setDeleteConfirm(selectedDeal.id);
                  setSelectedDeal(null);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2.5 text-xs font-semibold text-red-600 transition active:scale-95 hover:bg-red-50 md:px-4 md:text-sm"
              >
                🗑️ Удалить
              </button>
              <button
                onClick={() => setSelectedDeal(null)}
                className="ml-auto rounded-xl bg-slate-100 px-5 py-2.5 text-xs font-semibold text-slate-600 transition active:scale-95 hover:bg-slate-200 md:px-6 md:text-sm"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="w-full max-w-sm animate-fade-in-up rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <p className="text-4xl">⚠️</p>
              <h3 className="mt-3 text-lg font-bold text-slate-900">Удалить сделку?</h3>
              <p className="mt-1 text-sm text-slate-500">
                Это действие нельзя отменить.
              </p>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-600 transition active:scale-95 hover:bg-slate-200"
              >
                Отмена
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white shadow-md shadow-red-200 transition active:scale-95 hover:bg-red-600"
              >
                🗑️ Да, удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
