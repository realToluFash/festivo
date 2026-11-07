import { formattingLocale } from '@soirely/domain';
import {
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useSearchParams } from 'react-router';

import { Alert, Thumb } from './EventParts.tsx';
import { type SampleEvent, lineOf } from './events.ts';
import { Glyph } from './Glyph.tsx';
import {
  ADD_ON_VENDORS,
  ALREADY_QUOTED,
  ASK_TO_ADD,
  BLANK_PAYMENT,
  BLANK_QUOTE,
  type Budget,
  type BudgetViewer,
  CURRENCY,
  DUPLICATE,
  LINES,
  NO_VENDORS,
  type Opened,
  type PaymentDraft,
  type PaymentOpen,
  type Quote,
  type QuoteDraft,
  type QuoteField,
  type QuoteProblems,
  type Refusal,
  TAKEN_LINE,
  TODAY,
  VENDOR_GONE,
  agreedElsewhere,
  anyToOffer,
  budgetStart,
  budgetViewerOf,
  differenceLine,
  differenceOf,
  draftOfPayment,
  draftOfQuote,
  everythingDue,
  lineTaken,
  money,
  nextPaymentId,
  noVendorMatches,
  offered,
  parsedAmount,
  paymentProblems,
  quoteProblems,
  quotedVendorOf,
  scheduledFor,
  sum,
} from './quotes.ts';
import {
  Card,
  CardStep,
  Dialog,
  Head,
  OnCard,
  RowWords,
  Says,
  TextAction,
} from './SettingsParts.tsx';
import type { Tell } from './TodayParts.tsx';
import { type Vendor, vendorAt } from './vendors.ts';
import './quotes.css';

const BUSY_MS = 900;

interface Say {
  locale: string;
  date: (day: string) => string;
  money: (minor: number) => string;
}

function sayIn(locale: string): Say {
  const date = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

  return {
    locale,
    date: (day) => date.format(new Date(`${day}T00:00Z`)),
    money: (minor) => money(minor, CURRENCY, locale),
  };
}

/** The event's Budget page with `vendors` (sc-87 on sc-85's page): Add a quote, the vendors quoted, everything due, and each vendor's own page. */
export function BudgetArea({ event, tell }: { event: SampleEvent; tell: Tell }) {
  const [params] = useSearchParams();
  const state = params.get('state') ?? '';
  const vendor = params.get('vendor');
  const viewer = budgetViewerOf(params.get('as'));

  return (
    <BudgetBody
      key={`${state}|${viewer.key}`}
      event={event}
      state={state}
      vendorId={vendor}
      viewer={viewer}
      tell={tell}
    />
  );
}

