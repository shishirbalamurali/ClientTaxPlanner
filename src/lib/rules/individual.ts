import { usd, pct } from '@/lib/format';
import type { RuleDefinition } from './types';

export const INDIVIDUAL_RULES: RuleDefinition[] = [
  {
    id: 'IND-NIIT',
    name: 'Net investment income tax exposure',
    module: 'individual',
    description:
      'Compares modeled adjusted gross income with the § 1411 threshold for the filing status and measures the base subject to the 3.8% tax.',
    test: 'min(net investment income, AGI − § 1411 threshold) > 0',
    authorityIds: ['irc-1411-niit', 'irs-i8960-niit-computation'],
    evaluate: ({ client, constants, federal }) => {
      const threshold = constants.netInvestmentIncomeTax.thresholds[client.filingStatus];
      if (federal.netInvestmentIncomeTaxBase <= 0) return [];
      return [
        {
          id: 'IND-NIIT',
          ruleId: 'IND-NIIT',
          ruleName: 'Net investment income tax exposure',
          module: 'individual',
          severity: 'review',
          headline: 'Modeled income exceeds the net investment income tax threshold',
          clientFact: `Modeled adjusted gross income of ${usd(federal.adjustedGrossIncome)} against net investment income of ${usd(federal.income.netInvestmentIncome)}.`,
          measurement: {
            label: 'Base subject to the 3.8% tax',
            value: federal.netInvestmentIncomeTaxBase,
            threshold,
            unit: 'usd',
            comparison: 'exceeds',
          },
          analysis: `The tax applies to the lesser of net investment income or adjusted gross income above ${usd(threshold)}. On modeled figures the base is ${usd(federal.netInvestmentIncomeTaxBase)}, producing ${usd(federal.netInvestmentIncomeTax)} of additional tax. Properly allocable deductions were not modeled and would reduce the base.`,
          potentialForms: ['Form 8960'],
          authorityIds: ['irc-1411-niit', 'irs-i8960-niit-computation'],
          questionsForReview: [
            'Which investment expenses are properly allocable against net investment income?',
            'Is any rental activity a trade or business in which the client materially participates?',
          ],
        },
      ];
    },
  },
  {
    id: 'IND-MEDICARE',
    name: 'Additional Medicare tax on earned income',
    module: 'individual',
    description:
      'Measures wages, bonus and equity compensation against the § 3101(b)(2) threshold for the filing status.',
    test: 'wages + bonus + equity compensation > § 3101(b)(2) threshold',
    authorityIds: ['irc-3101b-additional-medicare'],
    evaluate: ({ client, constants, federal }) => {
      const threshold = constants.additionalMedicareTax.thresholds[client.filingStatus];
      const earned = federal.income.earnedIncome;
      if (earned <= threshold) return [];
      return [
        {
          id: 'IND-MEDICARE',
          ruleId: 'IND-MEDICARE',
          ruleName: 'Additional Medicare tax on earned income',
          module: 'individual',
          severity: 'monitor',
          headline: 'Earned income exceeds the additional Medicare tax threshold',
          clientFact: `Modeled employment income of ${usd(earned)} (wages, bonus and equity compensation).`,
          measurement: {
            label: 'Employment income',
            value: earned,
            threshold,
            unit: 'usd',
            comparison: 'exceeds',
          },
          analysis: `Earned income above ${usd(threshold)} carries the 0.9% additional Medicare tax, ${usd(federal.additionalMedicareTax)} on modeled figures. Employers withhold only once an individual's wages pass $200,000, so a married couple with two earners frequently finds a balance due at filing.`,
          potentialForms: ['Form 8959'],
          authorityIds: ['irc-3101b-additional-medicare'],
          questionsForReview: [
            'Do combined household wages exceed the joint threshold while neither employer withheld the additional tax?',
          ],
        },
      ];
    },
  },
  {
    id: 'IND-TOP-BRACKET',
    name: 'Ordinary income in the top marginal bracket',
    module: 'individual',
    description:
      'Compares modeled ordinary taxable income with the floor of the 37% bracket for the filing status.',
    test: 'ordinary taxable income > floor of the highest rate bracket',
    authorityIds: ['rp-2024-40-rate-schedules'],
    evaluate: ({ client, constants, federal }) => {
      const brackets = constants.ordinaryRates[client.filingStatus];
      const topBracket = brackets[brackets.length - 1];
      if (!topBracket || federal.ordinaryTaxableIncome <= topBracket.floor) return [];
      return [
        {
          id: 'IND-TOP-BRACKET',
          ruleId: 'IND-TOP-BRACKET',
          ruleName: 'Ordinary income in the top marginal bracket',
          module: 'individual',
          severity: 'monitor',
          headline: `Ordinary income reaches the ${pct(topBracket.rate, 1)} bracket`,
          clientFact: `Modeled ordinary taxable income of ${usd(federal.ordinaryTaxableIncome)}.`,
          measurement: {
            label: 'Ordinary taxable income',
            value: federal.ordinaryTaxableIncome,
            threshold: topBracket.floor,
            unit: 'usd',
            comparison: 'exceeds',
          },
          analysis: `The ${pct(topBracket.rate, 1)} bracket begins at ${usd(topBracket.floor)} for this filing status. Deferral, timing of discretionary income and the character of realized gain all move dollars against this rate, which is the reference point for the scenario comparisons.`,
          potentialForms: ['Form 1040'],
          authorityIds: ['rp-2024-40-rate-schedules'],
          questionsForReview: [
            'Is any income item eligible for deferral into a later year?',
            'Does the client expect a materially different marginal rate next year?',
          ],
        },
      ];
    },
  },
  {
    id: 'IND-CG-TOP-RATE',
    name: 'Capital gain taxed at the 20% rate',
    module: 'individual',
    description:
      'Stacks long-term gain and qualified dividends above ordinary taxable income and measures the portion above the 15% breakpoint.',
    test: 'adjusted net capital gain stacked above ordinary income exceeds the maximum 15% rate amount',
    authorityIds: ['rp-2024-40-capital-gains', 'irs-tc409-capital-gains'],
    evaluate: ({ client, constants, federal }) => {
      const { atTwenty } = federal.capitalGainDetail;
      if (atTwenty <= 0) return [];
      const breakpoints = constants.capitalGainBreakpoints[client.filingStatus];
      return [
        {
          id: 'IND-CG-TOP-RATE',
          ruleId: 'IND-CG-TOP-RATE',
          ruleName: 'Capital gain taxed at the 20% rate',
          module: 'individual',
          severity: 'monitor',
          headline: 'Part of the modeled long-term gain falls in the 20% band',
          clientFact: `Long-term capital gain of ${usd(federal.income.longTermCapitalGain)} and qualified dividends of ${usd(client.income.qualifiedDividends)}.`,
          measurement: {
            label: 'Gain above the 15% breakpoint',
            value: atTwenty,
            threshold: breakpoints.maximumFifteenPercentAmount,
            unit: 'usd',
            comparison: 'exceeds',
          },
          analysis: `${usd(atTwenty)} of adjusted net capital gain sits above the ${usd(breakpoints.maximumFifteenPercentAmount)} breakpoint and is modeled at 20%. With the 3.8% net investment income tax the combined federal rate on that layer is 23.8% before state tax.`,
          potentialForms: ['Schedule D (Form 1040)', 'Form 8949'],
          authorityIds: ['rp-2024-40-capital-gains', 'irs-tc409-capital-gains'],
          questionsForReview: [
            'Are there realized or unrealized losses available to offset the gain?',
            'Would spreading the disposition across two tax years change the applicable rate band?',
          ],
        },
      ];
    },
  },
  {
    id: 'IND-SHORT-TERM-GAIN',
    name: 'Short-term gain taxed at ordinary rates',
    module: 'individual',
    description:
      'Identifies short-term capital gain, which receives no preferential rate, where it is a meaningful share of total gain.',
    test: 'short-term capital gain > 0 and > 15% of net capital gain',
    authorityIds: ['irs-tc409-capital-gains', 'irs-p550-investment-income'],
    evaluate: ({ federal }) => {
      const { shortTermCapitalGain, netCapitalGain } = federal.income;
      if (shortTermCapitalGain <= 0 || netCapitalGain <= 0) return [];
      const share = shortTermCapitalGain / netCapitalGain;
      if (share <= 0.15) return [];
      return [
        {
          id: 'IND-SHORT-TERM-GAIN',
          ruleId: 'IND-SHORT-TERM-GAIN',
          ruleName: 'Short-term gain taxed at ordinary rates',
          module: 'individual',
          severity: 'monitor',
          headline: 'Short-term gain is a material share of realized gain',
          clientFact: `Short-term capital gain of ${usd(shortTermCapitalGain)} out of ${usd(netCapitalGain)} of net capital gain.`,
          measurement: {
            label: 'Short-term share of net capital gain',
            value: share,
            threshold: 0.15,
            unit: 'percent',
            comparison: 'exceeds',
          },
          analysis: `Short-term gain is taxed at ordinary rates and carries no preferential treatment, so ${pct(share)} of realized gain is being taxed at up to ${pct(federal.marginalOrdinaryRate)} rather than 20%. Holding period documentation and lot selection are the usual first questions.`,
          potentialForms: ['Form 8949', 'Schedule D (Form 1040)'],
          authorityIds: ['irs-tc409-capital-gains', 'irs-p550-investment-income'],
          questionsForReview: [
            'Were specific lots identified at the time of sale?',
            'Do any positions sold at a loss fall within a wash sale window?',
          ],
        },
      ];
    },
  },
  {
    id: 'IND-AMT-SCREEN',
    name: 'Alternative minimum tax screen',
    module: 'individual',
    description:
      'Compares modeled income with the point at which the AMT exemption begins to phase out, so a Form 6251 computation is run rather than assumed away.',
    test: 'adjusted gross income >= § 55(d)(2) exemption phaseout threshold',
    authorityIds: ['rp-2024-40-amt', 'irs-i6251-amt-preferences'],
    evaluate: ({ client, constants, federal }) => {
      const threshold =
        constants.alternativeMinimumTax.exemptionPhaseoutThreshold[client.filingStatus];
      if (federal.adjustedGrossIncome < threshold) return [];
      const exemption = constants.alternativeMinimumTax.exemption[client.filingStatus];
      const municipal = client.income.taxExemptInterest;
      return [
        {
          id: 'IND-AMT-SCREEN',
          ruleId: 'IND-AMT-SCREEN',
          ruleName: 'Alternative minimum tax screen',
          module: 'individual',
          severity: 'monitor',
          headline: 'Income is above the point at which the AMT exemption phases out',
          clientFact: `Modeled adjusted gross income of ${usd(federal.adjustedGrossIncome)} against a ${usd(threshold)} exemption phaseout threshold.`,
          measurement: {
            label: 'Adjusted gross income',
            value: federal.adjustedGrossIncome,
            threshold,
            unit: 'usd',
            comparison: 'atOrAbove',
          },
          analysis: `The ${usd(exemption)} exemption is reduced by 25 cents for every dollar of alternative minimum taxable income above ${usd(threshold)} and is exhausted well below this client's income. ${municipal > 0 ? `The record also shows ${usd(municipal)} of tax-exempt interest, part of which may be private activity bond interest and therefore a preference item. ` : ''}This simulator does not compute a tentative minimum tax; the item is raised so the preparer runs Form 6251 rather than relying on the regular-tax figures shown here.`,
          potentialForms: ['Form 6251'],
          authorityIds: ['rp-2024-40-amt', 'irs-i6251-amt-preferences'],
          questionsForReview: [
            'Were incentive stock options exercised and held through year end?',
            municipal > 0
              ? 'How much of the tax-exempt interest is private activity bond interest?'
              : 'Are there other timing preferences, such as depreciation or intangible drilling costs?',
            'Is there an AMT credit carryforward from a prior year?',
          ],
        },
      ];
    },
  },
  {
    id: 'IND-QBI-THRESHOLD',
    name: 'Qualified business income above the threshold amount',
    module: 'individual',
    description:
      'Identifies clients with pass-through business income whose taxable income exceeds the § 199A threshold, where the wage and property limits and the SSTB exclusion begin to apply.',
    test: 'business income > 0 and taxable income > § 199A(e)(2) threshold amount',
    authorityIds: ['rp-2024-40-199a', 'irc-199a'],
    evaluate: ({ client, constants, federal }) => {
      if (client.income.businessIncome <= 0) return [];
      const threshold = constants.qualifiedBusinessIncome.thresholdAmount[client.filingStatus];
      const ceiling = constants.qualifiedBusinessIncome.phaseInCeiling[client.filingStatus];
      if (federal.taxableIncome <= threshold) return [];
      const fullyPhased = federal.taxableIncome >= ceiling;
      return [
        {
          id: 'IND-QBI-THRESHOLD',
          ruleId: 'IND-QBI-THRESHOLD',
          ruleName: 'Qualified business income above the threshold amount',
          module: 'individual',
          severity: 'review',
          headline: 'Section 199A limitations apply at this income level',
          clientFact: `Pass-through business income of ${usd(client.income.businessIncome)} with modeled taxable income of ${usd(federal.taxableIncome)}.`,
          measurement: {
            label: 'Taxable income',
            value: federal.taxableIncome,
            threshold,
            unit: 'usd',
            comparison: 'exceeds',
          },
          analysis: `The threshold amount is ${usd(threshold)} and the phase-in range ends at ${usd(ceiling)}. ${fullyPhased ? 'Taxable income is above the range, so the W-2 wage and qualified property limitations apply in full and a specified service trade or business is excluded entirely.' : 'Taxable income is inside the phase-in range, so the limitations apply on a pro rata basis.'} The deduction is not computed in this model because it depends on entity-level wage and basis figures not carried in the client record.`,
          potentialForms: ['Form 8995-A'],
          authorityIds: ['rp-2024-40-199a', 'irc-199a'],
          questionsForReview: [
            'Is the activity a specified service trade or business?',
            'What are the entity’s W-2 wages and unadjusted basis in qualified property?',
            'Should any commonly controlled activities be aggregated?',
          ],
        },
      ];
    },
  },
  {
    id: 'IND-CONCENTRATION',
    name: 'Concentrated equity position',
    module: 'individual',
    description:
      'Measures single-position exposure as a share of the marketable portfolio.',
    test: 'largest concentrated position > 20% of (marketable portfolio + concentrated positions)',
    authorityIds: ['irs-tc409-capital-gains', 'irc-1091-wash-sale'],
    evaluate: ({ client }) => {
      const positions = client.balanceSheet.concentratedPositions;
      if (positions.length === 0) return [];
      const concentratedValue = positions.reduce((sum, p) => sum + p.marketValue, 0);
      const investable = client.balanceSheet.marketablePortfolio + concentratedValue;
      if (investable <= 0) return [];
      const largest = positions.reduce((a, b) => (a.marketValue >= b.marketValue ? a : b));
      const share = largest.marketValue / investable;
      if (share <= 0.2) return [];
      const embeddedGain = largest.marketValue - largest.costBasis;
      return [
        {
          id: 'IND-CONCENTRATION',
          ruleId: 'IND-CONCENTRATION',
          ruleName: 'Concentrated equity position',
          module: 'individual',
          severity: 'monitor',
          headline: 'Single position exceeds one fifth of the investable portfolio',
          clientFact: `${largest.label} carried at ${usd(largest.marketValue)} against a ${usd(investable)} investable portfolio, with ${usd(embeddedGain)} of embedded gain.`,
          measurement: {
            label: 'Share of investable portfolio',
            value: share,
            threshold: 0.2,
            unit: 'percent',
            comparison: 'exceeds',
          },
          analysis: `The position was acquired through ${largest.acquiredVia.toLowerCase()}. Unwinding it realizes gain against a ${usd(largest.costBasis)} basis, which interacts with the capital gain rate band and the net investment income tax. Contribution of appreciated shares to charity and staged disposition are the two levers modeled in the scenario module.`,
          potentialForms: ['Form 8949', 'Form 8283'],
          authorityIds: ['irs-tc409-capital-gains', 'irc-1091-wash-sale'],
          questionsForReview: [
            'Are the shares subject to a trading window, lock-up or Rule 144 volume limit?',
            'Does any part of the position qualify under § 1202?',
          ],
        },
      ];
    },
  },
  {
    id: 'IND-ESTIMATED-TAX',
    name: 'Estimated tax safe harbor',
    module: 'compliance',
    description:
      'Applies the § 6654(d)(1)(C) high-income safe harbor where prior year adjusted gross income exceeded $150,000.',
    test: 'prior year AGI > $150,000',
    authorityIds: ['irc-6654-safe-harbor', 'irs-p505-withholding'],
    evaluate: ({ client, constants }) => {
      const { highIncomeAgiThreshold, highIncomeSafeHarborRate, currentYearSafeHarborRate } =
        constants.estimatedTax;
      if (client.priorYearAdjustedGrossIncome <= highIncomeAgiThreshold) return [];
      return [
        {
          id: 'IND-ESTIMATED-TAX',
          ruleId: 'IND-ESTIMATED-TAX',
          ruleName: 'Estimated tax safe harbor',
          module: 'compliance',
          severity: 'review',
          headline: 'Prior year income triggers the 110% safe harbor',
          clientFact: `Prior year adjusted gross income of ${usd(client.priorYearAdjustedGrossIncome)}.`,
          measurement: {
            label: 'Prior year adjusted gross income',
            value: client.priorYearAdjustedGrossIncome,
            threshold: highIncomeAgiThreshold,
            unit: 'usd',
            comparison: 'exceeds',
          },
          analysis: `Because prior year adjusted gross income exceeded ${usd(highIncomeAgiThreshold)}, the prior-year safe harbor rises from 100% to ${pct(highIncomeSafeHarborRate, 1)} of the prior year tax. The alternative is ${pct(currentYearSafeHarborRate, 1)} of the current year tax, which is harder to rely on where income is driven by realized gain and equity vesting.`,
          potentialForms: ['Form 1040-ES', 'Form 2210'],
          authorityIds: ['irc-6654-safe-harbor', 'irs-p505-withholding'],
          questionsForReview: [
            'What was the prior year total tax, and does withholding plus estimates reach 110% of it?',
            'Should year-end withholding be increased instead of a fourth quarter estimate?',
          ],
        },
      ];
    },
  },
  {
    id: 'IND-SUPPLEMENTAL-WITHHOLDING',
    name: 'Supplemental wage withholding shortfall',
    module: 'compliance',
    description:
      'Flags equity compensation and bonus income where the flat supplemental withholding rate is below the modeled marginal rate.',
    test: 'bonus + equity compensation > $250,000 and marginal ordinary rate > 22%',
    authorityIds: ['irs-p505-withholding'],
    evaluate: ({ client, federal }) => {
      const supplemental = client.income.bonus + client.income.equityCompensation;
      if (supplemental <= 250_000 || federal.marginalOrdinaryRate <= 0.22) return [];
      const gap = supplemental * (federal.marginalOrdinaryRate - 0.22);
      return [
        {
          id: 'IND-SUPPLEMENTAL-WITHHOLDING',
          ruleId: 'IND-SUPPLEMENTAL-WITHHOLDING',
          ruleName: 'Supplemental wage withholding shortfall',
          module: 'compliance',
          severity: 'monitor',
          headline: 'Flat supplemental withholding sits below the modeled marginal rate',
          clientFact: `Bonus and equity compensation of ${usd(supplemental)} with a modeled marginal ordinary rate of ${pct(federal.marginalOrdinaryRate)}.`,
          measurement: {
            label: 'Supplemental compensation',
            value: supplemental,
            threshold: 250_000,
            unit: 'usd',
            comparison: 'exceeds',
          },
          analysis: `Supplemental wages are withheld at a flat 22% up to $1,000,000 and 37% above that amount. Against a ${pct(federal.marginalOrdinaryRate)} marginal rate the modeled shortfall on the first $1,000,000 layer is on the order of ${usd(Math.min(gap, 1_000_000 * (federal.marginalOrdinaryRate - 0.22)))}, which has to be covered by other withholding or estimated payments.`,
          potentialForms: ['Form W-4', 'Form 1040-ES'],
          authorityIds: ['irs-p505-withholding'],
          questionsForReview: [
            'Did the employer withhold at the flat rate or at the elected W-4 rate?',
            'Were shares sold to cover at vest, and at what rate?',
          ],
        },
      ];
    },
  },
];
