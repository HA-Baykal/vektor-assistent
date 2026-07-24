"use client";

import { useState, useEffect, useCallback } from "react";
import VoiceInput from "@/components/VoiceInput";
import { formatRub, formatDateRu, formatDateFull, parseAddition } from "@/lib/parser";

type ActivityEntry = {
  action: string;
  timestamp: string;
  details: string;
  delta?: {
    saleAmount?: number;
    purchaseAmount?: number;
    workAmount?: number;
    materialsAmount?: number;
  };
};

type Deal = {
  id: number;
  dealNumber: number;
  date: string;
  category: string;
  saleAmount: number;
  purchaseAmount: number;
  workAmount: number;
  materialsAmount: number;
  equipmentMargin: number;
  workMargin: number;
  totalMargin: number;
  paymentType: string;
  taxAmount: number;
  totalWithTax: number;
  notes: string | null;
  activityLog: string;
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
  const [editMode, setEditMode] = useState(false);
  const [logExpanded, setLogExpanded] = useState(false);
  const [logVisibleCount, setLogVisibleCount] = useState(3);
  const [editForm, setEditForm] = useState({
    saleAmount: "",
    purchaseAmount: "",
    workAmount: "",
    materialsAmount: "",
    paymentType: "cash",
    notes: "",
  });

  // Когда открываем сделку, сбрасываем editMode и заполняем форму
  const openDeal = (deal: Deal) => {
    setSelectedDeal(deal);
    setEditMode(false);
    setEditForm({
      saleAmount: String(deal.saleAmount),
      purchaseAmount: String(deal.purchaseAmount),
      workAmount: String(deal.workAmount),
      materialsAmount: String(deal.materialsAmount),
      paymentType: deal.paymentType || "cash",
      notes: deal.notes || "",
    });
  };

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: "Кондиционер",
    saleAmount: "",
    purchaseAmount: "",
    workAmount: "",
    materialsAmount: "",
    paymentType: "cash",
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
      // Шаг 1: Проверяем, не "добавка" ли это к существующей сделке
      const addition = parseAddition(text);
      if (addition) {
        if (!addition.dealNumber) return; // Без номера — не добавка

        const targetDeal = deals.find(d => d.dealNumber === addition.dealNumber);
        if (!targetDeal) {
          showMessage(`❌ Сделка №${addition.dealNumber} не найдена. Проверьте номер.`, "error");
          return;
        }

        const labels: string[] = [];
        const emoji = addition.additionType === "income" ? "💰" : "💸";
        const typeLabel = addition.additionType === "income" ? "доход" : "расход";
        if (addition.addSaleAmount > 0) labels.push(`${formatRub(addition.addSaleAmount)} к продаже (${typeLabel})`);
        if (addition.addWorkAmount > 0) labels.push(`${formatRub(addition.addWorkAmount)} за работы (${typeLabel})`);
        if (addition.addMaterialsAmount > 0) labels.push(`${formatRub(addition.addMaterialsAmount)} на расходку (${typeLabel})`);
        if (addition.addPurchaseAmount > 0) labels.push(`${formatRub(addition.addPurchaseAmount)} на закупку (${typeLabel})`);

        const res = await fetch("/api/deals", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: targetDeal.id,
            addSaleAmount: addition.addSaleAmount,
            addWorkAmount: addition.addWorkAmount,
            addMaterialsAmount: addition.addMaterialsAmount,
            addPurchaseAmount: addition.addPurchaseAmount,
          }),
        });

        if (!res.ok) throw new Error("Ошибка");
        const updated = await res.json();

        showMessage(
          `${emoji} Сделка №${updated.dealNumber} «${updated.category}»:\n${labels.join("\n")}\n💰 Новая маржа: ${formatRub(updated.totalMargin)}`
        );
        fetchDeals();
        return;
      }

      // Шаг 2: Если не добавка — создаём новую сделку как обычно
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
      paymentType: form.paymentType,
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
      paymentType: "cash",
      notes: "",
    });
    setShowForm(false);
    showMessage("✅ Сделка создана");
    fetchDeals();
  };

  const handleSaveEdit = async () => {
    if (!selectedDeal) return;
    try {
      const body: Record<string, any> = {
        id: selectedDeal.id,
        saleAmount: parseInt(editForm.saleAmount) || 0,
        purchaseAmount: parseInt(editForm.purchaseAmount) || 0,
        workAmount: parseInt(editForm.workAmount) || 0,
        materialsAmount: parseInt(editForm.materialsAmount) || 0,
        paymentType: editForm.paymentType || "cash",
        notes: editForm.notes || null,
      };

      const res = await fetch("/api/deals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Ошибка");

      const updated = await res.json();
      setSelectedDeal(updated);
      setEditMode(false);
      showMessage("✅ Сделка обновлена, маржа пересчитана");
      fetchDeals();
    } catch {
      showMessage("❌ Ошибка при сохранении", "error");
    }
  };

  const handleAddToDeal = async (field: string, label: string, emoji: string) => {
    if (!selectedDeal) return;
    const extra = prompt(`${emoji} Сколько ${label}? (₽)`);
    if (!extra) return;
    const amount = parseInt(extra);
    if (!amount || amount <= 0) {
      showMessage("❌ Введите корректную сумму", "error");
      return;
    }

    try {
      const res = await fetch("/api/deals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedDeal.id, [field]: amount }),
      });

      if (!res.ok) throw new Error("Ошибка");

      const updated = await res.json();
      setSelectedDeal(updated);
      showMessage(`✅ ${emoji} Добавлено ${formatRub(amount)}. Маржа пересчитана`);
      fetchDeals();
    } catch {
      showMessage("❌ Ошибка при обновлении", "error");
    }
  };

  const handleAddExpense = async (field: "addMaterialsAmount" | "addPurchaseAmount" | "addWorkAmount") => {
    if (!selectedDeal) return;
    const label = field === "addMaterialsAmount" ? "расходные материалы" : field === "addPurchaseAmount" ? "закупку" : "монтаж";
    const extra = prompt(`Сколько ещё потратили на ${label}? (₽)`);
    if (!extra) return;
    const amount = parseInt(extra);
    if (!amount || amount <= 0) {
      showMessage("❌ Введите корректную сумму", "error");
      return;
    }

    try {
      const res = await fetch("/api/deals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedDeal.id, [field]: amount }),
      });

      if (!res.ok) throw new Error("Ошибка");

      const updated = await res.json();
      setSelectedDeal(updated);
      showMessage(`✅ Добавлено ${formatRub(amount)} к ${label}. Маржа пересчитана`);
      fetchDeals();
    } catch {
      showMessage("❌ Ошибка при обновлении", "error");
    }
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
          placeholder='Например: "Продал кондиционер..." или "Номер 10 потратил ещё 2500" или "Заработал ещё 5000 сделка 34"'
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

            {/* Способ оплаты */}
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-400">Способ оплаты</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, paymentType: "cash" })}
                  className={`flex-1 rounded-xl py-2.5 text-xs font-semibold transition active:scale-95 ${
                    form.paymentType === "cash"
                      ? "bg-emerald-500 text-white shadow-md"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  💵 Наличные
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, paymentType: "invoice" })}
                  className={`flex-1 rounded-xl py-2.5 text-xs font-semibold transition active:scale-95 ${
                    form.paymentType === "invoice"
                      ? "bg-indigo-500 text-white shadow-md"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  📄 По счёту (−6%)
                </button>
              </div>
              {form.paymentType === "invoice" && (
                <div className="mt-1.5 rounded-lg bg-indigo-50 px-3 py-1.5">
                  <p className="text-[10px] text-indigo-600">
                    🛈 С общей суммы дохода будет удержан налог 6%
                  </p>
                </div>
              )}
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

            {/* Предпросмотр маржи с учётом налога */}
            {(() => {
              const s = parseInt(form.saleAmount) || 0;
              const p = parseInt(form.purchaseAmount) || 0;
              const w = parseInt(form.workAmount) || 0;
              const m = parseInt(form.materialsAmount) || 0;
              const tax = form.paymentType === "invoice" ? Math.round((s + w) * 0.06) : 0;
              const margin = s - p + w - m - tax;
              return (
                <div className={`rounded-xl p-3 md:p-4 ${
                  margin >= 0 ? "bg-emerald-50" : "bg-red-50"
                }`}>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700 md:text-sm">Предварительная маржа:</span>
                      <span className={`text-base font-bold md:text-lg ${
                        margin >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}>
                        {formatRub(margin)}
                      </span>
                    </div>
                    {tax > 0 && (
                      <div className="flex items-center justify-between text-[10px] text-amber-600">
                        <span>🗂 Налог 6%</span>
                        <span>−{formatRub(tax)}</span>
                      </div>
                    )}
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
              onClick={() => openDeal(deal)}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <span className="text-sm md:text-lg">{CATEGORY_ICONS[deal.category] || "📦"}</span>
                    <span className="rounded-lg bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white md:text-xs">
                      №{deal.dealNumber}
                    </span>
                    <span className="rounded-lg bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 md:text-xs">
                      {deal.category}
                    </span>
                    <span className="text-[11px] text-slate-400 md:text-xs">{formatDateRu(deal.date)}</span>
                    {deal.paymentType === "invoice" && (
                      <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">📄 −6%</span>
                    )}
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
                    {deal.paymentType === "invoice" && deal.taxAmount > 0 && (
                      <p className="text-[9px] text-amber-600">−{formatRub(deal.taxAmount)} налог</p>
                    )}
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
          onClick={() => { setSelectedDeal(null); setEditMode(false); }}
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
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white md:text-xs">№{selectedDeal.dealNumber}</span>
                    <h2 className="text-base font-bold text-slate-900 md:text-lg">{selectedDeal.category}</h2>
                  </div>
                  <p className="text-[11px] text-slate-400 md:text-xs">
                    {formatDateFull(selectedDeal.date)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setSelectedDeal(null); setEditMode(false); }}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400 transition hover:bg-slate-200 hover:text-slate-600 md:h-8 md:w-8"
              >
                ✕
              </button>
            </div>

            {editMode ? (
              /* ===== РЕЖИМ РЕДАКТИРОВАНИЯ ===== */
              <div className="space-y-3 md:space-y-4">
                <div className="rounded-xl bg-emerald-50 p-3 md:p-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 md:text-xs">Доходы</p>
                  <div className="space-y-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-500">Продажа оборудования (₽)</label>
                      <input
                        type="number"
                        value={editForm.saleAmount}
                        onChange={(e) => setEditForm({ ...editForm, saleAmount: e.target.value })}
                        className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-500">Монтаж и работы (₽)</label>
                      <input
                        type="number"
                        value={editForm.workAmount}
                        onChange={(e) => setEditForm({ ...editForm, workAmount: e.target.value })}
                        className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-red-50 p-3 md:p-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-red-600 md:text-xs">Расходы</p>
                  <div className="space-y-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-500">Закупка оборудования (₽)</label>
                      <input
                        type="number"
                        value={editForm.purchaseAmount}
                        onChange={(e) => setEditForm({ ...editForm, purchaseAmount: e.target.value })}
                        className="w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-500">Материалы и расходка (₽)</label>
                      <input
                        type="number"
                        value={editForm.materialsAmount}
                        onChange={(e) => setEditForm({ ...editForm, materialsAmount: e.target.value })}
                        className="w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Заметки</label>
                  <input
                    type="text"
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                {/* Способ оплаты в режиме редактирования */}
                <div className="rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 p-3 md:p-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 md:text-xs">💳 Способ оплаты</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditForm({ ...editForm, paymentType: "cash" });
                        // Сохраняем сразу
                        fetch("/api/deals", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: selectedDeal.id, paymentType: "cash" }),
                        }).then(r => r.json()).then(updated => {
                          setSelectedDeal(updated);
                          fetchDeals();
                        });
                      }}
                      className={`flex-1 rounded-xl py-2 text-xs font-semibold transition active:scale-95 ${
                        selectedDeal.paymentType === "cash" && editForm.paymentType !== "invoice"
                          ? "bg-emerald-500 text-white shadow-md"
                          : "bg-white text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      💵 Наличные
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditForm({ ...editForm, paymentType: "invoice" });
                        fetch("/api/deals", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: selectedDeal.id, paymentType: "invoice" }),
                        }).then(r => r.json()).then(updated => {
                          setSelectedDeal(updated);
                          fetchDeals();
                        });
                      }}
                      className={`flex-1 rounded-xl py-2 text-xs font-semibold transition active:scale-95 ${
                        selectedDeal.paymentType === "invoice" || editForm.paymentType === "invoice"
                          ? "bg-indigo-500 text-white shadow-md"
                          : "bg-white text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      📄 По счёту (−6%)
                    </button>
                  </div>
                </div>

                {/* Предпросмотр маржи */}
                {(() => {
                  const s = parseInt(editForm.saleAmount) || 0;
                  const p = parseInt(editForm.purchaseAmount) || 0;
                  const w = parseInt(editForm.workAmount) || 0;
                  const m = parseInt(editForm.materialsAmount) || 0;
                  const margin = s - p + w - m;
                  return (
                    <div className={`rounded-xl p-3 ${
                      margin >= 0 ? "bg-slate-900 text-white" : "bg-red-600 text-white"
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold opacity-80">Предварительная маржа:</span>
                        <span className="text-lg font-black">{margin >= 0 ? "+" : ""}{formatRub(margin)}</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex gap-2 md:gap-3">
                  <button
                    onClick={handleSaveEdit}
                    className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-200 transition active:scale-95 hover:bg-emerald-600"
                  >
                    💾 Сохранить
                  </button>
                  <button
                    onClick={() => setEditMode(false)}
                    className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-medium text-slate-600 transition active:scale-95 hover:bg-slate-200"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              /* ===== РЕЖИМ ПРОСМОТРА ===== */
              <>
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

                  {/* Кнопки быстрого добавления */}
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 md:p-4">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 md:text-xs">
                      ⚡ Быстрое добавление
                    </p>
                    <div className="space-y-2">
                      <p className="text-[9px] font-medium text-emerald-600 md:text-[10px]">💰 ДОХОД (увеличивает маржу)</p>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => handleAddToDeal("addSaleAmount", "добавили к продаже", "💰")}
                          className="rounded-lg bg-emerald-100 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 transition active:scale-95 hover:bg-emerald-200"
                        >
                          + Продажа
                        </button>
                        <button
                          onClick={() => handleAddToDeal("addWorkAmount", "добавили за работу", "💰")}
                          className="rounded-lg bg-emerald-100 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 transition active:scale-95 hover:bg-emerald-200"
                        >
                          + Работа/монтаж
                        </button>
                      </div>
                      <p className="text-[9px] font-medium text-red-600 md:text-[10px]">💸 РАСХОД (уменьшает маржу)</p>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => handleAddExpense("addMaterialsAmount")}
                          className="rounded-lg bg-amber-100 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700 transition active:scale-95 hover:bg-amber-200"
                        >
                          + Расходные материалы
                        </button>
                        <button
                          onClick={() => handleAddExpense("addPurchaseAmount")}
                          className="rounded-lg bg-red-100 px-2.5 py-1.5 text-[11px] font-semibold text-red-700 transition active:scale-95 hover:bg-red-200"
                        >
                          + Закупка
                        </button>
                        <button
                          onClick={() => handleAddExpense("addWorkAmount")}
                          className="rounded-lg bg-blue-100 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 transition active:scale-95 hover:bg-blue-200"
                        >
                          + Монтаж (расход)
                        </button>
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

                  {/* Способ оплаты */}
                  <div className="rounded-xl bg-gradient-to-r from-slate-50 to-slate-100 p-3 md:p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{selectedDeal.paymentType === "invoice" ? "📄" : "💵"}</span>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 md:text-xs">
                            {selectedDeal.paymentType === "invoice" ? "По счёту" : "Наличные"}
                          </p>
                          {selectedDeal.paymentType === "invoice" && (
                            <p className="text-[9px] text-amber-600">Налог 6%: −{formatRub(selectedDeal.taxAmount)}</p>
                          )}
                        </div>
                      </div>
                      {selectedDeal.paymentType === "invoice" && (
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400">К получению</p>
                          <p className="text-xs font-bold text-indigo-600">{formatRub(selectedDeal.totalWithTax)}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Заметки */}
                  {selectedDeal.notes && (
                    <div className="rounded-xl bg-slate-50 p-3 md:p-4">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 md:text-xs">Заметки</p>
                      <p className="text-xs text-slate-700 md:text-sm">{selectedDeal.notes}</p>
                    </div>
                  )}

                  {/* 📋 Лог действий (сворачиваемый) */}
                  {(() => {
                    try {
                      const log: ActivityEntry[] = JSON.parse(selectedDeal.activityLog || "[]");
                      if (log.length === 0) return null;
                      const lastEntry = log[log.length - 1];
                      const firstEntry = log[0];
                      return (
                        <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
                          {/* Заголовок-переключатель */}
                          <button
                            onClick={() => setLogExpanded(!logExpanded)}
                            className="flex w-full items-center justify-between p-3 text-left transition hover:bg-slate-50 md:p-4"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm">📋</span>
                              <div>
                                <p className="text-[11px] font-semibold text-slate-700 md:text-xs">История сделки</p>
                                <p className="text-[9px] text-slate-400 md:text-[10px]">
                                  {log.length} {log.length === 1 ? "запись" : log.length < 5 ? "записи" : "записей"} · Последняя: {lastEntry.timestamp?.slice(11, 16) || ""}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-semibold text-indigo-600 md:text-[10px]">
                                {log.length}
                              </span>
                              <svg
                                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                                className={`text-slate-400 transition-transform ${logExpanded ? "rotate-180" : ""}`}
                              >
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </div>
                          </button>

                          {/* Раскрывающийся лог */}
                          {logExpanded && (
                            <div className="border-t border-slate-100 pt-2">
                              {/* Прокручиваемый контейнер */}
                              <div className="max-h-64 space-y-0 overflow-y-auto overscroll-contain px-3 pb-1 md:px-4">
                                {log.map((entry, idx) => {
                                  // Показываем только последние logVisibleCount записей
                                  if (idx < log.length - logVisibleCount) return null;

                                  let newIcon = "📝";
                                  let dotColor = "bg-slate-300";
                                  if (entry.action.includes("Сделка создана")) { newIcon = "🆕"; dotColor = "bg-indigo-500"; }
                                  else if (entry.action.includes("Маржа")) { newIcon = "📊"; dotColor = "bg-emerald-500"; }
                                  else if (entry.action.includes("➕") || entry.action.includes("Добавлено")) {
                                    if (entry.action.includes("продаж") || entry.action.includes("доход") || entry.action.includes("продаж")) { newIcon = "💰"; dotColor = "bg-emerald-500"; }
                                    else { newIcon = "💸"; dotColor = "bg-red-400"; }
                                  }
                                  else if (entry.action.includes("изменен")) { newIcon = "✏️"; dotColor = "bg-amber-400"; }

                                  return (
                                    <div key={idx} className="flex gap-2.5">
                                      <div className="flex flex-col items-center pt-0.5">
                                        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${dotColor}`}>
                                          <span className="text-[8px]">{newIcon !== "📝" ? newIcon : "•"}</span>
                                        </div>
                                        {idx < log.length - 1 && <div className="mt-0.5 h-full w-px bg-slate-100" />}
                                      </div>
                                      <div className={`flex-1 pb-2.5 ${idx === log.length - 1 ? "" : ""}`}>
                                        <div className="flex items-center justify-between">
                                          <p className="text-[11px] font-semibold text-slate-700">{entry.action}</p>
                                          <span className="text-[9px] shrink-0 ml-2 text-slate-400">{entry.timestamp?.slice(11, 16) || ""}</span>
                                        </div>
                                        <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">{entry.details}</p>
                                        {entry.delta && Object.values(entry.delta).some(v => v && v !== 0) && (
                                          <div className="mt-1 flex flex-wrap gap-1">
                                            {entry.delta.saleAmount ? <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-600">Продажа: +{formatRub(entry.delta.saleAmount)}</span> : null}
                                            {entry.delta.workAmount ? <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-600">Работа: +{formatRub(entry.delta.workAmount)}</span> : null}
                                            {entry.delta.materialsAmount ? <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[9px] font-medium text-red-600">Расход: +{formatRub(entry.delta.materialsAmount)}</span> : null}
                                            {entry.delta.purchaseAmount ? <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[9px] font-medium text-red-600">Закупка: +{formatRub(entry.delta.purchaseAmount)}</span> : null}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              
                              {/* Кнопка "показать ещё" */}
                              {log.length > logVisibleCount && (
                                <div className="px-3 pb-1 md:px-4">
                                  <button
                                    onClick={() => setLogVisibleCount(prev => Math.min(prev + 3, log.length))}
                                    className="flex w-full items-center justify-center gap-1 rounded-lg bg-slate-50 py-1.5 text-[10px] font-medium text-indigo-600 transition hover:bg-indigo-50 active:scale-[0.99]"
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                      <polyline points="6 15 12 9 18 15" />
                                    </svg>
                                    Показать ещё ({log.length - logVisibleCount})
                                  </button>
                                </div>
                              )}

                              {/* Итоговая строка */}
                              <div className="mx-3 mb-2 mt-1 flex items-center justify-between rounded-lg bg-slate-900 px-3 py-2 md:mx-4">
                                <span className="text-[10px] font-medium text-white/80">💰 Итоговая маржа:</span>
                                <span className={`text-[11px] font-bold ${selectedDeal.totalMargin >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                  {selectedDeal.totalMargin >= 0 ? "+" : ""}{formatRub(selectedDeal.totalMargin)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    } catch {
                      return null;
                    }
                  })()}
                </div>

                {/* Действия */}
                <div className="mt-4 flex flex-wrap gap-2 md:mt-5 md:gap-3">
                  <button
                    onClick={() => {
                      setEditForm({
                        saleAmount: String(selectedDeal.saleAmount),
                        purchaseAmount: String(selectedDeal.purchaseAmount),
                        workAmount: String(selectedDeal.workAmount),
                        materialsAmount: String(selectedDeal.materialsAmount),
                        paymentType: selectedDeal.paymentType || "cash",
                        notes: selectedDeal.notes || "",
                      });
                      setEditMode(true);
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-indigo-200 transition active:scale-95 hover:bg-indigo-700 md:text-sm"
                  >
                    ✏️ Редактировать
                  </button>
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
                    onClick={() => { setSelectedDeal(null); setEditMode(false); }}
                    className="ml-auto rounded-xl bg-slate-100 px-5 py-2.5 text-xs font-semibold text-slate-600 transition active:scale-95 hover:bg-slate-200 md:px-6 md:text-sm"
                  >
                    Закрыть
                  </button>
                </div>
              </>
            )}
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
