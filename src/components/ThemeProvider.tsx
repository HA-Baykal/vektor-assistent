"use client";

import { useEffect } from "react";
import { useIrkutskTime } from "@/lib/time";

export default function ThemeProvider() {
  const timeInfo = useIrkutskTime();

  useEffect(() => {
    // Добавляем/убираем класс dark и атрибут data-theme на <html>
    const html = document.documentElement;
    if (timeInfo.isDark) {
      html.classList.add("dark");
      html.setAttribute("data-theme", "dark");
      // Меняем theme-color для мобильных браузеров
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", "#0f172a");
    } else {
      html.classList.remove("dark");
      html.setAttribute("data-theme", "light");
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", "#1e293b");
    }
  }, [timeInfo.isDark]);

  // Компонент ничего не рендерит, только управляет темой
  return null;
}
