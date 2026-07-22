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
  const [showForm, setShowForm] = useState(false);
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
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (data.tasks) {
      setMessage(
        `✅ Записал ${data.tasks.length} задач(и):\n${data.tasks
          .map(
            (t: Task) =>
              `${t.time || "—"} — ${t.text} (${formatDateRu(t.date)})`
          )
          .join("\n")}`
      );
    } else {
      setMessage("Не удалось распознать задачи.");
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

  const deleteTask = async (id: number) => {
    await fetch(`/api/tasks?id=${id}`, { method: "DELETE" });
    fetchTasks();
  };

  // Группировка по датам
  const grouped: Record<string, Task[]> = {};
  for (const task of tasks) {
    if (!grouped[task.date]) grouped[task.date] = [];
    grouped[task.date].push(task);
  }
  const sortedDates = Object.keys(grouped).sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Задачи</h1>
          <p className="text-sm text-slate-500">
            Всего: {tasks.length} · Активных:{" "}
            {tasks.filter((t) => t.status === "active").length}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700"
        >
          + Добавить
        </button>
      </div>

      {/* Voice input */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 p-5 shadow-xl">
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
          <div className="mt-3 whitespace-pre-line rounded-xl bg-white/15 p-3 text-sm text-white">
            {message}
          </div>
        )}
      </div>

      {/* Manual form */}
      {showForm && (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">
            Новая задача
          </h3>
          <div className="space-y-3">
            <input
              type="text"
              value={formText}
              onChange={(e) => setFormText(e.target.value)}
              placeholder="Текст задачи..."
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <div className="flex gap-3">
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400"
              />
              <input
                type="time"
                value={formTime}
                onChange={(e) => setFormTime(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400"
              />
            </div>
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

      {/* Task list */}
      {loading ? (
        <p className="py-8 text-center text-sm text-slate-400">Загрузка...</p>
      ) : (
        <div className="space-y-6">
          {sortedDates.length === 0 && (
            <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
              <p className="text-4xl">📋</p>
              <p className="mt-3 text-sm text-slate-400">
                Задач пока нет. Добавьте голосовым сообщением!
              </p>
            </div>
          )}
          {sortedDates.map((date) => (
            <div key={date} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  {formatDateRu(date)}
                </h3>
                <span className="text-xs text-slate-400">
                  {formatWeekdayRu(date)}
                </span>
                <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                  {grouped[date].length}
                </span>
              </div>
              <div className="space-y-2">
                {grouped[date]
                  .sort((a, b) => (a.time || "").localeCompare(b.time || ""))
                  .map((task) => (
                    <div
                      key={task.id}
                      className={`group flex items-center gap-3 rounded-xl border p-3 transition ${
                        task.status === "done"
                          ? "border-slate-100 bg-slate-50"
                          : "border-slate-200 bg-white hover:border-indigo-200"
                      }`}
                    >
                      <button
                        onClick={() => toggleTask(task.id, task.status)}
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
                          task.status === "done"
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-slate-300 hover:border-indigo-400"
                        }`}
                      >
                        {task.status === "done" && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                      <div className="flex-1">
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
                        <span className="shrink-0 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-600">
                          {task.time}
                        </span>
                      )}
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="shrink-0 text-slate-300 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
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
    </div>
  );
}
