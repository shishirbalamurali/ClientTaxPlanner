import { analyzeForeignAccounts } from '@/lib/analysis/foreign';
import { analyzeGifts } from '@/lib/analysis/gifts';
import { analyzeTrusts } from '@/lib/analysis/trusts';
import { runFederalModel } from '@/lib/analysis/federal-model';
import { getTaxYear, type TaxYearConstants } from '@/lib/tax-year';
import type { Client } from '@/lib/types';
import { DEDUCTION_RULES } from './deductions';
import { FOREIGN_RULES } from './foreign';
import { INDIVIDUAL_RULES } from './individual';
import { TRUST_RULES } from './trust';
import { WEALTH_TRANSFER_RULES } from './wealth-transfer';
import { SEVERITY_ORDER, type Finding, type RuleContext, type RuleDefinition } from './types';

export * from './types';

export const RULES: RuleDefinition[] = [
  ...INDIVIDUAL_RULES,
  ...DEDUCTION_RULES,
  ...WEALTH_TRANSFER_RULES,
  ...TRUST_RULES,
  ...FOREIGN_RULES,
];

const RULES_BY_ID = new Map(RULES.map((rule) => [rule.id, rule]));

export function getRule(id: string): RuleDefinition | undefined {
  return RULES_BY_ID.get(id);
}

export interface ClientEvaluation extends RuleContext {
  findings: Finding[];
  findingsByModule: Record<string, Finding[]>;
  reviewCount: number;
  monitorCount: number;
  informationalCount: number;
  potentialForms: string[];
}

/**
 * Runs every rule against a client and returns both the findings and the
 * intermediate analyses the findings were drawn from. Rules are pure functions
 * of the client record and the tax year constants; nothing here is inferred.
 */
export function evaluateClient(
  client: Client,
  constants: TaxYearConstants = getTaxYear(client.taxYear),
): ClientEvaluation {
  const context: RuleContext = {
    client,
    constants,
    federal: runFederalModel(client, constants),
    gifts: analyzeGifts(client, constants),
    trusts: analyzeTrusts(client, constants),
    foreign: analyzeForeignAccounts(client, constants),
  };

  const findings = RULES.flatMap((rule) => rule.evaluate(context)).sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    return bySeverity !== 0 ? bySeverity : a.ruleId.localeCompare(b.ruleId);
  });

  const findingsByModule: Record<string, Finding[]> = {};
  for (const finding of findings) {
    (findingsByModule[finding.module] ??= []).push(finding);
  }

  const potentialForms = [...new Set(findings.flatMap((finding) => finding.potentialForms))].sort();

  return {
    ...context,
    findings,
    findingsByModule,
    reviewCount: findings.filter((f) => f.severity === 'review').length,
    monitorCount: findings.filter((f) => f.severity === 'monitor').length,
    informationalCount: findings.filter((f) => f.severity === 'informational').length,
    potentialForms,
  };
}

export interface RuleMeta {
  id: string;
  name: string;
  module: string;
  description: string;
  test: string;
  authorityIds: string[];
}

/** Serializable rule metadata for passing across the server/client boundary. */
export const RULE_CATALOG: RuleMeta[] = RULES.map((rule) => ({
  id: rule.id,
  name: rule.name,
  module: rule.module,
  description: rule.description,
  test: rule.test,
  authorityIds: rule.authorityIds,
}));

export function ruleMetaFor(findings: readonly Finding[]): Record<string, RuleMeta> {
  const ids = new Set(findings.map((finding) => finding.ruleId));
  return Object.fromEntries(
    RULE_CATALOG.filter((rule) => ids.has(rule.id)).map((rule) => [rule.id, rule]),
  );
}
