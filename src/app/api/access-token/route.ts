import { NextResponse } from "next/server";
import { db } from "@/db";
import { accessTokens } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Генерирует случайный одноразовый код
function generateToken(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// POST: верификация одноразового токена (вызывается из веб-приложения)
export async function POST(request: Request) {
  const { token } = await request.json();
  if (!token || typeof token !== "string") {
    return NextResponse.json({ ok: false, error: "Введите код" }, { status: 400 });
  }

  const cleanToken = token.trim().toUpperCase();

  try {
    const [found] = await db
      .select()
      .from(accessTokens)
      .where(and(
        eq(accessTokens.token, cleanToken),
        eq(accessTokens.used, false)
      ));

    if (!found) {
      return NextResponse.json({ ok: false, error: "Неверный или уже использованный код" }, { status: 403 });
    }

    // Проверяем срок действия
    if (found.expiresAt && new Date(found.expiresAt) < new Date()) {
      return NextResponse.json({ ok: false, error: "Срок действия кода истёк" }, { status: 403 });
    }

    // Помечаем как использованный
    await db
      .update(accessTokens)
      .set({ used: true, usedBy: "web" })
      .where(eq(accessTokens.id, found.id));

    return NextResponse.json({ ok: true, message: "Доступ предоставлен" });
  } catch (error) {
    console.error("Token verification error:", error);
    return NextResponse.json({ ok: false, error: "Ошибка проверки" }, { status: 500 });
  }
}

// GET: проверяет, есть ли система одноразовых паролей
export async function GET() {
  try {
    // Проверяем, есть ли таблица и работает ли она
    await db.execute(sql`SELECT 1 FROM access_tokens LIMIT 1`);
    return NextResponse.json({ enabled: true });
  } catch {
    return NextResponse.json({ enabled: false });
  }
}
