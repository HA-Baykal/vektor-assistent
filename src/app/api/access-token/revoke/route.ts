import { NextResponse } from "next/server";
import { db } from "@/db";
import { accessTokens } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { token } = await request.json();
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  try {
    await db
      .update(accessTokens)
      .set({ used: true })
      .where(eq(accessTokens.token, token.toUpperCase().trim()));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Token revoke error:", error);
    return NextResponse.json({ error: "Ошибка" }, { status: 500 });
  }
}
