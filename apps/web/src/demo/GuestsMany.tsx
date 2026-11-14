import { type FocusEvent, useEffect, useId, useReducer, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Glyph, type GlyphName } from '../components/Glyph.tsx';
import { Ask, Dialog, type Tell, TextAction } from '../components/SettingsParts.tsx';
import { focusWhenFree } from '../layers.ts';
import { DemoBell } from './DemoBell.tsx';
import { EventsShell } from './EventParts.tsx';
import { EventSidebar } from './EventSidebar.tsx';
import { CLOCKS, type SampleEvent, sampleEvent } from './events.ts';
import { GroupChips } from './GuestGroups.tsx';
import { SearchRow } from './Guests.tsx';
import { SelectBar, SelectRows, SelectedSaid } from './GuestsParts.tsx';
import { RMW, type Removed, UNDO_SECONDS, nextCount } from './guestRemove.ts';
import {
  GGW,
  type GroupFilter,
  type GuestGroup,
  groupCounts,
  groupLine,
  groupNameLength,
  groupProblem,
  makeGroup,
  sortedGroups,
} from './guestGroups.ts';
import {
  type Filter,
  type Guest,
  type Reply,
  WEDDING,
  countsOf,
  invitesOn,
  replyByOf,
  viewOf,
} from './guests.ts';
import { MW, companionsWith } from './guestsMark.ts';
import {
  type Action,
  type Line,
  MMW,
  type ManyStart,
  type ManyState,
  NEW_GROUP,
  type Sheet,
  type Target,
  lineWords,
  manyStart,
  manyStateOf,
  moveMany,
  onlyCompanions,
  over,
  removeMany,
  removeQuestion,
  shownGuests,
  undoMany,
} from './guestsMany.ts';
import { GW, REPLY_WORDS, figure } from './guestsWords.ts';
import './guests.css';
import './guestGroups.css';
import './guestsMark.css';
import './guestsMany.css';

const LINE_GLYPH: Record<Line['kind'], GlyphName> = {
  moved: 'tick',
  removed: 'tick',
  undone: 'tick',
  nothingRemoved: 'info',
  failed: 'alert',
};

const LINE_TONE: Record<Line['kind'], 'done' | 'quiet' | 'held'> = {
  moved: 'done',
  removed: 'done',
  undone: 'done',
  nothingRemoved: 'quiet',
  failed: 'held',
};

const EVERY_REPLY: ReadonlySet<Reply> = new Set<Reply>([
  'coming',
  'notSure',
  'noReply',
  'notComing',
  'notYet',
  'held',
  'walkIn',
]);

const NONE: ReadonlySet<string> = new Set();

/** sc-3776 on the web, from 1280 down to 320: a box on each guest, the bar with Add to group and Remove from the list, and the one line that says what happened. */
export function GuestsMany() {
  const [params] = useSearchParams();
  const state = manyStateOf(params.get('state'));

  return <ManyAt key={state} state={state} />;
}

function ManyAt({ state }: { state: ManyState }) {
  const [start] = useState(() => manyStart(state));
  const event = sampleEvent(WEDDING);

  if (event == null) return null;

  return (
    <EventsShell
      renderSide={(tell, covered) => (
        <EventSidebar event={event} area="guests" now={CLOCKS.rest} tell={tell} inert={covered} />
      )}
    >
      {(tell) => <ManyPage event={event} start={start} tell={tell} />}
    </EventsShell>
  );
}

