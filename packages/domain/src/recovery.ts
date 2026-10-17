export type RecoveryFirstStep = 'opening' | 'held' | 'signIn';

/** With a sign-in in hand, that person's own request: a handle held for anybody else is never shown (sc-509). */
export function recoveryFirstStep(
  challenge: string | null,
  held: string | null,
): RecoveryFirstStep {
  if (challenge != null) return 'opening';

  return held != null ? 'held' : 'signIn';
}
