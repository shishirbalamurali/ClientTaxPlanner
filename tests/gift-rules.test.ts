import { describe, expect, it } from 'vitest';
import { analyzeGifts } from '@/lib/analysis/gifts';
import { evaluateClient } from '@/lib/rules';
import { TAX_YEAR_2025 } from '@/lib/tax-year';
import { findingIds, makeClient, makeGift } from './factories';

const EXCLUSION = TAX_YEAR_2025.wealthTransfer.annualGiftExclusion;

describe('annual exclusion measurement', () => {
  it('excludes a gift below the annual exclusion and raises no review item', () => {
    const client = makeClient({
      gifts: [makeGift({ amount: EXCLUSION - 1_000 })],
    });
    const analysis = analyzeGifts(client, TAX_YEAR_2025);

    expect(analysis.totalExceedingExclusion).toBe(0);
    expect(analysis.doneesOverExclusion).toBe(0);
    expect(findingIds(evaluateClient(client).findings)).not.toContain('GIFT-ANNUAL-EXCLUSION');
  });

  it('treats a gift exactly at the exclusion as fully excluded', () => {
    const client = makeClient({ gifts: [makeGift({ amount: EXCLUSION })] });
    const analysis = analyzeGifts(client, TAX_YEAR_2025);

    expect(analysis.totalExcluded).toBe(EXCLUSION);
    expect(analysis.totalExceedingExclusion).toBe(0);
    expect(analysis.donees[0]?.requiresFormReview).toBe(false);
  });

  it('reports the excess when a gift is one dollar above the exclusion', () => {
    const client = makeClient({ gifts: [makeGift({ amount: EXCLUSION + 1 })] });
    const analysis = analyzeGifts(client, TAX_YEAR_2025);

    expect(analysis.totalExceedingExclusion).toBe(1);
    expect(analysis.doneesOverExclusion).toBe(1);
    expect(findingIds(evaluateClient(client).findings)).toContain('GIFT-ANNUAL-EXCLUSION');
  });

  it('aggregates several transfers to the same donee before applying the exclusion', () => {
    const client = makeClient({
      gifts: [
        makeGift({ id: 'g1', amount: 12_000 }),
        makeGift({ id: 'g2', amount: 12_000 }),
      ],
    });
    const analysis = analyzeGifts(client, TAX_YEAR_2025);

    expect(analysis.donees).toHaveLength(1);
    expect(analysis.donees[0]?.totalGifted).toBe(24_000);
    expect(analysis.donees[0]?.amountExceedingExclusion).toBe(24_000 - EXCLUSION);
  });
});

describe('multiple gift recipients', () => {
  const client = makeClient({
    gifts: [
      makeGift({ id: 'g1', recipient: 'Donee A', amount: 5_000 }),
      makeGift({ id: 'g2', recipient: 'Donee B', amount: EXCLUSION }),
      makeGift({ id: 'g3', recipient: 'Donee C', amount: 50_000 }),
      makeGift({ id: 'g4', recipient: 'Donee D', amount: 100_000 }),
    ],
  });
  const analysis = analyzeGifts(client, TAX_YEAR_2025);

  it('measures each donee separately', () => {
    expect(analysis.donees).toHaveLength(4);
    expect(analysis.doneesOverExclusion).toBe(2);
  });

  it('totals the excess across donees', () => {
    expect(analysis.totalGifted).toBe(5_000 + EXCLUSION + 50_000 + 100_000);
    expect(analysis.totalExceedingExclusion).toBe(50_000 - EXCLUSION + (100_000 - EXCLUSION));
  });

  it('raises one review item per donee over the exclusion', () => {
    const findings = evaluateClient(client).findings.filter(
      (finding) => finding.ruleId === 'GIFT-ANNUAL-EXCLUSION',
    );
    expect(findings).toHaveLength(2);
    expect(findings.map((finding) => finding.subjectId).sort()).toEqual(['Donee C', 'Donee D']);
  });

  it('reports unused exclusion capacity for donees below the exclusion', () => {
    expect(findingIds(evaluateClient(client).findings)).toContain('GIFT-MULTIPLE-DONEES');
  });
});

describe('gift splitting', () => {
  it('doubles the exclusion available to a donee', () => {
    const client = makeClient({
      gifts: [makeGift({ amount: 30_000, spouseElectsGiftSplitting: true })],
    });
    const analysis = analyzeGifts(client, TAX_YEAR_2025);

    expect(analysis.donees[0]?.exclusionApplied).toBe(30_000);
    expect(analysis.totalExceedingExclusion).toBe(0);
    expect(findingIds(evaluateClient(client).findings)).toContain('GIFT-SPLIT-ELECTION');
  });

  it('still leaves an excess once the doubled exclusion is exhausted', () => {
    const client = makeClient({
      gifts: [makeGift({ amount: 60_000, spouseElectsGiftSplitting: true })],
    });
    expect(analyzeGifts(client, TAX_YEAR_2025).totalExceedingExclusion).toBe(
      60_000 - EXCLUSION * 2,
    );
  });
});

