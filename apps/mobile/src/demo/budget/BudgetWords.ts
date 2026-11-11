import type { CeilingState } from './BudgetModel.ts';

/** The boards' English (budget-a-spec.md §8): the stories' settled words, and the boards' proposals listed in the PR. */
export const W = {
  budget: 'Budget',
  live: 'Live',
  rangeLine: 'The lower figure is settled; the upper is if everybody still to answer says yes.',
  markPaid: 'Mark paid',
  markingPaid: 'Marking paid…',
  perHeadSettled: 'Per head, settled',
  perHeadIfAll: 'Per head, if all come',
  dueNext: 'Due next',
  everythingDue: 'Everything due',
  overdue: 'Overdue',
  nothingDue: 'Nothing is due.',
  undo: 'Undo',
  ceiling: 'Ceiling',
  wholeEvent: 'Whole event',
  againstPlan: 'Against plan',
  planned: 'Planned',
  committed: 'Committed',
  whatQuoted: 'What the vendors quoted',
  paid: 'Paid',
  stillToPay: 'Still to pay',
  whoIsPaying: 'Who is paying',
  noPayersYet: 'No payers yet',
  costs: 'Costs',
  notPriced: 'Not priced',
  noPriceYet: 'No price yet',
  nothingYet: 'Nothing yet',
  notCounted: 'Not counted',
  aFixedAmount: 'A fixed amount',
  loading: 'Loading the budget…',
  markingNeedsConnection:
    'Marking paid needs a connection. It comes back once the figures are up to date.',
  reconnecting: 'Getting the latest figures…',
  neverLoaded:
    'No connection. The budget needs a connection to load the first time, then stays readable without one.',
  noCostsYet: 'No costs yet',
  costsOnComputer: 'Costs are added on a computer and show here as soon as they are.',
  noCostsLine: 'No costs yet. Costs are added on a computer and show here as soon as they are.',
  readOnly:
    'Quotes and payment schedules are read-only because this organisation’s plan no longer includes them. Nothing has been removed.',
  seePlans: 'See plans',
  scheduled: 'Scheduled',
  amountPaid: 'Amount paid',
  datePaid: 'Date paid',
  reference: 'Reference · Optional',
  cancel: 'Cancel',
  close: 'Close',
  amountWrong: 'Enter the amount as a number above 0, like 3,500.50.',
  dateLate: 'The date paid cannot be in the future. Choose today or an earlier date.',
  done: 'Done',
  referenceLong: 'Shorten the reference to 100 characters or fewer.',
  alreadyPaid: (name: string) => `${name} has already marked this paid, so nothing has changed.`,
  cancelled: 'This payment has been cancelled, so it cannot be marked paid.',
  dueNow: 'Due now',
  paidOne: 'Paid',
  paidDifferent: 'Paid a different amount',
  cancelledWord: 'Cancelled',
  nothingLeftHead: 'Nothing left to pay.',
  hasAPayer: 'Has a payer',
  noPayerYet: 'No payer yet',
  chosenOnComputer: 'Who pays is chosen on a computer.',
  noPayersLine: 'No payers yet. Payers are added on a computer and show here as soon as they are.',
  theirShare: 'Their share',
  fixedShare: 'Replies do not change this.',
  stillToCome: 'Still to come',
  nothingStillToCome: 'Nothing still to come',
  covers: 'Covers',
  allOfIt: 'all of it',
  half: 'half',
  sendAgain: 'Send again',
  sending: 'Sending…',
  sendNeedsConnection: 'Sending a link needs a connection.',
  notCreated: 'The link was not created, so nothing has been sent. Try again.',
  shareSheet: 'Send hands the link to your phone’s share sheet, with its message.',
  wrongCurrency: 'Enter the amount in British Pound, the currency this event uses.',
  planRefused:
    'Payments cannot be marked paid on this organisation’s plan, so nothing has changed.',
  noLongerChased: 'No longer chased.',
  loadingPayers: 'Loading who is paying…',
  needsNewAmounts: 'Needs new amounts',
  asksPassphrase: 'Asks for a passphrase.',
  overdueLast: 'Overdue · last reminder',
  app: 'Soirely',
  justNow: 'now',
} as const;

const STATE_WORD: Record<CeilingState, string> = {
  within: 'Within',
  close: 'Close',
  overIf: 'Over if all come',
  over: 'Over',
};

