import { useEffect, useId, useReducer, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { Dialog, RowWords, type Tell, TextAction } from '../components/SettingsParts.tsx';
import { focusWhenFree } from '../layers.ts';
import { DemoBell } from './DemoBell.tsx';
import { EventsShell } from './EventParts.tsx';
import { EventSidebar } from './EventSidebar.tsx';
import { CLOCKS, type SampleEvent, sampleEvent } from './events.ts';
import {
  type Guest,
  type ListRow,
  type Reply,
  invitesOn,
  replyByOf,
  todayOf,
  viewOf,
} from './guests.ts';
import {
  type Line,
  type MarkStart,
  MW,
  type MarkState,
  companionsWith,
  lineWords,
  markMany,
  markStart,
  markStateOf,
  pressMark,
} from './guestsMark.ts';
import { MarkLead } from './GuestsParts.tsx';
import { GW, HOW_INVITED, type HowInvited, REPLY_WORDS, figure } from './guestsWords.ts';
import './guests.css';
import './guestsMark.css';

const EVERY_REPLY: ReadonlySet<Reply> = new Set<Reply>([
  'coming',
  'notSure',
  'noReply',
  'notComing',
  'notYet',
  'held',
  'walkIn',
]);

/** sc-46880 at a desk: the Guests list with sc-3776's selection bar, its Mark as invited first, the how question, and the line that takes the bar's place. */
export function GuestsMark() {
  const [params] = useSearchParams();
  const state = markStateOf(params.get('state'));

  return <MarkAt key={state} state={state} />;
}

function MarkAt({ state }: { state: MarkState }) {
  const [start] = useState(() => markStart(state));
  const sample = sampleEvent(start.event);

  if (sample == null) return null;
  const event: SampleEvent = start.paused ? { ...sample, status: 'paused' } : sample;

  return (
    <EventsShell
      renderSide={(tell, covered) => (
        <EventSidebar event={event} area="guests" now={CLOCKS.rest} tell={tell} inert={covered} />
      )}
    >
      {(tell) => <MarkPage event={event} start={start} tell={tell} />}
    </EventsShell>
  );
}

function MarkPage({ event, start, tell }: { event: SampleEvent; start: MarkStart; tell: Tell }) {
  const root = useRef<HTMLDivElement>(null);
  const pending = useRef<string | null>(null);
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  const [list, setList] = useState<Guest[]>(start.list);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(start.selected));
  const [pretend, setPretend] = useState(start.pretend);
  const [line, setLine] = useState<Line | null>(start.line);
  const stopped = start.line?.kind === 'notLive';
  const [dialog, setDialog] = useState(start.dialog);
  const today = todayOf(CLOCKS.rest);
  const marks = invitesOn(event, CLOCKS.rest) && !stopped;
  const count = pretend ?? selected.size;
  const { view } = viewOf(list, 'all', '', EVERY_REPLY, replyByOf(event.id), true);
  const groups = view.kind === 'groups' ? view.groups : [];
  const everyone = list.length > 0 && list.every((one) => selected.has(one.id));
  const asked = dialog == null ? null : pressMark(list, selected);

  function focus(key: string): void {
    pending.current = key;
    rerender();
  }

  useEffect(() => {
    const key = pending.current;

    if (key == null) return;
    pending.current = null;
    focusWhenFree(() => root.current?.querySelector<HTMLElement>(`[data-focus="${key}"]`) ?? null);
  });

  function select(next: ReadonlySet<string>): void {
    setSelected(next);
    setPretend(null);
    setLine(null);
  }

  function toggle(id: string): void {
    const next = new Set(selected);

    if (next.has(id)) next.delete(id);
    else next.add(id);
    select(next);
  }

  function press(): void {
    const result = pressMark(list, selected, count);

    if (result.kind === 'over') return;
    if (result.kind === 'nothing') {
      setLine({ kind: 'nothing', already: result.already });
      focus('line');
      return;
    }
    setDialog({ how: null, tried: false });
  }

  function save(how: HowInvited): void {
    const done = markMany(list, selected, how, today, start.meanwhile);

    setDialog(null);
    setList(done.list);
    setSelected(new Set());
    setLine(done.line);
    focus('line');
  }

  function cancel(): void {
    setDialog(null);
    focus('mark');
  }

  const shown = line != null && (line.kind === 'done' || selected.size > 0);
  const failed = line?.kind === 'failed' ? line : null;

  return (
    <div ref={root} className="desk-page ev-page gs">
      <div className="ev-wide gs-page">
        <div className="ev-crumb-row">
          <nav className="ev-crumb" aria-label={GW.crumb}>
            <ol>
              <li className="ev-crumb-part">
                <Link to="/demo/events">{GW.events}</Link>
              </li>
              <li className="ev-crumb-part">
                <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                <Link className="ev-crumb-name" to={`/demo/events/${event.id}`}>
                  {event.name}
                </Link>
              </li>
              <li className="ev-crumb-part" aria-current="page">
                <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                <span className="ev-crumb-name">{GW.title}</span>
              </li>
            </ol>
          </nav>
          <DemoBell tell={tell} />
        </div>
        <header className="gs-top">
          <h1 className="gs-title" tabIndex={-1}>
            {GW.title}
          </h1>
        </header>
        <section className="gs-list gm-list" aria-label={GW.title}>
          <label className="gs-tick gm-all">
            <input
              type="checkbox"
              className="gs-box"
              checked={everyone}
              ref={(box) => {
                if (box != null) box.indeterminate = !everyone && selected.size > 0;
              }}
              onChange={() => select(everyone ? new Set() : new Set(list.map((one) => one.id)))}
            />
            {MW.selectAll(list.length)}
          </label>
          <div className="gm-dock">
            <div className="gm-said" role="status" data-focus="line" tabIndex={-1}>
              {shown && (
                <div className={line.kind === 'done' ? 'gm-line is-done' : 'gm-line is-held'}>
                  <Glyph name={line.kind === 'done' ? 'tick' : 'alert'} size={18} weight={2.4} />
                  <p>
                    {lineWords(line).map((words) => (
                      <span key={words}>{words}</span>
                    ))}
                  </p>
                  {failed != null && (
                    <TextAction label={MW.tryAgain} onClick={() => save(failed.how)} />
                  )}
                </div>
              )}
            </div>
            {!shown && selected.size > 0 && (
              <section className="gm-bar" aria-label={MW.bar}>
                <p className="gm-count">
                  <strong>{MW.selected(count)}</strong>
                  {companionsWith(list, selected) > 0 && (
                    <span>{MW.withCompanions(companionsWith(list, selected))}</span>
                  )}
                </p>
                {count > 2000 && <p className="desk-line gm-narrow">{MW.narrowing}</p>}
                {pretend != null && <p className="desk-note gm-pretend">{MW.pretend(pretend)}</p>}
                <div className="gm-actions">
                  {marks && (
                    <button
                      type="button"
                      className="gs-pill is-primary"
                      data-focus="mark"
                      onClick={press}
                    >
                      {MW.markAsInvited}
                    </button>
                  )}
                  <button
                    type="button"
                    className="gs-pill is-secondary"
                    onClick={() => tell(MW.theirOwn)}
                  >
                    {MW.addToGroup}
                  </button>
                  <button
                    type="button"
                    className="gs-pill is-secondary"
                    onClick={() => tell(MW.theirOwn)}
                  >
                    {MW.remove}
                  </button>
                  <TextAction label={MW.clear} onClick={() => select(new Set())} />
                </div>
              </section>
            )}
          </div>
          {groups.map((group) => (
            <section key={group.reply} className="gs-group" aria-label={REPLY_WORDS[group.reply]}>
              <h2 className="gs-group-head">
                {REPLY_WORDS[group.reply]}
                <span className="gs-group-count"> · {figure(group.count)}</span>
              </h2>
              <Rows rows={group.rows} selected={selected} onToggle={toggle} />
            </section>
          ))}
        </section>
      </div>
      {dialog != null && asked?.kind === 'ask' && (
        <MarkDialog
          marks={asked.marks}
          already={asked.already}
          start={dialog}
          onCancel={cancel}
          onMark={save}
        />
      )}
    </div>
  );
}

