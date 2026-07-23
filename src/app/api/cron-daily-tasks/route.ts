import { NextResponse } from "next/server";
import { db } from "@/db";
import { tasks, allowedUsers } from "@/db/schema";
import { eq, gte, and } from "drizzle-orm";
import { sendMessage } from "@/lib/telegram";
import { formatDateRu, formatWeekdayRu } from "@/lib/parser";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Проверяет, что сейчас ~7 утра по Иркутску (UTC+8)
function isIrkutskMorning(): boolean {
  const now = new Date();
  // Иркутск = UTC+8
  const irkHour = (now.getUTCHours() + 8) % 24;
  // 7:00 ± 10 минут (чтобы cron не пропустил)
  return irkHour === 7 && now.getUTCMinutes() < 15;
}

// Секретный ключ для защиты cron от посторонних.
// По умолчанию совпадает с тем, что прописан в vercel.json.
const CRON_SECRET = process.env.CRON_SECRET || "daily7am_irk";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  // Проверяем секрет (если не совпадает — пропускаем)
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Проверяем время — Иркутск 7 утра?
  if (!isIrkutskMorning()) {
    const irkHour = (new Date().getUTCHours() + 8) % 24;
    return NextResponse.json({
      ok: false,
      message: `Not 7 AM Irkutsk yet, current hour: ${irkHour}`,
    });
  }

  try {
    // Получаем сегодняшнюю дату по Иркутску
    const now = new Date();
    const irkDate = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const todayStr = irkDate.toISOString().slice(0, 10);

    // Получаем задачи на сегодня (активные)
    const todayTasks = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.date, todayStr), eq(tasks.status, "active")))
      .orderBy(tasks.time);

    if (todayTasks.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "Нет задач на сегодня",
        sent: 0,
      });
    }

    // Форматируем задачи
    const dateLabel = formatDateRu(todayStr);
    const weekday = formatWeekdayRu(todayStr);

    const taskLines = todayTasks
      .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"))
      .map((t, i) => {
        const timeStr = t.time ? ` ${t.time}` : "";
        return `${i + 1}.${timeStr} — ${t.text}`;
      })
      .join("\n");

    const message =
      `☀️ <b>Доброе утро!</b>\n\n` +
      `📅 <b>${dateLabel}, ${weekday}</b>\n\n` +
      `📋 <b>Задачи на сегодня:</b>\n${taskLines}\n\n` +
      `📱 Открыть: https://vektor-assistent.vercel.app`;

    // Получаем всех пользователей Telegram с доступом
    const users = await db.select().from(allowedUsers);
    const chatIds = users.map((u) => u.chatId);

    // Отправляем всем
    let sentCount = 0;
    const errors: string[] = [];

    for (const chatId of chatIds) {
      try {
        await sendMessage(Number(chatId), message);
        sentCount++;
      } catch (err: any) {
        errors.push(`${chatId}: ${err?.message || "error"}`);
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Уведомления отправлены ${sentCount} пользователям`,
      sent: sentCount,
      total: users.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("Cron daily tasks error:", error);
    return NextResponse.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}
