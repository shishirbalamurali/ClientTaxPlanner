import ExcelJS from 'exceljs';
import { buildExecutiveSummary } from '@/lib/analysis/executive-summary';
import { MODEL_LIMITATIONS } from '@/lib/analysis/federal-model';
import {
  DEFAULT_SCENARIO_PARAMETERS,
  SCENARIO_ROWS,
  buildScenarios,
} from '@/lib/analysis/scenarios';
import { computeNetWorth } from '@/lib/analysis/executive-summary';
import {
  FILING_STATUS_LABELS,
  FOREIGN_ACCOUNT_TYPE_LABELS,
  FOREIGN_ENTITY_LABELS,
  FOREIGN_INTEREST_LABELS,
  GIFT_ASSET_LABELS,
  TRUST_KIND_LABELS,
} from '@/lib/labels';
import { AUTHORITIES } from '@/lib/research/authorities';
import { MODULE_LABELS, RULE_CATALOG, evaluateClient, SEVERITY_LABELS } from '@/lib/rules';
import { getTaxYear } from '@/lib/tax-year';
import type { Client } from '@/lib/types';
import {
  FMT,
  type ColumnSpec,
  dataBars,
  deltaScale,
  flagAboveZero,
  flagText,
  writeDataRow,
  writeMetricBlock,
  writeNote,
  writeSectionHeading,
  writeTableHeader,
  writeTitleBlock,
} from './styles';

const COLUMN_LETTER = (index: number) => String.fromCharCode(64 + index);

function newSheet(workbook: ExcelJS.Workbook, name: string, freezeRow: number) {
  return workbook.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: freezeRow, showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
}

/**
 * Builds the client analysis workbook. Sheet order and naming follow the
 * deliverable convention used elsewhere in the project: a leading ordinal so the
 * tabs stay in reading order regardless of how a reader sorts them.
 */
