// NLP-парсер для русского языка — извлекает даты, время, задачи и финансы
// Полностью бесплатный, работает без LLM

export type ParsedTask = {
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM
  text: string;
};

export type ParsedDeal = {
  date: string;
  category: string;
  saleAmount: number;
  purchaseAmount: number;
  workAmount: number;
  materialsAmount: number;
  notes?: string;
};

export type ParseResult = {
  type: "tasks" | "deals" | "unknown";
  tasks: ParsedTask[];
  deals: ParsedDeal[];
  rawText: string;
};

const MONTHS: Record<string, number> = {
  "январ": 1, "феврал": 2, "март": 3, "апрел": 4, "ма": 5, "июн": 6,
  "июл": 7, "август": 8, "сентябр": 9, "октябр": 10, "ноябр": 11, "декабр": 12,
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Кондиционер": ["кондиционер", "кондёр", "сплит", "сплит-систем", "фреон", "кронштейн"],
  "Окна": ["окно", "окон", "пвх", "стеклопакет", "фурнитур", "подоконник", "откос"],
  "Вентиляция": ["вентиляц", "приточк", "вытяжк", "воздуховод", "рекуператор"],
  "Бурение": ["бурен", "бур", "алмазн", "отверсти", "сверлен"],
};

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Извлекает дату из текста
export function extractDate(text: string, baseDate: Date = new Date()): string {
  const lower = text.toLowerCase();
  const today = new Date(baseDate);
  today.setHours(0, 0, 0, 0);

  // Относительные даты
  if (/(?:^|\s|,)завтра(?:,|\s|$)/.test(lower)) return formatDate(addDays(today, 1));
  if (/(?:^|\s|,)послезавтра(?:,|\s|$)/.test(lower)) return formatDate(addDays(today, 2));
  if (/(?:^|\s|,)вчера(?:,|\s|$)/.test(lower)) return formatDate(addDays(today, -1));
  if (/(?:^|\s|,)позавчера(?:,|\s|$)/.test(lower)) return formatDate(addDays(today, -2));
  if (/(?:^|\s|,)сегодня(?:,|\s|$)/.test(lower)) return formatDate(today);

  // День недели
  const weekdays: Record<string, number> = {
    "понедельник": 1, "вторник": 2, "сред": 3, "четверг": 4,
    "пятниц": 5, "суббот": 6, "воскресен": 0,
  };
  for (const [word, targetDay] of Object.entries(weekdays)) {
    if (lower.includes(word)) {
      const currentDay = today.getDay();
      let diff = targetDay - currentDay;
      if (diff <= 0) diff += 7;
      if (lower.includes("прошл")) diff -= 7;
      return formatDate(addDays(today, diff));
    }
  }

  // "22 июля" / "22 июля 2025"
  const dateMonthRegex = /(\d{1,2})\s+(январ|феврал|март|апрел|ма|июн|июл|август|сентябр|октябр|ноябр|декабр)[а-я]*/i;
  const dmMatch = lower.match(dateMonthRegex);
  if (dmMatch) {
    const day = parseInt(dmMatch[1]);
    const monthKey = dmMatch[2].toLowerCase();
    const month = MONTHS[monthKey];
    if (month && day >= 1 && day <= 31) {
      const year = today.getFullYear();
      let d = new Date(year, month - 1, day);
      if (d < today && !lower.includes("прошл")) {
        d = new Date(year + 1, month - 1, day);
      }
      return formatDate(d);
    }
  }

  // "22.07" или "22/07" или "22-07"
  const numericRegex = /(\d{1,2})[.\-\/](\d{1,2})(?:[.\-\/](\d{2,4}))?/;
  const numMatch = text.match(numericRegex);
  if (numMatch) {
    const day = parseInt(numMatch[1]);
    const month = parseInt(numMatch[2]);
    let year = numMatch[3] ? parseInt(numMatch[3]) : today.getFullYear();
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return formatDate(new Date(year, month - 1, day));
    }
  }

  return formatDate(today);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Извлекает время из текста
export function extractTime(text: string): string | null {
  const lower = text.toLowerCase();

  // "в 9:30 утра" / "в 9:30"
  const fullTimeRegex = /в\s+(\d{1,2})[:\s\.](\d{2})\s*(утра|вечера)?/i;
  const ftMatch = lower.match(fullTimeRegex);
  if (ftMatch) {
    let h = parseInt(ftMatch[1]);
    const m = parseInt(ftMatch[2]);
    if (ftMatch[3] === "вечера" && h < 12) h += 12;
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      return `${pad(h)}:${pad(m)}`;
    }
  }

  // "16:00" / "16.00"
  const colonMatch = text.match(/(\d{1,2})[:\\.](\d{2})/);
  if (colonMatch) {
    const h = parseInt(colonMatch[1]);
    const m = parseInt(colonMatch[2]);
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      return `${pad(h)}:${pad(m)}`;
    }
  }

  // "в 9 утра" / "в 9 вечера" / "к 12"
  const hourWordRegex = /(?:в|к|во|на)\s+(\d{1,2})(?:\s+(утра|вечера|дня|часов|часа|час))?/i;
  const hwMatch = lower.match(hourWordRegex);
  if (hwMatch) {
    let h = parseInt(hwMatch[1]);
    const period = hwMatch[2];
    if (period === "вечера" && h < 12) h += 12;
    if (period === "утра" && h === 12) h = 0;
    if (h >= 0 && h < 24) {
      return `${pad(h)}:00`;
    }
  }

  return null;
}

