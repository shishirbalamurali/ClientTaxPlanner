'use client';

import { useSyncExternalStore } from 'react';
import type { Client } from '@/lib/types';

/**
 * Holds a record the visitor loaded, for the length of one browser tab.
 *
 * sessionStorage rather than localStorage on purpose: the record disappears
 * when the tab closes, so a financial record cannot outlive the sitting that
 * created it. Nothing is sent anywhere — the analysis runs in the browser.
 */

const KEY = 'tax-simulator:workspace-client';
const CHANGED = 'tax-simulator:workspace-client-changed';

function read(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    // Private browsing modes can throw rather than return null.
    return null;
  }
}

export function saveWorkspaceClient(client: Client): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(client));
  } catch {
    // Nothing useful to do; the workspace simply will not persist across views.
  }
  window.dispatchEvent(new Event(CHANGED));
}

export function clearWorkspaceClient(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
  window.dispatchEvent(new Event(CHANGED));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/**
 * `undefined` means "not determined yet" — the server renders that, and the
 * browser replaces it on hydration. `null` means nothing is loaded.
 */
export function useWorkspaceClient(): Client | null | undefined {
  const raw = useSyncExternalStore(
    subscribe,
    read,
    () => null,
  );
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as Client;
  } catch {
    return null;
  }
}
