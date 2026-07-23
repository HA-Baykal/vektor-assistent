import { NextResponse } from "next/server";
import { sendMessage } from "@/lib/telegram";
import { parseInput, parseAddition, formatRub, formatDateRu } from "@/lib/parser";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // Максимум 30 секунд на обработку

// URL нашего сайта (устанавливается через переменную окружения или autodetect)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://vektor-assistent.vercel.app";

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; first_name?: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
    date: number;
  };
  callback_query?: any;
};

// Получает последнюю сделку из БД
async function getLastDeal() {
  const res = await fetch(`${APP_URL}/api/deals`);
  if (!res.ok) return null;
  const deals = await res.json();
  return Array.isArray(deals) && deals.length > 0 ? deals[0] : null;
}

// Получает сделку по номеру
async function getDealByNumber(dealNumber: number) {
  const res = await fetch(`${APP_URL}/api/deals?dealNumber=${dealNumber}`);
  if (!res.ok) return null;
  const deals = await res.json();
  return Array.isArray(deals) && deals.length > 0 ? deals[0] : null;
}

// Создаёт новую сделку через API
async function createDeal(text: string) {
  const res = await fetch(`${APP_URL}/api/deals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) return null;
  return res.json();
}

// Создаёт новую задачу через API
async function createTask(text: string) {
  const res = await fetch(`${APP_URL}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) return null;
  return res.json();
}

// Добавляет к существующей сделке через PATCH
async function addToDeal(dealId: number, addition: ReturnType<typeof parseAddition>) {
  if (!addition) return null;
  const res = await fetch(`${APP_URL}/api/deals`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: dealId,
      addSaleAmount: addition.addSaleAmount,
      addWorkAmount: addition.addWorkAmount,
      addMaterialsAmount: addition.addMaterialsAmount,
      addPurchaseAmount: addition.addPurchaseAmount,
    }),
  });
  if (!res.ok) return null;
  return res.json();
}

