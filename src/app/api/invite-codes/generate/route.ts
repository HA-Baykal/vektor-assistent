import { NextResponse } from "next/server";
import { db } from "@/db";
import { inviteCodes } from "@/db/schema";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeCode(): string {
  let c = "";
  for (let i = 0; i < 6; i++) c += CHARS[Math.floor(Math.random() * CHARS.length)];
  return c;
}

// Автомиграция — создаём таблицу если её нет
async function ensureTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS invite_codes (
        id SERIAL PRIMARY KEY,
        code VARCHAR(10) NOT NULL UNIQUE,
        label VARCHAR(255) DEFAULT '',
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
  } catch {
    // игнорируем
  }
}

export async function POST(request: Request) {
  // Сначала убеждаемся что таблица есть
  await ensureTable();

  const { label } = await request.json();

  for (let attempt = 0; attempt < 20; attempt++) {
    const code = makeCode();
    try {
      await db.insert(inviteCodes).values({ code, label: label || "", active: true });
      return NextResponse.json({ ok: true, code });
    } catch (err: any) {
      if (err?.code === "23505") continue; // duplicate key
      if (err?.code === "42P01") {
        // Таблица не существует — создаём и пробуем снова
        await ensureTable();
        continue;
      }
      console.error("Generate error:", err);
      return NextResponse.json({ error: "Ошибка генерации: " + String(err?.message || err) }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Не удалось сгенерировать уникальный код" }, { status: 500 });
}
