import { NextResponse } from "next/server";
import { db } from "@/db";
import { deals, tasks } from "@/db/schema";
import { gte, lte, and, eq, desc, type SQL, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

function getDateRange(period: string, customFrom?: string, customTo?: string) {
  // Если кастомный период
  if (customFrom && customTo) {
    return { from: customFrom, to: customTo };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let from: Date;
  let to: Date = today;

  switch (period) {
    case "today":
      from = today;
      break;
    case "yesterday":
      from = new Date(today);
      from.setDate(from.getDate() - 1);
      to = from;
      break;
    case "week":
      from = new Date(today);
      from.setDate(from.getDate() - 6);
      break;
    case "month":
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case "lastmonth":
      from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      to = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
    default:
      from = new Date(today);
      from.setDate(from.getDate() - 6);
  }

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d
      .getDate()
      .toString()
      .padStart(2, "0")}`;

  return { from: fmt(from), to: fmt(to) };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "week";
  const category = searchParams.get("category") || "all";
  const customFrom = searchParams.get("from") || undefined;
  const customTo = searchParams.get("to") || undefined;

  const { from, to } = getDateRange(period, customFrom, customTo);

  // Сделки за период
  let dealWhere: SQL = and(sql`true`, gte(deals.date, from), lte(deals.date, to)) as SQL;
  if (category !== "all") {
    dealWhere = and(dealWhere, eq(deals.category, category)) as SQL;
  }

  const allDeals = await db.select().from(deals).where(dealWhere).orderBy(desc(deals.date));

  const totalRevenue = allDeals.reduce((s, d) => s + d.saleAmount, 0);
  const totalPurchase = allDeals.reduce((s, d) => s + d.purchaseAmount, 0);
  const totalWork = allDeals.reduce((s, d) => s + d.workAmount, 0);
  const totalMaterials = allDeals.reduce((s, d) => s + d.materialsAmount, 0);
  const totalMargin = allDeals.reduce((s, d) => s + d.totalMargin, 0);
  const totalEquipmentMargin = allDeals.reduce((s, d) => s + d.equipmentMargin, 0);
  const totalWorkMargin = allDeals.reduce((s, d) => s + d.workMargin, 0);

  // По категориям
  const allPeriodDeals = await db.select().from(deals).where(
    and(sql`true`, gte(deals.date, from), lte(deals.date, to)) as SQL
  );

  const byCategory: Record<string, { count: number; margin: number; revenue: number }> = {};
  for (const d of allPeriodDeals) {
    if (!byCategory[d.category]) {
      byCategory[d.category] = { count: 0, margin: 0, revenue: 0 };
    }
    byCategory[d.category].count++;
    byCategory[d.category].margin += d.totalMargin;
    byCategory[d.category].revenue += d.saleAmount;
  }

  // Задачи за период
  const periodTasks = await db
    .select()
    .from(tasks)
    .where(and(gte(tasks.date, from), lte(tasks.date, to)) as SQL)
    .orderBy(tasks.date, tasks.time);

  return NextResponse.json({
    period,
    from,
    to,
    deals: allDeals,
    summary: {
      count: allDeals.length,
      revenue: totalRevenue,
      purchase: totalPurchase,
      work: totalWork,
      materials: totalMaterials,
      equipmentMargin: totalEquipmentMargin,
      workMargin: totalWorkMargin,
      totalMargin,
    },
    byCategory,
    tasks: periodTasks,
  });
}
