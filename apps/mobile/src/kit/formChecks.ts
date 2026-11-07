import { emailProblem } from '@soirely/domain';
import type { TFunction } from 'i18next';
import { useState } from 'react';

export type FieldErrors<F extends string> = Partial<Record<F, string>>;

/** Every field checked at once, in screen order; `first` is the one to focus. */
export function checkAll<F extends string>(
  order: readonly F[],
  check: (field: F, value: string) => string | null,
  values: Record<F, string>,
): { errors: FieldErrors<F>; first: F | null } {
  const errors: FieldErrors<F> = {};

  for (const field of order) {
    const message = check(field, values[field]);
    if (message != null) errors[field] = message;
  }

  return { errors, first: order.find((field) => errors[field] != null) ?? null };
}

/** The email check's words, the same on every form that asks for an address. */
export function emailMessage(value: string, t: TFunction): string | null {
  const problem = emailProblem(value);

  if (problem == null) return null;

  return problem === 'blank' ? t('forms.emailBlank') : t('forms.emailShape');
}

/** sc-63's "Forms check before they send": every field on the press, then each as it is left, and a message gone once its field is right. */
export function useFormChecks<F extends string>(
  order: readonly F[],
  check: (field: F, value: string) => string | null,
  focus: (field: F) => void,
) {
  const [errors, setErrors] = useState<FieldErrors<F>>({});
  const [pressed, setPressed] = useState(false);

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
    passes(values: Record<F, string>): boolean {
      const found = checkAll(order, check, values);

      setPressed(true);
      setErrors(found.errors);
      if (found.first != null) focus(found.first);

      return found.first == null;
    },
    left(field: F, value: string): void {
      if (pressed) set(field, check(field, value));
    },
    edited(field: F, value: string): void {
      if (errors[field] != null && check(field, value) == null) set(field, null);
    },
  };
}