/** A guest's row ticks them; a companion's has no box, since companions follow their host. */
function Rows({
  rows,
  selected,
  onToggle,
}: {
  rows: readonly ListRow[];
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <ul className="desk-rows gs-rows">
      {rows.map((row) =>
        row.person.companion == null ? (
          <li key={row.person.id}>
            <label className="desk-row gs-row gm-row">
              <input
                type="checkbox"
                className="gs-box"
                aria-label={row.label}
                checked={selected.has(row.person.id)}
                onChange={() => onToggle(row.person.id)}
              />
              <MarkLead reply={row.person.reply} />
              <RowWords title={row.person.name} lines={[row.line]} />
            </label>
          </li>
        ) : (
          <li key={row.person.id} className="is-companion">
            <div className="desk-row gs-row gm-row is-companion">
              <MarkLead reply={row.person.reply} />
              <RowWords title={row.person.name} lines={[row.line]} />
            </div>
          </li>
        ),
      )}
    </ul>
  );
}

/** How did you invite them? Nothing chosen; a blank press sends nothing and says so (WCAG 2.2 §3.3.1). */
function MarkDialog({
  marks,
  already,
  start,
  onCancel,
  onMark,
}: {
  marks: number;
  already: readonly string[];
  start: { how: HowInvited | null; tried: boolean };
  onCancel: () => void;
  onMark: (how: HowInvited) => void;
}) {
  const name = useId();
  const [picked, setPicked] = useState<HowInvited | null>(start.how);
  const [tried, setTried] = useState(start.tried);
  const first = useRef<HTMLInputElement>(null);
  const wrong = tried && picked == null;

  function confirm(): void {
    if (picked == null) {
      setTried(true);
      first.current?.focus();
      return;
    }
    onMark(picked);
  }

  return (
    <Dialog
      title={MW.title(marks)}
      verb={MW.markAsInvited}
      first={first}
      onDismiss={onCancel}
      onConfirm={confirm}
    >
      {already.length > 0 && <p className="desk-line gm-already">{MW.already(already)}</p>}
      <fieldset className="gs-fieldset" aria-describedby={wrong ? `${name}-error` : undefined}>
        <legend className="gs-inset-title">{GW.howInvited}</legend>
        <div className="gs-ways">
          {HOW_INVITED.map((how, index) => (
            <label key={how} className={wrong ? 'gs-way is-wrong' : 'gs-way'}>
              <input
                ref={index === 0 ? first : undefined}
                type="radio"
                className="desk-radio"
                name={name}
                checked={picked === how}
                onChange={() => setPicked(how)}
              />
              {how}
            </label>
          ))}
        </div>
      </fieldset>
      {wrong && (
        <p id={`${name}-error`} className="desk-error">
          <Glyph name="alert" size={15} weight={2.2} />
          {GW.howInvitedBlank}
        </p>
      )}
    </Dialog>
  );
}
