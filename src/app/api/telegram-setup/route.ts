import { NextResponse } from "next/server";
import { setWebhook, deleteWebhook, getWebhookInfo, setMenuButton } from "@/lib/telegram";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://vektor-assistent.vercel.app";

export async function GET() {
  const webhookUrl = `${APP_URL}/api/telegram-webhook`;
  const logs: string[] = [];

  try {
    // Проверяем, есть ли токен
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return NextResponse.json({
        success: false,
        message: "❌ TELEGRAM_BOT_TOKEN не настроен",
        hint: "Добавьте TELEGRAM_BOT_TOKEN в Vercel → Settings → Environment Variables",
      });
    }

    logs.push("✅ Токен бота найден");

    // Устанавливаем вебхук
    const result = await setWebhook(webhookUrl);
    logs.push(`🔗 Вебхук: ${webhookUrl}`);

    if (result.ok) {
      logs.push("✅ Вебхук установлен успешно");
    } else {
      logs.push(`❌ Ошибка вебхука: ${result.description || "неизвестная"}`);
    }

    // Устанавливаем кнопку меню
    try {
      const menuResult = await setMenuButton(APP_URL);
      if (menuResult.ok) {
        logs.push("✅ Кнопка меню установлена");
      }
    } catch {
      logs.push("ℹ️ Кнопка меню не установлена (можно настроить через BotFather)");
    }

    // Получаем информацию о вебхуке
    const info = await getWebhookInfo();

    return NextResponse.json({
      success: result.ok,
      message: result.ok
        ? "✅ Telegram бот подключён! Откройте бота в Telegram и напишите /start"
        : "❌ Ошибка: " + (result.description || "неизвестная"),
      logs,
      webhookInfo: info.ok ? info.result : null,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: "❌ Ошибка: " + (error?.message || String(error)),
        logs,
      },
      { status: 500 }
    );
  }
}
