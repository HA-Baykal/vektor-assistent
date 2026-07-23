import { NextResponse } from "next/server";
import { sendMessage } from "@/lib/telegram";
import { parseInput, parseAddition, formatRub, formatDateRu } from "@/lib/parser";
import { db } from "@/db";
import { allowedUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://vektor-assistent.vercel.app";

// Безопасная отправка — никогда не падает
const safeSend = async (chatId: number | string, text: string, parseMode: "HTML" | "Markdown" = "HTML") => {
  try {
    await sendMessage(chatId, text, parseMode);
  } catch {
    // Игнорируем — токен может быть не установлен на Vercel
  }
};

// ===== СИСТЕМА ДОСТУПА =====

// ID владельца — задаётся через переменную окружения или первый пользователь бота
let ownerChatId: number | null = null;
const OWNER_ID_ENV = process.env.TELEGRAM_OWNER_ID;

// Код доступа — генерируется владельцем
let accessCode: string = Math.random().toString(36).slice(2, 8).toUpperCase();

// Вспомогательные функции для работы с БД
async function getUserLevel(chatId: number): Promise<"owner" | "write" | "read" | null> {
  // Если владелец установлен через переменную окружения
  if (OWNER_ID_ENV && String(chatId) === OWNER_ID_ENV) return "owner";

  try {
    const [user] = await db
      .select()
      .from(allowedUsers)
      .where(eq(allowedUsers.chatId, String(chatId)));
    if (user) return user.accessLevel as "owner" | "write" | "read";
  } catch {
    // БД может быть недоступна — читаем
  }
  return null;
}

async function setUserAccess(chatId: number, level: "owner" | "write" | "read", userName: string = "") {
  try {
    await db.insert(allowedUsers)
      .values({
        chatId: String(chatId),
        userName,
        accessLevel: level,
      })
      .onConflictDoUpdate({
        target: allowedUsers.chatId,
        set: { accessLevel: level, userName },
      });
  } catch {
    // Если БД не отвечает — создаём таблицу
    try {
      await db.execute(sql`CREATE TABLE IF NOT EXISTS allowed_users (
        id SERIAL PRIMARY KEY,
        chat_id VARCHAR(100) NOT NULL UNIQUE,
        user_name VARCHAR(255) DEFAULT '',
        access_level VARCHAR(20) NOT NULL DEFAULT 'read',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )`);
      // Повторная попытка
      await db.insert(allowedUsers)
        .values({ chatId: String(chatId), userName, accessLevel: level })
        .onConflictDoUpdate({ target: allowedUsers.chatId, set: { accessLevel: level, userName } });
    } catch {
      // игнорируем
    }
  }
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

async function getLastDeal() {
  const res = await fetch(`${APP_URL}/api/deals`);
  if (!res.ok) return null;
  const deals = await res.json();
  return Array.isArray(deals) && deals.length > 0 ? deals[0] : null;
}

async function getDealByNumber(dealNumber: number) {
  const res = await fetch(`${APP_URL}/api/deals?dealNumber=${dealNumber}`);
  if (!res.ok) return null;
  const deals = await res.json();
  return Array.isArray(deals) && deals.length > 0 ? deals[0] : null;
}

async function createDeal(text: string) {
  const res = await fetch(`${APP_URL}/api/deals`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) return null;
  return res.json();
}

async function createTask(text: string) {
  const res = await fetch(`${APP_URL}/api/tasks`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) return null;
  return res.json();
}

async function addToDeal(dealId: number, addition: ReturnType<typeof parseAddition>) {
  if (!addition) return null;
  const res = await fetch(`${APP_URL}/api/deals`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
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

// ===== ОБРАБОТКА КОМАНД ВЛАДЕЛЬЦА =====

async function handleOwnerCommand(chatId: number, text: string, userName: string): Promise<boolean> {
  const lower = text.toLowerCase();

  // /code — показать код доступа
  if (lower === "/code" || lower === "/код") {
    await safeSend(chatId,
      `🔑 <b>Код доступа</b>\n\n` +
      `Текущий код: <code>${accessCode}</code>\n\n` +
      `Чтобы выдать доступ кому-то, скажите ему:\n` +
      `«Напишите боту: /access ${accessCode}»\n\n` +
      `Код меняется при каждом новом запуске.`
    );
    return true;
  }

  // /newcode — сгенерировать новый код
  if (lower === "/newcode" || lower === "/новыйкод") {
    accessCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    await safeSend(chatId,
      `🔑 <b>Новый код доступа</b>\n\n` +
      `Код: <code>${accessCode}</code>`
    );
    return true;
  }

  // /users — список пользователей
  if (lower === "/users" || lower === "/пользователи") {
    try {
      const users = await db.select().from(allowedUsers);
      if (users.length === 0) {
        await safeSend(chatId, `📭 Нет пользователей с доступом.`);
      } else {
        const list = users.map(u =>
          `• ${u.userName || "без имени"} (${u.chatId}) — <b>${u.accessLevel === "write" ? "✏️ запись" : u.accessLevel === "owner" ? "👑 владелец" : "👀 чтение"}</b>`
        ).join("\n");
        await safeSend(chatId, `👥 <b>Пользователи:</b>\n\n${list}`);
      }
    } catch {
      await safeSend(chatId, `❌ Ошибка при получении списка.`);
    }
    return true;
  }

  // /revoke <id> — отозвать доступ
  if (lower.startsWith("/revoke") || lower.startsWith("/отозвать")) {
    const id = text.split(" ")[1];
    if (!id) {
      await safeSend(chatId, `❌ Укажите chat_id: /revoke 123456789`);
      return true;
    }
    try {
      await db.delete(allowedUsers).where(eq(allowedUsers.chatId, id));
      await safeSend(chatId, `✅ Доступ отозван у пользователя ${id}`);
    } catch {
      await safeSend(chatId, `❌ Ошибка.`);
    }
    return true;
  }

  // /token — сгенерировать новый код доступа (постоянный)
  if (lower === "/token" || lower === "/токен") {
    try {
      const res = await fetch(`${APP_URL}/api/invite-codes/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) throw new Error("API error");
      const data = await res.json();

      await safeSend(chatId,
        `🔑 <b>Новый код доступа</b>\n\n` +
        `<code>${data.code}</code>\n\n` +
        `Этот код даёт постоянный доступ к веб-приложению.\n` +
        `Можно использовать с любого устройства.\n` +
        `Действует пока вы не отзовёте его.\n\n` +
        `Чтобы отозвать: /revokecode ${data.code}`
      );
    } catch {
      await safeSend(chatId, `❌ Ошибка при генерации кода.`);
    }
    return true;
  }

  // /codes — список всех кодов
  if (lower === "/codes" || lower === "/коды") {
    try {
      const res = await fetch(`${APP_URL}/api/invite-codes/list`);
      if (!res.ok) throw new Error("API error");
      const codes = await res.json();

      if (!codes || codes.length === 0) {
        await safeSend(chatId, `📭 Нет кодов доступа.\n\nСоздайте: /token`);
      } else {
        const list = codes.map((c: any) => {
          const status = c.active ? "✅ Активен" : "❌ Отозван";
          return `• <code>${c.code}</code> — ${status}`;
        }).join("\n");

        await safeSend(chatId,
          `🔑 <b>Коды доступа</b>\n\n${list}\n\n` +
          `Создать: /token\n` +
          `Отозвать: /revokecode КОД`
        );
      }
    } catch {
      await safeSend(chatId, `❌ Ошибка при получении списка.`);
    }
    return true;
  }

  // /revokecode <code> — отозвать код доступа
  if (lower.startsWith("/revokecode") || lower.startsWith("/отозватькод")) {
    const code = text.split(" ").slice(1).join(" ").trim().toUpperCase();
    if (!code) {
      await safeSend(chatId, `❌ Укажите код: /revokecode ABC123`);
      return true;
    }
    try {
      const res = await fetch(`${APP_URL}/api/invite-codes/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (res.ok) {
        await safeSend(chatId, `✅ Код ${code} отозван. Больше никто не сможет им воспользоваться.`);
      } else {
        await safeSend(chatId, `❌ Код ${code} не найден.`);
      }
    } catch {
      await safeSend(chatId, `❌ Ошибка.`);
    }
    return true;
  }

  return false;
}

// ===== ГЛАВНЫЙ ОБРАБОТЧИК =====

type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; first_name?: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
    date: number;
  };
};

export async function POST(request: Request) {
  // ВАЖНО: Всегда возвращаем 200, чтобы Telegram не дублировал сообщения
  // Даже если токен не настроен на Vercel — не падаем
  try {
    const update: TelegramUpdate = await request.json();
    const msg = update.message;

    if (!msg?.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const userName = msg.from?.first_name || msg.from?.username || "Пользователь";

    // Обёртка для sendMessage, которая никогда не падает
    const safeSend = async (id: number, txt: string, mode: "HTML" | "Markdown" = "HTML") => {
      try {
        await safeSend(id, txt, mode);
      } catch {
        // Игнорируем — токен может быть не на Vercel
      }
    };

    // ===== ПРОВЕРКА ДОСТУПА =====
    const userLevel = await getUserLevel(chatId);

    // Если пользователь не найден — проверяем, может это владелец по умолчанию
    if (!userLevel) {
      // Если владелец не установлен — первый пользователь становится владельцем
      if (!OWNER_ID_ENV && ownerChatId === null) {
        ownerChatId = chatId;
        await setUserAccess(chatId, "owner", userName);
        await safeSend(chatId,
          `👑 <b>Вы назначены владельцем!</b>\n\n` +
          `У вас полный доступ к управлению сделками и задачами.\n\n` +
          `📱 <a href="${APP_URL}">Открыть веб-приложение</a>\n\n` +
          `Напишите /help для списка команд.`
        );
        return NextResponse.json({ ok: true });
      }

      // Проверяем, не код ли доступа
      const lower = text.toLowerCase();
      if (lower.startsWith("/access") || lower.startsWith("/доступ")) {
        const code = text.split(" ").slice(1).join(" ").trim().toUpperCase();
        if (code === accessCode) {
          await setUserAccess(chatId, "write", userName);
          await safeSend(chatId,
            `✅ <b>Доступ предоставлен!</b>\n\n` +
            `Теперь вы можете создавать и редактировать сделки.\n\n` +
            `Напишите /help для списка команд.`
          );
        } else {
          await safeSend(chatId,
            `❌ <b>Неверный код доступа.</b>\n\n` +
            `Попросите владельца отправить вам новый код командой /code`
          );
        }
        return NextResponse.json({ ok: true });
      }

      // Незнакомец без доступа — только просмотр через команды
      if (text.startsWith("/")) {
        const cmd = text.split(" ")[0].toLowerCase();
        if (cmd === "/start") {
          await safeSend(chatId,
            `👋 <b>Вектор Ассистент</b>\n\n` +
            `Этот бот помогает вести учёт сделок и задач.\n\n` +
            `🔒 <b>У вас режим «только чтение»</b>\n` +
            `Вы можете просматривать сделки, но не редактировать.\n\n` +
            `📖 <b>Доступные команды:</b>\n` +
            `/last — последняя сделка\n` +
            `/deal 10 — сделка №10\n\n` +
            `🔑 Чтобы получить полный доступ, попросите код у владельца\n` +
            `и отправьте: /access ВАШ_КОД\n\n` +
            `📱 <a href="${APP_URL}">Открыть веб-приложение</a>`
          );
          return NextResponse.json({ ok: true });
        }
        if (cmd === "/last" || cmd === "/deal") {
          // Разрешаем просмотр
          if (cmd === "/last") {
            const lastDeal = await getLastDeal();
            if (lastDeal) {
              await safeSend(chatId, `👀 <b>Просмотр:</b>\n\n${formatDealInfo(lastDeal)}`);
            } else {
              await safeSend(chatId, "📭 Сделок пока нет.");
            }
          } else {
            const num = parseInt(text.split(" ")[1]);
            if (isNaN(num)) {
              await safeSend(chatId, "❌ Укажите номер: /deal 10");
            } else {
              const deal = await getDealByNumber(num);
              if (deal) {
                await safeSend(chatId, `👀 <b>Просмотр:</b>\n\n${formatDealInfo(deal)}`);
              } else {
                await safeSend(chatId, `❌ Сделка №${num} не найдена.`);
              }
            }
          }
          return NextResponse.json({ ok: true });
        }
        if (cmd === "/help") {
          await safeSend(chatId,
            `📖 <b>Команды для чтения:</b>\n\n` +
            `/last — последняя сделка\n` +
            `/deal № — сделка по номеру\n` +
            `/start — приветствие\n\n` +
            `🔒 <b>У вас режим «только чтение»</b>\n` +
            `Для полного доступа: /access ВАШ_КОД`
          );
          return NextResponse.json({ ok: true });
        }
        // Любая другая команда — игнорируем
        await safeSend(chatId,
          `🔒 <b>У вас режим «только чтение»</b>\n\n` +
          `Вы можете только просматривать сделки:\n` +
          `/last — последняя сделка\n` +
          `/deal № — сделка по номеру\n\n` +
          `Для полного доступа нужен код: /access ВАШ_КОД`
        );
        return NextResponse.json({ ok: true });
      }

      // Неизвестный пользователь пишет текст — игнорируем
      await safeSend(chatId,
        `🔒 <b>У вас нет доступа к редактированию.</b>\n\n` +
        `Чтобы получить доступ, нужен код от владельца.\n` +
        `Отправьте: /access ВАШ_КОД\n\n` +
        `Для просмотра сделок:\n` +
        `/last — последняя сделка\n` +
        `/deal № — сделка по номеру`
      );
      return NextResponse.json({ ok: true });
    }

    // ===== ДОСТУП ЕСТЬ =====
    const canWrite = userLevel === "owner" || userLevel === "write";
    const isOwner = userLevel === "owner";

    // Команды (доступны всем)
    if (text.startsWith("/")) {
      const cmd = text.split(" ")[0].toLowerCase();

      // Общие команды
      if (cmd === "/start" || cmd === "/help") {
        const ownerSection = isOwner ? [
          `👑 <b>Команды владельца:</b>`,
          `/code — показать код доступа`,
          `/newcode — новый код доступа`,
          `/users — список пользователей`,
          `/revoke ID — отозвать доступ`,
          `/token — одноразовый код для входа в веб-приложение`,
          `/tokens — список кодов`,
          `/revoketoken КОД — отозвать код`,
        ].join("\n") + "\n\n" : "";

        await safeSend(chatId,
          canWrite
            ? `🎯 <b>Как пользоваться ботом</b>\n\n` +
              `📝 <b>Новая сделка:</b>\n` +
              `«Продал кондиционер за 40 тысяч, купил за 30, монтаж 20, расходка 10»\n\n` +
              `➕ <b>Добавить к сделке:</b>\n` +
              `«Доход 10000 сделка 10»\n` +
              `«Номер 10 потратил ещё 2500»\n\n` +
              `✅ <b>Новая задача:</b>\n` +
              `«Завтра в 9 утра замер на Ленина 15»\n\n` +
              `📊 <b>Команды:</b>\n` +
              `/last — последняя сделка\n` +
              `/deal № — сделка по номеру\n` +
              `/help — помощь\n\n` +
              ownerSection +
              `📱 <a href="${APP_URL}">Веб-приложение</a>`
            : `📖 <b>Команды:</b>\n\n` +
              `/last — последняя сделка\n` +
              `/deal № — сделка по номеру\n` +
              `/help — помощь\n\n` +
              ownerSection +
              `📱 <a href="${APP_URL}">Веб-приложение</a>`
        );
        return NextResponse.json({ ok: true });
      }

      // Просмотр сделок (доступен всем)
      if (cmd === "/last") {
        const lastDeal = await getLastDeal();
        if (lastDeal) {
          await safeSend(chatId, formatDealInfo(lastDeal));
        } else {
          await safeSend(chatId, "📭 У вас пока нет сделок.");
        }
        return NextResponse.json({ ok: true });
      }

      if (cmd === "/deal") {
        const num = parseInt(text.split(" ")[1]);
        if (isNaN(num)) {
          await safeSend(chatId, "❌ Укажите номер: /deal 10");
        } else {
          const deal = await getDealByNumber(num);
          if (deal) {
            await safeSend(chatId, formatDealInfo(deal));
          } else {
            await safeSend(chatId, `❌ Сделка №${num} не найдена.`);
          }
        }
        return NextResponse.json({ ok: true });
      }

      // Команды владельца
      if (isOwner) {
        const handled = await handleOwnerCommand(chatId, text, userName);
        if (handled) return NextResponse.json({ ok: true });
      }

      // Неизвестная команда
      await safeSend(chatId, `❌ Неизвестная команда. Напишите /help`);
      return NextResponse.json({ ok: true });
    }

    // ===== ТЕКСТОВЫЕ СООБЩЕНИЯ =====
    // Если есть доступ на чтение, но нет на запись — блокируем
    if (!canWrite) {
      await safeSend(chatId,
        `🔒 <b>У вас режим «только чтение»</b>\n\n` +
        `Вы можете просматривать сделки:\n` +
        `/last — последняя сделка\n` +
        `/deal № — сделка по номеру`
      );
      return NextResponse.json({ ok: true });
    }

    // ===== ПОЛНЫЙ ДОСТУП: ОБРАБОТКА СООБЩЕНИЙ =====

    // Шаг 1: Проверяем добавку к сделке
    const addition = parseAddition(text);
    if (addition) {
      let targetDeal: any = null;

      if (addition.dealNumber) {
        targetDeal = await getDealByNumber(addition.dealNumber);
        if (!targetDeal) {
          await safeSend(chatId, `❌ Сделка №${addition.dealNumber} не найдена.`);
          return NextResponse.json({ ok: true });
        }
      } else {
        targetDeal = await getLastDeal();
        if (!targetDeal) {
          await safeSend(chatId, `❌ Нет сделок. Сначала создайте сделку.`);
          return NextResponse.json({ ok: true });
        }
      }

      const updated = await addToDeal(targetDeal.id, addition);
      if (!updated) {
        await safeSend(chatId, "❌ Ошибка при обновлении.");
        return NextResponse.json({ ok: true });
      }

      const labels: string[] = [];
      const emoji = addition.additionType === "income" ? "💰" : "💸";
      if (addition.addSaleAmount > 0) labels.push(`${formatRub(addition.addSaleAmount)} к продаже (доход)`);
      if (addition.addWorkAmount > 0) labels.push(`${formatRub(addition.addWorkAmount)} за работы (доход)`);
      if (addition.addMaterialsAmount > 0) labels.push(`${formatRub(addition.addMaterialsAmount)} на расходку (расход)`);
      if (addition.addPurchaseAmount > 0) labels.push(`${formatRub(addition.addPurchaseAmount)} на закупку (расход)`);

      await safeSend(chatId,
        `${emoji} <b>Сделка №${updated.dealNumber} • ${updated.category}</b>\n` +
        `${labels.join("\n")}\n\n` +
        `<b>💰 Маржа: ${updated.totalMargin >= 0 ? "+" : ""}${formatRub(updated.totalMargin)}</b>`
      );
      return NextResponse.json({ ok: true });
    }

    // Шаг 2: Новая сделка или задача
    const parsed = parseInput(text);
    if (parsed.type === "deals" && parsed.deals.length > 0) {
      const result = await createDeal(text);
      if (result?.deals) {
        const total = result.deals.reduce((s: number, d: any) => s + d.totalMargin, 0);
        const list = result.deals.map((d: any) =>
          `№${d.dealNumber} • ${d.category} • Маржа: ${d.totalMargin >= 0 ? "+" : ""}${formatRub(d.totalMargin)}`
        ).join("\n");
        await safeSend(chatId, `✅ <b>Создано ${result.deals.length} сделок(и)</b>\n\n${list}\n\n<b>💰 Итого маржа: ${formatRub(total)}</b>`);
      } else {
        await safeSend(chatId, "❌ Не удалось создать сделку.");
      }
    } else if (parsed.type === "tasks" && parsed.tasks.length > 0) {
      const result = await createTask(text);
      if (result?.tasks) {
        const list = result.tasks.map((t: any) => `${t.date} ${t.time || ""} — ${t.text}`).join("\n");
        await safeSend(chatId, `✅ <b>Создано ${result.tasks.length} задач(и)</b>\n\n${list}`);
      } else {
        await safeSend(chatId, "❌ Не удалось создать задачу.");
      }
    } else {
      await safeSend(chatId,
        `🤔 Не удалось распознать.\n\nПопробуйте:\n` +
        `• «Продал кондиционер за 40 тысяч, купил за 30»\n` +
        `• «Доход 10000 сделка 10»\n` +
        `• «Завтра в 9 утра замер на Ленина 15»\n` +
        `• /help — справка`
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json({ ok: false, error: String(error?.message || error) }, { status: 500 });
  }
}
