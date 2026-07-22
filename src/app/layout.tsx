import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Вектор Ассистент — ИИ-ассистент предпринимателя",
  description:
    "Персональный ИИ-ассистент для предпринимателя: голосовые заметки, финансы, отчёты",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="bg-slate-100 text-slate-900 antialiased">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col bg-slate-900 p-5 lg:flex">
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-lg font-bold text-white">
                В
              </div>
              <div>
                <h1 className="text-base font-bold text-white">Вектор</h1>
                <p className="text-xs text-slate-400">Ассистент</p>
              </div>
            </div>
            <Nav />
            <div className="mt-auto rounded-xl bg-white/5 p-4">
              <p className="text-xs font-medium text-slate-300">
                💡 Голосовое управление
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Нажмите микрофони диктуйте задачи или сделки
              </p>
            </div>
          </aside>

          {/* Mobile top bar */}
          <header className="fixed inset-x-0 top-0 z-20 flex items-center justify-between bg-slate-900 px-4 py-3 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white">
                В
              </div>
              <span className="font-bold text-white">Вектор Ассистент</span>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1 lg:pl-64">
            <div className="mx-auto max-w-5xl px-4 py-6 pt-20 lg:px-8 lg:py-10">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
