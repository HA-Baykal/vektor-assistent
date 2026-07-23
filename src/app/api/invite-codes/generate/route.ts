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

export async function POST(request: Request) {
  const { label } = await request.json();

  for (let attempt = 0; attempt < 10; attempt++) {
    const code = makeCode();
    try {
      await db.insert(inviteCodes).values({ code, label: label || "", active: true });
      return NextResponse.json({ ok: true, code });
    } catch (err: any) {
      if (err?.code !== "23505") throw err;
      // duplicate key, try again
    }
  }

  return NextResponse.json({ error: "Ошибка генерации" }, { status: 500 });
}
