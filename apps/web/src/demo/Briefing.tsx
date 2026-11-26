import { Fragment, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { Dialog, type Tell } from '../components/SettingsParts.tsx';
import {
  type Brief,
  type BriefingStart,
  type Check,
  type Person,
  type Side,
  BW,
  afterBriefCopy,
  afterBriefMark,
  briefingStart,
  checkOf,
  countLine,
  dueAll,
  dueChanged,
  fitRules,
  noteOf,
  onShift,
  resultLines,
  sendTo,
  tallyOf,
} from './briefing.ts';
import { DemoBell } from './DemoBell.tsx';
import { EventsShell } from './EventParts.tsx';
import { EventSidebar } from './EventSidebar.tsx';
import { CLOCKS, type SampleEvent, sampleEvent } from './events.ts';
import { Pill } from './GuestsParts.tsx';
import { clockOfKitchen } from './kitchen.ts';
import { KeptArea, KeptHere } from './KeptOffline.tsx';
import { keptInbox, waitingLine } from './messages.ts';
import { MN } from './myNight.ts';
import { LinkWord } from './Roster.tsx';
import { linkOf, sorted } from './roster.ts';
import { ROSTER_WORDS, RosterWordsContext } from './rosterWords.ts';
import { ISSUE_MS, SAMPLE_LINK, copyIssued, plainItem, trailLine } from './staffLink.ts';
import { STATIONS_EVENT } from './stations.ts';
import { Select, StaffTabs } from './Stations.tsx';
import { useSwitcherStart } from './switcher.ts';
import { clockWords } from './tabKept.ts';
import './guests.css';
import './menu.css';
import './myNight.css';
import './stations.css';
import './roster.css';
import './briefing.css';

const BRIEFS: readonly Brief[] = ['read', 'sent', 'changed', 'none'];

/** /demo/events/evt-wed-4/staff/briefing (sc-3917): the Roster with the Briefing card above it and its Briefing column, by ?state=. */
export function BriefingPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const raw = params.get('state');
  useSwitcherStart();

  return <BriefingAt key={`${id ?? ''}|${raw ?? ''}`} id={id} raw={raw} />;
}

function BriefingAt({ id, raw }: { id: string | undefined; raw: string | null }) {
  const [event] = useState(() => sampleEvent(id));
  const [first] = useState(() => briefingStart(raw));

  if (event == null) return <Navigate to="/demo/events" replace />;
  if (event.id !== STATIONS_EVENT)
    return <Navigate to={`/demo/events/${event.id}?area=staff`} replace />;
  const now = first.finished ? CLOCKS.finished : clockOfKitchen();

  return (
    <KeptArea eventId={event.id} area="staff" at={clockWords(now, event.timeZone)}>
      <EventsShell
        renderSide={(tell, covered) => (
          <EventSidebar
            event={event}
            area="staff"
            now={now}
            tell={tell}
            inert={covered}
            waiting={waitingLine(keptInbox())}
          />
        )}
      >
        {(tell) => (
          <RosterWordsContext value={ROSTER_WORDS.en}>
            {first.access === 'none' ? (
              <Refused event={event} />
            ) : (
              <BriefingView first={first} event={event} tell={tell} />
            )}
          </RosterWordsContext>
        )}
      </EventsShell>
    </KeptArea>
  );
}

function Refused({ event }: { event: SampleEvent }) {
  return (
    <div className="desk-page ev-page gs mn sn rs bf">
      <div className="ev-wide mn-page">
        <div className="bf-refused" role="alert">
          <Glyph name="lock" size={28} weight={2} />
          <p className="rs-empty-title">{BW.refusedPage}</p>
          <Link className="gs-pill is-secondary" to={`/demo/events/${event.id}`}>
            {BW.backToEvent}
          </Link>
        </div>
      </div>
    </div>
  );
}

