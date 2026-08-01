import { NextResponse } from "next/server";
import { db } from "@/db";
import { tasks, allowedUsers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { sendMessage } from "@/lib/telegram";
import { formatDateRu, formatWeekdayRu } from "@/lib/parser";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET || "daily7am_irk";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://vektor-assistent.vercel.app";

// Получает Иркутскую дату (UTC+8)
function getIrkutskDate(addDays: number = 0): string {
  const now = new Date();
  // UTC+8
  const irk = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  irk.setDate(irk.getDate() + addDays);
  return irk.toISOString().slice(0, 10);
}

// Создаёт таблицу если её нет
async function ensureTable() {
  try {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS allowed_users (
      id SERIAL PRIMARY KEY,
      chat_id VARCHAR(100) NOT NULL UNIQUE,
      user_name VARCHAR(255) DEFAULT '',
      access_level VARCHAR(20) NOT NULL DEFAULT 'read',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
  } catch {}
}

// Форматирует задачи в список
function formatTaskList(taskList: typeof tasks.$inferSelect[]): string {
  if (taskList.length === 0) return "";
  return taskList
    .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"))
    .map((t, i) => {
      const timeStr = t.time ? ` ${t.time.slice(0, 5)}` : "";
      return `  ${i + 1}.${timeStr} — ${t.text}`;
    })
    .join("\n");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  const force = searchParams.get("force") === "true";

  // Проверяем секрет
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureTable();

    // Получаем даты по Иркутску
    const todayStr = getIrkutskDate(0);
    const tomorrowStr = getIrkutskDate(1);

    console.log(`[CRON] Иркутск сегодня: ${todayStr}, завтра: ${tomorrowStr}`);

    // Задачи на сегодня (активные)
    const todayTasks = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.date, todayStr), eq(tasks.status, "active")))
      .orderBy(tasks.time);

    // Задачи на завтра (активные)
    const tomorrowTasks = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.date, tomorrowStr), eq(tasks.status, "active")))
      .orderBy(tasks.time);

    // Собираем сообщение
    const todayLabel = `${formatDateRu(todayStr)}, ${formatWeekdayRu(todayStr)}`;
    const tomorrowLabel = `${formatDateRu(tomorrowStr)}, ${formatWeekdayRu(tomorrowStr)}`;

    let message = `☀️ <b>Доброе утро!</b>\n\n📅 <b>${todayLabel}</b>\n\n`;

    // Сегодняшние задачи
    if (todayTasks.length > 0) {
      message += `📋 <b>Задачи на сегодня:</b>\n${formatTaskList(todayTasks)}\n`;
    } else {
      message += `📋 <b>Задачи на сегодня:</b>\n   ⚠️ На сегодня дел нет. <b>Иди ищи работу!!</b>\n`;
    }

    // Завтрашние задачи
    message += `\n📅 <b>НЕ ЗАБУДЬ НА ЗАВТРА!</b> • ${tomorrowLabel}\n`;

    if (tomorrowTasks.length > 0) {
      message += `📋 <b>Задачи на завтра:</b>\n${formatTaskList(tomorrowTasks)}\n`;
    } else {
      message += `📋 <b>Задачи на завтра:</b>\n   ⚠️ На завтра дел нет, <b>БЕЗДЕЛЬНИК!!!</b>\n`;
    }

    // Кнопка открыть приложение
    message += `\n📱 <a href="${APP_URL}">Открыть Вектор Ассистент</a>`;

    // Получаем всех пользователей
    const users = await db.select().from(allowedUsers);

    if (users.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "Нет пользователей для отправки",
        sent: 0,
        today: todayTasks.length,
        tomorrow: tomorrowTasks.length,
      });
    }

    // Отправляем всем
    let sentCount = 0;
    const errors: string[] = [];

    for (const user of users) {
      try {
        await sendMessage(Number(user.chatId), message);
        sentCount++;
      } catch (err: any) {
        errors.push(`${user.chatId}: ${err?.message || "error"}`);
      }
    }

    return NextResponse.json({
      ok: true,
      sent: sentCount,
      total: users.length,
      today: todayTasks.length,
      tomorrow: tomorrowTasks.length,
      todayStr,
      tomorrowStr,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("[CRON] Error:", error);
    return NextResponse.json(
      { ok: false, error: String(error?.message || error) },
      { status: 500 }
    );
  }
}
