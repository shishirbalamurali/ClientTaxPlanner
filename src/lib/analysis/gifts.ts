import type { TaxYearConstants } from '@/lib/tax-year';
import type { Client, Gift } from '@/lib/types';

export interface DoneeSummary {
  recipient: string;
  relationship: string;
  gifts: Gift[];
  totalGifted: number;
  /** The exclusion the model applies to this donee, before any splitting election. */
  modeledExclusion: number;
  exclusionApplied: number;
  amountExceedingExclusion: number;
  splitElectionApplies: boolean;
  /** Portion treated as made by the client after a § 2513 election. */
  attributedToClient: number;
  presentInterestTotal: number;
  futureInterestTotal: number;
  requiresFormReview: boolean;
  reviewReasons: string[];
}

export interface GiftAnalysis {
  taxYear: number;
  annualExclusion: number;
  noncitizenSpouseExclusion: number;
  basicExclusionAmount: number;
  donees: DoneeSummary[];
  totalGifted: number;
  totalExcluded: number;
  totalExceedingExclusion: number;
  doneesOverExclusion: number;
  anyFutureInterestGift: boolean;
  anySplitElection: boolean;
  lifetimeExclusionPreviouslyUsed: number;
  projectedExclusionUsed: number;
  remainingExclusion: number;
  exclusionUtilization: number;
  formReviewIndicated: boolean;
}

function exclusionForDonee(gifts: Gift[], constants: TaxYearConstants): number {
  const first = gifts[0];
  if (!first) return constants.wealthTransfer.annualGiftExclusion;
  if (first.recipientIsSpouse && first.recipientIsUSCitizen) {
    // Unlimited marital deduction: no annual exclusion analysis required.
    return Number.POSITIVE_INFINITY;
  }
  if (first.recipientIsSpouse && !first.recipientIsUSCitizen) {
    return constants.wealthTransfer.noncitizenSpouseAnnualExclusion;
  }
  return constants.wealthTransfer.annualGiftExclusion;
}

/**
 * Groups the year's transfers by donee and measures each against the modeled
 * annual exclusion. Every value returned here is arithmetic on client facts;
 * the interpretation of those values lives in the rule modules.
 */
export function analyzeGifts(client: Client, constants: TaxYearConstants): GiftAnalysis {
  const byRecipient = new Map<string, Gift[]>();
  for (const gift of client.gifts) {
    const existing = byRecipient.get(gift.recipient);
    if (existing) existing.push(gift);
    else byRecipient.set(gift.recipient, [gift]);
  }

  const donees: DoneeSummary[] = [...byRecipient.entries()].map(([recipient, gifts]) => {
    const totalGifted = gifts.reduce((sum, gift) => sum + gift.amount, 0);
    const splitElectionApplies = gifts.some((gift) => gift.spouseElectsGiftSplitting);
    const attributedToClient = splitElectionApplies ? totalGifted / 2 : totalGifted;

    // A transfer in trust qualifies for the exclusion only where the beneficiary
    // holds a present interest, typically through a withdrawal right.
    const presentInterestTotal = gifts
      .filter((gift) => gift.presentInterest || (gift.intoTrust && gift.crummeyWithdrawalRight))
      .reduce((sum, gift) => sum + gift.amount, 0);
    const futureInterestTotal = totalGifted - presentInterestTotal;

    const modeledExclusion = exclusionForDonee(gifts, constants);
    const splitMultiplier = splitElectionApplies ? 2 : 1;
    const availableExclusion = Number.isFinite(modeledExclusion)
      ? modeledExclusion * splitMultiplier
      : Number.POSITIVE_INFINITY;

    const exclusionApplied = Math.min(presentInterestTotal, availableExclusion);
    const amountExceedingExclusion = Math.max(0, totalGifted - exclusionApplied);

    const reviewReasons: string[] = [];
    if (amountExceedingExclusion > 0 && Number.isFinite(modeledExclusion)) {
      reviewReasons.push('Transfers exceed the modeled annual exclusion for this donee.');
    }
    if (futureInterestTotal > 0) {
      reviewReasons.push('Includes a transfer that the model treats as a future interest.');
    }
    if (splitElectionApplies) {
      reviewReasons.push('Gift-splitting election indicated for this donee.');
    }

    const first = gifts[0]!;
    return {
      recipient,
      relationship: first.relationship,
      gifts,
      totalGifted,
      modeledExclusion,
      exclusionApplied,
      amountExceedingExclusion,
      splitElectionApplies,
      attributedToClient,
      presentInterestTotal,
      futureInterestTotal,
      requiresFormReview: reviewReasons.length > 0,
      reviewReasons,
    };
  });

  donees.sort((a, b) => b.totalGifted - a.totalGifted);

  const totalGifted = donees.reduce((sum, donee) => sum + donee.totalGifted, 0);
  const totalExcluded = donees.reduce(
    (sum, donee) => sum + (Number.isFinite(donee.exclusionApplied) ? donee.exclusionApplied : 0),
    0,
  );
  const totalExceedingExclusion = donees.reduce(
    (sum, donee) => sum + donee.amountExceedingExclusion,
    0,
  );

  const projectedExclusionUsed = client.lifetimeExclusionPreviouslyUsed + totalExceedingExclusion;
  const basicExclusionAmount = constants.wealthTransfer.basicExclusionAmount;

  return {
    taxYear: constants.year,
    annualExclusion: constants.wealthTransfer.annualGiftExclusion,
    noncitizenSpouseExclusion: constants.wealthTransfer.noncitizenSpouseAnnualExclusion,
    basicExclusionAmount,
    donees,
    totalGifted,
    totalExcluded,
    totalExceedingExclusion,
    doneesOverExclusion: donees.filter((donee) => donee.amountExceedingExclusion > 0).length,
    anyFutureInterestGift: donees.some((donee) => donee.futureInterestTotal > 0),
    anySplitElection: donees.some((donee) => donee.splitElectionApplies),
    lifetimeExclusionPreviouslyUsed: client.lifetimeExclusionPreviouslyUsed,
    projectedExclusionUsed,
    remainingExclusion: Math.max(0, basicExclusionAmount - projectedExclusionUsed),
    exclusionUtilization: projectedExclusionUsed / basicExclusionAmount,
    formReviewIndicated: donees.some((donee) => donee.requiresFormReview),
  };
}
