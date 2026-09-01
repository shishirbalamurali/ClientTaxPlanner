'use client';

import { useSyncExternalStore } from 'react';

const HASH_REPLACED = 'finding-hash-replaced';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  window.addEventListener(HASH_REPLACED, onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
    window.removeEventListener(HASH_REPLACED, onChange);
  };
}

/**
 * The location hash as a reactive value. Reading it through an external store
 * rather than an effect keeps the server snapshot empty, which is what the
 * server actually renders, so there is nothing to reconcile on hydration.
 */
export function useHash(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.hash.slice(1),
    () => '',
  );
}

/** Rewrites the hash in place — no history entry — and notifies `useHash`. */
export function replaceHash(hash: string): void {
  const url = new URL(window.location.href);
  url.hash = hash;
  window.history.replaceState(null, '', url.toString());
  window.dispatchEvent(new Event(HASH_REPLACED));
}
