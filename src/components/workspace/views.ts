/**
 * Plain module on purpose. The route needs this list at build time to prerender
 * the workspace shells, and a value exported from a 'use client' module reaches
 * the server as a reference rather than the array itself.
 */
export const WORKSPACE_VIEWS = [
  'dashboard',
  'profile',
  'individual-tax',
  'wealth-transfer',
  'trusts',
  'foreign-accounts',
  'scenarios',
  'research',
  'summary',
] as const;

export type WorkspaceViewSlug = (typeof WORKSPACE_VIEWS)[number];