// Извлекает число (сумму) из текста. Поддерживает "30 тысяч", "17700", "5 тыс"
export function extractAmount(text: string): number {
  const lower = text.toLowerCase();

  // "30 тысяч" / "30 тыс" / "30 т"
  const thousandRegex = /(\d+(?:[.,]\d+)?)\s*(тысяч|тыс|т\b)/i;
  const tMatch = lower.match(thousandRegex);
  if (tMatch) {
    const num = parseFloat(tMatch[1].replace(",", "."));
    return Math.round(num * 1000);
  }

  // "30 к" — "к" может быть в конце "30к"
  const kRegex = /(\d+)\s*к\b/i;
  const kMatch = lower.match(kRegex);
  if (kMatch) {
    return parseInt(kMatch[1]) * 1000;
  }

  // "17700" — просто число
  const numMatch = text.match(/(\d{2,6}(?:\s?\d{3})*)/);
  if (numMatch) {
    return parseInt(numMatch[1].replace(/\s/g, ""));
  }

  return 0;
}

// Определяет категорию сделки
export function detectCategory(text: string): string {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return category;
    }
  }
  return "Объект";
}

// Главная функция парсинга
export function parseInput(input: string): ParseResult {
  const text = input.trim();
  const lower = text.toLowerCase();

  // Проверяем, финансовый ли это ввод
  const hasFinancialKeywords = /продал|купил|закуп|монтаж|продаж|марж|прибыл|объект|работа|материал|комплектац|расход/.test(lower);

  if (hasFinancialKeywords) {
    const deals = parseDeals(text);
    if (deals.length > 0) {
      return { type: "deals", tasks: [], deals, rawText: text };
    }
  }

  // Проверяем, есть ли задачи
  const tasks = parseTasks(text);
  if (tasks.length > 0) {
    return { type: "tasks", tasks, deals: [], rawText: text };
  }

  return { type: "unknown", tasks: [], deals: [], rawText: text };
}

// Парсит задачи из текста
function parseTasks(text: string): ParsedTask[] {
  const tasks: ParsedTask[] = [];
  const baseDate = new Date();

  // Разбиваем по разделителям: "потом", "затем", и запятым перед задачами с временем
  const parts = text
    .replace(/\s*(?:потом|затем|после этого|далее|ещё)\s*/gi, " | ")
    .replace(/,\s*(?=(?:в|к|на|за|с)\s+\d)/g, " | ")
    .split(/[|;]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 2);

  const finalParts = parts;

  for (const part of finalParts) {
    const date = extractDate(part, baseDate);
    const time = extractTime(part);

    // Очищаем текст от временных и датевых маркеров
    let cleanText = part
      .replace(/завтра|сегодня|послезавтра|вчера|позавчера/gi, "")
      .replace(/(?:^|\s)в\s+\d{1,2}[:\\.]?\d{0,2}\s*(утра|вечера|дня|часов|часа|час)?/gi, " ")
      .replace(/(?:^|\s)к\s+\d{1,2}/gi, " ")
      .replace(/(?:^|\s)на\s+\d{1,2}/gi, " ")
      .replace(/\d{1,2}[:\\.]\d{2}/g, "")
      .replace(/\d{1,2}\s+(январ|феврал|март|апрел|ма|июн|июл|август|сентябр|октябр|ноябр|декабр)[а-я]*/gi, "")
      .replace(/\d{1,2}[.\-\/]\d{1,2}(?:[.\-\/]\d{2,4})?/g, "")
      .replace(/[|;]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // Убираем лишние предлоги в начале
    cleanText = cleanText.replace(/^(в|во|на|к|с|со|и|,)\s+/i, "").trim();
    cleanText = cleanText.replace(/^[,;\s]+/, "").trim();

    // Капитализируем первую букву
    if (cleanText.length > 0) {
      cleanText = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);
    }

    if (cleanText.length > 1) {
      tasks.push({ date, time, text: cleanText });
    }
  }

  return tasks;
}

// ============================================================
// ИСПРАВЛЕННАЯ функция извлечения суммы по ключевому слову
// ============================================================

