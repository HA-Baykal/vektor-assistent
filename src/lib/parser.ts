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

  if (/(?:^|\s|,)завтра(?:,|\s|$)/.test(lower)) return formatDate(addDays(today, 1));
  if (/(?:^|\s|,)послезавтра(?:,|\s|$)/.test(lower)) return formatDate(addDays(today, 2));
  if (/(?:^|\s|,)вчера(?:,|\s|$)/.test(lower)) return formatDate(addDays(today, -1));
  if (/(?:^|\s|,)позавчера(?:,|\s|$)/.test(lower)) return formatDate(addDays(today, -2));
  if (/(?:^|\s|,)сегодня(?:,|\s|$)/.test(lower)) return formatDate(today);

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

  const colonMatch = text.match(/(\d{1,2})[:\\.](\d{2})/);
  if (colonMatch) {
    const h = parseInt(colonMatch[1]);
    const m = parseInt(colonMatch[2]);
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      return `${pad(h)}:${pad(m)}`;
    }
  }

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

// Извлекает число (сумму) из текста
export function extractAmount(text: string): number {
  const lower = text.toLowerCase();

  // "30 тысяч" / "30 тыс"
  const thousandRegex = /(\d+(?:[.,]\d+)?)\s*(тысяч|тыс|т\b)/i;
  const tMatch = lower.match(thousandRegex);
  if (tMatch) {
    const num = parseFloat(tMatch[1].replace(",", "."));
    return Math.round(num * 1000);
  }

  // "30к"
  const kRegex = /(\d+)\s*к\b/i;
  const kMatch = lower.match(kRegex);
  if (kMatch) {
    return parseInt(kMatch[1]) * 1000;
  }

  // Просто число
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

  const hasFinancialKeywords = /продал|купил|закуп|монтаж|продаж|марж|прибыл|объект|работа|материал|комплектац|расход/.test(lower);

  if (hasFinancialKeywords) {
    const deals = parseDeals(text);
    if (deals.length > 0) {
      return { type: "deals", tasks: [], deals, rawText: text };
    }
  }

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

  const parts = text
    .replace(/\s*(?:потом|затем|после этого|далее|ещё)\s*/gi, " | ")
    .replace(/,\s*(?=(?:в|к|на|за|с)\s+\d)/g, " | ")
    .split(/[|;]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 2);

  for (const part of parts) {
    const date = extractDate(part, baseDate);
    const time = extractTime(part);

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

    cleanText = cleanText.replace(/^(в|во|на|к|с|со|и|,)\s+/i, "").trim();
    cleanText = cleanText.replace(/^[,;\s]+/, "").trim();

    if (cleanText.length > 0) {
      cleanText = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);
    }

    if (cleanText.length > 1) {
      tasks.push({ date, time, text: cleanText });
    }
  }

  return tasks;
}

// Извлекает сумму из текста, ища ЧИСЛО РЯДОМ с ключевым словом
function extractDealAmount(text: string, keywordRegex: RegExp): number {
  const lower = text.toLowerCase();
  const regex = new RegExp(keywordRegex.source, keywordRegex.flags + "g");
  
  let totalAmount = 0;
  let match;

  while ((match = regex.exec(lower)) !== null) {
    // Пропускаем, если ключевое слово — часть другого слова
    if (match.index > 0 && /[а-яёa-z]/.test(lower[match.index - 1])) continue;

    const keywordEnd = match.index + match[0].length;
    
    const afterKeyword = text.slice(keywordEnd, keywordEnd + 100);
    const beforeKeyword = text.slice(Math.max(0, match.index - 40), match.index);

    const amountAfter = extractAmount(afterKeyword);
    if (amountAfter > 0) {
      totalAmount += amountAfter;
      regex.lastIndex = keywordEnd + afterKeyword.length;
      continue;
    }

    const amountBefore = extractAmount(beforeKeyword);
    if (amountBefore > 0) {
      totalAmount += amountBefore;
    }
  }

  return totalAmount;
}

