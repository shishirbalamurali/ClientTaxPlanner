import type { Borders, Fill, Font, Worksheet } from 'exceljs';

export const NAVY = 'FF1B3B5F';
export const NAVY_LIGHT = 'FFE7EDF4';
export const RULE = 'FFCFD5DC';
export const INK = 'FF111820';
export const MUTED = 'FF55616F';
export const FLAG = 'FF9B2C1F';
export const FLAG_WASH = 'FFFBEAE7';
export const WARN = 'FF8A5B12';
export const WARN_WASH = 'FFFBF3E4';
export const OK = 'FF1E5F45';
export const BAND = 'FFF7F8FA';

export const FMT = {
  currency: '_("$"* #,##0_);_("$"* (#,##0);_("$"* "—"_);_(@_)',
  currencyCents: '_("$"* #,##0.00_);_("$"* (#,##0.00);_("$"* "—"_);_(@_)',
  percent: '0.0%',
  percent2: '0.00%',
  integer: '#,##0',
  date: 'dd mmm yyyy',
} as const;

export const thinBorder: Partial<Borders> = {
  top: { style: 'hair', color: { argb: RULE } },
  left: { style: 'hair', color: { argb: RULE } },
  bottom: { style: 'hair', color: { argb: RULE } },
  right: { style: 'hair', color: { argb: RULE } },
};

export const headerFill: Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: NAVY },
};

export const bandFill: Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: BAND },
};

export const sectionFill: Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: NAVY_LIGHT },
};

export const headerFont: Partial<Font> = {
  name: 'Calibri',
  size: 9,
  bold: true,
  color: { argb: 'FFFFFFFF' },
};

export const bodyFont: Partial<Font> = { name: 'Calibri', size: 10, color: { argb: INK } };
export const mutedFont: Partial<Font> = { name: 'Calibri', size: 9, color: { argb: MUTED } };

/** Workbook title block: three merged rows carrying title, subtitle and the standing disclaimer. */
export function writeTitleBlock(
  sheet: Worksheet,
  lastColumn: string,
  title: string,
  subtitle: string,
): number {
  sheet.mergeCells(`A1:${lastColumn}1`);
  const titleCell = sheet.getCell('A1');
  titleCell.value = title;
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = headerFill;
  titleCell.alignment = { vertical: 'middle', indent: 1 };
  sheet.getRow(1).height = 26;

  sheet.mergeCells(`A2:${lastColumn}2`);
  const subtitleCell = sheet.getCell('A2');
  subtitleCell.value = subtitle;
  subtitleCell.font = { name: 'Calibri', size: 9.5, color: { argb: MUTED } };
  subtitleCell.alignment = { vertical: 'middle', indent: 1 };
  sheet.getRow(2).height = 16;

  sheet.mergeCells(`A3:${lastColumn}3`);
  const noticeCell = sheet.getCell('A3');
  noticeCell.value =
    'Educational model built on fictional client data. Not tax, legal or financial advice, and not tax preparation software.';
  noticeCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: WARN } };
  noticeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WARN_WASH } };
  noticeCell.alignment = { vertical: 'middle', indent: 1 };
  sheet.getRow(3).height = 16;

  return 5;
}

export function writeSectionHeading(sheet: Worksheet, row: number, lastColumn: string, text: string) {
  sheet.mergeCells(`A${row}:${lastColumn}${row}`);
  const cell = sheet.getCell(`A${row}`);
  cell.value = text.toUpperCase();
  cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: NAVY } };
  cell.fill = sectionFill;
  cell.alignment = { vertical: 'middle', indent: 1 };
  sheet.getRow(row).height = 18;
}

export function writeNote(sheet: Worksheet, row: number, lastColumn: string, text: string) {
  sheet.mergeCells(`A${row}:${lastColumn}${row}`);
  const cell = sheet.getCell(`A${row}`);
  cell.value = text;
  cell.font = mutedFont;
  cell.alignment = { vertical: 'top', wrapText: true, indent: 1 };
}

export interface ColumnSpec {
  header: string;
  width: number;
  format?: string;
  align?: 'left' | 'right' | 'center';
  wrap?: boolean;
}

