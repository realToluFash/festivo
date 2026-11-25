import type { Membership } from '@soirely/api-client';
import { type TwoFactorStanding, anyNotOverdue, twoFactorStanding } from '@soirely/domain';
import { useEffect, useState } from 'react';

/** The member's standing (sc-609), turning overdue at the deadline itself on a screen left open. */
export function useTwoFactorStanding(organisation: Membership | null): TwoFactorStanding {
  const due = organisation?.twoFactorDue ?? null;
  const [now, setNow] = useState(() => Date.now());
  const standing = twoFactorStanding(due, now);

  useEffect(() => {
    if (due == null || standing !== 'due') return;

    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(0, Date.parse(due.at) - Date.now()),
    );

    return () => clearTimeout(timer);
  }, [due, standing]);

  return standing;
}

/** Whether any of these organisations is one the member can still work in, read once when the page is drawn (sc-85645). */
export function useAnyNotOverdue(
  organisations: readonly Partial<Pick<Membership, 'twoFactorDue'>>[],
): boolean {
  const [drawnAt] = useState(() => Date.now());

  return anyNotOverdue(organisations, drawnAt);
}