function BriefingView({
  first,
  event,
  tell,
}: {
  first: BriefingStart;
  event: SampleEvent;
  tell: Tell;
}) {
  const [people, setPeople] = useState<Person[]>(first.people);
  const [side, setSide] = useState<Side>(first.side);
  const [rules, setRules] = useState(first.rules);
  const [draft, setDraft] = useState(first.draft);
  const [cut, setCut] = useState(first.cut);
  const [saved, setSaved] = useState(first.saved);
  const [busy, setBusy] = useState(first.busy);
  const [missed, setMissed] = useState(first.missed);
  const [handHeld, setHandHeld] = useState(first.handHeld);
  const [check, setCheck] = useState(first.check);
  const [checkAt, setCheckAt] = useState(first.checkAt);
  const [stuck, setStuck] = useState(first.checkAt === 'loading');
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const [result, setResult] = useState(first.result);
  const [live, setLive] = useState({ text: first.said ?? '', said: 0 });
  const focusAfter = useRef<string | null>(null);
  const manage = first.access === 'manage';
  const acts = manage && !first.finished;
  const sends = acts && first.live;

  useEffect(() => {
    if (first.handHeld != null) {
      const field = document.getElementById(`bf-held-${first.handHeld.id}`);
      if (field instanceof HTMLInputElement) field.select();
    }
  }, [first]);

  useEffect(() => {
    if (focusAfter.current == null) return;
    document.getElementById(focusAfter.current)?.focus();
    focusAfter.current = null;
  });

  useEffect(() => {
    if (check == null || checkAt !== 'loading' || stuck) return;
    const timer = window.setTimeout(() => setCheckAt('shown'), ISSUE_MS);

    return () => window.clearTimeout(timer);
  }, [check, checkAt, stuck]);

  function announce(text: string) {
    setLive((was) => ({ text, said: was.said + 1 }));
  }

  const rows = sorted(people) as Person[];
  const shown = (id: string) => people.find((one) => one.id === id) as Person;
  const all = dueAll(people);
  const changed = dueChanged(people);
  const tally = tallyOf(people);

  function open(next: Side) {
    setSide(next);
    setSaved(false);
    setCut(false);
    focusAfter.current = 'sn-panel-title';
  }

  function close(back: string) {
    setSide(null);
    setDraft(null);
    setCut(false);
    focusAfter.current = back;
  }

  function change(id: string, to: (one: Person) => Person) {
    setPeople((was) => was.map((one) => (one.id === id ? to(one) : one)));
  }

  async function copy(id: string) {
    if (busy != null) return;
    setBusy(id);
    setMissed(null);
    if (handHeld?.id === id) setHandHeld(null);
    if (first.copy === 'slow') return;
    const issue = () =>
      new Promise<string>((resolve, reject) =>
        window.setTimeout(
          () => (first.copy === 'notIssued' ? reject(new Error('503')) : resolve(SAMPLE_LINK)),
          ISSUE_MS,
        ),
      );
    const outcome =
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
      announce(BW.notCopied);
      return;
    }
    change(id, afterBriefCopy);
    if (outcome.kind === 'copied') {
      announce(BW.copied);
      return;
    }
    setHandHeld({ id, url: outcome.url });
    announce(BW.refused);
    focusAfter.current = `bf-held-${id}`;
  }

  function mark(id: string) {
    change(id, afterBriefMark);
    if (handHeld?.id === id) setHandHeld(null);
    announce(BW.marked(shown(id).name));
    focusAfter.current =
      side?.kind === 'copy' || result != null ? `bf-copy-${id}` : `bf-row-copy-${id}`;
  }

  function ask(target: string) {
    setStuck(false);
    setSendFailed(false);
    setCheckAt('loading');
    setCheck(target);
  }

  const due =
    check == null
      ? []
      : check === 'all'
        ? all
        : check === 'changed'
          ? changed
          : people.filter((one) => one.id === check);
  const costs: Check | null = check == null ? null : checkOf(due, people, first.balance);

  function closeCheck() {
    focusAfter.current =
      check === 'all' ? 'bf-send' : check === 'changed' ? 'bf-changed' : `bf-again-${check ?? ''}`;
    setCheck(null);
    setSendFailed(false);
  }

  function sendNow() {
    if (costs == null || sending || checkAt !== 'shown') return;
    setSending(true);
    window.setTimeout(() => {
      setSending(false);
      if (first.sendFails) {
        setSendFailed(true);
        announce(BW.sendFailed);
        return;
      }
      const sent = sendTo(people, due, costs);
      setPeople(sent.people);
      setCheck(null);
      const lines = resultLines(sent.sent, check === 'all' ? costs.noMobile : 0, sent.held.length);
      setResult({ lines, held: sent.held });
      announce(lines.join(' '));
      focusAfter.current = 'bf-result';
    }, ISSUE_MS);
  }

  function rulesTyped(next: string) {
    const fitted = fitRules(draft ?? '', next);
    setDraft(fitted.text);
    if (fitted.cut) {
      setCut(true);
      announce(BW.cut);
    } else if (cut) setCut(false);
  }

  function saveRules() {
    setRules((draft ?? '').trim());
    setDraft(null);
    setSaved(true);
    setSide({ kind: 'rules', editing: false });
    announce(BW.saved);
    focusAfter.current = 'sn-panel-title';
  }

  const backFrom = (now: Side) =>
    now?.kind === 'copy' ? 'bf-copy' : now?.kind === 'preview' ? 'bf-preview' : 'bf-rules';

  return (
    <div
      className={
        side == null
          ? 'desk-page ev-page gs mn sn rs bf'
          : 'desk-page ev-page gs mn sn rs bf is-side'
      }
    >
      <div className="ev-wide mn-page">
        <KeptHere />
        <div className="ev-crumb-row">
          <nav className="ev-crumb" aria-label="Breadcrumb">
            <ol>
              <li className="ev-crumb-part">
                <Link to="/demo/events">Events</Link>
              </li>
              <li className="ev-crumb-part">
                <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                <Link className="ev-crumb-name" to={`/demo/events/${event.id}`}>
                  {event.name}
                </Link>
              </li>
              <li className="ev-crumb-part" aria-current="page">
                <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                <span className="ev-crumb-name">Staff</span>
              </li>
            </ol>
          </nav>
          <DemoBell tell={tell} />
        </div>
        <header className="gs-top">
          <div className="mn-head">
            <h1 className="gs-title">Staff</h1>
            <p className="mn-sub">
              Who works the event, where they work, and what each station serves.
            </p>
          </div>
        </header>
        <StaffTabs on="Roster" eventId={event.id} tell={tell} />
        {!manage && (
          <p className="mn-lock">
            <Glyph name="lock" size={16} weight={2.2} />
            {BW.lock}
          </p>
        )}
        <p className="visually-hidden" role="status">
          <span key={live.said}>{live.text}</span>
        </p>
        <div className="mn-split">
          <div className="mn-list">
            <section className="sn-card bf-card" aria-labelledby="bf-title">
              <div className="sn-card-top">
                <div className="sn-card-names">
                  <h2 id="bf-title">{BW.card}</h2>
                  <p className="mn-sub">{BW.cardSub}</p>
                </div>
              </div>
              <ul className="bf-tally" aria-label="Where the briefing is">
                {BRIEFS.map((brief) => (
                  <li key={brief}>
                    <BriefWord brief={brief} />
                    <span className="bf-tally-n">{tally[brief]}</span>
                  </li>
                ))}
              </ul>
              {acts && (
                <div className="bf-acts">
                  {sends && all.length > 0 && (
                    <button
                      id="bf-send"
                      type="button"
                      className="gs-pill is-primary"
                      aria-haspopup="dialog"
                      onClick={() => ask('all')}
                    >
                      {BW.sendAll(all.length)}
                    </button>
                  )}
                  {sends && changed.length > 0 && (
                    <button
                      id="bf-changed"
                      type="button"
                      className="gs-pill is-secondary"
                      aria-haspopup="dialog"
                      onClick={() => ask('changed')}
                    >
                      {BW.sendChanged(changed.length)}
                    </button>
                  )}
                  <button
                    id="bf-copy"
                    type="button"
                    className="gs-pill is-secondary"
                    aria-expanded={side?.kind === 'copy'}
                    onClick={() => open({ kind: 'copy' })}
                  >
                    {BW.copy}
                  </button>
                </div>
              )}
              <div className="bf-more">
                <button
                  id="bf-rules"
                  type="button"
                  className="desk-text"
                  aria-expanded={side?.kind === 'rules'}
                  onClick={() => open({ kind: 'rules', editing: false })}
                >
                  <Glyph name="pen" size={16} weight={2.3} />
                  {manage ? BW.editRules : BW.rules}
                </button>
                <button
                  id="bf-preview"
                  type="button"
                  className="desk-text"
                  aria-expanded={side?.kind === 'preview'}
                  onClick={() => {
                    const firstOne = rows.find((one) => one.shift != null) ?? rows[0];
                    if (firstOne != null) open({ kind: 'preview', id: firstOne.id });
                  }}
                >
                  <Glyph name="eye" size={16} weight={2.3} />
                  {BW.previewAs}
                </button>
              </div>
              {result != null && (
                <div className="bf-result" id="bf-result" tabIndex={-1}>
                  <div className="bf-result-lines">
                    <Glyph name="tick" size={18} weight={2.6} />
                    <div>
                      {result.lines.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>
                  </div>
                  {result.held.length > 0 && (
                    <ul className="bf-held-list">
                      {result.held.map((id) => (
                        <CopyRow
                          key={id}
                          one={shown(id)}
                          acts={acts}
                          busy={busy === id}
                          missed={missed === id}
                          handHeld={handHeld?.id === id ? handHeld.url : null}
                          onCopy={() => void copy(id)}
                          onMark={() => mark(id)}
                          brief={false}
                        />
                      ))}
                    </ul>
                  )}
                  <button type="button" className="desk-text" onClick={() => setResult(null)}>
                    {BW.dismiss}
                  </button>
                </div>
              )}
              {sendFailed && check == null && (
                <p className="rs-missed" role="alert">
                  <Glyph name="alert" size={15} weight={2.2} />
                  {BW.sendFailed}
                </p>
              )}
            </section>
            <section className="sn-card">
              <div className="sn-card-top">
                <div className="sn-card-names">
                  <h2 id="rs-roster" tabIndex={-1}>
                    Roster
                  </h2>
                </div>
              </div>
              {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- it scrolls sideways, so a keyboard has to reach it (WCAG 2.2 §2.1.1). */}
              <div className="rs-frame" tabIndex={0} role="region" aria-labelledby="rs-roster">
                <table className="rs-table bf-table" aria-labelledby="rs-roster">
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Job</th>
                      <th scope="col">Station</th>
                      <th scope="col">Shift</th>
                      <th scope="col">{BW.column}</th>
                      <th scope="col">Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((one) => (
                      <Fragment key={one.id}>
                        <tr>
                          <th scope="row" className="bf-name">
                            {one.name}
                          </th>
                          <td className={one.job == null ? 'rs-quiet' : undefined}>
                            {one.job ?? 'No job yet'}
                          </td>
                          <td className={one.station == null ? 'rs-quiet' : undefined}>
                            {one.station ?? 'No station yet'}
                          </td>
                          <td className={one.shift == null ? 'rs-quiet' : 'rs-shift'}>
                            {one.shift ?? 'Not on a shift yet'}
                          </td>
                          <td>
                            <BriefCell
                              one={one}
                              acts={acts}
                              sends={sends}
                              busy={busy === one.id}
                              missed={missed === one.id}
                              onAgain={() => ask(one.id)}
                              onCopy={() => void copy(one.id)}
                              onMark={() => mark(one.id)}
                            />
                          </td>
                          <td>
                            <span className="rs-link-cell">
                              <LinkWord state={linkOf(one, false)} />
                              {trailLine(one.link, one.trail ?? null) != null && (
                                <span className="rs-trail">
                                  {trailLine(one.link, one.trail ?? null)}
                                </span>
                              )}
                            </span>
                          </td>
                        </tr>
                        {handHeld?.id === one.id && side?.kind !== 'copy' && result == null && (
                          <tr className="rs-held-row">
                            <td colSpan={6}>
                              <HandHeld one={one} url={handHeld.url} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
          {side != null && (
            <aside className="mn-panel bf-panel" aria-labelledby="sn-panel-title">
              <button
                type="button"
                className="desk-text bf-back"
                onClick={() => close(backFrom(side))}
              >
                <Glyph name="back" size={16} weight={2.4} />
                {BW.roster}
              </button>
              {side.kind === 'copy' && (
                <CopyPanel
                  people={rows}
                  loading={first.loading}
                  acts={acts}
                  busy={busy}
                  missed={missed}
                  handHeld={handHeld}
                  onCopy={(id) => void copy(id)}
                  onMark={mark}
                  onClose={() => close('bf-copy')}
                />
              )}
              {side.kind === 'rules' && (
                <RulesPanel
                  rules={rules}
                  draft={side.editing ? (draft ?? rules) : null}
                  manage={acts}
                  cut={cut}
                  saved={saved}
                  onEdit={() => {
                    setDraft(rules);
                    setSaved(false);
                    setSide({ kind: 'rules', editing: true });
                    focusAfter.current = 'bf-rules-box';
                  }}
                  onType={rulesTyped}
                  onSave={saveRules}
                  onCancel={() => {
                    setDraft(null);
                    setCut(false);
                    setSide({ kind: 'rules', editing: false });
                    focusAfter.current = 'sn-panel-title';
                  }}
                  onClose={() => close('bf-rules')}
                />
              )}
              {side.kind === 'preview' && (
                <PreviewPanel
                  people={rows}
                  one={shown(side.id)}
                  rules={rules}
                  event={event.name}
                  onPick={(id) => setSide({ kind: 'preview', id })}
                  onClose={() => close('bf-preview')}
                />
              )}
            </aside>
          )}
        </div>
      </div>
      {check != null && costs != null && (
        <Dialog
          title={BW.checkTitle}
          verb={
            check === 'all'
              ? BW.sendAll(costs.people)
              : check === 'changed'
                ? BW.sendChanged(costs.people)
                : BW.sendAgain
          }
          dismiss={BW.cancel}
          on={checkAt === 'shown' && !sending}
          locked={sending}
          onDismiss={closeCheck}
          onConfirm={sendNow}
        >
          <CheckBody
            costs={costs}
            at={checkAt}
            billing={first.billing}
            sending={sending}
            failed={sendFailed}
            tell={tell}
            onRetry={() => setCheckAt('loading')}
            onCopy={() => {
              setCheck(null);
              open({ kind: 'copy' });
            }}
          />
        </Dialog>
      )}
    </div>
  );
}

export function BriefWord({ brief }: { brief: Brief }) {
  return (
    <span className="rs-link">
      <span className={`bf-mark is-${brief}`} aria-hidden="true">
        {(brief === 'read' || brief === 'sent') && <Glyph name="tick" size={10} weight={3.4} />}
      </span>
      {BW.tally[brief]}
    </span>
  );
}

function BriefCell({
  one,
  acts,
  sends,
  busy,
  missed,
  onAgain,
  onCopy,
  onMark,
}: {
  one: Person;
  acts: boolean;
  sends: boolean;
  busy: boolean;
  missed: boolean;
  onAgain: () => void;
  onCopy: () => void;
  onMark: () => void;
}) {
  const note = noteOf(one);
  const changedActs = acts && one.brief === 'changed' && one.mobile != null;

  return (
    <span className="rs-link-cell">
      <BriefWord brief={one.brief} />
      {note != null && <span className="rs-trail">{note}</span>}
      {one.briefCopy != null && one.brief === 'changed' && <CopiedLine one={one} />}
      {missed && one.brief === 'changed' && (
        <span className="rs-missed">
          <Glyph name="alert" size={15} weight={2.2} />
          {BW.notCopied}
        </span>
      )}
      {changedActs && (
        <span className="rs-link-acts">
          {sends && !one.heldText && (
            <button
              id={`bf-again-${one.id}`}
              type="button"
              className="desk-text"
              aria-label={`${BW.sendAgain}: ${one.name}`}
              aria-haspopup="dialog"
              onClick={onAgain}
            >
              {BW.sendAgain}
            </button>
          )}
          <CopyButton id={`bf-row-copy-${one.id}`} one={one} busy={busy} onCopy={onCopy} />
          {one.briefCopy != null && !one.briefCopy.marked && (
            <MarkButton one={one} onMark={onMark} />
          )}
        </span>
      )}
    </span>
  );
}

function CopiedLine({ one }: { one: Person }) {
  if (one.briefCopy == null) return null;

  return (
    <span className="rs-trail bf-copied">
      <span className={one.briefCopy.marked ? 'rs-mark' : 'rs-mark is-copied'} aria-hidden="true" />
      {one.briefCopy.marked ? BW.markedBy(one.briefCopy.trail) : BW.copiedBy(one.briefCopy.trail)}
    </span>
  );
}

function CopyButton({
  id,
  one,
  busy,
  onCopy,
}: {
  id: string;
  one: Person;
  busy: boolean;
  onCopy: () => void;
}) {
  return (
    <button
      id={id}
      type="button"
      className={busy ? 'desk-text is-busy' : 'desk-text'}
      aria-label={`${BW.copy}: ${one.name}`}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      onClick={onCopy}
    >
      {busy && <span className="pending-spinner desk-turning" aria-hidden="true" />}
      {BW.copy}
    </button>
  );
}

function MarkButton({ one, onMark }: { one: Person; onMark: () => void }) {
  return (
    <button
      type="button"
      className="desk-text"
      aria-label={`${BW.markSent}: ${one.name}`}
      onClick={onMark}
    >
      {BW.markSent}
    </button>
  );
}

/** A link the browser would not copy, selected in a read-only field to copy by hand; "Link" where the row cannot hold the name. */
function HandHeld({ one, url, short = false }: { one: Person; url: string; short?: boolean }) {
  const id = `bf-held-${one.id}`;

  return (
    <span className="rs-held">
      <span className="rs-held-says">
        <Glyph name="alert" size={16} weight={2.2} />
        {BW.refused}
      </span>
      <label htmlFor={id} className="rs-held-label">
        {short ? BW.link : BW.linkFor(one.name)}
      </label>
      <input
        id={id}
        aria-label={BW.linkFor(one.name)}
        className="rs-held-field"
        type="text"
        readOnly
        value={url}
        onFocus={(event) => event.currentTarget.select()}
      />
    </span>
  );
}

function CopyRow({
  one,
  acts,
  busy,
  missed,
  handHeld,
  onCopy,
  onMark,
  brief = true,
}: {
  one: Person;
  acts: boolean;
  busy: boolean;
  missed: boolean;
  handHeld: string | null;
  onCopy: () => void;
  onMark: () => void;
  brief?: boolean;
}) {
  const note = noteOf(one);

  return (
    <li className="bf-copy-row">
      <div className="bf-copy-who">
        <p className="bf-copy-name">{one.name}</p>
        {brief && (
          <p className="bf-copy-shift">
            {[one.job, one.shift, one.station].filter(Boolean).join(' · ')}
            <span className="bf-pill">{BW.notBuilt}</span>
          </p>
        )}
        {brief && (
          <span className="bf-copy-state">
            <BriefWord brief={one.brief} />
            {note != null && <span className="rs-trail">{note}</span>}
          </span>
        )}
        <CopiedLine one={one} />
        {missed && (
          <span className="rs-missed">
            <Glyph name="alert" size={15} weight={2.2} />
            {BW.notCopied}
          </span>
        )}
        {handHeld != null && <HandHeld one={one} url={handHeld} short />}
      </div>
      {acts && (
        <span className="bf-copy-acts">
          <CopyButton id={`bf-copy-${one.id}`} one={one} busy={busy} onCopy={onCopy} />
          {one.briefCopy != null && !one.briefCopy.marked && (
            <MarkButton one={one} onMark={onMark} />
          )}
        </span>
      )}
    </li>
  );
}

function PanelHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="mn-panel-top">
      <div className="mn-panel-names">
        <p className="mn-eyebrow">{BW.card}</p>
        <h2 id="sn-panel-title" tabIndex={-1}>
          {title}
        </h2>
      </div>
      <button type="button" className="ev-round mn-close" aria-label={BW.close} onClick={onClose}>
        <Glyph name="clear" size={16} weight={2.4} />
      </button>
    </div>
  );
}

function CopyPanel({
  people,
  loading,
  acts,
  busy,
  missed,
  handHeld,
  onCopy,
  onMark,
  onClose,
}: {
  people: readonly Person[];
  loading: boolean;
  acts: boolean;
  busy: string | null;
  missed: string | null;
  handHeld: { id: string; url: string } | null;
  onCopy: (id: string) => void;
  onMark: (id: string) => void;
  onClose: () => void;
}) {
  const listed = onShift(people);

  return (
    <>
      <PanelHead title={BW.copyTitle} onClose={onClose} />
      <div className="mn-panel-body" aria-busy={loading || undefined}>
        {loading ? (
          <div className="bf-bones" role="status">
            <p className="visually-hidden">{BW.loading}</p>
            {[0, 1, 2, 3].map((at) => (
              <span key={at} className="bf-bone" aria-hidden="true" />
            ))}
          </div>
        ) : listed.length === 0 ? (
          <div className="rs-empty">
            <Glyph name="staff" size={28} weight={2} />
            <p className="rs-empty-title">{BW.nobody}</p>
            <button type="button" className="gs-pill is-secondary" onClick={onClose}>
              {BW.giveShift}
            </button>
          </div>
        ) : (
          <>
            <p className="mn-sub">{BW.copySub}</p>
            <ul className="bf-copy-list">
              {listed.map((one) => (
                <CopyRow
                  key={one.id}
                  one={one}
                  acts={acts}
                  busy={busy === one.id}
                  missed={missed === one.id}
                  handHeld={handHeld?.id === one.id ? handHeld.url : null}
                  onCopy={() => onCopy(one.id)}
                  onMark={() => onMark(one.id)}
                />
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}

function RulesPanel({
  rules,
  draft,
  manage,
  cut,
  saved,
  onEdit,
  onType,
  onSave,
  onCancel,
  onClose,
}: {
  rules: string;
  draft: string | null;
  manage: boolean;
  cut: boolean;
  saved: boolean;
  onEdit: () => void;
  onType: (next: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const count = draft == null ? null : countLine(draft);

  return (
    <>
      <PanelHead title={BW.rules} onClose={onClose} />
      <div className="mn-panel-body">
        {saved && (
          <p className="bf-saved">
            <Glyph name="tick" size={16} weight={2.6} />
            {BW.saved}
          </p>
        )}
        {draft == null ? (
          <>
            {rules === '' ? (
              <div className="bf-rules-empty">
                <p className="rs-empty-title">{BW.rulesNone}</p>
                <p className="mn-sub">{BW.rulesWhere}</p>
              </div>
            ) : (
              <>
                <p className="mn-sub">{BW.rulesWhere}</p>
                <p className="bf-rules">{rules}</p>
              </>
            )}
            {manage && (
              <button type="button" className="gs-pill is-secondary" onClick={onEdit}>
                {BW.editRules}
              </button>
            )}
          </>
        ) : (
          <div className="bf-rules-edit">
            <label htmlFor="bf-rules-box" className="gs-label">
              {BW.rulesLabel}
            </label>
            <p className="mn-sub" id="bf-rules-where">
              {BW.rulesWhere}
            </p>
            <textarea
              id="bf-rules-box"
              className="desk-box bf-rules-box"
              rows={10}
              value={draft}
              aria-describedby={`bf-rules-where${count != null ? ' bf-rules-count' : ''}${cut ? ' bf-rules-cut' : ''}`}
              onChange={(event) => onType(event.currentTarget.value)}
            />
            {count != null && (
              <p id="bf-rules-count" className={count.limit ? 'bf-count is-limit' : 'bf-count'}>
                {count.limit && <Glyph name="warn" size={15} weight={2.4} />}
                {count.words}
              </p>
            )}
            {cut && (
              <p id="bf-rules-cut" className="bf-count is-limit">
                <Glyph name="warn" size={15} weight={2.4} />
                {BW.cut}
              </p>
            )}
          </div>
        )}
      </div>
      {draft != null && (
        <div className="mn-panel-foot">
          <div className="mn-panel-acts">
            <button type="button" className="desk-text" onClick={onCancel}>
              {BW.cancel}
            </button>
            <Pill label={BW.save} primary onClick={onSave} />
          </div>
        </div>
      )}
    </>
  );
}

function PreviewPanel({
  people,
  one,
  rules,
  event,
  onPick,
  onClose,
}: {
  people: readonly Person[];
  one: Person;
  rules: string;
  event: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [starts, ends] = (one.shift ?? '').split(' to ');

  return (
    <>
      <PanelHead title={BW.previewAs} onClose={onClose} />
      <div className="mn-panel-body">
        <label htmlFor="bf-preview-who" className="gs-label">
          {BW.previewWho}
        </label>
        <Select
          id="bf-preview-who"
          value={one.id}
          shown={one.name}
          options={people.map((person) => ({ value: person.id, label: person.name }))}
          onChange={onPick}
        />
        <p className="bf-banner">
          <Glyph name="eye" size={16} weight={2.3} />
          {BW.previewBanner}
        </p>
        <div className="bf-phone" aria-label={`${one.name}’s page`} role="group">
          <p className="myn-event">{event}</p>
          {one.shift == null ? (
            <section className="myn-card">
              <p className="myn-big">{BW.previewNoShift('Saturday')}</p>
            </section>
          ) : (
            <>
              <p className="bf-phone-on">
                <span className="myn-on-label">{MN.onTonight}</span>{' '}
                <span className="myn-on-station">{one.station ?? one.job}</span>
              </p>
              <section className="myn-card">
                <p className="bf-phone-h">{MN.yourShift}</p>
                <p className="myn-big">{one.job}</p>
                <p className="myn-time">{MN.times(starts ?? '', ends ?? '')}</p>
              </section>
              <section className="myn-card">
                <p className="bf-phone-h">{MN.yourLead}</p>
                {one.id === 'ifeoma' ? (
                  <p className="myn-quiet">{MN.noLead}</p>
                ) : (
                  <p className="myn-big">Ifeoma Nduka · {MN.floorLead}</p>
                )}
              </section>
            </>
          )}
          {rules !== '' && (
            <section className="myn-card">
              <p className="bf-phone-h">{MN.beforeYouStart}</p>
              <p className="myn-rules">{rules}</p>
            </section>
          )}
        </div>
      </div>
    </>
  );
}

function CheckBody({
  costs,
  at,
  billing,
  sending,
  failed,
  tell,
  onRetry,
  onCopy,
}: {
  costs: Check;
  at: BriefingStart['checkAt'];
  billing: boolean;
  sending: boolean;
  failed: boolean;
  tell: Tell;
  onRetry: () => void;
  onCopy: () => void;
}) {
  const short = costs.smsWaits + costs.whatsAppWaits > 0;

  return (
    <div className="rs-check bf-check" aria-busy={at === 'loading' || sending || undefined}>
      {at === 'loading' ? (
        <p className="bf-working" role="status">
          <span className="pending-spinner desk-turning" aria-hidden="true" />
          {BW.working}
        </p>
      ) : at === 'failed' ? (
        <div className="bf-check-failed" role="alert">
          <p className="rs-missed">
            <Glyph name="alert" size={15} weight={2.2} />
            {BW.costFailed}
          </p>
          <button type="button" className="gs-pill is-secondary" onClick={onRetry}>
            {BW.tryAgain}
          </button>
        </div>
      ) : (
        <>
          <p className="bf-check-people">{BW.people(costs.people)}</p>
          {costs.noMobile > 0 && (
            <p className="rs-check-hint">{BW.noMobileCount(costs.noMobile)}</p>
          )}
          <ul className="bf-check-lines">
            {costs.sms.n > 0 && <li>{BW.smsLine(costs.sms.n, costs.sms.credits)}</li>}
            {costs.whatsApp != null && costs.whatsApp.n > 0 && (
              <li>{BW.whatsAppLine(costs.whatsApp.n, costs.whatsApp.credits)}</li>
            )}
            <li className="bf-check-total">{BW.totalLine(costs.credits)}</li>
          </ul>
          <p className="rs-check-credits">{BW.after(costs.after)}</p>
          {short && (
            <div className="rs-check-short">
              {costs.whatsAppWaits > 0 && (
                <p className="rs-check-wait">
                  <Glyph name="clock" size={15} weight={2.2} />
                  {BW.whatsAppWaits(costs.whatsAppWaits)}
                </p>
              )}
              {costs.smsWaits > 0 && (
                <p className="rs-check-wait">
                  <Glyph name="clock" size={15} weight={2.2} />
                  {BW.smsWaits(costs.smsWaits)}
                </p>
              )}
              <button
                type="button"
                className="desk-text"
                onClick={() =>
                  tell(`${billing ? BW.addCredits : BW.askOwner} has its own design (sc-3963).`)
                }
              >
                {billing ? BW.addCredits : BW.askOwner}
              </button>
            </div>
          )}
          <p className="rs-check-hint">{BW.usage}</p>
          {failed && (
            <p className="rs-missed" role="alert">
              <Glyph name="alert" size={15} weight={2.2} />
              {BW.sendFailed}
            </p>
          )}
          <button type="button" className="desk-text bf-check-copy" onClick={onCopy}>
            {BW.copy}
          </button>
        </>
      )}
    </div>
  );
}
