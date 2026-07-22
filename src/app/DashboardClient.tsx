"use client";

import { useState } from "react";
import VoiceInput from "@/components/VoiceInput";
import { formatRub, formatDateRu } from "@/lib/parser";

type Task = {
  id: number;
  date: string;
  time: string | null;
  text: string;
  status: string;
};

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

type Props = {
  todayTasks: Task[];
  todayDeals: Deal[];
  weekMargin: number;
  weekRevenue: number;
  todayMargin: number;
  activeTasksCount: number;
  todayStr: string;
  todayLabel: string;
  weekday: string;
};

export default function DashboardClient({
  todayTasks,
  todayDeals,
  weekMargin,
  weekRevenue,
  todayMargin,
  activeTasksCount,
  todayStr,
  todayLabel,
  weekday,
}: Props) {
  const [tasks, setTasks] = useState<Task[]>(todayTasks);
  const [deals, setDeals] = useState<Deal[]>(todayDeals);
  const [message, setMessage] = useState("");

  const handleVoiceResult = async (text: string) => {
    try {
      // Сначала пробуем распарсить на клиенте для быстрого ответа
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const parsed = await res.json();

      if (parsed.type === "tasks") {
        const createRes = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const data = await createRes.json();
        if (data.tasks) {
          setTasks((prev) => [...prev, ...data.tasks]);
          setMessage(
            `✅ Записал ${data.tasks.length} задач(и):\n${data.tasks
              .map(
                (t: Task) =>
                  `${t.time || "—"} — ${t.text}${
                    t.date !== todayStr ? ` (${formatDateRu(t.date)})` : ""
                  }`
              )
              .join("\n")}`
          );
        }
      } else if (parsed.type === "deals") {
        const createRes = await fetch("/api/deals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const data = await createRes.json();
        if (data.deals) {
          setDeals((prev) => [...data.deals, ...prev]);
          const total = data.deals.reduce(
            (s: number, d: Deal) => s + d.totalMargin,
            0
          );
          setMessage(
            `✅ Записал ${data.deals.length} сделок(и)\n💰 Итого маржа: ${formatRub(
              total
            )}`
          );
        }
      } else {
        setMessage("Не удалось распознать. Попробуйте сформулировать иначе.");
      }
    } catch (e) {
      setMessage("Ошибка при обработке. Попробуйте ещё раз.");
    }

    setTimeout(() => setMessage(""), 6000);
  };

  const toggleTask = async (id: number) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const newStatus = task.status === "active" ? "done" : "active";
    await fetch(`/api/tasks?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: newStatus }),
    });
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t))
    );
  };

  const activeTasks = tasks.filter((t) => t.status === "active");
  const doneTasks = tasks.filter((t) => t.status === "done");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Доброе утро! 👋
        </h1>
        <p className="text-sm text-slate-500">
          Сегодня {todayLabel}, {weekday}
        </p>
      </div>

      {/* Voice input */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 p-5 shadow-xl">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-lg">🎙️</span>
          <h2 className="text-sm font-semibold text-white">
            Голосовое управление
          </h2>
        </div>
        <VoiceInput
          onResult={handleVoiceResult}
          placeholder='Скажите: "Завтра в 9 утра замер на Ленина 15" или "Продал кондиционер за 30 тысяч, купил за 17700"'
        />
        {message && (
          <div className="mt-3 whitespace-pre-line rounded-xl bg-white/15 p-3 text-sm text-white">
            {message}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Маржа за неделю"
          value={formatRub(weekMargin)}
          icon="💰"
          color="emerald"
        />
        <StatCard
          label="Выручка за неделю"
          value={formatRub(weekRevenue)}
          icon="📈"
          color="blue"
        />
        <StatCard
          label="Маржа за сегодня"
          value={formatRub(todayMargin)}
          icon="📊"
          color="purple"
        />
        <StatCard
          label="Активных задач"
          value={String(activeTasksCount)}
          icon="✅"
          color="amber"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's tasks */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              📋 Дела на сегодня
            </h2>
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600">
              {activeTasks.length} активных
            </span>
          </div>
          <div className="space-y-2">
            {tasks.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">
                На сегодня дел нет. Добавьте голосовым сообщением!
              </p>
            )}
            {activeTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={toggleTask}
              />
            ))}
            {doneTasks.length > 0 && (
              <>
                <p className="pt-2 text-xs font-medium text-slate-400">
                  Выполнено:
                </p>
                {doneTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={toggleTask}
                  />
                ))}
              </>
            )}
          </div>
        </div>

        {/* Today's deals */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              🏷️ Сделки за сегодня
            </h2>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600">
              {deals.length} шт.
            </span>
          </div>
          <div className="space-y-2">
            {deals.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">
                Сделок за сегодня пока нет.
              </p>
            )}
            {deals.map((deal) => (
              <div
                key={deal.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {deal.category}
                  </p>
                  <p className="text-xs text-slate-500">
                    Продажа: {formatRub(deal.saleAmount)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-600">
                    {formatRub(deal.totalMargin)}
                  </p>
                  <p className="text-xs text-slate-400">маржа</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskItem({
  task,
  onToggle,
}: {
  task: Task;
  onToggle: (id: number) => void;
}) {
  const isDone = task.status === "done";
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 transition ${
        isDone
          ? "border-slate-100 bg-slate-50"
          : "border-slate-200 bg-white hover:border-indigo-200"
      }`}
    >
      <button
        onClick={() => onToggle(task.id)}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
          isDone
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-slate-300 hover:border-indigo-400"
        }`}
      >
        {isDone && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>
      <div className="flex-1">
        <p
          className={`text-sm ${
            isDone ? "text-slate-400 line-through" : "text-slate-800"
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
    </div>
  );
}

const colorMap: Record<string, string> = {
  emerald: "from-emerald-500 to-emerald-600",
  blue: "from-blue-500 to-blue-600",
  purple: "from-purple-500 to-purple-600",
  amber: "from-amber-500 to-amber-600",
};

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div
        className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${colorMap[color]} text-base`}
      >
        {icon}
      </div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}