export const say = {
  state: (state: CeilingState) => STATE_WORD[state],
  notPricedLine: (count: number) =>
    count === 1 ? '1 cost not priced yet.' : `${count} costs not priced yet.`,
  notPriced: (count: number) =>
    count === 1 ? '1 cost not priced yet' : `${count} costs not priced yet`,
  range: (low: string, high: string) => (low === high ? low : `${low} to ${high}`),
  coming: (count: number) => `${count} coming`,
  everythingDue: (count: number) => `Everything due · ${count}`,
  overdue: (vendor: string, what: string, amount: string, date: string) =>
    `${vendor}’s ${what.toLowerCase()}, ${amount}, was due ${date}.`,
  dueTomorrow: (vendor: string, what: string, amount: string, date: string) =>
    `${vendor}’s ${what.toLowerCase()}, ${amount}, is due tomorrow, ${date}.`,
  dueOn: (vendor: string, what: string, amount: string, date: string) =>
    `${vendor}’s ${what.toLowerCase()}, ${amount}, is due ${date}.`,
  dueLine: (what: string, date: string) => `${what} · Due ${date}`,
  markedPaid: (amount: string, date: string) => `Marked paid: ${amount} on ${date}.`,
  unmarked: (vendor: string) => `Unmarked. ${vendor} is due again.`,
  asOf: (time: string, minutes: number) =>
    `No connection. Figures as of ${time}, ${minutes === 1 ? '1 minute' : `${minutes} minutes`} ago.`,
  ceilingRow: (amount: string) => `${W.wholeEvent} · ${amount}`,
  within: (ifAll: string, ceiling: string) =>
    `If everyone comes, it would be ${ifAll} against ${ceiling}.`,
  overIf: (settled: string, ifAll: string, ceiling: string) =>
    `Settled, it is ${settled}. If everyone comes, it would be ${ifAll} against ${ceiling}.`,
  over: (settled: string, ceiling: string) => `Settled, it is ${settled} against ${ceiling}.`,
  paymentsMarked: (count: number) =>
    count === 1 ? '1 payment marked paid' : `${count} payments marked paid`,
  notScheduled: (amount: string) => `${amount} of the quotes is not scheduled yet`,
  paymentsScheduled: (count: number) =>
    count === 1 ? '1 payment scheduled' : `${count} payments scheduled`,
  payersLine: (count: number, noPayer: string) =>
    `${count === 1 ? '1 payer' : `${count} payers`} · ${noPayer} has no payer yet`,
  payers: (count: number) => (count === 1 ? '1 payer' : `${count} payers`),
  hasAPayer: (range: string, noPayer: string, costs: number) =>
    `Has a payer, out of ${range}. ${noPayer} across ${costs === 1 ? '1 cost' : `${costs} costs`} has no payer yet.`,
  outOf: (range: string) => `Out of ${range}`,
  costCount: (count: number) => (count === 1 ? '1 cost' : `${count} costs`),
  rate: (rate: string, basis: 'perHead' | 'perDay' | 'perTable') =>
    `${rate} ${basis === 'perHead' ? 'a head' : basis === 'perDay' ? 'a day' : 'a table'}`,
  quantity: (rate: string, count: number, source: string) => `${rate} × ${count} · ${source}`,
  nothingYetLine: (rate: string, source: string) => `${rate} · ${W.nothingYet} · ${source}`,
  sendTo: (name: string) => `Send to ${name}`,
  sendAgainTo: (name: string) => `${W.sendAgain} to ${name}`,
  notSent: 'Not sent yet.',
  sent: 'Sent, not opened yet.',
  opened: (times: number, day: string, time: string) =>
    `Opened ${times === 1 ? 'once' : `${times} times`}. Last on ${day} at ${time}.`,
  removed: (name: string) => `${name} is no longer a payer on this event.`,
  fromReminder: (date: string, count: number) =>
    `From the reminder sent ${date} · ${count === 1 ? '1 payment' : `${count} payments`}`,
  overdueSince: (what: string, date: string, event: string) =>
    `${what} · Overdue since ${date} · ${event}`,
  dueOnEvent: (what: string, date: string, event: string) => `${what} · Due ${date} · ${event}`,
  markedRow: (amount: string) => `Marked paid · ${amount}`,
  paidBy: (name: string, date: string) => `Paid by ${name} on ${date}`,
  everythingDueOn: (event: string) => `Everything due on ${event}`,
  more: (amount: string) =>
    `${amount} more than scheduled. The difference stays visible; nothing absorbs it.`,
  less: (amount: string) =>
    `${amount} less than scheduled. The difference stays visible; nothing absorbs it.`,
  ownDesign: (what: string) => `${what} has its own design.`,
  paymentFor: (vendor: string, what: string, event: string) => `${vendor} · ${what} · ${event}`,
  due: (date: string) => `Due ${date}`,
  rateChanged: (who: string, cost: string, rate: string, amount: string, up: boolean) =>
    `${who} changed ${cost} to ${rate}, so the settled total went ${up ? 'up' : 'down'} by ${amount}.`,
  ceilingSet: (who: string, amount: string) =>
    `${who} set a ceiling of ${amount} for the whole event.`,
  ceilingChanged: (who: string, amount: string, state: CeilingState) =>
    `${who} changed the whole event’s ceiling to ${amount}, so it is now ${STATE_WORD[state]}.`,
  ceilingsCleared: (who: string) => `${who} cleared the ceilings.`,
  whoPaysChanged: (who: string, cost: string) => `${who} changed who pays for ${cost}.`,
  reminderOverdue: (count: number, event: string) =>
    `${count === 1 ? '1 payment' : `${count} payments`} overdue on ${event}`,
  reminderMixed: (overdue: number, due: number, days: number) =>
    `${overdue === 1 ? '1 payment' : `${overdue} payments`} overdue, ${due} due in the next ${days} days`,
  reminderRow: (vendor: string, amount: string, when: string) => `${vendor} · ${amount} · ${when}`,
  wasDue: (date: string) => `was due ${date}`,
  dueWhen: (date: string) => `due ${date}`,
  lastAbout: (what: string, vendor: string) =>
    `This is the last reminder about the ${what.toLowerCase()} to ${vendor}.`,
};
