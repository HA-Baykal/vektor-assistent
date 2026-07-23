// Простая библиотека для работы с Telegram Bot API
// Использует обычный fetch, без дополнительных пакетов

const TELEGRAM_API = "https://api.telegram.org";

function getToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set");
  return token;
}

// Отправляет сообщение в Telegram
export async function sendMessage(chatId: number | string, text: string, parseMode: "HTML" | "Markdown" = "HTML") {
  const token = getToken();
  const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
    }),
  });
  return res.json();
}

// Устанавливает вебхук
export async function setWebhook(url: string) {
  const token = getToken();
  const res = await fetch(`${TELEGRAM_API}/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  return res.json();
}

// Удаляет вебхук
export async function deleteWebhook() {
  const token = getToken();
  const res = await fetch(`${TELEGRAM_API}/bot${token}/deleteWebhook`, {
    method: "POST",
  });
  return res.json();
}

// Получает информацию о вебхуке
export async function getWebhookInfo() {
  const token = getToken();
  const res = await fetch(`${TELEGRAM_API}/bot${token}/getWebhookInfo`);
  return res.json();
}

// Устанавливает кнопку меню (Web App)
export async function setMenuButton(url: string, text: string = "Открыть ассистента") {
  const token = getToken();
  const res = await fetch(`${TELEGRAM_API}/bot${token}/setChatMenuButton`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      menu_button: {
        type: "web_app",
        text,
        web_app: { url },
      },
    }),
  });
  return res.json();
}
