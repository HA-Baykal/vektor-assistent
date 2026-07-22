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

export async function PATCH(request: Request) {
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  // Берём текущие значения из базы
  const [existing] = await db
    .select()
    .from(deals)
    .where(eq(deals.id, parseInt(id)));

  if (!existing) {
    return NextResponse.json({ error: "deal not found" }, { status: 404 });
  }

  // Обновляем только переданные поля — используем Partial<typeof deals.$inferInsert>
  const updatedFields: Record<string, number | string | null> = {};

  if (updates.saleAmount !== undefined) updatedFields.saleAmount = Number(updates.saleAmount);
  if (updates.purchaseAmount !== undefined) updatedFields.purchaseAmount = Number(updates.purchaseAmount);
  if (updates.workAmount !== undefined) updatedFields.workAmount = Number(updates.workAmount);
  if (updates.materialsAmount !== undefined) updatedFields.materialsAmount = Number(updates.materialsAmount);
  // Добавление к существующим значениям (для случаев "добавить расход")
  if (updates.addSaleAmount) updatedFields.saleAmount = (existing.saleAmount || 0) + Number(updates.addSaleAmount);
  if (updates.addPurchaseAmount) updatedFields.purchaseAmount = (existing.purchaseAmount || 0) + Number(updates.addPurchaseAmount);
  if (updates.addWorkAmount) updatedFields.workAmount = (existing.workAmount || 0) + Number(updates.addWorkAmount);
  if (updates.addMaterialsAmount) updatedFields.materialsAmount = (existing.materialsAmount || 0) + Number(updates.addMaterialsAmount);
  if (updates.category !== undefined) updatedFields.category = String(updates.category);
  if (updates.date !== undefined) updatedFields.date = String(updates.date);
  if (updates.notes !== undefined) updatedFields.notes = String(updates.notes);

  // Пересчитываем маржу с учётом новых значений
  const finalSale = typeof updatedFields.saleAmount === 'number' ? updatedFields.saleAmount : existing.saleAmount;
  const finalPurchase = typeof updatedFields.purchaseAmount === 'number' ? updatedFields.purchaseAmount : existing.purchaseAmount;
  const finalWork = typeof updatedFields.workAmount === 'number' ? updatedFields.workAmount : existing.workAmount;
  const finalMaterials = typeof updatedFields.materialsAmount === 'number' ? updatedFields.materialsAmount : existing.materialsAmount;

  updatedFields.equipmentMargin = finalSale - finalPurchase;
  updatedFields.workMargin = finalWork - finalMaterials;
  updatedFields.totalMargin = finalSale - finalPurchase + finalWork - finalMaterials;

  const [row] = await db
    .update(deals)
    .set(updatedFields as any)
    .where(eq(deals.id, parseInt(id)))
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
