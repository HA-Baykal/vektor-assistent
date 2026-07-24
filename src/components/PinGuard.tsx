"use client";

import { useState, useEffect, type ReactNode } from "react";

const SESSION_KEY = "vektor_token_verified";
const LOCAL_KEY = "vektor_token_remembered";

export default function PinGuard({ children }: { children: ReactNode }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    // Проверяем сначала sessionStorage (текущая вкладка)
    const sessionSaved = sessionStorage.getItem(SESSION_KEY);
    if (sessionSaved === "true") {
      setUnlocked(true);
      setChecking(false);
      return;
    }

    // Потом localStorage (запомненное устройство)
    const localSaved = localStorage.getItem(LOCAL_KEY);
    if (localSaved === "true") {
      sessionStorage.setItem(SESSION_KEY, "true");
      setUnlocked(true);
      setChecking(false);
      return;
    }

    setChecking(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token.trim()) return;

    try {
      const res = await fetch("/api/invite-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: token.trim() }),
      });

      if (res.ok) {
        // Всегда сохраняем в sessionStorage (до закрытия вкладки)
        sessionStorage.setItem(SESSION_KEY, "true");

        // Если отмечено "Запомнить" — сохраняем в localStorage (навсегда)
        if (remember) {
          localStorage.setItem(LOCAL_KEY, "true");
        }

        setUnlocked(true);
      } else {
        const data = await res.json();
        setError(data.error || "Неверный код");
        setToken("");
      }
    } catch {
      setError("Ошибка соединения");
    }
  };

  // Удалить сохранение (на будущее — кнопка "Выйти")
  // const logout = () => { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(LOCAL_KEY); setUnlocked(false); };

  if (checking) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-900">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-indigo-500" />
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-indigo-950 px-4">
        <div className="w-full max-w-sm">
          {/* Лого */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-2xl font-bold text-white shadow-lg shadow-indigo-600/30">
              В
            </div>
            <h1 className="text-xl font-bold text-white">Вектор Ассистент</h1>
            <p className="mt-1 text-sm text-slate-400">
              Введите код доступа
            </p>
          </div>

          {/* Форма */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value.toUpperCase())}
                placeholder="XXXXXX"
                maxLength={10}
                autoFocus
                autoComplete="off"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-center text-lg tracking-[0.3em] text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 placeholder:text-slate-500"
              />
              {error && (
                <p className="mt-2 text-center text-xs font-medium text-red-400">
                  ❌ {error}
                </p>
              )}
            </div>

            {/* Чекбокс "Запомнить устройство" */}
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-700/50 bg-slate-800/50 px-4 py-3 transition hover:border-slate-600 hover:bg-slate-800">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-indigo-500 outline-none transition focus:ring-2 focus:ring-indigo-500/30"
              />
              <div>
                <span className="text-sm font-medium text-slate-200">Запомнить устройство</span>
                <p className="text-[10px] text-slate-500">Больше не нужно будет вводить код на этом устройстве</p>
              </div>
            </label>

            <button
              type="submit"
              disabled={!token.trim()}
              className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-40"
            >
              Войти
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            Код можно получить у владельца
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
