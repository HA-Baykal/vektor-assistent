import { NextResponse } from "next/server";
import { db } from "@/db";
import { tasks, deals } from "@/db/schema";
import { eq, gte, and, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

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
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: String(error) },
      { status: 500 }
    );
  }
}
