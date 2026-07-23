import { NextResponse } from "next/server";
import { db } from "@/db";
import { inviteCodes } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select().from(inviteCodes).orderBy(desc(inviteCodes.createdAt));
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Ошибка" }, { status: 500 });
  }
}
