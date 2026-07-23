import { NextResponse } from "next/server";
import { db } from "@/db";
import { tasks, deals } from "@/db/schema";
import { eq, gte, and, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Попытка добавить новые колонки, если их нет (миграция на лету)
async function tryMigrate(): Promise<string[]> {
  const logs: string[] = [];
  try {
    await db.execute(sql`ALTER TABLE deals ADD COLUMN IF NOT EXISTS deal_number INTEGER NOT NULL DEFAULT 0`);
    logs.push("deal_number added");
  } catch { /* exists */ }
  try {
    await db.execute(sql`ALTER TABLE deals ADD COLUMN IF NOT EXISTS activity_log TEXT NOT NULL DEFAULT '[]'`);
    logs.push("activity_log added");
  } catch { /* exists */ }
  try {
    await db.execute(sql`UPDATE deals SET deal_number = id WHERE deal_number = 0 OR deal_number IS NULL`);
  } catch { /* ignore */ }
  return logs;
}

export async function GET() {
  try {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${today.getDate().toString().padStart(2, "0")}`;

    // Задачи на сегодня
    const todayTasks = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.date, todayStr)))
      .orderBy(tasks.time);

    // Сделки за сегодня
    const todayDeals = await db
      .select()
      .from(deals)
      .where(eq(deals.date, todayStr))
      .orderBy(desc(deals.createdAt));

    // Маржа за неделю
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);
    const weekAgoStr = `${weekAgo.getFullYear()}-${(weekAgo.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${weekAgo.getDate().toString().padStart(2, "0")}`;

    const weekDeals = await db
      .select()
      .from(deals)
      .where(gte(deals.date, weekAgoStr));

    const weekMargin = weekDeals.reduce((s, d) => s + d.totalMargin, 0);
    const weekRevenue = weekDeals.reduce((s, d) => s + d.saleAmount, 0);
    const todayMargin = todayDeals.reduce((s, d) => s + d.totalMargin, 0);

    // Активные задачи
    const activeTasks = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.status, "active"), gte(tasks.date, todayStr)))
      .orderBy(tasks.date, tasks.time);

    // Форматирование
    const months = [
      "января", "февраля", "марта", "апреля", "мая", "июня",
      "июля", "августа", "сентября", "октября", "ноября", "декабря",
    ];
    const days = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];

    const d = new Date(todayStr + "T00:00:00");

    return NextResponse.json({
      todayTasks,
      todayDeals,
      weekMargin,
      weekRevenue,
      todayMargin,
      activeTasksCount: activeTasks.length,
      todayStr,
      todayLabel: `${d.getDate()} ${months[d.getMonth()]}`,
      weekday: days[d.getDay()],
    });
  } catch (error: any) {
    // Если ошибка из-за отсутствия колонок — пробуем миграцию
    const msg = String(error?.message || error);
    if (msg.includes("deal_number") || msg.includes("activity_log")) {
      const migrationLogs = await tryMigrate();
      // Пробуем ещё раз после миграции
      try {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1)
          .toString().padStart(2, "0")}-${today.getDate().toString().padStart(2, "0")}`;
        
        const todayTasks = await db.select().from(tasks).where(and(eq(tasks.date, todayStr))).orderBy(tasks.time);
        const todayDeals = await db.select().from(deals).where(eq(deals.date, todayStr)).orderBy(desc(deals.createdAt));
        
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 6);
        const weekAgoStr = `${weekAgo.getFullYear()}-${(weekAgo.getMonth() + 1).toString().padStart(2, "0")}-${weekAgo.getDate().toString().padStart(2, "0")}`;
        const weekDeals = await db.select().from(deals).where(gte(deals.date, weekAgoStr));
        
        const activeTasks = await db.select().from(tasks).where(and(eq(tasks.status, "active"), gte(tasks.date, todayStr))).orderBy(tasks.date, tasks.time);

        const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
        const days = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
        const d = new Date(todayStr + "T00:00:00");

        return NextResponse.json({
          todayTasks, todayDeals,
          weekMargin: weekDeals.reduce((s, d) => s + d.totalMargin, 0),
          weekRevenue: weekDeals.reduce((s, d) => s + d.saleAmount, 0),
          todayMargin: todayDeals.reduce((s, d) => s + d.totalMargin, 0),
          activeTasksCount: activeTasks.length,
          todayStr, todayLabel: `${d.getDate()} ${months[d.getMonth()]}`, weekday: days[d.getDay()],
        });
      } catch (retryError: any) {
        return NextResponse.json({
          error: "database_error",
          message: "Ошибка базы данных. Попробуйте открыть /api/init один раз для обновления таблиц.",
          detail: String(retryError?.message || retryError),
          migrationLogs,
        }, { status: 500 });
      }
    }

    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "internal_error", message: String(error?.message || error) },
      { status: 500 }
    );
  }
}
