"use client";

import { useState, useEffect } from "react";
import VoiceInput from "@/components/VoiceInput";
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

const CATEGORIES = ["Кондиционер", "Окна", "Вентиляция", "Бурение", "Объект"];

export default function FinancePage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("all");

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: "Кондиционер",
    saleAmount: "",
    purchaseAmount: "",
    workAmount: "",
    materialsAmount: "",
    notes: "",
  });

  const fetchDeals = async () => {
    const res = await fetch("/api/deals");
    const data = await res.json();
    setDeals(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchDeals();
  }, []);

  const handleVoiceResult = async (text: string) => {
    const res = await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (data.deals) {
      const total = data.deals.reduce(
        (s: number, d: Deal) => s + d.totalMargin,
        0
      );
      setMessage(
        `✅ Записал ${data.deals.length} сделок(и)\n💰 Итого маржа: ${formatRub(
          total
        )}`
      );
    } else {
      setMessage("Не удалось распознать сделку.");
    }
    fetchDeals();
    setTimeout(() => setMessage(""), 6000);
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
    fetchDeals();
  };

  const deleteDeal = async (id: number) => {
    await fetch(`/api/deals?id=${id}`, { method: "DELETE" });
    fetchDeals();
  };

  const filtered =
    filter === "all" ? deals : deals.filter((d) => d.category === filter);

  const totalMargin = filtered.reduce((s, d) => s + d.totalMargin, 0);
  const totalRevenue = filtered.reduce((s, d) => s + d.saleAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Финансы</h1>
          <p className="text-sm text-slate-500">
            Всего сделок: {deals.length}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700"
        >
          + Сделка
        </button>
      </div>

      {/* Voice input */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 p-5 shadow-xl">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-lg">🎙️</span>
          <h2 className="text-sm font-semibold text-white">
            Голосовой ввод сделки
          </h2>
        </div>
        <VoiceInput
          onResult={handleVoiceResult}
          placeholder='Скажите: "Продал кондиционер за 30 тысяч, купил за 17700, монтаж 5000, материалы 800"'
        />
        {message && (
          <div className="mt-3 whitespace-pre-line rounded-xl bg-white/15 p-3 text-sm text-white">
            {message}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Маржа (фильтр)</p>
          <p className="mt-1 text-xl font-bold text-emerald-600">
            {formatRub(totalMargin)}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Выручка (фильтр)</p>
          <p className="mt-1 text-xl font-bold text-blue-600">
            {formatRub(totalRevenue)}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-500">Сделок (фильтр)</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {filtered.length}
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
            filter === "all"
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-600 hover:bg-slate-100"
          }`}
        >
          Все
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
              filter === cat
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Manual form */}
      {showForm && (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">
            Новая сделка
          </h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
              />
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                value={form.saleAmount}
                onChange={(e) =>
                  setForm({ ...form, saleAmount: e.target.value })
                }
                placeholder="Продажа (₽)"
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
              />
              <input
                type="number"
                value={form.purchaseAmount}
                onChange={(e) =>
                  setForm({ ...form, purchaseAmount: e.target.value })
                }
                placeholder="Закупка (₽)"
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
              />
              <input
                type="number"
                value={form.workAmount}
                onChange={(e) => setForm({ ...form, workAmount: e.target.value })}
                placeholder="Монтаж/работа (₽)"
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
              />
              <input
                type="number"
                value={form.materialsAmount}
                onChange={(e) =>
                  setForm({ ...form, materialsAmount: e.target.value })
                }
                placeholder="Материалы (₽)"
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
              />
            </div>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Заметки..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
              >
                Создать
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deals list */}
      {loading ? (
        <p className="py-8 text-center text-sm text-slate-400">Загрузка...</p>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
              <p className="text-4xl">💰</p>
              <p className="mt-3 text-sm text-slate-400">
                Сделок пока нет. Добавьте голосовым сообщением!
              </p>
            </div>
          )}
          {filtered.map((deal) => (
            <div
              key={deal.id}
              className="group rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
                      {deal.category}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatDateRu(deal.date)}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                    <div>
                      <span className="text-slate-400">Продажа:</span>{" "}
                      <span className="font-medium text-slate-700">
                        {formatRub(deal.saleAmount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Закупка:</span>{" "}
                      <span className="font-medium text-red-500">
                        -{formatRub(deal.purchaseAmount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Монтаж:</span>{" "}
                      <span className="font-medium text-slate-700">
                        {formatRub(deal.workAmount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Материалы:</span>{" "}
                      <span className="font-medium text-red-500">
                        -{formatRub(deal.materialsAmount)}
                      </span>
                    </div>
                  </div>
                  {deal.notes && (
                    <p className="mt-2 text-xs text-slate-400">{deal.notes}</p>
                  )}
                </div>
                <div className="ml-4 text-right">
                  <p className="text-lg font-bold text-emerald-600">
                    {formatRub(deal.totalMargin)}
                  </p>
                  <p className="text-xs text-slate-400">маржа</p>
                  <button
                    onClick={() => deleteDeal(deal.id)}
                    className="mt-1 text-slate-300 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