// Извлекает сумму из текста, ища число рядом с ключевым словом
function extractDealAmount(text: string, keywordRegex: RegExp): number {
  const lower = text.toLowerCase();

  // Клонируем regex, чтобы сбросить lastIndex
  const regex = new RegExp(keywordRegex.source, keywordRegex.flags + "g");
  
  let totalAmount = 0;
  let match;

  while ((match = regex.exec(lower)) !== null) {
    const keywordIndex = match.index;
    const keywordEnd = keywordIndex + match[0].length;
    
    // Смотрим текст после ключевого слова (до 100 символов)
    const afterKeyword = text.slice(keywordEnd, keywordEnd + 100);
    // И немного перед ключевым словом (на случай "за 40 продал")
    const beforeKeyword = text.slice(Math.max(0, keywordIndex - 40), keywordIndex);

    // Пробуем извлечь сумму из текста после ключевого слова
    const amountAfter = extractAmount(afterKeyword);
    if (amountAfter > 0) {
      totalAmount += amountAfter;
      // Пропускаем текст, чтобы не найти то же число повторно
      regex.lastIndex = keywordEnd + afterKeyword.length;
      continue;
    }

    // Если после не нашли, пробуем перед
    const amountBefore = extractAmount(beforeKeyword);
    if (amountBefore > 0) {
      totalAmount += amountBefore;
    }
  }

  return totalAmount;
}

// ============================================================
// Парсит финансовые сделки
// ============================================================
function parseDeals(text: string): ParsedDeal[] {
  const deals: ParsedDeal[] = [];
  const baseDate = new Date();
  const date = extractDate(text, baseDate);
  const category = detectCategory(text);

  // Разбиваем на отдельные сделки по "первый", "второй", etc.
  const dealMarkers = /(?:^|\s|[.]\s*)(первый|второй|третий|четвёртый|пятая|шестой|седьмой|восьмой)/gi;

  let dealTexts: string[] = [];

  if (dealMarkers.test(text)) {
    dealMarkers.lastIndex = 0;
    const parts = text.split(dealMarkers);
    for (let i = 2; i < parts.length; i += 2) {
      if (parts[i] && parts[i].trim().length > 3) {
        dealTexts.push(parts[i].trim());
      }
    }
    if (dealTexts.length === 0) {
      dealTexts = [text];
    }
  } else {
    dealTexts = [text];
  }

  for (const dealText of dealTexts) {
    const saleAmount = extractDealAmount(dealText, /прода[жл]|продаж|прода/);
    const purchaseAmount = extractDealAmount(dealText, /купил|закуп|закупил|купи/);
    const workAmount = extractDealAmount(dealText, /монтаж|работа|установк|оплат|монта/);
    const materialsAmount = extractDealAmount(
      dealText,
      /материал|комплектац|фреон|кронштейн|расход|расходк|расходн/
    );

    if (saleAmount > 0 || purchaseAmount > 0 || workAmount > 0 || materialsAmount > 0) {
      deals.push({
        date,
        category,
        saleAmount,
        purchaseAmount,
        workAmount,
        materialsAmount,
        notes: dealText.slice(0, 200),
      });
    }
  }

  return deals;
}

// Форматирует сумму в рублях
export function formatRub(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  return `${sign}${abs.toLocaleString("ru-RU")} ₽`;
}

// Форматирует дату на русском
export function formatDateRu(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

// Форматирует день недели
export function formatWeekdayRu(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
  return days[d.getDay()];
}

// Проверяет, является ли текст "добавкой" к существующей сделке (слова "ещё", "добавить", "дополнительно")
// Возвращает поле, к которому нужно добавить, и сумму
export type AdditionInfo = {
  type: "addition";
  addMaterialsAmount: number;
  addPurchaseAmount: number;
  addWorkAmount: number;
  rawText: string;
};

export function parseAddition(input: string): AdditionInfo | null {
  const text = input.trim().toLowerCase();

  // Проверяем маркеры добавления
  const isAddition = /\b(?:ещё|еще|добав|дополнительно|ещо|доп)\b/i.test(text);
  if (!isAddition) return null;

  // Проверяем финансовые ключевые слова
  const hasFinancial = /расход|материал|расходк|комплектац|фреон|кронштейн|закуп|купил|монтаж|работ/.test(text);
  if (!hasFinancial) return null;

  const addMaterialsAmount = extractDealAmount(text, /расход|материал|расходк|комплектац|фреон|кронштейн|расходн/);
  const addPurchaseAmount = extractDealAmount(text, /купил|закуп|закупил|купи/);
  const addWorkAmount = extractDealAmount(text, /монтаж|работа|установк|оплат|монта/);

  // Если нет ни одной суммы — это не добавка
  if (!addMaterialsAmount && !addPurchaseAmount && !addWorkAmount) return null;

  return {
    type: "addition",
    addMaterialsAmount,
    addPurchaseAmount,
    addWorkAmount,
    rawText: input,
  };
}

// Форматирует дату полностью: "22 июля 2025, вторник"
export function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  const days = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${days[d.getDay()]}`;
}
