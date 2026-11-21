import { type ReactNode, type RefObject, useEffect, useId, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { Chevron, RowWords, TextAction } from '../components/SettingsParts.tsx';
import {
  Amount,
  Block,
  BudgetRow,
  BudgetShell,
  Columns,
  MarkWord,
  MoneyField,
  Opened,
  PageTitle,
  Rows,
} from './BudgetParts.tsx';
import { money, whole } from './budget.ts';
import { budgetAt, viewerOf } from './budgetSample.ts';
import { BUDGET_WORDS } from './budgetWords.ts';
import { type SampleEvent } from './events.ts';
import { jobName, jobsAt, personName } from './shifts.ts';
import {
  type Draft,
  type OwnRate,
  type Panel,
  type RateKind,
  type RatesSample,
  type RatesStart,
  type Rate,
  afterHeadlineOf,
  changedLine,
  figure,
  flatLine,
  headlineLine,
  headlineOf,
  hoursWords,
  insetWords,
  jobCost,
  jobWorked,
  ownWorked,
  unratedLine,
  workedLine,
  ownCost,
  ownMinutes,
  rateProblem,
  rateText,
  refusedWords,
  sourceLine,
  startOf,
  typedOf,
  typedRate,
  whoCanHaveOwn,
} from './staffRates.ts';
import { STAFF_RATES_WORDS as W } from './staffRatesWords.ts';
import './staffRates.css';

/** sc-101 at a desk: Budget / Staff rates, one page per event. Setting a rate needs Manage the budget. */
export function StaffRatesPage({ event, state }: { event: SampleEvent; state: string }) {
  const [params] = useSearchParams();
  const manages = viewerOf(params.get('as')).manages;

  return (
    <BudgetShell
      event={event}
      trail={[{ label: BUDGET_WORDS.budget, to: budgetAt() }, { label: W.title }]}
    >
      {() => <StaffRates first={startOf(state, manages)} />}
    </BudgetShell>
  );
}

function StaffRates({ first }: { first: RatesStart }) {
  const [sample, setSample] = useState(first.sample);
  const [panel, setPanel] = useState<Panel>(first.panel);
  const [draft, setDraft] = useState<Draft>(first.draft);
  const [pressed, setPressed] = useState(first.pressed);
  const [server, setServer] = useState<string | null>(
    first.refuse && first.panel?.kind === 'job'
      ? refusedWords(first.sample.rates[first.panel.job] ?? null)
      : null,
  );
  const [said, setSaid] = useState<{ key: string; words: string } | null>(null);
  const { manages } = first;
  const head = headlineOf(sample);
  const { plan } = sample;
  const after = sample.clocks == null ? null : afterHeadlineOf(sample);

  const open = (next: Panel, kind?: RateKind) => {
    const rate =
      next?.kind === 'job'
        ? (sample.rates[next.job] ?? null)
        : next?.kind === 'own'
          ? (sample.own.find((one) => one.person === next.person && one.job === next.job)?.rate ??
            null)
          : null;
    setPanel(next);
    setDraft({ kind: rate?.kind ?? kind ?? 'hourly', typed: typedOf(rate), who: '' });
    setPressed(false);
    setServer(null);
    setSaid(null);
  };
  const close = () => open(null);
  const done = (next: RatesSample, key: string, words: string) => {
    setSample(next);
    open(null);
    setSaid({ key, words });
  };

  const saveJob = (job: string): boolean => {
    const rate = typedRate(draft.typed, draft.kind);
    if (rate == null) return false;
    if (first.refuse) {
      setServer(refusedWords(sample.rates[job] ?? null));
      return true;
    }
    const was = sample.rates[job] ?? null;
    done(
      {
        ...sample,
        rates: { ...sample.rates, [job]: rate },
        changed: { ...sample.changed, [job]: { who: null, day: null, was, removed: false } },
      },
      job,
      W.saved(jobName(plan, job)),
    );
    return true;
  };
  const removeJob = (job: string) =>
    done(
      {
        ...sample,
        rates: { ...sample.rates, [job]: null },
        changed: {
          ...sample.changed,
          [job]: { who: null, day: null, was: sample.rates[job] ?? null, removed: true },
        },
      },
      job,
      W.removed(jobName(plan, job)),
    );
  const saveOwn = (own: Pick<OwnRate, 'person' | 'job'>): boolean => {
    const rate = typedRate(draft.typed, draft.kind);
    if (rate == null) return false;
    const key = `${own.person}:${own.job}`;
    const before = sample.own.find((one) => one.person === own.person && one.job === own.job);
    done(
      {
        ...sample,
        own: [
          ...sample.own.filter((one) => one !== before),
          { person: own.person, job: own.job, rate },
        ],
        changed: {
          ...sample.changed,
          [key]: { who: null, day: null, was: before?.rate ?? null, removed: false },
        },
      },
      key,
      W.saved(personName(plan, own.person)),
    );
    return true;
  };
  const backToJobRate = (own: OwnRate) =>
    done(
      { ...sample, own: sample.own.filter((one) => one !== own) },
      own.job,
      W.saved(jobName(plan, own.job)),
    );

  if (plan.jobs.length === 0)
    return (
      <>
        <PageTitle title={W.title} />
        {!manages && <ReadOnly />}
        <section className="srt-empty" aria-labelledby="srt-empty">
          <h2 id="srt-empty">{W.emptyTitle}</h2>
          <p>{W.emptyLine}</p>
          <Link className="desk-text" to={jobsAt()}>
            {W.openStaff}
            <Glyph name="chevron" size={16} weight={2.4} />
          </Link>
        </section>
      </>
    );

  const firstUnrated = head.unrated[0];

  return (
    <>
      <PageTitle title={W.title} />
      {!manages && <ReadOnly />}
      {after == null ? (
        <section className="srt-head" aria-label={W.title}>
          <p className="srt-figure">{whole(head.total)}</p>
          <p className="srt-line">{headlineLine(sample, head)}</p>
        </section>
      ) : (
        <section className="srt-head" aria-label={W.title}>
          <p className="srt-figure">{whole(after.worked)}</p>
          <p className="srt-line">
            {W.afterLine(hoursWords(after.minutes), hoursWords(head.counted), whole(head.total))}
          </p>
          {after.assumed > 0 && (
            <p className="srt-line">{W.afterAssumed(hoursWords(after.assumed))}</p>
          )}
          {head.unrated.length > 0 && <p className="srt-line">{unratedLine(sample, head)}</p>}
        </section>
      )}
      {manages && firstUnrated != null && panel?.kind !== 'job' && (
        <div className="bud-plan-line srt-next">
          <span className="srt-open" aria-hidden="true" />
          <p>{W.nextUp(jobName(plan, firstUnrated.job), hoursWords(firstUnrated.minutes))}</p>
          <TextAction
            label={W.setRate(jobName(plan, firstUnrated.job))}
            onClick={() => open({ kind: 'job', job: firstUnrated.job })}
          />
        </div>
      )}
      <Columns
        left={
          <Block title={W.jobs}>
            <Rows>
              {plan.jobs.map((job) => {
                const rate = sample.rates[job.id] ?? null;
                const cost = jobCost(sample, job.id, rate);
                const mine = changedLine(
                  sample.changed[job.id]?.who == null ? sample.changed[job.id] : undefined,
                );
                const source =
                  rate?.kind === 'flat' ? flatLine(sample, job.id) : sourceLine(sample, job.id);

                return (
                  <li key={job.id}>
                    {panel?.kind === 'job' && panel.job === job.id ? (
                      <RateEditor
                        name={job.name}
                        draft={draft}
                        pressed={pressed}
                        server={server}
                        inset={insetWords(sample, job.id, typedRate(draft.typed, draft.kind))}
                        audit={changedLine(sample.changed[job.id])}
                        onDraft={(next) => {
                          setDraft(next);
                          setServer(null);
                        }}
                        onCancel={close}
                        onSave={() => {
                          setPressed(true);
                          return saveJob(job.id);
                        }}
                        extra={
                          rate != null && (
                            <TextAction
                              label={W.removeRate}
                              red
                              onClick={() => removeJob(job.id)}
                            />
                          )
                        }
                      />
                    ) : after != null ? (
                      <AfterRow
                        title={job.name}
                        rate={rate}
                        scheduled={source}
                        scheduledCost={cost}
                        worked={workedLine(sample, job.id, jobWorked(sample, job.id, rate), rate)}
                        workedCost={jobWorked(sample, job.id, rate).cost}
                        {...(manages ? { onOpen: () => open({ kind: 'job', job: job.id }) } : {})}
                      />
                    ) : (
                      <BudgetRow
                        title={job.name}
                        tag={rate == null ? <NoRateTag /> : undefined}
                        lines={[
                          ...(rate == null ? [] : [rateText(rate)]),
                          source,
                          ...(mine == null ? [] : [mine]),
                        ]}
                        end={
                          cost == null ? (
                            <MarkWord mark={<span className="srt-open" />} word={W.notCountedEnd} />
                          ) : (
                            <Amount value={money(cost)} />
                          )
                        }
                        open={false}
                        label={`${job.name}, ${rate == null ? W.noRateYet : rateText(rate)}`}
                        {...(manages ? { onOpen: () => open({ kind: 'job', job: job.id }) } : {})}
                      />
                    )}
                    {said?.key === job.id && <Said words={said.words} />}
                  </li>
                );
              })}
            </Rows>
            <p className="desk-note">{after == null ? W.hoursSource : W.hoursFrom}</p>
          </Block>
        }
        right={
          <>
            <Block
              title={W.ownRates}
              action={
                manages && panel?.kind !== 'add' ? (
                  <TextAction
                    label={W.addOne}
                    before="plus"
                    onClick={() => open({ kind: 'add' })}
                  />
                ) : undefined
              }
            >
              {panel?.kind === 'add' && (
                <AddOwn
                  sample={sample}
                  draft={draft}
                  pressed={pressed}
                  onDraft={setDraft}
                  onCancel={close}
                  onSave={() => {
                    setPressed(true);
                    if (draft.who === '') return false;
                    const [person = '', job = ''] = draft.who.split(':');

                    return saveOwn({ person, job });
                  }}
                />
              )}
              {sample.own.length === 0 ? (
                <p className="desk-note">{W.noOwn}</p>
              ) : (
                <Rows>
                  {sample.own.map((own) => {
                    const key = `${own.person}:${own.job}`;
                    const job = jobName(plan, own.job);
                    const jobRate = sample.rates[own.job] ?? null;
                    const hours = hoursWords(ownMinutes(sample, own));

                    return (
                      <li key={key}>
                        {panel?.kind === 'own' &&
                        panel.person === own.person &&
                        panel.job === own.job ? (
                          <RateEditor
                            name={personName(plan, own.person)}
                            draft={draft}
                            pressed={pressed}
                            server={null}
                            inset={ownInset(sample, own, typedRate(draft.typed, draft.kind))}
                            audit={changedLine(sample.changed[key])}
                            question={W.howPaidPerson(personName(plan, own.person))}
                            onDraft={setDraft}
                            onCancel={close}
                            onSave={() => {
                              setPressed(true);
                              return saveOwn(own);
                            }}
                            extra={
                              <TextAction
                                label={W.jobRateAction(job)}
                                onClick={() => backToJobRate(own)}
                              />
                            }
                          />
                        ) : (
                          <BudgetRow
                            title={personName(plan, own.person)}
                            lines={[
                              W.instead(
                                rateText(own.rate),
                                job,
                                jobRate == null ? W.noRateYet : rateText(jobRate),
                              ),
                              W.ownHours(hours, job),
                              ...(after == null
                                ? []
                                : [
                                    `${W.worked} ${W.ownHours(hoursWords(ownWorked(sample, own).minutes), job)} · ${money(ownWorked(sample, own).cost)}`,
                                  ]),
                            ]}
                            end={<Amount value={money(ownCost(sample, own))} />}
                            open={false}
                            {...(manages
                              ? {
                                  onOpen: () =>
                                    open({ kind: 'own', person: own.person, job: own.job }),
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
            <Block title={W.howCounted}>
              <ul className="srt-rules">
                {(after == null ? W.howCountedLines : W.afterLines).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </Block>
          </>
        }
      />
    </>
  );
}

function ownInset(sample: RatesSample, own: OwnRate, rate: ReturnType<typeof typedRate>) {
  if (rate == null) return null;
  const minutes = ownMinutes(sample, own);
  const amount = ownCost(sample, { ...own, rate });

  return rate.kind === 'hourly'
    ? W.sum(hoursWords(minutes), figure(rate.minor), figure(amount))
    : W.sum(W.fees(minutes > 0 ? 1 : 0), figure(rate.minor), figure(amount));
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

/** After the event (sc-234): Scheduled and Worked one above the other, each with its amount. */
function AfterRow({
  title,
  rate,
  scheduled,
  scheduledCost,
  worked,
  workedCost,
  onOpen,
}: {
  title: string;
  rate: Rate | null;
  scheduled: string;
  scheduledCost: number | null;
  worked: string;
  workedCost: number | null;
  onOpen?: () => void;
}) {
  const amount = (cost: number | null) =>
    cost == null ? (
      <MarkWord mark={<span className="srt-open is-small" />} word={W.notCountedEnd} />
    ) : (
      <span className="srt-two-amount">{money(cost)}</span>
    );
  const inner = (
    <span className="srt-after">
      <span className="srt-after-top">
        <span className="srt-name">{title}</span>
        {rate == null ? <NoRateTag /> : <span className="srt-rate">{rateText(rate)}</span>}
      </span>
      <span className="srt-two">
        <span className="srt-two-label">{W.scheduled}</span>
        <span className="srt-two-words">{scheduled}</span>
        {amount(scheduledCost)}
        <span className="srt-two-label">{W.worked}</span>
        <span className="srt-two-words">{worked}</span>
        {amount(workedCost)}
      </span>
    </span>
  );

  if (onOpen != null)
    return (
      <button type="button" className="desk-row bud-row" onClick={onOpen}>
        {inner}
        <Chevron />
      </button>
    );

  return <div className="desk-row bud-row">{inner}</div>;
}

function ReadOnly() {
  return (
    <div className="bud-plan-line" role="status">
      <p>{W.readOnly}</p>
    </div>
  );
}

function NoRateTag() {
  return (
    <span className="bud-tag is-amber">
      <span className="srt-open is-small" aria-hidden="true" />
      {W.noRateYet}
    </span>
  );
}

function Said({ words }: { words: string }) {
  return (
    <p className="bud-said is-ok" role="status">
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
  kind: RateKind;
  onKind: (kind: RateKind) => void;
}) {
  const id = useId();
  const kinds: readonly { kind: RateKind; title: string; line: string }[] = [
    { kind: 'hourly', title: W.byTheHour, line: W.byTheHourLine },
    { kind: 'flat', title: W.flatFee, line: W.flatFeeLine },
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
  draft,
  pressed,
  server,
  inset,
  audit,
  question,
  extra,
  onDraft,
  onCancel,
  onSave,
}: {
  name: string;
  draft: Draft;
  pressed: boolean;
  server: string | null;
  inset: string | null;
  audit: string | null;
  question?: string;
  extra?: ReactNode;
  onDraft: (draft: Draft) => void;
  onCancel: () => void;
  onSave: () => boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const problem = pressed ? rateProblem(draft.typed, draft.kind) : null;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const box = useRef<HTMLDivElement>(null);
  useKeys(box, onCancel, () => {
    if (!onSave()) inputRef.current?.focus();
  });

  return (
    <Opened>
      <div ref={box} className="srt-editor">
        <p className="srt-name">{name}</p>
        <KindChoice
          question={question ?? W.howPaid(name)}
          kind={draft.kind}
          onKind={(kind) => onDraft({ ...draft, kind })}
        />
        <MoneyField
          label={draft.kind === 'hourly' ? W.rateAnHour : W.feeEachPerson}
          value={draft.typed}
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
        <div className="bud-opened-actions">
          <TextAction label={W.cancel} onClick={onCancel} />
          <TextAction
            label={W.saveRate}
            onClick={() => {
              if (!onSave()) inputRef.current?.focus();
            }}
          />
          {extra}
        </div>
      </div>
    </Opened>
  );
}

function AddOwn({
  sample,
  draft,
  pressed,
  onDraft,
  onCancel,
  onSave,
}: {
  sample: RatesSample;
  draft: Draft;
  pressed: boolean;
  onDraft: (draft: Draft) => void;
  onCancel: () => void;
  onSave: () => boolean;
}) {
  const id = useId();
  const whoRef = useRef<HTMLSelectElement>(null);
  const rateRef = useRef<HTMLInputElement>(null);
  const whoProblem = pressed && draft.who === '' ? W.whoBlank : null;
  const problem = pressed ? rateProblem(draft.typed, draft.kind) : null;
  const [person = '', job = ''] = draft.who.split(':');
  const chosen = draft.who === '' ? null : { person, job, rate: { kind: draft.kind, minor: 0 } };
  const rate = typedRate(draft.typed, draft.kind);

  useEffect(() => {
    whoRef.current?.focus();
  }, []);

  const save = () => {
    if (onSave()) return;
    if (draft.who === '') whoRef.current?.focus();
    else rateRef.current?.focus();
  };
  const box = useRef<HTMLDivElement>(null);
  useKeys(box, onCancel, save);

  return (
    <Opened>
      <div ref={box} className="srt-editor">
        <div className="desk-field">
          <label htmlFor={`${id}-who`} className="desk-label">
            {W.who}
          </label>
          <div className={whoProblem == null ? 'desk-box' : 'desk-box is-wrong'}>
            <select
              ref={whoRef}
              id={`${id}-who`}
              className="bud-select"
              value={draft.who}
              aria-invalid={whoProblem != null}
              aria-describedby={`${id}-who-help${whoProblem == null ? '' : ` ${id}-who-error`}`}
              onChange={(event) => onDraft({ ...draft, who: event.target.value })}
            >
              <option value="">{W.chooseWho}</option>
              {whoCanHaveOwn(sample).map((one) => (
                <option key={`${one.person}:${one.job}`} value={`${one.person}:${one.job}`}>
                  {one.words}
                </option>
              ))}
            </select>
          </div>
          <p id={`${id}-who-help`} className="desk-help">
            {W.whoHelp}
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
            chosen == null ? W.howTheyPaid : W.howPaidPerson(personName(sample.plan, person))
          }
          kind={draft.kind}
          onKind={(kind) => onDraft({ ...draft, kind })}
        />
        <MoneyField
          label={draft.kind === 'hourly' ? W.rateAnHour : W.feeEachPerson}
          value={draft.typed}
          onChange={(typed) => onDraft({ ...draft, typed })}
          error={problem}
          inputRef={rateRef}
        />
        {chosen != null && rate != null && problem == null && (
          <p className="srt-inset" aria-live="polite">
            {ownInset(sample, { ...chosen, rate }, rate)}
          </p>
        )}
        <div className="bud-opened-actions">
          <TextAction label={W.cancel} onClick={onCancel} />
          <TextAction label={W.addRate} onClick={save} />
        </div>
      </div>
    </Opened>
  );
}