// Форматирует информацию о сделке
function formatDealInfo(deal: any): string {
  return [
    `🏷️ <b>Сделка №${deal.dealNumber} • ${deal.category}</b>`,
    `📅 ${formatDateRu(deal.date)}`,
    ``,
    `💰 Продажа: <b>${formatRub(deal.saleAmount)}</b>`,
    `📦 Закупка: <b>${formatRub(deal.purchaseAmount)}</b>`,
    `🔧 Монтаж: <b>${formatRub(deal.workAmount)}</b>`,
    `📎 Расход: <b>${formatRub(deal.materialsAmount)}</b>`,
    ``,
    `📊 <b>Маржа: ${deal.totalMargin >= 0 ? "+" : ""}${formatRub(deal.totalMargin)}</b>`,
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const update: TelegramUpdate = await request.json();
    const msg = update.message;

    // Если нет текстового сообщения — игнорируем
    if (!msg?.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const userName = msg.from?.first_name || "Пользователь";

    // Команды
    if (text.startsWith("/")) {
      switch (text.split(" ")[0].toLowerCase()) {
        case "/start":
          await sendMessage(chatId,
            `👋 <b>Привет, ${userName}!</b>\n\n` +
            `Я — <b>Вектор Ассистент</b>. Помогаю предпринимателям учитывать сделки и задачи голосом.\n\n` +
            `📱 <a href="${APP_URL}">Открыть веб-приложение</a>\n\n` +
            `🎯 <b>Что я умею:</b>\n\n` +
            `📝 <b>Создать сделку:</b>\n` +
            `«Продал кондиционер за 40 тысяч, купил за 30, монтаж 20, расходка 10»\n\n` +
            `➕ <b>Добавить к сделке:</b>\n` +
            `«Доход 10000 сделка 10»\n` +
            `«Потратил ещё 2500 номер 10»\n` +
            `«Доплатили 5000 сделка 34»\n\n` +
            `✅ <b>Создать задачу:</b>\n` +
            `«Завтра в 9 утра замер на Ленина 15»\n\n` +
            `📊 <b>Команды:</b>\n` +
            `/last — последняя сделка\n` +
            `/deal 10 — сделка №10\n` +
            `/help — помощь`
          );
          break;

        case "/help":
          await sendMessage(chatId,
            `🎯 <b>Как пользоваться ботом</b>\n\n` +
            `📝 <b>Новая сделка:</b>\n` +
            `Просто напишите: «Продал кондиционер за 40 тысяч, купил за 30»\n\n` +
            `➕ <b>Добавить к сделке:</b>\n` +
            `Напишите: «Доход 10000 сделка 10» или «Номер 10 потратил ещё 2500»\n\n` +
            `✅ <b>Новая задача:</b>\n` +
            `«Завтра в 9 утра замер на Ленина 15»\n\n` +
            `📊 <b>Команды:</b>\n` +
            `/last — моя последняя сделка\n` +
            `/deal <номер> — сделка по номеру\n` +
            `/start — приветствие\n\n` +
            `📱 <a href="${APP_URL}">Открыть веб-приложение</a>`
          );
          break;

        case "/last":
          const lastDeal = await getLastDeal();
          if (lastDeal) {
            await sendMessage(chatId, formatDealInfo(lastDeal));
          } else {
            await sendMessage(chatId, "📭 У вас пока нет сделок.");
          }
          break;

        case "/deal":
          const num = parseInt(text.split(" ")[1]);
          if (isNaN(num)) {
            await sendMessage(chatId, "❌ Укажите номер сделки: /deal 10");
          } else {
            const deal = await getDealByNumber(num);
            if (deal) {
              await sendMessage(chatId, formatDealInfo(deal));
            } else {
              await sendMessage(chatId, `❌ Сделка №${num} не найдена.`);
            }
          }
          break;

        default:
          await sendMessage(chatId, `❌ Неизвестная команда. Напишите /help`);
      }
      return NextResponse.json({ ok: true });
    }

    // ===== Обработка текстовых сообщений =====

    // Шаг 1: Проверяем, не "добавка" ли это к существующей сделке
    const addition = parseAddition(text);

    if (addition) {
      let targetDeal: any = null;

      if (addition.dealNumber) {
        // Ищем по номеру
        targetDeal = await getDealByNumber(addition.dealNumber);
        if (!targetDeal) {
          await sendMessage(chatId, `❌ Сделка №${addition.dealNumber} не найдена. Проверьте номер.`);
          return NextResponse.json({ ok: true });
        }
      } else {
        // Берём последнюю
        targetDeal = await getLastDeal();
        if (!targetDeal) {
          await sendMessage(chatId, `❌ У вас пока нет сделок. Сначала создайте сделку.`);
          return NextResponse.json({ ok: true });
        }
      }

      const updated = await addToDeal(targetDeal.id, addition);
      if (!updated) {
        await sendMessage(chatId, "❌ Ошибка при обновлении сделки.");
        return NextResponse.json({ ok: true });
      }

      // Составляем красивый ответ
      const labels: string[] = [];
      const emoji = addition.additionType === "income" ? "💰" : "💸";
      const typeLabel = addition.additionType === "income" ? "доход" : "расход";
      if (addition.addSaleAmount > 0) labels.push(`${formatRub(addition.addSaleAmount)} к продаже (${typeLabel})`);
      if (addition.addWorkAmount > 0) labels.push(`${formatRub(addition.addWorkAmount)} за работы (${typeLabel})`);
      if (addition.addMaterialsAmount > 0) labels.push(`${formatRub(addition.addMaterialsAmount)} на расходку (${typeLabel})`);
      if (addition.addPurchaseAmount > 0) labels.push(`${formatRub(addition.addPurchaseAmount)} на закупку (${typeLabel})`);

      await sendMessage(chatId,
        `${emoji} <b>Сделка №${updated.dealNumber} • ${updated.category}</b>\n` +
        `${labels.join("\n")}\n\n` +
        `<b>💰 Маржа: ${updated.totalMargin >= 0 ? "+" : ""}${formatRub(updated.totalMargin)}</b>`
      );
      return NextResponse.json({ ok: true });
    }

    // Шаг 2: Пробуем распарсить как сделку или задачу
    const parsed = parseInput(text);

    if (parsed.type === "deals" && parsed.deals.length > 0) {
      const result = await createDeal(text);
      if (result?.deals) {
        const total = result.deals.reduce((s: number, d: any) => s + d.totalMargin, 0);
        const dealsList = result.deals.map((d: any) =>
          `№${d.dealNumber} • ${d.category} • Маржа: ${d.totalMargin >= 0 ? "+" : ""}${formatRub(d.totalMargin)}`
        ).join("\n");

        await sendMessage(chatId,
          `✅ <b>Создано ${result.deals.length} сделок(и)</b>\n\n${dealsList}\n\n<b>💰 Итого маржа: ${formatRub(total)}</b>`
        );
      } else {
        await sendMessage(chatId, "❌ Не удалось создать сделку. Попробуйте иначе.");
      }
    } else if (parsed.type === "tasks" && parsed.tasks.length > 0) {
      const result = await createTask(text);
      if (result?.tasks) {
        const tasksList = result.tasks.map((t: any) =>
          `${t.date} ${t.time || ""} — ${t.text}`
        ).join("\n");

        await sendMessage(chatId, `✅ <b>Создано ${result.tasks.length} задач(и)</b>\n\n${tasksList}`);
      } else {
        await sendMessage(chatId, "❌ Не удалось создать задачу. Попробуйте иначе.");
      }
    } else {
      // Не удалось распознать
      await sendMessage(chatId,
        `🤔 Не удалось распознать.\n\n` +
        `Попробуйте:\n` +
        `• «Продал кондиционер за 40 тысяч, купил за 30»\n` +
        `• «Доход 10000 сделка 10»\n` +
        `• «Завтра в 9 утра замер на Ленина 15»\n` +
        `• /help — полная справка`
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json({ ok: false, error: String(error?.message || error) }, { status: 500 });
  }
}
