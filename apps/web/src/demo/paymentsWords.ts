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
  beforeFirstQuote: (day: string) =>
    `A payment cannot be dated before the vendor’s first quote, ${day}.`,
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
  daysBefore: (days: number) => `${days} days before the event`,
  daysAfter: (days: number) => `${days} days after the event`,
  shapeLine: (share: string, when: string, day: string, clamped: boolean) =>
    clamped ? `${share} · ${when} · Set to the date quoted, ${day}` : `${share} · ${when} · ${day}`,
  eachRowSaved: 'Each row is saved as an ordinary payment; change any of them after saving.',
  sharesShort: (total: string, gap: string) =>
    `The percentages come to ${total}. The schedule is ${gap} short of the quote; it saves, and the vendor’s page says so.`,
  sharesOver: (total: string, gap: string) =>
    `The percentages come to ${total}. The schedule is ${gap} over the quote; it saves, and the vendor’s page says so.`,
  raced:
    'Payments were added to this vendor’s schedule while you were filling this in, so none of yours were saved. Check the payments it has now before adding more.',
  paymentReminders: 'Payment reminders',
  whenReminded: (days: number) =>
    `${days === 1 ? '1 day' : `${days} days`} before a payment is due, and once the day after, then silence.`,
  change: 'Change',
  whoHears: 'Who hears',
  whoHearsLine: 'The organisation’s owners and admins, and each event’s lead.',
  how: 'How',
  howLine: 'Through the channels each person chose in Notifications',
  daysField: 'Days before a payment is due',
  daysHelp: 'From 1 to 30. A change applies to reminders not yet sent.',
  enterDays: 'Enter a whole number of days from 1 to 30.',
} as const;
