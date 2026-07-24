import { NextResponse } from "next/server";
import { db } from "@/db";
import { deals } from "@/db/schema";
import { eq, desc, gte, lte, and, sql, type SQL } from "drizzle-orm";
import { parseInput } from "@/lib/parser";

export const dynamic = "force-dynamic";

// Помощник расчёта налога (6% при оплате по счёту)
function calcTax(saleAmount: number, workAmount: number, paymentType: string): number {
  if (paymentType !== "invoice") return 0;
  const totalIncome = saleAmount + workAmount;
  return Math.round(totalIncome * 0.06);
}

// Тип для записи в логе действий
type ActivityEntry = {
  action: string;
  timestamp: string;
  details: string;
  delta?: {
    saleAmount?: number;
    purchaseAmount?: number;
    workAmount?: number;
    materialsAmount?: number;
  };
};

// Парсит activity_log из JSON
function parseActivityLog(log: string | null): ActivityEntry[] {
  if (!log) return [];
  try {
    return JSON.parse(log);
  } catch {
    return [];
  }
}

// Возвращает следующий номер сделки для пользователя
async function getNextDealNumber(userId: number = 1): Promise<number> {
  const [last] = await db
    .select({ maxNum: sql<number>`COALESCE(MAX(deal_number), 0)` })
    .from(deals)
    .where(eq(deals.userId, userId));

  return (last?.maxNum || 0) + 1;
}