// Парсит финансовые сделки
function parseDeals(text: string): ParsedDeal[] {
  const deals: ParsedDeal[] = [];
  const baseDate = new Date();
  const date = extractDate(text, baseDate);
  const category = detectCategory(text);

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

// ============================================================
// ДОБАВЛЕНИЯ К СУЩЕСТВУЮЩИМ СДЕЛКАМ
// ============================================================

export type AdditionType = "expense" | "income";

export type AdditionInfo = {
  type: "addition";
  additionType: AdditionType;
  addSaleAmount: number;
  addWorkAmount: number;
  addMaterialsAmount: number;
  addPurchaseAmount: number;
  dealNumber?: number;
  rawText: string;
};

// Слова дохода — каждое слово проверяется через \b (граница слова)
const INCOME_WORDS = [
  "заработал", "заработали", "заработано",
  "добавил", "добавили", "добавлено",
  "получил", "получили", "получено",
  "пришло", "пришли", "поступило", "поступили",
  "доплата", "доплатили", "доплачено",
  "доплат",  // для "доплатили" и т.д.
  "навар", "прибыль",
  "подняли", "повысили", "увеличили",
  "взяли", "взял", "берём", "возьмём",
  "накинули", "накинем",
  "сверх", "сверху", "дополнительно",
  "плюс", "плюсом",
  "денег", "деньги",
  "доход", "дохода",
  "выручка",
  "аванс", "предоплата",
];

// Слова расхода
const EXPENSE_WORDS = [
  "потратил", "потратили", "потрачено", "потрач",
  "расход", "расходы", "расходка", "расходн",
  "затратил", "затратили", "затраты",
  "ушло", "ушли",
  "отдал", "отдали",
  "заплатил", "заплатили",
  "издержки",
  "сняли", "снял",
  "покупка", "купил", "купили", "закупил", "закупили", "закуп",
  "материал", "материалы", "комплектация", "комплектуха",
  "фреон", "кронштейн", "кронштейны",
  "товар", "товары",
];

const SALE_WORDS = ["продал", "продажа", "сдали", "сдать", "реализовали", "реализация"];

// Проверяет, что слово встречается как отдельное слово (не часть другого слова)
function isWordInText(text: string, word: string): boolean {
  const regex = new RegExp(`\\b${word.toLowerCase()}\\b`, 'i');
  return regex.test(text);
}

export function parseAddition(input: string): AdditionInfo | null {
  const text = input.trim().toLowerCase();
  if (!text) return null;

  // Извлекаем номер сделки
  const dealNumMatch = text.match(
    /(?:сделк[а-я]+\s*(?:№|#|номер|)?|объект\s*(?:№|#|номер|)?|номер[а-я]*\s*(?:№|#|)?|(?:№|#))\s*(\d+)/i
  );
  let dealNumber: number | undefined;
  if (dealNumMatch) {
    dealNumber = parseInt(dealNumMatch[1]);
  }

  // Проверяем слова с границами — каждое слово должно быть отдельным
  const hasIncomeWord = INCOME_WORDS.some(w => isWordInText(text, w));
  const hasExpenseWord = EXPENSE_WORDS.some(w => isWordInText(text, w));
  const hasSaleWord = SALE_WORDS.some(w => isWordInText(text, w));
  
  // Маркеры "ещё", "еще" тоже через границу
  const hasGenericMarker = /\b(?:ещё|еще|ещо|дополнительно)\b/i.test(text);
  
  // Есть ли число в тексте (от 2 цифр)
  const hasNumber = /\d{2,}/.test(text);

  // Если нет вообще никаких маркеров и номера — пропускаем
  if (!hasIncomeWord && !hasExpenseWord && !hasSaleWord && !hasGenericMarker && !dealNumber) return null;

  // Определяем тип: по умолчанию расход, если есть слово дохода — доход
  let additionType: AdditionType = "expense";
  if (hasIncomeWord || hasSaleWord) {
    additionType = "income";
  }

  // ===== Извлекаем суммы =====
  // ВАЖНО: без правого \b! Иначе "доплат" не найдёт "доплатили",
  // "взял" не найдёт "взяли", "расход" не найдёт "расходку" и т.д.
  // extractDealAmount сам проверяет левую границу (чтобы не было "перерасход")

  // Для дохода
  const addSaleAmount = extractDealAmount(text, /\b(?:прода[жл]|продаж|сдал|реализова|заработал|добавил|получил|пришл[ои]|поступил|взял[и]?|поднял|увеличил|накинул|доплат|прибыл|выручк|аванс)/);
  // Для работы
  const addWorkAmount = extractDealAmount(text, /\b(?:монтаж|работа|услуг)/);
  // Для расходов
  const addMaterialsAmount = extractDealAmount(text, /\b(?:расход|материал|расходк|расходн|комплектац|фреон|кронштейн|потратил|потрач|ушл[ои]|отдал|заплатил|снял|товар)/);
  // Для закупки
  const addPurchaseAmount = extractDealAmount(text, /\b(?:купил|купили|закуп|закупил|покупк)/);

  // Fallback: если не нашли ни одной суммы, но есть число — пробуем просто взять число из текста
  let fallbackAmount = 0;
  if (!addSaleAmount && !addPurchaseAmount && !addWorkAmount && !addMaterialsAmount) {
    const nums = text.match(/\d+/g);
    if (nums) {
      let candidates = nums.map(Number).filter(n => n > 0);
      if (dealNumber) candidates = candidates.filter(n => n !== dealNumber);
      
      if (candidates.length > 0) {
        // Берём первое подходящее число
        for (const c of candidates) {
          if (c >= 100) { fallbackAmount = c; break; }
        }
        if (!fallbackAmount && candidates.length > 0) {
          fallbackAmount = candidates[0] < 100 ? candidates[0] * 1000 : candidates[0];
        }
      }
      // Последняя попытка — первое число в тексте
      if (!fallbackAmount && nums.length > 0) {
        const n = parseInt(nums[0]);
        if (n > 0 && n !== dealNumber) {
          fallbackAmount = n < 100 ? n * 1000 : n;
        }
      }
    }
  }

  // Нет ни одной суммы — не добавка
  if (!addSaleAmount && !addPurchaseAmount && !addWorkAmount && !addMaterialsAmount && !fallbackAmount) {
    return null;
  }

  // Если это income, fallback идёт в продажу
  // Если это expense, fallback идёт в расходы
  const result: AdditionInfo = {
    type: "addition",
    additionType,
    addSaleAmount: addSaleAmount || (additionType === "income" && fallbackAmount ? fallbackAmount : 0),
    addWorkAmount: addWorkAmount || 0,
    addMaterialsAmount: addMaterialsAmount || (additionType === "expense" && !addPurchaseAmount ? fallbackAmount : 0),
    addPurchaseAmount: addPurchaseAmount || 0,
    dealNumber,
    rawText: input,
  };

  // Логируем для отладки
  console.log("parseAddition result:", JSON.stringify(result));

  return result;
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
