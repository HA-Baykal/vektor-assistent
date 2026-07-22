import { NextResponse } from "next/server";
import { parseInput } from "@/lib/parser";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { text } = await request.json();

  if (!text) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  const result = parseInput(text);
  return NextResponse.json(result);
}
