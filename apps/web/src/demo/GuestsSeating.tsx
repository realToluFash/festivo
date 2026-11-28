import { type KeyboardEvent, useEffect, useId, useReducer, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { Chevron, Dialog, RowWords, type Tell, TextAction } from '../components/SettingsParts.tsx';
import { focusWhenFree } from '../layers.ts';
import { DemoBell } from './DemoBell.tsx';
import { EventsShell } from './EventParts.tsx';
import { EventSidebar } from './EventSidebar.tsx';
import { CLOCKS, type SampleEvent, sampleEvent } from './events.ts';
import { SearchRow } from './Guests.tsx';
import { MarkLead, SelectBar, SelectedSaid } from './GuestsParts.tsx';
import {
  type Filter,
  type Guest,
  type ListRow,
  type Reply,
  WEDDING,
  countsOf,
  viewOf,
} from './guests.ts';
import { MW, companionsWith } from './guestsMark.ts';
import {
  type Change,
  type Chooser,
  type Plan,
  type Result,
  SAMPLE_PLAN,
  STW,
  type SeatingStart,
  type SeatingState,
  type Seats,
  anyFree,
  assignTable,
  byTable,
  cellOf,
  colleagueRemoves,
  colleagueSeats,
  colleagueTakes,
  freeAt,
  goingOf,
  hasPlan,
  optionsOf,
  placeOf,
  previewOf,
  resultTone,
  resultWords,
  seatingStart,
  seatingStateOf,
  tableOf,
  undoAssign,
  unseat,
  unseatedOf,
} from './guestsSeating.ts';
import { GW, REPLY_WORDS, figure } from './guestsWords.ts';
import './guests.css';
import './guestGroups.css';
import './guestsMark.css';
import './guestsMany.css';
import './guestsSeating.css';

const EVERY_REPLY: ReadonlySet<Reply> = new Set<Reply>([
  'coming',
  'notSure',
  'noReply',
  'notComing',
  'notYet',
  'held',
  'walkIn',
]);

const BLUR_MS = 150;

/** sc-4025 on the web, at a desk and reflowed to 320: the list reads the plan (Table, Unseated, Seat) and seats many at one table at once. */
export function GuestsSeating() {
  const [params] = useSearchParams();
  const state = seatingStateOf(params.get('state'));

  return <SeatingAt key={state} state={state} />;
}

function SeatingAt({ state }: { state: SeatingState }) {
  const [start] = useState(() => seatingStart(state));
  const event = sampleEvent(WEDDING);

  if (event == null) return null;

  return (
    <EventsShell
      renderSide={(tell, covered) => (
        <EventSidebar event={event} area="guests" now={CLOCKS.rest} tell={tell} inert={covered} />
      )}
    >
      {(tell) => <SeatingPage event={event} start={start} tell={tell} />}
    </EventsShell>
  );
}

function flat(rows: readonly ListRow[][]): ListRow[] {
  return rows.flat();
}

/** Each guest's row with its companions' rows under it, so a sort never parts them. */
function parties(rows: readonly ListRow[]): ListRow[][] {
  const out: ListRow[][] = [];

  for (const row of rows) {
    const last = out.at(-1);

    if (row.indent && last != null) last.push(row);
    else out.push([row]);
  }

  return out;
}

function SeatingPage({
  event,
  start,
  tell,
}: {
  event: SampleEvent;
  start: SeatingStart;
  tell: Tell;
}) {
  const root = useRef<HTMLDivElement>(null);
  const pending = useRef<string | null>(null);
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  const list = start.list;
  const [plan, setPlan] = useState<Plan>(start.plan);
  const [seats, setSeats] = useState<Seats>(start.seats);
  const [choice, setChoice] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState(false);
  const [sort, setSort] = useState(start.sort);
  const [unseatedOnly, setUnseatedOnly] = useState(start.unseatedOnly);
  const [selected, setSelected] = useState<readonly string[]>(start.selected);
  const [chooser, setChooser] = useState<Chooser | null>(start.chooser);
  const [result, setResult] = useState<Result | null>(start.result);
  const [changes, setChanges] = useState<Change[] | null>(start.changes);
  const [details, setDetails] = useState<string | null>(start.details);
  const [unseated, setUnseated] = useState(start.unseated);
  const [told, setTold] = useState<string | null>(null);
  const planned = hasPlan(plan);
  const reads = start.reads && planned;
  const manages = start.manages && planned;
  const chosen = new Set(selected);
  const counts = countsOf(list);
  const { view } = viewOf(
    list,
    choice === 'changed' ? 'all' : choice,
    q,
    EVERY_REPLY,
    null,
    true,
    false,
    [],
  );
  const without = new Set(unseatedOf(list, seats));
  const byGroup =
    view.kind === 'groups' ? view.groups : [{ reply: null, count: 0, rows: view.rows }];
  const narrowed = (rows: readonly ListRow[]) =>
    reads && unseatedOnly
      ? parties(rows)
          .filter((party) => party.some((row) => without.has(row.person.id)))
          .flat()
      : [...rows];
  const tableOrder = byTable(plan, seats);

  function compareParties(a: readonly ListRow[], b: readonly ListRow[]): number {
    const one = a[0]?.person.guest;
    const two = b[0]?.person.guest;

    return one == null || two == null ? 0 : tableOrder(one, two);
  }
  const sortedRows =
    reads && sort === 'table'
      ? flat(
          parties(narrowed(byGroup.flatMap((group) => group.rows))).sort((a, b) =>
            compareParties(a, b),
          ),
        )
      : null;
  const ids = (sortedRows ?? byGroup.flatMap((group) => narrowed(group.rows)))
    .filter((row) => !row.indent)
    .map((row) => row.person.id);
  const everyone = ids.length > 0 && ids.every((id) => chosen.has(id));
  const companions = companionsWith(list, chosen);
  const bar = selected.length > 0;
  const shownDetails = list.find((one) => one.id === details) ?? null;

  function focus(...keys: string[]): void {
    pending.current = keys.join(' ');
    rerender();
  }

  useEffect(() => {
    const keys = pending.current;

    if (keys == null) return;
    pending.current = null;
    focusWhenFree(() => {
      for (const key of keys.split(' ')) {
        const found = root.current?.querySelector<HTMLElement>(`[data-focus="${key}"]`);

        if (found != null) return found;
      }

      return null;
    });
  });

  function changeList(change: () => void): void {
    change();
    setMenu(false);
    setSelected([]);
  }

  function toggle(id: string): void {
    setSelected((was) => (was.includes(id) ? was.filter((one) => one !== id) : [...was, id]));
  }

  function act(): void {
    setChanges(null);
    setUnseated(null);
    setTold(null);
  }

  function assign(table: string, freeWhenChosen: number | null): 'gone' | 'done' {
    const after = assignTable(list, plan, seats, selected, table, freeWhenChosen);

    if (after.kind === 'gone') return 'gone';
    act();
    setSeats(after.seats);
    setResult(after.result);
    setChanges(after.changes);
    setSelected([]);
    setChooser(null);
    focus('line');

    return 'done';
  }

  function undo(): void {
    if (changes == null) return;
    const back = undoAssign(plan, seats, changes);

    setSeats(back.seats);
    setResult(back.result);
    setChanges(null);
    focus('line');
  }

  function unseatOne(id: string): void {
    const seat = seats[id];

    if (seat == null) return;
    act();
    setResult(null);
    setUnseated({ ids: [id], seats, place: placeOf(plan, seat) });
    setSeats(unseat(seats, [id]));
    focus('unseat-undo');
  }

  function unseatUndo(): void {
    if (unseated == null) return;
    const before = unseated.seats;

    setSeats((now) => {
      const next = { ...now };

      for (const id of unseated.ids) {
        const was = before[id];

        if (was != null) next[id] = was;
      }

      return next;
    });
    setUnseated(null);
    focus('change', 'choose-seat');
  }

  function colleague(kind: 'seats' | 'removes' | 'takes' | 'first'): void {
    if (kind === 'seats') setSeats((now) => colleagueSeats(now, plan));
    if (kind === 'takes') setSeats((now) => colleagueTakes(now));
    if (kind === 'removes') {
      const after = colleagueRemoves(plan, seats);

      setPlan(after.plan);
      setSeats(after.seats);
    }
    if (kind === 'first') {
      setPlan({ tables: SAMPLE_PLAN.tables.slice(0, 1), rows: [] });
      setSeats({});
    }
    setTold(STW.colleagueDone);
  }

  const said = (
    <div className="gm-said" data-focus="line" tabIndex={-1} role="status">
      {result != null && (
        <SeatResult
          result={result}
          undo={changes != null && changes.length > 0}
          onUndo={undo}
          onClose={() => {
            setResult(null);
            setChanges(null);
            focus(ids.length > 0 ? 'all' : 'title');
          }}
        />
      )}
    </div>
  );
  const unseatedChip = reads && (
    <div className="gs-chips gs-filters gst-chips" role="group" aria-label={STW.unseated}>
      <button
        type="button"
        className={unseatedOnly ? 'gs-chip is-on' : 'gs-chip'}
        aria-pressed={unseatedOnly}
        aria-label={STW.unseatedCount(without.size)}
        data-focus="unseated"
        onClick={() => changeList(() => setUnseatedOnly(!unseatedOnly))}
      >
        {unseatedOnly && <Glyph name="tick" size={16} weight={2.6} />}
        <span className="gs-chip-word">{STW.unseated}</span>
        <span className="gst-badge" aria-hidden="true">
          {figure(without.size)}
        </span>
      </button>
    </div>
  );
  const rowsOf = (rows: readonly ListRow[]) => (
    <SeatRows
      rows={rows}
      plan={plan}
      seats={seats}
      reads={reads}
      boxes
      selected={chosen}
      opened={details}
      onToggle={toggle}
      onOpen={(id) => {
        setDetails(id);
        setUnseated(null);
        focus('details');
      }}
    />
  );

  return (
    <div ref={root} className="desk-page ev-page gs gb gst">
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
          <h1 className="gs-title" tabIndex={-1} data-focus="title">
            {GW.title}
          </h1>
        </header>
        <div className={shownDetails == null ? undefined : 'gs-cols'}>
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
            <div className="gst-tools">
              {unseatedChip}
              {reads && (
                <div className="gst-sort">
                  <label htmlFor="gst-sort" className="desk-label">
                    {STW.sortBy}
                  </label>
                  <div className="desk-box">
                    <select
                      id="gst-sort"
                      className="gst-select"
                      value={sort}
                      data-focus="sort"
                      onChange={(change) =>
                        setSort(change.target.value === 'table' ? 'table' : 'name')
                      }
                    >
                      <option value="name">{STW.sortName}</option>
                      <option value="table">{STW.sortTable}</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
            <SelectedSaid count={bar ? selected.length : null} companions={companions} />
            {start.reads && planned && !start.manages && (
              <p className="desk-note gb-note">{STW.viewOnly}</p>
            )}
            {ids.length > 0 && (
              <label className="gs-tick gm-all">
                <input
                  type="checkbox"
                  className="gs-box"
                  checked={everyone}
                  data-focus="all"
                  ref={(box) => {
                    if (box != null)
                      box.indeterminate = !everyone && ids.some((id) => chosen.has(id));
                  }}
                  onChange={() => setSelected(everyone ? [] : ids)}
                />
                {MW.selectAll(ids.length)}
              </label>
            )}
            <div className="gm-dock gb-dock">
              {said}
              {bar && (
                <SelectBar
                  count={selected.length}
                  companions={companions}
                  pretend={null}
                  onMark={start.live ? () => tell(STW.markTheirOwn) : null}
                  onAdd={() => tell(STW.addTheirOwn)}
                  onAssign={
                    manages
                      ? () => {
                          setChooser({
                            typed: '',
                            chosen: null,
                            open: true,
                            freeWhenChosen: null,
                            error: null,
                          });
                        }
                      : null
                  }
                  onRemove={() => tell(STW.addTheirOwn)}
                  onClear={() => {
                    setSelected([]);
                    focus('all');
                  }}
                />
              )}
            </div>
            {sortedRows != null
              ? rowsOf(sortedRows)
              : byGroup.map((group) => {
                  const rows = narrowed(group.rows);

                  if (rows.length === 0) return null;
                  if (group.reply == null) return <div key="rows">{rowsOf(rows)}</div>;

                  return (
                    <section
                      key={group.reply}
                      className="gs-group"
                      aria-label={REPLY_WORDS[group.reply]}
                    >
                      <h2 className="gs-group-head">
                        {REPLY_WORDS[group.reply]}
                        <span className="gs-group-count">
                          {' '}
                          · {figure(rows.filter((row) => !row.indent).length)}
                        </span>
                      </h2>
                      {rowsOf(rows)}
                    </section>
                  );
                })}
          </section>
          {shownDetails != null && (
            <SeatDetails
              guest={shownDetails}
              plan={plan}
              seats={seats}
              reads={reads}
              manages={manages}
              unseated={unseated}
              onUnseat={unseatOne}
              onUndo={unseatUndo}
              onClose={() => {
                setDetails(null);
                setUnseated(null);
                focus(`row:${shownDetails.id}`);
              }}
            />
          )}
        </div>
        {chooser == null && (
          <Colleague
            told={told}
            noTables={!planned && start.reads}
            canTake={changes != null && changes.some((one) => one.id === 'yusuf')}
            onAct={colleague}
          />
        )}
      </div>
      {chooser != null && (
        <SeatChooser
          list={list}
          plan={plan}
          seats={seats}
          order={selected}
          start={chooser}
          told={told}
          onColleague={colleague}
          onCancel={() => {
            setChooser(null);
            setTold(null);
            focus('assign');
          }}
          onAssign={assign}
        />
      )}
    </div>
  );
}

function SeatRows({
  rows,
  plan,
  seats,
  reads,
  boxes,
  selected,
  opened,
  onToggle,
  onOpen,
}: {
  rows: readonly ListRow[];
  plan: Plan;
  seats: Seats;
  reads: boolean;
  boxes: boolean;
  selected: ReadonlySet<string>;
  opened: string | null;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <ul className="desk-rows gs-rows">
      {rows.map((row) => {
        const boxed = boxes && row.person.companion == null;
        const cell = cellOf(plan, seats[row.person.id]);
        const label = reads ? `${row.label}, ${STW.column}: ${cell}` : row.label;

        return (
          <li
            key={row.person.id}
            className={row.indent ? 'is-companion' : boxed ? 'gm-pick' : undefined}
          >
            {boxed && (
              <label className="gm-box">
                <input
                  type="checkbox"
                  className="gs-box"
                  aria-label={row.label}
                  checked={selected.has(row.person.id)}
                  onChange={() => onToggle(row.person.id)}
                />
              </label>
            )}
            <button
              type="button"
              className="desk-row gs-row gst-row"
              aria-label={label}
              aria-expanded={opened === row.person.guest.id}
              data-focus={`row:${row.person.id}`}
              onClick={() => onOpen(row.person.guest.id)}
            >
              <MarkLead reply={row.person.reply} />
              <RowWords title={row.person.name} lines={[row.line]} />
              {reads && (
                <span
                  className={seats[row.person.id] == null ? 'gst-cell is-none' : 'gst-cell'}
                  aria-hidden="true"
                >
                  {cell}
                </span>
              )}
              <Chevron />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SeatDetails({
  guest,
  plan,
  seats,
  reads,
  manages,
  unseated,
  onUnseat,
  onUndo,
  onClose,
}: {
  guest: Guest;
  plan: Plan;
  seats: Seats;
  reads: boolean;
  manages: boolean;
  unseated: SeatingStart['unseated'];
  onUnseat: (id: string) => void;
  onUndo: () => void;
  onClose: () => void;
}) {
  const seat = seats[guest.id];
  const seating = `/demo/events/${WEDDING}/seating?guest=${guest.id}`;

  return (
    <section className="gs-column gst-details" aria-label={STW.details(guest.name)}>
      <header className="gst-details-top">
        <h2 className="gst-h2" tabIndex={-1} data-focus="details">
          {guest.name}
        </h2>
        <TextAction label={STW.closeDetails} onClick={onClose} />
      </header>
      <p className="desk-line">{REPLY_WORDS[guest.reply]}</p>
      {reads && (
        <section className="gst-seat" aria-labelledby={`seat-${guest.id}`}>
          <h3 id={`seat-${guest.id}`} className="gs-inset-title">
            {STW.seat}
          </h3>
          <div role="status">
            {unseated != null && unseated.ids.includes(guest.id) && (
              <div className="gst-band">
                <p>{STW.unseatedFrom(unseated.place)}</p>
                <button
                  type="button"
                  className="gs-pill is-secondary"
                  data-focus="unseat-undo"
                  onClick={onUndo}
                >
                  {STW.undo}
                </button>
              </div>
            )}
          </div>
          <p className="gst-place">{seat == null ? STW.noSeatYet : placeOf(plan, seat)}</p>
          {manages && (
            <div className="gst-seat-actions">
              {seat == null ? (
                <Link className="gs-pill is-secondary" to={seating} data-focus="choose-seat">
                  {STW.chooseSeat}
                </Link>
              ) : (
                <>
                  <Link className="gs-pill is-secondary" to={seating} data-focus="change">
                    {STW.change}
                  </Link>
                  <button
                    type="button"
                    className="gs-pill is-secondary"
                    onClick={() => onUnseat(guest.id)}
                  >
                    {STW.unseat}
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      )}
      {guest.companions.length > 0 && (
        <section className="gst-seat" aria-labelledby={`with-${guest.id}`}>
          <h3 id={`with-${guest.id}`} className="gs-inset-title">
            {STW.companions}
          </h3>
          <ul className="gst-companions">
            {guest.companions.map((one) => {
              const at = seats[one.id];

              return (
                <li key={one.id}>
                  <span className="gst-name">{one.name}</span>
                  {reads && (
                    <span className="desk-line">
                      {STW.companionSeat(at == null ? STW.noSeat : placeOf(plan, at))}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </section>
  );
}

function SeatResult({
  result,
  undo,
  onUndo,
  onClose,
}: {
  result: Result;
  undo: boolean;
  onUndo: () => void;
  onClose: () => void;
}) {
  const tone = resultTone(result);

  return (
    <div className={`gm-line gst-line is-${tone}`}>
      <span className={tone === 'done' ? 'gst-dot' : 'gst-square'} aria-hidden="true" />
      <p>
        {resultWords(result).map((words) => (
          <span key={words}>{words}</span>
        ))}
      </p>
      <div className="gst-line-actions">
        <TextAction label={STW.close} onClick={onClose} />
        {undo && (
          <button type="button" className="gs-pill is-secondary" data-focus="undo" onClick={onUndo}>
            {STW.undo}
          </button>
        )}
      </div>
    </div>
  );
}

function SeatChooser({
  list,
  plan,
  seats,
  order,
  start,
  told,
  onColleague,
  onCancel,
  onAssign,
}: {
  list: readonly Guest[];
  plan: Plan;
  seats: Seats;
  order: readonly string[];
  start: Chooser;
  told: string | null;
  onColleague: (kind: 'seats' | 'removes' | 'takes' | 'first') => void;
  onCancel: () => void;
  onAssign: (table: string, freeWhenChosen: number | null) => 'gone' | 'done';
}) {
  const id = useId();
  const field = useRef<HTMLInputElement>(null);
  const blurred = useRef<number | undefined>(undefined);
  const [typed, setTyped] = useState(start.typed);
  const [chosen, setChosen] = useState(start.chosen);
  const [freeWhenChosen, setFreeWhenChosen] = useState(start.freeWhenChosen);
  const [open, setOpen] = useState(start.open);
  const [active, setActive] = useState(0);
  const [error, setError] = useState(start.error);
  const going = goingOf(list, order);
  const options = optionsOf(plan, seats, chosen == null ? typed : '');
  const at = Math.min(active, Math.max(0, options.length - 1));
  const full = !anyFree(plan, seats);
  const showList = open;
  const table = chosen == null ? null : tableOf(plan, chosen);
  const preview = table == null ? null : previewOf(list, plan, seats, order, table.id);
  const wrong =
    error === 'blank'
      ? STW.chooseTable
      : error === 'full'
        ? STW.everyFull
        : error != null
          ? STW.gone(error.gone)
          : null;
  const emptyWords = full ? STW.everyFull : STW.noMatch(typed);

  useEffect(() => () => window.clearTimeout(blurred.current), []);

  function type(next: string): void {
    setTyped(next);
    setChosen(null);
    setFreeWhenChosen(null);
    setOpen(true);
    setActive(0);
    setError(null);
  }

  function choose(one: (typeof options)[number] | undefined): void {
    if (one == null) return;
    setTyped(one.name);
    setChosen(one.id);
    setFreeWhenChosen(freeAt(plan, seats, one.id));
    setOpen(false);
    setError(null);
  }

  function keys(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;

      setActive(Math.min(Math.max(0, at + step), Math.max(0, options.length - 1)));
    } else if (event.key === 'Enter' && showList) {
      event.preventDefault();
      choose(options[at]);
    } else if (event.key === 'Escape' && showList) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  }

  function confirm(): void {
    if (chosen == null) {
      setError(full ? 'full' : 'blank');
      field.current?.focus();
      return;
    }
    if (onAssign(chosen, freeWhenChosen) === 'gone') {
      setError({ gone: typed });
      setTyped('');
      setChosen(null);
      setFreeWhenChosen(null);
      field.current?.focus();
    }
  }

  return (
    <Dialog
      title={STW.title}
      verb={STW.assignTable}
      first={field}
      onDismiss={onCancel}
      onConfirm={confirm}
    >
      <p className="desk-line gb-sheet-line">{STW.going(going.guests, going.companions)}</p>
      <div className="desk-field gg-field gst-field">
        <label htmlFor={id} className="desk-label gs-label">
          {STW.field}
        </label>
        <div className={wrong == null ? 'desk-box gg-combo' : 'desk-box gg-combo is-wrong'}>
          <input
            ref={field}
            id={id}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showList}
            aria-controls={`${id}-list`}
            aria-activedescendant={
              showList && options.length > 0 ? `${id}-option-${at}` : undefined
            }
            aria-invalid={wrong != null}
            aria-describedby={wrong == null ? undefined : `${id}-error`}
            autoComplete="off"
            spellCheck={false}
            placeholder={STW.placeholder}
            value={typed}
            data-focus="table"
            onFocus={() => window.clearTimeout(blurred.current)}
            onClick={() => setOpen(true)}
            onBlur={() => {
              blurred.current = window.setTimeout(() => setOpen(false), BLUR_MS);
            }}
            onChange={(change) => type(change.target.value)}
            onKeyDown={keys}
          />
        </div>
        {showList && (
          <ul id={`${id}-list`} role="listbox" aria-label={STW.options} className="gg-options">
            {options.map((one, index) => (
              <li
                key={one.id}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={index === at}
                className={index === at ? 'gg-option gst-option is-active' : 'gg-option gst-option'}
                onPointerDown={(pointer) => pointer.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(one)}
                onKeyDown={(key) => {
                  if (key.key === 'Enter') choose(one);
                }}
              >
                <span className="gst-option-name">
                  {one.name}
                  {one.section != null && <span className="gst-section"> · {one.section}</span>}
                </span>
                <span className="gst-free">{STW.free(freeAt(plan, seats, one.id))}</span>
              </li>
            ))}
          </ul>
        )}
        {showList && options.length === 0 && <p className="desk-help gst-empty">{emptyWords}</p>}
        <p role="status" className="visually-hidden">
          {showList ? (options.length === 0 ? emptyWords : STW.optionsSaid(options.length)) : ''}
        </p>
        {wrong != null && (
          <p id={`${id}-error`} className="desk-error gst-error">
            <Glyph name="alert" size={15} weight={2.2} />
            {wrong}
          </p>
        )}
      </div>
      {preview != null && preview.moving.length > 0 && (
        <p className="desk-line gst-moving">{STW.willMove(preview.moving)}</p>
      )}
      {preview != null && preview.need > preview.free && (
        <p className="gst-short">
          <span className="gst-square" aria-hidden="true" />
          {STW.short(preview.need, preview.free)}
        </p>
      )}
      <Colleague told={told} inDialog noTables={false} canTake={false} onAct={onColleague} />
    </Dialog>
  );
}

function Colleague({
  told,
  inDialog = false,
  noTables,
  canTake,
  onAct,
}: {
  told: string | null;
  inDialog?: boolean;
  noTables: boolean;
  canTake: boolean;
  onAct: (kind: 'seats' | 'removes' | 'takes' | 'first') => void;
}) {
  if (!inDialog && !noTables && !canTake) return null;

  return (
    <aside className="gst-demo" aria-label={STW.demo}>
      <p className="gst-demo-title">{STW.demo}</p>
      <div className="gst-demo-actions">
        {inDialog && (
          <>
            <button type="button" className="gs-pill is-secondary" onClick={() => onAct('seats')}>
              {STW.colleagueSeats}
            </button>
            <button type="button" className="gs-pill is-secondary" onClick={() => onAct('removes')}>
              {STW.colleagueRemoves}
            </button>
          </>
        )}
        {canTake && (
          <button type="button" className="gs-pill is-secondary" onClick={() => onAct('takes')}>
            {STW.colleagueTakes}
          </button>
        )}
        {noTables && (
          <button type="button" className="gs-pill is-secondary" onClick={() => onAct('first')}>
            {STW.firstTable}
          </button>
        )}
      </div>
      <p className="desk-help" role="status">
        {told ?? ''}
      </p>
    </aside>
  );
}
