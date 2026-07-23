import { NextResponse } from "next/server";
import { db } from "@/db";
import { inviteCodes } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

// POST: проверить код доступа (из веб-приложения)
export async function POST(request: Request) {
  const { code } = await request.json();
  if (!code || typeof code !== "string") {
    return NextResponse.json({ ok: false, error: "Введите код" }, { status: 400 });
  }

  const cleanCode = code.trim().toUpperCase();

  try {
    const [found] = await db
      .select()
      .from(inviteCodes)
      .where(and(eq(inviteCodes.code, cleanCode), eq(inviteCodes.active, true)));

    if (!found) {
      return NextResponse.json({ ok: false, error: "Неверный код" }, { status: 403 });
    }

    return NextResponse.json({ ok: true, message: "Доступ предоставлен" });
  } catch (error) {
    console.error("Code check error:", error);
    return NextResponse.json({ ok: false, error: "Ошибка проверки" }, { status: 500 });
  }
}

// GET: проверяет, активна ли система кодов
export async function GET() {
  try {
    await db.execute(`SELECT 1 FROM invite_codes LIMIT 1`);
    return NextResponse.json({ enabled: true });
  } catch {
    return NextResponse.json({ enabled: false });
  }
}
