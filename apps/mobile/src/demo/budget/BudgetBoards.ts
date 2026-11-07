import { BUDGET_DEMO_STATES, type BudgetState } from './BudgetModel.ts';
import { WEDDING } from './BudgetSample.ts';

/** The demo home's Budget group: each app ?state= of budget-a-spec.md §9, deep-linked into the wedding. */
const BOARDS: Record<BudgetState, readonly [string, string]> = {
  populated: ['in use', 'The overdue balance and Mark paid on the card'],
  scrolled: ['scrolled', 'The ceiling, Against plan, Who is paying, the costs'],
  loading: ['loading', 'The card’s place and the rows as shapes'],
  live_update: ['live', 'A change from the web washes the figures it moved'],
  not_live: ['not live', 'Figures as of 09:32; Mark paid needs a connection'],
  reconnecting: ['reconnecting', 'Getting the latest figures…'],
  never_loaded: ['never loaded', 'No figures and no zeros'],
  no_lines: ['no costs yet', 'Costs are added on a computer; Who is paying opens'],
  nothing_due: ['nothing due', 'No step on the card; Nothing is due.'],
  mark_paid_open: ['Mark paid', 'sc-88’s form, £840.00 filled in'],
  marked_paid: ['marked paid', 'The row stays with Undo; the card moves on'],
  refused_paid: ['refused, already paid', 'Julien Moreau has already marked this paid'],
  refused_cancelled: ['refused, cancelled', 'This payment has been cancelled'],
  read_only: ['read only', 'After losing vendors: no Mark paid, See plans'],
  no_budget: ['no budget (as kemi)', 'Can edit: More has no Budget'],
  payers: ['Who is paying', 'A row per payer with its link’s state'],
  payer_never_sent: ['a payer, never sent', 'Send to Adaeze and Tunde'],
  payer_opened: ['a payer, opened', 'Opened 3 times, Send again'],
  no_payers: ['no payers', 'Payers are added on a computer'],
  no_costs: ['payers, no costs', 'Each payer’s name and note, no zeros'],
  payer_removed: ['a payer removed', 'Removed on the web while the list was open'],
  offline: ['a payer, offline', 'Sending a link needs a connection'],
  send_failed: ['the link not created', 'Nothing has been sent, Try again'],
  long_name: ['a long name (pt)', 'The 100-character name wraps in the action'],
  due_now: ['Due now', 'From the reminder: Paid, or Paid a different amount'],
  due_marked: ['Due now, marked', 'Marked paid · £840.00, Undo'],
  due_changed: ['Due now, changed since', 'Paid by Julien Moreau; Cancelled'],
  due_refused: ['Due now, refused', 'This payment has been cancelled'],
  due_done: ['Due now, done', 'Nothing left to pay from this reminder'],
  due_read_only: ['Due now, read only', 'No Paid, no Undo'],
};

/** The spec's viewer and language for the two states that name one; the state alone opens it. */
const VIEWER: Partial<Record<BudgetState, string>> = {
  no_budget: '&as=kemi',
  long_name: '&lang=pt',
};

export const BUDGET_BOARDS = BUDGET_DEMO_STATES.map((state) => ({
  state,
  title: `Budget · ${BOARDS[state][0]}`,
  what: BOARDS[state][1],
  href: `/demo/events/${WEDDING}?area=budget&state=${state}${VIEWER[state] ?? ''}`,
}));
