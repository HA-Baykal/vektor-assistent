import { NextResponse } from "next/server";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { eq, and, desc, gte, lte, sql, type SQL } from "drizzle-orm";
import { parseInput } from "@/lib/parser";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let whereClause: SQL = sql`true`;
  if (date) {
    whereClause = and(whereClause, eq(tasks.date, date)) as SQL;
  }
  if (from && to) {
    whereClause = and(whereClause, gte(tasks.date, from), lte(tasks.date, to)) as SQL;
  }

  const result = await db
    .select()
    .from(tasks)
    .where(whereClause)
    .orderBy(desc(tasks.createdAt));

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { text, date, time } = body;

  if (text && !date) {
    const parsed = parseInput(text);
    if (parsed.type === "tasks" && parsed.tasks.length > 0) {
      const created = [];
      for (const task of parsed.tasks) {
        const [row] = await db
          .insert(tasks)
          .values({
            userId: 1,
            date: task.date,
            time: task.time,
            text: task.text,
            status: "active",
          })
          .returning();
        created.push(row);
      }
      return NextResponse.json({ tasks: created, parsed });
    }
  }

  const [row] = await db
    .insert(tasks)
    .values({
      userId: 1,
      date: date || new Date().toISOString().slice(0, 10),
      time: time || null,
      text,
      status: "active",
    })
    .returning();

  return NextResponse.json(row);
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { id, ...update } = body;

  const [row] = await db
    .update(tasks)
    .set(update)
    .where(eq(tasks.id, id))
    .returning();

  return NextResponse.json(row);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  await db.delete(tasks).where(eq(tasks.id, parseInt(id)));
  return NextResponse.json({ success: true });
}
