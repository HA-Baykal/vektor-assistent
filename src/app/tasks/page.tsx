"use client";

import { useState, useEffect } from "react";
import VoiceInput from "@/components/VoiceInput";
import { formatDateRu, formatWeekdayRu } from "@/lib/parser";

type Task = {
  id: number;
  date: string;
  time: string | null;
  text: string;
  status: string;
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [formDate, setFormDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [formTime, setFormTime] = useState("");
  const [formText, setFormText] = useState("");

  const fetchTasks = async () => {
    const res = await fetch("/api/tasks");
    const data = await res.json();
    setTasks(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleVoiceResult = async (text: string) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.tasks) {
        setMessage(
          `✅ Записал ${data.tasks.length} задач(и)\n${data.tasks
            .map(
              (t: Task) =>
                `${t.time || "—"} — ${t.text} (${formatDateRu(t.date)})`
            )
            .join("\n")}`
        );
        setMessageType("success");
      } else {
        setMessage("Не удалось распознать задачи.");
        setMessageType("error");
      }
    } catch {
      setMessage("Ошибка при обработке");
      setMessageType("error");
    }
    fetchTasks();
    setTimeout(() => setMessage(""), 6000);
  };

  const handleCreate = async () => {
    if (!formText.trim()) return;
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: formText,
        date: formDate,
        time: formTime || null,
      }),
    });
    setFormText("");
    setFormTime("");
    setShowForm(false);
    fetchTasks();
  };

  const toggleTask = async (id: number, status: string) => {
    const newStatus = status === "active" ? "done" : "active";
    await fetch(`/api/tasks?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: newStatus }),
    });
    fetchTasks();
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const idToDelete = deleteConfirm;
    setDeleteConfirm(null);
    await fetch(`/api/tasks?id=${idToDelete}`, { method: "DELETE" });
    fetchTasks();
  };

  // Группировка по датам
  const grouped: Record<string, Task[]> = {};
  for (const task of tasks) {
    if (!grouped[task.date]) grouped[task.date] = [];
    grouped[task.date].push(task);
  }
  const sortedDates = Object.keys(grouped).sort();

  const activeCount = tasks.filter((t) => t.status === "active").length;

  return (
    <div className="space-y-5 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 md:text-2xl">
            ✅ Задачи
          </h1>
          <p className="text-xs text-slate-500 md:text-sm">
            Всего: {tasks.length} · Активных: {activeCount}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition active:scale-95 hover:bg-indigo-700"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {showForm ? "Закрыть" : "Добавить"}
        </button>
      </div>

      {/* Voice input */}
      <div className="animate-fade-in-up rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 p-4 shadow-xl md:p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-lg">🎙️</span>
          <h2 className="text-sm font-semibold text-white">
            Голосовой ввод задач
          </h2>
        </div>
        <VoiceInput
          onResult={handleVoiceResult}
          placeholder='Скажите: "Завтра в 9 утра замер на Ленина 15, потом к 12 доставка окон"'
        />
        {message && (
          <div className={`mt-3 whitespace-pre-line rounded-xl p-3 text-xs leading-relaxed md:text-sm ${
            messageType === "success" 
              ? "bg-white/15 text-white" 
              : "bg-red-500/20 text-red-100"
          }`}>
            {message}
          </div>
        )}
      </div>

      {/* Manual form */}
      {showForm && (
        <div className="animate-fade-in-up rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">
            📝 Новая задача
          </h3>
          <div className="space-y-3">
            <textarea
              value={formText}
              onChange={(e) => setFormText(e.target.value)}
              placeholder="Текст задачи..."
              rows={2}
              className="w-full resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-[11px] font-medium text-slate-400">Дата</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-[11px] font-medium text-slate-400">Время</label>
                <input
                  type="time"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400"
                />
              </div>
            </div>
            <div className="flex gap-2">
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

      {/* Task list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
        </div>
      ) : (
        <div className="space-y-4 md:space-y-6">
          {sortedDates.length === 0 && (
            <div className="animate-fade-in-up rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
              <p className="text-4xl">📋</p>
              <p className="mt-3 text-sm text-slate-400">
                Задач пока нет
              </p>
              <p className="mt-1 text-xs text-slate-300">
                Добавьте голосовым сообщением или через кнопку «Добавить»
              </p>
            </div>
          )}
          {sortedDates.map((date) => (
            <div key={date} className="animate-fade-in-up rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:p-5">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  {formatDateRu(date)}
                </h3>
                <span className="text-xs text-slate-400">
                  {formatWeekdayRu(date)}
                </span>
                <span className="ml-auto rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-600">
                  {grouped[date].filter(t => t.status === "active").length} активных
                </span>
              </div>
              <div className="space-y-2">
                {grouped[date]
                  .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"))
                  .map((task) => (
                    <div
                      key={task.id}
                      className={`flex items-center gap-3 rounded-xl border p-3 transition active:scale-[0.98] ${
                        task.status === "done"
                          ? "border-slate-100 bg-slate-50"
                          : "border-slate-200 bg-white hover:border-indigo-200"
                      }`}
                    >
                      <button
                        onClick={() => toggleTask(task.id, task.status)}
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition active:scale-90 ${
                          task.status === "done"
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-slate-300 hover:border-indigo-400"
                        }`}
                      >
                        {task.status === "done" && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm ${
                            task.status === "done"
                              ? "text-slate-400 line-through"
                              : "text-slate-800"
                          }`}
                        >
                          {task.text}
                        </p>
                      </div>
                      {task.time && (
                        <span className="shrink-0 rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-600">
                          {task.time}
                        </span>
                      )}
                      <button
                        onClick={() => setDeleteConfirm(task.id)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 transition active:scale-90 hover:bg-red-50 hover:text-red-500"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          ))}
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
              <h3 className="mt-3 text-lg font-bold text-slate-900">
                Удалить задачу?
              </h3>
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
