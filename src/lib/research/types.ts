export type AuthorityCategory =
  | 'individualIncome'
  | 'investmentIncome'
  | 'deductions'
  | 'wealthTransfer'
  | 'fiduciary'
  | 'international'
  | 'compliance';

export type AuthorityKind =
  | 'statute'
  | 'regulation'
  | 'publicLaw'
  | 'revenueProcedure'
  | 'formInstructions'
  | 'publication'
  | 'agencyGuidance';

/**
 * A single citable item in the research library. Nothing in the application is
 * allowed to assert a filing consequence without pointing at one of these.
 */
export interface Authority {
  id: string;
  topic: string;
  taxYear: number | 'all';
  /** Plain-language statement of what the source actually says. */
  ruleDescription: string;
  citation: string;
  governmentSource: string;
  sourceUrl: string;
  /** ISO date on which the URL and the quoted amounts were last checked. */
  lastVerified: string;
  category: AuthorityCategory;
  kind: AuthorityKind;
  relatedForms: string[];
}
