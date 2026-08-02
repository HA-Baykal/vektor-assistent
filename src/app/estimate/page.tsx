"use client";

import { useState } from "react";
import { formatRub } from "@/lib/parser";

type MainWork = {
  id: string;
  name: string;
  qty: number;
  priceWork: number;
  priceMaterial: number;
};

type Conditioner = {
  id: string;
  name: string;
  price: number;
  link?: string;
};

type ExtraWork = {
  id: string;
  name: string;
  price: number;
};

const uid = () => Math.random().toString(36).slice(2, 9);

export default function EstimatePage() {
  // Header
  const [estimateNumber, setEstimateNumber] = useState("687075");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  // Standard montage toggle - IMPORTANT FIX
  const [includeStandard, setIncludeStandard] = useState(false);
  const [tractLength, setTractLength] = useState(4);
  const [complexity, setComplexity] = useState("Стандартный");
  const [hasCableChannel, setHasCableChannel] = useState(false);
  const [standardPrice, setStandardPrice] = useState(18000);

  // Main works
  const [mainWorks, setMainWorks] = useState<MainWork[]>([
    { id: uid(), name: "Штробление стены", qty: 9, priceWork: 2400, priceMaterial: 800 },
  ]);

  // Conditioners
  const [conditioners, setConditioners] = useState<Conditioner[]>([
    { id: uid(), name: "Midea MSAG1-09N8C2S-I/MSAG1-09N8C2S-O", price: 34000, link: "https://daichi.business/catalog/konditsionirovanie/bytovye_konditsionery/komplekty/MSAG1_09N8C2S_I_MSAG1_09N8C2S_O/" },
  ]);

  // Extra
  const [extras, setExtras] = useState<ExtraWork[]>([]);

  // Payment split
  const [prepay, setPrepay] = useState<number>(0);

  // Helpers
  const calcWork = (w: MainWork) => ({
    labor: w.qty * w.priceWork,
    material: w.qty * w.priceMaterial,
    total: w.qty * (w.priceWork + w.priceMaterial),
  });

  const totals = (() => {
    const workLabor = mainWorks.reduce((s, w) => s + w.qty * w.priceWork, 0);
    const workMaterial = mainWorks.reduce((s, w) => s + w.qty * w.priceMaterial, 0);
    const workTotal = workLabor + workMaterial;
    const equipTotal = conditioners.reduce((s, c) => s + c.price, 0);
    const extraTotal = extras.reduce((s, e) => s + e.price, 0);
    const standardTotal = includeStandard ? standardPrice : 0;
    const grand = workTotal + equipTotal + extraTotal + standardTotal;
    return { workLabor, workMaterial, workTotal, equipTotal, extraTotal, standardTotal, grand };
  })();

  const remaining = Math.max(0, totals.grand - prepay);

  // --- EXPORT EXCEL (FIXED) ---
  const exportExcel = async () => {
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Смета");

    ws.columns = [
      { header: "№", key: "num", width: 6 },
      { header: "Наименование работ / материалов", key: "name", width: 55 },
      { header: "Кол-во", key: "qty", width: 10 },
      { header: "Ед. изм.", key: "unit", width: 10 },
      { header: "Цена за ед., Р", key: "price", width: 16 },
      { header: "Сумма, Р", key: "sum", width: 16 },
    ];

    // Row 1 - Header contacts FIXED: remove +7999... add +7914 first
    ws.mergeCells("A1:F1");
    const r1 = ws.getCell("A1");
    r1.value = "ИП Сергеева М.В. | Монтаж кондиционеров | +7(914)914-66-06 | +7(908)640-11-66";
    r1.font = { size: 9, color: { argb: "FF64748B" } };
    r1.alignment = { horizontal: "center" };

    // Row 2 - Title
    ws.mergeCells("A2:F2");
    const r2 = ws.getCell("A2");
    r2.value = `СМЕТА № ${estimateNumber} НА МОНТАЖ КОНДИЦИОНЕРА`;
    r2.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
    r2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
    r2.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(2).height = 28;

    // Row 3 - Info
    ws.mergeCells("A3:F3");
    const infoParts = [
      `Оборудование: ${conditioners.length ? conditioners.map(c => c.name).join(", ").slice(0, 60) : "Другие виды работ"}`,
      `Дата: ${date.split("-").reverse().join(".")}`,
    ];
    if (includeStandard) infoParts.push(`Трасса: ${tractLength} м`);
    ws.getCell("A3").value = infoParts.join(" | ");
    ws.getCell("A3").font = { size: 9, italic: true };
    ws.getCell("A3").alignment = { horizontal: "center" };

    // Row 4 - table header
    const headerRow = ws.getRow(4);
    headerRow.values = ["№", "Наименование работ / материалов", "Кол-во", "Ед. изм.", "Цена за ед., Р", "Сумма, Р"];
    headerRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });
    headerRow.height = 28;

    let rowIdx = 5;
    let counter = 1;

    // EQUIPMENT SECTION
    if (conditioners.length > 0) {
      ws.mergeCells(`A${rowIdx}:F${rowIdx}`);
      const catRow = ws.getRow(rowIdx);
      catRow.getCell(1).value = "";
      catRow.getCell(2).value = "ОБОРУДОВАНИЕ";
      catRow.getCell(2).font = { bold: true, color: { argb: "FF1E40AF" } };
      catRow.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
      rowIdx++;

      for (const c of conditioners) {
        const r = ws.getRow(rowIdx);
        r.values = [counter++, c.name, 1, "шт", c.price, c.price];
        r.eachCell((cell) => {
          cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
        });
        r.getCell(5).numFmt = '#,##0 ₽';
        r.getCell(6).numFmt = '#,##0 ₽';
        rowIdx++;
      }
    }

    // WORKS SECTION
    if (mainWorks.length > 0 || includeStandard) {
      ws.mergeCells(`A${rowIdx}:F${rowIdx}`);
      const catRow = ws.getRow(rowIdx);
      catRow.getCell(2).value = "МОНТАЖНЫЕ РАБОТЫ И МАТЕРИАЛЫ";
      catRow.getCell(2).font = { bold: true, color: { argb: "FF065F46" } };
      catRow.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
      rowIdx++;

      if (includeStandard) {
        const r = ws.getRow(rowIdx);
        r.values = [
          counter++,
          `Стандартный монтаж (трасса до 5 м) (${tractLength}м) - ${complexity}${hasCableChannel ? " + кабель-канал" : ""}`,
          1,
          "компл",
          standardPrice,
          standardPrice
        ];
        r.eachCell((cell) => {
          cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
        });
        r.getCell(5).numFmt = '#,##0 ₽';
        r.getCell(6).numFmt = '#,##0 ₽';
        rowIdx++;
      }

      for (const w of mainWorks) {
        const { labor, material, total } = calcWork(w);
        // One consolidated line as requested but with breakdown in name
        const r = ws.getRow(rowIdx);
        r.values = [
          counter++,
          `${w.name} ${w.qty}м (работа ${w.priceWork}₽/м + материал ${w.priceMaterial}₽/м) — работа ${formatRub(labor)}, материал ${formatRub(material)}`,
          w.qty,
          "м",
          w.priceWork + w.priceMaterial,
          total
        ];
        r.eachCell((cell) => {
          cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
          cell.alignment = { wrapText: true };
        });
        r.getCell(5).numFmt = '#,##0 ₽';
        r.getCell(6).numFmt = '#,##0 ₽';
        rowIdx++;
      }
    }

    // EXTRA
    if (extras.length > 0) {
      ws.mergeCells(`A${rowIdx}:F${rowIdx}`);
      const catRow = ws.getRow(rowIdx);
      catRow.getCell(2).value = "ДОПОЛНИТЕЛЬНЫЕ РАБОТЫ";
      catRow.getCell(2).font = { bold: true };
      catRow.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
      rowIdx++;
      for (const e of extras) {
        const r = ws.getRow(rowIdx);
        r.values = [counter++, e.name, 1, "усл", e.price, e.price];
        r.eachCell((cell) => {
          cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
        });
        r.getCell(5).numFmt = '#,##0 ₽';
        r.getCell(6).numFmt = '#,##0 ₽';
        rowIdx++;
      }
    }

    // Totals
    ws.getRow(rowIdx).values = ["", "", "", "", "Итого оборудование:", totals.equipTotal];
    ws.getRow(rowIdx).getCell(5).font = { bold: true };
    ws.getRow(rowIdx).getCell(6).font = { bold: true };
    ws.getRow(rowIdx).getCell(6).numFmt = '#,##0 ₽';
    rowIdx++;

    ws.getRow(rowIdx).values = ["", "", "", "", "Итого монтажные работы:", totals.workTotal + totals.standardTotal];
    ws.getRow(rowIdx).getCell(5).font = { bold: true };
    ws.getRow(rowIdx).getCell(6).font = { bold: true };
    ws.getRow(rowIdx).getCell(6).numFmt = '#,##0 ₽';
    rowIdx++;

    if (totals.extraTotal > 0) {
      ws.getRow(rowIdx).values = ["", "", "", "", "Итого дополнительно:", totals.extraTotal];
      ws.getRow(rowIdx).getCell(5).font = { bold: true };
      ws.getRow(rowIdx).getCell(6).font = { bold: true };
      ws.getRow(rowIdx).getCell(6).numFmt = '#,##0 ₽';
      rowIdx++;
    }

    // Grand total yellow
    const grandRow = ws.getRow(rowIdx);
    ws.mergeCells(`A${rowIdx}:E${rowIdx}`);
    grandRow.getCell(1).value = "";
    grandRow.getCell(5).value = "ИТОГО К ОПЛАТЕ:";
    grandRow.getCell(5).font = { bold: true, size: 12 };
    grandRow.getCell(5).alignment = { horizontal: "right" };
    grandRow.getCell(6).value = totals.grand;
    grandRow.getCell(6).font = { bold: true, color: { argb: "FF1E3A8A" }, size: 12 };
    grandRow.getCell(6).numFmt = '#,##0 ₽';
    grandRow.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF08A" } };
      c.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });
    grandRow.height = 28;
    rowIdx++;

    // Payment split info
    const payRow = ws.getRow(rowIdx);
    ws.mergeCells(`A${rowIdx}:F${rowIdx}`);
    payRow.getCell(1).value = `Аванс: ${formatRub(prepay)} | После выполнения работ: ${formatRub(remaining)}`;
    payRow.getCell(1).font = { italic: true, size: 10 };
    rowIdx++;

    // Executor - FIXED to Chebanov
    rowIdx++;
    const execRow = ws.getRow(rowIdx);
    ws.mergeCells(`A${rowIdx}:F${rowIdx}`);
    execRow.getCell(1).value = `Исполнитель работ: Чебанов Дмитрий Юрьевич +7(914)914-66-06 | Заказчик: ${customerName || "_________________"} | Адрес: ${customerAddress || "_________________"}`;
    execRow.getCell(1).font = { size: 9 };

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Smeta-${estimateNumber}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportDocx = async () => {
    const { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, AlignmentType, TextRun, ShadingType } = await import("docx");

    const rows: any[] = [];

    // Header
    const headerCell = (text: string, bold = true) => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text, bold, size: 20, color: "FFFFFF" })], alignment: AlignmentType.CENTER })],
      shading: { type: ShadingType.SOLID, color: "2563EB" },
      width: { size: 16, type: WidthType.PERCENTAGE },
    });

    // Title rows
    const titleTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              columnSpan: 6,
              children: [new Paragraph({ text: "ИП Сергеева М.В. | Монтаж кондиционеров | +7(914)914-66-06 | +7(908)640-11-66", alignment: AlignmentType.CENTER })],
            })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({
              columnSpan: 6,
              children: [new Paragraph({ children: [new TextRun({ text: `СМЕТА № ${estimateNumber} НА МОНТАЖ КОНДИЦИОНЕРА`, bold: true, size: 24, color: "FFFFFF" })], alignment: AlignmentType.CENTER })],
              shading: { type: ShadingType.SOLID, color: "1E3A8A" },
            })
          ]
        }),
        new TableRow({
          children: [
            new TableCell({
              columnSpan: 6,
              children: [new Paragraph({ text: `Оборудование: ${conditioners.map(c=>c.name).join(", ").slice(0,80) || "Другие виды работ"} | Дата: ${date.split("-").reverse().join(".")} ${includeStandard ? `| Трасса: ${tractLength} м` : ""}`, alignment: AlignmentType.CENTER })],
            })
          ]
        }),
        new TableRow({
          children: [
            headerCell("№"),
            headerCell("Наименование"),
            headerCell("Кол-во"),
            headerCell("Ед."),
            headerCell("Цена"),
            headerCell("Сумма"),
          ]
        }),
      ]
    });

    const dataRows: any[] = [];
    let idx = 1;

    // Equipment
    if (conditioners.length) {
      dataRows.push(new TableRow({
        children: [
          new TableCell({ columnSpan: 6, children: [new Paragraph({ children: [new TextRun({ text: "ОБОРУДОВАНИЕ", bold: true })] })], shading: { type: ShadingType.SOLID, color: "DBEAFE" } }),
        ]
      }));
      for (const c of conditioners) {
        dataRows.push(new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(`${idx++}`)] }),
            new TableCell({ children: [new Paragraph(c.name)] }),
            new TableCell({ children: [new Paragraph("1")] }),
            new TableCell({ children: [new Paragraph("шт")] }),
            new TableCell({ children: [new Paragraph(formatRub(c.price))] }),
            new TableCell({ children: [new Paragraph(formatRub(c.price))] }),
          ]
        }));
      }
    }

    if (mainWorks.length || includeStandard) {
      dataRows.push(new TableRow({
        children: [
          new TableCell({ columnSpan: 6, children: [new Paragraph({ children: [new TextRun({ text: "МОНТАЖНЫЕ РАБОТЫ И МАТЕРИАЛЫ", bold: true })] })], shading: { type: ShadingType.SOLID, color: "D1FAE5" } }),
        ]
      }));
      if (includeStandard) {
        dataRows.push(new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(`${idx++}`)] }),
            new TableCell({ children: [new Paragraph(`Стандартный монтаж (трасса до 5 м) (${tractLength}м) - ${complexity}${hasCableChannel ? " + кабель-канал" : ""}`)] }),
            new TableCell({ children: [new Paragraph("1")] }),
            new TableCell({ children: [new Paragraph("компл")] }),
            new TableCell({ children: [new Paragraph(formatRub(standardPrice))] }),
            new TableCell({ children: [new Paragraph(formatRub(standardPrice))] }),
          ]
        }));
      }
      for (const w of mainWorks) {
        const { labor, material, total } = calcWork(w);
        dataRows.push(new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(`${idx++}`)] }),
            new TableCell({ children: [new Paragraph(`${w.name} ${w.qty}м (работа ${w.priceWork}₽/м + материал ${w.priceMaterial}₽/м)`) ] }),
            new TableCell({ children: [new Paragraph(`${w.qty}`)] }),
            new TableCell({ children: [new Paragraph("м")] }),
            new TableCell({ children: [new Paragraph(formatRub(w.priceWork + w.priceMaterial))] }),
            new TableCell({ children: [new Paragraph(formatRub(total))] }),
          ]
        }));
      }
    }

    // Extras
    if (extras.length) {
      for (const e of extras) {
        dataRows.push(new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(`${idx++}`)] }),
            new TableCell({ children: [new Paragraph(e.name)] }),
            new TableCell({ children: [new Paragraph("1")] }),
            new TableCell({ children: [new Paragraph("усл")] }),
            new TableCell({ children: [new Paragraph(formatRub(e.price))] }),
            new TableCell({ children: [new Paragraph(formatRub(e.price))] }),
          ]
        }));
      }
    }

    // Grand total
    dataRows.push(new TableRow({
      children: [
        new TableCell({ columnSpan: 5, children: [new Paragraph({ children: [new TextRun({ text: "ИТОГО К ОПЛАТЕ:", bold: true })], alignment: AlignmentType.RIGHT })], shading: { type: ShadingType.SOLID, color: "FEF08A" } }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatRub(totals.grand), bold: true })] })], shading: { type: ShadingType.SOLID, color: "FEF08A" } }),
      ]
    }));

    // Payment
    dataRows.push(new TableRow({
      children: [
        new TableCell({ columnSpan: 6, children: [new Paragraph(`Аванс: ${formatRub(prepay)} | После работ: ${formatRub(remaining)} | Исполнитель: Чебанов Дмитрий Юрьевич +7(914)914-66-06`)] }),
      ]
    }));

    const doc = new Document({
      sections: [{
        children: [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [...(titleTable as any).root, ...dataRows],
          }) as any
        ]
      }]
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Smeta-${estimateNumber}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportContract = async () => {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import("docx");

    const paragraphs: any[] = [];

    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: `ДОГОВОР № ${estimateNumber}`, bold: true, size: 28 })],
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1
    }));
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: `на оказание услуг по поставке кондиционера и выполнению монтажных работ`, size: 22 })],
      alignment: AlignmentType.CENTER
    }));
    paragraphs.push(new Paragraph({ text: "" }));
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: `г. Иркутск\t\t${date.split("-").reverse().join(".")} г.`, size: 20 })]
    }));
    paragraphs.push(new Paragraph({ text: "" }));

    paragraphs.push(new Paragraph({
      children: [
        new TextRun({ text: "Исполнитель: ", bold: true }),
        new TextRun({ text: "ИП Сергеева М.В. в лице Чебанова Дмитрия Юрьевича, тел. +7(914)914-66-06, +7(908)640-11-66, ", size: 20 }),
        new TextRun({ text: "с одной стороны, и Заказчик: ", bold: true }),
        new TextRun({ text: `${customerName || "____________________"}, проживающий по адресу: ${customerAddress || "____________________"}, с другой стороны, заключили настоящий договор о нижеследующем:`, size: 20 })
      ]
    }));
    paragraphs.push(new Paragraph({ text: "" }));
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: "1. Предмет договора", bold: true, size: 22 })] }));
    paragraphs.push(new Paragraph({
      children: [new TextRun({ text: `1.1. Исполнитель обязуется поставить следующее оборудование:`, size: 20 })]
    }));
    for (const c of conditioners) {
      paragraphs.push(new Paragraph({ text: `— ${c.name} — ${formatRub(c.price)}`, bullet: { level: 0 } }));
    }
    if (conditioners.length === 0) paragraphs.push(new Paragraph({ text: "— оборудование не поставляется в рамках других видов работ", bullet: { level: 0 } }));

    paragraphs.push(new Paragraph({ children: [new TextRun({ text: "1.2. Выполнить следующие виды работ:", size: 20 })] }));
    if (includeStandard) {
      paragraphs.push(new Paragraph({ text: `— Стандартный монтаж кондиционера, трасса ${tractLength} м, сложность: ${complexity}${hasCableChannel ? ", с кабель-каналом" : ""} — ${formatRub(standardPrice)}`, bullet: { level: 0 } }));
    }
    for (const w of mainWorks) {
      const { labor, material, total } = calcWork(w);
      paragraphs.push(new Paragraph({
        text: `— ${w.name}: ${w.qty} м × (работа ${w.priceWork}₽ + материал ${w.priceMaterial}₽) = работа ${formatRub(labor)} + материал ${formatRub(material)} = ${formatRub(total)}`,
        bullet: { level: 0 }
      }));
    }
    for (const e of extras) {
      paragraphs.push(new Paragraph({ text: `— ${e.name} — ${formatRub(e.price)}`, bullet: { level: 0 } }));
    }

    paragraphs.push(new Paragraph({ text: "" }));
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: "2. Стоимость и порядок расчетов", bold: true, size: 22 })] }));
    paragraphs.push(new Paragraph({ text: `2.1. Общая стоимость по договору составляет ${formatRub(totals.grand)} (в т.ч. оборудование ${formatRub(totals.equipTotal)}, работы ${formatRub(totals.workTotal + totals.standardTotal)}, доп. ${formatRub(totals.extraTotal)}).` }));
    paragraphs.push(new Paragraph({ text: `2.2. Заказчик вносит аванс в размере ${formatRub(prepay)} при подписании договора.` }));
    paragraphs.push(new Paragraph({ text: `2.3. Окончательный расчет в размере ${formatRub(remaining)} производится после выполнения работ и подписания акта.` }));
    paragraphs.push(new Paragraph({ text: "2.4. Способ оплаты: наличными или перечислением. При оплате по счету удерживается налог 6% с дохода." }));
    paragraphs.push(new Paragraph({ text: "" }));
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: "3. Сроки и ответственность", bold: true })] }));
    paragraphs.push(new Paragraph({ text: "3.1. Работы выполняются в согласованный срок после внесения аванса и поставки оборудования." }));
    paragraphs.push(new Paragraph({ text: "3.2. Гарантия на монтажные работы — 12 месяцев, на оборудование — по гарантии производителя." }));
    paragraphs.push(new Paragraph({ text: "" }));
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: "4. Реквизиты и подписи", bold: true })] }));
    paragraphs.push(new Paragraph({ text: `Исполнитель: Чебанов Дмитрий Юрьевич +7(914)914-66-06\nИП Сергеева М.В. | Монтаж кондиционеров | +7(914)914-66-06 | +7(908)640-11-66\n\nЗаказчик: ${customerName || "____________________"} /_________________/\nАдрес: ${customerAddress || "____________________"}\n\nАванс: ${formatRub(prepay)} | Остаток: ${formatRub(remaining)} | Всего: ${formatRub(totals.grand)}` }));

    const doc = new Document({ sections: [{ children: paragraphs }] });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Dogovor-${estimateNumber}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🔨 Другие виды работ — Смета</h1>
          <p className="text-sm text-slate-500">Ручной расчет: штробление, укладка трассы, любые работы с ценой за метр и материалами</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportExcel} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Excel</button>
          <button onClick={exportDocx} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">DOCX</button>
          <button onClick={exportContract} className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">Договор</button>
          <button onClick={() => window.print()} className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white">Печать</button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <input value={estimateNumber} onChange={e => setEstimateNumber(e.target.value)} placeholder="№ сметы" className="rounded-xl border px-4 py-2 text-sm" />
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-xl border px-4 py-2 text-sm" />
        <div className="text-sm font-bold bg-yellow-100 rounded-xl px-4 py-2 flex items-center">{formatRub(totals.grand)} К оплате</div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="ФИО Заказчика" className="rounded-xl border px-4 py-2.5 text-sm" />
        <input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="Адрес объекта" className="rounded-xl border px-4 py-2.5 text-sm" />
      </div>

      {/* Standard montage toggle - FIX */}
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={includeStandard} onChange={e => setIncludeStandard(e.target.checked)} className="h-5 w-5" />
          <span className="font-semibold">Включить стандартный монтаж?</span>
        </label>
        {includeStandard && (
          <div className="mt-3 grid md:grid-cols-4 gap-3">
            <input type="number" value={tractLength} onChange={e => setTractLength(parseInt(e.target.value) || 0)} placeholder="Длина трассы м" className="rounded-xl border px-3 py-2 text-sm" />
            <select value={complexity} onChange={e => setComplexity(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
              <option>Стандартный</option>
              <option>Сложный</option>
              <option>Эконом</option>
            </select>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hasCableChannel} onChange={e => setHasCableChannel(e.target.checked)} /> Кабель-канал</label>
            <input type="number" value={standardPrice} onChange={e => setStandardPrice(parseInt(e.target.value) || 0)} placeholder="Цена монтажа" className="rounded-xl border px-3 py-2 text-sm" />
          </div>
        )}
      </div>

      {/* Main works */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold">🔧 Основные работы (штробление, укладка трассы и т.д.)</h3>
          <button onClick={() => setMainWorks([...mainWorks, { id: uid(), name: "Новая работа", qty: 1, priceWork: 0, priceMaterial: 0 }])} className="text-sm bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg">Добавить работу</button>
        </div>
        <div className="space-y-4">
          {mainWorks.map((w) => {
            const c = calcWork(w);
            return (
              <div key={w.id} className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                <div className="flex justify-between">
                  <input value={w.name} onChange={e => setMainWorks(mainWorks.map(x => x.id === w.id ? { ...x, name: e.target.value } : x))} className="font-medium bg-transparent border-b flex-1 mr-4" />
                  <button onClick={() => setMainWorks(mainWorks.filter(x => x.id !== w.id))} className="text-red-400">✕</button>
                </div>
                <div className="grid md:grid-cols-3 gap-3 mt-3">
                  <div>
                    <label className="text-[11px] text-slate-500">Количество (м)</label>
                    <input type="number" value={w.qty} onChange={e => setMainWorks(mainWorks.map(x => x.id === w.id ? { ...x, qty: parseFloat(e.target.value) || 0 } : x))} className="w-full rounded-lg border px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500">Цена за метр работы (₽)</label>
                    <input type="number" value={w.priceWork} onChange={e => setMainWorks(mainWorks.map(x => x.id === w.id ? { ...x, priceWork: parseFloat(e.target.value) || 0 } : x))} className="w-full rounded-lg border px-3 py-2 text-sm" />
                    <p className="text-xs text-slate-600 mt-1">Работа: {formatRub(c.labor)}</p>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500">Цена за метр материала (₽)</label>
                    <input type="number" value={w.priceMaterial} onChange={e => setMainWorks(mainWorks.map(x => x.id === w.id ? { ...x, priceMaterial: parseFloat(e.target.value) || 0 } : x))} className="w-full rounded-lg border px-3 py-2 text-sm" />
                    <p className="text-xs text-slate-600 mt-1">Материал: {formatRub(c.material)}</p>
                  </div>
                </div>
                <div className="mt-2 text-sm font-bold">Итого {formatRub(c.total)} <span className="text-xs font-normal text-slate-500">{w.qty}м × ({w.priceWork}+{w.priceMaterial})</span></div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm">
          Итого по основным работам:<br />
          Работа: {formatRub(totals.workLabor)} + Материал: {formatRub(totals.workMaterial)} = <b>{formatRub(totals.workTotal)}</b>
        </div>
      </div>

      {/* Conditioners */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold">❄️ Продажа кондиционеров (без монтажа - штробление и укладка уже учтены как работа)</h3>
          <button onClick={() => setConditioners([...conditioners, { id: uid(), name: "Новый кондиционер", price: 0 }])} className="text-sm bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg">Добавить кондиционер</button>
        </div>
        {conditioners.map((c) => (
          <div key={c.id} className="flex gap-2 mb-2">
            <input value={c.name} onChange={e => setConditioners(conditioners.map(x => x.id === c.id ? { ...x, name: e.target.value } : x))} placeholder="Название кондиционера" className="flex-1 rounded-lg border px-3 py-2 text-sm" />
            <input type="number" value={c.price} onChange={e => setConditioners(conditioners.map(x => x.id === c.id ? { ...x, price: parseInt(e.target.value) || 0 } : x))} placeholder="Цена" className="w-32 rounded-lg border px-3 py-2 text-sm" />
            <button onClick={() => setConditioners(conditioners.filter(x => x.id !== c.id))} className="text-red-400">✕</button>
          </div>
        ))}
        <div className="mt-2 text-sm">Итого продажа кондиционеров: <b>{formatRub(totals.equipTotal)}</b></div>
      </div>

      {/* Extras */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold">📝 Дополнительные пожелания (вручную с ценой)</h3>
          <button onClick={() => setExtras([...extras, { id: uid(), name: "", price: 0 }])} className="text-sm bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg">Добавить</button>
        </div>
        {extras.length === 0 && <p className="text-xs text-slate-400">Нет дополнительных пожеланий.</p>}
        {extras.map((e) => (
          <div key={e.id} className="flex gap-2 mb-2">
            <input value={e.name} onChange={ev => setExtras(extras.map(x => x.id === e.id ? { ...x, name: ev.target.value } : x))} placeholder="Описание" className="flex-1 rounded-lg border px-3 py-2 text-sm" />
            <input type="number" value={e.price} onChange={ev => setExtras(extras.map(x => x.id === e.id ? { ...x, price: parseInt(ev.target.value) || 0 } : x))} className="w-32 rounded-lg border px-3 py-2 text-sm" />
            <button onClick={() => setExtras(extras.filter(x => x.id !== e.id))} className="text-red-400">✕</button>
          </div>
        ))}
      </div>

      {/* Grand total */}
      <div className="rounded-2xl bg-slate-900 text-white p-5">
        <p className="text-sm">Итоговая смета по другим видам работ:</p>
        <p className="text-xs opacity-70">Работа: {formatRub(totals.workLabor)} + Материал: {formatRub(totals.workMaterial)} + Оборудование: {formatRub(totals.equipTotal)} + Доп: {formatRub(totals.extraTotal)} {totals.standardTotal ? `+ Стандарт: ${formatRub(totals.standardTotal)}` : ""}</p>
        <p className="text-2xl font-black mt-2">{formatRub(totals.grand)} К оплате</p>
        <div className="mt-4 grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs opacity-70">Вносит сразу (аванс)</label>
            <input type="number" value={prepay} onChange={e => setPrepay(parseInt(e.target.value) || 0)} className="w-full mt-1 rounded-xl bg-white/10 border border-white/20 px-4 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="text-xs opacity-70">После выполненных работ</label>
            <div className="mt-1 rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm font-bold">{formatRub(remaining)}</div>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-2xl border bg-white p-4 overflow-auto">
        <p className="text-[11px] text-slate-500 text-center">ИП Сергеева М.В. | Монтаж кондиционеров | +7(914)914-66-06 | +7(908)640-11-66</p>
        <p className="text-center font-bold bg-blue-900 text-white py-2 mt-1">СМЕТА № {estimateNumber} НА МОНТАЖ КОНДИЦИОНЕРА</p>
        <p className="text-center text-[11px] italic">Оборудование: {conditioners.map(c=>c.name).join(", ") || "Другие виды работ"} | Дата: {date.split("-").reverse().join(".")} {includeStandard ? `| Трасса: ${tractLength} м` : ""}</p>
        <table className="w-full text-xs mt-2 border-collapse">
          <thead>
            <tr className="bg-blue-600 text-white">
              <th className="border p-1">№</th><th className="border p-1">Наименование</th><th className="border p-1">Кол-во</th><th className="border p-1">Ед.</th><th className="border p-1">Цена</th><th className="border p-1">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {includeStandard && (
              <tr><td className="border p-1">1</td><td className="border p-1">Стандартный монтаж (трасса до 5 м) ({tractLength}м)</td><td className="border p-1">1</td><td className="border p-1">компл</td><td className="border p-1">{formatRub(standardPrice)}</td><td className="border p-1">{formatRub(standardPrice)}</td></tr>
            )}
            {mainWorks.map((w,i) => {
              const { total } = calcWork(w);
              return <tr key={w.id}><td className="border p-1">{(includeStandard ? 2 : 1) + i}</td><td className="border p-1">{w.name} {w.qty}м (работа {w.priceWork}₽/м + материал {w.priceMaterial}₽/м)</td><td className="border p-1">{w.qty}</td><td className="border p-1">м</td><td className="border p-1">{formatRub(w.priceWork + w.priceMaterial)}</td><td className="border p-1">{formatRub(total)}</td></tr>
            })}
            {conditioners.map((c,i) => (
              <tr key={c.id}><td className="border p-1">{(includeStandard ? 1 : 0) + mainWorks.length + 1 + i}</td><td className="border p-1">{c.name}</td><td className="border p-1">1</td><td className="border p-1">шт</td><td className="border p-1">{formatRub(c.price)}</td><td className="border p-1">{formatRub(c.price)}</td></tr>
            ))}
            <tr className="bg-yellow-200 font-bold"><td colSpan={5} className="border p-1 text-right">ИТОГО К ОПЛАТЕ:</td><td className="border p-1">{formatRub(totals.grand)}</td></tr>
          </tbody>
        </table>
        <p className="text-[10px] mt-2">Исполнитель: Чебанов Дмитрий Юрьевич +7(914)914-66-06 | Заказчик: {customerName} | Адрес: {customerAddress}</p>
        <p className="text-[10px]">Аванс: {formatRub(prepay)} | После работ: {formatRub(remaining)}</p>
      </div>
    </div>
  );
}
