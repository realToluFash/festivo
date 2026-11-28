import { asPayment, type ScheduledPayment } from './quotes.ts';

export interface DueNowEvent {
  id: string;
  name: string;
  currency: string;
  /** The day it is now on the event's clock, YYYY-MM-DD: the date Paid sends. */
  today: string;
}

export interface DueNowRow {
  paymentId: string;
  eventId: string;
  vendor: string;
  description: string;
  /** What the reminder said was due, in the event's currency. */
  amount: string;
  /** As it is now; null once removed from the schedule. */
  payment: ScheduledPayment | null;
}

/** The payments one reminder named, in its order, on the events the reader still holds the budget on (sc-1331). */
export interface DueNow {
  /** The day the reminder was sent, YYYY-MM-DD, on the first event's clock. */
  sentOn: string;
  /** The plan no longer has payment schedules: nothing on the sheet marks or unmarks. */
  readOnly: boolean;
  events: DueNowEvent[];
  rows: DueNowRow[];
}

type Row = Record<string, unknown>;

const record = (value: unknown): Row =>
  value != null && typeof value === 'object' ? (value as Row) : {};
const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export function asDueNow(value: unknown): DueNow {
  const body = record(value);

  return {
    sentOn: text(body.sentOn),
    readOnly: body.readOnly === true,
    events: list(body.events).map((one) => {
      const event = record(one);

      return {
        id: text(event.id),
        name: text(event.name),
        currency: text(event.currency),
        today: text(event.today),
      };
    }),
    rows: list(body.rows).map((one) => {
      const row = record(one);

      return {
        paymentId: text(row.paymentId),
        eventId: text(row.eventId),
        vendor: text(row.vendor),
        description: text(row.description),
        amount: text(row.amount) || '0',
        payment: row.payment == null ? null : asPayment(row.payment),
      };
    }),
  };
}
