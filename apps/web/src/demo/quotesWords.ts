/** sc-87's quotes and schedules and sc-88's Mark paid, in A (budget-a-spec.md §8): en's words from #1427 and the boards' proposals, kept in the demo. */
export const QW = {
  schedule: 'Schedule',
  theQuote: 'The quote',
  quoted: 'Quoted',
  reviseTheQuote: 'Revise the quote',
  correctTheQuote: 'Correct the quote',
  reviseInstead: 'Revise the quote instead',
  correctInstead: 'Correct the quote instead',
  whatItCovers: 'What it covers',
  quoteNumber: 'Quote number',
  noQuoteNumber: 'No quote number',
  budgetLines: 'Budget lines',
  noLines: 'None',
  showEarlier: 'Show the earlier quote',
  theEarlier: 'The earlier quote',
  earlierLine: (amount: string, day: string, number: string) =>
    number === '' ? `${amount}, quoted on ${day}` : `${amount}, quoted on ${day} · No. ${number}`,
  vendorLine: (category: string, contact: string) =>
    contact === '' ? category : `${category} · ${contact}`,
  quotedOn: (day: string, difference: string) => `Quoted on ${day}. ${difference}`,
  wasDue: (what: string, amount: string, day: string) =>
    `The ${what.toLocaleLowerCase('en')}, ${amount}, was due ${day}.`,
  matches: 'The schedule matches the quote.',
  short: (gap: string) => `${gap} of the quote is not scheduled yet.`,
  over: (gap: string) => `The schedule is ${gap} over the quote.`,
  quotedScheduled: (quoted: string, scheduled: string) =>
    `Quoted ${quoted} · Scheduled ${scheduled}`,
  matchesShort: 'Matches the quote',
  shortShort: (gap: string) => `${gap} not scheduled`,
  overShort: (gap: string) => `${gap} over the quote`,
  addAPayment: 'Add a payment',
  noPayments: 'No payments scheduled yet.',
  change: 'Change',
  removeAsk: 'Remove this payment?',
  vendor: 'Vendor',
  vendors: 'Vendors',
  typeAName: 'Type a vendor’s name',
  optional: 'Optional',
  amount: 'Amount',
  dateQuoted: 'Date quoted',
  inPounds: 'In pounds, the currency this event uses.',
  numberHelp: 'The number the vendor uses for this quote, so a call can start with it.',
  linesItAgrees: 'Budget lines it agrees',
  agreedIn: (vendor: string) => `Agreed in the quote from ${vendor}`,
  notPricedLine: (category: string) => `Not priced · ${category}`,
  priced: (amount: string, category: string) => `${amount} · ${category}`,
  add: 'Add',
  revise: 'Revise',
  reviseIntro:
    'Revising saves this quote with a new amount or date quoted. The current quote is kept as an earlier quote, under Show the earlier quote. To change only what it covers, its quote number or its budget lines, correct the quote instead.',
  correctIntro:
    'Correct what this quote covers, its quote number or its budget lines. No earlier version is kept. To change the amount or the date quoted, revise the quote, which keeps this one as an earlier quote.',
  whatFor: 'What the payment is for',
  whatForHelp: 'Deposit, second instalment, balance.',
  dateDue: 'Date due',
  chooseTheVendor: 'Choose the vendor.',
  enterCovers: 'Enter what the quote covers.',
  coversTooLong: (count: number) =>
    `Shorten what the quote covers to ${count} characters or fewer.`,
  numberTooLong: (count: number) => `Shorten the quote number to ${count} characters or fewer.`,
  enterAmount: (example: string) => `Enter the amount as a number above 0, like ${example}.`,
  enterDateQuoted: 'Enter the date quoted.',
  quotedAhead: 'The date quoted cannot be in the future. Choose today or an earlier date.',
  reviseUnchanged:
    'Change the amount or the date quoted to revise this quote. To change anything else, correct the quote instead.',
  enterWhatFor: 'Enter what the payment is for.',
  whatForTooLong: (count: number) =>
    `Shorten what the payment is for to ${count} characters or fewer.`,
  enterDateDue: 'Enter the date due.',
  dueBeforeQuote: (vendor: string, day: string) =>
    `The date due cannot be before the quote from ${vendor} on ${day}. Choose that date or a later one.`,
  alreadyQuoted: 'Already quoted on this event',
  noVendors: 'There are no vendors to choose from.',
  addOnVendors: 'Add the vendor on the Vendors page first.',
  askToAdd: 'Ask an owner or admin to add the vendor.',
  noVendorMatches: (typed: string) => `No vendor matches “${typed.trim()}”.`,
  duplicate:
    'That vendor already has a quote on this event, so this quote was not saved. To give a new price, revise that quote.',
  vendorGone:
    'That vendor is no longer one of this organisation’s vendors, so the quote was not saved.',
  lineTaken: (line: string, vendor: string) =>
    `${line} is already agreed in the quote from ${vendor}, so this quote was not saved. Untick it in that quote first.`,
  quoteAdded: (vendor: string, amount: string, day: string) =>
    `Quote added: ${vendor}, ${amount}, quoted on ${day}.`,
  quoteRevised: (vendor: string, amount: string, day: string) =>
    `Quote revised: ${vendor}, ${amount}, quoted on ${day}. The earlier quote is kept under Show the earlier quote.`,
  quoteCorrected: (vendor: string, number: string) =>
    `${number === '' ? `Quote corrected: ${vendor}.` : `Quote corrected: ${vendor}, quote ${number}.`} The amount, the date quoted and the schedule are unchanged.`,
  paymentAdded: (what: string, amount: string, day: string) =>
    `Payment added: ${what}, ${amount}, due on ${day}.`,
  paymentChanged: (what: string, amount: string, day: string) =>
    `Payment changed: ${what}, ${amount}, due on ${day}.`,
  paymentRemoved: (what: string, amount: string) => `Payment removed: ${what}, ${amount}.`,
  plansElsewhere: 'Plans have their own design.',
  markPaidAbout: (vendor: string, what: string, event: string) => `${vendor} · ${what} · ${event}`,
  scheduled: 'Scheduled',
  amountPaid: 'Amount paid',
  datePaid: 'Date paid',
  datePaidHelp: 'Earlier dates are fine.',
  datePaidBlank: 'Enter the date it was paid.',
  reference: 'Reference',
  markedPaid: (amount: string, day: string) => `Marked paid: ${amount} on ${day}.`,
  usedOn: (count: number) => (count === 1 ? 'Used on 1 event' : `Used on ${count} events`),
  archiveRefused: (vendor: string) =>
    `${vendor} was not archived, because the events below still have payments to it that are not paid or cancelled. Once each one is paid or cancelled, you can archive the vendor.`,
  owingLink: (vendor: string, event: string) => `Payments to ${vendor} on ${event}`,
  costsComing:
    'The card, the costs and their rates are sc-85’s, built with the rest of Budget in sc-31779. This page draws what sc-87 adds beside them.',
} as const;
