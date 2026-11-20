import { callingCode, formatPhone } from '@soirely/domain';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';

import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { Glyph } from '../components/Glyph.tsx';
import type { Tell } from '../components/SettingsParts.tsx';
import { DemoBell } from './DemoBell.tsx';
import { KeptArea, KeptHere } from './KeptOffline.tsx';
import { clockWords } from './tabKept.ts';
import { EventsShell, NotBuilt } from './EventParts.tsx';
import { EventSidebar } from './EventSidebar.tsx';
import { CLOCKS, type SampleEvent, sampleEvent } from './events.ts';
import { Pill } from './GuestsParts.tsx';
import { clockOfKitchen } from './kitchen.ts';
import { firstName } from './members.ts';
import { Wrong } from './MenuServed.tsx';
import { keptInbox, waitingLine } from './messages.ts';
import {
  type Draft,
  type Entry,
  type LinkState,
  type Panel,
  type Problems,
  type RosterStart,
  BAR_MS,
  JOBS,
  NAME_MAX,
  STATION_GROUPS,
  detailsNext,
  draftOf,
  entryFrom,
  firstWrong,
  jobLocked,
  jobOf,
  linkOf,
  memberOf,
  nextLine,
  problemsOf,
  rosterStart,
  sharesNumber,
  shiftLines,
  sorted,
} from './roster.ts';
import { COUNTRIES, codeChoice } from './rules.ts';
import {
  type CopyOutcome,
  ISSUE_MS,
  SAMPLE_LINK,
  afterCopy,
  afterMark,
  afterReplace,
  copyIssued,
  plainItem,
} from './staffLink.ts';
import {
  type RosterWords,
  ROSTER_WORDS,
  RosterWordsContext,
  useRosterWords,
} from './rosterWords.ts';
import { STATIONS_EVENT } from './stations.ts';
import { PanelFoot, PanelTop, Select, StaffTabs } from './Stations.tsx';
import { useSwitcherStart } from './switcher.ts';
import './guests.css';
import './menu.css';
import './stations.css';
import './roster.css';

const FIELD_IDS = { name: 'rs-f-name', number: 'rs-f-number', email: 'rs-f-email' } as const;

/** /demo/events/evt-wed-4/staff/roster (sc-3906): the Roster on the event's Staff page at 1280 × 800, by ?state=. */
export function RosterPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const raw = params.get('state');
  useSwitcherStart();

  return <RosterAt key={`${id ?? ''}|${raw ?? ''}`} id={id} raw={raw} />;
}

function RosterAt({ id, raw }: { id: string | undefined; raw: string | null }) {
  const [event] = useState(() => sampleEvent(id));
  const [first] = useState(() => rosterStart(raw));

  if (event == null) return <Navigate to="/demo/events" replace />;
  if (event.id !== STATIONS_EVENT)
    return <Navigate to={`/demo/events/${event.id}?area=staff`} replace />;

  return (
    <KeptArea
      eventId={event.id}
      area="staff"
      at={clockWords(first.finished ? CLOCKS.finished : clockOfKitchen(), event.timeZone)}
    >
      <EventsShell
        renderSide={(tell, covered) => (
          <EventSidebar
            event={event}
            area="staff"
            now={first.finished ? CLOCKS.finished : clockOfKitchen()}
            tell={tell}
            inert={covered}
            waiting={waitingLine(keptInbox())}
          />
        )}
      >
        {(tell) => (
          <RosterWordsContext value={ROSTER_WORDS[first.lang]}>
            <RosterView first={first} event={event} tell={tell} />
          </RosterWordsContext>
        )}
      </EventsShell>
    </KeptArea>
  );
}

