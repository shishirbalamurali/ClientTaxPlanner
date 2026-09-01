import { usd, pct } from '@/lib/format';
import type { RuleDefinition } from './types';

const SKIP_RELATIONSHIPS = ['grandchild', 'grandson', 'granddaughter', 'grandnephew', 'grandniece'];

export const WEALTH_TRANSFER_RULES: RuleDefinition[] = [
  {
    id: 'GIFT-ANNUAL-EXCLUSION',
    name: 'Gifts to a donee exceeding the annual exclusion',
    module: 'wealthTransfer',
    description:
      'Aggregates every transfer to each donee for the year and measures the total against the modeled annual exclusion for that donee, taking any gift-splitting election into account.',
    test: 'total gifts to a donee − exclusion applied > 0',
    authorityIds: [
      'rp-2024-40-annual-gift-exclusion',
      'irc-2503-present-interest',
      'irs-i709-filing-requirement',
    ],
    evaluate: ({ gifts }) =>
      gifts.donees
        .filter((donee) => donee.amountExceedingExclusion > 0 && Number.isFinite(donee.modeledExclusion))
        .map((donee) => ({
          id: `GIFT-ANNUAL-EXCLUSION:${donee.recipient}`,
          ruleId: 'GIFT-ANNUAL-EXCLUSION',
          ruleName: 'Gifts to a donee exceeding the annual exclusion',
          module: 'wealthTransfer' as const,
          severity: 'review' as const,
          headline: `Transfers to ${donee.recipient} exceed the modeled annual exclusion`,
          clientFact: `${donee.gifts.length} transfer${donee.gifts.length === 1 ? '' : 's'} totalling ${usd(donee.totalGifted)} to ${donee.recipient} (${donee.relationship}) during ${gifts.taxYear}.`,
          measurement: {
            label: 'Amount above the exclusion applied',
            value: donee.amountExceedingExclusion,
            threshold: donee.exclusionApplied,
            unit: 'usd' as const,
            comparison: 'exceeds' as const,
          },
          analysis: `The modeled annual exclusion for this donee is ${usd(donee.modeledExclusion)}${donee.splitElectionApplies ? ', doubled to ' + usd(donee.modeledExclusion * 2) + ' by the indicated gift-splitting election' : ''}. ${usd(donee.exclusionApplied)} is excluded and ${usd(donee.amountExceedingExclusion)} is a taxable gift for reporting purposes. Reporting a taxable gift does not mean gift tax is payable: the amount is applied against the ${usd(gifts.basicExclusionAmount)} lifetime basic exclusion amount first, and tax arises only once that amount is exhausted.`,
          potentialForms: ['Form 709'],
          authorityIds: [
            'rp-2024-40-annual-gift-exclusion',
            'irc-2503-present-interest',
            'irs-i709-filing-requirement',
            'rp-2024-40-basic-exclusion',
          ],
          questionsForReview: [
            'Were any of these transfers direct payments of tuition or medical expenses excluded under § 2503(e)?',
            'Was the fair market value of any non-cash transfer supported by an appraisal or a documented valuation?',
          ],
          subjectId: donee.recipient,
        })),
  },
  {
    id: 'GIFT-FUTURE-INTEREST',
    name: 'Transfer in trust without a present interest',
    module: 'wealthTransfer',
    description:
      'Identifies transfers into trust that carry no withdrawal right, which the annual exclusion does not reach regardless of amount.',
    test: 'gift into trust and no Crummey withdrawal right and not otherwise a present interest',
    authorityIds: ['irc-2503-present-interest', 'irs-i709-filing-requirement'],
    evaluate: ({ gifts }) =>
      gifts.donees
        .filter((donee) => donee.futureInterestTotal > 0)
        .map((donee) => ({
          id: `GIFT-FUTURE-INTEREST:${donee.recipient}`,
          ruleId: 'GIFT-FUTURE-INTEREST',
          ruleName: 'Transfer in trust without a present interest',
          module: 'wealthTransfer' as const,
          severity: 'review' as const,
          headline: `Transfer to ${donee.recipient} is modeled as a future interest`,
          clientFact: `${usd(donee.futureInterestTotal)} transferred to ${donee.recipient} in trust with no withdrawal right recorded.`,
          measurement: {
            label: 'Future interest transfers',
            value: donee.futureInterestTotal,
            threshold: 0,
            unit: 'usd' as const,
            comparison: 'exceeds' as const,
          },
          analysis: `The annual exclusion is available only for gifts of a present interest. A transfer in trust is a future interest unless the beneficiary holds a right of immediate enjoyment, most commonly a Crummey withdrawal power. Where the transfer is a future interest, a return is indicated regardless of amount and the full ${usd(donee.futureInterestTotal)} is applied against the lifetime exclusion.`,
          potentialForms: ['Form 709'],
          authorityIds: ['irc-2503-present-interest', 'irs-i709-filing-requirement'],
          questionsForReview: [
            'Does the trust instrument grant withdrawal rights, and were Crummey notices sent for this contribution?',
            'How long was the withdrawal window held open?',
          ],
          subjectId: donee.recipient,
        })),
  },
  {
    id: 'GIFT-SPLIT-ELECTION',
    name: 'Gift-splitting election',
    module: 'wealthTransfer',
    description:
      'Identifies transfers marked for a § 2513 election, which requires spousal consent and a return from each spouse.',
    test: 'any gift with a gift-splitting election indicated',
    authorityIds: ['irc-2513-gift-splitting', 'irs-i709-filing-requirement'],
    evaluate: ({ client, gifts }) => {
      if (!gifts.anySplitElection) return [];
      const affected = gifts.donees.filter((donee) => donee.splitElectionApplies);
      const total = affected.reduce((sum, donee) => sum + donee.totalGifted, 0);
      return [
        {
          id: 'GIFT-SPLIT-ELECTION',
          ruleId: 'GIFT-SPLIT-ELECTION',
          ruleName: 'Gift-splitting election',
          module: 'wealthTransfer',
          severity: 'review',
          headline: 'A gift-splitting election is indicated for the year',
          clientFact: `${usd(total)} of transfers across ${affected.length} donee${affected.length === 1 ? '' : 's'} marked as split with ${client.spouseName ?? 'the client’s spouse'}.`,
          measurement: {
            label: 'Transfers subject to the election',
            value: total,
            threshold: 0,
            unit: 'usd',
            comparison: 'exceeds',
          },
          analysis: `Under § 2513 spouses may treat a gift made by either of them as made one-half by each, which doubles the exclusion available per donee to ${usd(gifts.annualExclusion * 2)}. The election requires the consent of both spouses and generally requires each spouse to file a return, including the consenting spouse who made no transfers.`,
          potentialForms: ['Form 709'],
          authorityIds: ['irc-2513-gift-splitting', 'irs-i709-filing-requirement'],
          questionsForReview: [
            'Were both spouses married to each other for the whole of the calendar year?',
            'Has the consenting spouse signed the election, and is a separate return required for them?',
          ],
        },
      ];
    },
  },
  {
    id: 'GIFT-NONCITIZEN-SPOUSE',
    name: 'Gifts to a non-citizen spouse',
    module: 'wealthTransfer',
    description:
      'Applies the § 2523(i) annual exclusion rather than the unlimited marital deduction where the spouse is not a U.S. citizen.',
    test: 'spouse is not a U.S. citizen and spousal transfers > § 2523(i) exclusion',
    authorityIds: ['irc-2523-marital-deduction', 'rp-2024-40-annual-gift-exclusion'],
    evaluate: ({ client, gifts }) => {
      if (client.spouseIsUSCitizen) return [];
      const spousal = gifts.donees.filter((donee) =>
        donee.gifts.some((gift) => gift.recipientIsSpouse),
      );
      if (spousal.length === 0) return [];
      const total = spousal.reduce((sum, donee) => sum + donee.totalGifted, 0);
      const excess = Math.max(0, total - gifts.noncitizenSpouseExclusion);
      return [
        {
          id: 'GIFT-NONCITIZEN-SPOUSE',
          ruleId: 'GIFT-NONCITIZEN-SPOUSE',
          ruleName: 'Gifts to a non-citizen spouse',
          module: 'wealthTransfer',
          severity: excess > 0 ? 'review' : 'monitor',
          headline: 'Spousal transfers do not qualify for the unlimited marital deduction',
          clientFact: `${usd(total)} transferred to ${client.spouseName ?? 'the spouse'}, who is recorded as a non-U.S. citizen.`,
          measurement: {
            label: 'Transfers to the spouse',
            value: total,
            threshold: gifts.noncitizenSpouseExclusion,
            unit: 'usd',
            comparison: excess > 0 ? 'exceeds' : 'below',
          },
          analysis: `Gifts to a spouse who is not a U.S. citizen are not eligible for the unlimited marital deduction. A separate annual exclusion of ${usd(gifts.noncitizenSpouseExclusion)} applies for ${gifts.taxYear}. ${excess > 0 ? `${usd(excess)} is above that exclusion and is a taxable gift for reporting purposes.` : 'Modeled transfers are within that exclusion.'} Joint titling of assets between spouses can itself be a completed gift in this fact pattern.`,
          potentialForms: ['Form 709'],
          authorityIds: ['irc-2523-marital-deduction', 'rp-2024-40-annual-gift-exclusion'],
          questionsForReview: [
            'Were any accounts or real property retitled into joint names during the year?',
            'Is a qualified domestic trust contemplated for the estate plan?',
          ],
        },
      ];
    },
  },
  {
    id: 'GIFT-GST-SKIP-PERSON',
    name: 'Transfers to a skip person',
    module: 'wealthTransfer',
    description:
      'Identifies transfers to grandchildren or other apparent skip persons, where GST exemption allocation is reported on Form 709.',
    test: 'donee relationship indicates a generation below the donor’s children',
    authorityIds: ['irc-2631-gst-exemption', 'irs-i709-filing-requirement'],
    evaluate: ({ gifts }) => {
      const skips = gifts.donees.filter((donee) =>
        SKIP_RELATIONSHIPS.some((term) => donee.relationship.toLowerCase().includes(term)),
      );
      if (skips.length === 0) return [];
      const total = skips.reduce((sum, donee) => sum + donee.totalGifted, 0);
      return [
        {
          id: 'GIFT-GST-SKIP-PERSON',
          ruleId: 'GIFT-GST-SKIP-PERSON',
          ruleName: 'Transfers to a skip person',
          module: 'wealthTransfer',
          severity: 'review',
          headline: 'Transfers were made to an apparent skip person',
          clientFact: `${usd(total)} transferred to ${skips.map((donee) => `${donee.recipient} (${donee.relationship})`).join(', ')}.`,
          measurement: {
            label: 'Transfers to skip persons',
            value: total,
            threshold: 0,
            unit: 'usd',
            comparison: 'exceeds',
          },
          analysis: `Transfers to a generation two or more below the donor are generation-skipping transfers. GST exemption of ${usd(gifts.basicExclusionAmount)} is available for ${gifts.taxYear} and allocation is reported on Schedule D of Form 709. Automatic allocation rules apply to indirect skips unless the donor elects out, so the allocation position should be confirmed rather than assumed.`,
          potentialForms: ['Form 709'],
          authorityIds: ['irc-2631-gst-exemption', 'irs-i709-filing-requirement'],
          questionsForReview: [
            'Should GST exemption be allocated to this transfer, or should the donor elect out of automatic allocation?',
            'What is the inclusion ratio of the receiving trust after this contribution?',
          ],
        },
      ];
    },
  },
  {
    id: 'GIFT-EXCLUSION-UTILIZATION',
    name: 'Lifetime exclusion utilization',
    module: 'wealthTransfer',
    description:
      'Adds current year taxable gifts to previously reported taxable gifts and measures the total against the basic exclusion amount.',
    test: 'cumulative taxable gifts > 25% of the basic exclusion amount',
    authorityIds: ['rp-2024-40-basic-exclusion', 'irc-2010-unified-credit'],
    evaluate: ({ gifts }) => {
      if (gifts.exclusionUtilization <= 0.25) return [];
      return [
        {
          id: 'GIFT-EXCLUSION-UTILIZATION',
          ruleId: 'GIFT-EXCLUSION-UTILIZATION',
          ruleName: 'Lifetime exclusion utilization',
          module: 'wealthTransfer',
          severity: 'monitor',
          headline: 'A material share of the lifetime exclusion has been used',
          clientFact: `${usd(gifts.lifetimeExclusionPreviouslyUsed)} of exclusion reported as used before ${gifts.taxYear}, plus ${usd(gifts.totalExceedingExclusion)} modeled for the current year.`,
          measurement: {
            label: 'Cumulative exclusion used',
            value: gifts.exclusionUtilization,
            threshold: 0.25,
            unit: 'percent',
            comparison: 'exceeds',
          },
          analysis: `Projected cumulative use is ${usd(gifts.projectedExclusionUsed)}, or ${pct(gifts.exclusionUtilization)} of the ${usd(gifts.basicExclusionAmount)} basic exclusion amount, leaving ${usd(gifts.remainingExclusion)}. The credit is unified, so exclusion consumed during life is not available at death. Prior year returns should be reconciled before further planning is committed.`,
          potentialForms: ['Form 709', 'Form 706'],
          authorityIds: ['rp-2024-40-basic-exclusion', 'irc-2010-unified-credit'],
          questionsForReview: [
            'Do prior year Forms 709 reconcile to the exclusion figure carried in the client record?',
            'Is portability of a predeceased spouse’s unused exclusion available?',
          ],
        },
      ];
    },
  },
  {
    id: 'GIFT-MULTIPLE-DONEES',
    name: 'Annual exclusion capacity across donees',
    module: 'wealthTransfer',
    description:
      'Measures unused annual exclusion capacity across the recorded donees for the year.',
    test: 'at least one donee received less than the modeled annual exclusion',
    authorityIds: ['rp-2024-40-annual-gift-exclusion'],
    evaluate: ({ gifts }) => {
      const underUsed = gifts.donees.filter(
        (donee) =>
          Number.isFinite(donee.modeledExclusion) &&
          donee.totalGifted < gifts.annualExclusion &&
          donee.totalGifted > 0,
      );
      if (underUsed.length === 0) return [];
      const headroom = underUsed.reduce(
        (sum, donee) => sum + (gifts.annualExclusion - donee.totalGifted),
        0,
      );
      return [
        {
          id: 'GIFT-MULTIPLE-DONEES',
          ruleId: 'GIFT-MULTIPLE-DONEES',
          ruleName: 'Annual exclusion capacity across donees',
          module: 'wealthTransfer',
          severity: 'informational',
          headline: 'Unused annual exclusion capacity remains for the year',
          clientFact: `${underUsed.length} donee${underUsed.length === 1 ? '' : 's'} received less than the ${usd(gifts.annualExclusion)} annual exclusion.`,
          measurement: {
            label: 'Unused exclusion capacity',
            value: headroom,
            threshold: 0,
            unit: 'usd',
            comparison: 'exceeds',
          },
          analysis: `${usd(headroom)} of annual exclusion capacity is unused across these donees. Exclusion capacity does not carry forward; it lapses at year end. This is the lever modeled in the gift planning scenario.`,
          potentialForms: ['Form 709'],
          authorityIds: ['rp-2024-40-annual-gift-exclusion'],
          questionsForReview: [
            'Are there additional intended donees not reflected in the record?',
            'Would a gift-splitting election increase available capacity?',
          ],
        },
      ];
    },
  },
];
