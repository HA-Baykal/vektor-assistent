import { NextResponse } from "next/server";
import { db } from "@/db";
import { deals, tasks } from "@/db/schema";
import { gte, lte, and, eq, desc, type SQL, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

function getDateRange(period: string) {
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

  const { from, to } = getDateRange(period);

  let whereClause: SQL = sql`true`;
  whereClause = and(whereClause, gte(deals.date, from), lte(deals.date, to)) as SQL;
  if (category !== "all") {
    whereClause = and(whereClause, eq(deals.category, category)) as SQL;
  }

  const allDeals = await db.select().from(deals).where(whereClause).orderBy(desc(deals.date));

  const totalRevenue = allDeals.reduce((s, d) => s + d.saleAmount, 0);
  const totalPurchase = allDeals.reduce((s, d) => s + d.purchaseAmount, 0);
  const totalWork = allDeals.reduce((s, d) => s + d.workAmount, 0);
  const totalMaterials = allDeals.reduce((s, d) => s + d.materialsAmount, 0);
  const totalMargin = allDeals.reduce((s, d) => s + d.totalMargin, 0);
  const totalEquipmentMargin = allDeals.reduce((s, d) => s + d.equipmentMargin, 0);
  const totalWorkMargin = allDeals.reduce((s, d) => s + d.workMargin, 0);

  // По категориям (за весь период, без фильтра по категории)
  let catWhereClause: SQL = and(sql`true`, gte(deals.date, from), lte(deals.date, to)) as SQL;
  const allPeriodDeals = await db.select().from(deals).where(catWhereClause);

  const byCategory: Record<string, { count: number; margin: number; revenue: number }> = {};
  for (const d of allPeriodDeals) {
    if (!byCategory[d.category]) {
      byCategory[d.category] = { count: 0, margin: 0, revenue: 0 };
    }
    byCategory[d.category].count++;
    byCategory[d.category].margin += d.totalMargin;
    byCategory[d.category].revenue += d.saleAmount;
  }

  // Активные задачи
  const todayStr = new Date().toISOString().slice(0, 10);
  const activeTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.status, "active"), gte(tasks.date, todayStr)) as SQL)
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
    activeTasks,
  });
}