function RosterView({
  first,
  event,
  tell,
}: {
  first: RosterStart;
  event: SampleEvent;
  tell: Tell;
}) {
  const { rw: RW, lw: LW, tabs, events, crumb } = useRosterWords();
  const [entries, setEntries] = useState<Entry[]>(first.entries);
  const [panel, setPanel] = useState<Panel>(first.panel);
  const [draft, setDraft] = useState<Draft>(first.draft);
  const [pressed, setPressed] = useState(first.pressed);
  const [warning, setWarning] = useState<string | null>(first.warning);
  const [bar, setBar] = useState<string[] | null>(first.bar);
  const [live, setLive] = useState({ text: firstSaid(first, LW), said: 0 });
  const [failed, setFailed] = useState<string | null>(first.failed);
  const [busy, setBusy] = useState<string | null>(null);
  const [held, setHeld] = useState(first.held);
  const [missed, setMissed] = useState(first.missed);
  const [replacing, setReplacing] = useState(first.replacing);
  const focusAfter = useRef<string | null>(null);
  const { manage, finished, erased } = first;

  useEffect(() => {
    if (first.held != null) {
      const field = document.getElementById(`rs-held-${first.held.id}`);
      if (field instanceof HTMLInputElement) field.select();
      return;
    }
    if (first.warning != null) {
      document.getElementById('rs-warning')?.focus();
      return;
    }
    if (!first.pressed) return;
    const wrong = firstWrong(problemsOf(first.draft, !first.erased, RW));
    if (wrong != null) {
      document.getElementById(FIELD_IDS[wrong])?.focus();
      return;
    }
    const was =
      first.panel?.kind === 'edit'
        ? (first.entries.find((one) => one.id === (first.panel as { id: string }).id) ?? null)
        : null;
    if (jobLocked(was, first.draft, RW) != null) document.getElementById('rs-f-job')?.focus();
  }, [first, RW]);

  useEffect(() => {
    if (focusAfter.current == null) return;
    document.getElementById(focusAfter.current)?.focus();
    focusAfter.current = null;
  });

  useEffect(() => {
    if (bar == null) return;
    const timer = window.setTimeout(() => setBar(null), BAR_MS);

    return () => window.clearTimeout(timer);
  }, [bar]);

  function say(lines: string[]) {
    setBar(lines);
    setLive((was) => ({ text: lines.join(' '), said: was.said + 1 }));
  }

  const rows = sorted(entries);
  const shown = (id: string) => entries.find((one) => one.id === id) as Entry;
  const editing = panel?.kind === 'edit' ? shown(panel.id) : null;
  const contact = !erased;
  const problems: Problems = pressed ? problemsOf(draft, contact, RW) : {};
  const lit = panel != null && panel.kind !== 'add' ? panel.id : null;

  function open(next: Panel) {
    setPressed(false);
    setWarning(null);
    setFailed(null);
    if (next?.kind === 'add') setDraft(draftOf(null));
    if (next?.kind === 'edit') setDraft(draftOf(shown(next.id)));
    setPanel(next);
    focusAfter.current = 'sn-panel-title';
  }

  function close() {
    const back = panel == null || panel.kind === 'add' ? 'rs-add' : `rs-name-${panel.id}`;
    setPanel(null);
    setWarning(null);
    setFailed(null);
    focusAfter.current = back;
  }

  function change(next: Partial<Draft>) {
    if (next.number != null || next.country != null) setWarning(null);
    setDraft({ ...draft, ...next });
  }

  function submit(anyway: boolean) {
    const wrong = firstWrong(problemsOf(draft, contact, RW));
    if (wrong != null) {
      setPressed(true);
      setWarning(null);
      focusAfter.current = FIELD_IDS[wrong];
      return;
    }
    if (jobLocked(editing, draft, RW) != null) {
      setPressed(true);
      setWarning(null);
      focusAfter.current = 'rs-f-job';
      return;
    }
    const shared = anyway || !contact ? null : sharesNumber(entries, draft, editing);
    if (shared != null) {
      setWarning(shared.name);
      focusAfter.current = 'rs-warning';
      return;
    }

    const made = entryFrom(draft, editing);
    setPressed(false);
    setWarning(null);
    setFailed(null);
    if (editing == null) {
      const member = contact ? memberOf(draft) : null;
      setEntries([...entries, made]);
      setPanel(null);
      say(member == null ? [RW.added(made.name)] : [RW.added(made.name), RW.member(member)]);
      focusAfter.current = 'rs-add';
      return;
    }
    setEntries(entries.map((one) => (one.id === made.id ? made : one)));
    setPanel({ kind: 'details', id: made.id });
    say([RW.saved]);
    focusAfter.current = 'sn-panel-title';
  }

  function cancelWarning() {
    setWarning(null);
    focusAfter.current = FIELD_IDS.number;
  }

  function remove(id: string) {
    const gone = shown(id);
    setEntries(entries.filter((one) => one.id !== id));
    setPanel(null);
    say([RW.removed(gone.name, shiftLines(gone, RW).length)]);
    focusAfter.current = 'rs-roster';
  }

  function restation(id: string, station: string) {
    const person = shown(id);
    setEntries(
      entries.map((one) =>
        one.id !== id
          ? one
          : station === ''
            ? { ...one, station: null }
            : withoutGone({ ...one, station }),
      ),
    );
    say([
      station === ''
        ? `[${person.name} has no station now.]`
        : `[${person.name} is on ${station}.]`,
    ]);
  }

  function relink(id: string, change: (one: Entry) => Partial<Entry>) {
    setEntries((was) => was.map((one) => (one.id === id ? { ...one, ...change(one) } : one)));
  }

  function announce(text: string) {
    setLive((was) => ({ text, said: was.said + 1 }));
  }

  async function copy(id: string) {
    if (busy != null) return;
    setBusy(id);
    setMissed(null);
    if (held?.id === id) setHeld(null);
    const issue = () =>
      new Promise<string>((resolve, reject) =>
        window.setTimeout(
          () => (first.copy === 'notIssued' ? reject(new Error('503')) : resolve(SAMPLE_LINK)),
          ISSUE_MS,
        ),
      );
    const outcome: CopyOutcome =
      first.copy === 'refused'
        ? await copyIssued(issue, null, null)
        : await copyIssued(
            issue,
            navigator.clipboard ?? null,
            typeof ClipboardItem === 'undefined' ? null : plainItem,
          );
    setBusy(null);
    if (outcome.kind === 'notIssued') {
      setMissed(id);
      announce(LW.notIssued);
      return;
    }
    relink(id, (one) => afterCopy(one.link, one.trail ?? null));
    if (outcome.kind === 'copied') {
      say([LW.copied]);
      return;
    }
    setHeld({ id, url: outcome.url });
    announce(LW.refused);
    focusAfter.current = `rs-held-${id}`;
  }

  function mark(id: string) {
    relink(id, afterMark);
    if (held?.id === id) setHeld(null);
    say([LW.marked(shown(id).name)]);
    focusAfter.current = `rs-copy-${id}`;
  }

  function replace(id: string) {
    relink(id, afterReplace);
    if (held?.id === id) setHeld(null);
    if (missed === id) setMissed(null);
    setReplacing(null);
    say([LW.replaced(shown(id).name)]);
    focusAfter.current = 'sn-panel-title';
  }

  const acts = manage && !finished && !erased;
  const next = nextLine(entries, finished, RW);

  return (
    <div className="desk-page ev-page gs mn sn rs">
      <div className="ev-wide mn-page">
        <KeptHere />
        <div className="ev-crumb-row">
          <nav className="ev-crumb" aria-label={crumb}>
            <ol>
              <li className="ev-crumb-part">
                <Link to="/demo/events">{events}</Link>
              </li>
              <li className="ev-crumb-part">
                <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                <Link className="ev-crumb-name" to={`/demo/events/${event.id}`}>
                  {event.name}
                </Link>
              </li>
              <li className="ev-crumb-part" aria-current="page">
                <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                <span className="ev-crumb-name">{RW.title}</span>
              </li>
            </ol>
          </nav>
          <DemoBell tell={tell} />
        </div>
        <header className="gs-top">
          <div className="mn-head">
            <h1 className="gs-title">{RW.title}</h1>
            <p className="mn-sub">{RW.sub}</p>
          </div>
        </header>
        <StaffTabs on="Roster" eventId={event.id} tell={tell} words={tabs} />
        {!manage && (
          <p className="mn-lock">
            <Glyph name="lock" size={16} weight={2.2} />
            {RW.lock}
          </p>
        )}
        <p className="visually-hidden" role="status">
          <span key={live.said}>{live.text}</span>
        </p>
        <div className="mn-split">
          <div className="mn-list">
            <section className="sn-card">
              <div className="sn-card-top">
                <div className="sn-card-names">
                  <h2 id="rs-roster" tabIndex={-1}>
                    {RW.roster}
                  </h2>
                  {next != null && rows.length > 0 && <p className="mn-sub">{next}</p>}
                </div>
                {manage && rows.length > 0 && (
                  <button
                    id="rs-add"
                    type="button"
                    className="desk-text"
                    onClick={() => open({ kind: 'add' })}
                  >
                    <Glyph name="plus" size={17} weight={2.3} />
                    {RW.add}
                  </button>
                )}
              </div>
              {rows.length === 0 ? (
                <div className="rs-empty">
                  <Glyph name="staff" size={28} weight={2} />
                  <p className="rs-empty-title">{RW.empty}</p>
                  <p className="mn-sub">{RW.emptySub}</p>
                  {manage && (
                    <button
                      id="rs-add"
                      type="button"
                      className="gs-pill is-primary"
                      onClick={() => open({ kind: 'add' })}
                    >
                      {RW.add}
                    </button>
                  )}
                </div>
              ) : (
                // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- it scrolls sideways, so a keyboard has to reach it (WCAG 2.2 §2.1.1).
                <div className="rs-frame" tabIndex={0} role="region" aria-labelledby="rs-roster">
                  <table className="rs-table" aria-labelledby="rs-roster">
                    <thead>
                      <tr>
                        <th scope="col">{RW.person}</th>
                        <th scope="col">{RW.job}</th>
                        <th scope="col">{RW.station}</th>
                        <th scope="col">{RW.shift}</th>
                        <th scope="col">{RW.link}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((one) => (
                        <Fragment key={one.id}>
                          <tr className={lit === one.id ? 'is-lit' : undefined}>
                            <th scope="row">
                              <button
                                id={`rs-name-${one.id}`}
                                type="button"
                                className="rs-name"
                                aria-current={lit === one.id || undefined}
                                onClick={() => open({ kind: 'details', id: one.id })}
                              >
                                {one.name}
                              </button>
                            </th>
                            <td className={one.job == null ? 'rs-quiet' : undefined}>
                              {one.job ?? RW.noJob}
                            </td>
                            <td className={one.station == null ? 'rs-quiet' : undefined}>
                              {one.station == null && one.gone != null ? (
                                <Gone section={one.gone} />
                              ) : (
                                (one.station ?? RW.noStation)
                              )}
                            </td>
                            <td className={one.shift == null ? 'rs-no-shift rs-quiet' : 'rs-shift'}>
                              {one.shift ?? first.noShift}
                              {one.more.length > 0 && (
                                <span className="rs-more">{RW.more(one.more.length)}</span>
                              )}
                            </td>
                            <td>
                              <LinkCell
                                entry={one}
                                erased={erased}
                                acts={acts}
                                busy={busy === one.id}
                                missed={missed === one.id}
                                onCopy={() => void copy(one.id)}
                                onMark={() => mark(one.id)}
                              />
                            </td>
                          </tr>
                          {held?.id === one.id && (
                            <tr className="rs-held-row">
                              <td colSpan={5}>
                                <HeldLink entry={one} url={held.url} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
          {panel != null && (manage || panel.kind === 'details') && (
            <aside className="mn-panel" aria-labelledby="sn-panel-title">
              {panel.kind === 'details' && (
                <Details
                  entry={shown(panel.id)}
                  manage={manage}
                  finished={finished}
                  erased={erased}
                  onClose={close}
                  onEdit={() => open({ kind: 'edit', id: panel.id })}
                  onRemove={() => open({ kind: 'remove', id: panel.id })}
                  onStation={(station) => restation(panel.id, station)}
                  onReplace={acts ? () => setReplacing(panel.id) : null}
                />
              )}
              {panel.kind === 'remove' && (
                <RemoveAsk
                  entry={shown(panel.id)}
                  onKeep={() => {
                    setPanel({ kind: 'details', id: panel.id });
                    focusAfter.current = 'rs-remove';
                  }}
                  onRemove={() => remove(panel.id)}
                />
              )}
              {(panel.kind === 'add' || panel.kind === 'edit') && (
                <PersonForm
                  title={editing == null ? RW.add : RW.editTitle(editing.name)}
                  draft={draft}
                  problems={problems}
                  contact={contact}
                  warning={warning}
                  failed={failed}
                  editing={editing != null}
                  locked={pressed ? jobLocked(editing, draft, RW) : null}
                  onChange={change}
                  onSubmit={() => submit(false)}
                  onAnyway={() => submit(true)}
                  onCancelWarning={cancelWarning}
                  onCancel={() => {
                    if (editing == null) close();
                    else open({ kind: 'details', id: editing.id });
                  }}
                />
              )}
            </aside>
          )}
        </div>
      </div>
      {replacing != null && (
        <ConfirmDialog
          id="rs-replace"
          title={LW.replaceTitle(firstName(shown(replacing).name))}
          keep={LW.keep}
          go={LW.replace}
          pending={false}
          onKeep={() => setReplacing(null)}
          onGo={() => replace(replacing)}
        >
          <p>{LW.replaceLine}</p>
        </ConfirmDialog>
      )}
      {bar != null && (
        <div className="rs-bar">
          <Glyph name="tick" size={18} weight={2.6} />
          <div className="rs-bar-lines">
            {bar.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <button type="button" className="desk-text rs-bar-dismiss" onClick={() => setBar(null)}>
            {RW.dismiss}
          </button>
        </div>
      )}
    </div>
  );
}

function firstSaid(first: RosterStart, LW: RosterWords['lw']): string {
  if (first.held != null) return LW.refused;
  if (first.missed != null) return LW.notIssued;

  return first.bar?.join(' ') ?? '';
}

export function LinkWord({ state }: { state: LinkState }) {
  const { links } = useRosterWords();

  return (
    <span className="rs-link">
      <span
        className={`rs-mark is-${state === 'noMobile' ? 'no-mobile' : state}`}
        aria-hidden="true"
      />
      {links[state]}
    </span>
  );
}

function withoutGone({ gone: _gone, ...one }: Entry): Entry {
  return one;
}

/** sc-3910: a person whose section the seating plan removed reads No station, and why, with the alert mark beside the words. */
function Gone({ section }: { section: string }) {
  const { rw: RW } = useRosterWords();

  return (
    <span className="rs-gone">
      <span className="rs-gone-now">{RW.noStationNow}</span>
      <GoneWhy section={section} />
    </span>
  );
}

function GoneWhy({ section, id }: { section: string; id?: string }) {
  const { rw: RW } = useRosterWords();

  return (
    <span className="rs-gone-why" id={id}>
      <Glyph name="alert" size={14} weight={2.4} />
      {RW.sectionGone(section)}
    </span>
  );
}

function Details({
  entry,
  manage,
  finished,
  erased,
  onClose,
  onEdit,
  onRemove,
  onStation,
  onReplace,
}: {
  entry: Entry;
  manage: boolean;
  finished: boolean;
  erased: boolean;
  onClose: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onStation: (station: string) => void;
  onReplace: (() => void) | null;
}) {
  const { rw: RW, lw: LW, trail: trailLine, close } = useRosterWords();
  const trail = erased ? null : trailLine(entry.link, entry.trail ?? null);
  const next = detailsNext(entry, finished, erased, RW);

  return (
    <>
      <PanelTop title={entry.name} eyebrow={RW.roster} close={close} onClose={onClose} />
      <div className="mn-panel-body">
        <dl className="rs-facts">
          <div>
            <dt>{RW.shift}</dt>
            <dd>
              <ul className="rs-shifts">
                {shiftLines(entry, RW).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </dd>
          </div>
          <div>
            <dt>{RW.station}</dt>
            <dd>
              {manage ? (
                <Select
                  id="rs-station"
                  label={`${RW.stationChange}, ${entry.name}`}
                  value={entry.station ?? ''}
                  shown={entry.station ?? (entry.gone != null ? RW.noStationNow : RW.noStation)}
                  {...(entry.station == null && entry.gone != null && { describedBy: 'rs-gone' })}
                  dense
                  onChange={onStation}
                  options={[{ value: '', label: RW.noStation }]}
                  groups={STATION_GROUPS.map((group) => ({
                    label: group.label,
                    options: group.stations.map((one) => ({ value: one, label: one })),
                  }))}
                />
              ) : entry.station == null && entry.gone != null ? (
                <Gone section={entry.gone} />
              ) : (
                (entry.station ?? RW.noStation)
              )}
              {manage && entry.station == null && entry.gone != null && (
                <GoneWhy section={entry.gone} id="rs-gone" />
              )}
            </dd>
          </div>
          {entry.mobile != null && (
            <div>
              <dt>{RW.mobile}</dt>
              <dd>{formatPhone(entry.mobile)}</dd>
            </div>
          )}
          {entry.email != null && (
            <div>
              <dt>{RW.email}</dt>
              <dd>{entry.email}</dd>
            </div>
          )}
          <div>
            <dt>{RW.link}</dt>
            <dd className="rs-link-fact">
              <LinkWord state={linkOf(entry, erased)} />
              {trail != null && <span className="rs-trail">{trail}</span>}
              {onReplace != null && entry.mobile != null && entry.link !== 'none' && (
                <button
                  id="rs-replace-open"
                  type="button"
                  className="gs-pill is-secondary"
                  onClick={onReplace}
                >
                  {LW.replaceOpen}
                </button>
              )}
            </dd>
          </div>
        </dl>
        {next != null && <p className="rs-next">{next}</p>}
      </div>
      {manage && (
        <div className="mn-panel-foot">
          <div className="mn-panel-acts">
            {!finished && (
              <button
                id="rs-remove"
                type="button"
                className="desk-text rs-danger"
                onClick={onRemove}
              >
                {RW.remove}
              </button>
            )}
            <Pill label={RW.edit} onClick={onEdit} />
          </div>
        </div>
      )}
    </>
  );
}

/** The row's Link: its word with a mark, who and when, and Copy link, then Mark as sent once copied. */
function LinkCell({
  entry,
  erased,
  acts,
  busy,
  missed,
  onCopy,
  onMark,
}: {
  entry: Entry;
  erased: boolean;
  acts: boolean;
  busy: boolean;
  missed: boolean;
  onCopy: () => void;
  onMark: () => void;
}) {
  const { lw: LW, trail: trailLine } = useRosterWords();
  const state = linkOf(entry, erased);
  const trail = erased ? null : trailLine(entry.link, entry.trail ?? null);
  const offered = acts && entry.mobile != null;

  return (
    <div className="rs-link-cell">
      <LinkWord state={state} />
      {trail != null && <span className="rs-trail">{trail}</span>}
      {missed && (
        <span className="rs-missed">
          <Glyph name="alert" size={15} weight={2.2} />
          {LW.notIssued}
        </span>
      )}
      {offered && (
        <span className="rs-link-acts">
          <button
            id={`rs-copy-${entry.id}`}
            type="button"
            className={busy ? 'desk-text is-busy' : 'desk-text'}
            aria-label={`${LW.copy}: ${entry.name}`}
            aria-disabled={busy || undefined}
            aria-busy={busy || undefined}
            onClick={onCopy}
          >
            {busy && <span className="pending-spinner desk-turning" aria-hidden="true" />}
            {LW.copy}
          </button>
          {entry.link === 'copied' && (
            <button
              type="button"
              className="desk-text"
              aria-label={`${LW.markSent}: ${entry.name}`}
              onClick={onMark}
            >
              {LW.markSent}
            </button>
          )}
        </span>
      )}
    </div>
  );
}

/** A link the browser would not copy, shown to copy by hand; the field is named for whose link it is. */
function HeldLink({ entry, url }: { entry: Entry; url: string }) {
  const { lw: LW } = useRosterWords();
  const id = `rs-held-${entry.id}`;

  return (
    <div className="rs-held">
      <p className="rs-held-says">
        <Glyph name="alert" size={16} weight={2.2} />
        {LW.refused}
      </p>
      <label htmlFor={id} className="rs-held-label">
        {LW.linkFor(entry.name)}
      </label>
      <input
        id={id}
        className="rs-held-field"
        type="text"
        readOnly
        value={url}
        onFocus={(event) => event.currentTarget.select()}
      />
    </div>
  );
}

function RemoveAsk({
  entry,
  onKeep,
  onRemove,
}: {
  entry: Entry;
  onKeep: () => void;
  onRemove: () => void;
}) {
  const { rw: RW } = useRosterWords();

  return (
    <>
      <div className="mn-panel-top">
        <div className="mn-panel-names">
          <h2 id="sn-panel-title" tabIndex={-1}>
            {RW.removeAsk(entry.name)}
          </h2>
        </div>
      </div>
      <div className="mn-panel-body">
        <ul className="rs-shifts">
          {shiftLines(entry, RW).map((line) => (
            <li key={line} className="rs-ask-shift">
              {line}
            </li>
          ))}
        </ul>
        <p className="mn-quiet">{RW.stopsWorking}</p>
      </div>
      <div className="mn-panel-foot">
        <div className="mn-panel-acts">
          <button type="button" className="desk-text" onClick={onKeep}>
            {RW.keep}
          </button>
          <button type="button" className="gs-pill is-primary rs-remove-go" onClick={onRemove}>
            {RW.remove}
          </button>
        </div>
      </div>
    </>
  );
}

function PersonForm({
  title,
  draft,
  problems,
  contact,
  warning,
  failed,
  editing,
  locked,
  onChange,
  onSubmit,
  onAnyway,
  onCancelWarning,
  onCancel,
}: {
  title: string;
  draft: Draft;
  problems: Problems;
  contact: boolean;
  warning: string | null;
  failed: string | null;
  editing: boolean;
  locked: string | null;
  onChange: (next: Partial<Draft>) => void;
  onSubmit: () => void;
  onAnyway: () => void;
  onCancelWarning: () => void;
  onCancel: () => void;
}) {
  const { rw: RW, close, cancel } = useRosterWords();
  const job = jobOf(draft.job);
  const told = (id: string, error: string | undefined, help?: boolean) =>
    [error == null ? null : `${id}-error`, help === true ? `${id}-help` : null]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <>
      <PanelTop title={title} close={close} onClose={onCancel} />
      <div className="mn-panel-body">
        {failed != null && (
          <p className="mn-failed" role="alert">
            <Glyph name="alert" size={17} weight={2.2} />
            {failed}
          </p>
        )}
        <div className="desk-field">
          <label htmlFor={FIELD_IDS.name} className="desk-label">
            {RW.person}
          </label>
          <div className={problems.name == null ? 'desk-box' : 'desk-box is-wrong'}>
            <input
              id={FIELD_IDS.name}
              type="text"
              value={draft.name}
              maxLength={NAME_MAX}
              autoComplete="off"
              aria-invalid={problems.name != null}
              aria-describedby={told(FIELD_IDS.name, problems.name, true)}
              onChange={(change) => onChange({ name: change.target.value })}
            />
          </div>
          {problems.name != null && <Wrong id={`${FIELD_IDS.name}-error`}>{problems.name}</Wrong>}
          <p id={`${FIELD_IDS.name}-help`} className="desk-help">
            {RW.nameHelp}
          </p>
        </div>
        {contact && (
          <div className="desk-field">
            <label htmlFor={FIELD_IDS.number} className="desk-label gs-label">
              {RW.mobile}
              <span className="gs-optional">{RW.optional}</span>
            </label>
            <div className="gs-phone">
              <div className="desk-box gs-country">
                <span aria-hidden="true">{`${draft.country} ${callingCode(draft.country) ?? ''}`}</span>
                <Glyph name="chevdown" size={15} weight={2.4} />
                <select
                  aria-label={RW.country}
                  value={draft.country}
                  onChange={(change) => onChange({ country: change.target.value })}
                >
                  {COUNTRIES.map((each) => (
                    <option key={each.code} value={each.code}>
                      {codeChoice(each.code)}
                    </option>
                  ))}
                </select>
              </div>
              <div className={problems.number == null ? 'desk-box' : 'desk-box is-wrong'}>
                <input
                  id={FIELD_IDS.number}
                  type="tel"
                  value={draft.number}
                  autoComplete="off"
                  aria-invalid={problems.number != null}
                  aria-describedby={told(FIELD_IDS.number, problems.number, true)}
                  onChange={(change) => onChange({ number: change.target.value })}
                />
              </div>
            </div>
            {problems.number != null && (
              <Wrong id={`${FIELD_IDS.number}-error`}>{problems.number}</Wrong>
            )}
            {warning != null && (
              <div
                id="rs-warning"
                className="rs-warning"
                tabIndex={-1}
                role="group"
                aria-labelledby="rs-warning-words"
              >
                <p id="rs-warning-words">
                  <Glyph name="warn" size={17} weight={2.2} />
                  {RW.uses(warning)}
                </p>
                <div className="rs-warning-acts">
                  <button type="button" className="desk-text" onClick={onCancelWarning}>
                    {RW.cancel}
                  </button>
                  <Pill label={editing ? RW.saveAnyway : RW.addAnyway} primary onClick={onAnyway} />
                </div>
              </div>
            )}
            <p id={`${FIELD_IDS.number}-help`} className="desk-help">
              {RW.mobileHelp}
            </p>
          </div>
        )}
        {contact && (
          <div className="desk-field">
            <label htmlFor={FIELD_IDS.email} className="desk-label gs-label">
              {RW.email}
              <span className="gs-optional">{RW.optional}</span>
            </label>
            <div className={problems.email == null ? 'desk-box' : 'desk-box is-wrong'}>
              <input
                id={FIELD_IDS.email}
                type="email"
                value={draft.email}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={problems.email != null}
                aria-describedby={told(FIELD_IDS.email, problems.email)}
                onChange={(change) => onChange({ email: change.target.value })}
              />
            </div>
            {problems.email != null && (
              <Wrong id={`${FIELD_IDS.email}-error`}>{problems.email}</Wrong>
            )}
          </div>
        )}
        <div className="desk-field">
          <div className="rs-label-row">
            <label htmlFor="rs-f-job" className="desk-label">
              {RW.job}
            </label>
            <NotBuilt words={`${RW.notBuilt} · sc-3908`} />
          </div>
          <Select
            id="rs-f-job"
            value={draft.job}
            shown={draft.job === '' ? RW.noJob : draft.job}
            wrong={locked != null}
            {...(locked == null ? {} : { describedBy: 'rs-f-job-error rs-f-job-help' })}
            onChange={(value) =>
              onChange(
                editing ? { job: value } : { job: value, shift: jobOf(value)?.shifts[0] ?? '' },
              )
            }
            options={[
              { value: '', label: RW.noJob },
              ...JOBS.map((one) => ({ value: one.job, label: one.job })),
            ]}
          />
          {locked != null && (
            <>
              <Wrong id="rs-f-job-error">{locked}</Wrong>
              <p id="rs-f-job-help" className="desk-help">
                {RW.jobLockedHelp}
              </p>
            </>
          )}
        </div>
        {!editing && job != null && (
          <div className="desk-field">
            <div className="rs-label-row">
              <label htmlFor="rs-f-shift" className="desk-label">
                {RW.shift}
              </label>
              <NotBuilt words={`${RW.notBuilt} · sc-3908`} />
            </div>
            <Select
              id="rs-f-shift"
              value={draft.shift}
              shown={draft.shift === '' ? RW.noShift : draft.shift}
              onChange={(value) => onChange({ shift: value })}
              options={[
                { value: '', label: RW.noShift },
                ...job.shifts.map((one) => ({ value: one, label: one })),
              ]}
            />
          </div>
        )}
      </div>
      <PanelFoot
        cta={editing ? RW.saveChanges : RW.addCta}
        cancel={cancel}
        onSave={onSubmit}
        onCancel={onCancel}
      />
    </>
  );
}
