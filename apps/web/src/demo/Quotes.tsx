import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { CardStep, OnCard, TextAction, type Tell } from '../components/SettingsParts.tsx';
import {
  Amount,
  AskInRow,
  Block,
  BudgetCard,
  BudgetRow,
  BudgetShell,
  Columns,
  Figure,
  GlassTags,
  CardStrong,
  OverdueTag,
  PageTitle,
  ReadOnlyLine,
  RingMark,
  Rows,
} from './BudgetParts.tsx';
import { type Payment, longDay, money, overdue, shortDay, whole } from './budget.ts';
import { BUDGET_WORDS as BW } from './budgetWords.ts';
import { NotBuilt } from './EventParts.tsx';
import { EVENT_WORDS, type SampleEvent } from './events.ts';
import { AmendInPlace, MarkPaidDialog, PaymentDialog, QuoteDialog } from './QuoteForms.tsx';
import {
  type Amending,
  BLANK_PAYMENT,
  BLANK_QUOTE,
  type Budget,
  type BudgetViewer,
  type Due,
  type Marking,
  type Opened,
  type PaymentDraft,
  type PaymentOpen,
  type Quote,
  type BudgetAddresses,
  DUE_NEXT,
  budgetAt,
  budgetViewerOf,
  cardGap,
  differenceLine,
  differenceOf,
  differenceShort,
  directoryAt,
  draftOfPayment,
  draftOfQuote,
  draftToMark,
  everythingDue,
  firstOverdue,
  linesWords,
  markedPaid,
  nextPaymentId,
  pageVendor,
  parsedAmount,
  quotesStart,
  scheduledFor,
  sum,
} from './quotes.ts';
import { QW } from './quotesWords.ts';
import './quotes.css';

export type BudgetPage = 'home' | 'due' | 'vendor';

/** An event's Budget at `?area=budget` (sc-87 on A): its home, Everything due at `&view=due`, and each vendor's page at `&vendor=`. */
export function BudgetArea({ event }: { event: SampleEvent }) {
  const [params] = useSearchParams();
  const state = params.get('state') ?? '';
  const viewer = budgetViewerOf(params.get('as'), state);
  const vendorId = pageVendor(state, params.get('vendor'));
  const page: BudgetPage =
    vendorId != null ? 'vendor' : params.get('view') === 'due' ? 'due' : 'home';

  return (
    <QuotesBody
      key={`${state}|${viewer.key}`}
      event={event}
      state={state}
      page={page}
      vendorId={vendorId}
      viewer={viewer}
    />
  );
}

