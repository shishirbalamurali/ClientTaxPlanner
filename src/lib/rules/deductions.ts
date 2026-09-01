import { usd, pct } from '@/lib/format';
import { GIFT_ASSET_LABELS } from '@/lib/labels';
import type { RuleDefinition } from './types';

export const DEDUCTION_RULES: RuleDefinition[] = [
  {
    id: 'DED-SALT-PHASEDOWN',
    name: 'State and local tax cap phase-down',
    module: 'deductions',
    description:
      'Applies the 2025 phase-down of the state and local tax cap for modified adjusted gross income above the statutory threshold.',
    test: 'modified AGI > phase-down threshold for the filing status',
    authorityIds: ['pl-119-21-salt-cap', 'irc-164-salt'],
    evaluate: ({ client, constants, federal }) => {
      if (!federal.salt.phaseDownApplies) return [];
      const threshold =
        constants.saltLimitation.phaseDownModifiedAgiThreshold[client.filingStatus];
      const statutoryCap = constants.saltLimitation.cap[client.filingStatus];
      return [
        {
          id: 'DED-SALT-PHASEDOWN',
          ruleId: 'DED-SALT-PHASEDOWN',
          ruleName: 'State and local tax cap phase-down',
          module: 'deductions',
          severity: 'review',
          headline: 'The state and local tax cap is reduced at this income level',
          clientFact: `${usd(federal.salt.paid)} of state and local taxes paid in ${client.residency.stateName} against modeled adjusted gross income of ${usd(federal.adjustedGrossIncome)}.`,
          measurement: {
            label: 'Modified adjusted gross income',
            value: federal.adjustedGrossIncome,
            threshold,
            unit: 'usd',
            comparison: 'exceeds',
          },
          analysis: `The ${usd(statutoryCap)} cap is reduced by 30% of modified adjusted gross income above ${usd(threshold)}, floored at ${usd(constants.saltLimitation.floor[client.filingStatus])}. The modeled cap is ${usd(federal.salt.cap)}, a reduction of ${usd(federal.salt.capReducedBy)}, leaving ${usd(federal.salt.paid - federal.salt.allowed)} of the taxes paid non-deductible.`,
          potentialForms: ['Schedule A (Form 1040)'],
          authorityIds: ['pl-119-21-salt-cap', 'irc-164-salt'],
          questionsForReview: [
            'Is a pass-through entity tax election available in the client’s state for the business income?',
            'Would shifting the timing of a fourth quarter state estimate change the modified AGI test?',
          ],
        },
      ];
    },
  },
  {
    id: 'DED-CHARITABLE-LIMIT',
    name: 'Charitable contribution percentage limitation',
    module: 'deductions',
    description:
      'Applies the § 170(b) contribution base percentages by donee type and asset type and measures any excess carried forward.',
    test: 'contributions in excess of the applicable AGI percentage limits > 0',
    authorityIds: ['irc-170b-agi-limits', 'irs-p526-charitable'],
    evaluate: ({ constants, federal }) => {
      const { charitable } = federal;
      if (charitable.disallowedCarryforward <= 0) return [];
      const limits = constants.charitableAgiLimits;
      return [
        {
          id: 'DED-CHARITABLE-LIMIT',
          ruleId: 'DED-CHARITABLE-LIMIT',
          ruleName: 'Charitable contribution percentage limitation',
          module: 'deductions',
          severity: 'review',
          headline: 'Contributions exceed the current year percentage limits',
          clientFact: `${usd(charitable.totalContributed)} contributed against a ${usd(federal.adjustedGrossIncome)} contribution base.`,
          measurement: {
            label: 'Amount carried forward',
            value: charitable.disallowedCarryforward,
            threshold: 0,
            unit: 'usd',
            comparison: 'exceeds',
          },
          analysis: `Cash to public charities is limited to ${pct(limits.cashToPublicCharity, 1)} of the contribution base (${usd(charitable.cashLimit)}) and long-term appreciated property to ${pct(limits.appreciatedPropertyToPublicCharity, 1)} (${usd(charitable.appreciatedLimit)}). ${usd(charitable.totalAllowed)} is modeled as currently deductible and ${usd(charitable.disallowedCarryforward)} carries forward for up to ${limits.carryforwardYears} years.`,
          potentialForms: ['Schedule A (Form 1040)', 'Form 8283'],
          authorityIds: ['irc-170b-agi-limits', 'irs-p526-charitable'],
          questionsForReview: [
            'Should a § 170(b)(1)(C)(iii) election be made to treat appreciated property under the 50% limit at reduced basis?',
            'Does the client expect a higher contribution base in the carryforward window?',
          ],
        },
      ];
    },
  },
  {
    id: 'DED-NONCASH-SUBSTANTIATION',
    name: 'Noncash contribution substantiation',
    module: 'deductions',
    description:
      'Identifies noncash charitable contributions above the Form 8283 reporting threshold and distinguishes publicly traded securities from property requiring a qualified appraisal.',
    test: 'noncash contributions > $5,000',
    authorityIds: ['irs-p526-charitable', 'irc-170b-agi-limits'],
    evaluate: ({ client, federal }) => {
      const noncash =
        client.deductions.charitableAppreciatedSecurities +
        client.deductions.charitablePrivateFoundation;
      if (noncash <= 5_000) return [];
      return [
        {
          id: 'DED-NONCASH-SUBSTANTIATION',
          ruleId: 'DED-NONCASH-SUBSTANTIATION',
          ruleName: 'Noncash contribution substantiation',
          module: 'deductions',
          severity: 'monitor',
          headline: 'Noncash contributions require Form 8283 support',
          clientFact: `${usd(federal.charitable.appreciated)} of appreciated securities and ${usd(federal.charitable.privateFoundation)} directed to a private foundation.`,
          measurement: {
            label: 'Noncash contributions',
            value: noncash,
            threshold: 5_000,
            unit: 'usd',
            comparison: 'exceeds',
          },
          analysis: `Noncash contributions above $5,000 are reported on Form 8283. Publicly traded securities are excepted from the qualified appraisal requirement and are reported in Section A; closely held stock and other property are reported in Section B and generally require an appraisal. A contemporaneous written acknowledgment is required for each contribution of $250 or more.`,
          potentialForms: ['Form 8283'],
          authorityIds: ['irs-p526-charitable', 'irc-170b-agi-limits'],
          questionsForReview: [
            'Are acknowledgments on hand for each contribution of $250 or more?',
            'Were the donated shares held more than one year?',
          ],
        },
      ];
    },
  },
  {
    id: 'DED-METHOD',
    name: 'Itemized versus standard deduction',
    module: 'deductions',
    description:
      'Compares modeled itemized deductions with the standard deduction for the filing status.',
    test: 'itemized deductions compared with the standard deduction',
    authorityIds: ['pl-119-21-standard-deduction'],
    evaluate: ({ federal }) => {
      const margin = federal.itemizedDeductions - federal.standardDeduction;
      return [
        {
          id: 'DED-METHOD',
          ruleId: 'DED-METHOD',
          ruleName: 'Itemized versus standard deduction',
          module: 'deductions',
          severity: 'informational',
          headline:
            federal.deductionMethod === 'itemized'
              ? 'Itemizing produces the larger deduction'
              : 'The standard deduction exceeds modeled itemized deductions',
          clientFact: `Modeled itemized deductions of ${usd(federal.itemizedDeductions)} against a standard deduction of ${usd(federal.standardDeduction)}.`,
          measurement: {
            label: 'Itemized deductions',
            value: federal.itemizedDeductions,
            threshold: federal.standardDeduction,
            unit: 'usd',
            comparison: margin > 0 ? 'exceeds' : 'below',
          },
          analysis: `The model takes ${usd(federal.deductionTaken)}, a margin of ${usd(Math.abs(margin))} over the alternative. Where the margin is thin, bunching two years of charitable contributions into one year is the standard response.`,
          potentialForms: ['Schedule A (Form 1040)'],
          authorityIds: ['pl-119-21-standard-deduction'],
          questionsForReview: [
            'Would a donor advised fund contribution bunch two years of giving into the current year?',
          ],
        },
      ];
    },
  },
  {
    id: 'DED-CARRYFORWARD-BALANCE',
    name: 'Charitable carryforward from prior years',
    module: 'deductions',
    description:
      'Surfaces a prior year charitable carryforward balance so it is not lost against the five-year window.',
    test: 'charitable carryforward balance > 0',
    authorityIds: ['irc-170b-agi-limits'],
    evaluate: ({ client, constants }) => {
      const carryforward = client.deductions.charitableCarryforward;
      if (carryforward <= 0) return [];
      return [
        {
          id: 'DED-CARRYFORWARD-BALANCE',
          ruleId: 'DED-CARRYFORWARD-BALANCE',
          ruleName: 'Charitable carryforward from prior years',
          module: 'deductions',
          severity: 'monitor',
          headline: 'A prior year charitable carryforward is outstanding',
          clientFact: `${usd(carryforward)} of contributions carried into ${constants.year} from prior years.`,
          measurement: {
            label: 'Carryforward balance',
            value: carryforward,
            threshold: 0,
            unit: 'usd',
            comparison: 'exceeds',
          },
          analysis: `Carryforwards expire after ${constants.charitableAgiLimits.carryforwardYears} years and are used after current year contributions of the same character. Additional current year giving pushes the older balance closer to expiration, which cuts against bunching in a year when the carryforward is already large.`,
          potentialForms: ['Schedule A (Form 1040)'],
          authorityIds: ['irc-170b-agi-limits'],
          questionsForReview: [
            'What is the character and expiration year of each carryforward layer?',
          ],
        },
      ];
    },
  },
  {
    id: 'DED-GIFT-BASIS',
    name: 'Carryover basis on gifted property',
    module: 'deductions',
    description:
      'Identifies gifts of appreciated non-cash property where the donee takes the donor’s basis.',
    test: 'any non-cash gift with cost basis below fair market value',
    authorityIds: ['irs-p551-carryover-basis'],
    evaluate: ({ client }) => {
      const appreciated = client.gifts.filter(
        (gift) =>
          gift.assetType !== 'cash' &&
          gift.costBasis !== undefined &&
          gift.costBasis < gift.amount,
      );
      if (appreciated.length === 0) return [];
      const embeddedGain = appreciated.reduce(
        (sum, gift) => sum + (gift.amount - (gift.costBasis ?? 0)),
        0,
      );
      const assetTypes = [...new Set(appreciated.map((g) => GIFT_ASSET_LABELS[g.assetType]))];
      return [
        {
          id: 'DED-GIFT-BASIS',
          ruleId: 'DED-GIFT-BASIS',
          ruleName: 'Carryover basis on gifted property',
          module: 'wealthTransfer',
          severity: 'monitor',
          headline: 'Gifted property carries embedded gain to the donee',
          clientFact: `${appreciated.length} transfer${appreciated.length === 1 ? '' : 's'} of ${assetTypes.join(' and ').toLowerCase()} with ${usd(embeddedGain)} of aggregate embedded gain.`,
          measurement: {
            label: 'Embedded gain transferred',
            value: embeddedGain,
            threshold: 0,
            unit: 'usd',
            comparison: 'exceeds',
          },
          analysis: `A donee takes the donor's adjusted basis in gifted property. Property that would receive a basis adjustment if held until death instead transfers ${usd(embeddedGain)} of unrealized gain to the donee. Where the donee is in a lower capital gain bracket the transfer can still be efficient; where the donor's estate is below the exclusion amount it usually is not.`,
          potentialForms: ['Form 709'],
          authorityIds: ['irs-p551-carryover-basis'],
          questionsForReview: [
            'Is the projected taxable estate below the basic exclusion amount, favouring a basis adjustment at death?',
            'What is the donee’s expected capital gain rate on a later disposition?',
          ],
        },
      ];
    },
  },
];
