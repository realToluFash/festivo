import {
  ApiError,
  type DueNow,
  type DueNowEvent,
  type DueNowRow,
  type EventQuote,
  type EventQuotes,
  type ScheduledPayment,
} from '@soirely/api-client';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useParams } from 'react-router';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { Dialog, TextAction } from '../../../components/SettingsParts.tsx';
import { dateLocale } from '../../../i18n/index.ts';
import { LayersContext, useDeskLayers } from '../../../layers.ts';
import { underOf, usePageUnder } from '../pageUnder.ts';
import { SignedInHome } from '../Today.tsx';
import { Loading } from './BudgetArea.tsx';
import { minorMoney } from './budgetArea.ts';
import { dueRowState, dueSettled, monthDay } from './dueNow.ts';
import { MarkPaidDialog } from './PaymentForms.tsx';
import { AlertInset } from './QuoteForms.tsx';
import { Amount, BudgetRow, ReadOnlyLine, Rows, TickMark } from './QuoteParts.tsx';
import { longDay, refusalWords, shortDay } from './quotesArea.ts';

type Load =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'notFound' }
  | { kind: 'loaded'; sheet: DueNow };

interface Different {
  event: DueNowEvent;
  quote: EventQuote;
  quotes: EventQuotes;
  payment: ScheduledPayment;
}

