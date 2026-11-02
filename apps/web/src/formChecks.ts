import { emailProblem } from '@soirely/domain';
import type { TFunction } from 'i18next';
import { useEffect, useState } from 'react';

import { holdMovedClicks } from './movedClicks.ts';

/** sc-63's "Forms check before they send": every field on the first press, then each as it is left, and a message gone as soon as its field is right. */
export function useFormChecks<F extends string>(
  order: readonly F[],
  check: (field: F, value: string) => string | null,
  focus: (field: F) => void,
) {
  const [errors, setErrors] = useState<Partial<Record<F, string>>>({});
  const [pressed, setPressed] = useState(false);

  useEffect(holdMovedClicks, []);

  function set(field: F, message: string | null): void {
    setErrors((previous) => {
      const next = { ...previous };
      if (message == null) delete next[field];
      else next[field] = message;

      return next;
    });
  }

  return {
    errors,
    /** On the press: true when the form may be sent; otherwise every failing field says why and the first is focused. */
    passes(values: Record<F, string>): boolean {
      const found: Partial<Record<F, string>> = {};
      for (const field of order) {
        const message = check(field, values[field]);
        if (message != null) found[field] = message;
      }

      setPressed(true);
      setErrors(found);

      const first = order.find((field) => found[field] != null);
      if (first == null) return true;

      focus(first);
      return false;
    },
    left(field: F, value: string): void {
      if (pressed) set(field, check(field, value));
    },
    edited(field: F, value: string): void {
      if (errors[field] != null && check(field, value) == null) set(field, null);
    },
  };
}

/** The email check's words, the same on every form that asks for an address. */
export function emailMessage(value: string, t: TFunction): string | null {
  const problem = emailProblem(value);

  if (problem == null) return null;

  return problem === 'blank' ? t('forms.emailBlank') : t('forms.emailShape');
}
