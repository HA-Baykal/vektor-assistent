import { NextResponse } from "next/server";
import { db } from "@/db";
import { deals } from "@/db/schema";
import { eq, desc, gte, lte, and, sql, type SQL } from "drizzle-orm";
import { parseInput } from "@/lib/parser";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const category = searchParams.get("category");

  let whereClause: SQL = sql`true`;
  if (from && to) {
    whereClause = and(whereClause, gte(deals.date, from), lte(deals.date, to)) as SQL;
  }
  if (category) {
    whereClause = and(whereClause, eq(deals.category, category)) as SQL;
  }

  const result = await db
    .select()
    .from(deals)
    .where(whereClause)
    .orderBy(desc(deals.date));

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { text, ...direct } = body;

  if (text && !direct.saleAmount) {
    const parsed = parseInput(text);
    if (parsed.type === "deals" && parsed.deals.length > 0) {
      const created = [];
      for (const deal of parsed.deals) {
        const [row] = await db
          .insert(deals)
          .values({
            userId: 1,
            date: deal.date,
            category: deal.category,
            saleAmount: deal.saleAmount,
            purchaseAmount: deal.purchaseAmount,
            workAmount: deal.workAmount,
            materialsAmount: deal.materialsAmount,
            equipmentMargin: deal.saleAmount - deal.purchaseAmount,
            workMargin: deal.workAmount - deal.materialsAmount,
            totalMargin:
              deal.saleAmount -
              deal.purchaseAmount +
              deal.workAmount -
              deal.materialsAmount,
            notes: deal.notes,
          })
          .returning();
        created.push(row);
      }
      return NextResponse.json({ deals: created, parsed });
    }
  }

  const saleAmount = direct.saleAmount || 0;
  const purchaseAmount = direct.purchaseAmount || 0;
  const workAmount = direct.workAmount || 0;
  const materialsAmount = direct.materialsAmount || 0;

  const [row] = await db
    .insert(deals)
    .values({
      userId: 1,
      date: direct.date || new Date().toISOString().slice(0, 10),
      category: direct.category || "Объект",
      saleAmount,
      purchaseAmount,
      workAmount,
      materialsAmount,
      equipmentMargin: saleAmount - purchaseAmount,
      workMargin: workAmount - materialsAmount,
      totalMargin: saleAmount - purchaseAmount + workAmount - materialsAmount,
      notes: direct.notes || null,
    })
    .returning();

  return NextResponse.json(row);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  await db.delete(deals).where(eq(deals.id, parseInt(id)));
  return NextResponse.json({ success: true });
}
