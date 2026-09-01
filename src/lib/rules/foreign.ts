import { article, usd, pct } from '@/lib/format';
import { FOREIGN_ENTITY_LABELS } from '@/lib/labels';
import type { RuleDefinition } from './types';

export const FOREIGN_RULES: RuleDefinition[] = [
  {
    id: 'FBAR-AGGREGATE',
    name: 'FBAR aggregate account threshold',
    module: 'foreign',
    description:
      'Sums the maximum calendar-year value of every recorded foreign financial account, including accounts held only under signature authority, and compares the total with the $10,000 aggregate threshold.',
    test: 'sum of maximum account values > $10,000',
    authorityIds: ['fincen-114-threshold', 'irs-fbar-overview'],
    evaluate: ({ foreign }) => {
      if (!foreign.fbarReviewFlag) return [];
      const countries = foreign.countries.map((c) => c.country).join(', ');
      return [
        {
          id: 'FBAR-AGGREGATE',
          ruleId: 'FBAR-AGGREGATE',
          ruleName: 'FBAR aggregate account threshold',
          module: 'foreign',
          severity: 'review',
          headline: 'Aggregate foreign account values exceed the FBAR threshold',
          clientFact: `${foreign.accountCount} foreign financial account${foreign.accountCount === 1 ? '' : 's'} in ${countries}, with an aggregate maximum value of ${usd(foreign.aggregateMaximumValue)}.`,
          measurement: {
            label: 'Aggregate maximum value',
            value: foreign.aggregateMaximumValue,
            threshold: foreign.fbarThreshold,
            unit: 'usd',
            comparison: 'exceeds',
          },
          analysis: `The test is applied to the aggregate of all reportable accounts rather than account by account, so an account well under ${usd(foreign.fbarThreshold)} is still reported once the aggregate is exceeded. The largest single account is ${usd(foreign.largestAccountValue)}. The FBAR is filed with FinCEN through the BSA E-Filing System, separately from the income tax return, and is due April 15 with an automatic extension to October 15.`,
          potentialForms: ['FinCEN Form 114'],
          authorityIds: ['fincen-114-threshold', 'irs-fbar-overview'],
          questionsForReview: [
            'Are maximum values supported by periodic statements rather than year-end balances?',
            'Which exchange rate was used to convert each account to U.S. dollars?',
            'Are there accounts the client does not consider "theirs", such as an employer account or a parent’s account held jointly?',
          ],
        },
      ];
    },
  },
  {
    id: 'FBAR-SIGNATURE-AUTHORITY',
    name: 'Accounts held under signature authority only',
    module: 'foreign',
    description:
      'Identifies accounts over which the client has signature authority but no financial interest, which are reportable but are counted differently for Form 8938.',
    test: 'any account with interest type signature authority only',
    authorityIds: ['fincen-114-threshold', 'form-8938-thresholds'],
    evaluate: ({ foreign }) => {
      if (foreign.signatureAuthorityOnlyCount === 0) return [];
      const accounts = foreign.accounts.filter(
        (account) => account.interestType === 'signatureAuthorityOnly',
      );
      const total = accounts.reduce((sum, account) => sum + account.maximumValueUSD, 0);
      return [
        {
          id: 'FBAR-SIGNATURE-AUTHORITY',
          ruleId: 'FBAR-SIGNATURE-AUTHORITY',
          ruleName: 'Accounts held under signature authority only',
          module: 'foreign',
          severity: 'monitor',
          headline: 'Signature authority accounts are reportable for FBAR but not for Form 8938',
          clientFact: `${accounts.length} account${accounts.length === 1 ? '' : 's'} totalling ${usd(total)} held under signature authority without a financial interest: ${accounts.map((a) => a.institution).join(', ')}.`,
          measurement: {
            label: 'Signature authority account values',
            value: total,
            threshold: 0,
            unit: 'usd',
            comparison: 'exceeds',
          },
          analysis: `Signature authority alone creates an FBAR obligation. Form 8938 reaches specified foreign financial assets in which the taxpayer has an interest, so an account held only under signature authority is generally outside it. The two regimes are measured on different bases, which is why the aggregate excluding these accounts (${usd(foreign.aggregateMaximumExcludingSignatureAuthority)}) is tracked separately here.`,
          potentialForms: ['FinCEN Form 114'],
          authorityIds: ['fincen-114-threshold', 'form-8938-thresholds'],
          questionsForReview: [
            'Does an employer filing relieve the client of the individual FBAR obligation for these accounts?',
          ],
        },
      ];
    },
  },
  {
    id: 'FATCA-8938',
    name: 'Form 8938 reporting threshold',
    module: 'foreign',
    description:
      'Compares year-end and maximum foreign asset values with the § 6038D thresholds for the filing status and residence.',
    test: 'year-end value > year-end threshold or maximum value > any-time threshold',
    authorityIds: ['form-8938-thresholds'],
    evaluate: ({ client, foreign }) => {
      if (!foreign.form8938ReviewFlag) return [];
      const basis = foreign.form8938Basis === 'livingAbroad' ? 'living abroad' : 'living in the United States';
      return [
        {
          id: 'FATCA-8938',
          ruleId: 'FATCA-8938',
          ruleName: 'Form 8938 reporting threshold',
          module: 'foreign',
          severity: 'review',
          headline: 'Specified foreign financial assets exceed the Form 8938 threshold',
          clientFact: `Year-end foreign account value of ${usd(foreign.aggregateYearEndValue)} and maximum value of ${usd(foreign.aggregateMaximumValue)} for a taxpayer ${basis}.`,
          measurement: {
            label: 'Year-end foreign asset value',
            value: foreign.aggregateYearEndValue,
            threshold: foreign.form8938YearEndThreshold,
            unit: 'usd',
            comparison:
              foreign.aggregateYearEndValue > foreign.form8938YearEndThreshold ? 'exceeds' : 'below',
          },
          analysis: `The applicable thresholds are ${usd(foreign.form8938YearEndThreshold)} on the last day of the year and ${usd(foreign.form8938AnyTimeThreshold)} at any time during the year for this filing status and residence. Either test triggers the requirement. Form 8938 is filed with the income tax return and does not replace the FBAR; the same account is commonly reported on both. Foreign interests in ${client.foreignEntities.length > 0 ? 'entities recorded on this file' : 'non-account assets'} may also be specified foreign financial assets.`,
          potentialForms: ['Form 8938'],
          authorityIds: ['form-8938-thresholds', 'fincen-114-threshold'],
          questionsForReview: [
            'Are there foreign non-account assets, such as directly held foreign stock or a foreign partnership interest, that also count toward the threshold?',
            'Does the client hold any specified asset through a foreign entity?',
          ],
        },
      ];
    },
  },
  {
    id: 'FOREIGN-PFIC',
    name: 'Passive foreign investment company exposure',
    module: 'foreign',
    description:
      'Identifies pooled non-U.S. investment funds and recorded PFIC interests, which generally carry an annual Form 8621 obligation.',
    test: 'any pooled investment fund account or recorded PFIC interest',
    authorityIds: ['irs-i8621-pfic'],
    evaluate: ({ client, foreign }) => {
      const pficEntities = client.foreignEntities.filter(
        (entity) => entity.kind === 'passiveForeignInvestmentCompany',
      );
      if (foreign.pooledFundAccounts.length === 0 && pficEntities.length === 0) return [];
      const accountValue = foreign.pooledFundAccounts.reduce(
        (sum, account) => sum + account.maximumValueUSD,
        0,
      );
      const entityValue = pficEntities.reduce((sum, entity) => sum + entity.valueUSD, 0);
      const names = [
        ...foreign.pooledFundAccounts.map((a) => a.institution),
        ...pficEntities.map((e) => e.name),
      ];
      return [
        {
          id: 'FOREIGN-PFIC',
          ruleId: 'FOREIGN-PFIC',
          ruleName: 'Passive foreign investment company exposure',
          module: 'foreign',
          severity: 'review',
          headline: 'Holdings meet the profile of a passive foreign investment company',
          clientFact: `${names.join(', ')} recorded at ${usd(accountValue + entityValue)} in aggregate.`,
          measurement: {
            label: 'Pooled foreign fund value',
            value: accountValue + entityValue,
            threshold: 0,
            unit: 'usd',
            comparison: 'exceeds',
          },
          analysis: `Non-U.S. pooled investment vehicles, including most foreign mutual funds and many unit trusts, meet the PFIC definition. A shareholder generally files Form 8621 annually. Absent a qualified electing fund or mark-to-market election, the default § 1291 regime taxes excess distributions and disposition gain at the highest ordinary rate for the year allocated to, with an interest charge. Whether an election is available depends on information the fund must supply.`,
          potentialForms: ['Form 8621'],
          authorityIds: ['irs-i8621-pfic', 'form-8938-thresholds'],
          questionsForReview: [
            'Does the fund provide a PFIC annual information statement supporting a qualifying electing fund election?',
            'Has an election been made in a prior year, and is it still in force?',
          ],
        },
      ];
    },
  },
  {
    id: 'FOREIGN-5471',
    name: 'Interest in a foreign corporation',
    module: 'foreign',
    description:
      'Identifies recorded ownership in a foreign corporation at or above the 10% reporting level.',
    test: 'ownership in a foreign corporation >= 10%',
    authorityIds: ['irs-i5471-foreign-corporation'],
    evaluate: ({ client, constants }) => {
      const threshold =
        constants.foreignReporting.controlledForeignCorporationOwnershipThreshold;
      const holdings = client.foreignEntities.filter(
        (entity) =>
          entity.kind === 'foreignCorporation' && entity.ownershipPercent >= threshold,
      );
      return holdings.map((entity) => ({
        id: `FOREIGN-5471:${entity.id}`,
        ruleId: 'FOREIGN-5471',
        ruleName: 'Interest in a foreign corporation',
        module: 'foreign' as const,
        severity: 'review' as const,
        headline: `Recorded interest in ${entity.name} meets the Form 5471 reporting level`,
        clientFact: `${pct(entity.ownershipPercent)} interest in ${entity.name}, ${article(FOREIGN_ENTITY_LABELS[entity.kind])} ${FOREIGN_ENTITY_LABELS[entity.kind].toLowerCase()} organised in ${entity.country}, carried at ${usd(entity.valueUSD)}.`,
        measurement: {
          label: 'Ownership percentage',
          value: entity.ownershipPercent,
          threshold,
          unit: 'percent' as const,
          comparison: 'atOrAbove' as const,
        },
        analysis: `A U.S. person owning ${pct(threshold, 1)} or more of a foreign corporation is generally a Form 5471 filer, with the category of filer determining which schedules are required. Where the corporation is a controlled foreign corporation, subpart F and global intangible low-taxed income inclusions may arise even without a distribution. Constructive ownership through family members and entities has to be tested before the category is settled.`,
        potentialForms: ['Form 5471', 'Form 8992'],
        authorityIds: ['irs-i5471-foreign-corporation', 'irs-i1116-foreign-tax-credit'],
        questionsForReview: [
          'What is the client’s filer category after applying the constructive ownership rules?',
          'Is the corporation a controlled foreign corporation on a combined U.S. shareholder basis?',
        ],
        subjectId: entity.id,
      }));
    },
  },
  {
    id: 'FOREIGN-3520-TRUST',
    name: 'Foreign trust reporting',
    module: 'foreign',
    description:
      'Identifies foreign trusts on the client record, which carry separate information reporting independent of the fiduciary return rules.',
    test: 'any trust recorded as a foreign trust or foreign trust entity interest',
    authorityIds: ['irs-i3520-foreign-trust-gift'],
    evaluate: ({ client }) => {
      const foreignTrusts = client.trusts.filter((trust) => trust.isForeignTrust);
      const trustEntities = client.foreignEntities.filter(
        (entity) => entity.kind === 'foreignTrust',
      );
      if (foreignTrusts.length === 0 && trustEntities.length === 0) return [];
      const names = [
        ...foreignTrusts.map((trust) => trust.name),
        ...trustEntities.map((entity) => entity.name),
      ];
      const value =
        foreignTrusts.reduce((sum, trust) => sum + trust.principalValue, 0) +
        trustEntities.reduce((sum, entity) => sum + entity.valueUSD, 0);
      return [
        {
          id: 'FOREIGN-3520-TRUST',
          ruleId: 'FOREIGN-3520-TRUST',
          ruleName: 'Foreign trust reporting',
          module: 'foreign',
          severity: 'review',
          headline: 'A foreign trust interest is recorded on the client file',
          clientFact: `${names.join(', ')} recorded at ${usd(value)}.`,
          measurement: {
            label: 'Foreign trust value',
            value,
            threshold: 0,
            unit: 'usd',
            comparison: 'exceeds',
          },
          analysis: `Transfers to, ownership of and distributions from a foreign trust are reported on Form 3520, and a U.S. owner of a foreign trust is generally responsible for the trust filing Form 3520-A. The penalties are computed by reference to the value of the transfer or the trust, so the reporting question is usually more significant than the income tax question.`,
          potentialForms: ['Form 3520', 'Form 3520-A'],
          authorityIds: ['irs-i3520-foreign-trust-gift', 'irc-671-grantor-trust'],
          questionsForReview: [
            'Is the client a U.S. owner under §§ 671-679, a beneficiary, or both?',
            'Has a U.S. agent been appointed for the trust?',
          ],
        },
      ];
    },
  },
  {
    id: 'FOREIGN-TAX-CREDIT',
    name: 'Foreign source income and the foreign tax credit',
    module: 'foreign',
    description:
      'Identifies clients with foreign accounts or foreign residence and material investment income, where foreign withholding may support a credit.',
    test: 'client resides abroad, holds a foreign entity interest, or foreign accounts exceed the FBAR aggregate threshold',
    authorityIds: ['irs-i1116-foreign-tax-credit', 'irs-p54-citizens-abroad'],
    evaluate: ({ client, federal, foreign }) => {
      const qualifies =
        client.residency.livesAbroad ||
        client.foreignEntities.length > 0 ||
        foreign.aggregateMaximumValue > foreign.fbarThreshold;
      if (!qualifies) return [];
      return [
        {
          id: 'FOREIGN-TAX-CREDIT',
          ruleId: 'FOREIGN-TAX-CREDIT',
          ruleName: 'Foreign source income and the foreign tax credit',
          module: 'foreign',
          severity: 'monitor',
          headline: 'Foreign source income may support a foreign tax credit',
          clientFact: `${client.residency.livesAbroad ? `Client resident in ${client.residency.countryOfResidence ?? 'a foreign country'} with ` : ''}${usd(federal.income.investmentIncome)} of modeled investment income and ${usd(foreign.aggregateMaximumValue)} of foreign accounts.`,
          measurement: {
            label: 'Aggregate foreign account value',
            value: foreign.aggregateMaximumValue,
            threshold: foreign.fbarThreshold,
            unit: 'usd',
            comparison: 'exceeds',
          },
          analysis: `U.S. citizens and residents are taxed on worldwide income wherever they live. Tax withheld at source by a foreign payer may support a credit, computed separately by category of income and limited to the U.S. tax on foreign source income. Treaty rates frequently reduce the correct withholding below what was actually withheld, in which case the excess is a refund claim in the source country rather than a credit.`,
          potentialForms: ['Form 1116'],
          authorityIds: ['irs-i1116-foreign-tax-credit', 'irs-p54-citizens-abroad'],
          questionsForReview: [
            'What foreign tax was withheld, in which category of income, and at what rate?',
            'Does a treaty reduce the statutory withholding rate on dividends or interest?',
            'Are there carryover credits from a prior year?',
          ],
        },
      ];
    },
  },
  {
    id: 'FOREIGN-EMPLOYER-PLAN',
    name: 'Foreign employer pension or retirement arrangement',
    module: 'foreign',
    description:
      'Identifies non-U.S. employer plans, which are not automatically treated as qualified plans for U.S. purposes.',
    test: 'any foreign account marked as an employer plan or of pension type',
    authorityIds: ['irs-p54-citizens-abroad', 'form-8938-thresholds'],
    evaluate: ({ foreign }) => {
      const plans = foreign.accounts.filter(
        (account) => account.isEmployerPlan || account.accountType === 'pension',
      );
      if (plans.length === 0) return [];
      const value = plans.reduce((sum, account) => sum + account.maximumValueUSD, 0);
      return [
        {
          id: 'FOREIGN-EMPLOYER-PLAN',
          ruleId: 'FOREIGN-EMPLOYER-PLAN',
          ruleName: 'Foreign employer pension or retirement arrangement',
          module: 'foreign',
          severity: 'monitor',
          headline: 'A non-U.S. employer plan is recorded',
          clientFact: `${plans.map((plan) => `${plan.institution} (${plan.country})`).join(', ')} carried at ${usd(value)}.`,
          measurement: {
            label: 'Foreign plan value',
            value,
            threshold: 0,
            unit: 'usd',
            comparison: 'exceeds',
          },
          analysis: `A foreign pension is not a qualified plan under U.S. law simply because it is a retirement arrangement in its home country. Absent treaty relief, employer contributions and inside build-up can be currently taxable, and the arrangement can be a foreign grantor trust. The plan generally counts toward both the FBAR aggregate and the Form 8938 threshold.`,
          potentialForms: ['Form 8938', 'FinCEN Form 114', 'Form 8833'],
          authorityIds: ['irs-p54-citizens-abroad', 'form-8938-thresholds'],
          questionsForReview: [
            'Does an income tax treaty defer U.S. taxation of inside build-up in this plan?',
            'Is a treaty-based return position disclosure required?',
          ],
        },
      ];
    },
  },
];
