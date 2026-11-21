export const REMINDER_DAYS_MINIMUM = 1;

export const REMINDER_DAYS_MAXIMUM = 30;

/** Whole days from 1 to 30, as the server holds it (sc-95); anything else is refused naming the range. */
export function typedDays(typed: string): number | null {
  const plain = typed.trim();
  if (!/^\d+$/u.test(plain)) return null;
  const days = Number(plain);

  return days >= REMINDER_DAYS_MINIMUM && days <= REMINDER_DAYS_MAXIMUM ? days : null;
}
