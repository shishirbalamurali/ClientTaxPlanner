import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { SAMPLE_CLIENTS, CORPORATE_EXECUTIVE } from '@/data/clients';
import { buildClientWorkbook } from '@/lib/excel/workbook';

const EXPECTED_SHEETS = [
  '01_Client_Profile',
  '02_Income_1040',
  '03_Gift_709',
  '04_Trust_1041',
  '05_Foreign_Accounts',
  '06_Scenario_Analysis',
  '07_Tax_Research',
  '08_Executive_Summary',
];

/** ExcelJS exposes this at runtime but does not declare it on the Worksheet type. */
function conditionalFormattingCount(sheet: ExcelJS.Worksheet): number {
  const { conditionalFormattings } = sheet as unknown as {
    conditionalFormattings?: unknown[];
  };
  return conditionalFormattings?.length ?? 0;
}

async function readWorkbook(buffer: ExcelJS.Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as ArrayBuffer);
  return workbook;
}

describe('client analysis workbook', () => {
  it('builds for every sample client', async () => {
    for (const client of SAMPLE_CLIENTS) {
      const buffer = await buildClientWorkbook(client);
      expect((buffer as ArrayBuffer).byteLength).toBeGreaterThan(10_000);
    }
  });

  it('contains the eight documented sheets in order', async () => {
    const workbook = await readWorkbook(await buildClientWorkbook(CORPORATE_EXECUTIVE));
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(EXPECTED_SHEETS);
  });

  it('carries the disclaimer on every sheet', async () => {
    const workbook = await readWorkbook(await buildClientWorkbook(CORPORATE_EXECUTIVE));
    for (const sheet of workbook.worksheets) {
      expect(String(sheet.getCell('A3').value), sheet.name).toContain('Not tax, legal or financial advice');
    }
  });

  it('names the client in the subtitle of every sheet', async () => {
    const workbook = await readWorkbook(await buildClientWorkbook(CORPORATE_EXECUTIVE));
    for (const sheet of workbook.worksheets) {
      expect(String(sheet.getCell('A2').value), sheet.name).toContain(
        CORPORATE_EXECUTIVE.displayName,
      );
    }
  });

  it('freezes the title block on every sheet', async () => {
    const workbook = await readWorkbook(await buildClientWorkbook(CORPORATE_EXECUTIVE));
    for (const sheet of workbook.worksheets) {
      expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 4 });
    }
  });

  it('applies conditional formatting on the analysis sheets', async () => {
    const workbook = await readWorkbook(await buildClientWorkbook(CORPORATE_EXECUTIVE));
    const withFormatting = workbook.worksheets.filter(
      (sheet) => conditionalFormattingCount(sheet) > 0,
    );
    expect(withFormatting.length).toBeGreaterThanOrEqual(6);
  });

  it('applies currency and percentage number formats', async () => {
    const workbook = await readWorkbook(await buildClientWorkbook(CORPORATE_EXECUTIVE));
    const income = workbook.getWorksheet('02_Income_1040')!;
    const formats = new Set<string>();
    income.eachRow((row) => {
      row.eachCell((cell) => {
        if (cell.numFmt) formats.add(cell.numFmt);
      });
    });

    expect([...formats].some((format) => format.includes('"$"'))).toBe(true);
    expect([...formats].some((format) => format.includes('%'))).toBe(true);
  });

  it('hyperlinks each source in the research sheet', async () => {
    const workbook = await readWorkbook(await buildClientWorkbook(CORPORATE_EXECUTIVE));
    const research = workbook.getWorksheet('07_Tax_Research')!;
    let hyperlinks = 0;
    research.eachRow((row) => {
      row.eachCell((cell) => {
        const value = cell.value;
        if (value && typeof value === 'object' && 'hyperlink' in value) hyperlinks += 1;
      });
    });
    expect(hyperlinks).toBeGreaterThan(20);
  });

  it('writes an assumptions section where the model is applied', async () => {
    const workbook = await readWorkbook(await buildClientWorkbook(CORPORATE_EXECUTIVE));
    const sheetsWithAssumptions = workbook.worksheets.filter((sheet) => {
      let found = false;
      sheet.eachRow((row) => {
        const first = String(row.getCell(1).value ?? '');
        if (first.includes('ASSUMPTIONS AND LIMITATIONS')) found = true;
      });
      return found;
    });
    expect(sheetsWithAssumptions.map((sheet) => sheet.name)).toEqual(
      expect.arrayContaining(['02_Income_1040', '03_Gift_709', '05_Foreign_Accounts', '07_Tax_Research']),
    );
  });

  it('reports the gift totals that the analysis produced', async () => {
    const workbook = await readWorkbook(await buildClientWorkbook(CORPORATE_EXECUTIVE));
    const gifts = workbook.getWorksheet('03_Gift_709')!;
    const labels: Record<string, unknown> = {};
    gifts.eachRow((row) => {
      const key = String(row.getCell(1).value ?? '');
      if (key) labels[key] ??= row.getCell(2).value;
    });

    expect(labels['Annual exclusion per donee']).toBe(19_000);
    expect(labels['Basic exclusion amount']).toBe(13_990_000);
  });

  it('handles a client with no trusts and no foreign accounts', async () => {
    const bare = {
      ...CORPORATE_EXECUTIVE,
      id: 'bare-client',
      trusts: [],
      foreignAccounts: [],
      foreignEntities: [],
      gifts: [],
    };
    const workbook = await readWorkbook(await buildClientWorkbook(bare));
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(EXPECTED_SHEETS);
  });
});