function BudgetBody({
  event,
  state,
  vendorId,
  viewer,
  tell,
}: {
  event: SampleEvent;
  state: string;
  vendorId: string | null;
  viewer: BudgetViewer;
  tell: Tell;
}) {
  const say = useMemo(() => sayIn(formattingLocale('en', navigator.language)), []);
  const [start] = useState(() => budgetStart(state, vendorId, say.date));
  const [budget, setBudget] = useState<Budget>(start.budget);
  const [quote, setQuote] = useState<Opened | null>(start.quote);
  const [payment, setPayment] = useState<PaymentOpen | null>(start.payment);
  const [removing, setRemoving] = useState<string | null>(start.removing);
  const [earlier, setEarlier] = useState(start.earlier);
  const readOnly = start.readOnly;
  const vendors = start.vendors;
  const as = viewer.key === 'folake' ? '' : `&as=${viewer.key}`;
  const pageOf = (id: string | null) =>
    `/demo/events/${event.id}?area=budget${id == null ? '' : `&vendor=${id}`}${as}`;
  const open = budget.quotes.find((one) => one.vendor.id === vendorId) ?? null;
  const addQuote = () =>
    setQuote({ form: 'add', draft: BLANK_QUOTE, problems: {}, refusal: null, list: false });

  return (
    <>
      {open == null ? (
        <BudgetPage
          event={event}
          budget={budget}
          viewer={viewer}
          readOnly={readOnly}
          say={say}
          pageOf={pageOf}
          tell={tell}
          onAdd={addQuote}
        />
      ) : (
        <VendorPage
          quote={open}
          budget={budget}
          viewer={viewer}
          readOnly={readOnly}
          earlier={earlier}
          removing={removing}
          say={say}
          back={pageOf(null)}
          tell={tell}
          onEarlier={setEarlier}
          onQuote={(form) =>
            setQuote({ form, draft: draftOfQuote(open), problems: {}, refusal: null, list: false })
          }
          onPayment={setPayment}
          onRemoving={setRemoving}
          onRemove={(id) => {
            const gone = budget.payments.find((one) => one.id === id);
            setBudget((now) => ({ ...now, payments: now.payments.filter((one) => one.id !== id) }));
            setRemoving(null);
            if (gone != null) {
              tell(`Payment removed: ${gone.description}, ${say.money(gone.amount)}.`);
            }
          }}
        />
      )}
      {quote != null && (
        <QuoteDialog
          opened={quote}
          budget={budget}
          vendors={vendors}
          current={quote.form === 'add' ? null : open}
          viewer={viewer}
          say={say}
          onOpened={setQuote}
          onList={(list) => setQuote((now) => now && { ...now, list })}
          onClose={() => setQuote(null)}
          onSaved={(next, words) => {
            setBudget(next);
            setQuote(null);
            if (quote.form === 'revise') setEarlier(false);
            tell(words);
          }}
        />
      )}
      {payment != null && open != null && (
        <PaymentDialog
          opened={payment}
          quote={open}
          say={say}
          onOpened={setPayment}
          onClose={() => setPayment(null)}
          onSaved={(draft) => {
            const amount = parsedAmount(draft.amount, CURRENCY) ?? 0;
            setBudget((now) => ({
              ...now,
              payments:
                payment.kind === 'add'
                  ? [
                      ...now.payments,
                      {
                        id: nextPaymentId(now.payments),
                        vendorId: open.vendor.id,
                        description: draft.description.trim(),
                        amount,
                        dueOn: draft.dueOn,
                      },
                    ]
                  : now.payments.map((one) =>
                      one.id === payment.id
                        ? {
                            ...one,
                            description: draft.description.trim(),
                            amount,
                            dueOn: draft.dueOn,
                          }
                        : one,
                    ),
            }));
            setPayment(null);
            tell(
              `${payment.kind === 'add' ? 'Payment added' : 'Payment changed'}: ${draft.description.trim()}, ${say.money(amount)}, due on ${say.date(draft.dueOn)}.`,
            );
          }}
        />
      )}
    </>
  );
}

function AreaTop({ event }: { event: SampleEvent }) {
  return (
    <>
      <h1 className="ev-area-title" tabIndex={-1}>
        Budget
      </h1>
      <div className="ev-strip">
        <Thumb event={event} size={40} />
        <RowWords title={event.name} lines={[lineOf(event)]} />
      </div>
    </>
  );
}

/** One line after a downgrade: everything stays to read, nothing changes (sc-87, The entitlement). See plans only for billing.manage. */
function ReadOnlyCard({ viewer, tell }: { viewer: BudgetViewer; tell: Tell }) {
  return (
    <Card>
      <Says>Read-only</Says>
      <OnCard>
        Quotes and payment schedules are read-only because this organisation’s plan no longer
        includes them. Nothing has been removed.
      </OnCard>
      {viewer.managesBilling && (
        <CardStep label="See plans" onClick={() => tell('Plans have their own design.')} />
      )}
    </Card>
  );
}

