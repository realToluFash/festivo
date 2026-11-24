import {
  ApiError,
  type OrganisationEvent,
  type StaffHeadline,
  type StaffRate,
  type StaffRateJob,
  type StaffRateKind,
  type StaffRateTyped,
  type StaffRates,
} from '@soirely/api-client';
import { moneyLanguage } from '@soirely/domain';
import { type ReactNode, type RefObject, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { RowWords, TextAction } from '../../../components/SettingsParts.tsx';
import { useDeskTop } from '../../../deskTop.ts';
import { dateLocale } from '../../../i18n/index.ts';
import { LayersContext, useDeskLayers } from '../../../layers.ts';
import { pageTitle, usePageTitle } from '../../../pageTitle.ts';
import { canOn } from '../../../session.ts';
import { useAnsweredAgain } from '../../../tabKept.ts';
import { Loading } from './BudgetArea.tsx';
import { currencySign, minorMoney } from './budgetArea.ts';
import { MoneyField } from './BudgetParts.tsx';
import { Amount, Block, BudgetRow, Rows } from './QuoteParts.tsx';
import { budgetPath } from './quotesArea.ts';
import {
  type MineChanged,
  biggestUnrated,
  changedWords,
  figure,
  flatLine,
  headlineLine,
  hoursWords,
  insetWords,
  jobKey,
  ownInset,
  ownKey,
  ownLines,
  rateProblem,
  rateText,
  sourceLine,
  typedMinor,
  typedOf,
  unratedLine,
} from './staffRatesArea.ts';
import '../../../components/SettingsParts.css';
import '../../../components/eventsDesk.css';
import '../../../components/eventPage.css';
import './budget.css';
import './staffRates.css';

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; rates: StaffRates };

type Panel =
  { kind: 'job'; job: string } | { kind: 'own'; member: string } | { kind: 'add' } | null;

interface Draft {
  kind: StaffRateKind;
  typed: string;
  who: string;
}

const BLANK: Draft = { kind: 'hourly', typed: '', who: '' };

