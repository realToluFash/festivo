import {
  type DuePayment,
  type EventQuote,
  type EventQuotes,
  type OrganisationEvent,
  type ScheduledPayment,
} from '@soirely/api-client';
import { moneyLanguage } from '@soirely/domain';
import { type ReactNode, type RefObject, useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Glyph } from '../../../components/Glyph.tsx';
import {
  CardStep,
  Chevron,
  Head,
  OnCard,
  RowWords,
  TextAction,
} from '../../../components/SettingsParts.tsx';
import { dateLocale } from '../../../i18n/index.ts';
import { meshFor } from '../../../mesh.ts';
import { minorMoney, wholeMoney } from './budgetArea.ts';
import { AmendInPlace } from './QuoteForms.tsx';
import {
  DUE_NEXT,
  type Difference,
  type PaymentDraft,
  type PaymentProblems,
  cardDifference,
  differenceLine,
  differenceOf,
  differenceShort,
  draftOfPayment,
  dueInOrder,
  firstOverdue,
  linesWords,
  scheduleOf,
  shortDay,
  vendorLine,
} from './quotesArea.ts';
import './quotes.css';

const PIECES = [1, 2, 3, 4, 5, 6];

export interface Amending {
  id: string;
  draft: PaymentDraft;
  problems: PaymentProblems;
}

/** The event's cover behind a Budget card: the summary, the first card, a vendor's. */
export function CoverCard({
  event,
  label,
  children,
}: {
  event: OrganisationEvent;
  label?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <section
      className={`ev-card today-cover bt-card is-${meshFor(event.id)}`}
      aria-label={label ?? t('budget.card')}
    >
      <span className="ev-scrim" aria-hidden="true" />
      {PIECES.map((piece) => (
        <span key={piece} className={`desk-piece p${piece}`} aria-hidden="true" />
      ))}
      <div className="ev-card-inner bt-card-inner">{children}</div>
    </section>
  );
}

export function BudgetRow({
  title,
  lines = [],
  tag,
  lead,
  end,
  to,
  open,
  onOpen,
}: {
  title: ReactNode;
  lines?: readonly ReactNode[];
  tag?: ReactNode;
  lead?: ReactNode;
  end?: ReactNode;
  to?: string;
  open?: boolean;
  onOpen?: () => void;
}) {
  const inner = (
    <>
      {lead != null && <span className="bt-lead">{lead}</span>}
      <RowWords title={title} tag={tag} lines={lines} />
      {end}
      {(onOpen != null || to != null) && <Chevron />}
    </>
  );

  if (to != null)
    return (
      <Link className="desk-row bt-row" to={to}>
        {inner}
      </Link>
    );
  if (onOpen != null)
    return (
      <button type="button" className="desk-row bt-row" aria-expanded={open} onClick={onOpen}>
        {inner}
      </button>
    );

  return <div className="desk-row bt-row">{inner}</div>;
}

export function Rows({ children }: { children: ReactNode }) {
  return <ul className="desk-rows bt-rows">{children}</ul>;
}

