"use client";

import { useState, useEffect } from "react";
import VoiceInput from "@/components/VoiceInput";
import { formatRub, formatDateRu } from "@/lib/parser";
import { useIrkutskTime } from "@/lib/time";
import DashboardClient from "./DashboardClient";

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

type DashboardData = {
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

export default function HomePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const timeInfo = useIrkutskTime();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch("/api/dashboard");
        if (!res.ok) throw new Error("Ошибка загрузки");
        const json = await res.json();
        setData(json);
      } catch (e) {
        console.error("Dashboard error:", e);
        setError("Не удалось загрузить данные. Попробуйте обновить страницу.");
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-5 md:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-slate-900 md:text-2xl">
            {timeInfo.greeting}! {timeInfo.emoji}
          </h1>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 md:text-sm">
            <span>
              {new Date().toLocaleDateString("ru-RU", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </span>
            <span className="h-3 w-px bg-slate-200" />
            <span className="font-medium text-indigo-500">{timeInfo.timeStr} (Ирк)</span>
          </div>
        </div>

        {/* Voice input */}
        <div className="animate-fade-in-up rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 p-4 shadow-xl md:p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-lg">🎙️</span>
            <h2 className="text-sm font-semibold text-white">
              Голосовое управление
            </h2>
          </div>
          <VoiceInput
            onResult={async (text) => {
              try {
                const parsedRes = await fetch("/api/parse", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ text }),
                });
                const parsed = await parsedRes.json();
                if (parsed.type === "tasks") {
                  await fetch("/api/tasks", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text }),
                  });
                } else if (parsed.type === "deals") {
                  await fetch("/api/deals", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text }),
                  });
                }
                window.location.reload();
              } catch {
                // игнорируем
              }
            }}
            placeholder='Например: "Завтра в 9 утра замер на Ленина 15" или "Продал кондиционер за 40 тысяч"'
          />
        </div>

        {/* Error message */}
        <div className="animate-fade-in-up rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
          <p className="text-3xl mb-2">⚠️</p>
          <p className="text-sm font-medium text-amber-800">
            Не удалось загрузить данные
          </p>
          <p className="mt-1 text-xs text-amber-600">
            Нажмите «Обновить» или откройте{" "}
            <a 
              href="/api/init" 
              target="_blank"
              className="font-semibold text-amber-700 underline hover:text-amber-800"
            >
              /api/init
            </a>
            {" "}один раз для обновления базы данных, затем вернитесь и обновите страницу.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 rounded-xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition active:scale-95"
          >
            🔄 Обновить
          </button>
        </div>
      </div>
    );
  }

  return <DashboardClient {...data} />;
}
