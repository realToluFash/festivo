import {
  ApiError,
  type EventPayers,
  type OrganisationEvent,
  type Payer,
  type PayerLine,
  type RealtimeSubscription,
  type SplitTyped,
  realtimeTopic,
} from '@soirely/api-client';
import { listFormat, moneyLanguage, typedAmount } from '@soirely/domain';
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
import { Link } from 'react-router';

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
  TextAction,
} from '../../../components/SettingsParts.tsx';
import { useDeskTop } from '../../../deskTop.ts';
import { dateLocale } from '../../../i18n/index.ts';
import { LayersContext, useDeskLayers } from '../../../layers.ts';
import { offButton } from '../../../offButton.ts';
import { useOwnOfflineNotice } from '../../../offline.ts';
import { pageTitle, usePageTitle } from '../../../pageTitle.ts';
import { canOn } from '../../../session.ts';
import { useAnsweredAgain } from '../../../tabKept.ts';
import { LiveLine, Loading, NotLive } from './BudgetArea.tsx';
import { WASH_MS, currencySign, minorMoney, wholeMoney } from './budgetArea.ts';
import { MoneyField } from './BudgetParts.tsx';
import {
  type ChooseStart,
  type Mode,
  PAYER_CAP,
  type PayersSource,
  PERCENT_TYPED,
  checkFixed,
  checkPercents,
  choicesFor,
  coveredBy,
  fixedForm,
  flagWords,
  fromMinor,
  howWords,
  inBudgetOrder,
  moneyRange,
  movedShare,
  nameProblem,
  noteProblem,
  openFirst,
  percentProblem,
  withHeld,
  percentText,
  splitWords,
} from './payersArea.ts';
import { Amount, Block, CoverCard, Rows } from './QuoteParts.tsx';
import { budgetPath, payersPath } from './quotesArea.ts';
import { useHubTopics } from './useHubTopics.ts';
import '../../../components/SettingsParts.css';
import '../../../components/eventsDesk.css';
import '../../../components/eventPage.css';
import './budget.css';
import './payers.css';

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; payers: EventPayers };

export type PayersNotice =
  | { kind: 'cap' }
  | { kind: 'refused'; name: string; lineIds: string[]; count: number }
  | { kind: 'removed'; id: string; name: string }
  | { kind: 'notBack'; words: string };

export interface PayerForm {
  id: string | null;
  name: string;
  note: string;
  error: string | null;
  noteError: string | null;
  busy: boolean;
  failed: string | null;
}

/** Where the screen opens: the demo's states start part way through. */
export interface PayersStart {
  open?: string | null;
  notice?: PayersNotice | null;
  form?: Pick<PayerForm, 'id' | 'name' | 'note' | 'error' | 'noteError'> | null;
  choosing?: ChooseStart | null;
  live?: string | null;
  washed?: readonly string[];
}

/** What surrounds the screen: the crumb, the page and the layer a dialog opens on. */
export interface PayersFrame {
  choosing: boolean;
  back: () => void;
  body: ReactNode;
  dialog: ReactNode;
}

/** A part of the payer's row and pane another story adds: the demo's Send (sc-1300). */
export interface PayersExtra {
  rowLine?: (payer: Payer) => string | null;
  renderPane?: (payer: Payer) => ReactNode;
}

const failedWords = (error: unknown, fallback: string): string =>
  error instanceof ApiError && error.problem.detail != null && error.status !== 0
    ? error.problem.detail
    : fallback;

const NO_TOPICS: readonly string[] = [];

/** Budget's way into Who is paying, in its right column (sc-91), as Budget A's demo draws it. */
export function WhoIsPaying({ payers, to }: { payers: EventPayers | null; to: string }) {
  const { t } = useTranslation();
  const locale = dateLocale();

  if (payers != null && payers.payers.length === 0)
    return (
      <Block title={t('payers.title')}>
        <p className="desk-line">{t('payers.noPayers')}</p>
        <Link className="desk-text" to={to}>
          <Glyph name="plus" size={17} weight={2.3} />
          {t('payers.addAPayer')}
        </Link>
      </Block>
    );

  const none =
    payers == null
      ? null
      : Number(payers.noPayer.confirmed) === Number(payers.noPayer.potential)
        ? wholeMoney(payers.noPayer.confirmed, payers.currency, locale)
        : t('budget.range', {
            low: wholeMoney(payers.noPayer.confirmed, payers.currency, locale),
            high: wholeMoney(payers.noPayer.potential, payers.currency, locale),
          });

  return (
    <Block title={t('payers.title')}>
      <Rows>
        <li>
          <Link className="desk-row bt-row" to={to}>
            <RowWords
              title={t('payers.title')}
              lines={
                payers == null
                  ? []
                  : [
                      payers.noPayer.costs === 0
                        ? t('payers.homeCovered', { count: payers.payers.length })
                        : t('payers.homeLine', { count: payers.payers.length, amount: none }),
                    ]
              }
            />
            <Chevron />
          </Link>
        </li>
      </Rows>
    </Block>
  );
}