function BudgetPage({
  event,
  budget,
  viewer,
  readOnly,
  say,
  pageOf,
  tell,
  onAdd,
}: {
  event: SampleEvent;
  budget: Budget;
  viewer: BudgetViewer;
  readOnly: boolean;
  say: Say;
  pageOf: (id: string | null) => string;
  tell: Tell;
  onAdd: () => void;
}) {
  const due = everythingDue(budget, TODAY);
  const add = readOnly ? null : <TextAction label="Add a quote" before="plus" onClick={onAdd} />;

  return (
    <div className="qt-page">
      <AreaTop event={event} />
      {readOnly && <ReadOnlyCard viewer={viewer} tell={tell} />}
      <section className="desk-block qt-costs" aria-labelledby="qt-costs">
        <Head title={<span id="qt-costs">Costs</span>} />
        <p className="desk-note">
          The costs, their rates and the range this event will cost are sc-85’s, on Budget.dc.html.
          This demo draws what sc-87 adds under them.
        </p>
      </section>
      <section className="desk-block" aria-labelledby="qt-quoted">
        <Head title={<span id="qt-quoted">Vendors quoted</span>}>
          {budget.quotes.length > 0 && add}
        </Head>
        {budget.quotes.length === 0 ? (
          <div className="qt-empty">
            <p className="desk-line">No quotes on this event yet.</p>
            {add}
          </div>
        ) : (
          <ul className="desk-rows qt-rows">
            {budget.quotes.map((quote) => {
              const scheduled = sum(scheduledFor(budget, quote.vendor.id));

              return (
                <li key={quote.vendor.id}>
                  <Link className="desk-row qt-row" to={pageOf(quote.vendor.id)}>
                    <RowWords title={quote.vendor.name} lines={[vendorLine(quote)]} />
                    <span className="qt-figure">
                      <span className="qt-amount">{say.money(quote.amount)}</span>
                      <Difference quoted={quote.amount} scheduled={scheduled} say={say} small />
                    </span>
                    <Glyph name="chevron" size={17} weight={2.3} className="desk-chevron" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="desk-block" aria-labelledby="qt-due">
        <Head title={<span id="qt-due">Everything due</span>} />
        {due.length === 0 ? (
          <p className="desk-line qt-empty">Nothing is due.</p>
        ) : (
          <ul className="desk-rows qt-rows">
            {due.map(({ payment, vendor, overdue }) => (
              <li key={payment.id}>
                <Link className="desk-row qt-due-row" to={pageOf(vendor.id)}>
                  <span className="qt-when">
                    <span className="desk-row-name">{say.date(payment.dueOn)}</span>
                    {overdue && <Overdue />}
                  </span>
                  <RowWords title={vendor.name} lines={[payment.description]} />
                  <span className="qt-amount">{say.money(payment.amount)}</span>
                  <Glyph name="chevron" size={17} weight={2.3} className="desk-chevron" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function vendorLine(quote: Pick<Quote, 'vendor'>): string {
  return quote.vendor.contact === ''
    ? quote.vendor.category
    : `${quote.vendor.category} · ${quote.vendor.contact}`;
}

/** sc-93's Due next: a shape with the word, never colour alone. */
function Overdue() {
  return (
    <span className="desk-tag is-waiting qt-overdue">
      <Glyph name="alert" size={13} weight={2.4} />
      Overdue
    </span>
  );
}

function Difference({
  quoted,
  scheduled,
  say,
  small = false,
}: {
  quoted: number;
  scheduled: number;
  say: Say;
  small?: boolean;
}) {
  const kind = differenceOf(quoted, scheduled);

  return (
    <span className={`qt-difference is-${kind}${small ? ' is-small' : ''}`}>
      <span
        className={`desk-mark ${kind === 'matches' ? 'is-yes' : 'is-waiting'}`}
        aria-hidden="true"
      >
        {kind === 'matches' && <Glyph name="tick" size={9} weight={3.4} />}
      </span>
      {differenceLine(quoted, scheduled, say.locale)}
    </span>
  );
}

function VendorPage({
  quote,
  budget,
  viewer,
  readOnly,
  earlier,
  removing,
  say,
  back,
  tell,
  onEarlier,
  onQuote,
  onPayment,
  onRemoving,
  onRemove,
}: {
  quote: Quote;
  budget: Budget;
  viewer: BudgetViewer;
  readOnly: boolean;
  earlier: boolean;
  removing: string | null;
  say: Say;
  back: string;
  tell: Tell;
  onEarlier: (open: boolean) => void;
  onQuote: (form: 'revise' | 'correct') => void;
  onPayment: (open: PaymentOpen) => void;
  onRemoving: (id: string | null) => void;
  onRemove: (id: string) => void;
}) {
  const payments = scheduledFor(budget, quote.vendor.id);
  const scheduled = sum(payments);
  const lines = LINES.filter((one) => quote.lines.includes(one.id)).map((one) => one.name);
  const addPayment = readOnly ? null : (
    <TextAction
      label="Add a payment"
      before="plus"
      onClick={() => onPayment({ kind: 'add', draft: BLANK_PAYMENT, problems: {} })}
    />
  );

  return (
    <div className="qt-page">
      <Link className="desk-text qt-back" to={back}>
        <Glyph name="back" size={16} weight={2.4} />
        Budget
      </Link>
      <div className="qt-vendor-top">
        <h1 className="ev-area-title" tabIndex={-1}>
          {viewer.readsVendors ? (
            <Link
              className="qt-vendor-link"
              to={vendorAt(quote.vendor.id, viewer.key === 'folake' ? null : viewer.key)}
            >
              {quote.vendor.name}
            </Link>
          ) : (
            quote.vendor.name
          )}
        </h1>
        <p className="desk-line">{vendorLine(quote)}</p>
      </div>
      {readOnly && <ReadOnlyCard viewer={viewer} tell={tell} />}
      <section className="desk-block" aria-labelledby="qt-quote">
        <Head title={<span id="qt-quote">The quote</span>}>
          {!readOnly && (
            <span className="qt-head-actions">
              <TextAction label="Revise the quote" onClick={() => onQuote('revise')} />
              <TextAction label="Correct the quote" onClick={() => onQuote('correct')} />
            </span>
          )}
        </Head>
        <dl className="qt-facts">
          <Fact label="Quoted">
            {say.money(quote.amount)}, quoted on {say.date(quote.quotedOn)}
          </Fact>
          <Fact label="What it covers">{quote.covers}</Fact>
          <Fact label="Quote number">
            {quote.number === '' ? <span className="qt-none">No quote number</span> : quote.number}
          </Fact>
          <Fact label="Budget lines">
            {lines.length === 0 ? <span className="qt-none">None</span> : lines.join(', ')}
          </Fact>
        </dl>
        {quote.earlier.length > 0 && (
          <div className="qt-earlier">
            <TextAction
              label={earlier ? 'Hide the earlier quote' : 'Show the earlier quote'}
              onClick={() => onEarlier(!earlier)}
            />
            {earlier && (
              <ul className="qt-earlier-list">
                {quote.earlier.map((one) => (
                  <li key={one.quotedOn} className="desk-line">
                    {say.money(one.amount)}, quoted on {say.date(one.quotedOn)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
      <section className="desk-block" aria-labelledby="qt-schedule">
        <Head title={<span id="qt-schedule">Schedule</span>}>
          {payments.length > 0 && addPayment}
        </Head>
        <dl className="qt-sums">
          <div>
            <dt>Quoted</dt>
            <dd>{say.money(quote.amount)}</dd>
          </div>
          <div>
            <dt>Scheduled</dt>
            <dd>{say.money(scheduled)}</dd>
          </div>
        </dl>
        <Difference quoted={quote.amount} scheduled={scheduled} say={say} />
        {payments.length === 0 ? (
          <div className="qt-empty">
            <p className="desk-line">No payments scheduled yet.</p>
            {addPayment}
          </div>
        ) : (
          <ul className="desk-rows qt-rows">
            {payments.map((one) => (
              <li key={one.id} className="desk-row qt-pay-row">
                <RowWords title={one.description} lines={[`Due ${say.date(one.dueOn)}`]} />
                {one.dueOn < TODAY && <Overdue />}
                <span className="qt-amount">{say.money(one.amount)}</span>
                {!readOnly &&
                  (removing === one.id ? (
                    <span className="qt-ask" role="group" aria-label={`Remove ${one.description}?`}>
                      <span className="desk-line">Remove this payment?</span>
                      <TextAction label="Keep" onClick={() => onRemoving(null)} />
                      <TextAction label="Remove" red onClick={() => onRemove(one.id)} />
                    </span>
                  ) : (
                    <span className="qt-row-actions">
                      <TextAction
                        label="Change"
                        onClick={() =>
                          onPayment({
                            kind: 'amend',
                            id: one.id,
                            draft: draftOfPayment(one),
                            problems: {},
                          })
                        }
                      />
                      <TextAction label="Remove" onClick={() => onRemoving(one.id)} />
                    </span>
                  ))}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="qt-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function refusalWords(refusal: Refusal, budget: Budget): string {
  if (refusal === 'second_quote') return DUPLICATE;
  if (refusal === 'vendor_gone') return VENDOR_GONE;
  const line = LINES.find((one) => one.id === TAKEN_LINE)?.name ?? '';
  const holder = budget.quotes.find((one) => one.lines.includes(TAKEN_LINE))?.vendor.name ?? '';

  return lineTaken(line, holder);
}

const TITLES = {
  add: 'Add a quote',
  revise: 'Revise the quote',
  correct: 'Correct the quote',
} as const;
const VERBS = { add: 'Add', revise: 'Revise', correct: 'Save' } as const;

/** Add, Revise or Correct: the vendor is chosen once, on Add; Revise changes the amount or the date; Correct the rest. */
function QuoteDialog({
  opened,
  budget,
  vendors,
  current,
  viewer,
  say,
  onOpened,
  onList,
  onClose,
  onSaved,
}: {
  opened: Opened;
  budget: Budget;
  vendors: readonly Vendor[];
  current: Quote | null;
  viewer: BudgetViewer;
  say: Say;
  onOpened: (next: Opened) => void;
  onList: (list: boolean) => void;
  onClose: () => void;
  onSaved: (budget: Budget, words: string) => void;
}) {
  const id = useId();
  const { form, draft, problems, refusal } = opened;
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  const pending = useRef<number | undefined>(undefined);
  const vendorId = current?.vendor.id ?? draft.vendorId;

  useEffect(() => () => window.clearTimeout(pending.current), []);

  const set = (change: Partial<QuoteDraft>) => {
    const next = { ...draft, ...change };
    const now = quoteProblems(next, form, TODAY, current ?? undefined);
    const kept: QuoteProblems = {};
    for (const key of Object.keys(problems) as QuoteField[]) {
      const line = now[key];
      if (line != null) kept[key] = line;
    }
    onOpened({ ...opened, draft: next, problems: kept });
  };
  const save = () => {
    if (busy) return;
    const found = quoteProblems(draft, form, TODAY, current ?? undefined);
    onOpened({ ...opened, problems: found, refusal: null, list: false });
    if (Object.keys(found).length > 0) {
      window.setTimeout(
        () => document.querySelector<HTMLElement>('.desk-dialog [aria-invalid="true"]')?.focus(),
        0,
      );
      return;
    }
    setBusy(true);
    pending.current = window.setTimeout(() => {
      setBusy(false);
      onSaved(...saved(budget, vendors, draft, form, current, say));
    }, BUSY_MS);
  };
  const switchTo = (next: 'revise' | 'correct') =>
    current != null &&
    onOpened({
      form: next,
      draft: draftOfQuote(current),
      problems: {},
      refusal: null,
      list: false,
    });

  return (
    <Dialog
      title={TITLES[form]}
      verb={busy ? 'Saving…' : VERBS[form]}
      on={!busy}
      first={first}
      onDismiss={onClose}
      onConfirm={save}
    >
      <div className="desk-fields">
        {refusal != null && <Alert>{refusalWords(refusal, budget)}</Alert>}
        {form === 'revise' && (
          <p className="desk-note">
            Revising saves this quote with a new amount or date quoted. The current quote is kept as
            an earlier quote, under Show the earlier quote. To change only what it covers, its quote
            number or its budget lines, correct the quote instead.
          </p>
        )}
        {form === 'correct' && (
          <>
            <p className="desk-note">
              Correct what this quote covers, its quote number or its budget lines. No earlier
              version is kept. To change the amount or the date quoted, revise the quote, which
              keeps this one as an earlier quote.
            </p>
            <TextAction label="Revise the quote instead" onClick={() => switchTo('revise')} />
          </>
        )}
        {form === 'add' ? (
          <VendorField
            id={`${id}-vendor`}
            inputRef={first}
            vendors={vendors}
            quoted={budget.quotes.map((one) => one.vendor.id)}
            draft={draft}
            open={opened.list}
            error={problems.vendor ?? null}
            viewer={viewer}
            onOpen={onList}
            onType={(typed) =>
              onOpened({ ...opened, draft: { ...draft, typed, vendorId: '' }, list: true })
            }
            onChoose={(vendor) => {
              const next = { ...draft, typed: vendor.name, vendorId: vendor.id };
              const kept = { ...problems };
              delete kept.vendor;
              onOpened({ ...opened, draft: next, problems: kept, list: false });
            }}
          />
        ) : (
          <Fixed label="Vendor" value={current?.vendor.name ?? ''} />
        )}
        {form !== 'revise' && (
          <TextField
            id={`${id}-covers`}
            label="What it covers"
            value={draft.covers}
            error={problems.covers ?? null}
            lines={3}
            onChange={(covers) => set({ covers })}
          />
        )}
        {form === 'correct' && current != null ? (
          <>
            <Fixed label="Amount" value={say.money(current.amount)} />
            <Fixed label="Date quoted" value={say.date(current.quotedOn)} />
          </>
        ) : (
          <>
            <AmountField
              id={`${id}-amount`}
              label="Amount"
              value={draft.amount}
              error={problems.amount ?? null}
              inputRef={form === 'revise' ? first : undefined}
              onChange={(amount) => set({ amount })}
            />
            <DateField
              id={`${id}-quoted`}
              label="Date quoted"
              value={draft.quotedOn}
              max={TODAY}
              error={problems.quotedOn ?? null}
              onChange={(quotedOn) => set({ quotedOn })}
            />
            {form === 'revise' &&
              problems.amount != null &&
              problems.amount === problems.quotedOn && (
                <TextAction label="Correct the quote instead" onClick={() => switchTo('correct')} />
              )}
          </>
        )}
        {form !== 'revise' && (
          <>
            <TextField
              id={`${id}-number`}
              label="Quote number"
              value={draft.number}
              error={problems.number ?? null}
              optional
              help="The number the vendor uses for this quote, so a call can start with it."
              onChange={(number) => set({ number })}
            />
            <LinesField
              budget={budget}
              vendorId={vendorId}
              ticked={draft.lines}
              onTick={(lines) => set({ lines })}
            />
          </>
        )}
      </div>
    </Dialog>
  );
}

function saved(
  budget: Budget,
  vendors: readonly Vendor[],
  draft: QuoteDraft,
  form: 'add' | 'revise' | 'correct',
  current: Quote | null,
  say: Say,
): [Budget, string] {
  const amount = parsedAmount(draft.amount, CURRENCY) ?? 0;

  if (form === 'add' || current == null) {
    const vendor = vendors.find((one) => one.id === draft.vendorId);
    if (vendor == null) return [budget, ''];
    const quote: Quote = {
      vendor: quotedVendorOf(vendor),
      covers: draft.covers.trim(),
      amount,
      quotedOn: draft.quotedOn,
      number: draft.number.trim(),
      lines: draft.lines,
      earlier: [],
    };

    return [
      { ...budget, quotes: [...budget.quotes, quote] },
      `Quote added: ${vendor.name}, ${say.money(amount)}, quoted on ${say.date(draft.quotedOn)}.`,
    ];
  }

  const replace = (next: Quote): Budget => ({
    ...budget,
    quotes: budget.quotes.map((one) => (one.vendor.id === current.vendor.id ? next : one)),
  });

  if (form === 'revise')
    return [
      replace({
        ...current,
        amount,
        quotedOn: draft.quotedOn,
        earlier: [{ amount: current.amount, quotedOn: current.quotedOn }, ...current.earlier],
      }),
      `Quote revised: ${current.vendor.name}, ${say.money(amount)}, quoted on ${say.date(draft.quotedOn)}. The earlier quote is kept under Show the earlier quote.`,
    ];

  const number = draft.number.trim();

  return [
    replace({ ...current, covers: draft.covers.trim(), number, lines: draft.lines }),
    `${number === '' ? `Quote corrected: ${current.vendor.name}.` : `Quote corrected: ${current.vendor.name}, quote ${number}.`} The amount, the date quoted and the schedule are unchanged.`,
  ];
}

/** The organisation's vendors not archived, narrowing as a name is typed: each its name, category and contact name, nothing else. */
function VendorField({
  id,
  inputRef,
  vendors,
  quoted,
  draft,
  open,
  error,
  viewer,
  onOpen,
  onType,
  onChoose,
}: {
  id: string;
  inputRef: RefObject<HTMLInputElement | null>;
  vendors: readonly Vendor[];
  quoted: readonly string[];
  draft: QuoteDraft;
  open: boolean;
  error: string | null;
  viewer: BudgetViewer;
  onOpen: (open: boolean) => void;
  onType: (typed: string) => void;
  onChoose: (vendor: Vendor) => void;
}) {
  const [active, setActive] = useState(0);
  const blurred = useRef<number | undefined>(undefined);
  const typed = draft.vendorId === '' ? draft.typed : '';
  const rows = offered(vendors, typed);
  const none = !anyToOffer(vendors);
  const showList = open && !none && rows.length > 0;
  const told = [error == null ? null : `${id}-error`, `${id}-status`].filter(Boolean).join(' ');
  const choose = (vendor: Vendor | undefined) => {
    if (vendor == null || quoted.includes(vendor.id)) return;
    onChoose(vendor);
  };
  useEffect(() => () => window.clearTimeout(blurred.current), []);

  const keys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) onOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((now) => Math.min(Math.max(0, now + step), Math.max(0, rows.length - 1)));
    } else if (event.key === 'Enter' && showList) {
      event.preventDefault();
      choose(rows[active]);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      onOpen(false);
    }
  };

  return (
    <div className="desk-field qt-vendor">
      <label htmlFor={id} className="desk-label">
        Vendor
      </label>
      <div className={error == null ? 'desk-box qt-combo' : 'desk-box qt-combo is-wrong'}>
        <Glyph name="search" size={18} weight={2.2} />
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={`${id}-list`}
          aria-activedescendant={showList ? `${id}-option-${active}` : undefined}
          aria-invalid={error != null}
          aria-describedby={told}
          autoComplete="off"
          spellCheck={false}
          placeholder="Type a vendor’s name"
          value={draft.typed}
          onFocus={() => {
            window.clearTimeout(blurred.current);
            onOpen(draft.vendorId === '');
          }}
          onBlur={() => {
            blurred.current = window.setTimeout(() => onOpen(false), 120);
          }}
          onChange={(event) => {
            setActive(0);
            onType(event.target.value);
          }}
          onKeyDown={keys}
        />
      </div>
      {showList && (
        <ul id={`${id}-list`} role="listbox" aria-label="Vendors" className="qt-options">
          {rows.map((vendor, index) => {
            const taken = quoted.includes(vendor.id);

            return (
              <li
                key={vendor.id}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={index === active}
                aria-disabled={taken}
                className={['qt-option', index === active && 'is-active', taken && 'is-taken']
                  .filter(Boolean)
                  .join(' ')}
                onPointerDown={(pointer) => pointer.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(vendor)}
                onKeyDown={(key) => {
                  if (key.key === 'Enter') choose(vendor);
                }}
              >
                <RowWords
                  title={vendor.name}
                  lines={[
                    vendorLine({ vendor: quotedVendorOf(vendor) }),
                    ...(taken ? [ALREADY_QUOTED] : []),
                  ]}
                />
              </li>
            );
          })}
        </ul>
      )}
      <div id={`${id}-status`} role="status" className="qt-vendor-status">
        {(none || (open && rows.length === 0 && typed.trim() !== '')) && (
          <>
            <p className="desk-line is-ink">{none ? NO_VENDORS : noVendorMatches(typed)}</p>
            {viewer.readsVendors ? (
              <Link className="desk-text" to="/demo/vendors">
                {ADD_ON_VENDORS}
              </Link>
            ) : (
              <p className="desk-line">{ASK_TO_ADD}</p>
            )}
          </>
        )}
      </div>
      <Problem id={`${id}-error`} line={error} />
    </div>
  );
}

/** sc-83's lines: a line agreed in another vendor's quote shows that vendor and cannot be ticked. */
function LinesField({
  budget,
  vendorId,
  ticked,
  onTick,
}: {
  budget: Budget;
  vendorId: string;
  ticked: readonly string[];
  onTick: (lines: string[]) => void;
}) {
  return (
    <div className="desk-field qt-lines" role="group" aria-labelledby="qt-lines-label">
      <div className="desk-label-row vd-label-row">
        <span id="qt-lines-label" className="desk-label">
          Budget lines it agrees
        </span>
        <span className="vd-optional">Optional</span>
      </div>
      <ul className="desk-rows">
        {LINES.map((line) => {
          const elsewhere = agreedElsewhere(budget, line.id, vendorId);

          return (
            <li key={line.id}>
              <label
                className={elsewhere == null ? 'desk-row qt-line' : 'desk-row qt-line is-taken'}
              >
                <input
                  type="checkbox"
                  className="qt-check"
                  checked={elsewhere == null && ticked.includes(line.id)}
                  disabled={elsewhere != null}
                  onChange={() =>
                    onTick(
                      ticked.includes(line.id)
                        ? ticked.filter((one) => one !== line.id)
                        : [...ticked, line.id],
                    )
                  }
                />
                <RowWords
                  title={line.name}
                  lines={
                    elsewhere == null ? [] : [`Agreed in the quote from ${elsewhere.vendor.name}`]
                  }
                />
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PaymentDialog({
  opened,
  quote,
  say,
  onOpened,
  onClose,
  onSaved,
}: {
  opened: PaymentOpen;
  quote: Quote;
  say: Say;
  onOpened: (next: PaymentOpen) => void;
  onClose: () => void;
  onSaved: (draft: PaymentDraft) => void;
}) {
  const id = useId();
  const { draft, problems } = opened;
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  const pending = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(pending.current), []);

  const set = (change: Partial<PaymentDraft>) => {
    const next = { ...draft, ...change };
    const now = paymentProblems(next, quote, say.date);
    const kept: typeof problems = {};
    for (const key of Object.keys(problems) as (keyof PaymentDraft)[]) {
      const line = now[key];
      if (line != null) kept[key] = line;
    }
    onOpened({ ...opened, draft: next, problems: kept });
  };
  const save = () => {
    if (busy) return;
    const found = paymentProblems(draft, quote, say.date);
    onOpened({ ...opened, problems: found });
    if (Object.keys(found).length > 0) {
      window.setTimeout(
        () => document.querySelector<HTMLElement>('.desk-dialog [aria-invalid="true"]')?.focus(),
        0,
      );
      return;
    }
    setBusy(true);
    pending.current = window.setTimeout(() => {
      setBusy(false);
      onSaved(draft);
    }, BUSY_MS);
  };

  return (
    <Dialog
      title={opened.kind === 'add' ? 'Add a payment' : 'Change the payment'}
      verb={busy ? 'Saving…' : opened.kind === 'add' ? 'Add' : 'Save'}
      on={!busy}
      first={first}
      onDismiss={onClose}
      onConfirm={save}
    >
      <div className="desk-fields">
        <Fixed label="Vendor" value={quote.vendor.name} />
        <TextField
          id={`${id}-description`}
          label="What the payment is for"
          value={draft.description}
          error={problems.description ?? null}
          inputRef={first}
          help="Deposit, second instalment, balance."
          onChange={(description) => set({ description })}
        />
        <AmountField
          id={`${id}-amount`}
          label="Amount"
          value={draft.amount}
          error={problems.amount ?? null}
          onChange={(amount) => set({ amount })}
        />
        <DateField
          id={`${id}-due`}
          label="Date due"
          value={draft.dueOn}
          min={quote.quotedOn}
          error={problems.dueOn ?? null}
          onChange={(dueOn) => set({ dueOn })}
        />
      </div>
    </Dialog>
  );
}

function Fixed({ label, value }: { label: string; value: string }) {
  return (
    <div className="desk-field">
      <span className="desk-label">{label}</span>
      <p className="desk-line is-ink qt-fixed">{value}</p>
    </div>
  );
}

function Problem({ id, line }: { id: string; line: string | null | undefined }) {
  return line == null ? null : (
    <p id={id} className="desk-error">
      <Glyph name="alert" size={15} weight={2.2} />
      {line}
    </p>
  );
}

function described(id: string, helped: boolean, error: string | null): string | undefined {
  const told = [helped ? `${id}-help` : null, error == null ? null : `${id}-error`]
    .filter(Boolean)
    .join(' ');

  return told === '' ? undefined : told;
}

function Label({ id, label, optional }: { id: string; label: string; optional: boolean }) {
  return optional ? (
    <div className="desk-label-row vd-label-row">
      <label htmlFor={id} className="desk-label">
        {label}
      </label>
      <span className="vd-optional">Optional</span>
    </div>
  ) : (
    <label htmlFor={id} className="desk-label">
      {label}
    </label>
  );
}

function TextField({
  id,
  label,
  value,
  error,
  optional = false,
  help,
  lines,
  inputRef,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error: string | null;
  optional?: boolean;
  help?: string;
  lines?: number;
  inputRef?: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
}) {
  const common = {
    id,
    value,
    spellCheck: false,
    'aria-invalid': error != null,
    'aria-describedby': described(id, help != null, error),
  };

  return (
    <div className="desk-field">
      <Label id={id} label={label} optional={optional} />
      <div
        className={['desk-box', lines != null && 'vd-area', error != null && 'is-wrong']
          .filter(Boolean)
          .join(' ')}
      >
        {lines == null ? (
          <input
            ref={inputRef}
            type="text"
            {...common}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <textarea rows={lines} {...common} onChange={(event) => onChange(event.target.value)} />
        )}
      </div>
      {help != null && (
        <p id={`${id}-help`} className="desk-help">
          {help}
        </p>
      )}
      <Problem id={`${id}-error`} line={error} />
    </div>
  );
}

const SYMBOL =
  new Intl.NumberFormat('en', { style: 'currency', currency: CURRENCY })
    .formatToParts(0)
    .find((part) => part.type === 'currency')?.value ?? CURRENCY;

function AmountField({
  id,
  label,
  value,
  error,
  inputRef,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error: string | null;
  inputRef?: RefObject<HTMLInputElement | null> | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <div className="desk-field">
      <Label id={id} label={label} optional={false} />
      <div className={error == null ? 'desk-box qt-money' : 'desk-box qt-money is-wrong'}>
        <span className="qt-symbol" aria-hidden="true">
          {SYMBOL}
        </span>
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          aria-invalid={error != null}
          aria-describedby={described(id, true, error)}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      <p id={`${id}-help`} className="desk-help">
        In euros, the currency this event uses.
      </p>
      <Problem id={`${id}-error`} line={error} />
    </div>
  );
}

function DateField({
  id,
  label,
  value,
  min,
  max,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  min?: string;
  max?: string;
  error: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <div className="desk-field">
      <Label id={id} label={label} optional={false} />
      <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
        <input
          id={id}
          type="date"
          value={value}
          min={min}
          max={max}
          aria-invalid={error != null}
          aria-describedby={described(id, false, error)}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      <Problem id={`${id}-error`} line={error} />
    </div>
  );
}
