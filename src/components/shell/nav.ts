export interface NavItem {
  slug: string;
  label: string;
  hint: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Engagement',
    items: [
      { slug: 'dashboard', label: 'Dashboard', hint: 'Review items and headline figures' },
      { slug: 'profile', label: 'Client Profile', hint: 'Facts the analysis runs on' },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { slug: 'individual-tax', label: 'Individual Tax', hint: 'Form 1040 income analysis' },
      { slug: 'wealth-transfer', label: 'Wealth Transfer', hint: 'Form 709 gifting dashboard' },
      { slug: 'trusts', label: 'Trusts', hint: 'Form 1041 fiduciary dashboard' },
      { slug: 'foreign-accounts', label: 'Foreign Accounts', hint: 'FBAR and Form 8938' },
      { slug: 'scenarios', label: 'Scenario Analysis', hint: 'Side-by-side comparison' },
      { slug: 'research', label: 'Research Library', hint: 'Rules, sources and flag tracing' },
    ],
  },
  {
    label: 'Deliverable',
    items: [
      { slug: 'summary', label: 'Executive Summary', hint: 'Client-facing memorandum' },
    ],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

export function navHref(basePath: string, slug: string): string {
  return `${basePath}/${slug}`;
}

/** Base path for the three records that ship with the project. */
export function sampleBasePath(clientId: string): string {
  return `/clients/${clientId}`;
}

/** Base path for a record the visitor loaded in their own browser. */
export const WORKSPACE_BASE_PATH = '/workspace';
