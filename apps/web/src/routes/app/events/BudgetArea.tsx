import {
  ApiError,
  type BudgetLine,
  type BudgetLineTyped,
  COST_BASES,
  type CostBasis,
  type EventBudget,
  type EventQuote,
  type EventQuotes,
  type OrganisationEvent,
  type ScheduledPayment,
  VENDOR_CATEGORIES,
  type VendorCategory,
  linePrice,
  realtimeTopic,
} from '@soirely/api-client';
import {
  formatTimeOfDay,
  listFormat,
  moneyLanguage,
  numberFormat,
  typedAmount,
} from '@soirely/domain';
import type { TFunction } from 'i18next';
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import {
  CardStep,
  Chevron,
  Dialog,
  Field,
  Head,
  OnCard,
  RowWords,
  Says,
  TextAction,
} from '../../../components/SettingsParts.tsx';
import { useDeskTop } from '../../../deskTop.ts';
import { dateLocale } from '../../../i18n/index.ts';
import { LayersContext, useDeskLayers } from '../../../layers.ts';
import { useOwnOfflineNotice } from '../../../offline.ts';
import { pageTitle, usePageTitle } from '../../../pageTitle.ts';
import { can, canOn, useSession } from '../../../session.ts';
import { Toast } from '../../../components/Toast.tsx';
import { keptKeys, keptLoad, useAnsweredAgain, useKeptAsShown } from '../../../tabKept.ts';
import {
  NOTE_MAX,
  WHAT_MAX,
  basisLine,
  categoriesOf,
  characters,
  currencySign,
  lineState,
  liveWords,
  priceProblem,
  priceProblemWords,
  rateWords,
  reasonWords,
  removedWords,
  rowLine,
  sentPrice,
  minorMoney,
  wholeMoney,
} from './budgetArea.ts';
import { PaymentDialog, QuoteDialog } from './QuoteForms.tsx';
import {
  type Amending,
  CoverCard,
  DueNext,
  EverythingDue,
  QuotesNotLoaded,
  ReadOnlyLine,
  VendorPage,
  VendorsQuoted,
} from './QuoteParts.tsx';
import { type QuoteForm, budgetPath, budgetView, vendorPagePath } from './quotesArea.ts';
import { useHubTopics } from './useHubTopics.ts';
import '../../../components/SettingsParts.css';
import '../../../components/eventsDesk.css';
import '../../../components/eventPage.css';
import './budget.css';

const WASH_MS = 1600;
const MINUTE_MS = 60_000;

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; budget: EventBudget };

type QuotesLoad =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; quotes: EventQuotes };

interface Quoting {
  form: QuoteForm;
  quote: EventQuote | null;
}

interface Said {
  id: string;
  words: string;
  ok: boolean;
}

interface Removed {
  line: BudgetLine;
  words: string;
  gone?: boolean;
}