function now() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const category = searchParams.get("category");
  const dealNumber = searchParams.get("dealNumber");

  let whereClause: SQL = sql`true`;
  if (from && to) {
    whereClause = and(whereClause, gte(deals.date, from), lte(deals.date, to)) as SQL;
  }
  if (category) {
    whereClause = and(whereClause, eq(deals.category, category)) as SQL;
  }
  if (dealNumber) {
    whereClause = and(whereClause, eq(deals.dealNumber, parseInt(dealNumber))) as SQL;
  }

  const result = await db
    .select()
    .from(deals)
    .where(whereClause)
    .orderBy(desc(deals.dealNumber));

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
        const dealNumber = await getNextDealNumber();
        const margin = deal.saleAmount - deal.purchaseAmount + deal.workAmount - deal.materialsAmount;

        // Формируем начальный лог
        const log: ActivityEntry[] = [
          {
            action: "Сделка создана",
            timestamp: now(),
            details: `${deal.category} | Продажа: ${deal.saleAmount}₽, Закупка: ${deal.purchaseAmount}₽, Монтаж: ${deal.workAmount}₽, Расход: ${deal.materialsAmount}₽`,
            delta: {
              saleAmount: deal.saleAmount,
              purchaseAmount: deal.purchaseAmount,
              workAmount: deal.workAmount,
              materialsAmount: deal.materialsAmount,
            },
          },
        ];

        const paymentType = deal.paymentType || "cash";
        const taxAmount = calcTax(deal.saleAmount, deal.workAmount, paymentType);
        const marginWithTax = margin - taxAmount;

        const [row] = await db
          .insert(deals)
          .values({
            userId: 1,
            dealNumber,
            date: deal.date,
            category: deal.category,
            saleAmount: deal.saleAmount,
            purchaseAmount: deal.purchaseAmount,
            workAmount: deal.workAmount,
            materialsAmount: deal.materialsAmount,
            equipmentMargin: deal.saleAmount - deal.purchaseAmount,
            workMargin: deal.workAmount - deal.materialsAmount,
            totalMargin: marginWithTax,
            paymentType,
            taxAmount,
            totalWithTax: deal.saleAmount + deal.workAmount - taxAmount,
            notes: deal.notes,
            activityLog: JSON.stringify(log),
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
  const paymentType = direct.paymentType || "cash";
  const taxAmount = calcTax(saleAmount, workAmount, paymentType);
  const margin = saleAmount - purchaseAmount + workAmount - materialsAmount - taxAmount;
  const dealNumber = await getNextDealNumber();

  const log: ActivityEntry[] = [
    {
      action: "Сделка создана",
      timestamp: now(),
      details: `${direct.category || "Объект"} | Продажа: ${saleAmount}₽, Закупка: ${purchaseAmount}₽, Монтаж: ${workAmount}₽, Расход: ${materialsAmount}₽${paymentType === "invoice" ? `, Налог 6%: ${taxAmount}₽` : ""}`,
      delta: { saleAmount, purchaseAmount, workAmount, materialsAmount },
    },
  ];

  const [row] = await db
    .insert(deals)
    .values({
      userId: 1,
      dealNumber,
      date: direct.date || new Date().toISOString().slice(0, 10),
      category: direct.category || "Объект",
      saleAmount,
      purchaseAmount,
      workAmount,
      materialsAmount,
      equipmentMargin: saleAmount - purchaseAmount,
      workMargin: workAmount - materialsAmount,
      totalMargin: margin,
      paymentType,
      taxAmount,
      totalWithTax: saleAmount + workAmount - taxAmount,
      notes: direct.notes || null,
      activityLog: JSON.stringify(log),
    })
    .returning();

  return NextResponse.json(row);
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { id, dealNumber: dn, ...updates } = body;

  // Ищем сделку либо по id, либо по dealNumber
  let whereClause;
  if (dn) {
    whereClause = eq(deals.dealNumber, dn);
  } else if (id) {
    whereClause = eq(deals.id, parseInt(id));
  } else {
    return NextResponse.json({ error: "id or dealNumber required" }, { status: 400 });
  }

  const [existing] = await db.select().from(deals).where(whereClause);
  if (!existing) {
    return NextResponse.json({ error: "deal not found" }, { status: 404 });
  }

  // Обновляем только переданные поля
  const updatedFields: Record<string, number | string | null> = {};
  let logEntries: ActivityEntry[] = [];

  // Полные замены
  if (updates.saleAmount !== undefined) {
    updatedFields.saleAmount = Number(updates.saleAmount);
    logEntries.push({
      action: "Продажа изменена",
      timestamp: now(),
      details: `${existing.saleAmount}₽ → ${updatedFields.saleAmount}₽`,
      delta: { saleAmount: Number(updates.saleAmount) - existing.saleAmount },
    });
  }
  if (updates.purchaseAmount !== undefined) {
    updatedFields.purchaseAmount = Number(updates.purchaseAmount);
    logEntries.push({
      action: "Закупка изменена",
      timestamp: now(),
      details: `${existing.purchaseAmount}₽ → ${updatedFields.purchaseAmount}₽`,
      delta: { purchaseAmount: Number(updates.purchaseAmount) - existing.purchaseAmount },
    });
  }
  if (updates.workAmount !== undefined) {
    updatedFields.workAmount = Number(updates.workAmount);
    logEntries.push({
      action: "Монтаж изменён",
      timestamp: now(),
      details: `${existing.workAmount}₽ → ${updatedFields.workAmount}₽`,
      delta: { workAmount: Number(updates.workAmount) - existing.workAmount },
    });
  }
  if (updates.materialsAmount !== undefined) {
    updatedFields.materialsAmount = Number(updates.materialsAmount);
    logEntries.push({
      action: "Расходы изменены",
      timestamp: now(),
      details: `${existing.materialsAmount}₽ → ${updatedFields.materialsAmount}₽`,
      delta: { materialsAmount: Number(updates.materialsAmount) - existing.materialsAmount },
    });
  }

  // Добавления к существующим значениям
  if (updates.addSaleAmount) {
    const added = Number(updates.addSaleAmount);
    updatedFields.saleAmount = (existing.saleAmount || 0) + added;
    logEntries.push({
      action: `➕ Добавлено к продаже`,
      timestamp: now(),
      details: `+${added}₽ (было ${existing.saleAmount}₽, стало ${updatedFields.saleAmount}₽)`,
      delta: { saleAmount: added },
    });
  }
  if (updates.addPurchaseAmount) {
    const added = Number(updates.addPurchaseAmount);
    updatedFields.purchaseAmount = (existing.purchaseAmount || 0) + added;
    logEntries.push({
      action: `➕ Добавлено к закупке`,
      timestamp: now(),
      details: `+${added}₽ (было ${existing.purchaseAmount}₽, стало ${updatedFields.purchaseAmount}₽)`,
      delta: { purchaseAmount: added },
    });
  }
  if (updates.addWorkAmount) {
    const added = Number(updates.addWorkAmount);
    updatedFields.workAmount = (existing.workAmount || 0) + added;
    logEntries.push({
      action: `➕ Добавлено к монтажу`,
      timestamp: now(),
      details: `+${added}₽ (было ${existing.workAmount}₽, стало ${updatedFields.workAmount}₽)`,
      delta: { workAmount: added },
    });
  }
  if (updates.addMaterialsAmount) {
    const added = Number(updates.addMaterialsAmount);
    updatedFields.materialsAmount = (existing.materialsAmount || 0) + added;
    logEntries.push({
      action: `➕ Добавлено к расходам`,
      timestamp: now(),
      details: `+${added}₽ (было ${existing.materialsAmount}₽, стало ${updatedFields.materialsAmount}₽)`,
      delta: { materialsAmount: added },
    });
  }

  // Заметки
  if (updates.notes !== undefined) {
    updatedFields.notes = String(updates.notes);
    logEntries.push({
      action: "Заметки обновлены",
      timestamp: now(),
      details: String(updates.notes).slice(0, 100),
    });
  }

  // Способ оплаты (наличные / по счёту)
  if (updates.paymentType !== undefined) {
    const oldLabel = existing.paymentType === "invoice" ? "По счёту" : "Наличные";
    const newLabel = updates.paymentType === "invoice" ? "По счёту" : "Наличные";
    updatedFields.paymentType = updates.paymentType;
    logEntries.push({
      action: "💳 Способ оплаты изменён",
      timestamp: now(),
      details: `${oldLabel} → ${newLabel}`,
    });
  }

  // Берём текущие значения (обновлённые или старые)
  const finalSale = typeof updatedFields.saleAmount === 'number' ? updatedFields.saleAmount : existing.saleAmount;
  const finalPurchase = typeof updatedFields.purchaseAmount === 'number' ? updatedFields.purchaseAmount : existing.purchaseAmount;
  const finalWork = typeof updatedFields.workAmount === 'number' ? updatedFields.workAmount : existing.workAmount;
  const finalMaterials = typeof updatedFields.materialsAmount === 'number' ? updatedFields.materialsAmount : existing.materialsAmount;
  const finalPaymentType = typeof updatedFields.paymentType === 'string' ? updatedFields.paymentType : existing.paymentType;

  // Пересчитываем налог
  const finalTax = calcTax(finalSale, finalWork, finalPaymentType);
  updatedFields.taxAmount = finalTax;
  updatedFields.totalWithTax = finalSale + finalWork - finalTax;

  updatedFields.equipmentMargin = finalSale - finalPurchase;
  updatedFields.workMargin = finalWork - finalMaterials;
  updatedFields.totalMargin = finalSale - finalPurchase + finalWork - finalMaterials - finalTax;

  // Добавляем запись о пересчёте маржи
  const oldMargin = existing.totalMargin;
  const newMargin = updatedFields.totalMargin as number;
  if (oldMargin !== newMargin) {
    logEntries.push({
      action: "📊 Маржа пересчитана",
      timestamp: now(),
      details: `${oldMargin}₽ → ${newMargin}₽ (изменение: ${newMargin - oldMargin >= 0 ? "+" : ""}${newMargin - oldMargin}₽)`,
    });
  }

  // Сохраняем обновлённый activityLog (добавляем новые записи к существующим)
  const existingLog = parseActivityLog(existing.activityLog);
  const mergedLog = [...existingLog, ...logEntries];
  updatedFields.activityLog = JSON.stringify(mergedLog);

  const [row] = await db
    .update(deals)
    .set(updatedFields as any)
    .where(eq(deals.id, existing.id))
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