function ManyPage({ event, start, tell }: { event: SampleEvent; start: ManyStart; tell: Tell }) {
  const root = useRef<HTMLDivElement>(null);
  const pending = useRef<string | null>(null);
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  const [list, setList] = useState<Guest[]>(start.list);
  const [groups, setGroups] = useState<GuestGroup[]>(start.groups);
  const [choice, setChoice] = useState<Filter>(start.choice);
  const [q, setQ] = useState(start.q);
  const [groupFilter, setGroupFilter] = useState<GroupFilter | null>(start.groupFilter);
  const [menu, setMenu] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(start.selected));
  const [pretend, setPretend] = useState(start.pretend);
  const [cleared, setCleared] = useState(start.cleared);
  const [sheet, setSheet] = useState<Sheet | null>(start.sheet);
  const [asking, setAsking] = useState(start.asking);
  const [line, setLine] = useState<Line | null>(start.line);
  const [undo, setUndo] = useState<Removed[] | null>(start.undo);
  const manages = start.manages;
  const counts = countsOf(list);
  const { view, shown } = viewOf(
    list,
    choice === 'changed' ? 'all' : choice,
    q,
    EVERY_REPLY,
    replyByOf(event.id),
    manages,
    false,
    groupFilter,
  );
  const ids = shownGuests(view);
  const everyone = ids.length > 0 && ids.every((id) => selected.has(id));
  const companions = companionsWith(list, selected);
  const count = pretend ?? selected.size;
  const undoing = line?.kind === 'removed' && undo != null;
  const looking = choice !== 'all' || q.trim() !== '' || groupFilter != null;
  const marks = invitesOn(event, CLOCKS.rest);

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

  /** A tab, a search or a filter changes what is shown, so nothing hidden stays selected (PM #5003). */
  function changeList(change: () => void): void {
    change();
    setMenu(false);
    if (selected.size === 0) return;
    setSelected(NONE);
    setPretend(null);
    setCleared(true);
  }

  function select(next: ReadonlySet<string>): void {
    setSelected(next);
    setPretend(null);
    setCleared(false);
    if (!undoing) setLine(null);
  }

  function toggle(id: string): void {
    const next = new Set(selected);

    if (next.has(id)) next.delete(id);
    else next.add(id);
    select(next);
  }

  function done(next: Line): void {
    setLine(next);
    setSheet(null);
    setAsking(false);
    focus('line');
  }

  function move(to: Target): void {
    let now = groups;
    let id: string;

    if ('id' in to) id = to.id;
    else {
      const made = makeGroup(groups, to.name);

      now = made.groups;
      id = made.group.id;
      setGroups(now);
    }
    const after = moveMany(list, selected, now, id, start.meanwhile);

    setList(after.list);
    setSelected(NONE);
    setUndo(null);
    done(after.line);
  }

  function remove(): void {
    const after = removeMany(list, selected);

    setList(after.list);
    setSelected(after.removed.length > 0 ? NONE : selected);
    setUndo(after.removed.length > 0 ? after.removed : null);
    done(after.line);
  }

  function act(action: Action): void {
    if (action.kind === 'move') move(action.to);
    else remove();
  }

  function pressAdd(): void {
    if (over(count)) return;
    setSheet({ pick: null, typed: '', tried: false });
  }

  function pressRemove(): void {
    if (over(count)) return;
    const asked = removeQuestion(list, selected);

    if (asked.goes === 0) {
      done({ kind: 'nothingRemoved', stayed: asked.stays });
      return;
    }
    setAsking(true);
  }

  function undone(): void {
    if (undo == null) return;
    setList(undoMany(list, undo));
    setUndo(null);
    done({ kind: 'undone', guests: undo.length });
  }

  function gone(): void {
    setUndo(null);
    setLine(null);
  }

  const asked = asking ? removeQuestion(list, selected) : null;
  const bar = manages && selected.size > 0 && (line == null || line.kind === 'undone');

  return (
    <div ref={root} className="desk-page ev-page gs gb">
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
          <SearchRow
            q={q}
            choice={choice}
            counts={counts}
            changed={0}
            menu={menu}
            onQ={(next) => changeList(() => setQ(next))}
            onChoice={(next) => changeList(() => setChoice(next))}
            onMenu={setMenu}
          />
          <GroupChips
            groups={groups}
            list={list}
            filter={groupFilter}
            onFilter={(next) => changeList(() => setGroupFilter(next))}
          />
          {looking && (
            <div className="gs-shown">
              <p>{GW.shown(shown, counts.all)}</p>
              <TextAction
                label={GW.clear}
                onClick={() =>
                  changeList(() => {
                    setQ('');
                    setChoice('all');
                    setGroupFilter(null);
                  })
                }
              />
            </div>
          )}
          <div role="status" className="gb-cleared">
            {cleared && (
              <div className="gm-line is-quiet">
                <Glyph name="info" size={18} weight={2.4} />
                <p>
                  <span>{MMW.cleared}</span>
                  <span className="gb-why">{MMW.clearedWhy}</span>
                </p>
              </div>
            )}
          </div>
          <SelectedSaid count={bar ? count : null} companions={companions} />
          {!manages && <p className="desk-note gb-note">{MMW.viewOnly}</p>}
          {manages && ids.length > 0 && (
            <label className="gs-tick gm-all">
              <input
                type="checkbox"
                className="gs-box"
                checked={everyone}
                data-focus="all"
                ref={(box) => {
                  if (box != null)
                    box.indeterminate = !everyone && ids.some((id) => selected.has(id));
                }}
                onChange={() => select(everyone ? NONE : new Set(ids))}
              />
              {MW.selectAll(ids.length)}
            </label>
          )}
          {manages && onlyCompanions(view) && <p className="desk-note gb-note">{MMW.heldNote}</p>}
          <div className="gm-dock gb-dock">
            <div className="gm-said" data-focus="line" tabIndex={-1} role="status">
              {line != null && (
                <ResultLine
                  line={line}
                  undo={undoing ? undo : null}
                  onUndo={undone}
                  onGone={gone}
                  onRetry={act}
                />
              )}
            </div>
            {bar && (
              <SelectBar
                count={count}
                companions={companions}
                pretend={pretend}
                onMark={marks ? () => tell(MMW.markTheirOwn) : null}
                onAdd={pressAdd}
                onRemove={pressRemove}
                onClear={() => {
                  select(NONE);
                  focus('all');
                }}
              />
            )}
          </div>
          {shown === 0 ? (
            <div className="gs-none">
              <h2>{GW.noMatch}</h2>
              <p className="desk-line">{GW.noMatchLine}</p>
            </div>
          ) : view.kind === 'groups' ? (
            view.groups.map((group) => (
              <section key={group.reply} className="gs-group" aria-label={REPLY_WORDS[group.reply]}>
                <h2 className="gs-group-head">
                  {REPLY_WORDS[group.reply]}
                  <span className="gs-group-count"> · {figure(group.count)}</span>
                </h2>
                <SelectRows
                  rows={group.rows}
                  groups={groups}
                  manages={manages}
                  selected={selected}
                  onToggle={toggle}
                />
              </section>
            ))
          ) : (
            <SelectRows
              rows={view.rows}
              groups={groups}
              manages={manages}
              selected={selected}
              onToggle={toggle}
            />
          )}
        </section>
      </div>
      {sheet != null && (
        <GroupSheet
          count={selected.size}
          list={list}
          groups={groups}
          start={sheet}
          onCancel={() => {
            setSheet(null);
            focus('add');
          }}
          onMove={move}
        />
      )}
      {asked != null && asked.goes > 0 && (
        <RemoveMany
          asked={asked}
          onKeep={() => {
            setAsking(false);
            focus('remove');
          }}
          onRemove={remove}
        />
      )}
    </div>
  );
}

