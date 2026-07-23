import { NextResponse } from "next/server";
import { db } from "@/db";
import { accessTokens } from "@/db/schema";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makeToken(): string {
  let t = "";
  for (let i = 0; i < 6; i++) t += CHARS[Math.floor(Math.random() * CHARS.length)];
  return t;
}

export async function POST(request: Request) {
  const { creatorChatId, label } = await request.json();
  if (!creatorChatId) {
    return NextResponse.json({ error: "creatorChatId required" }, { status: 400 });
  }

  try {
    // Пробуем до 5 раз сгенерировать уникальный токен
    for (let attempt = 0; attempt < 5; attempt++) {
      const token = makeToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      try {
        await db.execute(
          sql`INSERT INTO access_tokens (token, creator_chat_id, label, used, expires_at, created_at)
              VALUES (${token}, ${creatorChatId}, ${label || ""}, false, ${expiresAt}, NOW())`
        );

        return NextResponse.json({ ok: true, token, expiresAt });
      } catch (insertError: any) {
        // Если ошибка уникальности — пробуем другой токен
        if (insertError?.code === "23505") continue;
        throw insertError;
      }
    }

    return NextResponse.json({ error: "Не удалось сгенерировать уникальный код" }, { status: 500 });
  } catch (error: any) {
    console.error("Token generation error:", error);
    return NextResponse.json({ error: "Ошибка генерации" }, { status: 500 });
  }
}
