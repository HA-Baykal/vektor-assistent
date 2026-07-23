import { useState, useEffect } from "react";

// Функции для работы с часовым поясом Иркутска (Asia/Irkutsk, UTC+8)

export type TimeInfo = {
  hour: number;      // Час в Иркутске (0-23)
  greeting: string;  // Приветствие
  emoji: string;     // Эмодзи к приветствию
  isDark: boolean;   // Тёмная тема?
  timeStr: string;   // Время в Иркутске "ЧЧ:ММ"
};

// Получает текущее время в Иркутске
export function getIrkutskTime(): Date {
  const now = new Date();
  // Используем Intl API для получения компонентов времени в Иркутске
  const formatter = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Irkutsk",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find(p => p.type === "hour")?.value || "0", 10);
  const minute = parseInt(parts.find(p => p.type === "minute")?.value || "0", 10);
  
  // Создаем дату с Иркутским временем
  const irkDate = new Date();
  irkDate.setHours(hour, minute, 0, 0);
  return irkDate;
}

// Достаёт час в Иркутске
export function getIrkutskHour(): number {
  try {
    const formatter = new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Asia/Irkutsk",
      hour: "numeric",
      hour12: false,
    });
    return parseInt(formatter.format(new Date()), 10);
  } catch {
    // Fallback: UTC+8 вручную
    const utc = new Date();
    return (utc.getUTCHours() + 8) % 24;
  }
}

// Достаёт время в формате "ЧЧ:ММ" по Иркутску
export function getIrkutskTimeStr(): string {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Asia/Irkutsk",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
  } catch {
    const h = getIrkutskHour();
    const m = new Date().getUTCMinutes();
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
}

// Возвращает приветствие, эмодзи и флаг тёмной темы
export function getGreeting(): { greeting: string; emoji: string; isDark: boolean } {
  const hour = getIrkutskHour();

  // Вечер: 18:00 - 4:59
  if (hour >= 18 || hour < 5) {
    return { greeting: "Добрый вечер", emoji: "🌙", isDark: true };
  }
  // День: 12:00 - 17:59
  if (hour >= 12) {
    return { greeting: "Добрый день", emoji: "🌤️", isDark: false };
  }
  // Утро: 5:00 - 11:59
  return { greeting: "Доброе утро", emoji: "☀️", isDark: false };
}

// React hook для получения времени Иркутска
export function useIrkutskTime(): TimeInfo {
  const [timeInfo, setTimeInfo] = useState<TimeInfo>(() => {
    const hour = getIrkutskHour();
    const { greeting, emoji, isDark } = getGreeting();
    return {
      hour,
      greeting,
      emoji,
      isDark,
      timeStr: getIrkutskTimeStr(),
    };
  });

  useEffect(() => {
    // Обновляем каждую минуту
    const interval = setInterval(() => {
      const hour = getIrkutskHour();
      const { greeting, emoji, isDark } = getGreeting();
      setTimeInfo({
        hour,
        greeting,
        emoji,
        isDark,
        timeStr: getIrkutskTimeStr(),
      });
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  return timeInfo;
}
