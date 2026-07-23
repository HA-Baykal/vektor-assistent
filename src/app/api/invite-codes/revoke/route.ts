import { NextResponse } from "next/server";
import { db } from "@/db";
import { inviteCodes } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { code } = await request.json();
  if (!code) {
    return NextResponse.json({ error: "code required" }, { status: 400 });
  }

  try {
    await db.update(inviteCodes).set({ active: false }).where(eq(inviteCodes.code, code.toUpperCase().trim()));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка" }, { status: 500 });
  }
}