/** The Budget's one staff-time line (sc-101): no rate of its own, Staff rates' headline as its amount, and a way there. */
export function StaffLine({
  name,
  staff,
  currency,
  to,
}: {
  name: string;
  staff: StaffHeadline;
  currency: string;
  to: string;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const unrated = unratedLine(t, staff.unrated, locale);

  return (
    <BudgetRow
      title={name}
      lines={[
        t('staffRates.staffHours', {
          counted: hoursWords(t, staff.countedMinutes),
          scheduled: hoursWords(t, staff.scheduledMinutes),
        }),
        ...(unrated == null ? [] : [unrated]),
      ]}
      end={<Amount value={minorMoney(staff.total, currency, locale)} />}
      to={to}
      label={t('staffRates.staffLineLabel', { name })}
    />
  );
}

/** Budget / Staff rates at a desk (sc-101), as Budget-A-StaffRates draws it: the headline, each job's rate changed in place, and people on their own rate. Setting a rate needs budget.manage. */
export function StaffRatesArea({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();
  const desk = useDeskTop();
  const { layers, covered, setHost } = useDeskLayers();
  const answeredAgain = useAnsweredAgain();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const home = budgetPath(event.id);

  usePageTitle(pageTitle(t, [t('staffRates.title'), t('budget.title'), event.name]));

  useEffect(() => {
    let current = true;

    api.staffRates(event.id).then(
      (rates) => current && setLoad({ kind: 'loaded', rates }),
      () => current && setLoad((was) => (was.kind === 'loaded' ? was : { kind: 'failed' })),
    );

    return () => {
      current = false;
    };
  }, [event.id, attempt, answeredAgain]);

  return (
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
                <li className="ev-crumb-part" aria-current="page">
                  <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                  <span className="ev-crumb-name">{t('staffRates.title')}</span>
                </li>
              </ol>
            </nav>
            {desk.bell}
          </div>
          <div className="bt-title-row">
            <h1 className="bt-title" tabIndex={-1}>
              {t('staffRates.title')}
            </h1>
          </div>
          {load.kind === 'loading' && <Loading words={t('staffRates.loading')} />}
          {load.kind === 'failed' && (
            <>
              <p className="desk-line is-ink">{t('staffRates.failed')}</p>
              <TextAction
                label={t('staffRates.tryAgain')}
                onClick={() => {
                  setLoad({ kind: 'loading' });
                  setAttempt((n) => n + 1);
                }}
              />
            </>
          )}
          {load.kind === 'loaded' && (
            <StaffRatesPage
              event={event}
              rates={load.rates}
              manages={canOn(event, 'budget.manage')}
              onRates={(rates) => setLoad({ kind: 'loaded', rates })}
            />
          )}
        </div>
        <div ref={setHost} className="desk-layers" />
      </div>
    </LayersContext>
  );
}

function StaffRatesPage({
  event,
  rates,
  manages,
  onRates,
}: {
  event: OrganisationEvent;
  rates: StaffRates;
  manages: boolean;
  onRates: (rates: StaffRates) => void;
}) {
  const { t, i18n } = useTranslation();
  const language = moneyLanguage(i18n.language);
  const locale = dateLocale();
  const { currency } = rates;
  const [panel, setPanel] = useState<Panel>(null);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [pressed, setPressed] = useState(false);
  const [server, setServer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<{ key: string; words: string } | null>(null);
  const [mine, setMine] = useState<Record<string, MineChanged>>({});
  const jobRate = (id: string) => rates.jobs.find((one) => one.id === id)?.rate ?? null;
  const ownRate = (member: string) =>
    rates.own.find((one) => one.member.id === member)?.rate ?? null;

  const back = useRef<string | null>(null);
  // No dependency list: the row's button exists only once the editor has unmounted.
  useEffect(() => {
    if (back.current == null) return;
    document.querySelector<HTMLElement>(`[data-srt="${back.current}"] button`)?.focus();
    back.current = null;
  });

  const open = (next: Panel) => {
    const rate =
      next?.kind === 'job' ? jobRate(next.job) : next?.kind === 'own' ? ownRate(next.member) : null;
    setPanel(next);
    setDraft({ kind: rate?.kind ?? 'hourly', typed: typedOf(rate, language, currency), who: '' });
    setPressed(false);
    setServer(null);
    setSaid(null);
  };

  const sent = (): StaffRateTyped | null => {
    if (rateProblem(t, draft.typed, draft.kind, language, currency) != null) return null;
    const found = typedMinor(draft.typed, language, currency);

    return found == null ? null : { kind: draft.kind, amount: found.amount, currency };
  };

  /** A write, answered with the whole page; refused 403 once Manage the budget is gone. */
  const write = async (
    send: () => Promise<StaffRates>,
    key: string,
    changed: MineChanged | null,
    words: string,
    was: StaffRate | null,
  ): Promise<boolean> => {
    if (busy) return true;
    setBusy(true);
    setServer(null);
    try {
      const next = await send();
      onRates(next);
      setMine((now) => {
        if (changed != null) return { ...now, [key]: changed };
        const { [key]: _gone, ...rest } = now;

        return rest;
      });
      setPanel(null);
      setPressed(false);
      setServer(null);
      setSaid({ key, words });
      back.current = key;
    } catch (error) {
      setServer(
        error instanceof ApiError && error.status === 403
          ? t('staffRates.refused', {
              rate: was == null ? t('staffRates.noRateYet') : rateText(t, was, currency, locale),
            })
          : t('staffRates.notSaved'),
      );
    } finally {
      setBusy(false);
    }

    return true;
  };

  const saveJob = (job: StaffRateJob): boolean => {
    setPressed(true);
    const typed = sent();
    if (typed == null) return false;
    void write(
      () => api.setJobRate(event.id, job.id, typed),
      jobKey(job.id),
      { was: job.rate, removed: false },
      t('staffRates.saved', { name: job.name }),
      job.rate,
    );

    return true;
  };

  const removeJob = (job: StaffRateJob) =>
    void write(
      () => api.removeJobRate(event.id, job.id),
      jobKey(job.id),
      { was: job.rate, removed: true },
      t('staffRates.removed', { job: job.name }),
      job.rate,
    );

  const saveOwn = (member: string, name: string): boolean => {
    setPressed(true);
    const typed = sent();
    if (member === '' || typed == null) return false;
    const was = ownRate(member);
    void write(
      () => api.setOwnRate(event.id, member, typed),
      ownKey(member),
      { was, removed: false },
      t('staffRates.saved', { name }),
      was,
    );

    return true;
  };

  const backToJobRate = (member: string, name: string, job: string, jobId: string) =>
    void write(
      () => api.removeOwnRate(event.id, member),
      jobKey(jobId),
      null,
      t('staffRates.backOn', { person: name, job }),
      ownRate(member),
    );

  const close = () => {
    back.current =
      panel?.kind === 'job'
        ? jobKey(panel.job)
        : panel?.kind === 'own'
          ? ownKey(panel.member)
          : 'add';
    open(null);
  };
  const head = rates.headline;

  if (rates.jobs.length === 0)
    return (
      <>
        {!manages && <ReadOnly />}
        <section className="srt-empty" aria-labelledby="srt-empty">
          <h2 id="srt-empty">{t('staffRates.emptyTitle')}</h2>
          <p>{t('staffRates.emptyLine')}</p>
          <Link className="desk-text" to={`/app/events/${encodeURIComponent(event.id)}/staff/jobs`}>
            {t('staffRates.openStaff')}
            <Glyph name="chevron" size={16} weight={2.4} />
          </Link>
        </section>
      </>
    );

  const firstUnrated = biggestUnrated(head);
  const typedNow = typedMinor(draft.typed, language, currency);
  const typedRate =
    rateProblem(t, draft.typed, draft.kind, language, currency) == null && typedNow != null
      ? typedNow.minor
      : null;

  return (
    <>
      {!manages && <ReadOnly />}
      <section className="srt-head" aria-label={t('staffRates.title')}>
        <p className="srt-figure">{figure(head.total, currency, locale)}</p>
        <p className="srt-line">{headlineLine(t, head, locale)}</p>
      </section>
      {manages && firstUnrated != null && panel?.kind !== 'job' && (
        <div className="srt-strip">
          <span className="srt-open" aria-hidden="true" />
          <p>
            {t('staffRates.nextUp', {
              job: firstUnrated.job.name,
              hours: hoursWords(t, firstUnrated.minutes),
            })}
          </p>
          <TextAction
            label={t('staffRates.setRate', { job: firstUnrated.job.name })}
            onClick={() => open({ kind: 'job', job: firstUnrated.job.id })}
          />
        </div>
      )}
      <div className="ev-columns">
        <div className="ev-left">
          <Block title={t('staffRates.jobs')}>
            <Rows>
              {rates.jobs.map((job) => {
                const { rate } = job;
                const changed = changedWords(t, null, mine[jobKey(job.id)], currency, locale);
                const source = rate?.kind === 'flat' ? flatLine(t, job) : sourceLine(t, job);
                const rateWords =
                  rate == null ? t('staffRates.noRateYet') : rateText(t, rate, currency, locale);

                return (
                  <li key={job.id} data-srt={jobKey(job.id)}>
                    {panel?.kind === 'job' && panel.job === job.id ? (
                      <RateEditor
                        name={job.name}
                        question={t('staffRates.howPaid', { job: job.name })}
                        draft={draft}
                        pressed={pressed}
                        server={server}
                        inset={insetWords(t, job, draft.kind, typedRate, currency, locale)}
                        audit={changedWords(t, job.changed, mine[jobKey(job.id)], currency, locale)}
                        language={language}
                        currency={currency}
                        onDraft={(next) => {
                          setDraft(next);
                          setServer(null);
                        }}
                        onCancel={close}
                        onSave={() => saveJob(job)}
                        extra={
                          rate != null && (
                            <TextAction
                              label={t('staffRates.removeRate')}
                              red
                              onClick={() => removeJob(job)}
                            />
                          )
                        }
                      />
                    ) : (
                      <BudgetRow
                        title={job.name}
                        tag={rate == null ? <NoRateTag /> : undefined}
                        lines={[
                          ...(rate == null ? [] : [rateWords]),
                          source,
                          ...(changed == null ? [] : [changed]),
                        ]}
                        end={
                          job.cost == null ? (
                            <span className="bt-mark-word">
                              <span className="srt-open" aria-hidden="true" />
                              {t('staffRates.notCounted')}
                            </span>
                          ) : (
                            <Amount value={minorMoney(job.cost, currency, locale)} />
                          )
                        }
                        label={t('staffRates.rowLabel', { name: job.name, rate: rateWords })}
                        {...(manages
                          ? { open: false, onOpen: () => open({ kind: 'job', job: job.id }) }
                          : {})}
                      />
                    )}
                    {said?.key === jobKey(job.id) && <Said words={said.words} />}
                  </li>
                );
              })}
            </Rows>
            <p className="desk-note">{t('staffRates.hoursSource')}</p>
          </Block>
        </div>
        <div className="ev-right">
          <Block
            title={t('staffRates.ownRates')}
            action={
              manages && panel?.kind !== 'add' ? (
                <span data-srt="add">
                  <TextAction
                    label={t('staffRates.addOne')}
                    before="plus"
                    onClick={() => open({ kind: 'add' })}
                  />
                </span>
              ) : undefined
            }
          >
            {panel?.kind === 'add' && (
              <AddOwn
                rates={rates}
                draft={draft}
                pressed={pressed}
                server={server}
                language={language}
                onDraft={(next) => {
                  setDraft(next);
                  setServer(null);
                }}
                onCancel={close}
                onSave={() => {
                  const chosen = rates.candidates.find((one) => one.member.id === draft.who);

                  return saveOwn(draft.who, chosen?.member.name ?? '');
                }}
              />
            )}
            {rates.own.length === 0 ? (
              <p className="desk-note">{t('staffRates.noOwn')}</p>
            ) : (
              <Rows>
                {rates.own.map((own) => {
                  const key = ownKey(own.member.id);
                  const theirJob = jobRate(own.job.id);

                  return (
                    <li key={key} data-srt={key}>
                      {panel?.kind === 'own' && panel.member === own.member.id ? (
                        <RateEditor
                          name={own.member.name}
                          question={t('staffRates.howPaidPerson', { person: own.member.name })}
                          draft={draft}
                          pressed={pressed}
                          server={server}
                          inset={ownInset(t, own.minutes, draft.kind, typedRate, currency, locale)}
                          audit={changedWords(t, own.changed, mine[key], currency, locale)}
                          language={language}
                          currency={currency}
                          onDraft={(next) => {
                            setDraft(next);
                            setServer(null);
                          }}
                          onCancel={close}
                          onSave={() => saveOwn(own.member.id, own.member.name)}
                          extra={
                            <TextAction
                              label={t('staffRates.jobRateAction', { job: own.job.name })}
                              onClick={() =>
                                backToJobRate(
                                  own.member.id,
                                  own.member.name,
                                  own.job.name,
                                  own.job.id,
                                )
                              }
                            />
                          }
                        />
                      ) : (
                        <BudgetRow
                          title={own.member.name}
                          lines={ownLines(t, own, theirJob, currency, locale)}
                          end={<Amount value={minorMoney(own.cost, currency, locale)} />}
                          {...(manages
                            ? {
                                open: false,
                                onOpen: () => open({ kind: 'own', member: own.member.id }),
                              }
                            : {})}
                        />
                      )}
                      {said?.key === key && <Said words={said.words} />}
                    </li>
                  );
                })}
              </Rows>
            )}
          </Block>
          <Block title={t('staffRates.howCounted')}>
            <ul className="srt-rules">
              {(['ruleHourly', 'ruleFlat', 'ruleOpen', 'ruleUnrated'] as const).map((rule) => (
                <li key={rule}>{t(`staffRates.${rule}`)}</li>
              ))}
            </ul>
          </Block>
        </div>
      </div>
    </>
  );
}

/** Escape cancels and Enter in a field saves, as on the Budget's own editor. */
function useKeys(box: RefObject<HTMLDivElement | null>, onCancel: () => void, onSave: () => void) {
  const keyed = useRef<(event: globalThis.KeyboardEvent) => void>(() => undefined);
  useEffect(() => {
    keyed.current = (event) => {
      if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
        event.preventDefault();
        onSave();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };
  });
  useEffect(() => {
    const node = box.current;
    if (node == null) return;
    const keys = (event: globalThis.KeyboardEvent) => keyed.current(event);
    node.addEventListener('keydown', keys);

    return () => node.removeEventListener('keydown', keys);
  }, [box]);
}

function ReadOnly() {
  const { t } = useTranslation();

  return (
    <div className="srt-strip is-plain" role="status">
      <p>{t('staffRates.readOnly')}</p>
    </div>
  );
}

function NoRateTag() {
  const { t } = useTranslation();

  return (
    <span className="srt-tag">
      <span className="srt-open is-small" aria-hidden="true" />
      {t('staffRates.noRateYet')}
    </span>
  );
}

function Said({ words }: { words: string }) {
  return (
    <p className="bt-said is-ok" role="status">
      <Glyph name="tick" size={15} weight={2.6} />
      {words}
    </p>
  );
}

function KindChoice({
  question,
  kind,
  onKind,
}: {
  question: string;
  kind: StaffRateKind;
  onKind: (kind: StaffRateKind) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const kinds: readonly { kind: StaffRateKind; title: string; line: string }[] = [
    { kind: 'hourly', title: t('staffRates.byTheHour'), line: t('staffRates.byTheHourLine') },
    { kind: 'flat', title: t('staffRates.flatFee'), line: t('staffRates.flatFeeLine') },
  ];

  return (
    <fieldset className="srt-kinds">
      <legend className="desk-label">{question}</legend>
      <ul className="desk-rows">
        {kinds.map((one) => (
          <li key={one.kind}>
            <label className={kind === one.kind ? 'desk-row is-picked' : 'desk-row'}>
              <input
                type="radio"
                className="desk-radio"
                name={`${id}-kind`}
                checked={kind === one.kind}
                onChange={() => onKind(one.kind)}
              />
              <RowWords title={one.title} lines={[one.line]} />
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

function RateEditor({
  name,
  question,
  draft,
  pressed,
  server,
  inset,
  audit,
  language,
  currency,
  extra,
  onDraft,
  onCancel,
  onSave,
}: {
  name: string;
  question: string;
  draft: Draft;
  pressed: boolean;
  server: string | null;
  inset: string | null;
  audit: string | null;
  language: ReturnType<typeof moneyLanguage>;
  currency: string;
  extra?: ReactNode;
  onDraft: (draft: Draft) => void;
  onCancel: () => void;
  onSave: () => boolean;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const problem = pressed ? rateProblem(t, draft.typed, draft.kind, language, currency) : null;
  const box = useRef<HTMLDivElement>(null);
  const save = () => {
    if (!onSave()) inputRef.current?.focus();
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    if (server != null) inputRef.current?.focus();
  }, [server]);
  useKeys(box, onCancel, save);

  return (
    <div className="bt-opened">
      <div ref={box} className="bt-opened-in srt-editor" role="group" aria-label={name}>
        <p className="srt-name">{name}</p>
        <KindChoice
          question={question}
          kind={draft.kind}
          onKind={(kind) => onDraft({ ...draft, kind })}
        />
        <MoneyField
          label={
            draft.kind === 'hourly' ? t('staffRates.rateAnHour') : t('staffRates.feeEachPerson')
          }
          value={draft.typed}
          sign={currencySign(currency, dateLocale())}
          onChange={(typed) => onDraft({ ...draft, typed })}
          error={problem ?? server}
          inputRef={inputRef}
        />
        {inset != null && problem == null && server == null && (
          <p className="srt-inset" aria-live="polite">
            {inset}
          </p>
        )}
        {audit != null && <p className="desk-note">{audit}</p>}
        <div className="bt-opened-actions">
          <TextAction label={t('staffRates.cancel')} onClick={onCancel} />
          <TextAction label={t('staffRates.saveRate')} onClick={save} />
          {extra}
        </div>
      </div>
    </div>
  );
}

function AddOwn({
  rates,
  draft,
  pressed,
  server,
  language,
  onDraft,
  onCancel,
  onSave,
}: {
  rates: StaffRates;
  draft: Draft;
  pressed: boolean;
  server: string | null;
  language: ReturnType<typeof moneyLanguage>;
  onDraft: (draft: Draft) => void;
  onCancel: () => void;
  onSave: () => boolean;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const { currency } = rates;
  const id = useId();
  const whoRef = useRef<HTMLSelectElement>(null);
  const rateRef = useRef<HTMLInputElement>(null);
  const whoProblem = pressed && draft.who === '' ? t('staffRates.whoBlank') : null;
  const problem = pressed ? rateProblem(t, draft.typed, draft.kind, language, currency) : null;
  const chosen = rates.candidates.find((one) => one.member.id === draft.who) ?? null;
  const typed = typedMinor(draft.typed, language, currency);
  const checked = rateProblem(t, draft.typed, draft.kind, language, currency) == null;

  useEffect(() => {
    whoRef.current?.focus();
  }, []);
  useEffect(() => {
    if (server != null) rateRef.current?.focus();
  }, [server]);

  const save = () => {
    if (onSave()) return;
    if (draft.who === '') whoRef.current?.focus();
    else rateRef.current?.focus();
  };
  const box = useRef<HTMLDivElement>(null);
  useKeys(box, onCancel, save);

  return (
    <div className="bt-opened">
      <div ref={box} className="bt-opened-in srt-editor">
        <div className="desk-field">
          <label htmlFor={`${id}-who`} className="desk-label">
            {t('staffRates.who')}
          </label>
          <div className={whoProblem == null ? 'desk-box' : 'desk-box is-wrong'}>
            <select
              ref={whoRef}
              id={`${id}-who`}
              className="bt-select"
              value={draft.who}
              aria-invalid={whoProblem != null}
              aria-describedby={`${id}-who-help${whoProblem == null ? '' : ` ${id}-who-error`}`}
              onChange={(event) => onDraft({ ...draft, who: event.target.value })}
            >
              <option value="">{t('staffRates.chooseWho')}</option>
              {rates.candidates.map((one) => (
                <option key={one.member.id} value={one.member.id}>
                  {t('staffRates.whoOption', { person: one.member.name, job: one.job.name })}
                </option>
              ))}
            </select>
          </div>
          <p id={`${id}-who-help`} className="desk-help">
            {t('staffRates.whoHelp')}
          </p>
          {whoProblem != null && (
            <p id={`${id}-who-error`} className="desk-error">
              <Glyph name="alert" size={15} weight={2.2} />
              {whoProblem}
            </p>
          )}
        </div>
        <KindChoice
          question={
            chosen == null
              ? t('staffRates.howTheyPaid')
              : t('staffRates.howPaidPerson', { person: chosen.member.name })
          }
          kind={draft.kind}
          onKind={(kind) => onDraft({ ...draft, kind })}
        />
        <MoneyField
          label={
            draft.kind === 'hourly' ? t('staffRates.rateAnHour') : t('staffRates.feeEachPerson')
          }
          value={draft.typed}
          sign={currencySign(currency, locale)}
          onChange={(next) => onDraft({ ...draft, typed: next })}
          error={problem ?? server}
          inputRef={rateRef}
        />
        {chosen != null && checked && typed != null && problem == null && server == null && (
          <p className="srt-inset" aria-live="polite">
            {ownInset(t, chosen.minutes, draft.kind, typed.minor, currency, locale)}
          </p>
        )}
        <div className="bt-opened-actions">
          <TextAction label={t('staffRates.cancel')} onClick={onCancel} />
          <TextAction label={t('staffRates.addRate')} onClick={save} />
        </div>
      </div>
    </div>
  );
}