export function writeTableHeader(sheet: Worksheet, row: number, columns: ColumnSpec[]) {
  columns.forEach((column, index) => {
    const cell = sheet.getCell(row, index + 1);
    cell.value = column.header;
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = {
      vertical: 'middle',
      horizontal: column.align ?? (column.format ? 'right' : 'left'),
      wrapText: true,
      indent: column.align === 'right' || column.format ? 0 : 1,
    };
    cell.border = thinBorder;
    sheet.getColumn(index + 1).width = column.width;
  });
  sheet.getRow(row).height = 24;
}

export function writeDataRow(
  sheet: Worksheet,
  row: number,
  columns: ColumnSpec[],
  values: Array<string | number | null | { text: string; hyperlink: string }>,
  options: { band?: boolean; bold?: boolean; topBorder?: boolean } = {},
) {
  columns.forEach((column, index) => {
    const cell = sheet.getCell(row, index + 1);
    const value = values[index];
    cell.value = value ?? null;
    cell.font = options.bold
      ? { ...bodyFont, bold: true }
      : typeof value === 'object' && value !== null
        ? { ...bodyFont, color: { argb: 'FF2F5C8A' }, underline: true }
        : bodyFont;
    if (column.format && typeof value === 'number') cell.numFmt = column.format;
    cell.alignment = {
      vertical: 'top',
      horizontal: column.align ?? (typeof value === 'number' ? 'right' : 'left'),
      wrapText: column.wrap ?? false,
      indent: column.align === 'right' || typeof value === 'number' ? 0 : 1,
    };
    cell.border = options.topBorder
      ? { ...thinBorder, top: { style: 'thin', color: { argb: NAVY } } }
      : thinBorder;
    if (options.band) cell.fill = bandFill;
  });
}

/** Two-column label/value block used for the summary metrics at the top of a sheet. */
export function writeMetricBlock(
  sheet: Worksheet,
  startRow: number,
  entries: Array<[string, string | number, string?]>,
): number {
  entries.forEach(([label, value, format], index) => {
    const row = startRow + index;
    const labelCell = sheet.getCell(row, 1);
    labelCell.value = label;
    labelCell.font = { ...bodyFont, bold: true };
    labelCell.alignment = { vertical: 'middle', indent: 1 };
    labelCell.border = thinBorder;
    labelCell.fill = bandFill;

    const valueCell = sheet.getCell(row, 2);
    valueCell.value = value;
    valueCell.font = bodyFont;
    if (format && typeof value === 'number') valueCell.numFmt = format;
    valueCell.alignment = { vertical: 'middle', horizontal: typeof value === 'number' ? 'right' : 'left', indent: typeof value === 'number' ? 0 : 1 };
    valueCell.border = thinBorder;
  });
  return startRow + entries.length + 1;
}

export function flagAboveZero(sheet: Worksheet, ref: string, priority = 1) {
  sheet.addConditionalFormatting({
    ref,
    rules: [
      {
        type: 'cellIs',
        operator: 'greaterThan',
        formulae: ['0'],
        priority,
        style: {
          font: { color: { argb: FLAG }, bold: true },
          fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: FLAG_WASH } },
        },
      },
    ],
  });
}

export function flagText(sheet: Worksheet, ref: string, text: string, priority = 1) {
  sheet.addConditionalFormatting({
    ref,
    rules: [
      {
        type: 'containsText',
        operator: 'containsText',
        text,
        priority,
        style: {
          font: { color: { argb: FLAG }, bold: true },
          fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: FLAG_WASH } },
        },
      },
    ],
  });
}

export function dataBars(sheet: Worksheet, ref: string, priority = 1) {
  sheet.addConditionalFormatting({
    ref,
    rules: [
      {
        type: 'dataBar',
        priority,
        minLength: 0,
        maxLength: 100,
        gradient: false,
        cfvo: [{ type: 'min' }, { type: 'max' }],
      },
    ],
  });
}

export function deltaScale(sheet: Worksheet, ref: string, priority = 1) {
  sheet.addConditionalFormatting({
    ref,
    rules: [
      {
        type: 'colorScale',
        priority,
        cfvo: [{ type: 'min' }, { type: 'num', value: 0 }, { type: 'max' }],
        color: [{ argb: 'FFE3F1E9' }, { argb: 'FFFFFFFF' }, { argb: 'FFFBEAE7' }],
      },
    ],
  });
}
