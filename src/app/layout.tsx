import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import Nav from "@/components/Nav";
import ThemeProvider from "@/components/ThemeProvider";
import PinGuard from "@/components/PinGuard";

export const metadata: Metadata = {
  title: "Вектор Ассистент — ИИ-ассистент предпринимателя",
  description:
    "Персональный ИИ-ассистент для предпринимателя: голосовые заметки, финансы, отчёты",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Вектор",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1e293b" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className="overscroll-none">
      <body className="bg-slate-100 text-slate-900 antialiased">
        <ThemeProvider />
        <PinGuard>
        <div className="flex min-h-dvh">
          {/* ===== DESKTOP SIDEBAR ===== */}
          <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-slate-900 p-5 pt-safe lg:flex">
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-lg font-bold text-white shadow-lg shadow-indigo-600/30">
                В
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight text-white">
                  Вектор
                </h1>
                <p className="text-xs font-medium text-slate-400">
                  Ассистент
                </p>
              </div>
            </div>
            <Nav />
            <div className="mt-auto rounded-xl bg-white/5 p-4">
              <p className="text-xs font-semibold text-slate-300">
                💡 Голосовое управление
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                Нажмите микрофон и диктуйте задачи или сделки
              </p>
            </div>
          </aside>

          {/* ===== MOBILE TOP BAR ===== */}
          <header className="safe-area-top fixed inset-x-0 top-0 z-20 flex items-center justify-between border-b border-slate-200/50 bg-white/90 px-4 py-3 backdrop-blur-xl lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white shadow-md">
                В
              </div>
              <span className="text-sm font-bold tracking-tight text-slate-900">
                Вектор Ассистент
              </span>
            </div>
            <div className="flex items-center gap-1">
              {/* Индикатор статуса */}
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-semibold text-emerald-600">
                  Работает
                </span>
              </div>
            </div>
          </header>

          {/* ===== MAIN CONTENT ===== */}
          <main className="flex min-h-dvh flex-1 flex-col lg:pl-64">
            <div className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-16 lg:px-8 lg:pb-10 lg:pt-10">
              {children}
            </div>
          </main>

          {/* ===== MOBILE BOTTOM NAV ===== */}
          <div className="fixed inset-x-0 bottom-0 z-30 lg:hidden">
            {/* Прозрачная подложка для safe-area */}
            <div className="safe-area-bottom bottom-nav bg-white/95 backdrop-blur-xl">
              <Nav isMobile />
            </div>
          </div>
        </div>
        </PinGuard>
      </body>
    </html>
  );
}
