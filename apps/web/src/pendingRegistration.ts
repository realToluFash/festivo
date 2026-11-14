import { type PendingRegistration } from '@soirely/api-client';

const KEY = 'soirely.registration';

/** Per tab, so a reload of "Check your email" keeps it, and dropped once the code has made the account. */
export function holdRegistration(pending: PendingRegistration): void {
  sessionStorage.setItem(KEY, JSON.stringify(pending));
}

export function heldRegistration(): PendingRegistration | null {
  const raw = sessionStorage.getItem(KEY);
  if (raw == null) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PendingRegistration>;

    return typeof parsed.registration === 'string' && typeof parsed.email === 'string'
      ? { registration: parsed.registration, email: parsed.email }
      : null;
  } catch {
    return null;
  }
}

export function dropRegistration(): void {
  sessionStorage.removeItem(KEY);
}
