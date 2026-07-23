import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Проверяет пин-код доступа к веб-приложению
export async function POST(request: Request) {
  const { pin } = await request.json();
  const validPin = process.env.APP_ACCESS_PIN;

  // Если пин-код не установлен — доступ открыт всем
  if (!validPin) {
    return NextResponse.json({ ok: true, pinRequired: false });
  }

  // Проверяем пин-код
  if (pin === validPin) {
    return NextResponse.json({ ok: true, pinRequired: true });
  }

  return NextResponse.json({ ok: false, pinRequired: true, error: "Неверный код" }, { status: 403 });
}

// Проверяет, нужен ли вообще пин-код
export async function GET() {
  const pinRequired = !!process.env.APP_ACCESS_PIN;
  return NextResponse.json({ pinRequired });
}