/** Who is paying at a desk (sc-91), on the API. */
export function PayersArea({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();
  const desk = useDeskTop();
  const { layers, covered, setHost } = useDeskLayers();
  const stale = useOwnOfflineNotice();
  const answeredAgain = useAnsweredAgain();
  const home = budgetPath(event.id);
  const source = useMemo(
    (): PayersSource => ({
      read: () => api.payers(event.id),
      add: (typed) => api.addPayer(event.id, typed),
      change: (id, typed) => api.changePayer(event.id, id, typed),
      remove: (id) => api.removePayer(event.id, id),
      putBack: (id) => api.putBackPayer(event.id, id),
      choose: (lineIds, split, currency) => api.choosePayers(event.id, lineIds, split, currency),
    }),
    [event.id],
  );
  const topics = useMemo(
    () => [
      realtimeTopic('EventBudget', event.id),
      realtimeTopic('EventHeadcount', event.id),
      realtimeTopic('EventQuotes', event.id),
      realtimeTopic('EventCheckIn', event.id),
    ],
    [event.id],
  );

  return (
    <PayersScreen
      source={source}
      writes={canOn(event, 'budget.manage')}
      home={home}
      titleTail={[t('budget.title'), event.name]}
      offline={stale}
      again={answeredAgain}
      topics={topics}
      subscribe={() => api.budgetSubscription(event.id)}
      renderCard={(label, children) => (
        <CoverCard event={event} label={label}>
          {children}
        </CoverCard>
      )}
      renderFrame={({ choosing, back, body, dialog }) => (
        <LayersContext value={layers}>
          <div className="desk ev desk-page ev-page bt">
            <div className="ev-wide bt-page" inert={covered}>
              <div className="ev-crumb-row">
                <nav className="ev-crumb" aria-label={t('budget.crumb')}>
                  <ol>
                    <li className="ev-crumb-part">
                      <Link to="/app/events">{t('budget.events')}</Link>
                    </li>
                    <li className="ev-crumb-part">
                      <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                      <Link
                        className="ev-crumb-name"
                        to={`/app/events/${encodeURIComponent(event.id)}`}
                      >
                        {event.name}
                      </Link>
                    </li>
                    <li className="ev-crumb-part">
                      <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                      <Link className="ev-crumb-name" to={home}>
                        {t('budget.title')}
                      </Link>
                    </li>
                    {choosing ? (
                      <>
                        <li className="ev-crumb-part">
                          <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                          <Link className="ev-crumb-name" to={payersPath(event.id)} onClick={back}>
                            {t('payers.title')}
                          </Link>
                        </li>
                        <li className="ev-crumb-part" aria-current="page">
                          <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                          <span className="ev-crumb-name">{t('payers.chooseTitle')}</span>
                        </li>
                      </>
                    ) : (
                      <li className="ev-crumb-part" aria-current="page">
                        <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                        <span className="ev-crumb-name">{t('payers.title')}</span>
                      </li>
                    )}
                  </ol>
                </nav>
                {desk.bell}
              </div>
              {body}
            </div>
            {dialog}
            <div ref={setHost} className="desk-layers" />
          </div>
        </LayersContext>
      )}
    />
  );
}

/** Who is paying (sc-91), as Budget A's demo draws it: the card, a row per payer, the payer's pane, and Choose who pays as a page of its own. The product reads it from the API and the demo from its sample data, through `source`. */
export function PayersScreen({
  source,
  writes,
  home,
  titleTail,
  renderCard,
  renderFrame,
  start = {},
  offline = null,
  again = 0,
  topics = NO_TOPICS,
  subscribe = () => Promise.reject(new Error('not live')),
  extra = {},
}: {
  source: PayersSource;
  writes: boolean;
  home: string;
  titleTail: readonly string[];
  renderCard: (label: string, children: ReactNode) => ReactNode;
  renderFrame: (parts: PayersFrame) => ReactNode;
  start?: PayersStart;
  offline?: { at: Date; retry: () => void } | null;
  again?: number;
  topics?: readonly string[];
  subscribe?: () => Promise<RealtimeSubscription>;
  extra?: PayersExtra;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [openId, setOpenId] = useState<string | null>(start.open ?? null);
  const [notice, setNotice] = useState<PayersNotice | null>(start.notice ?? null);
  const [said, setSaid] = useState(0);
  const [form, setForm] = useState<PayerForm | null>(
    start.form == null ? null : { ...start.form, busy: false, failed: null },
  );
  const [choosing, setChoosing] = useState<ChooseStart | null>(start.choosing ?? null);
  const [live, setLive] = useState<string | null>(start.live ?? null);
  const [washed, setWashed] = useState<readonly string[]>(start.washed ?? []);
  const [heard, setHeard] = useState('');
  const [toTitle, setToTitle] = useState(0);
  const title = useRef<HTMLHeadingElement>(null);
  const shown = useRef<EventPayers | null>(null);
  const own = useRef(0);

  usePageTitle(
    pageTitle(t, [choosing == null ? t('payers.title') : t('payers.chooseTitle'), ...titleTail]),
  );

  useEffect(() => {
    if (toTitle > 0) title.current?.focus();
  }, [toTitle]);

  const adopt = useCallback((payers: EventPayers) => {
    shown.current = payers;
    setLoad({ kind: 'loaded', payers });
  }, []);

  useEffect(() => {
    let current = true;

    source.read().then(
      (payers) => current && adopt(payers),
      () => current && setLoad((was) => (was.kind === 'loaded' ? was : { kind: 'failed' })),
    );

    return () => {
      current = false;
    };
  }, [adopt, source, attempt, again]);

  /** The reader's own change, read back: never announced as another tab's. */
  const readOwn = useCallback(async (): Promise<EventPayers | null> => {
    own.current += 1;
    try {
      const payers = await source.read();
      adopt(payers);

      return payers;
    } catch {
      return null;
    } finally {
      own.current -= 1;
    }
  }, [adopt, source]);

  const readLive = useCallback(() => {
    source.read().then(
      (payers) => {
        const was = shown.current;
        const moved = was == null ? null : movedShare(was, payers);
        adopt(payers);
        if (own.current > 0 || moved == null) return;
        setWashed(moved.ids);
        setLive(
          t(moved.down ? 'payers.liveDown' : 'payers.liveUp', {
            name: moved.name,
            amount: minorMoney(fromMinor(moved.by, payers.currency), payers.currency, locale),
          }),
        );
      },
      () => undefined,
    );
  }, [adopt, source, locale, t]);

  useHubTopics(topics, subscribe, readLive, readLive);

  useEffect(() => {
    if (washed.length === 0) return;
    const timer = window.setTimeout(() => setWashed([]), WASH_MS);

    return () => window.clearTimeout(timer);
  }, [washed]);

  const payers = load.kind === 'loaded' ? load.payers : null;
  const open =
    payers == null
      ? null
      : (payers.payers.find((one) => one.id === openId) ??
        payers.payers.find((one) => one.id === openFirst(payers.payers, null)) ??
        null);
  const rowLines = (one: Payer): string[] => {
    const line = [one.note, extra.rowLine?.(one)].filter((part) => part != null && part !== '');

    return line.length === 0 ? [] : [line.join(' · ')];
  };

  const moved = () => setToTitle((n) => n + 1);

  function choose(next: ChooseStart): void {
    setNotice(null);
    setLive(null);
    setWashed([]);
    setChoosing(next);
    moved();
  }

  function addPressed(): void {
    if (payers != null && payers.payers.length >= PAYER_CAP) {
      setNotice({ kind: 'cap' });
      setSaid((n) => n + 1);

      return;
    }
    setForm({
      id: null,
      name: '',
      note: '',
      error: null,
      noteError: null,
      busy: false,
      failed: null,
    });
  }

  async function confirmForm(
    name: RefObject<HTMLInputElement | null>,
    note: RefObject<HTMLInputElement | null>,
  ): Promise<void> {
    if (form == null || form.busy || payers == null) return;
    const problem = nameProblem(t, form.name, payers.payers, form.id, locale);
    const noteError = noteProblem(t, form.note);
    if (problem != null || noteError != null) {
      setForm({ ...form, error: problem, noteError, failed: null });
      (problem != null ? name : note).current?.focus();

      return;
    }
    setForm({ ...form, busy: true, failed: null });
    const typed = {
      name: form.name.trim(),
      note: form.note.trim() === '' ? null : form.note.trim(),
    };
    try {
      const saved = form.id == null ? await source.add(typed) : await source.change(form.id, typed);
      setLive(null);
      setWashed([]);
      setNotice(null);
      await readOwn();
      if (form.id == null) setOpenId(saved.id);
      setForm(null);
      setHeard(t('budget.saved'));
    } catch (error) {
      if (error instanceof ApiError && error.is('payer_limit')) {
        setForm(null);
        setNotice({ kind: 'cap' });
        setSaid((n) => n + 1);

        return;
      }
      const fields = error instanceof ApiError ? error.fieldErrors() : {};
      if (fields.name != null || fields.note != null) {
        setForm({
          ...form,
          busy: false,
          error: fields.name ?? null,
          noteError: fields.note ?? null,
        });
        (fields.name != null ? name : note).current?.focus();

        return;
      }
      setForm({ ...form, busy: false, failed: failedWords(error, t('budget.form.failed')) });
    }
  }

  async function removePressed(payer: Payer): Promise<void> {
    if (payers == null) return;
    const covers = coveredBy(payers, payer.id);
    if (covers.length > 0) {
      setNotice({ kind: 'refused', name: payer.name, lineIds: covers, count: covers.length });
      setSaid((n) => n + 1);

      return;
    }
    try {
      await source.remove(payer.id);
    } catch (error) {
      if (error instanceof ApiError && error.is('payer_covers_costs')) {
        const lineIds = error.problem.lineIds ?? [];
        setNotice({
          kind: 'refused',
          name: payer.name,
          lineIds,
          count: error.problem.count ?? lineIds.length,
        });
        setSaid((n) => n + 1);
        void readOwn();

        return;
      }
      setNotice({ kind: 'notBack', words: failedWords(error, t('budget.notRemoved')) });

      return;
    }
    setLive(null);
    setWashed([]);
    const now = await readOwn();
    setNotice({ kind: 'removed', id: payer.id, name: payer.name });
    setOpenId(now == null ? null : openFirst(now.payers, null));
    moved();
  }

  async function undo(id: string, name: string): Promise<void> {
    try {
      await source.putBack(id);
    } catch (error) {
      if (error instanceof ApiError && error.is('payer_limit')) {
        setNotice({ kind: 'cap' });
        setSaid((n) => n + 1);

        return;
      }
      const gone = error instanceof ApiError && error.status === 404;
      const field = error instanceof ApiError ? error.fieldErrors().name : undefined;
      setNotice({
        kind: 'notBack',
        words: gone ? t('payers.notBackGone') : (field ?? t('budget.notBack')),
      });

      return;
    }
    await readOwn();
    setNotice(null);
    setOpenId(id);
    setHeard(t('payers.back', { name }));
    moved();
  }

  const retry = () => {
    setLoad((was) => (was.kind === 'failed' ? { kind: 'loading' } : was));
    setAttempt((n) => n + 1);
  };

  const columns = (open: Payer, costs: boolean) =>
    payers != null && (
      <div className="ev-columns">
        <div className="ev-left">
          {costs && (
            <PayersCard
              renderCard={renderCard}
              payers={payers}
              step={offline == null && writes}
              onNext={(id) => choose({ ticked: [id], mode: 'one' })}
            />
          )}
          <Rows>
            {payers.payers.map((one) => (
              <li key={one.id}>
                <button
                  type="button"
                  className={[
                    'desk-row bt-row',
                    one.id === open.id && 'is-on',
                    washed.includes(one.id) && 'is-washed',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-expanded={one.id === open.id}
                  onClick={() => setOpenId(one.id)}
                >
                  <RowWords title={one.name} lines={rowLines(one)} />
                  {costs && (
                    <Amount
                      value={moneyRange(
                        t,
                        one.share.confirmed,
                        one.share.potential,
                        payers.currency,
                        locale,
                      )}
                    />
                  )}
                  <Chevron />
                </button>
              </li>
            ))}
          </Rows>
        </div>
        <div className="ev-right">
          <PayerPane
            payers={payers}
            payer={open}
            costs={costs}
            writes={writes}
            washed={washed.includes(open.id)}
            extra={extra.renderPane?.(open)}
            onEdit={() =>
              setForm({
                id: open.id,
                name: open.name,
                note: open.note ?? '',
                error: null,
                noteError: null,
                busy: false,
                failed: null,
              })
            }
            onRemove={() => void removePressed(open)}
          />
        </div>
      </div>
    );

  let body: ReactNode;
  if (choosing != null && payers != null)
    body = (
      <ChooseWhoPays
        source={source}
        payers={payers}
        start={choosing}
        titleRef={title}
        onRaced={() => void readOwn()}
        onDone={(next) => {
          adopt(next);
          setChoosing(null);
          setHeard(t('budget.saved'));
          moved();
        }}
        onAdd={() => {
          setChoosing(null);
          addPressed();
        }}
      />
    );
  else
    body = (
      <>
        <div className="bt-title-row">
          <h1 ref={title} className="bt-title" tabIndex={-1}>
            {t('payers.title')}
          </h1>
          {payers != null && writes && (
            <div className="bt-title-actions">
              <TextAction label={t('payers.addAPayer')} before="plus" onClick={addPressed} />
              {payers.lines.length > 0 && payers.payers.length > 0 && (
                <TextAction
                  label={t('payers.chooseWhoPays')}
                  onClick={() => choose({ ticked: [], mode: 'one' })}
                />
              )}
            </div>
          )}
        </div>
        {load.kind === 'loading' && <Loading words={t('payers.loading')} />}
        {load.kind === 'failed' && (
          <>
            <p className="desk-line is-ink">{t('budget.failed')}</p>
            <TextAction label={t('budget.tryAgain')} onClick={retry} />
          </>
        )}
        {payers != null && (
          <>
            {live != null && offline == null && <LiveLine words={live} />}
            {offline != null && <NotLive at={offline.at} onTry={offline.retry} />}
            {notice?.kind === 'cap' && (
              <p key={said} className="desk-error py-alert" role="alert">
                <Glyph name="alert" size={15} weight={2.2} />
                {t('payers.cap')}
              </p>
            )}
            {notice?.kind === 'refused' && (
              <div key={said} className="py-refused">
                <div className="bt-alert" role="alert">
                  <Glyph name="alert" size={16} weight={2.3} />
                  <p>{t('payers.coversCosts', { name: notice.name, count: notice.count })}</p>
                </div>
                <TextAction
                  label={t('payers.chooseWhoPays')}
                  onClick={() => choose({ ticked: notice.lineIds, mode: 'one' })}
                />
              </div>
            )}
            {notice?.kind === 'removed' && (
              <div className="bt-undo" role="status">
                <span className="bt-undo-words">{t('payers.removed', { name: notice.name })}</span>
                <button
                  type="button"
                  className="bt-undo-do"
                  onClick={() => void undo(notice.id, notice.name)}
                >
                  <Glyph name="undo" size={16} weight={2.4} />
                  {t('budget.undo')}
                </button>
              </div>
            )}
            {notice?.kind === 'notBack' && (
              <div className="bt-undo" role="status">
                <Glyph name="clear" size={16} weight={2.6} />
                <span className="bt-undo-words">{notice.words}</span>
              </div>
            )}
            {inBudgetOrder(payers.lines)
              .filter((line) => line.flagged)
              .map((line) => (
                <Flag
                  key={line.id}
                  payers={payers}
                  line={line}
                  onChange={() =>
                    choose({
                      ticked: [line.id],
                      mode: 'fixed',
                      ...fixedForm(line, payers.currency, (amount) =>
                        typedAmount(amount, moneyLanguage(locale), payers.currency),
                      ),
                      checked: true,
                    })
                  }
                />
              ))}
            {payers.lines.length === 0 ? (
              <>
                <p className="py-empty">{t('payers.noCosts')}</p>
                <Link className="desk-text" to={home}>
                  <Glyph name="back" size={17} weight={2.3} />
                  {t('budget.title')}
                </Link>
                {open != null ? (
                  columns(open, false)
                ) : (
                  <>
                    <p className="py-empty">{t('payers.noPayers')}</p>
                    {writes && (
                      <TextAction
                        label={t('payers.addAPayer')}
                        before="plus"
                        onClick={addPressed}
                      />
                    )}
                  </>
                )}
              </>
            ) : open == null ? (
              <>
                <p className="py-empty">{t('payers.noPayers')}</p>
                {writes && (
                  <TextAction label={t('payers.addAPayer')} before="plus" onClick={addPressed} />
                )}
              </>
            ) : (
              columns(open, true)
            )}
          </>
        )}
      </>
    );

  return renderFrame({
    choosing: choosing != null,
    back: () => {
      setChoosing(null);
      moved();
    },
    body: (
      <>
        <div aria-live="polite" aria-atomic="true" className="visually-hidden">
          {heard}
        </div>
        {body}
      </>
    ),
    dialog:
      form == null ? null : (
        <PayerDialog
          form={form}
          onChange={setForm}
          onDismiss={() => setForm(null)}
          onConfirm={(name, note) => void confirmForm(name, note)}
        />
      ),
  });
}

function PayersCard({
  renderCard,
  payers,
  step,
  onNext,
}: {
  renderCard: (label: string, children: ReactNode) => ReactNode;
  payers: EventPayers;
  step: boolean;
  onNext: (id: string) => void;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const range = (low: string, high: string) =>
    Number(low) === Number(high)
      ? wholeMoney(low, payers.currency, locale)
      : t('budget.range', {
          low: wholeMoney(low, payers.currency, locale),
          high: wholeMoney(high, payers.currency, locale),
        });
  const total = range(payers.total.confirmed, payers.total.potential);

  return renderCard(
    t('payers.hasAPayer'),
    <>
      <ul className="desk-glass-tags glass-wraps">
        <li className="desk-glass">{t('payers.count', { count: payers.payers.length })}</li>
      </ul>
      <p className="bt-head">{t('payers.hasAPayer')}</p>
      <p className="bt-figure">{range(payers.hasPayer.confirmed, payers.hasPayer.potential)}</p>
      <OnCard>
        {payers.noPayer.costs === 0
          ? t('payers.outOf', { range: total })
          : t('payers.outOfNone', {
              range: total,
              none: range(payers.noPayer.confirmed, payers.noPayer.potential),
              count: payers.noPayer.costs,
            })}
      </OnCard>
      {payers.next != null && (
        <div className="bt-card-foot bt-card-foot-stack">
          <p className="bt-card-strong">{t('payers.next', { cost: payers.next.label })}</p>
          {step && (
            <CardStep
              label={t('payers.chooseWhoPays')}
              onClick={() => payers.next != null && onNext(payers.next.id)}
            />
          )}
        </div>
      )}
    </>,
  );
}

function Flag({
  payers,
  line,
  onChange,
}: {
  payers: EventPayers;
  line: PayerLine;
  onChange: () => void;
}) {
  const { t } = useTranslation();
  const words = flagWords(t, payers, line, dateLocale());

  return (
    <div className="py-flag">
      <p className="py-flag-title">{words.title}</p>
      <p className="py-flag-line">{words.line}</p>
      <TextAction label={t('payers.changeTheAmounts')} onClick={onChange} />
    </div>
  );
}

function PayerPane({
  payers,
  payer,
  costs,
  writes,
  washed,
  extra,
  onEdit,
  onRemove,
}: {
  payers: EventPayers;
  payer: Payer;
  costs: boolean;
  writes: boolean;
  washed: boolean;
  extra: ReactNode;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const head = useId();
  const locale = dateLocale();
  const range = (low: string, high: string) => moneyRange(t, low, high, payers.currency, locale);
  const still = payer.stillToCome;
  const shownPaid = payers.paidShown && payer.paid != null && still != null;

  return (
    <section className="py-pane" aria-label={payer.name}>
      <h2 className="py-name">{payer.name}</h2>
      {payer.note != null && <p className="py-note">{payer.note}</p>}
      {costs && (
        <Rows>
          <li>
            <div className={washed ? 'desk-row bt-row is-washed' : 'desk-row bt-row'}>
              <RowWords
                title={t('payers.theirShare')}
                lines={[
                  Number(payer.share.confirmed) === Number(payer.share.potential)
                    ? t('payers.fixedShare')
                    : t('budget.rangeLine'),
                  ...(payer.notPriced > 0
                    ? [t('budget.notPricedCount', { count: payer.notPriced })]
                    : []),
                ]}
              />
              <Amount value={range(payer.share.confirmed, payer.share.potential)} />
            </div>
          </li>
          {shownPaid && (
            <>
              <li>
                <div className="desk-row bt-row">
                  <RowWords title={t('payers.paid')} />
                  <Amount value={minorMoney(payer.paid ?? '0', payers.currency, locale)} />
                </div>
              </li>
              <li>
                <div className="desk-row bt-row">
                  <RowWords title={t('payers.stillToCome')} />
                  <Amount
                    value={
                      Number(still.confirmed) === 0 && Number(still.potential) === 0
                        ? t('payers.nothingStillToCome')
                        : range(still.confirmed, still.potential)
                    }
                  />
                </div>
              </li>
            </>
          )}
        </Rows>
      )}
      {payer.covers.length > 0 && (
        <section className="desk-block" aria-labelledby={head}>
          <Head title={<span id={head}>{t('payers.covers')}</span>} level={3} />
          <Rows>
            {payer.covers.map((one) => (
              <li key={one.lineId}>
                <div className="desk-row bt-row">
                  <RowWords title={one.label} lines={[howWords(t, payers, one, locale)]} />
                  <Amount
                    value={
                      one.notPriced
                        ? t('budget.notPriced')
                        : range(one.part.confirmed, one.part.potential)
                    }
                  />
                </div>
              </li>
            ))}
          </Rows>
        </section>
      )}
      {extra}
      {writes && (
        <div className="py-actions">
          <TextAction label={t('payers.edit')} onClick={onEdit} />
          <TextAction label={t('payers.remove')} red onClick={onRemove} />
        </div>
      )}
    </section>
  );
}

function PayerDialog({
  form,
  onChange,
  onDismiss,
  onConfirm,
}: {
  form: PayerForm;
  onChange: (form: PayerForm) => void;
  onDismiss: () => void;
  onConfirm: (
    name: RefObject<HTMLInputElement | null>,
    note: RefObject<HTMLInputElement | null>,
  ) => void;
}) {
  const { t } = useTranslation();
  const name = useRef<HTMLInputElement>(null);
  const note = useRef<HTMLInputElement>(null);
  const wrong = [form.error, form.noteError].filter((one) => one != null).length;

  return (
    <Dialog
      title={form.id == null ? t('payers.addTitle') : t('payers.editTitle')}
      verb={form.busy ? t('budget.saving') : form.id == null ? t('payers.add') : t('payers.save')}
      first={form.error == null && form.noteError != null ? note : name}
      onDismiss={onDismiss}
      onConfirm={() => onConfirm(name, note)}
    >
      {wrong > 0 && (
        <p className="desk-error" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {t('budget.form.fieldsWrong', { count: wrong })}
        </p>
      )}
      {form.failed != null && (
        <p className="desk-error" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {form.failed}
        </p>
      )}
      <div className="desk-fields">
        <Field
          label={t('payers.name')}
          value={form.name}
          inputRef={name}
          error={form.error}
          autoComplete="off"
          onChange={(value) => onChange({ ...form, name: value, error: null })}
        />
        <Field
          label={t('payers.note')}
          value={form.note}
          help={t('payers.noteHelp')}
          error={form.noteError}
          inputRef={note}
          autoComplete="off"
          onChange={(value) =>
            onChange({
              ...form,
              note: value,
              noteError: form.noteError == null ? null : noteProblem(t, value),
            })
          }
        />
      </div>
    </Dialog>
  );
}

/** A refusal the server named on a field, kept until that field changes or the form is sent again. */
type Served = Readonly<Record<string, string>>;

function ChooseWhoPays({
  source,
  payers,
  start,
  titleRef,
  onRaced,
  onDone,
  onAdd,
}: {
  source: PayersSource;
  payers: EventPayers;
  start: ChooseStart;
  titleRef: RefObject<HTMLHeadingElement | null>;
  onRaced: () => void;
  onDone: (next: EventPayers) => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const language = moneyLanguage(locale);
  const currency = payers.currency;
  const [ticked, setTicked] = useState<readonly string[]>(start.ticked);
  const [mode, setMode] = useState<Mode>(start.mode);
  const [payerPicked, setPayerPicked] = useState(start.payer ?? '');
  const [percents, setPercents] = useState<Record<string, string>>({ ...start.percents });
  const [amounts, setAmounts] = useState<Record<string, string>>({ ...start.amounts });
  const [restPicked, setRestPicked] = useState(start.rest ?? '');
  const [checked, setChecked] = useState(start.checked === true);
  const [served, setServed] = useState<Served>({});
  const [stale, setStale] = useState<string | null>(start.stale ?? null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tries, setTries] = useState(start.checked === true ? 1 : 0);
  const [known, setKnown] = useState(payers.payers);
  const who = useRef<HTMLDivElement>(null);
  const radios = useId();
  const totalError = useId();

  useEffect(() => {
    if (tries > 0) who.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [tries]);

  const joined = payers.payers.filter((one) => !known.some((was) => was.id === one.id));
  if (joined.length > 0) setKnown([...known, ...joined]);

  const live = (id: string) => payers.payers.some((one) => one.id === id);
  const stillThere = (id: string) => (live(id) ? id : '');
  const payer = stillThere(payerPicked);
  const rest = stillThere(restPicked);
  const lines = inBudgetOrder(payers.lines);
  const present = ticked.filter((id) => payers.lines.some((line) => line.id === id));
  const choices = choicesFor(present.length);
  const picked = choices.includes(mode) ? mode : 'one';
  const checking = withHeld(
    payers,
    known,
    picked,
    picked === 'percent' ? percents : amounts,
    language,
  );
  const percent = checkPercents(payers, present, percents);
  const fixed = checkFixed(payers, present[0] ?? '', amounts, rest, language);
  const sending = checkPercents(checking, present, percents);
  const sentAmounts = checkFixed(checking, present[0] ?? '', amounts, rest, language).amounts;
  const fixedErrors =
    checking === payers
      ? fixed.errors
      : Object.fromEntries(
          Object.entries(fixed.errors).filter(([id]) => (amounts[id] ?? '').trim() !== ''),
        );
  const off = present.length === 0 || busy;
  const money = (minor: number) => minorMoney(fromMinor(minor, currency), currency, locale);
  const range = (low: number, high: number) =>
    moneyRange(t, fromMinor(low, currency), fromMinor(high, currency), currency, locale);
  const list = (items: string[]) => listFormat(locale, { type: 'conjunction' }).format(items);

  const taken = lines.filter((line) => present.includes(line.id) && line.split != null);
  const fixedOn = taken.filter((line) => line.split?.mode === 'fixed').map((line) => line.label);
  const replaces =
    present.length < 2 || taken.length === 0
      ? null
      : fixedOn.length === 0
        ? t('payers.replaces', { count: taken.length })
        : t('payers.replacesFixed', { count: taken.length, costs: list(fixedOn) });

  const percentFields = Object.keys(percent.fields).length > 0;
  const totalWrong =
    checked && percent.total !== 10000 && !percentFields
      ? t('payers.notHundred', { percent: percentText(percent.total, locale) })
      : (served['split.shares'] ?? null);
  const payerError =
    checked && picked === 'one' && payerPicked === ''
      ? t('payers.choosePayer')
      : (served['split.payerId'] ?? null);
  const restError =
    checked && picked === 'fixed' && restPicked === ''
      ? t('payers.chooseRest')
      : (served['split.restId'] ?? null);
  const fixedError = (id: string): string | null => {
    const problem = checked ? fixedErrors[id] : undefined;
    if (problem?.kind === 'amount')
      return t('payers.amountWrong', {
        example: typedAmount('400.50', language, currency),
      });
    if (problem?.kind === 'over')
      return t('payers.tooMuch', { sum: money(problem.sum), least: money(problem.least) });

    return served[`split.amounts.${id}`] ?? null;
  };
  const percentError = (id: string): string | null => {
    const problem = checked ? percent.fields[id] : undefined;
    if (problem === 'decimals') return t('payers.percentDecimals');
    if (problem === 'range') return t('payers.percentRange');

    return served[`split.shares.${id}`] ?? null;
  };

  async function send(split: SplitTyped | null): Promise<void> {
    setBusy(true);
    setStale(null);
    setFailed(null);
    try {
      onDone(await source.choose(present, split, currency));
    } catch (error) {
      setBusy(false);
      const violations = error instanceof ApiError ? (error.problem.violations ?? []) : [];
      const raced = violations.find(
        (one) => one.code === 'payer_removed' || one.code === 'budget_line_removed',
      );
      if (raced != null) {
        setStale(raced.message);
        setChecked(false);
        const at = (path: string) => violations.some((one) => one.propertyPath === path);
        if (split?.mode === 'one' && at('split.payerId')) setPayerPicked('');
        if (split?.mode === 'fixed' && at('split.restId')) setRestPicked('');
        const gone = violations
          .map((one) => /^split\.(?:shares|amounts)\.(.+)$/u.exec(one.propertyPath ?? '')?.[1])
          .filter((id) => id != null);
        if (gone.length > 0) {
          const forget = (typed: Record<string, string>) =>
            Object.fromEntries(Object.entries(typed).filter(([id]) => !gone.includes(id)));
          setPercents(forget);
          setAmounts(forget);
        }
        onRaced();

        return;
      }
      if (violations.length > 0) {
        const fields = (error as ApiError).fieldErrors();
        const amountsField = fields['split.amounts'];
        const firstAmount = payers.payers.find((one) => one.id !== rest)?.id;
        setServed(
          amountsField != null && firstAmount != null
            ? { ...fields, [`split.amounts.${firstAmount}`]: amountsField }
            : fields,
        );
        const general = fields.lineIds ?? fields['split.mode'] ?? fields.currency;
        if (general != null) setFailed(general);
        setTries((n) => n + 1);

        return;
      }
      setFailed(failedWords(error, t('budget.form.failed')));
    }
  }

  function save(): void {
    if (off) return;
    setServed({});
    const split: SplitTyped | null =
      picked === 'one'
        ? payerPicked === ''
          ? null
          : { mode: 'one', payerId: payerPicked }
        : picked === 'percent'
          ? percent.right || sending.right
            ? { mode: 'percent', shares: sending.shares }
            : null
          : restPicked === '' || Object.keys(fixedErrors).length > 0
            ? null
            : { mode: 'fixed', amounts: sentAmounts, restId: restPicked };
    if (split == null) {
      setChecked(true);
      setTries((n) => n + 1);

      return;
    }
    void send(split);
  }

  return (
    <>
      <div className="bt-title-row">
        <h1 ref={titleRef} className="bt-title" tabIndex={-1}>
          {t('payers.chooseTitle')}
        </h1>
      </div>
      {stale != null && (
        <div className="bt-alert" role="alert">
          <Glyph name="alert" size={16} weight={2.3} />
          <p>{stale}</p>
        </div>
      )}
      {failed != null && (
        <div className="bt-alert" role="alert">
          <Glyph name="alert" size={16} weight={2.3} />
          <p>{failed}</p>
        </div>
      )}
      <div className="py-choose">
        <section className="py-choose-side" aria-label={t('budget.costs')}>
          <TextAction
            label={t('payers.selectNoPayer')}
            onClick={() =>
              setTicked(lines.filter((line) => line.split == null).map((line) => line.id))
            }
          />
          <ul className="desk-rows">
            {lines.map((line) => (
              <li key={line.id}>
                <label className="desk-row py-pick">
                  <input
                    type="checkbox"
                    className="py-check"
                    checked={ticked.includes(line.id)}
                    onChange={() =>
                      setTicked((now) =>
                        now.includes(line.id)
                          ? now.filter((id) => id !== line.id)
                          : [...now, line.id],
                      )
                    }
                  />
                  <RowWords
                    title={line.label}
                    lines={[
                      t('payers.costLine', {
                        amount: line.notPriced
                          ? t('budget.notPriced')
                          : Number(line.cost.potential) === 0
                            ? t('budget.nothingYet')
                            : moneyRange(
                                t,
                                line.cost.confirmed,
                                line.cost.potential,
                                currency,
                                locale,
                              ),
                        split: splitWords(t, payers, line, locale),
                      }),
                    ]}
                  />
                </label>
              </li>
            ))}
          </ul>
        </section>
        <div ref={who} className="py-choose-side">
          {payers.payers.length === 0 ? (
            <TextAction label={t('payers.addAPayer')} before="plus" onClick={onAdd} />
          ) : (
            <>
              {replaces != null && (
                <p className="py-info">
                  <Glyph name="info" size={16} weight={2.2} />
                  <span>{replaces}</span>
                </p>
              )}
              <fieldset className="py-choices">
                <legend className="py-legend">{t('payers.whoPays')}</legend>
                <ul className="desk-rows">
                  {choices.map((choice) => (
                    <li key={choice}>
                      <label className="desk-row py-pick">
                        <input
                          type="radio"
                          className="desk-radio"
                          name={radios}
                          checked={choice === picked}
                          onChange={() => setMode(choice)}
                        />
                        <RowWords title={t(`payers.${choice}`)} />
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
              {picked === 'one' && (
                <PickField
                  label={t('payers.payer')}
                  value={payer}
                  payers={payers.payers}
                  error={payerError}
                  onChange={(id) => {
                    setPayerPicked(id);
                    setServed({});
                  }}
                />
              )}
              {picked === 'percent' && (
                <>
                  {payers.payers.map((one) => {
                    const part = percent.parts.get(one.id);
                    const typed = (percents[one.id] ?? '').trim();

                    return (
                      <PercentField
                        key={one.id}
                        label={t('payers.percentLabel', { name: one.name })}
                        value={percents[one.id] ?? ''}
                        help={
                          part == null ||
                          typed === '' ||
                          Number(typed.replace(',', '.')) === 0 ||
                          percentProblem(typed) != null
                            ? null
                            : range(part[0], part[1])
                        }
                        errorId={totalWrong != null ? totalError : null}
                        error={percentError(one.id)}
                        onChange={(value) => {
                          if (PERCENT_TYPED.test(value))
                            setPercents((now) => ({ ...now, [one.id]: value }));
                          setServed({});
                        }}
                      />
                    );
                  })}
                  <p className={totalWrong != null ? 'py-total is-wrong' : 'py-total'}>
                    {t('payers.total', { percent: percentText(percent.total, locale) })}
                  </p>
                  {totalWrong != null && (
                    <p id={totalError} className="desk-error py-alert">
                      <Glyph name="alert" size={15} weight={2.2} />
                      {totalWrong}
                    </p>
                  )}
                </>
              )}
              {picked === 'fixed' && (
                <>
                  {payers.payers
                    .filter((one) => one.id !== rest)
                    .map((one) => (
                      <MoneyField
                        key={one.id}
                        label={t('payers.amountLabel', { name: one.name })}
                        sign={currencySign(currency, locale)}
                        value={amounts[one.id] ?? ''}
                        error={fixedError(one.id)}
                        onChange={(value) => {
                          setAmounts((now) => ({ ...now, [one.id]: value }));
                          setServed({});
                        }}
                      />
                    ))}
                  <PickField
                    label={t('payers.whoCoversTheRest')}
                    value={rest}
                    payers={payers.payers}
                    help={t('payers.restNow', { amount: range(fixed.rest[0], fixed.rest[1]) })}
                    error={restError}
                    onChange={(id) => {
                      setRestPicked(id);
                      setServed({});
                    }}
                  />
                </>
              )}
              <div className="py-actions">
                <button
                  type="button"
                  className={off ? 'desk-text py-leave is-off' : 'desk-text py-leave'}
                  {...offButton(off, { dim: false })}
                  onClick={() => {
                    if (!off) void send(null);
                  }}
                >
                  {t('payers.leave')}
                </button>
                <button
                  type="button"
                  className={off ? 'desk-text is-off' : 'desk-text'}
                  {...offButton(off, { dim: false })}
                  onClick={save}
                >
                  {busy ? t('budget.saving') : t('payers.save')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function PickField({
  label,
  value,
  payers,
  help,
  error = null,
  onChange,
}: {
  label: string;
  value: string;
  payers: readonly Payer[];
  help?: string;
  error?: string | null;
  onChange: (id: string) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const told = [help == null ? null : `${id}-help`, error == null ? null : `${id}-error`]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="desk-field">
      <label htmlFor={id} className="desk-label">
        {label}
      </label>
      <div className={error == null ? 'desk-box ev-select' : 'desk-box ev-select is-wrong'}>
        <select
          id={id}
          value={value}
          aria-invalid={error != null}
          aria-describedby={told === '' ? undefined : told}
          onChange={(event) => onChange(event.target.value)}
        >
          {value === '' && <option value="">{t('payers.choosePayerOption')}</option>}
          {payers.map((one) => (
            <option key={one.id} value={one.id}>
              {one.name}
            </option>
          ))}
        </select>
        <Glyph name="chevdown" size={18} weight={2.3} />
      </div>
      {help != null && (
        <p id={`${id}-help`} className="desk-help">
          {help}
        </p>
      )}
      {error != null && (
        <p id={`${id}-error`} className="desk-error">
          <Glyph name="alert" size={15} weight={2.2} />
          {error}
        </p>
      )}
    </div>
  );
}

function PercentField({
  label,
  value,
  help,
  errorId,
  error = null,
  onChange,
}: {
  label: string;
  value: string;
  help: string | null;
  errorId: string | null;
  error?: string | null;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const told = [help == null ? null : `${id}-help`, errorId, error == null ? null : `${id}-error`]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="desk-field">
      <label htmlFor={id} className="desk-label">
        {label}
      </label>
      <div className={error == null ? 'desk-box' : 'desk-box is-wrong'}>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          spellCheck={false}
          aria-invalid={errorId != null || error != null}
          aria-describedby={told === '' ? undefined : told}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {help != null && (
        <p id={`${id}-help`} className="desk-help py-figure">
          {help}
        </p>
      )}
      {error != null && (
        <p id={`${id}-error`} className="desk-error">
          <Glyph name="alert" size={15} weight={2.2} />
          {error}
        </p>
      )}
    </div>
  );
}
