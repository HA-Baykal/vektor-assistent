import { db } from "@/db";
import { tasks, deals } from "@/db/schema";
import { eq, gte, and, desc } from "drizzle-orm";
import { formatRub, formatDateRu, formatWeekdayRu } from "@/lib/parser";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
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

  // Активные задачи (предстоящие)
  const activeTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.status, "active"), gte(tasks.date, todayStr)))
    .orderBy(tasks.date, tasks.time);

  return (
    <DashboardClient
      todayTasks={todayTasks}
      todayDeals={todayDeals}
      weekMargin={weekMargin}
      weekRevenue={weekRevenue}
      todayMargin={todayMargin}
      activeTasksCount={activeTasks.length}
      todayStr={todayStr}
      todayLabel={formatDateRu(todayStr)}
      weekday={formatWeekdayRu(todayStr)}
    />
  );
}