/** An event's Budget at a desk (sc-85), as Budget A's demo draws it: the card with the range, the costs under their categories, a rate opened in place, Add a cost. */
export function BudgetArea({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();
  const desk = useDeskTop();
  const { layers, covered, setHost } = useDeskLayers();
  const locale = dateLocale();
  const stale = useOwnOfflineNotice();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const answeredAgain = useAnsweredAgain();
  const [opened, setOpened] = useState<string | null>(null);
  const [said, setSaid] = useState<Said | null>(null);
  const [lit, setLit] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Removed | null>(null);
  const [live, setLive] = useState<string | null>(null);
  const [washed, setWashed] = useState(0);
  const [adding, setAdding] = useState(false);
  const [heard, setHeard] = useState('');
  const [toRow, setToRow] = useState<string | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const shown = useRef<EventBudget | null>(null);
  const known = useRef(new Set<string>());
  const own = useRef(0);
  const session = useSession();
  const { '*': rest = '' } = useParams();
  const view = budgetView(rest);
  const viewKey = view.kind === 'vendor' ? `vendor:${view.vendorId}` : view.kind;
  const [quotesLoad, setQuotesLoad] = useState<QuotesLoad>({ kind: 'loading' });
  const [quoting, setQuoting] = useState<Quoting | null>(null);
  const [paying, setPaying] = useState<EventQuote | null>(null);
  const [amending, setAmending] = useState<Amending | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [notRemoved, setNotRemoved] = useState(false);
  const [retryingQuotes, setRetryingQuotes] = useState(false);
  const [earlier, setEarlier] = useState(false);
  const [told, setTold] = useState<string | null>(null);
  const viewed = useRef(false);
  const quotes = quotesLoad.kind === 'loaded' ? quotesLoad.quotes : null;
  const shownQuote =
    view.kind === 'vendor'
      ? (quotes?.quotes.find((one) => one.vendor.id === view.vendorId) ?? null)
      : null;
  const sub =
    view.kind === 'due'
      ? t('quotes.everythingDueTitle')
      : view.kind === 'vendor'
        ? (shownQuote?.vendor.name ?? null)
        : null;

  usePageTitle(
    pageTitle(
      t,
      sub == null ? [t('budget.title'), event.name] : [sub, t('budget.title'), event.name],
    ),
  );

  useEffect(() => {
    let current = true;

    api.quotes(event.id).then(
      (found) => current && setQuotesLoad({ kind: 'loaded', quotes: found }),
      () => current && setQuotesLoad((was) => (was.kind === 'loaded' ? was : { kind: 'failed' })),
    );

    return () => {
      current = false;
    };
  }, [event.id, attempt, answeredAgain]);

  const [seenView, setSeenView] = useState(viewKey);
  if (seenView !== viewKey) {
    setSeenView(viewKey);
    setAmending(null);
    setRemoving(null);
    setNotRemoved(false);
    setEarlier(false);
  }

  useEffect(() => {
    if (viewed.current) title.current?.focus();
    viewed.current = true;
  }, [viewKey]);

  useEffect(() => {
    let current = true;

    keptLoad(keptKeys.budget(event.id), api.budget(event.id)).then(
      (budget) => {
        if (!current) return;
        shown.current = budget;
        for (const line of budget.lines) known.current.add(line.id);
        setLoad({ kind: 'loaded', budget });
      },
      () => current && setLoad((was) => (was.kind === 'loaded' ? was : { kind: 'failed' })),
    );

    return () => {
      current = false;
    };
  }, [event.id, attempt, answeredAgain]);
  useKeptAsShown(keptKeys.budget(event.id), load.kind === 'loaded' ? load.budget : null);

  useEffect(() => {
    if (washed === 0) return;
    const timer = window.setTimeout(() => setWashed(0), WASH_MS);

    return () => window.clearTimeout(timer);
  }, [washed]);

  useEffect(() => {
    if (toRow == null) return;
    let tries = 20;
    let timer = 0;
    // A closing dialog hands focus back to its opener first, so wait until the page is no longer inert.
    const go = () => {
      const row = document.querySelector<HTMLElement>(`[data-line="${toRow}"] button`);
      if (row != null && row.closest('[inert]') == null) {
        row.focus();
        setToRow(null);
      } else if (tries-- > 0) timer = window.setTimeout(go, 50);
    };
    timer = window.setTimeout(go, 0);

    return () => window.clearTimeout(timer);
  }, [toRow]);

  const adopt = useCallback((budget: EventBudget) => {
    shown.current = budget;
    for (const line of budget.lines) known.current.add(line.id);
    setLoad({ kind: 'loaded', budget });
  }, []);

  /** The reader's own change, read back: never announced as another tab's. */
  const readOwn = useCallback(async (): Promise<EventBudget | null> => {
    own.current += 1;
    try {
      const budget = await api.budget(event.id);
      adopt(budget);

      return budget;
    } catch {
      return null;
    } finally {
      own.current -= 1;
    }
  }, [adopt, event.id]);

  const readQuotes = useCallback(async (): Promise<void> => {
    try {
      setQuotesLoad({ kind: 'loaded', quotes: await api.quotes(event.id) });
    } catch {
      return;
    }
  }, [event.id]);

  const readLive = useCallback(() => {
    void readQuotes();
    api.budget(event.id).then(
      (budget) => {
        const was = shown.current;
        const words = was == null ? null : liveWords(t, was, budget, locale, known.current);
        adopt(budget);
        if (own.current > 0 || words == null) return;
        setLive(words);
        setWashed((n) => n + 1);
      },
      () => undefined,
    );
  }, [adopt, event.id, locale, readQuotes, t]);

  const topics = useMemo(
    () => [
      realtimeTopic('EventBudget', event.id),
      realtimeTopic('EventHeadcount', event.id),
      realtimeTopic('EventQuotes', event.id),
    ],
    [event.id],
  );
  useHubTopics(topics, () => api.budgetSubscription(event.id), readLive, readLive);

  const budget = load.kind === 'loaded' ? load.budget : null;
  const home = budgetPath(event.id);
  const vendorAt = (vendorId: string) => vendorPagePath(event.id, vendorId);
  const writes = quotes != null && quotes.entitled && canOn(event, 'budget.manage');
  const readOnly = quotes != null && !quotes.entitled && quotes.quotes.length > 0;
  const quotesShown =
    quotesLoad.kind === 'failed' || (quotes != null && (quotes.entitled || readOnly));
  const tell = (words: string) => setTold(words);

  const crumb = (
    <div className="ev-crumb-row">
      <nav className="ev-crumb" aria-label={t('budget.crumb')}>
        <ol>
          <li className="ev-crumb-part">
            <Link to="/app/events">{t('budget.events')}</Link>
          </li>
          <li className="ev-crumb-part">
            <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
            <Link className="ev-crumb-name" to={`/app/events/${encodeURIComponent(event.id)}`}>
              {event.name}
            </Link>
          </li>
          {sub == null ? (
            <li className="ev-crumb-part" aria-current="page">
              <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
              <span className="ev-crumb-name">{t('budget.title')}</span>
            </li>
          ) : (
            <>
              <li className="ev-crumb-part">
                <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                <Link className="ev-crumb-name" to={home}>
                  {t('budget.title')}
                </Link>
              </li>
              <li className="ev-crumb-part" aria-current="page">
                <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                <span className="ev-crumb-name">{sub}</span>
              </li>
            </>
          )}
        </ol>
      </nav>
      {desk.bell}
    </div>
  );

  const openAdd = () => {
    setAdding(true);
    setLive(null);
  };

  if (view.kind === 'unknown' || (view.kind === 'vendor' && quotes != null && shownQuote == null))
    return <Navigate replace to={home} />;

  const failed = load.kind === 'failed' || (view.kind !== 'home' && quotesLoad.kind === 'failed');
  const waiting =
    !failed && (load.kind === 'loading' || (view.kind !== 'home' && quotesLoad.kind === 'loading'));
  const retry = () => {
    setLoad((was) => (was.kind === 'failed' ? { kind: 'loading' } : was));
    setQuotesLoad((was) => (was.kind === 'failed' ? { kind: 'loading' } : was));
    setAttempt((n) => n + 1);
  };
  const afterQuote = async (words: string, revised: boolean) => {
    await readQuotes();
    setQuoting(null);
    if (revised) setEarlier(false);
    tell(words);
  };
  const retryQuotes = async () => {
    if (retryingQuotes) return;
    setRetryingQuotes(true);
    try {
      setQuotesLoad({ kind: 'loaded', quotes: await api.quotes(event.id) });
      title.current?.focus();
    } catch {
      return;
    } finally {
      setRetryingQuotes(false);
    }
  };
  const removePayment = async (payment: ScheduledPayment) => {
    if (quotes == null) return;
    try {
      await api.removePayment(event.id, payment.id);
    } catch {
      setNotRemoved(true);
      return;
    }
    await readQuotes();
    setRemoving(null);
    setNotRemoved(false);
    title.current?.focus();
    tell(
      t('quotes.paymentRemoved', {
        what: payment.description,
        amount: minorMoney(payment.amount, quotes.currency, locale),
      }),
    );
  };

  const undo = async (): Promise<void> => {
    if (removed == null || removed.gone === true) return;
    try {
      await api.putBackBudgetLine(event.id, removed.line.id);
    } catch (error) {
      const lapsed = error instanceof ApiError && error.status === 404;
      const currencyChanged = error instanceof ApiError && error.is('budget_line_currency_changed');
      const gone = lapsed || currencyChanged;
      const staff = error instanceof ApiError && error.fieldErrors()['basis'] != null;
      const words = t(
        currencyChanged
          ? 'budget.notBackCurrency'
          : lapsed
            ? 'budget.notBackGone'
            : staff
              ? 'budget.notBackStaff'
              : 'budget.notBack',
      );
      setRemoved({ line: removed.line, words, gone });
      setHeard(words);
      return;
    }
    await readOwn();
    setRemoved(null);
    setHeard(t('budget.back', { name: removed.line.label }));
    setLit(removed.line.id);
    setToRow(removed.line.id);
  };

  const undoBar = removed != null && (
    <UndoBar removed={removed} undoRef={undoRef} onUndo={() => void undo()} />
  );

  return (
    <LayersContext value={layers}>
      <div className="desk ev desk-page ev-page bt">
        <div className="ev-wide bt-page" inert={covered}>
          {crumb}
          {view.kind === 'home' && (
            <div className="bt-title-row">
              <h1 ref={title} className="bt-title" tabIndex={-1}>
                {t('budget.title')}
              </h1>
              {budget != null && (
                <div className="bt-title-actions">
                  <TextAction label={t('budget.addCost')} before="plus" onClick={openAdd} />
                </div>
              )}
            </div>
          )}
          <div aria-live="polite" aria-atomic="true" className="visually-hidden">
            {heard}
          </div>
          {waiting && <Loading />}
          {failed && (
            <>
              <p className="desk-line is-ink">{t('budget.failed')}</p>
              <TextAction label={t('budget.tryAgain')} onClick={retry} />
            </>
          )}
          {!waiting && !failed && view.kind === 'due' && quotes != null && (
            <EverythingDue quotes={quotes} back={home} vendorAt={vendorAt} titleRef={title} />
          )}
          {!waiting && !failed && shownQuote != null && quotes != null && (
            <VendorPage
              eventId={event.id}
              quote={shownQuote}
              quotes={quotes}
              writes={writes}
              readOnly={readOnly}
              directory={
                can(session, 'vendors.read')
                  ? `/app/settings/vendors?vendor=${encodeURIComponent(shownQuote.vendor.id)}`
                  : null
              }
              event={event}
              back={home}
              titleRef={title}
              amending={amending}
              removing={removing}
              notRemoved={notRemoved}
              earlier={earlier}
              onEarlier={setEarlier}
              onQuote={(form) => setQuoting({ form, quote: shownQuote })}
              onAddPayment={() => setPaying(shownQuote)}
              onAmending={setAmending}
              onAmended={(words) => {
                void readQuotes().then(() => {
                  setAmending(null);
                  tell(words);
                });
              }}
              onRemoving={(id) => {
                setRemoving(id);
                setNotRemoved(false);
              }}
              onRemove={(payment) => void removePayment(payment)}
            />
          )}
          {view.kind === 'home' && budget != null && (
            <>
              {live != null && stale == null && <LiveLine words={live} />}
              {stale != null && <NotLive at={stale.at} onTry={stale.retry} />}
              {readOnly && <ReadOnlyLine />}
              {budget.lines.length === 0 && undoBar}
              {budget.lines.length === 0 ? (
                <FirstCard event={event} budget={budget} onAdd={openAdd} />
              ) : (
                <SummaryCard
                  event={event}
                  budget={budget}
                  washed={washed > 0}
                  step={stale == null}
                  onPrice={() => {
                    const unpriced = budget.lines.find((one) => lineState(one) === 'notPriced');
                    if (unpriced == null) return;
                    setOpened(unpriced.id);
                    setSaid(null);
                  }}
                />
              )}
              {budget.lines.length > 0 && (
                <div className="ev-columns">
                  <div className="ev-left">
                    <Costs
                      budget={budget}
                      opened={opened}
                      lit={lit}
                      said={said}
                      bar={undoBar}
                      onOpen={(id) => {
                        setOpened((now) => (now === id ? null : id));
                        setSaid(null);
                      }}
                      onClose={(id) => {
                        setOpened(null);
                        setToRow(id);
                      }}
                      onSave={async (line, typed) => {
                        await api.changeBudgetLine(event.id, line.id, typed);
                        setRemoved(null);
                        setLive(null);
                        await readOwn();
                        setOpened(null);
                        setLit(line.id);
                        setSaid({ id: line.id, words: t('budget.saved'), ok: true });
                        setHeard(t('budget.saved'));
                        setWashed((n) => n + 1);
                        setToRow(line.id);
                      }}
                      onSaveFailed={(line) => {
                        const rate = rateWords(t, line, locale);
                        const words =
                          lineState(line) === 'notPriced' || rate == null
                            ? t('budget.notSavedPrice')
                            : t('budget.notSaved', { rate });
                        setOpened(null);
                        setLit(null);
                        setSaid({ id: line.id, words, ok: false });
                        setToRow(line.id);
                      }}
                      onRemove={async (line) => {
                        try {
                          await api.removeBudgetLine(event.id, line.id);
                        } catch {
                          setSaid({ id: line.id, words: t('budget.notRemoved'), ok: false });
                          return;
                        }
                        const words = removedWords(t, line, locale);
                        setOpened(null);
                        setSaid(null);
                        setLive(null);
                        setRemoved({ line, words });
                        await readOwn();
                        window.setTimeout(() => undoRef.current?.focus(), 0);
                      }}
                    />
                  </div>
                  {quotesShown && (
                    <div className="ev-right">
                      {quotes == null ? (
                        <>
                          <QuotesNotLoaded
                            title={t('quotes.dueNext')}
                            busy={retryingQuotes}
                            onRetry={() => void retryQuotes()}
                          />
                          <QuotesNotLoaded
                            title={t('quotes.vendorsQuoted')}
                            busy={retryingQuotes}
                            onRetry={() => void retryQuotes()}
                          />
                        </>
                      ) : (
                        <>
                          <DueNext quotes={quotes} more={`${home}/due`} />
                          <VendorsQuoted
                            quotes={quotes}
                            vendorAt={vendorAt}
                            onAdd={writes ? () => setQuoting({ form: 'add', quote: null }) : null}
                          />
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        {quoting != null && quotes != null && budget != null && (
          <QuoteDialog
            eventId={event.id}
            form={quoting.form}
            quotes={quotes}
            current={quoting.quote}
            lines={budget.lines}
            readsVendors={can(session, 'vendors.read')}
            onClose={() => setQuoting(null)}
            onSaved={(words) => void afterQuote(words, quoting.form === 'revise')}
          />
        )}
        {paying != null && quotes != null && (
          <PaymentDialog
            eventId={event.id}
            event={event}
            quote={paying}
            quotes={quotes}
            onClose={() => setPaying(null)}
            onRaced={() => void readQuotes()}
            onSaved={(words) => {
              void readQuotes().then(() => {
                setPaying(null);
                tell(words);
              });
            }}
          />
        )}
        {told != null && <Toast key={told} words={told} onClose={() => setTold(null)} />}
        {adding && budget != null && (
          <AddCostDialog
            eventId={event.id}
            budget={budget}
            onDismiss={() => setAdding(false)}
            onAdded={async () => {
              const was = shown.current;
              const now = await readOwn();
              const added = now?.lines.find(
                (one) => was?.lines.every((old) => old.id !== one.id) ?? false,
              );
              setAdding(false);
              setRemoved(null);
              setWashed((n) => n + 1);
              setHeard(t('budget.saved'));
              if (added != null) {
                setLit(added.id);
                setSaid({ id: added.id, words: t('budget.saved'), ok: true });
                setToRow(added.id);
              }
            }}
          />
        )}
        <div ref={setHost} className="desk-layers" />
      </div>
    </LayersContext>
  );
}

function Loading() {
  const { t } = useTranslation();

  return (
    <div className="bt-loading" aria-busy="true">
      <div className="bt-bone is-card" aria-hidden="true" />
      <p className="desk-line" role="status">
        {t('budget.loading')}
      </p>
      {[0, 1, 2, 3].map((one) => (
        <div key={one} className="bt-bone-row" aria-hidden="true">
          <span className={`bt-bone is-line is-${one % 3}`} />
          <span className="bt-bone is-value" />
        </div>
      ))}
    </div>
  );
}

function LiveLine({ words }: { words: string }) {
  return (
    <p className="bt-live" role="status">
      <span className="bt-live-dot" aria-hidden="true" />
      {words}
    </p>
  );
}

function NotLive({ at, onTry }: { at: Date; onTry: () => void }) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), MINUTE_MS);

    return () => window.clearInterval(timer);
  }, []);

  const time = formatTimeOfDay(at, dateLocale());
  const minutes = Math.floor((now - at.getTime()) / MINUTE_MS);

  return (
    <div className="bt-strip" role="status">
      <span className="bt-strip-ring" aria-hidden="true" />
      <span className="bt-strip-words">
        {minutes < 1
          ? t('budget.notLiveNow', { time })
          : t('budget.notLive', { time, count: minutes })}
      </span>
      <TextAction label={t('budget.tryNow')} onClick={onTry} />
    </div>
  );
}

function SummaryCard({
  event,
  budget,
  washed,
  step,
  onPrice,
}: {
  event: OrganisationEvent;
  budget: EventBudget;
  washed: boolean;
  step: boolean;
  onPrice: () => void;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const money = (amount: string) => wholeMoney(amount, budget.currency, locale);
  const pair = (label: string, perHead: EventBudget['perHead']['confirmed']) =>
    perHead.amount == null
      ? { label, figure: t('budget.noFigure'), sub: t('budget.nobodyYes') }
      : {
          label,
          figure: money(perHead.amount),
          sub: t('budget.coming', { count: perHead.heads }),
        };
  const pairs = [
    pair(t('budget.perHeadSettled'), budget.perHead.confirmed),
    pair(t('budget.perHeadIfAll'), budget.perHead.potential),
  ];

  return (
    <CoverCard event={event}>
      {budget.notPriced > 0 && (
        <ul className={washed ? 'desk-glass-tags is-washed' : 'desk-glass-tags'}>
          <li className="desk-glass">
            <span className="bt-dashed is-glass" aria-hidden="true" />
            {t('budget.notPricedCount', { count: budget.notPriced })}
          </li>
        </ul>
      )}
      <p className="bt-head">{t('budget.willCost')}</p>
      <p className={washed ? 'bt-figure is-washed' : 'bt-figure'}>
        {t('budget.range', { low: money(budget.confirmed), high: money(budget.potential) })}
      </p>
      <OnCard>{t('budget.rangeLine')}</OnCard>
      <dl className={washed ? 'bt-pairs is-washed' : 'bt-pairs'}>
        {pairs.map((one) => (
          <div key={one.label} className="bt-pair">
            <dt>{one.label}</dt>
            <dd className="bt-pair-figure">{one.figure}</dd>
            <dd className="bt-pair-sub">{one.sub}</dd>
          </div>
        ))}
      </dl>
      {step && budget.notPriced > 0 && (
        <div className="bt-card-foot bt-card-foot-stack">
          <p className="bt-card-strong">{t('budget.addPriceLine', { count: budget.notPriced })}</p>
          <CardStep label={t('budget.addPrice')} onClick={onPrice} />
        </div>
      )}
    </CoverCard>
  );
}

function FirstCard({
  event,
  budget,
  onAdd,
}: {
  event: OrganisationEvent;
  budget: EventBudget;
  onAdd: () => void;
}) {
  const { t, i18n } = useTranslation();
  const heads = budget.perHead.confirmed.heads;
  const tables = budget.quantities.per_table;
  const days = budget.quantities.per_day.count;
  const facts = listFormat(i18n.language, { type: 'conjunction' }).format([
    heads === 0 ? t('budget.knowsNoHeads') : t('budget.knowsHeads', { count: heads }),
    tables.reason === 'no_seating_plan'
      ? t('budget.knowsNoPlan')
      : t('budget.knowsTables', { count: tables.count }),
    t('budget.knowsDays', { count: days }),
  ]);
  const sentence = facts.charAt(0).toLocaleUpperCase(i18n.language) + facts.slice(1);

  return (
    <CoverCard event={event}>
      <Says>{t('budget.noCosts')}</Says>
      <OnCard>{t('budget.knows', { facts: sentence })}</OnCard>
      <div className="bt-card-foot">
        <CardStep label={t('budget.addFirst')} onClick={onAdd} />
      </div>
    </CoverCard>
  );
}

function Costs({
  budget,
  opened,
  lit,
  said,
  bar,
  onOpen,
  onClose,
  onSave,
  onSaveFailed,
  onRemove,
}: {
  budget: EventBudget;
  opened: string | null;
  lit: string | null;
  said: Said | null;
  bar: ReactNode;
  onOpen: (id: string) => void;
  onClose: (id: string) => void;
  onSave: (line: BudgetLine, typed: BudgetLineTyped) => Promise<void>;
  onSaveFailed: (line: BudgetLine) => void;
  onRemove: (line: BudgetLine) => Promise<void>;
}) {
  const { t } = useTranslation();
  const id = useId();
  const locale = dateLocale();

  return (
    <section className="desk-block bt-block" aria-labelledby={id}>
      <Head title={<span id={id}>{t('budget.costs')}</span>} />
      {bar}
      {categoriesOf(budget.lines).map((category) => (
        <div key={category} className="bt-cat">
          <div className="bt-category">
            <h3>{t(`vendors.categories.${category}`)}</h3>
          </div>
          <ul className="desk-rows bt-rows">
            {budget.lines
              .filter((one) => one.category === category)
              .map((one) => (
                <li key={one.id} data-line={one.id}>
                  {opened === one.id ? (
                    <OpenedCost
                      line={one}
                      budget={budget}
                      onCancel={() => onClose(one.id)}
                      onSave={onSave}
                      onSaveFailed={onSaveFailed}
                      onRemove={() => onRemove(one)}
                    />
                  ) : (
                    <button
                      type="button"
                      className={lit === one.id ? 'desk-row bt-row is-on' : 'desk-row bt-row'}
                      aria-label={spoken(t, one, locale)}
                      aria-expanded={false}
                      onClick={() => onOpen(one.id)}
                    >
                      <RowWords title={one.label} lines={[rowLine(t, one, locale)]} />
                      <CostEnd line={one} />
                      <Chevron />
                    </button>
                  )}
                  {said?.id === one.id && opened !== one.id && (
                    <p className={said.ok ? 'bt-said is-ok' : 'bt-said is-wrong'} role="status">
                      <Glyph name={said.ok ? 'tick' : 'clear'} size={15} weight={2.6} />
                      {said.words}
                    </p>
                  )}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/** The bar a removal leaves, with Undo: at the top of Costs, or above No costs yet once the only cost has gone. Refused, it keeps its place with a cross and takes focus itself. */
function UndoBar({
  removed,
  undoRef,
  onUndo,
}: {
  removed: Removed;
  undoRef: RefObject<HTMLButtonElement | null>;
  onUndo: () => void;
}) {
  const { t } = useTranslation();
  const bar = useRef<HTMLDivElement>(null);
  const refused = removed.gone === true;

  useEffect(() => {
    if (refused) bar.current?.focus();
  }, [refused]);

  return (
    <div ref={bar} className="bt-undo" role="status" tabIndex={refused ? -1 : undefined}>
      {refused && <Glyph name="clear" size={16} weight={2.6} />}
      <span className="bt-undo-words">{removed.words}</span>
      {!refused && (
        <button ref={undoRef} type="button" className="bt-undo-do" onClick={onUndo}>
          <Glyph name="undo" size={16} weight={2.4} />
          {t('budget.undo')}
        </button>
      )}
    </div>
  );
}

/** What a screen reader hears for a row: Rate, Quantity and Settled before each value. */
function spoken(t: TFunction, line: BudgetLine, locale: string): string {
  const state = lineState(line);
  const quantity =
    line.quantity.count === 0
      ? reasonWords(t, line.quantity.reason)
      : line.basis === 'fixed'
        ? t('budget.source.fixed')
        : `${numberFormat(locale).format(line.quantity.count)}, ${t(`budget.source.${line.quantity.source}`)}`;
  const settled =
    state === 'notPriced'
      ? t('budget.notPriced')
      : state === 'nothingYet'
        ? t('budget.notCounted')
        : wholeMoney(line.cost.confirmed, line.currency, locale);
  const rate = state === 'notPriced' ? t('budget.addPrice') : rateWords(t, line, locale);

  return [
    line.label,
    rate == null ? null : `${t('budget.rate')}: ${rate}`,
    `${t('budget.quantity')}: ${quantity}`,
    `${t('budget.settled')}: ${settled}`,
  ]
    .filter((one) => one != null)
    .join('. ');
}

function CostEnd({ line }: { line: BudgetLine }) {
  const { t } = useTranslation();
  const state = lineState(line);

  if (state === 'notPriced')
    return (
      <span className="bt-mark-word">
        <span className="bt-dashed" aria-hidden="true" />
        {t('budget.notPriced')}
      </span>
    );
  if (state === 'nothingYet')
    return (
      <span className="bt-mark-word">
        <span className="bt-open" aria-hidden="true" />
        {t('budget.notCounted')}
      </span>
    );

  return (
    <span className="bt-amount">
      {wholeMoney(line.cost.confirmed, line.currency, dateLocale())}
    </span>
  );
}

const UNIT_KEY: Partial<Record<CostBasis, string>> = {
  per_head: 'budget.unitWord.per_head',
  per_table: 'budget.unitWord.per_table',
  per_day: 'budget.unitWord.per_day',
};

function OpenedCost({
  line,
  budget,
  onCancel,
  onSave,
  onSaveFailed,
  onRemove,
}: {
  line: BudgetLine;
  budget: EventBudget;
  onCancel: () => void;
  onSave: (line: BudgetLine, typed: BudgetLineTyped) => Promise<void>;
  onSaveFailed: (line: BudgetLine) => void;
  onRemove: () => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const language = moneyLanguage(i18n.language);
  const locale = dateLocale();
  const state = lineState(line);
  const price = linePrice(line);
  const fixed = line.basis === 'fixed';
  const staff = line.basis === 'per_staff_hour';
  const [typed, setTyped] = useState(() =>
    state === 'notPriced' || price == null ? '' : typedAmount(price, language, line.currency),
  );
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const unit = UNIT_KEY[line.basis];

  useEffect(() => {
    if (staff) first.current?.focus();
    else field.current?.focus();
  }, [staff]);

  const keyed = useRef<(key: KeyboardEvent) => void>(() => undefined);
  useEffect(() => {
    keyed.current = (key) => {
      if (key.key === 'Escape') {
        key.preventDefault();
        key.stopPropagation();
        onCancel();
      } else if (key.key === 'Enter' && key.target instanceof HTMLInputElement) {
        key.preventDefault();
        void save();
      }
    };
  });

  useEffect(() => {
    const node = box.current;
    if (node == null) return;
    const keys = (key: KeyboardEvent) => keyed.current(key);
    node.addEventListener('keydown', keys);

    return () => node.removeEventListener('keydown', keys);
  }, []);

  const check = (text: string): string | null => {
    const found = priceProblem(text, language, line.currency);

    return found == null ? null : priceProblemWords(t, found, fixed, language, line.currency);
  };

  async function save(): Promise<void> {
    if (busy || staff) return;
    const found = check(typed);
    setProblem(found);
    if (found != null) {
      field.current?.focus();
      return;
    }
    const sent = sentPrice(typed, language, line.currency) ?? '';
    setBusy(true);
    try {
      await onSave(line, {
        label: line.label,
        category: line.category,
        basis: line.basis,
        ...(fixed ? { amount: sent } : { rate: sent }),
        currency: line.currency,
        ...(line.note == null ? {} : { note: line.note }),
      });
    } catch (error) {
      setBusy(false);
      const refused = error instanceof ApiError ? error.fieldErrors() : {};
      const words = refused[fixed ? 'amount' : 'rate'] ?? refused.currency;
      if (words != null) {
        setProblem(words);
        field.current?.focus();
        return;
      }
      onSaveFailed(line);
    }
  }

  const note =
    state === 'notPriced'
      ? t('budget.openedNote.notPriced')
      : line.basis === 'per_head' && line.quantity.count > 0
        ? t('budget.openedNote.per_head', {
            quantity: numberFormat(locale).format(line.quantity.count),
            ifAll: numberFormat(locale).format(budget.perHead.potential.heads),
          })
        : fixed
          ? t('budget.openedNote.fixed')
          : rowLine(t, line, locale);

  return (
    <div className="bt-opened">
      <div className="bt-opened-in" ref={box} role="group" aria-label={line.label}>
        <p className="bt-opened-name">{line.label}</p>
        {!staff && (
          <MoneyField
            label={
              fixed || state === 'notPriced'
                ? t('budget.amountFor', { name: line.label })
                : t('budget.rateFor', { name: line.label })
            }
            value={typed}
            sign={currencySign(line.currency, locale)}
            {...(fixed || state === 'notPriced' || unit == null ? {} : { unit: t(unit) })}
            error={problem}
            inputRef={field}
            onChange={(value) => {
              setTyped(value);
              if (problem != null) setProblem(check(value));
            }}
          />
        )}
        <p className="desk-note">{note}</p>
        <div className="bt-opened-actions">
          <button ref={first} type="button" className="desk-text" onClick={onCancel}>
            {t('budget.cancel')}
          </button>
          {!staff && (
            <button
              type="button"
              className={busy ? 'desk-text is-off' : 'desk-text'}
              aria-disabled={busy}
              onClick={() => void save()}
            >
              {busy ? t('budget.saving') : t('budget.save')}
            </button>
          )}
          <TextAction label={t('budget.remove')} red onClick={() => void onRemove()} />
        </div>
      </div>
    </div>
  );
}

function MoneyField({
  label,
  value,
  onChange,
  sign,
  unit,
  error,
  inputRef,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  sign: string;
  unit?: string;
  error?: string | null;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const id = useId();
  const told = [unit == null ? null : `${id}-unit`, error == null ? null : `${id}-error`]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="desk-field bt-money">
      <label htmlFor={id} className="desk-label">
        {label}
      </label>
      <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
        <span className="bt-symbol" aria-hidden="true">
          {sign}
        </span>
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          spellCheck={false}
          aria-invalid={error != null}
          aria-describedby={told === '' ? undefined : told}
          onChange={(event) => onChange(event.target.value)}
        />
        {unit != null && (
          <span id={`${id}-unit`} className="bt-unit">
            {unit}
          </span>
        )}
      </div>
      {error != null && (
        <p id={`${id}-error`} className="desk-error">
          <Glyph name="alert" size={15} weight={2.2} />
          {error}
        </p>
      )}
    </div>
  );
}

type FormField = 'what' | 'category' | 'note' | 'basis' | 'rate';

const SERVER_FIELD: Record<string, FormField> = {
  label: 'what',
  category: 'category',
  note: 'note',
  basis: 'basis',
  rate: 'rate',
  amount: 'rate',
  currency: 'rate',
};

/** Add a cost (sc-85, decided 6 Nov): the basis before the rate, each basis with what it counts today, so nobody types a quantity. */
function AddCostDialog({
  eventId,
  budget,
  onDismiss,
  onAdded,
}: {
  eventId: string;
  budget: EventBudget;
  onDismiss: () => void;
  onAdded: () => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const language = moneyLanguage(i18n.language);
  const locale = dateLocale();
  const currency = budget.currency;
  const [what, setWhat] = useState('');
  const [category, setCategory] = useState<VendorCategory | ''>('');
  const [note, setNote] = useState('');
  const [basis, setBasis] = useState<CostBasis | null>(null);
  const [rate, setRate] = useState('');
  const [tried, setTried] = useState(false);
  const [server, setServer] = useState<Partial<Record<FormField, string>>>({});
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const whatRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLSelectElement>(null);
  const noteRef = useRef<HTMLInputElement>(null);
  const basisRef = useRef<HTMLInputElement>(null);
  const rateRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const taken = budget.lines.some((one) => one.basis === 'per_staff_hour');
  const fixed = basis === 'fixed';
  const priced = basis != null && basis !== 'per_staff_hour';
  const rateFound = priced ? priceProblem(rate, language, currency) : null;
  const problems: Record<FormField, string | null> = {
    what:
      what.trim() === ''
        ? t('budget.form.whatBlank')
        : characters(what) > WHAT_MAX
          ? t('budget.form.whatLong', { max: WHAT_MAX })
          : null,
    category: category === '' ? t('budget.form.categoryBlank') : null,
    note: characters(note) > NOTE_MAX ? t('budget.form.noteLong', { max: NOTE_MAX }) : null,
    basis: basis == null ? t('budget.form.basisBlank') : null,
    rate: rateFound == null ? null : priceProblemWords(t, rateFound, fixed, language, currency),
  };
  const shown: Record<FormField, string | null> = {
    what: (tried ? problems.what : null) ?? server.what ?? null,
    category: (tried ? problems.category : null) ?? server.category ?? null,
    note: (tried ? problems.note : null) ?? server.note ?? null,
    basis: (tried ? problems.basis : null) ?? server.basis ?? null,
    rate: (tried ? problems.rate : null) ?? server.rate ?? null,
  };
  const count = Object.values(tried ? problems : {}).filter((one) => one != null).length;
  const order: readonly [FormField, RefObject<HTMLElement | null>][] = [
    ['what', whatRef],
    ['category', categoryRef],
    ['note', noteRef],
    ['basis', basisRef],
    ['rate', rateRef],
  ];

  async function add(): Promise<void> {
    if (busy) return;
    setTried(true);
    setServer({});
    setFailed(false);
    const firstWrong = order.find(([key]) => problems[key] != null);
    if (firstWrong != null) {
      firstWrong[1].current?.focus();
      return;
    }
    const price = priced ? (sentPrice(rate, language, currency) ?? '') : null;
    setBusy(true);
    try {
      await api.addBudgetLine(eventId, {
        label: what.trim(),
        category,
        basis: basis ?? '',
        ...(price == null ? {} : fixed ? { amount: price, currency } : { rate: price, currency }),
        ...(note.trim() === '' ? {} : { note: note.trim() }),
      });
    } catch (error) {
      setBusy(false);
      const refused = error instanceof ApiError ? error.fieldErrors() : {};
      const marked: Partial<Record<FormField, string>> = {};
      for (const [path, words] of Object.entries(refused)) {
        const key = SERVER_FIELD[path];
        if (key != null) marked[key] ??= words;
      }
      if (Object.keys(marked).length === 0) {
        setFailed(true);
        return;
      }
      setTried(false);
      setServer(marked);
      order.find(([key]) => marked[key] != null)?.[1].current?.focus();
      return;
    }
    await onAdded();
  }

  return (
    <Dialog
      title={t('budget.form.title')}
      verb={busy ? t('budget.form.adding') : t('budget.form.add')}
      locked={busy}
      first={whatRef}
      onDismiss={onDismiss}
      onConfirm={() => void add()}
    >
      <span className="bt-width" hidden />
      {count > 0 && (
        <p className="desk-error" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {t('budget.form.fieldsWrong', { count })}
        </p>
      )}
      {failed && (
        <div className="bt-alert" role="alert">
          <Glyph name="alert" size={16} weight={2.3} />
          <p>{t('budget.form.failed')}</p>
        </div>
      )}
      <div className="bt-two">
        <div className="bt-two-left">
          <Field
            label={t('budget.form.what')}
            value={what}
            onChange={setWhat}
            error={shown.what}
            inputRef={whatRef}
          />
          <div className="desk-field">
            <label htmlFor={`${id}-cat`} className="desk-label">
              {t('budget.form.category')}
            </label>
            <div className={shown.category == null ? 'desk-box' : 'desk-box is-wrong'}>
              <select
                ref={categoryRef}
                id={`${id}-cat`}
                className="bt-select"
                value={category}
                aria-invalid={shown.category != null}
                aria-describedby={shown.category == null ? undefined : `${id}-cat-error`}
                onChange={(change) => setCategory(change.target.value as VendorCategory)}
              >
                <option value="">{t('budget.form.chooseCategory')}</option>
                {VENDOR_CATEGORIES.map((one) => (
                  <option key={one} value={one}>
                    {t(`vendors.categories.${one}`)}
                  </option>
                ))}
              </select>
            </div>
            {shown.category != null && (
              <p id={`${id}-cat-error`} className="desk-error">
                <Glyph name="alert" size={15} weight={2.2} />
                {shown.category}
              </p>
            )}
          </div>
          <Field
            label={t('budget.form.note')}
            value={note}
            onChange={setNote}
            error={shown.note}
            inputRef={noteRef}
          />
        </div>
        <fieldset
          className="bt-two-right bt-bases"
          aria-describedby={shown.basis == null ? undefined : `${id}-basis-error`}
        >
          <legend className="desk-label">{t('budget.form.basis')}</legend>
          <ul className="desk-rows">
            {COST_BASES.map((one, index) => {
              const off = taken && one === 'per_staff_hour';

              return (
                <li key={one}>
                  <label className={basis === one ? 'desk-row is-picked' : 'desk-row'}>
                    <input
                      ref={index === 0 ? basisRef : undefined}
                      type="radio"
                      className="desk-radio"
                      name={`${id}-basis`}
                      checked={basis === one}
                      disabled={off}
                      onChange={() => {
                        setBasis(one);
                        setServer(({ basis: _basis, rate: _rate, ...rest }) => rest);
                      }}
                    />
                    <RowWords
                      title={t(`budget.basis.${one}`)}
                      lines={[
                        off ? t('budget.form.staffTaken') : basisLine(t, budget, one, locale),
                      ]}
                    />
                  </label>
                </li>
              );
            })}
          </ul>
          {shown.basis != null && (
            <p
              id={`${id}-basis-error`}
              className="desk-error"
              {...(server.basis == null ? {} : { role: 'alert' })}
            >
              <Glyph name="alert" size={15} weight={2.2} />
              {shown.basis}
            </p>
          )}
          {priced && (
            <MoneyField
              label={fixed ? t('budget.form.amount') : t('budget.form.rate')}
              value={rate}
              sign={currencySign(currency, locale)}
              {...(UNIT_KEY[basis] == null ? {} : { unit: t(UNIT_KEY[basis]) })}
              error={shown.rate}
              inputRef={rateRef}
              onChange={setRate}
            />
          )}
        </fieldset>
      </div>
    </Dialog>
  );
}
