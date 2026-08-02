"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Дашборд", icon: "🏠", shortLabel: "Главная" },
  { href: "/tasks", label: "Задачи", icon: "✅", shortLabel: "Задачи" },
  { href: "/finance", label: "Финансы", icon: "💰", shortLabel: "Финансы" },
  { href: "/reports", label: "Отчёты", icon: "📊", shortLabel: "Отчёты" },
];

export default function Nav({ isMobile = false }: { isMobile?: boolean }) {
  const pathname = usePathname();

  if (isMobile) {
    // Мобильная нижняя навигация
    return (
      <nav className="safe-area-bottom flex w-full items-center justify-around border-t border-slate-200/80 bg-white/95 pb-1 pt-2 backdrop-blur-lg">
        {links.map((link) => {
          const isActive =
            pathname === link.href ||
            (link.href !== "/" && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-1 transition-all ${
                isActive
                  ? "text-indigo-600"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <span className={`text-xl transition-transform ${
                isActive ? "scale-110" : ""
              }`}>
                {link.icon}
              </span>
              <span className={`text-[10px] font-semibold ${
                isActive ? "text-indigo-600" : "text-slate-400"
              }`}>
                {link.shortLabel}
              </span>
              {isActive && (
                <span className="mt-0.5 h-1 w-5 rounded-full bg-indigo-600" />
              )}
            </Link>
          );
        })}
      </nav>
    );
  }

  // Десктопная боковая навигация
  return (
    <nav className="flex flex-col gap-1">
      {links.map((link) => {
        const isActive =
          pathname === link.href ||
          (link.href !== "/" && pathname.startsWith(link.href));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
              isActive
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span className="text-lg">{link.icon}</span>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
