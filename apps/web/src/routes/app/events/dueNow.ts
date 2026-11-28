import { type DueNow, type DueNowRow } from '@soirely/api-client';

/** A row as Due now shows it: marked on this sheet, still owed, or settled since the reminder. */
export type DueRowState = 'marked' | 'owed' | 'paid' | 'cancelled' | 'removed';

export function dueRowState(row: DueNowRow, markedHere: ReadonlySet<string>): DueRowState {
  if (markedHere.has(row.paymentId) && row.payment?.paid != null) return 'marked';
  if (row.payment == null) return 'removed';
  if (row.payment.paid != null) return 'paid';
  if (row.payment.cancelled != null) return 'cancelled';

  return 'owed';
}

/** Nothing left to pay: every row paid, cancelled or removed, those marked here included. */
export function dueSettled(sheet: DueNow, markedHere: ReadonlySet<string>): boolean {
  return sheet.rows.every((row) => dueRowState(row, markedHere) !== 'owed');
}

/** A day as "Nov 1" in the reader's locale: the reminder's date and the day a payment was paid. */
export function monthDay(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`));
}