/** The line that takes the bar's place: a shape and a word, never colour alone. After a remove it holds Undo for 10 seconds, paused while it has focus or the pointer. */
function ResultLine({
  line,
  undo,
  onUndo,
  onGone,
  onRetry,
}: {
  line: Line;
  undo: readonly Removed[] | null;
  onUndo: () => void;
  onGone: () => void;
  onRetry: (action: Action) => void;
}) {
  const [left, setLeft] = useState(UNDO_SECONDS);
  const focused = useRef(false);
  const pointed = useRef(false);
  const end = useRef(onGone);
  const open = undo != null;

  useEffect(() => {
    end.current = onGone;
  }, [onGone]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(
      () => setLeft((was) => nextCount(was, focused.current || pointed.current)),
      1000,
    );

    return () => window.clearInterval(timer);
  }, [open]);

  useEffect(() => {
    if (open && left === 0) end.current();
  }, [open, left]);

  function blurred(event: FocusEvent<HTMLDivElement>): void {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    focused.current = false;
  }

  return (
    <div
      className={`gm-line is-${LINE_TONE[line.kind]}`}
      onPointerEnter={() => {
        pointed.current = true;
      }}
      onPointerLeave={() => {
        pointed.current = false;
      }}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={blurred}
    >
      <Glyph name={LINE_GLYPH[line.kind]} size={18} weight={2.4} />
      <p>
        {lineWords(line).map((words) => (
          <span key={words}>{words}</span>
        ))}
        {open && <span className="visually-hidden">{MMW.undoOpen}</span>}
      </p>
      {open && (
        <>
          <span className="gb-count" aria-hidden="true">
            {RMW.secondsLeft(left)}
          </span>
          <button type="button" className="gs-pill is-secondary" data-focus="undo" onClick={onUndo}>
            {RMW.undo}
          </button>
        </>
      )}
      {line.kind === 'failed' && (
        <TextAction label={MW.tryAgain} onClick={() => onRetry(line.action)} />
      )}
    </div>
  );
}