function QuotesBody({
  event,
  state,
  page,
  vendorId,
  viewer,
}: {
  event: SampleEvent;
  state: string;
  page: BudgetPage;
  vendorId: string | null;
  viewer: BudgetViewer;
}) {
  const [start] = useState(() => quotesStart(state, vendorId, longDay));
  const [budget, setBudget] = useState<Budget>(start.budget);
  const [quote, setQuote] = useState<Opened | null>(start.quote);
  const [payment, setPayment] = useState<PaymentOpen | null>(start.payment);
  const [amending, setAmending] = useState<Amending | null>(start.amending);
  const [removing, setRemoving] = useState<string | null>(start.removing);
  const [earlier, setEarlier] = useState(start.earlier);
  const [marking, setMarking] = useState<Marking | null>(null);
  const [marked, setMarked] = useState<string | null>(null);
  const [said, setSaid] = useState('');
  const [focusOn, setFocusOn] = useState<{ id: string } | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const opened = useRef(false);
  const readOnly = start.readOnly;
  const at = budgetAt(event.id, viewer, readOnly);
  const open = page === 'vendor' ? budget.quotes.find((one) => one.vendor.id === vendorId) : null;
  const marks = marking == null ? null : budget.payments.find((one) => one.id === marking.id);
  const vendorOf = (id: string) => budget.quotes.find((one) => one.vendor.id === id)?.vendor.name;
  const markVendor = marks == null ? undefined : vendorOf(marks.vendorId);
  const markedPayment = marked == null ? null : budget.payments.find((one) => one.id === marked);
  const homeMarked =
    markedPayment == null
      ? null
      : { payment: markedPayment, vendor: vendorOf(markedPayment.vendorId) ?? '' };
  const trail =
    page === 'home'
      ? [{ label: BW.budget }]
      : [
          { label: BW.budget, to: at.home },
          { label: page === 'due' ? BW.everythingDueTitle : (open?.vendor.name ?? BW.budget) },
        ];

  useEffect(() => {
    if (opened.current) title.current?.focus();
    opened.current = true;
  }, [page, vendorId]);

  useEffect(() => {
    if (focusOn == null) return;
    let frame = 0;
    let timer = 0;
    let tries = 20;
    // The page is inert until the dialog's layer goes, and the dialog hands focus back first.
    const go = () => {
      const to = document.querySelector<HTMLElement>(
        `[data-payment="${focusOn.id}"] :is(.desk-text, button.desk-row)`,
      );
      if (to != null && to.closest('[inert]') == null)
        timer = window.setTimeout(() => to.focus(), 0);
      else if (tries-- > 0) frame = window.requestAnimationFrame(go);
    };
    frame = window.requestAnimationFrame(go);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [focusOn]);

  const markPaid = (one: Payment) =>
    setMarking({ id: one.id, draft: draftToMark(one), problems: {} });
  const undo = (id: string) => {
    setBudget((now) => ({
      ...now,
      payments: now.payments.map((one) => (one.id === id ? { ...one, paid: null } : one)),
    }));
    setMarked(null);
    setSaid('');
    setFocusOn({ id });
  };

  return (
    <BudgetShell event={event} trail={trail}>
      {(tell) => (
        <>
          {page === 'vendor' && open != null ? (
            <VendorPage
              event={event}
              quote={open}
              budget={budget}
              viewer={viewer}
              readOnly={readOnly}
              earlier={earlier}
              amending={amending}
              removing={removing}
              marked={marked}
              back={at.home}
              titleRef={title}
              tell={tell}
              onEarlier={setEarlier}
              onQuote={(form) =>
                setQuote({
                  form,
                  draft: draftOfQuote(open),
                  problems: {},
                  refusal: null,
                  list: false,
                })
              }
              onAddPayment={() => setPayment({ draft: BLANK_PAYMENT, problems: {} })}
              onMarkPaid={markPaid}
              onUndo={undo}
              onAmending={setAmending}
              onAmended={(id, draft) => {
                const amount = parsedAmount(draft.amount) ?? 0;
                setBudget((now) => ({
                  ...now,
                  payments: now.payments.map((one) =>
                    one.id === id
                      ? { ...one, what: draft.what.trim(), amount, dueOn: draft.dueOn }
                      : one,
                  ),
                }));
                setAmending(null);
                tell(QW.paymentChanged(draft.what.trim(), money(amount), longDay(draft.dueOn)));
              }}
              onRemoving={setRemoving}
              onRemove={(id) => {
                const gone = budget.payments.find((one) => one.id === id);
                setBudget((now) => ({
                  ...now,
                  payments: now.payments.filter((one) => one.id !== id),
                }));
                setRemoving(null);
                title.current?.focus();
                if (gone != null) tell(QW.paymentRemoved(gone.what, money(gone.amount)));
              }}
            />
          ) : page === 'due' ? (
            <EverythingDue
              due={everythingDue(budget)}
              back={at.home}
              vendorAt={at.vendor}
              titleRef={title}
            />
          ) : (
            <BudgetHome
              budget={budget}
              marked={homeMarked}
              onMark={markPaid}
              onUndo={undo}
              viewer={viewer}
              readOnly={readOnly}
              titleRef={title}
              at={at}
              tell={tell}
              onAdd={() =>
                setQuote({
                  form: 'add',
                  draft: BLANK_QUOTE,
                  problems: {},
                  refusal: null,
                  list: false,
                })
              }
            />
          )}
          <p className="visually-hidden" role="status">
            {said}
          </p>
          {quote != null && (
            <QuoteDialog
              opened={quote}
              budget={budget}
              vendors={start.vendors}
              current={quote.form === 'add' ? null : (open ?? null)}
              viewer={viewer}
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
              onOpened={setPayment}
              onClose={() => setPayment(null)}
              onSaved={(draft: PaymentDraft) => {
                const amount = parsedAmount(draft.amount) ?? 0;
                setBudget((now) => ({
                  ...now,
                  payments: [
                    ...now.payments,
                    {
                      id: nextPaymentId(now.payments),
                      vendorId: open.vendor.id,
                      what: draft.what.trim(),
                      amount,
                      dueOn: draft.dueOn,
                      paid: null,
                      cancelled: null,
                    },
                  ],
                }));
                setPayment(null);
                tell(QW.paymentAdded(draft.what.trim(), money(amount), longDay(draft.dueOn)));
              }}
            />
          )}
          {marking != null && marks != null && markVendor != null && (
            <MarkPaidDialog
              marking={marking}
              payment={marks}
              vendor={markVendor}
              event={event.name}
              onMarking={setMarking}
              onClose={() => setMarking(null)}
              onSaved={(draft) => {
                const next = markedPaid(marks, draft, viewer.name);
                setBudget((now) => ({
                  ...now,
                  payments: now.payments.map((one) => (one.id === next.id ? next : one)),
                }));
                setMarking(null);
                setAmending((now) => (now?.id === next.id ? null : now));
                setRemoving((now) => (now === next.id ? null : now));
                setMarked(next.id);
                setSaid(QW.markedPaid(money(next.paid?.amount ?? 0), longDay(draft.paidOn)));
                setFocusOn({ id: next.id });
              }}
            />
          )}
        </>
      )}
    </BudgetShell>
  );
}

function CostsComing() {
  return (
    <div className="ev-dashed qt-coming">
      <p className="desk-line">{QW.costsComing}</p>
      <div>
        <NotBuilt words={EVENT_WORDS.notBuilt('sc-85')} />
      </div>
    </div>
  );
}

/** Budget's home as far as sc-87 goes: the title, then the costs at the left, Due next and Vendors quoted at the right. */
export function BudgetHome({
  budget,
  viewer,
  readOnly,
  titleRef,
  at,
  tell,
  left = <CostsComing />,
  marked = null,
  onAdd,
  onMark,
  onUndo,
}: {
  budget: Budget;
  viewer: BudgetViewer;
  readOnly: boolean;
  titleRef: RefObject<HTMLHeadingElement | null>;
  at: BudgetAddresses;
  tell: Tell;
  left?: ReactNode;
  marked?: { payment: Payment; vendor: string } | null;
  onAdd: () => void;
  onMark: (payment: Payment) => void;
  onUndo: (id: string) => void;
}) {
  return (
    <>
      <PageTitle title={BW.budget} titleRef={titleRef} />
      {readOnly && (
        <ReadOnlyLine
          {...(viewer.managesBilling ? { onPlans: () => tell(QW.plansElsewhere) } : {})}
        />
      )}
      <Columns
        left={left}
        right={
          <>
            <DueNext
              due={everythingDue(budget)}
              more={at.due}
              marked={marked}
              {...(readOnly ? {} : { onMark, onUndo })}
            />
            <VendorsQuoted
              budget={budget}
              vendorAt={at.vendor}
              onAdd={readOnly ? undefined : onAdd}
            />
          </>
        }
      />
    </>
  );
}

function DueRow({ due, to, onMark }: { due: Due; to?: string; onMark?: () => void }) {
  return (
    <BudgetRow
      title={due.vendor.name}
      lines={[`${due.payment.what} · ${BW.due(shortDay(due.payment.dueOn))}`]}
      tag={due.overdue ? <OverdueTag /> : undefined}
      end={
        <>
          <Amount value={money(due.payment.amount)} />
          {onMark != null && <span className="visually-hidden">{BW.markPaid}</span>}
        </>
      }
      {...(to == null ? {} : { to })}
      {...(onMark == null ? {} : { onOpen: onMark })}
    />
  );
}

/** Due next: the soonest owed, each row opening its own Mark paid; one just marked stays lit with Undo, as the app's does. */
export function DueNext({
  due,
  more,
  marked = null,
  onMark,
  onUndo,
}: {
  due: readonly Due[];
  more: string;
  marked?: { payment: Payment; vendor: string } | null;
  onMark?: (payment: Payment) => void;
  onUndo?: (id: string) => void;
}) {
  return (
    <Block
      title={BW.dueNext}
      action={
        due.length > 0 && (
          <Link className="desk-text" to={more}>
            {BW.everythingDue(due.length)}
            <Glyph name="chevron" size={16} weight={2.4} />
          </Link>
        )
      }
    >
      {due.length === 0 && marked == null ? (
        <p className="desk-line">{BW.nothingDue}</p>
      ) : (
        <Rows>
          {marked != null && marked.payment.paid != null && (
            <li data-payment={marked.payment.id}>
              <BudgetRow
                lead={<PaidMark large />}
                title={marked.vendor}
                lines={[
                  QW.markedPaid(money(marked.payment.paid.amount), longDay(marked.payment.paid.on)),
                ]}
                lit
                end={
                  onUndo != null && (
                    <button
                      type="button"
                      className="desk-text"
                      onClick={() => onUndo(marked.payment.id)}
                    >
                      <Glyph name="undo" size={16} weight={2.4} />
                      {BW.undo}
                    </button>
                  )
                }
              />
            </li>
          )}
          {due.slice(0, DUE_NEXT).map((one) => (
            <li key={one.payment.id} data-payment={one.payment.id}>
              <DueRow
                due={one}
                {...(onMark == null ? {} : { onMark: () => onMark(one.payment) })}
              />
            </li>
          ))}
        </Rows>
      )}
    </Block>
  );
}

/** Each vendor quoted on the event: the quote in the minor unit over its difference, a shape with words; the row opens the vendor. */
export function VendorsQuoted({
  budget,
  vendorAt,
  onAdd,
}: {
  budget: Budget;
  vendorAt: (id: string) => string;
  onAdd?: (() => void) | undefined;
}) {
  return (
    <Block
      title={BW.vendorsQuoted}
      action={onAdd != null && <TextAction label={BW.addAQuote} before="plus" onClick={onAdd} />}
    >
      {budget.quotes.length === 0 ? (
        <p className="desk-line">{BW.noQuotes}</p>
      ) : (
        <Rows>
          {budget.quotes.map((quote) => {
            const scheduled = sum(scheduledFor(budget, quote.vendor.id));

            return (
              <li key={quote.vendor.id}>
                <BudgetRow
                  title={quote.vendor.name}
                  lines={[QW.vendorLine(quote.vendor.category, quote.vendor.contact)]}
                  end={
                    <Amount
                      value={money(quote.amount)}
                      line={
                        <>
                          <DifferenceMark quoted={quote.amount} scheduled={scheduled} />
                          {differenceShort(quote.amount, scheduled, money)}
                        </>
                      }
                    />
                  }
                  to={vendorAt(quote.vendor.id)}
                />
              </li>
            );
          })}
        </Rows>
      )}
    </Block>
  );
}

function DifferenceMark({ quoted, scheduled }: { quoted: number; scheduled: number }) {
  const kind = differenceOf(quoted, scheduled);

  return kind === 'matches' ? (
    <PaidMark />
  ) : (
    <RingMark state={kind === 'short' ? 'overIfAll' : 'over'} />
  );
}

export function PaidMark({ large = false }: { large?: boolean }) {
  return (
    <span className={large ? 'qt-tick is-large' : 'qt-tick'} aria-hidden="true">
      <Glyph name="tick" size={large ? 13 : 9} weight={3.4} />
    </span>
  );
}

function BackLink({ to }: { to: string }) {
  return (
    <Link className="desk-text qt-back" to={to}>
      <Glyph name="back" size={16} weight={2.4} />
      {BW.budget}
    </Link>
  );
}

/** Everything due (sc-87's AC): every unpaid payment, soonest first then by vendor name, each opening its vendor. */
export function EverythingDue({
  due,
  back,
  vendorAt,
  titleRef,
}: {
  due: readonly Due[];
  back: string;
  vendorAt: (id: string) => string;
  titleRef: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <>
      <BackLink to={back} />
      <PageTitle title={BW.everythingDueTitle} titleRef={titleRef} />
      <div className="qt-list">
        {due.length === 0 ? (
          <p className="desk-line">{BW.nothingDue}</p>
        ) : (
          <Rows>
            {due.map((one) => (
              <li key={one.payment.id}>
                <DueRow due={one} to={vendorAt(one.vendor.id)} />
              </li>
            ))}
          </Rows>
        )}
      </div>
    </>
  );
}

/** A vendor's page: A's card (quoted, what is not scheduled, one step), its Schedule at the left, the quote at the right. */
export function VendorPage({
  event,
  quote,
  budget,
  viewer,
  readOnly,
  earlier,
  amending,
  removing,
  marked,
  back,
  titleRef,
  tell,
  onEarlier,
  onQuote,
  onAddPayment,
  onMarkPaid,
  onUndo,
  onAmending,
  onAmended,
  onRemoving,
  onRemove,
}: {
  event: SampleEvent;
  quote: Quote;
  budget: Budget;
  viewer: BudgetViewer;
  readOnly: boolean;
  earlier: boolean;
  amending: Amending | null;
  removing: string | null;
  marked: string | null;
  back: string;
  titleRef: RefObject<HTMLHeadingElement | null>;
  tell: Tell;
  onEarlier: (open: boolean) => void;
  onQuote: (form: 'revise' | 'correct') => void;
  onAddPayment: () => void;
  onMarkPaid: (payment: Payment) => void;
  onUndo: (id: string) => void;
  onAmending: (next: Amending | null) => void;
  onAmended: (id: string, draft: PaymentDraft) => void;
  onRemoving: (id: string | null) => void;
  onRemove: (id: string) => void;
}) {
  const payments = scheduledFor(budget, quote.vendor.id);
  const scheduled = sum(payments);
  const late = firstOverdue(budget, quote.vendor.id);
  const { vendor } = quote;

  return (
    <>
      <BackLink to={back} />
      <div className="qt-vendor-top">
        <h1 ref={titleRef} className="bud-title" tabIndex={-1}>
          {viewer.readsVendors ? (
            <Link className="qt-vendor-link" to={directoryAt(vendor.id, viewer.key)}>
              {vendor.name}
            </Link>
          ) : (
            vendor.name
          )}
        </h1>
        <p className="desk-line">{QW.vendorLine(vendor.category, vendor.contact)}</p>
      </div>
      {readOnly && (
        <ReadOnlyLine
          {...(viewer.managesBilling ? { onPlans: () => tell(QW.plansElsewhere) } : {})}
        />
      )}
      <BudgetCard event={event} label={vendor.name}>
        <GlassTags tags={[{ word: vendor.category }, { word: vendor.contact }]} />
        <OnCard>{QW.quoted}</OnCard>
        <Figure>{whole(quote.amount)}</Figure>
        <OnCard>
          {QW.quotedOn(shortDay(quote.quotedOn), differenceLine(quote.amount, scheduled, cardGap))}
        </OnCard>
        {late != null && (
          <CardStrong>{QW.wasDue(late.what, money(late.amount), shortDay(late.dueOn))}</CardStrong>
        )}
        {!readOnly && (
          <div className="bud-card-foot">
            <CardStep
              label={late != null ? BW.markPaid : QW.addAPayment}
              onClick={() => (late != null ? onMarkPaid(late) : onAddPayment())}
            />
          </div>
        )}
      </BudgetCard>
      <Columns
        left={
          <Block title={QW.schedule}>
            {payments.length === 0 ? (
              <div className="qt-empty">
                <p className="desk-line">{QW.noPayments}</p>
                {!readOnly && (
                  <TextAction label={QW.addAPayment} before="plus" onClick={onAddPayment} />
                )}
              </div>
            ) : (
              <>
                <Rows>
                  {payments.map((one) => (
                    <ScheduleRow
                      key={one.id}
                      payment={one}
                      quote={quote}
                      readOnly={readOnly}
                      amending={amending?.id === one.id ? amending : null}
                      removing={removing === one.id}
                      lit={marked === one.id}
                      onMarkPaid={() => onMarkPaid(one)}
                      onUndo={() => onUndo(one.id)}
                      onChange={() =>
                        onAmending({ id: one.id, draft: draftOfPayment(one), problems: {} })
                      }
                      onAmending={onAmending}
                      onAmended={(draft) => onAmended(one.id, draft)}
                      onRemoving={(asking) => onRemoving(asking ? one.id : null)}
                      onRemove={() => onRemove(one.id)}
                    />
                  ))}
                </Rows>
                <Rows>
                  <li>
                    <BudgetRow
                      lead={<DifferenceMark quoted={quote.amount} scheduled={scheduled} />}
                      title={differenceLine(quote.amount, scheduled, money)}
                      lines={[QW.quotedScheduled(money(quote.amount), money(scheduled))]}
                    />
                  </li>
                </Rows>
              </>
            )}
          </Block>
        }
        right={
          <Block
            title={QW.theQuote}
            action={
              !readOnly && (
                <span className="qt-head-actions">
                  <TextAction label={QW.reviseTheQuote} onClick={() => onQuote('revise')} />
                  <TextAction label={QW.correctTheQuote} onClick={() => onQuote('correct')} />
                </span>
              )
            }
          >
            <Rows>
              <li>
                <BudgetRow title={QW.whatItCovers} lines={[quote.covers]} />
              </li>
              <li>
                <BudgetRow
                  title={QW.quoteNumber}
                  lines={[quote.number === '' ? QW.noQuoteNumber : quote.number]}
                />
              </li>
              <li>
                <BudgetRow title={QW.budgetLines} lines={[linesWords(quote.lines)]} />
              </li>
              {quote.earlier.length > 0 && (
                <li>
                  <BudgetRow
                    title={earlier ? QW.theEarlier : QW.showEarlier}
                    lines={quote.earlier.map((one) =>
                      QW.earlierLine(
                        money(one.amount),
                        shortDay(one.quotedOn),
                        earlier ? (one.number ?? '') : '',
                      ),
                    )}
                    open={earlier}
                    onOpen={() => onEarlier(!earlier)}
                  />
                </li>
              )}
            </Rows>
          </Block>
        }
      />
    </>
  );
}

/** One payment on the Schedule: owed with Mark paid, Change and Remove under it; paid with the tick and who marked it. */
function ScheduleRow({
  payment,
  quote,
  readOnly,
  amending,
  removing,
  lit,
  onMarkPaid,
  onUndo,
  onChange,
  onAmending,
  onAmended,
  onRemoving,
  onRemove,
}: {
  payment: Payment;
  quote: Quote;
  readOnly: boolean;
  amending: Amending | null;
  removing: boolean;
  lit: boolean;
  onMarkPaid: () => void;
  onUndo: () => void;
  onChange: () => void;
  onAmending: (next: Amending | null) => void;
  onAmended: (draft: PaymentDraft) => void;
  onRemoving: (asking: boolean) => void;
  onRemove: () => void;
}) {
  const change = useRef<HTMLButtonElement>(null);
  const backToChange = (tries = 10) =>
    window.requestAnimationFrame(() => {
      if (change.current != null) change.current.focus();
      else if (tries > 0) backToChange(tries - 1);
    });

  if (payment.paid != null)
    return (
      <li data-payment={payment.id}>
        <BudgetRow
          lead={<PaidMark large />}
          title={payment.what}
          lines={[
            QW.paidLine(money(payment.paid.amount), shortDay(payment.paid.on), payment.paid.by),
          ]}
          lit={lit}
          end={
            lit && !readOnly ? (
              <button type="button" className="desk-text" onClick={onUndo}>
                <Glyph name="undo" size={16} weight={2.4} />
                {BW.undo}
              </button>
            ) : undefined
          }
        />
      </li>
    );

  if (amending != null)
    return (
      <li data-payment={payment.id}>
        <AmendInPlace
          amending={amending}
          quote={quote}
          onAmending={onAmending}
          onCancel={() => {
            onAmending(null);
            backToChange();
          }}
          onSaved={(draft) => {
            onAmended(draft);
            backToChange();
          }}
        />
      </li>
    );

  return (
    <li data-payment={payment.id}>
      <BudgetRow
        title={payment.what}
        lines={[BW.due(shortDay(payment.dueOn))]}
        tag={overdue(payment) ? <OverdueTag /> : undefined}
        end={<Amount value={money(payment.amount)} />}
      />
      {readOnly ? null : removing ? (
        <AskInRow
          question={QW.removeAsk}
          onKeep={() => {
            onRemoving(false);
            backToChange();
          }}
          onGo={onRemove}
        />
      ) : (
        <div className="bud-row-actions">
          <button type="button" className="desk-text" onClick={onMarkPaid}>
            {BW.markPaid}
          </button>
          <button ref={change} type="button" className="desk-text" onClick={onChange}>
            {QW.change}
          </button>
          <TextAction label={BW.remove} red onClick={() => onRemoving(true)} />
        </div>
      )}
    </li>
  );
}
