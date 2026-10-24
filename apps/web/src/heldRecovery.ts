const KEY = 'soirely.twoFactorRecovery';

/** The request's handle, per tab: a reload of the waiting screen keeps it, and an answer drops it (sc-509). */
export function holdRecovery(recovery: string): void {
  sessionStorage.setItem(KEY, recovery);
}

export function heldRecovery(): string | null {
  return sessionStorage.getItem(KEY);
}

export function dropRecovery(): void {
  sessionStorage.removeItem(KEY);
}
