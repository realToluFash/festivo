import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Membership } from '@soirely/api-client';
import { useEffect, useSyncExternalStore } from 'react';

const SEEN = 'soirely.signInRulesSeen.';
const listeners = new Set<() => void>();
/** What this device was told, read from storage once per organisation and kept here after. */
const seen = new Map<string, string | null>();

/** The change to an organisation's sign-in rules this device last saw (sc-69), so the notice says it once. */
export function useRulesSeen(organisationId: string): string | null | undefined {
  useEffect(() => {
    if (seen.has(organisationId)) return;

    void AsyncStorage.getItem(SEEN + organisationId)
      .catch(() => null)
      .then((at) => {
        if (seen.has(organisationId)) return;
        seen.set(organisationId, at);
        for (const listener of listeners) listener();
      });
  }, [organisationId]);

  return useSyncExternalStore(subscribe, () => seen.get(organisationId));
}

/** Closing the notice, or opening the rules it points to, counts as having read it. */
export function markRulesSeen(organisation: Membership): void {
  const changedAt = organisation.signInRules.changedAt;
  if (changedAt == null || seen.get(organisation.id) === changedAt) return;

  seen.set(organisation.id, changedAt);
  void AsyncStorage.setItem(SEEN + organisation.id, changedAt).catch(() => {});
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}
