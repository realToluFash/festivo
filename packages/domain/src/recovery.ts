export type RecoveryFirstStep = 'opening' | 'held' | 'signIn';

/** With a sign-in in hand, that person's own request: a handle held for anybody else is never shown (sc-509). */
export function recoveryFirstStep(
  challenge: string | null,
  held: string | null,
): RecoveryFirstStep {
  if (challenge != null) return 'opening';

  return held != null ? 'held' : 'signIn';
}

export type AnsweredRecovery = 'waiting' | 'approved' | 'turned_down';

/** The sentence under the heading: with nobody left to answer, one that names no organisation (sc-1848). */
export function recoveryIntroKey(status: AnsweredRecovery, nobody: boolean): string {
  if (status === 'approved') {
    return nobody ? 'lostTwoFactor.approvedIntroNobody' : 'lostTwoFactor.approvedIntro';
  }
  if (nobody) return 'lostTwoFactor.nobodyIntro';

  return status === 'waiting' ? 'lostTwoFactor.waitingIntro' : 'lostTwoFactor.turnedDownIntro';
}
