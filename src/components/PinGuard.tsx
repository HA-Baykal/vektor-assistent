"use client";

import { useState, useEffect, type ReactNode } from "react";

const TOKEN_KEY = "vektor_token_verified";

export default function PinGuard({ children }: { children: ReactNode }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    // Проверяем sessionStorage
    const saved = sessionStorage.getItem(TOKEN_KEY);
    if (saved === "true") {
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
      const res = await fetch("/api/access-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });

      if (res.ok) {
        sessionStorage.setItem(TOKEN_KEY, "true");
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
              Введите одноразовый код доступа
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
