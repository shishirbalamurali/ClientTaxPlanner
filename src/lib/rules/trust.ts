import { article, usd, pct } from '@/lib/format';
import { TRUST_KIND_LABELS } from '@/lib/labels';
import type { RuleDefinition } from './types';

export const TRUST_RULES: RuleDefinition[] = [
  {
    id: 'TRUST-1041-THRESHOLD',
    name: 'Fiduciary return filing threshold',
    module: 'trust',
    description:
      'Measures each non-grantor trust’s modeled gross income against the $600 filing threshold in the Form 1041 instructions.',
    test: 'non-grantor, non-charitable-remainder trust gross income >= $600',
    authorityIds: ['irs-i1041-filing-threshold'],
    evaluate: ({ trusts }) =>
      trusts.trusts
        .filter(
          (summary) =>
            !summary.isGrantorTrust &&
            summary.trust.kind !== 'charitableRemainderUnitrust' &&
            summary.meetsGrossIncomeFilingThreshold,
        )
        .map((summary) => ({
          id: `TRUST-1041-THRESHOLD:${summary.trust.id}`,
          ruleId: 'TRUST-1041-THRESHOLD',
          ruleName: 'Fiduciary return filing threshold',
          module: 'trust' as const,
          severity: 'review' as const,
          headline: `${summary.trust.name} meets the fiduciary return filing threshold`,
          clientFact: `Modeled gross income of ${usd(summary.grossIncome)} in ${summary.trust.name}, ${article(TRUST_KIND_LABELS[summary.trust.kind])} ${TRUST_KIND_LABELS[summary.trust.kind].toLowerCase()} sited in ${summary.trust.situs}.`,
          measurement: {
            label: 'Trust gross income',
            value: summary.grossIncome,
            threshold: trusts.filingThreshold,
            unit: 'usd' as const,
            comparison: 'atOrAbove' as const,
          },
          analysis: `A domestic trust files Form 1041 where it has any taxable income, gross income of ${usd(trusts.filingThreshold)} or more, or a nonresident alien beneficiary. Modeled gross income of ${usd(summary.grossIncome)} is above that threshold. This module reports composition and distribution figures only; it does not compute distributable net income or produce a return.`,
          potentialForms: ['Form 1041', 'Schedule K-1 (Form 1041)'],
          authorityIds: ['irs-i1041-filing-threshold', 'irc-661-distribution-deduction'],
          questionsForReview: [
            'Has the fiduciary confirmed the trust’s accounting income under the governing instrument and local law?',
            'Is a § 663(b) election to treat distributions made within 65 days as made in the prior year in view?',
          ],
          subjectId: summary.trust.id,
        })),
  },
  {
    id: 'TRUST-COMPRESSED-BRACKETS',
    name: 'Income retained above the top fiduciary bracket',
    module: 'trust',
    description:
      'Measures income retained at the trust level against the threshold at which the 37% fiduciary rate begins.',
    test: 'retained income after expenses and exemption > top fiduciary bracket threshold',
    authorityIds: ['rp-2024-40-estates-trusts', 'irc-661-distribution-deduction'],
    evaluate: ({ trusts }) =>
      trusts.trusts
        .filter(
          (summary) =>
            summary.trust.kind !== 'charitableRemainderUnitrust' &&
            summary.retainedIncomeAboveTopBracket > 0,
        )
        .map((summary) => ({
          id: `TRUST-COMPRESSED-BRACKETS:${summary.trust.id}`,
          ruleId: 'TRUST-COMPRESSED-BRACKETS',
          ruleName: 'Income retained above the top fiduciary bracket',
          module: 'trust' as const,
          severity: 'review' as const,
          headline: `${summary.trust.name} retains income at the top fiduciary rate`,
          clientFact: `${usd(summary.retainedIncome)} retained in ${summary.trust.name} against ${usd(summary.distributions)} distributed to beneficiaries.`,
          measurement: {
            label: 'Retained income above the top bracket',
            value: summary.retainedIncomeAboveTopBracket,
            threshold: trusts.topBracketThreshold,
            unit: 'usd' as const,
            comparison: 'exceeds' as const,
          },
          analysis: `Trusts reach the 37% rate at ${usd(trusts.topBracketThreshold)} of taxable income, a threshold an individual does not reach until ${usd(751_600)} on a joint return. ${usd(summary.retainedIncomeAboveTopBracket)} of retained income sits above that point, with an illustrative fiduciary tax of ${usd(summary.illustrativeFiduciaryTax)}. Distributions carry income out to beneficiaries taxed at their own rates, which is the standard response where the beneficiary's rate is lower.`,
          potentialForms: ['Form 1041', 'Schedule K-1 (Form 1041)'],
          authorityIds: ['rp-2024-40-estates-trusts', 'irc-661-distribution-deduction'],
          questionsForReview: [
            'Does the trustee have discretion to distribute, and is a distribution consistent with the settlor’s intent?',
            'What are the beneficiaries’ own marginal rates for the year?',
          ],
          subjectId: summary.trust.id,
        })),
  },
  {
    id: 'TRUST-NIIT',
    name: 'Net investment income tax at the trust level',
    module: 'trust',
    description:
      'Measures undistributed net investment income against the dollar amount at which the highest fiduciary bracket begins.',
    test: 'min(undistributed net investment income, fiduciary AGI − top bracket threshold) > 0',
    authorityIds: ['irc-1411-trust-threshold', 'irs-i8960-niit-computation'],
    evaluate: ({ constants, trusts }) =>
      trusts.trusts
        .filter(
          (summary) =>
            summary.trust.kind !== 'charitableRemainderUnitrust' &&
            summary.netInvestmentIncomeTaxBase > 0,
        )
        .map((summary) => ({
          id: `TRUST-NIIT:${summary.trust.id}`,
          ruleId: 'TRUST-NIIT',
          ruleName: 'Net investment income tax at the trust level',
          module: 'trust' as const,
          severity: 'review' as const,
          headline: `${summary.trust.name} has undistributed net investment income above the threshold`,
          clientFact: `${usd(summary.undistributedInvestmentIncome)} of undistributed investment income in ${summary.trust.name}.`,
          measurement: {
            label: 'Base subject to the 3.8% tax',
            value: summary.netInvestmentIncomeTaxBase,
            threshold: trusts.topBracketThreshold,
            unit: 'usd' as const,
            comparison: 'exceeds' as const,
          },
          analysis: `For a trust the 3.8% tax applies to the lesser of undistributed net investment income or adjusted gross income above ${usd(trusts.topBracketThreshold)}. The modeled base is ${usd(summary.netInvestmentIncomeTaxBase)}, or roughly ${usd(summary.netInvestmentIncomeTaxBase * constants.netInvestmentIncomeTax.rate)} of additional tax. The threshold is far below the ${usd(constants.netInvestmentIncomeTax.thresholds.marriedFilingJointly)} that applies to a joint return.`,
          potentialForms: ['Form 8960', 'Form 1041'],
          authorityIds: ['irc-1411-trust-threshold', 'irs-i8960-niit-computation'],
          questionsForReview: [
            'Would a distribution of investment income reduce the fiduciary-level base without creating a worse result for the beneficiary?',
            'Are capital gains allocated to income or to principal under the governing instrument?',
          ],
          subjectId: summary.trust.id,
        })),
  },
  {
    id: 'TRUST-CRT-5227',
    name: 'Charitable remainder trust reporting',
    module: 'trust',
    description:
      'Identifies charitable remainder trusts, which are generally exempt from income tax and file Form 5227 rather than Form 1041.',
    test: 'trust kind is a charitable remainder trust',
    authorityIds: ['irs-i5227-charitable-remainder', 'irc-664-crt-tiers'],
    evaluate: ({ trusts }) =>
      trusts.trusts
        .filter((summary) => summary.trust.kind === 'charitableRemainderUnitrust')
        .map((summary) => ({
          id: `TRUST-CRT-5227:${summary.trust.id}`,
          ruleId: 'TRUST-CRT-5227',
          ruleName: 'Charitable remainder trust reporting',
          module: 'trust' as const,
          severity: 'review' as const,
          headline: `${summary.trust.name} reports on Form 5227, not Form 1041`,
          clientFact: `${usd(summary.grossIncome)} of income in ${summary.trust.name}, with ${usd(summary.distributions)} paid to the noncharitable beneficiary.`,
          measurement: {
            label: 'Unitrust distributions',
            value: summary.distributions,
            threshold: 0,
            unit: 'usd' as const,
            comparison: 'exceeds' as const,
          },
          analysis: `A charitable remainder trust is generally exempt from income tax and files Form 5227. The compressed fiduciary rate schedule shown elsewhere in this module does not apply to it, and no fiduciary tax is modeled. What matters to the beneficiary is character: distributions carry out ordinary income first, then capital gain, then other income, then corpus, drawing on the trust\u2019s undistributed balances in each class. Unrelated business taxable income at the trust level is the usual exception to the exemption.`,
          potentialForms: ['Form 5227', 'Schedule K-1 (Form 1041)'],
          authorityIds: ['irs-i5227-charitable-remainder', 'irc-664-crt-tiers'],
          questionsForReview: [
            'What are the undistributed balances in each of the four income tiers?',
            'Did the trust have any unrelated business taxable income for the year?',
          ],
          subjectId: summary.trust.id,
        })),
  },
  {
    id: 'TRUST-NRA-BENEFICIARY',
    name: 'Nonresident alien beneficiary',
    module: 'trust',
    description:
      'Identifies trusts with a nonresident alien beneficiary, which triggers a filing requirement independent of the income thresholds.',
    test: 'domestic non-grantor trust has a nonresident alien beneficiary',
    authorityIds: ['irs-i1041-filing-threshold'],
    evaluate: ({ trusts }) =>
      trusts.trusts
        .filter(
          (summary) =>
            summary.trust.hasNonresidentAlienBeneficiary &&
            !summary.isGrantorTrust &&
            !summary.trust.isForeignTrust,
        )
        .map((summary) => ({
          id: `TRUST-NRA-BENEFICIARY:${summary.trust.id}`,
          ruleId: 'TRUST-NRA-BENEFICIARY',
          ruleName: 'Nonresident alien beneficiary',
          module: 'trust' as const,
          severity: 'review' as const,
          headline: `${summary.trust.name} has a beneficiary recorded as a nonresident alien`,
          clientFact: `${summary.trust.name} lists beneficiaries ${summary.trust.beneficiaries.join(', ')}, at least one of whom is recorded as a nonresident alien.`,
          measurement: {
            label: 'Nonresident alien beneficiaries',
            value: 1,
            threshold: 0,
            unit: 'count' as const,
            comparison: 'exceeds' as const,
          },
          analysis: `A domestic trust with a nonresident alien beneficiary must file Form 1041 regardless of its income. Distributions to that beneficiary raise separate withholding and reporting questions under chapters 3 and 4, which are outside the scope of this simulator.`,
          potentialForms: ['Form 1041', 'Form 1042-S', 'Schedule K-1 (Form 1041)'],
          authorityIds: ['irs-i1041-filing-threshold'],
          questionsForReview: [
            'Is withholding required on distributions of U.S. source income to the nonresident beneficiary?',
            'Does a treaty change the withholding rate?',
          ],
          subjectId: summary.trust.id,
        })),
  },
  {
    id: 'TRUST-GRANTOR-REPORTING',
    name: 'Grantor trust income reported by the grantor',
    module: 'trust',
    description:
      'Identifies trusts treated as owned by the grantor, whose income is reported on the grantor’s individual return.',
    test: 'trust kind is a grantor trust',
    authorityIds: ['irc-671-grantor-trust'],
    evaluate: ({ trusts }) =>
      trusts.trusts
        .filter((summary) => summary.isGrantorTrust && summary.grossIncome > 0)
        .map((summary) => ({
          id: `TRUST-GRANTOR-REPORTING:${summary.trust.id}`,
          ruleId: 'TRUST-GRANTOR-REPORTING',
          ruleName: 'Grantor trust income reported by the grantor',
          module: 'trust' as const,
          severity: 'monitor' as const,
          headline: `${summary.trust.name} income is reportable by the grantor`,
          clientFact: `${usd(summary.grossIncome)} of income in ${summary.trust.name}, ${article(TRUST_KIND_LABELS[summary.trust.kind])} ${TRUST_KIND_LABELS[summary.trust.kind].toLowerCase()} settled by ${summary.trust.grantor}.`,
          measurement: {
            label: 'Trust gross income',
            value: summary.grossIncome,
            threshold: 0,
            unit: 'usd' as const,
            comparison: 'exceeds' as const,
          },
          analysis: `Where the grantor is treated as owner of a portion of the trust, that portion's income, deductions and credits are reported on the grantor's own return rather than taxed to the trust. Confirm that the ${usd(summary.grossIncome)} shown here is already inside the individual income figures and is not being counted twice.`,
          potentialForms: ['Form 1040', 'Form 1041'],
          authorityIds: ['irc-671-grantor-trust'],
          questionsForReview: [
            'Which grantor trust power applies, and does it cover the whole trust or only a portion?',
            'Is the trust filing an information-only Form 1041 or using an alternative reporting method?',
          ],
          subjectId: summary.trust.id,
        })),
  },
  {
    id: 'TRUST-DISTRIBUTION-TIE-OUT',
    name: 'Trust distributions against individual income',
    module: 'trust',
    description:
      'Compares distributions recorded at the trust level with trust income reported on the client’s individual record.',
    test: 'absolute difference between non-grantor trust distributions and reported trust distribution income > $1,000',
    authorityIds: ['irc-661-distribution-deduction', 'irs-i1041-filing-threshold'],
    evaluate: ({ client, trusts }) => {
      const nonGrantorDistributions = trusts.trusts
        .filter((summary) => !summary.isGrantorTrust)
        .reduce((sum, summary) => sum + summary.distributions, 0);
      if (nonGrantorDistributions === 0 && client.income.trustDistributions === 0) return [];
      const difference = nonGrantorDistributions - client.income.trustDistributions;
      if (Math.abs(difference) <= 1_000) return [];
      return [
        {
          id: 'TRUST-DISTRIBUTION-TIE-OUT',
          ruleId: 'TRUST-DISTRIBUTION-TIE-OUT',
          ruleName: 'Trust distributions against individual income',
          module: 'trust',
          severity: 'monitor',
          headline: 'Trust distributions do not tie to reported individual trust income',
          clientFact: `${usd(nonGrantorDistributions)} distributed by non-grantor trusts against ${usd(client.income.trustDistributions)} of trust income on the individual record.`,
          measurement: {
            label: 'Difference',
            value: Math.abs(difference),
            threshold: 1_000,
            unit: 'usd',
            comparison: 'exceeds',
          },
          analysis: `The two figures need not match: distributions to other beneficiaries, distributions of principal and the limits of distributable net income all produce legitimate differences. The item is raised so the difference of ${usd(Math.abs(difference))} is explained rather than assumed.`,
          potentialForms: ['Schedule K-1 (Form 1041)', 'Schedule E (Form 1040)'],
          authorityIds: ['irc-661-distribution-deduction', 'irs-i1041-filing-threshold'],
          questionsForReview: [
            'Are there co-beneficiaries receiving part of the distributions?',
            'Do any distributions represent principal rather than distributable net income?',
          ],
        },
      ];
    },
  },
  {
    id: 'TRUST-CAPITAL-GAIN-ALLOCATION',
    name: 'Capital gain allocation between income and principal',
    module: 'trust',
    description:
      'Identifies trusts with material capital gain allocated to principal, which is ordinarily excluded from distributable net income and taxed at the fiduciary level.',
    test: 'capital gains > 20% of trust gross income and capital gains not allocated to income',
    authorityIds: ['irc-661-distribution-deduction', 'rp-2024-40-estates-trusts'],
    evaluate: ({ trusts }) =>
      trusts.trusts
        .filter(
          (summary) =>
            !summary.trust.capitalGainsAllocatedToIncome &&
            summary.grossIncome > 0 &&
            summary.trust.income.capitalGains / summary.grossIncome > 0.2,
        )
        .map((summary) => ({
          id: `TRUST-CAPITAL-GAIN-ALLOCATION:${summary.trust.id}`,
          ruleId: 'TRUST-CAPITAL-GAIN-ALLOCATION',
          ruleName: 'Capital gain allocation between income and principal',
          module: 'trust' as const,
          severity: 'monitor' as const,
          headline: `${summary.trust.name} retains capital gain in principal`,
          clientFact: `${usd(summary.trust.income.capitalGains)} of capital gain, ${pct(summary.trust.income.capitalGains / summary.grossIncome)} of ${summary.trust.name}'s gross income, allocated to principal.`,
          measurement: {
            label: 'Capital gain share of trust income',
            value: summary.trust.income.capitalGains / summary.grossIncome,
            threshold: 0.2,
            unit: 'percent' as const,
            comparison: 'exceeds' as const,
          },
          analysis: `Capital gain allocated to principal is ordinarily excluded from distributable net income, so it stays behind and is taxed at the compressed fiduciary rates even where the trust distributes all of its accounting income. Whether the governing instrument or local law permits a different allocation is a drafting and state law question, not an arithmetic one.`,
          potentialForms: ['Form 1041', 'Schedule D (Form 1041)'],
          authorityIds: ['irc-661-distribution-deduction', 'rp-2024-40-estates-trusts'],
          questionsForReview: [
            'Does the instrument or the state principal and income act permit gains to be allocated to income?',
            'Has the trustee followed a consistent practice in prior years?',
          ],
          subjectId: summary.trust.id,
        })),
  },
];
