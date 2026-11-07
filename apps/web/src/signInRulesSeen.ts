import type { Membership } from '@soirely/api-client';
import { useSyncExternalStore } from 'react';

const SEEN = 'soirely.signInRulesSeen.';
const listeners = new Set<() => void>();
/** What this page load was told, for a browser that refuses storage. */
const remembered = new Map<string, string>();

/** The change to an organisation's sign-in rules this device last saw, so the notice says it once. */
export function useRulesSeen(organisationId: string): string | null {
  return useSyncExternalStore(subscribe, () => seenAt(organisationId));
}

/** Per device, as a notice someone closed: the rules page counts as having read it. */
export function markRulesSeen(organisation: Membership): void {
  const changedAt = organisation.signInRules.changedAt;
  if (changedAt == null || seenAt(organisation.id) === changedAt) return;

  remembered.set(organisation.id, changedAt);
  try {
    window.localStorage.setItem(SEEN + organisation.id, changedAt);
  } catch {
    // Private windows refuse storage; the notice then comes back on the next load.
  }
  for (const listener of listeners) listener();
}

function seenAt(organisationId: string): string | null {
  const told = remembered.get(organisationId);
  if (told != null) return told;

  try {
    return window.localStorage.getItem(SEEN + organisationId);
  } catch {
    return null;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
