import { BUSINESS_OWNER } from './business-owner';
import { CORPORATE_EXECUTIVE } from './corporate-executive';
import { INTERNATIONAL_EXECUTIVE } from './international-executive';
import type { Client } from '@/lib/types';

export const SAMPLE_CLIENTS: Client[] = [
  CORPORATE_EXECUTIVE,
  BUSINESS_OWNER,
  INTERNATIONAL_EXECUTIVE,
];

export const DEFAULT_CLIENT_ID = CORPORATE_EXECUTIVE.id;

export function getClient(id: string): Client | undefined {
  return SAMPLE_CLIENTS.find((client) => client.id === id);
}

export function requireClient(id: string): Client {
  const client = getClient(id);
  if (!client) throw new Error(`Unknown client id "${id}".`);
  return client;
}

export { BUSINESS_OWNER, CORPORATE_EXECUTIVE, INTERNATIONAL_EXECUTIVE };