describe('present and future interests', () => {
  it('treats a transfer in trust without a withdrawal right as a future interest', () => {
    const client = makeClient({
      gifts: [
        makeGift({
          amount: 10_000,
          presentInterest: false,
          intoTrust: true,
          crummeyWithdrawalRight: false,
        }),
      ],
    });
    const analysis = analyzeGifts(client, TAX_YEAR_2025);

    expect(analysis.donees[0]?.futureInterestTotal).toBe(10_000);
    expect(analysis.totalExcluded).toBe(0);
    // Below the exclusion in amount, but still reportable because of its character.
    expect(analysis.totalExceedingExclusion).toBe(10_000);
    expect(findingIds(evaluateClient(client).findings)).toContain('GIFT-FUTURE-INTEREST');
  });

  it('treats a Crummey withdrawal right as creating a present interest', () => {
    const client = makeClient({
      gifts: [
        makeGift({
          amount: 10_000,
          presentInterest: false,
          intoTrust: true,
          crummeyWithdrawalRight: true,
        }),
      ],
    });
    const analysis = analyzeGifts(client, TAX_YEAR_2025);

    expect(analysis.donees[0]?.futureInterestTotal).toBe(0);
    expect(analysis.totalExcluded).toBe(10_000);
    expect(findingIds(evaluateClient(client).findings)).not.toContain('GIFT-FUTURE-INTEREST');
  });
});

describe('spousal transfers', () => {
  it('applies an unlimited marital deduction for a U.S. citizen spouse', () => {
    const client = makeClient({
      spouseIsUSCitizen: true,
      gifts: [
        makeGift({
          recipient: 'Test Spouse',
          relationship: 'Spouse',
          amount: 2_000_000,
          recipientIsSpouse: true,
          recipientIsUSCitizen: true,
        }),
      ],
    });
    const analysis = analyzeGifts(client, TAX_YEAR_2025);

    expect(analysis.donees[0]?.modeledExclusion).toBe(Number.POSITIVE_INFINITY);
    expect(analysis.totalExceedingExclusion).toBe(0);
    expect(findingIds(evaluateClient(client).findings)).not.toContain('GIFT-ANNUAL-EXCLUSION');
  });

  it('applies the § 2523(i) exclusion for a non-citizen spouse', () => {
    const noncitizenExclusion = TAX_YEAR_2025.wealthTransfer.noncitizenSpouseAnnualExclusion;
    const client = makeClient({
      spouseIsUSCitizen: false,
      gifts: [
        makeGift({
          recipient: 'Test Spouse',
          relationship: 'Spouse (non-U.S. citizen)',
          amount: noncitizenExclusion + 100_000,
          recipientIsSpouse: true,
          recipientIsUSCitizen: false,
        }),
      ],
    });
    const analysis = analyzeGifts(client, TAX_YEAR_2025);

    expect(analysis.donees[0]?.modeledExclusion).toBe(noncitizenExclusion);
    expect(analysis.totalExceedingExclusion).toBe(100_000);
    expect(findingIds(evaluateClient(client).findings)).toContain('GIFT-NONCITIZEN-SPOUSE');
  });
});

describe('lifetime exclusion tracking', () => {
  it('adds current year taxable gifts to previously reported amounts', () => {
    const client = makeClient({
      lifetimeExclusionPreviouslyUsed: 5_000_000,
      gifts: [makeGift({ amount: 1_019_000 })],
    });
    const analysis = analyzeGifts(client, TAX_YEAR_2025);

    expect(analysis.projectedExclusionUsed).toBe(5_000_000 + 1_000_000);
    expect(analysis.remainingExclusion).toBe(
      TAX_YEAR_2025.wealthTransfer.basicExclusionAmount - 6_000_000,
    );
    expect(findingIds(evaluateClient(client).findings)).toContain('GIFT-EXCLUSION-UTILIZATION');
  });

  it('never reports negative remaining exclusion', () => {
    const client = makeClient({
      lifetimeExclusionPreviouslyUsed: TAX_YEAR_2025.wealthTransfer.basicExclusionAmount,
      gifts: [makeGift({ amount: 500_000 })],
    });
    expect(analyzeGifts(client, TAX_YEAR_2025).remainingExclusion).toBe(0);
  });
});

describe('no transfers', () => {
  it('produces an empty analysis without raising gift findings', () => {
    const client = makeClient({ gifts: [] });
    const analysis = analyzeGifts(client, TAX_YEAR_2025);

    expect(analysis.donees).toHaveLength(0);
    expect(analysis.totalGifted).toBe(0);
    expect(analysis.formReviewIndicated).toBe(false);
    const gifted = evaluateClient(client).findings.filter(
      (finding) => finding.module === 'wealthTransfer',
    );
    expect(gifted).toHaveLength(0);
  });
});