/** A payment reminder's link (sc-1331): Due now over the page that was open, or Today when the link opened the desk, and Close goes back to that page. */
export function DueNowPage() {
  const { reminderId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const close = useCallback(() => {
    if (underOf(location) == null) void navigate('/app', { replace: true });
    else void navigate(-1);
  }, [location, navigate]);

  const { layers, covered, setHost } = useDeskLayers();
  const under = usePageUnder();

  return (
    <LayersContext value={layers}>
      <div inert={covered}>{under ?? <SignedInHome />}</div>
      <div ref={setHost} className="desk ev bt desk-layers" />
      <DueNowDialog key={reminderId} reminderId={reminderId} onClose={close} />
    </LayersContext>
  );
}

async function loaded(reminderId: string): Promise<Load> {
  try {
    return { kind: 'loaded', sheet: await api.dueNow(reminderId) };
  } catch (error) {
    return { kind: error instanceof ApiError && error.status === 404 ? 'notFound' : 'failed' };
  }
}

function DueNowDialog({ reminderId, onClose }: { reminderId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [marked, setMarked] = useState<ReadonlySet<string>>(new Set());
  const [refused, setRefused] = useState<Partial<Record<string, string>>>({});
  const [planGone, setPlanGone] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [told, setTold] = useState('');
  const [different, setDifferent] = useState<Different | null>(null);

  const [attempt, setAttempt] = useState(0);

  const read = useCallback(async (): Promise<void> => {
    setLoad(await loaded(reminderId));
  }, [reminderId]);

  useEffect(() => {
    let live = true;
    void loaded(reminderId).then((now) => {
      if (live) setLoad(now);
    });

    return () => {
      live = false;
    };
  }, [reminderId, attempt]);

  if (different != null)
    return (
      <MarkPaidDialog
        eventId={different.event.id}
        eventName={different.event.name}
        quote={different.quote}
        quotes={different.quotes}
        payment={different.payment}
        onClose={() => {
          setDifferent(null);
          void read();
        }}
        onSaved={(words) => {
          const id = different.payment.id;
          void read().then(() => {
            setMarked((was) => new Set([...was, id]));
            setDifferent(null);
            setTold(words);
          });
        }}
      />
    );

  if (load.kind === 'notFound')
    return (
      <Dialog
        title={t('dueNow.title')}
        verb={t('quotes.close')}
        cancel={false}
        onDismiss={onClose}
        onConfirm={onClose}
      >
        <p className="bt-due-done">{t('dueNow.notFound')}</p>
        <Link className="desk-text" to="/app/events">
          {t('dueNow.goToEvents')}
        </Link>
      </Dialog>
    );

  if (load.kind !== 'loaded')
    return (
      <Dialog
        title={t('dueNow.title')}
        verb={t('quotes.close')}
        cancel={false}
        onDismiss={onClose}
        onConfirm={onClose}
      >
        {load.kind === 'loading' ? (
          <Loading words={t('dueNow.loading')} card={false} />
        ) : (
          <>
            <p className="desk-line is-ink" role="alert">
              {t('dueNow.notLoaded')}
            </p>
            <TextAction
              label={t('budget.tryAgain')}
              onClick={() => {
                setLoad({ kind: 'loading' });
                setAttempt((n) => n + 1);
              }}
            />
          </>
        )}
      </Dialog>
    );

  const { sheet } = load;
  const readOnly = sheet.readOnly || planGone;
  const settled = dueSettled(sheet, marked);
  const eventOf = (row: DueNowRow): DueNowEvent | undefined =>
    sheet.events.find((event) => event.id === row.eventId);

  function refuse(row: DueNowRow, error: unknown, failed: string): void {
    if (error instanceof ApiError && error.is('plan_required')) setPlanGone(true);
    const words =
      error instanceof ApiError && error.is('plan_required')
        ? t('quotes.noEntitlement')
        : error instanceof ApiError && error.is('payment_already_paid')
          ? (error.problem.detail ?? t('quotes.alreadyPaidNoName'))
          : error instanceof ApiError && error.is('payment_cancelled')
            ? t('quotes.alreadyCancelled')
            : refusalWords(error, failed);
    setRefused((was) => ({ ...was, [row.paymentId]: words }));
    setTold(words);
  }

  async function pay(row: DueNowRow, event: DueNowEvent, payment: ScheduledPayment): Promise<void> {
    if (busy != null) return;
    setBusy(row.paymentId);
    try {
      await api.markPaid(event.id, payment.id, {
        amount: payment.amount,
        currency: event.currency,
        paidOn: event.today,
        reference: '',
      });
      setMarked((was) => new Set([...was, row.paymentId]));
      setRefused((was) => ({ ...was, [row.paymentId]: undefined }));
      setTold(
        t('quotes.markedPaid', {
          amount: minorMoney(payment.amount, event.currency, locale),
          day: longDay(event.today, locale),
        }),
      );
    } catch (error) {
      refuse(row, error, t('dueNow.notMarked'));
    }
    await read();
    setBusy(null);
  }

  async function undo(row: DueNowRow, event: DueNowEvent): Promise<void> {
    if (busy != null) return;
    setBusy(row.paymentId);
    try {
      await api.undoPaid(event.id, row.paymentId);
      setMarked((was) => new Set([...was].filter((id) => id !== row.paymentId)));
      setTold(t('dueNow.unmarked', { vendor: row.vendor, what: row.description }));
    } catch (error) {
      refuse(row, error, t('dueNow.notUnmarked'));
    }
    await read();
    setBusy(null);
  }

  async function payDifferent(
    row: DueNowRow,
    event: DueNowEvent,
    payment: ScheduledPayment,
  ): Promise<void> {
    if (busy != null) return;
    setBusy(row.paymentId);
    try {
      const quotes = await api.quotes(event.id);
      const quote = quotes.quotes.find((one) => one.payments.some((p) => p.id === payment.id));
      if (quote == null) {
        const words = t('dueNow.notMarked');
        setRefused((was) => ({ ...was, [row.paymentId]: words }));
        setTold(words);
        await read();
      } else setDifferent({ event, quote, quotes, payment });
    } catch (error) {
      refuse(row, error, t('dueNow.notMarked'));
    }
    setBusy(null);
  }

  return (
    <Dialog
      title={t('dueNow.title')}
      verb={t('quotes.close')}
      cancel={false}
      onDismiss={onClose}
      onConfirm={onClose}
    >
      {settled && (
        <p className="bt-due-done" role="status">
          {t('dueNow.settled')}
        </p>
      )}
      <p className="desk-line">
        {t(sheet.events.length > 1 ? 'dueNow.sublineAcross' : 'dueNow.subline', {
          day: monthDay(sheet.sentOn, locale),
          count: sheet.rows.length,
          events: sheet.events.length,
        })}
      </p>
      {readOnly && <ReadOnlyLine />}
      <Rows>
        {sheet.rows.map((row) => {
          const event = eventOf(row);
          if (event == null) return null;
          const state = dueRowState(row, marked);
          const payment = row.payment;
          const refusal = refused[row.paymentId];
          const amount = minorMoney(payment?.amount ?? row.amount, event.currency, locale);

          if (state === 'marked' && payment != null)
            return (
              <li key={row.paymentId}>
                <BudgetRow
                  lead={<TickMark />}
                  title={row.vendor}
                  lines={[
                    t('dueNow.marked', {
                      amount: minorMoney(
                        payment.paid?.amount ?? payment.amount,
                        event.currency,
                        locale,
                      ),
                    }),
                  ]}
                  lit
                  end={
                    readOnly ? undefined : (
                      <button
                        type="button"
                        className="desk-text"
                        onClick={() => void undo(row, event)}
                      >
                        <Glyph name="undo" size={16} weight={2.4} />
                        {t('quotes.undo')}
                      </button>
                    )
                  }
                />
                {refusal != null && <AlertInset>{refusal}</AlertInset>}
              </li>
            );

          return (
            <li key={row.paymentId}>
              <BudgetRow
                title={row.vendor}
                lines={[dueLine(row, event, state)]}
                end={<Amount value={amount} />}
              />
              {refusal != null && <AlertInset>{refusal}</AlertInset>}
              {state === 'owed' && payment != null && !readOnly && refusal == null && (
                <div className="bt-row-actions">
                  <TextAction
                    label={t('dueNow.paid')}
                    onClick={() => void pay(row, event, payment)}
                  />
                  <button
                    type="button"
                    className="desk-text"
                    onClick={() => void payDifferent(row, event, payment)}
                  >
                    {t('dueNow.different')}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </Rows>
      {settled &&
        sheet.events.map((event) => (
          <Link
            key={event.id}
            className="desk-text is-wraps"
            to={`/app/events/${event.id}/budget/due`}
          >
            {t('dueNow.everythingDue', { event: event.name })}
          </Link>
        ))}
      <p className="visually-hidden" role="status">
        {told}
      </p>
    </Dialog>
  );

  function dueLine(
    row: DueNowRow,
    event: DueNowEvent,
    state: ReturnType<typeof dueRowState>,
  ): string {
    const payment = row.payment;
    if (state === 'removed' || payment == null)
      return t('dueNow.removed', { what: row.description, event: event.name });

    const day = shortDay(payment.dueOn, locale);
    const line =
      payment.dueOn < event.today
        ? t('dueNow.overdue', { what: payment.description, day, event: event.name })
        : t('dueNow.due', { what: payment.description, day, event: event.name });

    if (state === 'paid' && payment.paid != null) {
      const paidOn = monthDay(payment.paid.paidOn, locale);

      return payment.paid.by == null
        ? t('dueNow.paidOn', { line, day: paidOn })
        : t('dueNow.paidBy', { line, name: payment.paid.by.name, day: paidOn });
    }

    return state === 'cancelled' ? t('dueNow.cancelled', { line }) : line;
  }
}
