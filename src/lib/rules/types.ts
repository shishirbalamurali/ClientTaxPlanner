import type { ForeignAccountAnalysis } from '@/lib/analysis/foreign';
import type { GiftAnalysis } from '@/lib/analysis/gifts';
import type { FederalModelResult } from '@/lib/analysis/federal-model';
import type { TrustPortfolioAnalysis } from '@/lib/analysis/trusts';
import type { TaxYearConstants } from '@/lib/tax-year';
import type { Client } from '@/lib/types';

export type FindingSeverity = 'review' | 'monitor' | 'informational';

export type FindingModule =
  | 'individual'
  | 'deductions'
  | 'wealthTransfer'
  | 'trust'
  | 'foreign'
  | 'compliance';

export interface Measurement {
  label: string;
  value: number;
  threshold: number;
  unit: 'usd' | 'percent' | 'count';
  /** Operator applied between value and threshold by the rule. */
  comparison: 'exceeds' | 'atOrAbove' | 'below' | 'equals';
}

/**
 * The output of a rule. Every field that appears in the "Why was this flagged?"
 * panel is populated by the rule itself so the chain from client fact to
 * government source is fixed at evaluation time.
 */
export interface Finding {
  id: string;
  ruleId: string;
  ruleName: string;
  module: FindingModule;
  severity: FindingSeverity;
  headline: string;
  /** The specific fact drawn from this client's record. */
  clientFact: string;
  measurement?: Measurement;
  /** What the rule concludes from the fact, stated in review terms. */
  analysis: string;
  potentialForms: string[];
  authorityIds: string[];
  questionsForReview: string[];
  /** Donee name, trust id or account id where the finding is item-specific. */
  subjectId?: string;
}

export interface RuleContext {
  client: Client;
  constants: TaxYearConstants;
  federal: FederalModelResult;
  gifts: GiftAnalysis;
  trusts: TrustPortfolioAnalysis;
  foreign: ForeignAccountAnalysis;
}

export interface RuleDefinition {
  id: string;
  name: string;
  module: FindingModule;
  /** What the rule looks at. */
  description: string;
  /** The deterministic predicate, written out for the research library. */
  test: string;
  authorityIds: string[];
  evaluate: (context: RuleContext) => Finding[];
}

export const MODULE_LABELS: Record<FindingModule, string> = {
  individual: 'Individual tax',
  deductions: 'Deductions',
  wealthTransfer: 'Wealth transfer',
  trust: 'Trusts',
  foreign: 'Foreign accounts',
  compliance: 'Compliance',
};

export const SEVERITY_LABELS: Record<FindingSeverity, string> = {
  review: 'Review indicated',
  monitor: 'Monitor',
  informational: 'Informational',
};

export const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  review: 0,
  monitor: 1,
  informational: 2,
};