/** Add to group: the event's groups with how many people each holds, then New group, whose name is checked before anything is sent (sc-3775). */
function GroupSheet({
  count,
  list,
  groups,
  start,
  onCancel,
  onMove,
}: {
  count: number;
  list: readonly Guest[];
  groups: readonly GuestGroup[];
  start: Sheet;
  onCancel: () => void;
  onMove: (to: Target) => void;
}) {
  const name = useId();
  const [pick, setPick] = useState(start.pick);
  const [typed, setTyped] = useState(start.typed);
  const [tried, setTried] = useState(start.tried);
  const first = useRef<HTMLInputElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const people = new Map(
    groupCounts(list, groups).rows.map((row) => [row.group?.id ?? '', row.people]),
  );
  const fresh = pick === NEW_GROUP;
  const problem = fresh ? groupProblem(groups, typed) : null;
  const wrong = tried
    ? pick == null
      ? MMW.chooseOne
      : problem == null
        ? null
        : groupLine(groups, typed, problem)
    : null;

  function confirm(): void {
    if (pick == null) {
      setTried(true);
      first.current?.focus();
      return;
    }
    if (pick !== NEW_GROUP) {
      onMove({ id: pick });
      return;
    }
    if (problem != null) {
      setTried(true);
      field.current?.focus();
      return;
    }
    onMove({ name: typed.trim() });
  }

  return (
    <Dialog
      title={MMW.groupTitle(count)}
      verb={MW.addToGroup}
      first={start.pick === NEW_GROUP ? field : first}
      onDismiss={onCancel}
      onConfirm={confirm}
    >
      <p className="desk-line gb-sheet-line">{MMW.groupLine}</p>
      <fieldset
        className="gs-fieldset"
        aria-describedby={wrong != null && pick == null ? `${name}-error` : undefined}
      >
        <legend className="gs-inset-title">{MMW.groupList}</legend>
        <div className="gs-ways gb-groups">
          {sortedGroups(groups).map((group, index) => (
            <label key={group.id} className={tried && pick == null ? 'gs-way is-wrong' : 'gs-way'}>
              <input
                ref={index === 0 ? first : undefined}
                type="radio"
                className="desk-radio"
                name={name}
                checked={pick === group.id}
                onChange={() => setPick(group.id)}
              />
              <span className="gb-group">
                {group.name}
                <span className="gb-people">{MMW.people(people.get(group.id) ?? 0)}</span>
              </span>
            </label>
          ))}
          <label className={tried && pick == null ? 'gs-way is-wrong' : 'gs-way'}>
            <input
              ref={groups.length === 0 ? first : undefined}
              type="radio"
              className="desk-radio"
              name={name}
              checked={fresh}
              onChange={() => setPick(NEW_GROUP)}
            />
            {MMW.newGroup}
          </label>
        </div>
      </fieldset>
      {fresh && (
        <div className="desk-field gg-name gb-new">
          <label htmlFor={`${name}-new`} className="desk-label gs-label">
            {MMW.groupName}
          </label>
          <div className={wrong == null ? 'desk-box' : 'desk-box is-wrong'}>
            <input
              ref={field}
              id={`${name}-new`}
              type="text"
              value={typed}
              autoComplete="off"
              spellCheck={false}
              placeholder={GGW.placeholder}
              aria-invalid={wrong != null}
              aria-describedby={[`${name}-count`, wrong == null ? null : `${name}-error`]
                .filter(Boolean)
                .join(' ')}
              onChange={(change) => setTyped(change.target.value)}
            />
          </div>
          <p id={`${name}-count`} className="desk-help">
            {GGW.ofMost(groupNameLength(typed))}
          </p>
        </div>
      )}
      {wrong != null && (
        <p id={`${name}-error`} className="desk-error">
          <Glyph name="alert" size={15} weight={2.2} />
          {wrong}
        </p>
      )}
    </Dialog>
  );
}

/** Remove {n} guests and their {m} companions? Who has replied, who goes with them, and by name who has arrived and stays; Keep on the list first. */
function RemoveMany({
  asked,
  onKeep,
  onRemove,
}: {
  asked: ReturnType<typeof removeQuestion>;
  onKeep: () => void;
  onRemove: () => void;
}) {
  const id = useId();

  return (
    <Ask
      title={MMW.removeTitle(asked.goes, asked.companions)}
      keep={MMW.keep}
      go={MMW.go(asked.goes)}
      red={false}
      describedBy={`${id}-goes`}
      onKeep={onKeep}
      onGo={onRemove}
    >
      <ul id={`${id}-goes`} className="gb-goes">
        {asked.replied > 0 && <li>{MMW.replied(asked.replied)}</li>}
        {asked.companions > 0 && <li>{MMW.companionsGo(asked.companions)}</li>}
        {asked.stays.length > 0 && <li>{MMW.stays(asked.stays)}</li>}
        <li>{MMW.nothingSent}</li>
      </ul>
    </Ask>
  );
}