export async function buildClientWorkbook(client: Client): Promise<ExcelJS.Buffer> {
  const constants = getTaxYear(client.taxYear);
  const evaluation = evaluateClient(client, constants);
  const { federal, gifts, trusts, foreign, findings } = evaluation;
  const summary = buildExecutiveSummary(client);
  const comparison = buildScenarios(client, constants, DEFAULT_SCENARIO_PARAMETERS);
  const preparedOn = new Date().toISOString().slice(0, 10);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Private Client Tax Planning Simulator';
  workbook.company = 'Educational portfolio project';
  workbook.created = new Date();
  workbook.description = `Modeled ${constants.year} analysis for the fictional client ${client.displayName}. Not tax, legal or financial advice.`;

  const subtitle = `${client.displayName} · ${client.archetypeLabel} · ${client.engagementRef} · ${constants.label} · prepared ${preparedOn}`;

  buildClientProfileSheet(workbook, client, subtitle);
  buildIncomeSheet(workbook, client, subtitle, constants);
  buildGiftSheet(workbook, client, subtitle, gifts, constants);
  buildTrustSheet(workbook, client, subtitle, trusts, constants);
  buildForeignSheet(workbook, client, subtitle, foreign, constants);
  buildScenarioSheet(workbook, subtitle, comparison);
  buildResearchSheet(workbook, subtitle, constants, findings);
  buildExecutiveSheet(workbook, subtitle, summary, evaluation);

  return workbook.xlsx.writeBuffer();

  // ---------------------------------------------------------------- sheets

  function buildClientProfileSheet(wb: ExcelJS.Workbook, c: Client, sub: string) {
    const sheet = newSheet(wb, '01_Client_Profile', 4);
    const columns: ColumnSpec[] = [
      { header: 'Item', width: 34 },
      { header: 'Value', width: 30 },
      { header: 'Detail', width: 58, wrap: true },
      { header: 'Amount', width: 16, format: FMT.currency },
      { header: 'Basis', width: 16, format: FMT.currency },
    ];
    let row = writeTitleBlock(sheet, 'E', '01 · Client Profile', sub);

    writeSectionHeading(sheet, row, 'E', 'Summary metrics');
    row += 1;
    row = writeMetricBlock(sheet, row, [
      ['Total modeled income', federal.income.totalModeledIncome, FMT.currency],
      ['Modeled net worth', computeNetWorth(c), FMT.currency],
      ['Modeled federal tax', federal.totalFederalTax, FMT.currency],
      ['Effective federal rate', federal.effectiveRateOnModeledIncome, FMT.percent2],
      ['Review items raised', evaluation.reviewCount, FMT.integer],
    ]);

    writeSectionHeading(sheet, row, 'E', 'Household');
    row += 1;
    writeTableHeader(sheet, row, columns);
    row += 1;
    const household: Array<[string, string, string, number | null]> = [
      ['Client', c.displayName, `${c.occupation}, ${c.employer}`, null],
      ['Age', String(c.age), '', null],
      ['Filing status', FILING_STATUS_LABELS[c.filingStatus], '', null],
      [
        'Spouse',
        c.spouseName ?? 'None recorded',
        c.spouseIsUSCitizen ? 'U.S. citizen' : 'Non-U.S. citizen',
        null,
      ],
      ['State', `${c.residency.stateName} (${c.residency.stateCode})`, c.residency.residencyNote, null],
      [
        'Residence abroad',
        c.residency.livesAbroad ? (c.residency.countryOfResidence ?? 'Yes') : 'No',
        c.residency.livesAbroad ? 'Form 8938 thresholds applied on the living-abroad basis.' : '',
        null,
      ],
      [
        'Dependents',
        String(c.dependents.length),
        c.dependents.map((d) => `${d.name} (${d.relationship}, ${d.age})`).join('; '),
        null,
      ],
      [
        'Prior year adjusted gross income',
        '',
        'Drives the § 6654 estimated tax safe harbor.',
        c.priorYearAdjustedGrossIncome,
      ],
    ];
    household.forEach(([item, value, detail, amount], index) => {
      writeDataRow(sheet, row, columns, [item, value, detail, amount, null], {
        band: index % 2 === 1,
      });
      row += 1;
    });
    row += 1;

    writeSectionHeading(sheet, row, 'E', 'Balance sheet');
    row += 1;
    writeTableHeader(sheet, row, columns);
    row += 1;
    const bs = c.balanceSheet;
    const balanceStart = row;
    const balanceRows: Array<[string, string, string, number, number | null]> = [
      ['Cash and equivalents', '', '', bs.cashAndEquivalents, null],
      ['Marketable portfolio', '', '', bs.marketablePortfolio, null],
      ...bs.concentratedPositions.map(
        (p) =>
          [
            'Concentrated position',
            p.label,
            p.acquiredVia,
            p.marketValue,
            p.costBasis,
          ] as [string, string, string, number, number],
      ),
      ['Private business interests', '', '', bs.privateBusinessInterests, null],
      ['Retirement accounts', '', '', bs.retirementAccounts, null],
      ...bs.realEstate.map(
        (r) =>
          [
            'Real estate',
            `${r.label} — ${r.location}`,
            `Mortgage ${r.mortgageBalance.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}`,
            r.marketValue,
            r.costBasis,
          ] as [string, string, string, number, number],
      ),
      ['Other liabilities', '', '', -bs.otherLiabilities, null],
    ];
    balanceRows.forEach(([item, value, detail, amount, basis], index) => {
      writeDataRow(sheet, row, columns, [item, value, detail, amount, basis], {
        band: index % 2 === 1,
      });
      row += 1;
    });
    const balanceEnd = row - 1;
    writeDataRow(
      sheet,
      row,
      columns,
      ['Modeled net worth', '', 'Includes revocable trust assets, net of liabilities.', computeNetWorth(c), null],
      { bold: true, topBorder: true },
    );
    row += 2;
    dataBars(sheet, `D${balanceStart}:D${balanceEnd}`);

    writeSectionHeading(sheet, row, 'E', 'Engagement notes');
    row += 1;
    for (const note of c.advisorNotes) {
      writeNote(sheet, row, 'E', `— ${note}`);
      sheet.getRow(row).height = 28;
      row += 1;
    }
    row += 1;

    writeSectionHeading(sheet, row, 'E', 'Data protection');
    row += 1;
    writeNote(
      sheet,
      row,
      'E',
      'The client record is fictional. It carries no taxpayer identification number, date of birth, street address or account number, and no field in the data model is capable of holding one.',
    );
    sheet.getRow(row).height = 28;
  }

  function buildIncomeSheet(
    wb: ExcelJS.Workbook,
    c: Client,
    sub: string,
    taxYear: typeof constants,
  ) {
    const sheet = newSheet(wb, '02_Income_1040', 4);
    const columns: ColumnSpec[] = [
      { header: 'Line item', width: 42 },
      { header: 'Reported on', width: 24 },
      { header: 'Amount', width: 18, format: FMT.currency },
      { header: 'Share of total', width: 14, format: FMT.percent },
      { header: 'Note', width: 52, wrap: true },
    ];
    let row = writeTitleBlock(sheet, 'E', '02 · Income Analysis (Form 1040 oriented)', sub);

    writeSectionHeading(sheet, row, 'E', 'Summary metrics');
    row += 1;
    row = writeMetricBlock(sheet, row, [
      ['Total modeled income', federal.income.totalModeledIncome, FMT.currency],
      ['Adjusted gross income', federal.adjustedGrossIncome, FMT.currency],
      ['Deduction taken', federal.deductionTaken, FMT.currency],
      ['Taxable income', federal.taxableIncome, FMT.currency],
      ['Modeled federal tax', federal.totalFederalTax, FMT.currency],
      ['Effective federal rate', federal.effectiveRateOnModeledIncome, FMT.percent2],
      ['Marginal ordinary rate', federal.marginalOrdinaryRate, FMT.percent],
    ]);

    writeSectionHeading(sheet, row, 'E', 'Income by source');
    row += 1;
    writeTableHeader(sheet, row, columns);
    row += 1;
    const incomeStart = row;
    const total = federal.income.totalModeledIncome;
    const lines: Array<[string, string, number, string]> = [
      ['Wages', 'Form 1040, line 1a', c.income.wages, ''],
      ['Bonus', 'Form 1040, line 1a', c.income.bonus, ''],
      ['Equity compensation', 'Form 1040, line 1a', c.income.equityCompensation, 'Supplemental wage withholding is a flat 22% to $1,000,000.'],
      ['Taxable interest', 'Schedule B', c.income.taxableInterest, ''],
      ['Qualified dividends', 'Form 1040, line 3a', c.income.qualifiedDividends, 'Taxed at the preferential rates.'],
      ['Non-qualified dividends', 'Schedule B', c.income.nonQualifiedDividends, ''],
      ['Short-term capital gain', 'Schedule D', c.income.shortTermCapitalGain, 'No preferential rate.'],
      ['Long-term capital gain', 'Schedule D', c.income.longTermCapitalGain, 'Taxed at the preferential rates.'],
      ['Business income', 'Schedule E', c.income.businessIncome, ''],
      ['Rental income', 'Schedule E', c.income.rentalIncome, ''],
      ['Trust distributions', 'Schedule E', c.income.trustDistributions, ''],
      ['Retirement distributions', 'Form 1040, line 4b', c.income.retirementDistributions, ''],
      ['Other income', 'Schedule 1', c.income.otherIncome, ''],
    ];
    lines.forEach(([label, reportedOn, amount, note], index) => {
      writeDataRow(sheet, row, columns, [label, reportedOn, amount, total > 0 ? amount / total : 0, note], {
        band: index % 2 === 1,
      });
      row += 1;
    });
    writeDataRow(sheet, row, columns, ['Total modeled income', '', total, 1, 'Excludes tax-exempt interest.'], {
      bold: true,
      topBorder: true,
    });
    const incomeEnd = row;
    row += 1;
    writeDataRow(sheet, row, columns, [
      'Tax-exempt interest',
      'Form 1040, line 2a',
      c.income.taxExemptInterest,
      null,
      'Excluded from total income; relevant to the alternative minimum tax screen.',
    ]);
    row += 2;
    dataBars(sheet, `C${incomeStart}:C${incomeEnd - 1}`);

    writeSectionHeading(sheet, row, 'E', 'Deduction limitations');
    row += 1;
    writeTableHeader(sheet, row, columns);
    row += 1;
    const deductionLines: Array<[string, string, number, string]> = [
      ['State and local taxes paid', 'Schedule A', federal.salt.paid, ''],
      ['Statutory cap', '', taxYear.saltLimitation.cap[c.filingStatus], 'P.L. 119-21, § 70120.'],
      ['Cap after income phase-down', '', federal.salt.cap, `Reduced by 30% of modified AGI above ${taxYear.saltLimitation.phaseDownModifiedAgiThreshold[c.filingStatus].toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}.`],
      ['State and local taxes deducted', '', federal.salt.allowed, ''],
      ['Charitable — cash to public charities', 'Schedule A', federal.charitable.cash, '60% of contribution base ceiling.'],
      ['Charitable — appreciated securities', 'Schedule A / Form 8283', federal.charitable.appreciated, '30% of contribution base ceiling.'],
      ['Charitable — private foundation', 'Schedule A / Form 8283', federal.charitable.privateFoundation, '30% cash / 20% appreciated ceiling.'],
      ['Charitable currently deductible', '', federal.charitable.totalAllowed, ''],
      ['Charitable carried forward', '', federal.charitable.disallowedCarryforward, 'Five-year carryforward under § 170(d).'],
      ['Mortgage interest', 'Schedule A', c.deductions.mortgageInterest, ''],
      ['Total itemized deductions', '', federal.itemizedDeductions, ''],
      ['Standard deduction', '', federal.standardDeduction, ''],
    ];
    deductionLines.forEach(([label, reportedOn, amount, note], index) => {
      writeDataRow(sheet, row, columns, [label, reportedOn, amount, null, note], {
        band: index % 2 === 1,
      });
      row += 1;
    });
    writeDataRow(
      sheet,
      row,
      columns,
      [
        federal.deductionMethod === 'itemized' ? 'Itemized deduction taken' : 'Standard deduction taken',
        '',
        federal.deductionTaken,
        null,
        '',
      ],
      { bold: true, topBorder: true },
    );
    row += 2;

    writeSectionHeading(sheet, row, 'E', 'Tax build-up');
    row += 1;
    writeTableHeader(sheet, row, columns);
    row += 1;
    const taxLines: Array<[string, string, number, string]> = [
      ['Ordinary income tax', 'Form 1040', federal.ordinaryTax, `On ${federal.ordinaryTaxableIncome.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} of ordinary taxable income.`],
      ['Tax at 0% on capital gain', 'Schedule D', 0, `${federal.capitalGainDetail.atZero.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} in band.`],
      ['Tax at 15% on capital gain', 'Schedule D', federal.capitalGainDetail.atFifteen * 0.15, `${federal.capitalGainDetail.atFifteen.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} in band.`],
      ['Tax at 20% on capital gain', 'Schedule D', federal.capitalGainDetail.atTwenty * 0.2, `${federal.capitalGainDetail.atTwenty.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} in band.`],
      ['Net investment income tax', 'Form 8960', federal.netInvestmentIncomeTax, `3.8% on a base of ${federal.netInvestmentIncomeTaxBase.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}.`],
      ['Additional Medicare tax', 'Form 8959', federal.additionalMedicareTax, '0.9% on earned income above the threshold.'],
    ];
    taxLines.forEach(([label, reportedOn, amount, note], index) => {
      writeDataRow(sheet, row, columns, [label, reportedOn, amount, null, note], {
        band: index % 2 === 1,
      });
      row += 1;
    });
    writeDataRow(sheet, row, columns, ['Total modeled federal tax', '', federal.totalFederalTax, federal.effectiveRateOnModeledIncome, ''], {
      bold: true,
      topBorder: true,
    });
    row += 1;
    writeDataRow(sheet, row, columns, [
      'Estimated state tax',
      '',
      federal.estimatedStateTax,
      null,
      `Single top marginal rate of ${(c.residency.topMarginalStateRate * 100).toFixed(2)}% applied to taxable income. Not a state return calculation.`,
    ]);
    row += 2;

    writeAssumptions(sheet, row, 'E', taxYear);
  }

  function buildGiftSheet(
    wb: ExcelJS.Workbook,
    c: Client,
    sub: string,
    giftAnalysis: typeof gifts,
    taxYear: typeof constants,
  ) {
    const sheet = newSheet(wb, '03_Gift_709', 4);
    const columns: ColumnSpec[] = [
      { header: 'Donee', width: 34 },
      { header: 'Relationship', width: 26 },
      { header: 'Asset type', width: 22 },
      { header: 'Gift amount', width: 16, format: FMT.currency },
      { header: 'Modeled annual exclusion', width: 18, format: FMT.currency },
      { header: 'Exclusion applied', width: 16, format: FMT.currency },
      { header: 'Above exclusion', width: 16, format: FMT.currency },
      { header: 'Gift splitting', width: 13 },
      { header: 'Form 709 review', width: 16 },
      { header: 'Reason', width: 48, wrap: true },
    ];
    let row = writeTitleBlock(sheet, 'J', '03 · Wealth Transfer (Form 709 oriented)', sub);

    writeSectionHeading(sheet, row, 'J', 'Summary metrics');
    row += 1;
    row = writeMetricBlock(sheet, row, [
      ['Annual exclusion per donee', giftAnalysis.annualExclusion, FMT.currency],
      ['Non-citizen spouse exclusion', giftAnalysis.noncitizenSpouseExclusion, FMT.currency],
      ['Basic exclusion amount', giftAnalysis.basicExclusionAmount, FMT.currency],
      ['Total transferred', giftAnalysis.totalGifted, FMT.currency],
      ['Covered by annual exclusion', giftAnalysis.totalExcluded, FMT.currency],
      ['Above the annual exclusion', giftAnalysis.totalExceedingExclusion, FMT.currency],
      ['Donees over the exclusion', giftAnalysis.doneesOverExclusion, FMT.integer],
      ['Exclusion previously used', giftAnalysis.lifetimeExclusionPreviouslyUsed, FMT.currency],
      ['Projected remaining exclusion', giftAnalysis.remainingExclusion, FMT.currency],
      ['Exclusion utilization', giftAnalysis.exclusionUtilization, FMT.percent2],
    ]);

    writeSectionHeading(sheet, row, 'J', 'Transfers by donee');
    row += 1;
    writeTableHeader(sheet, row, columns);
    row += 1;
    const doneeStart = row;
    giftAnalysis.donees.forEach((donee, index) => {
      writeDataRow(
        sheet,
        row,
        columns,
        [
          donee.recipient,
          donee.relationship,
          [...new Set(donee.gifts.map((gift) => GIFT_ASSET_LABELS[gift.assetType]))].join(', '),
          donee.totalGifted,
          Number.isFinite(donee.modeledExclusion)
            ? donee.modeledExclusion * (donee.splitElectionApplies ? 2 : 1)
            : 'Unlimited marital deduction',
          Number.isFinite(donee.exclusionApplied) ? donee.exclusionApplied : 0,
          donee.amountExceedingExclusion,
          donee.splitElectionApplies ? 'Elected' : 'No',
          donee.requiresFormReview ? 'Indicated' : 'Not indicated',
          donee.reviewReasons.join(' '),
        ],
        { band: index % 2 === 1 },
      );
      row += 1;
    });
    writeDataRow(
      sheet,
      row,
      columns,
      [
        'Total',
        '',
        '',
        giftAnalysis.totalGifted,
        null,
        giftAnalysis.totalExcluded,
        giftAnalysis.totalExceedingExclusion,
        '',
        '',
        '',
      ],
      { bold: true, topBorder: true },
    );
    const doneeEnd = row;
    row += 2;
    flagAboveZero(sheet, `G${doneeStart}:G${doneeEnd - 1}`, 1);
    flagText(sheet, `I${doneeStart}:I${doneeEnd - 1}`, 'Indicated', 2);

    writeSectionHeading(sheet, row, 'J', 'Individual transfers');
    row += 1;
    const detailColumns: ColumnSpec[] = [
      { header: 'Reference', width: 16 },
      { header: 'Donee', width: 34 },
      { header: 'Asset type', width: 24 },
      { header: 'Amount', width: 16, format: FMT.currency },
      { header: 'Cost basis', width: 16, format: FMT.currency },
      { header: 'Interest transferred', width: 20 },
      { header: 'In trust', width: 12 },
      { header: 'Withdrawal right', width: 15 },
      { header: 'Splitting elected', width: 15 },
      { header: 'Note', width: 48, wrap: true },
    ];
    writeTableHeader(sheet, row, detailColumns);
    row += 1;
    c.gifts.forEach((gift, index) => {
      writeDataRow(
        sheet,
        row,
        detailColumns,
        [
          gift.id,
          gift.recipient,
          GIFT_ASSET_LABELS[gift.assetType],
          gift.amount,
          gift.costBasis ?? null,
          gift.presentInterest || (gift.intoTrust && gift.crummeyWithdrawalRight)
            ? 'Present interest'
            : 'Future interest',
          gift.intoTrust ? 'Yes' : 'No',
          gift.crummeyWithdrawalRight ? 'Yes' : 'No',
          gift.spouseElectsGiftSplitting ? 'Yes' : 'No',
          gift.note ?? '',
        ],
        { band: index % 2 === 1 },
      );
      row += 1;
    });
    row += 1;
    flagText(sheet, `F${doneeEnd + 4}:F${row}`, 'Future interest', 3);

    writeSectionHeading(sheet, row, 'J', 'Interpretation');
    row += 1;
    writeNote(
      sheet,
      row,
      'J',
      'Exceeding the annual exclusion indicates that a Form 709 filing position should be reviewed. It does not mean gift tax is owed: amounts above the exclusion are applied against the lifetime basic exclusion amount, and tax arises only once that amount is exhausted. Direct payments of tuition or medical expenses under § 2503(e) are excluded from the calculation entirely and are not modeled here.',
    );
    sheet.getRow(row).height = 44;
    row += 2;

    writeAssumptions(sheet, row, 'J', taxYear);
  }

  function buildTrustSheet(
    wb: ExcelJS.Workbook,
    c: Client,
    sub: string,
    trustAnalysis: typeof trusts,
    taxYear: typeof constants,
  ) {
    const sheet = newSheet(wb, '04_Trust_1041', 4);
    const columns: ColumnSpec[] = [
      { header: 'Trust', width: 36 },
      { header: 'Kind', width: 26 },
      { header: 'Situs', width: 18 },
      { header: 'Interest', width: 14, format: FMT.currency },
      { header: 'Dividends', width: 14, format: FMT.currency },
      { header: 'Capital gains', width: 14, format: FMT.currency },
      { header: 'Rental', width: 14, format: FMT.currency },
      { header: 'Other', width: 14, format: FMT.currency },
      { header: 'Gross income', width: 15, format: FMT.currency },
      { header: 'Distributions', width: 15, format: FMT.currency },
      { header: 'Retained income', width: 15, format: FMT.currency },
      { header: 'Illustrative fiduciary tax', width: 17, format: FMT.currency },
    ];
    let row = writeTitleBlock(sheet, 'L', '04 · Trusts (Form 1041 oriented)', sub);

    if (c.trusts.length === 0) {
      writeSectionHeading(sheet, row, 'L', 'No trusts on file');
      row += 1;
      writeNote(sheet, row, 'L', 'The client record carries no trusts, so no fiduciary analysis is produced.');
      return;
    }

    writeSectionHeading(sheet, row, 'L', 'Summary metrics');
    row += 1;
    row = writeMetricBlock(sheet, row, [
      ['Trusts on file', c.trusts.length, FMT.integer],
      ['Aggregate principal', trustAnalysis.totalPrincipal, FMT.currency],
      ['Trust gross income', trustAnalysis.totalGrossIncome, FMT.currency],
      ['Distributed to beneficiaries', trustAnalysis.totalDistributions, FMT.currency],
      ['Retained in trust', trustAnalysis.totalRetainedIncome, FMT.currency],
      ['Illustrative fiduciary tax', trustAnalysis.totalIllustrativeFiduciaryTax, FMT.currency],
      ['Top fiduciary bracket begins', trustAnalysis.topBracketThreshold, FMT.currency],
      ['Form 1041 gross income filing threshold', trustAnalysis.filingThreshold, FMT.currency],
    ]);

    writeSectionHeading(sheet, row, 'L', 'Trust income and distributions');
    row += 1;
    writeTableHeader(sheet, row, columns);
    row += 1;
    const trustStart = row;
    trustAnalysis.trusts.forEach((entry, index) => {
      writeDataRow(
        sheet,
        row,
        columns,
        [
          entry.trust.name,
          TRUST_KIND_LABELS[entry.trust.kind],
          entry.trust.situs,
          entry.trust.income.interest,
          entry.trust.income.dividends,
          entry.trust.income.capitalGains,
          entry.trust.income.rental,
          entry.trust.income.other,
          entry.grossIncome,
          entry.distributions,
          entry.retainedIncome,
          entry.isGrantorTrust || entry.isTaxExempt ? 0 : entry.illustrativeFiduciaryTax,
        ],
        { band: index % 2 === 1 },
      );
      row += 1;
    });
    writeDataRow(
      sheet,
      row,
      columns,
      [
        'Total',
        '',
        '',
        trustAnalysis.incomeByCategory.interest,
        trustAnalysis.incomeByCategory.dividends,
        trustAnalysis.incomeByCategory.capitalGains,
        trustAnalysis.incomeByCategory.rental,
        trustAnalysis.incomeByCategory.other,
        trustAnalysis.totalGrossIncome,
        trustAnalysis.totalDistributions,
        trustAnalysis.totalRetainedIncome,
        trustAnalysis.totalIllustrativeFiduciaryTax,
      ],
      { bold: true, topBorder: true },
    );
    const trustEnd = row;
    row += 2;
    dataBars(sheet, `I${trustStart}:I${trustEnd - 1}`, 1);
    sheet.addConditionalFormatting({
      ref: `K${trustStart}:K${trustEnd - 1}`,
      rules: [
        {
          type: 'cellIs',
          operator: 'greaterThan',
          formulae: [String(trustAnalysis.topBracketThreshold)],
          priority: 2,
          style: { font: { color: { argb: 'FF9B2C1F' }, bold: true } },
        },
      ],
    });

    writeSectionHeading(sheet, row, 'L', 'Fiduciary attributes');
    row += 1;
    const attributeColumns: ColumnSpec[] = [
      { header: 'Trust', width: 36 },
      { header: 'Grantor', width: 26 },
      { header: 'Trustee', width: 30 },
      { header: 'Beneficiaries', width: 46, wrap: true },
      { header: 'Grantor trust', width: 14 },
      { header: 'Foreign trust', width: 14 },
      { header: 'NRA beneficiary', width: 15 },
      { header: 'Gains allocated to', width: 17 },
      { header: 'Undistributed investment income', width: 18, format: FMT.currency },
      { header: 'Base for 3.8% tax', width: 16, format: FMT.currency },
      { header: 'Distribution rate', width: 14, format: FMT.percent },
      { header: 'Principal value', width: 16, format: FMT.currency },
    ];
    writeTableHeader(sheet, row, attributeColumns);
    row += 1;
    const attrStart = row;
    trustAnalysis.trusts.forEach((entry, index) => {
      writeDataRow(
        sheet,
        row,
        attributeColumns,
        [
          entry.trust.name,
          entry.trust.grantor,
          entry.trust.trustee,
          entry.trust.beneficiaries.join('; '),
          entry.isGrantorTrust ? 'Yes' : 'No',
          entry.trust.isForeignTrust ? 'Yes' : 'No',
          entry.trust.hasNonresidentAlienBeneficiary ? 'Yes' : 'No',
          entry.trust.capitalGainsAllocatedToIncome ? 'Income' : 'Principal',
          entry.undistributedInvestmentIncome,
          entry.netInvestmentIncomeTaxBase,
          entry.distributionRate,
          entry.trust.principalValue,
        ],
        { band: index % 2 === 1 },
      );
      row += 1;
    });
    flagText(sheet, `G${attrStart}:G${row - 1}`, 'Yes', 3);
    row += 1;

    writeSectionHeading(sheet, row, 'L', 'Interpretation');
    row += 1;
    writeNote(
      sheet,
      row,
      'L',
      'This sheet reports composition, distributions and retained income. It does not compute distributable net income, apply the separate share rules, model the § 663(b) sixty-five day election or produce a Form 1041. The fiduciary tax column illustrates the compressed rate schedule applied to modeled retained income and is not a liability. A charitable remainder trust is generally exempt from income tax and files Form 5227 instead.',
    );
    sheet.getRow(row).height = 44;
    row += 2;

    writeAssumptions(sheet, row, 'L', taxYear);
  }

  function buildForeignSheet(
    wb: ExcelJS.Workbook,
    c: Client,
    sub: string,
    foreignAnalysis: typeof foreign,
    taxYear: typeof constants,
  ) {
    const sheet = newSheet(wb, '05_Foreign_Accounts', 4);
    const columns: ColumnSpec[] = [
      { header: 'Institution', width: 44 },
      { header: 'Country', width: 18 },
      { header: 'Account type', width: 22 },
      { header: 'Interest held', width: 22 },
      { header: 'Currency', width: 11 },
      { header: 'Opened', width: 10, format: FMT.integer },
      { header: 'Maximum value (USD)', width: 18, format: FMT.currency },
      { header: 'Year-end value (USD)', width: 18, format: FMT.currency },
      { header: 'Share of aggregate', width: 15, format: FMT.percent },
    ];
    let row = writeTitleBlock(sheet, 'I', '05 · Foreign Financial Accounts (FBAR oriented)', sub);

    writeSectionHeading(sheet, row, 'I', 'Summary metrics');
    row += 1;
    row = writeMetricBlock(sheet, row, [
      ['Accounts recorded', foreignAnalysis.accountCount, FMT.integer],
      ['Countries', foreignAnalysis.countries.length, FMT.integer],
      ['Aggregate maximum value', foreignAnalysis.aggregateMaximumValue, FMT.currency],
      ['Excluding signature-authority-only accounts', foreignAnalysis.aggregateMaximumExcludingSignatureAuthority, FMT.currency],
      ['Aggregate year-end value', foreignAnalysis.aggregateYearEndValue, FMT.currency],
      ['FBAR aggregate threshold', foreignAnalysis.fbarThreshold, FMT.currency],
      ['FBAR review flag', foreignAnalysis.fbarReviewFlag ? 'Raised' : 'Not raised'],
      ['Form 8938 year-end threshold', foreignAnalysis.form8938YearEndThreshold, FMT.currency],
      ['Form 8938 any-time threshold', foreignAnalysis.form8938AnyTimeThreshold, FMT.currency],
      ['Form 8938 review flag', foreignAnalysis.form8938ReviewFlag ? 'Raised' : 'Not raised'],
    ]);
    flagText(sheet, `B6:B${row - 2}`, 'Raised', 1);

    if (foreignAnalysis.accountCount === 0) {
      writeSectionHeading(sheet, row, 'I', 'No foreign financial accounts recorded');
      row += 1;
      writeNote(
        sheet,
        row,
        'I',
        'The absence of a flag reflects the absence of recorded accounts, not an assurance that none exists. Accounts held only under signature authority, foreign pensions and non-U.S. insurance products are commonly omitted from a client’s own listing.',
      );
      sheet.getRow(row).height = 32;
      row += 2;
      writeAssumptions(sheet, row, 'I', taxYear);
      return;
    }

    writeSectionHeading(sheet, row, 'I', 'Accounts');
    row += 1;
    writeTableHeader(sheet, row, columns);
    row += 1;
    const accountStart = row;
    foreignAnalysis.accounts.forEach((account, index) => {
      writeDataRow(
        sheet,
        row,
        columns,
        [
          account.institution,
          account.country,
          FOREIGN_ACCOUNT_TYPE_LABELS[account.accountType],
          FOREIGN_INTEREST_LABELS[account.interestType],
          account.localCurrency,
          account.openedYear,
          account.maximumValueUSD,
          account.yearEndValueUSD,
          account.maximumValueUSD / foreignAnalysis.aggregateMaximumValue,
        ],
        { band: index % 2 === 1 },
      );
      row += 1;
    });
    writeDataRow(
      sheet,
      row,
      columns,
      [
        'Aggregate',
        '',
        '',
        '',
        '',
        null,
        foreignAnalysis.aggregateMaximumValue,
        foreignAnalysis.aggregateYearEndValue,
        1,
      ],
      { bold: true, topBorder: true },
    );
    const accountEnd = row;
    row += 2;
    dataBars(sheet, `G${accountStart}:G${accountEnd - 1}`, 2);

    writeSectionHeading(sheet, row, 'I', 'Exposure by country');
    row += 1;
    const countryColumns: ColumnSpec[] = [
      { header: 'Country', width: 26 },
      { header: 'Accounts', width: 12, format: FMT.integer },
      { header: 'Maximum value (USD)', width: 20, format: FMT.currency },
      { header: 'Year-end value (USD)', width: 20, format: FMT.currency },
      { header: 'Share of aggregate', width: 16, format: FMT.percent },
    ];
    writeTableHeader(sheet, row, countryColumns);
    row += 1;
    foreignAnalysis.countries.forEach((country, index) => {
      writeDataRow(
        sheet,
        row,
        countryColumns,
        [
          country.country,
          country.accountCount,
          country.maximumValueUSD,
          country.yearEndValueUSD,
          country.maximumValueUSD / foreignAnalysis.aggregateMaximumValue,
        ],
        { band: index % 2 === 1 },
      );
      row += 1;
    });
    row += 1;

    if (c.foreignEntities.length > 0) {
      writeSectionHeading(sheet, row, 'I', 'Foreign entity interests');
      row += 1;
      const entityColumns: ColumnSpec[] = [
        { header: 'Entity', width: 34 },
        { header: 'Country', width: 18 },
        { header: 'Kind', width: 34 },
        { header: 'Ownership', width: 14, format: FMT.percent2 },
        { header: 'Value (USD)', width: 18, format: FMT.currency },
        { header: 'Note', width: 60, wrap: true },
      ];
      writeTableHeader(sheet, row, entityColumns);
      row += 1;
      c.foreignEntities.forEach((entity, index) => {
        writeDataRow(
          sheet,
          row,
          entityColumns,
          [
            entity.name,
            entity.country,
            FOREIGN_ENTITY_LABELS[entity.kind],
            entity.ownershipPercent,
            entity.valueUSD,
            entity.note ?? '',
          ],
          { band: index % 2 === 1 },
        );
        row += 1;
      });
      row += 1;
    }

    writeSectionHeading(sheet, row, 'I', 'Interpretation');
    row += 1;
    writeNote(
      sheet,
      row,
      'I',
      'The FBAR test is applied to the aggregate maximum value of every reportable account, including accounts held only under signature authority, and not account by account. Form 8938 is measured on a different base and against different thresholds; the same account is commonly reported on both. Foreign non-account assets such as directly held foreign stock also count toward the Form 8938 threshold and are not captured in the account table.',
    );
    sheet.getRow(row).height = 44;
    row += 2;

    writeAssumptions(sheet, row, 'I', taxYear);
  }

  function buildScenarioSheet(
    wb: ExcelJS.Workbook,
    sub: string,
    scenarioComparison: typeof comparison,
  ) {
    const sheet = newSheet(wb, '06_Scenario_Analysis', 4);
    const { scenarios, baseline, parameters } = scenarioComparison;
    const columns: ColumnSpec[] = [
      { header: 'Measure', width: 44 },
      ...scenarios.flatMap((scenario, index): ColumnSpec[] =>
        index === 0
          ? [{ header: scenario.name, width: 18, format: FMT.currency }]
          : [
              { header: scenario.name, width: 18, format: FMT.currency },
              { header: `${scenario.shortName} Δ`, width: 15, format: FMT.currency },
            ],
      ),
    ];
    const lastColumn = COLUMN_LETTER(columns.length);
    let row = writeTitleBlock(sheet, lastColumn, '06 · Scenario Analysis', sub);

    writeSectionHeading(sheet, row, lastColumn, 'Scenario premises');
    row += 1;
    const premiseColumns: ColumnSpec[] = [
      { header: 'Scenario', width: 24 },
      { header: 'Premise', width: 56, wrap: true },
      { header: 'Assumptions applied', width: 92, wrap: true },
    ];
    writeTableHeader(sheet, row, premiseColumns);
    row += 1;
    scenarios.forEach((scenario, index) => {
      writeDataRow(
        sheet,
        row,
        premiseColumns,
        [scenario.name, scenario.premise, scenario.assumptions.map((a) => `— ${a}`).join('\n')],
        { band: index % 2 === 1 },
      );
      sheet.getRow(row).height = Math.max(30, scenario.assumptions.length * 13);
      row += 1;
    });
    row += 1;

    writeSectionHeading(sheet, row, lastColumn, 'Parameters');
    row += 1;
    row = writeMetricBlock(sheet, row, [
      ['Gift splitting elected', parameters.electGiftSplitting ? 'Yes' : 'No'],
      ['Donees topped up to the exclusion', parameters.topUpDoneesToExclusion ? 'Yes' : 'No'],
      ['Additional donees modeled', parameters.additionalDonees, FMT.integer],
      ['Incremental appreciated gift', parameters.incrementalAppreciatedGift, FMT.currency],
      ['Long-term gain deferred', parameters.capitalGainDeferralShare, FMT.percent],
    ]);

    writeSectionHeading(sheet, row, lastColumn, 'Side-by-side comparison');
    row += 1;
    writeTableHeader(sheet, row, columns);
    row += 1;

    const groups = [...new Set(SCENARIO_ROWS.map((entry) => entry.group))];
    const deltaColumns: number[] = [];
    for (const group of groups) {
      sheet.mergeCells(`A${row}:${lastColumn}${row}`);
      const groupCell = sheet.getCell(`A${row}`);
      groupCell.value = group.toUpperCase();
      groupCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1B3B5F' } };
      groupCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7EDF4' } };
      groupCell.alignment = { vertical: 'middle', indent: 1 };
      row += 1;

      for (const entry of SCENARIO_ROWS.filter((candidate) => candidate.group === group)) {
        const values: Array<string | number | null> = [entry.label];
        const rowColumns: ColumnSpec[] = [columns[0]!];
        scenarios.forEach((scenario, index) => {
          const value = scenario.metrics[entry.key];
          values.push(value);
          rowColumns.push({
            header: '',
            width: 18,
            format: entry.format === 'usd' ? FMT.currency : FMT.percent2,
          });
          if (index > 0) {
            values.push(value - baseline.metrics[entry.key]);
            rowColumns.push({
              header: '',
              width: 15,
              format: entry.format === 'usd' ? FMT.currency : FMT.percent2,
            });
            if (deltaColumns.length < scenarios.length - 1) deltaColumns.push(values.length);
          }
        });
        writeDataRow(sheet, row, rowColumns, values);
        row += 1;
      }
    }
    const comparisonEnd = row - 1;

    for (const columnIndex of deltaColumns) {
      const letter = COLUMN_LETTER(columnIndex);
      deltaScale(sheet, `${letter}9:${letter}${comparisonEnd}`, columnIndex);
    }
    row += 1;

    writeSectionHeading(sheet, row, lastColumn, 'Interpretation');
    row += 1;
    writeNote(
      sheet,
      row,
      lastColumn,
      'Differences are modeled-year effects only. The gift planning column moves assets out of the estate and has no income tax effect in the modeled year; its value appears in later years and at death. The capital gain timing column defers gain rather than eliminating it, and the deferred amount is not taxed in a later year in this model, so the comparison overstates the benefit of deferral considered on its own.',
    );
    sheet.getRow(row).height = 44;
  }

  function buildResearchSheet(
    wb: ExcelJS.Workbook,
    sub: string,
    taxYear: typeof constants,
    clientFindings: typeof findings,
  ) {
    const sheet = newSheet(wb, '07_Tax_Research', 4);
    const columns: ColumnSpec[] = [
      { header: 'Topic', width: 40 },
      { header: 'Tax year', width: 11 },
      { header: 'Rule description', width: 88, wrap: true },
      { header: 'Citation', width: 34 },
      { header: 'Government source', width: 34 },
      { header: 'Source URL', width: 52 },
      { header: 'Last verified', width: 14 },
      { header: 'Related forms', width: 30, wrap: true },
    ];
    let row = writeTitleBlock(sheet, 'H', '07 · Tax Research and Sources', sub);

    writeSectionHeading(sheet, row, 'H', 'Modeled constants');
    row += 1;
    const constantColumns: ColumnSpec[] = [
      { header: 'Constant', width: 46 },
      { header: 'Value', width: 20, format: FMT.currency },
      { header: 'Applies to', width: 34 },
      { header: 'Citation', width: 34 },
      { header: 'Source URL', width: 52 },
    ];
    writeTableHeader(sheet, row, constantColumns);
    row += 1;
    const authorityById = new Map(AUTHORITIES.map((authority) => [authority.id, authority]));
    const constantEntries: Array<[string, number, string, string]> = [
      ['Annual gift exclusion', taxYear.wealthTransfer.annualGiftExclusion, 'Per donee, present interests', taxYear.sourceKeys.annualGiftExclusion],
      ['Non-citizen spouse annual exclusion', taxYear.wealthTransfer.noncitizenSpouseAnnualExclusion, 'Gifts to a non-citizen spouse', taxYear.sourceKeys.annualGiftExclusion],
      ['Basic exclusion amount', taxYear.wealthTransfer.basicExclusionAmount, 'Lifetime gift and estate', taxYear.sourceKeys.basicExclusionAmount],
      ['FBAR aggregate threshold', taxYear.foreignReporting.fbarAggregateThreshold, 'All reportable foreign accounts', taxYear.sourceKeys.fbarThreshold],
      ['Form 8938 threshold (year end, in U.S.)', taxYear.foreignReporting.form8938.livingInUS.marriedFilingJointly.yearEnd, 'Married filing jointly, living in the U.S.', taxYear.sourceKeys.form8938Thresholds],
      ['Form 8938 threshold (year end, abroad)', taxYear.foreignReporting.form8938.livingAbroad.marriedFilingJointly.yearEnd, 'Married filing jointly, living abroad', taxYear.sourceKeys.form8938Thresholds],
      ['Standard deduction (MFJ)', taxYear.standardDeduction.marriedFilingJointly, 'Married filing jointly', taxYear.sourceKeys.standardDeduction],
      ['State and local tax cap', taxYear.saltLimitation.cap.marriedFilingJointly, 'Before the income phase-down', taxYear.sourceKeys.saltLimitation],
      ['Net investment income tax threshold (MFJ)', taxYear.netInvestmentIncomeTax.thresholds.marriedFilingJointly, 'Modified adjusted gross income', taxYear.sourceKeys.netInvestmentIncomeTax],
      ['Additional Medicare tax threshold (MFJ)', taxYear.additionalMedicareTax.thresholds.marriedFilingJointly, 'Wages and self-employment income', taxYear.sourceKeys.additionalMedicareTax],
      ['Top fiduciary bracket begins', taxYear.fiduciary.netInvestmentIncomeThreshold, 'Trusts and estates', taxYear.sourceKeys.fiduciaryRates],
      ['Form 1041 gross income filing threshold', taxYear.fiduciary.grossIncomeFilingThreshold, 'Domestic trusts', taxYear.sourceKeys.fiduciaryRates],
      ['Section 199A threshold (MFJ)', taxYear.qualifiedBusinessIncome.thresholdAmount.marriedFilingJointly, 'Taxable income before the deduction', taxYear.sourceKeys.qualifiedBusinessIncome],
      ['AMT exemption (MFJ)', taxYear.alternativeMinimumTax.exemption.marriedFilingJointly, 'Married filing jointly', taxYear.sourceKeys.alternativeMinimumTax],
    ];
    constantEntries.forEach(([label, value, appliesTo, sourceKey], index) => {
      const authority = authorityById.get(sourceKey);
      writeDataRow(
        sheet,
        row,
        constantColumns,
        [
          label,
          value,
          appliesTo,
          authority?.citation ?? '',
          authority ? { text: authority.sourceUrl, hyperlink: authority.sourceUrl } : '',
        ],
        { band: index % 2 === 1 },
      );
      row += 1;
    });
    row += 1;

    writeSectionHeading(sheet, row, 'H', 'Rule set');
    row += 1;
    const ruleColumns: ColumnSpec[] = [
      { header: 'Rule ID', width: 30 },
      { header: 'Rule', width: 44 },
      { header: 'Module', width: 20 },
      { header: 'Deterministic test', width: 66, wrap: true },
      { header: 'Authorities', width: 60, wrap: true },
      { header: 'Fired for this client', width: 18 },
    ];
    writeTableHeader(sheet, row, ruleColumns);
    row += 1;
    const firedIds = new Set(clientFindings.map((finding) => finding.ruleId));
    const ruleStart = row;
    RULE_CATALOG.forEach((rule, index) => {
      writeDataRow(
        sheet,
        row,
        ruleColumns,
        [
          rule.id,
          rule.name,
          MODULE_LABELS[rule.module as keyof typeof MODULE_LABELS] ?? rule.module,
          rule.test,
          rule.authorityIds
            .map((id) => authorityById.get(id)?.citation ?? id)
            .join('; '),
          firedIds.has(rule.id) ? 'Fired' : 'Not triggered',
        ],
        { band: index % 2 === 1 },
      );
      row += 1;
    });
    flagText(sheet, `F${ruleStart}:F${row - 1}`, 'Fired', 1);
    row += 1;

    writeSectionHeading(sheet, row, 'H', 'Source library');
    row += 1;
    writeTableHeader(sheet, row, columns);
    row += 1;
    AUTHORITIES.forEach((authority, index) => {
      writeDataRow(
        sheet,
        row,
        columns,
        [
          authority.topic,
          String(authority.taxYear),
          authority.ruleDescription,
          authority.citation,
          authority.governmentSource,
          { text: authority.sourceUrl, hyperlink: authority.sourceUrl },
          authority.lastVerified,
          authority.relatedForms.join('; '),
        ],
        { band: index % 2 === 1 },
      );
      sheet.getRow(row).height = 30;
      row += 1;
    });
    row += 1;

    writeAssumptions(sheet, row, 'H', taxYear);
  }

  function buildExecutiveSheet(
    wb: ExcelJS.Workbook,
    sub: string,
    executiveSummary: typeof summary,
    evaluationResult: typeof evaluation,
  ) {
    const sheet = newSheet(wb, '08_Executive_Summary', 4);
    let row = writeTitleBlock(sheet, 'F', '08 · Executive Summary', sub);
    sheet.getColumn(1).width = 30;
    sheet.getColumn(2).width = 26;
    sheet.getColumn(3).width = 92;
    sheet.getColumn(4).width = 26;
    sheet.getColumn(5).width = 22;
    sheet.getColumn(6).width = 22;

    writeSectionHeading(sheet, row, 'F', '1 · Client overview');
    row += 1;
    for (const paragraph of executiveSummary.overview) {
      writeNote(sheet, row, 'F', paragraph);
      sheet.getRow(row).height = 32;
      row += 1;
    }
    row += 1;

    writeSectionHeading(sheet, row, 'F', '2 · Major financial characteristics');
    row += 1;
    const characteristicColumns: ColumnSpec[] = [
      { header: 'Characteristic', width: 30 },
      { header: 'Summary', width: 26 },
      { header: 'Detail', width: 92, wrap: true },
    ];
    writeTableHeader(sheet, row, characteristicColumns);
    row += 1;
    executiveSummary.characteristics.forEach((characteristic, index) => {
      writeDataRow(
        sheet,
        row,
        characteristicColumns,
        [characteristic.label, characteristic.value, characteristic.detail],
        { band: index % 2 === 1 },
      );
      sheet.getRow(row).height = 30;
      row += 1;
    });
    row += 1;

    writeSectionHeading(sheet, row, 'F', '3 · Identified review areas');
    row += 1;
    const findingColumns: ColumnSpec[] = [
      { header: 'Severity', width: 18 },
      { header: 'Module', width: 22 },
      { header: 'Finding', width: 60, wrap: true },
      { header: 'Client fact', width: 76, wrap: true },
      { header: 'Potential forms', width: 26, wrap: true },
      { header: 'Rule ID', width: 26 },
    ];
    writeTableHeader(sheet, row, findingColumns);
    row += 1;
    const findingStart = row;
    evaluationResult.findings.forEach((finding, index) => {
      writeDataRow(
        sheet,
        row,
        findingColumns,
        [
          SEVERITY_LABELS[finding.severity],
          MODULE_LABELS[finding.module],
          finding.headline,
          finding.clientFact,
          finding.potentialForms.join('; '),
          finding.ruleId,
        ],
        { band: index % 2 === 1 },
      );
      sheet.getRow(row).height = 30;
      row += 1;
    });
    flagText(sheet, `A${findingStart}:A${row - 1}`, 'Review indicated', 1);
    row += 1;

    writeSectionHeading(sheet, row, 'F', '4 · Forms potentially implicated');
    row += 1;
    writeNote(sheet, row, 'F', executiveSummary.potentialForms.join(' · '));
    sheet.getRow(row).height = 28;
    row += 2;

    writeSectionHeading(sheet, row, 'F', '5 · Questions requiring professional review');
    row += 1;
    executiveSummary.questions.forEach((question, index) => {
      writeNote(sheet, row, 'F', `${String(index + 1).padStart(2, '0')}. ${question}`);
      row += 1;
    });
    row += 1;

    writeSectionHeading(sheet, row, 'F', '6 · Basis of preparation');
    row += 1;
    const basis = [
      'This workbook is an educational analytical product. It does not provide tax, legal or financial advice, does not constitute a covered opinion, and cannot be relied on to avoid penalties.',
      'The client record is fictional and contains no taxpayer identification number, date of birth, address or account number.',
      'Findings are produced by deterministic rules with stated predicates, listed on sheet 07 with the government source behind each one. No part of the flagging logic is generated by a language model.',
      ...MODEL_LIMITATIONS,
    ];
    for (const line of basis) {
      writeNote(sheet, row, 'F', `— ${line}`);
      sheet.getRow(row).height = 26;
      row += 1;
    }
  }

  function writeAssumptions(
    sheet: ExcelJS.Worksheet,
    startRow: number,
    lastColumn: string,
    taxYear: typeof constants,
  ) {
    let row = startRow;
    writeSectionHeading(sheet, row, lastColumn, 'Assumptions and limitations');
    row += 1;
    const lines = [
      `All amounts are modeled ${taxYear.year} figures for a fictional client. Nothing here is drawn from a filed return.`,
      'Thresholds come from the tax year constants file, which records the government source and the date it was last verified. See sheet 07.',
      ...MODEL_LIMITATIONS,
    ];
    for (const line of lines) {
      writeNote(sheet, row, lastColumn, `— ${line}`);
      sheet.getRow(row).height = 24;
      row += 1;
    }
    return row;
  }
}
