import { NextResponse } from "next/server";
import { db } from "@/db";
import { accessTokens } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const creatorChatId = searchParams.get("creatorChatId");

  try {
    let rows;
    if (creatorChatId) {
      rows = await db
        .select()
        .from(accessTokens)
        .where(eq(accessTokens.creatorChatId, creatorChatId))
        .orderBy(desc(accessTokens.createdAt));
    } else {
      rows = await db
        .select()
        .from(accessTokens)
        .orderBy(desc(accessTokens.createdAt));
    }

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Token list error:", error);
    return NextResponse.json({ error: "Ошибка" }, { status: 500 });
  }
}
