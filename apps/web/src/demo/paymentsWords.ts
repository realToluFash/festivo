import { demoWords } from './demoWords.ts';

const COUNTED = {
  daysBefore_one: '{{count, number}} day before the event',
  daysBefore_other: '{{count, number}} days before the event',
  daysAfter_one: '{{count, number}} day after the event',
  daysAfter_other: '{{count, number}} days after the event',
  saveShapes_one: 'Save {{count, number}} payment',
  saveShapes_other: 'Save {{count, number}} payments',
  shapeFailed_one:
    'This payment was not saved, because it could not be sent. Your row is kept as you filled it in; select Save {{count, number}} payment to send it again.',
  shapeFailed_other:
    'None of these payments were saved, because they could not be sent. Your rows are kept as you filled them in; select Save {{count, number}} payments to send them again.',
  whenReminded_one:
    '{{count, number}} day before a payment is due, and once the day after, then silence.',
  whenReminded_other:
    '{{count, number}} days before a payment is due, and once the day after, then silence.',
} as const;

const { many } = demoWords(COUNTED);

/** sc-88's payments on a vendor's page, sc-1332's shapes and sc-95's reminder setting, in A (budget-a-spec.md §8): [en]'s words and the boards'. */
export const PW = {
  cancelPayment: 'Cancel payment',
  whyNotOwed: 'Why it is not owed',
  whyHelp: 'Kept in the payment’s history.',
  staysCancelled: 'It stays on the schedule as cancelled, and can be restored.',
  keepIt: 'Keep it',
  restore: 'Restore',
  cancelAbout: (vendor: string, what: string, amount: string, due: string) =>
    `${vendor} · ${what} · ${amount} · ${due}`,
  cancelledLine: (why: string, amount: string) =>
    why === '' ? `Cancelled · Not owed · ${amount}` : `Cancelled · Not owed: ${why} · ${amount}`,
  reasonTooLong: (count: number) => `Shorten the reason to ${count} characters or fewer.`,
  alreadyMade: 'Add a payment already made',
  onlyQuoted: 'Only vendors quoted on this event.',
  whatItWasFor: 'What it was for',
  enterWhatItWasFor: 'Enter what it was for.',
  descriptionTooLong: (count: number) => `Shorten the description to ${count} characters or fewer.`,
  beforeFirstQuote: (vendor: string, day: string) =>
    `The date paid cannot be before the quote from ${vendor} on ${day}. Choose that date or a later one.`,
  addAsPaid: 'Add as paid',
  datePaidAhead: 'The date paid cannot be in the future. Choose today or an earlier date.',
  wrongCurrency: (currency: string) =>
    `Enter the amount in ${currency}, the currency this event uses.`,
  noEntitlement:
    'Payments cannot be marked paid on this organisation’s plan, so nothing has changed.',
  addedByYou: (day: string) => `Paid ${day}. Added by you as already paid, so Undo deletes it.`,
  addedBy: (day: string, name: string) =>
    `Paid ${day}. Added by ${name} as already paid, so Undo deletes it.`,
  deleted: (amount: string, vendor: string, day: string, what: string) =>
    `Deleted the payment of ${amount} to ${vendor} on ${day}: ${what}.`,
  noLongerChased: 'No longer chased.',
  referenceTooLong: (count: number) => `Shorten the reference to ${count} characters or fewer.`,
  alreadyPaid: (name: string) => `${name} has already marked this paid, so nothing has changed.`,
  alreadyCancelled: 'This payment has been cancelled, so it cannot be marked paid.',
  close: 'Close',
  moreThan: (gap: string) => `${gap} more than scheduled`,
  lessThan: (gap: string) => `${gap} less than scheduled`,
  differenceStays: (difference: string) =>
    `${difference}. The difference stays visible; nothing absorbs it.`,
  paidLine: (amount: string, day: string, difference: string | null, by: string) =>
    difference == null
      ? `Paid ${amount} on ${day} · Marked by ${by}`
      : `Paid ${amount} on ${day} · ${difference} · Marked by ${by}`,
  howItIsPaid: 'How it is paid',
  shapes: {
    deposit: 'Deposit and balance',
    instalments: 'Three instalments',
    before: 'In full before the event',
    after: 'In full after the event',
    rows: 'Enter rows yourself',
  },
  deposit: 'Deposit',
  secondInstalment: 'Second instalment',
  balance: 'Balance',
  inFull: 'Payment in full',
  onTheDateQuoted: 'on the date quoted',
  daysBefore: (days: number) =>
    days === 0 ? 'On the event’s start date' : many('daysBefore', days),
  daysAfter: (days: number) => (days === 0 ? 'On the event’s end date' : many('daysAfter', days)),
  saveShapes: (count: number) => many('saveShapes', count),
  shapeLine: (share: string, when: string, day: string, clamped: boolean) =>
    clamped ? `${share} · ${when} · Set to the date quoted, ${day}` : `${share} · ${when} · ${day}`,
  eachRowSaved: 'Each row is saved as an ordinary payment; change any of them after saving.',
  sharesShort: (total: string, gap: string) =>
    `The percentages come to ${total}, so ${gap} of the quote is not scheduled. You can still save these payments, and the vendor’s page will show the difference.`,
  sharesOver: (total: string, gap: string) =>
    `The percentages come to ${total}, so the schedule is ${gap} over the quote. You can still save these payments, and the vendor’s page will show the difference.`,
  shareField: 'Percentage of the quote',
  shareHelp: 'From 0 to 100, with up to two decimal places.',
  enterShare: 'Enter a percentage from 0 to 100, with up to two decimal places.',
  daysBeforeField: 'Days before the event',
  daysAfterField: 'Days after the event',
  shapeDaysHelp: 'A whole number from 0 to 730.',
  enterShapeDays: 'Enter a whole number of days from 0 to 730.',
  noDescription: 'No description yet',
  shapeFailed: (count: number) => many('shapeFailed', count),
  raced:
    'Payments were added to this vendor’s schedule while you were filling this in, so none of yours were saved. Check the payments it has now before adding more.',
  paymentReminders: 'Payment reminders',
  whenReminded: (days: number) => many('whenReminded', days),
  change: 'Change',
  whoHears: 'Who hears',
  whoHearsLine: 'The organisation’s owners and admins, and each event’s lead.',
  how: 'How',
  howLine: 'Through the channels each person chose in Notifications',
  daysField: 'Days before a payment is due',
  daysHelp:
    'From 1 to 30. Counted in each event’s own time zone. A change applies to reminders not sent yet.',
  stopsReminders: 'Marking a payment paid or cancelling it stops its reminders.',
  remindersOff: 'Payment reminders are off',
  remindersOffLine:
    'This organisation’s plan no longer includes payment schedules, so no reminders go out. Their history stays readable.',
  enterDays: 'Enter a whole number of days from 1 to 30.',
} as const;