export function Block({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  const id = useId();

  return (
    <section className="desk-block bt-block" aria-labelledby={id}>
      <Head title={<span id={id}>{title}</span>}>{action}</Head>
      {children}
    </section>
  );
}

function Amount({ value, line }: { value: ReactNode; line?: ReactNode }) {
  return (
    <span className="bt-amount">
      <span className="bt-amount-value">{value}</span>
      {line != null && <span className="bt-amount-line">{line}</span>}
    </span>
  );
}

export function OverdueTag() {
  const { t } = useTranslation();

  return (
    <span className="bt-tag is-amber">
      <Glyph name="alert" size={13} weight={2.4} />
      {t('quotes.overdue')}
    </span>
  );
}

function TickMark() {
  return (
    <span className="qt-tick" aria-hidden="true">
      <Glyph name="tick" size={9} weight={3.4} />
    </span>
  );
}

function DifferenceMark({ kind }: { kind: Difference }) {
  return kind === 'matches' ? (
    <TickMark />
  ) : (
    <span
      className={kind === 'short' ? 'bt-ring is-over-if-all' : 'bt-ring is-over'}
      aria-hidden="true"
    />
  );
}

export function ReadOnlyLine() {
  const { t } = useTranslation();

  return (
    <div className="bt-plan-line" role="status">
      <p>{t('quotes.readOnlyLine')}</p>
    </div>
  );
}

function AskInRow({
  question,
  problem = null,
  onKeep,
  onGo,
}: {
  question: string;
  problem?: string | null;
  onKeep: () => void;
  onGo: () => void;
}) {
  const { t } = useTranslation();
  const first = useRef<HTMLButtonElement>(null);
  const again = useRef<HTMLButtonElement>(null);

  useEffect(() => first.current?.focus(), []);
  useEffect(() => {
    if (problem != null) again.current?.focus();
  }, [problem]);

  return (
    <div className="bt-ask" role="group" aria-label={question}>
      <p>{question}</p>
      <button ref={first} type="button" className="desk-text" onClick={onKeep}>
        {t('quotes.keep')}
      </button>
      <button ref={again} type="button" className="desk-text is-red" onClick={onGo}>
        {t('budget.remove')}
      </button>
      {problem != null && (
        <p className="desk-error bt-ask-problem" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {problem}
        </p>
      )}
    </div>
  );
}

function BackLink({ to }: { to: string }) {
  const { t } = useTranslation();

  return (
    <Link className="desk-text qt-back" to={to}>
      <Glyph name="back" size={16} weight={2.4} />
      {t('budget.title')}
    </Link>
  );
}

function DueRow({ due, currency, to }: { due: DuePayment; currency: string; to?: string }) {
  const { t } = useTranslation();
  const locale = dateLocale();

  return (
    <BudgetRow
      title={due.vendor}
      lines={[t('quotes.dueLine', { what: due.description, day: shortDay(due.dueOn, locale) })]}
      tag={due.overdue ? <OverdueTag /> : undefined}
      end={<Amount value={minorMoney(due.amount, currency, locale)} />}
      {...(to == null ? {} : { to })}
    />
  );
}

/** Due next or Vendors quoted when the event's quotes and payments did not load: the block keeps its place, says so and offers Try again. */
export function QuotesNotLoaded({
  title,
  busy,
  onRetry,
}: {
  title: string;
  busy: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Block title={title}>
      <p className="desk-line is-ink">{t('quotes.notLoaded')}</p>
      <TextAction label={t(busy ? 'quotes.tryingAgain' : 'budget.tryAgain')} onClick={onRetry} />
    </Block>
  );
}

export function DueNext({ quotes, more }: { quotes: EventQuotes; more: string }) {
  const { t } = useTranslation();
  const due = dueInOrder(quotes.due, dateLocale());

  return (
    <Block
      title={t('quotes.dueNext')}
      action={
        due.length > 0 && (
          <Link className="desk-text" to={more}>
            {t('quotes.everythingDue', { count: due.length })}
            <Glyph name="chevron" size={16} weight={2.4} />
          </Link>
        )
      }
    >
      {due.length === 0 ? (
        <p className="desk-line">{t('quotes.nothingDue')}</p>
      ) : (
        <Rows>
          {due.slice(0, DUE_NEXT).map((one) => (
            <li key={one.id}>
              <DueRow due={one} currency={quotes.currency} />
            </li>
          ))}
        </Rows>
      )}
    </Block>
  );
}

/** Each vendor quoted on the event: the quote over its difference, a shape with words; the row opens the vendor. */
export function VendorsQuoted({
  quotes,
  vendorAt,
  onAdd,
}: {
  quotes: EventQuotes;
  vendorAt: (vendorId: string) => string;
  onAdd: (() => void) | null;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();

  return (
    <Block
      title={t('quotes.vendorsQuoted')}
      action={
        onAdd != null && <TextAction label={t('quotes.addAQuote')} before="plus" onClick={onAdd} />
      }
    >
      {quotes.quotes.length === 0 ? (
        <p className="desk-line">{t('quotes.noQuotes')}</p>
      ) : (
        <Rows>
          {quotes.quotes.map((quote) => (
            <li key={quote.id}>
              <BudgetRow
                title={quote.vendor.name}
                lines={[vendorLine(t, quote)]}
                end={
                  <Amount
                    value={minorMoney(quote.quote.amount, quotes.currency, locale)}
                    line={
                      <>
                        <DifferenceMark kind={differenceOf(quote)} />
                        {differenceShort(t, quote, quotes.currency, locale)}
                      </>
                    }
                  />
                }
                to={vendorAt(quote.vendor.id)}
              />
            </li>
          ))}
        </Rows>
      )}
    </Block>
  );
}

export function EverythingDue({
  quotes,
  back,
  vendorAt,
  titleRef,
}: {
  quotes: EventQuotes;
  back: string;
  vendorAt: (vendorId: string) => string;
  titleRef: RefObject<HTMLHeadingElement | null>;
}) {
  const { t } = useTranslation();
  const due = dueInOrder(quotes.due, dateLocale());
  const vendorOf = (quoteId: string) => quotes.quotes.find((one) => one.id === quoteId)?.vendor.id;

  return (
    <>
      <BackLink to={back} />
      <div className="bt-title-row">
        <h1 ref={titleRef} className="bt-title" tabIndex={-1}>
          {t('quotes.everythingDueTitle')}
        </h1>
      </div>
      <div className="qt-list">
        {due.length === 0 ? (
          <p className="desk-line">{t('quotes.nothingDue')}</p>
        ) : (
          <Rows>
            {due.map((one) => {
              const vendorId = vendorOf(one.quoteId);

              return (
                <li key={one.id}>
                  <DueRow
                    due={one}
                    currency={quotes.currency}
                    {...(vendorId == null ? {} : { to: vendorAt(vendorId) })}
                  />
                </li>
              );
            })}
          </Rows>
        )}
      </div>
    </>
  );
}

/** A vendor's page: the card (quoted, what is not scheduled, one step), its Schedule at the left, the quote at the right. */
export function VendorPage({
  eventId,
  quote,
  quotes,
  writes,
  readOnly,
  directory,
  event,
  back,
  titleRef,
  amending,
  removing,
  notRemoved,
  earlier,
  onEarlier,
  onQuote,
  onAddPayment,
  onAmending,
  onAmended,
  onRemoving,
  onRemove,
}: {
  eventId: string;
  quote: EventQuote;
  quotes: EventQuotes;
  writes: boolean;
  readOnly: boolean;
  directory: string | null;
  event: OrganisationEvent;
  back: string;
  titleRef: RefObject<HTMLHeadingElement | null>;
  amending: Amending | null;
  removing: string | null;
  notRemoved: boolean;
  earlier: boolean;
  onEarlier: (open: boolean) => void;
  onQuote: (form: 'revise' | 'correct') => void;
  onAddPayment: () => void;
  onAmending: (next: Amending | null) => void;
  onAmended: (words: string) => void;
  onRemoving: (id: string | null) => void;
  onRemove: (payment: ScheduledPayment) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = dateLocale();
  const { currency } = quotes;
  const money = (amount: string) => minorMoney(amount, currency, locale);
  const payments = scheduleOf(quote);
  const late = firstOverdue(quote);
  const { vendor } = quote;
  const contact = vendor.contactName ?? '';
  const category = t(`vendors.categories.${vendor.category}`);

  return (
    <>
      <BackLink to={back} />
      <div className="qt-vendor-top">
        <h1 ref={titleRef} className="bt-title" tabIndex={-1}>
          {directory != null ? (
            <Link className="qt-vendor-link" to={directory}>
              {vendor.name}
            </Link>
          ) : (
            vendor.name
          )}
        </h1>
        <p className="desk-line">{vendorLine(t, quote)}</p>
      </div>
      {readOnly && <ReadOnlyLine />}
      <CoverCard event={event} label={vendor.name}>
        <ul className="desk-glass-tags">
          <li className="desk-glass">{category}</li>
          {contact !== '' && <li className="desk-glass">{contact}</li>}
        </ul>
        <OnCard>{t('quotes.quoted')}</OnCard>
        <p className="bt-figure">{wholeMoney(quote.quote.amount, currency, locale)}</p>
        <OnCard>
          {t('quotes.quotedOn', {
            day: shortDay(quote.quote.quotedOn, locale),
            difference: cardDifference(t, quote, currency, locale),
          })}
        </OnCard>
        {late != null && (
          <p className="bt-card-strong">
            {t('quotes.wasDue', {
              what: late.description.toLocaleLowerCase(i18n.language),
              amount: money(late.amount),
              day: shortDay(late.dueOn, locale),
            })}
          </p>
        )}
        {writes && (
          <div className="bt-card-foot">
            <CardStep label={t('quotes.addAPayment')} onClick={onAddPayment} />
          </div>
        )}
      </CoverCard>
      <div className="ev-columns">
        <div className="ev-left">
          <Block title={t('quotes.schedule')}>
            {payments.length === 0 ? (
              <div className="qt-empty">
                <p className="desk-line">{t('quotes.noPayments')}</p>
                {writes && (
                  <TextAction
                    label={t('quotes.addAPayment')}
                    before="plus"
                    onClick={onAddPayment}
                  />
                )}
              </div>
            ) : (
              <>
                <Rows>
                  {payments.map((one) => (
                    <ScheduleRow
                      key={one.id}
                      eventId={eventId}
                      payment={one}
                      quote={quote}
                      quotes={quotes}
                      writes={writes}
                      amending={amending?.id === one.id ? amending : null}
                      removing={removing === one.id}
                      notRemoved={removing === one.id && notRemoved}
                      onAmending={onAmending}
                      onAmended={onAmended}
                      onRemoving={(asking) => onRemoving(asking ? one.id : null)}
                      onRemove={() => onRemove(one)}
                    />
                  ))}
                </Rows>
                <Rows>
                  <li>
                    <BudgetRow
                      lead={<DifferenceMark kind={differenceOf(quote)} />}
                      title={differenceLine(t, quote, currency, locale)}
                      lines={[
                        t('quotes.quotedScheduled', {
                          quoted: money(quote.quote.amount),
                          scheduled: money(quote.scheduled),
                        }),
                      ]}
                    />
                  </li>
                </Rows>
              </>
            )}
          </Block>
        </div>
        <div className="ev-right">
          <Block
            title={t('quotes.theQuote')}
            action={
              writes && (
                <span className="qt-head-actions">
                  <TextAction
                    label={t('quotes.reviseTheQuote')}
                    onClick={() => onQuote('revise')}
                  />
                  <TextAction
                    label={t('quotes.correctTheQuote')}
                    onClick={() => onQuote('correct')}
                  />
                </span>
              )
            }
          >
            <Rows>
              <li>
                <BudgetRow title={t('quotes.whatItCovers')} lines={[quote.quote.covers]} />
              </li>
              <li>
                <BudgetRow
                  title={t('quotes.quoteNumber')}
                  lines={[quote.quote.reference ?? t('quotes.noQuoteNumber')]}
                />
              </li>
              <li>
                <BudgetRow
                  title={t('quotes.budgetLines')}
                  lines={[linesWords(t, quote, i18n.language)]}
                />
              </li>
              {quote.earlier.length > 0 && (
                <li>
                  <BudgetRow
                    title={earlier ? t('quotes.theEarlier') : t('quotes.showEarlier')}
                    lines={quote.earlier.map((one) => {
                      const words = {
                        amount: money(one.amount),
                        day: shortDay(one.quotedOn, locale),
                      };

                      return earlier && one.reference != null
                        ? t('quotes.earlierLineNumber', { ...words, number: one.reference })
                        : t('quotes.earlierLine', words);
                    })}
                    open={earlier}
                    onOpen={() => onEarlier(!earlier)}
                  />
                </li>
              )}
            </Rows>
          </Block>
        </div>
      </div>
    </>
  );
}

/** One payment on the Schedule, with Change, opened in place, and Remove, asked in the row. */
function ScheduleRow({
  eventId,
  payment,
  quote,
  quotes,
  writes,
  amending,
  removing,
  notRemoved,
  onAmending,
  onAmended,
  onRemoving,
  onRemove,
}: {
  eventId: string;
  payment: ScheduledPayment;
  quote: EventQuote;
  quotes: EventQuotes;
  writes: boolean;
  amending: Amending | null;
  removing: boolean;
  notRemoved: boolean;
  onAmending: (next: Amending | null) => void;
  onAmended: (words: string) => void;
  onRemoving: (asking: boolean) => void;
  onRemove: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = dateLocale();
  const change = useRef<HTMLButtonElement>(null);
  const backToChange = (tries = 10) =>
    window.requestAnimationFrame(() => {
      if (change.current != null) change.current.focus();
      else if (tries > 0) backToChange(tries - 1);
    });

  if (amending != null)
    return (
      <li data-payment={payment.id}>
        <AmendInPlace
          eventId={eventId}
          amending={amending}
          payment={payment}
          quote={quote}
          quotes={quotes}
          onAmending={onAmending}
          onCancel={() => {
            onAmending(null);
            backToChange();
          }}
          onSaved={(words) => {
            onAmended(words);
            backToChange();
          }}
        />
      </li>
    );

  return (
    <li data-payment={payment.id}>
      <BudgetRow
        title={payment.description}
        lines={[t('quotes.due', { day: shortDay(payment.dueOn, locale) })]}
        tag={payment.overdue ? <OverdueTag /> : undefined}
        end={<Amount value={minorMoney(payment.amount, quotes.currency, locale)} />}
      />
      {!writes ? null : removing ? (
        <AskInRow
          question={t('quotes.removeAsk')}
          problem={notRemoved ? t('budget.notRemoved') : null}
          onKeep={() => {
            onRemoving(false);
            backToChange();
          }}
          onGo={onRemove}
        />
      ) : (
        <div className="bt-row-actions">
          <button
            ref={change}
            type="button"
            className="desk-text"
            onClick={() =>
              onAmending({
                id: payment.id,
                draft: draftOfPayment(payment, moneyLanguage(i18n.language), quotes.currency),
                problems: {},
              })
            }
          >
            {t('quotes.change')}
          </button>
          <TextAction label={t('budget.remove')} red onClick={() => onRemoving(true)} />
        </div>
      )}
    </li>
  );
}
