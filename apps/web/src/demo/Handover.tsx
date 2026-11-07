import {
  type KeyboardEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { offButton } from '../offButton.ts';
import type { SampleEvent } from './events.ts';
import { Glyph } from '../components/Glyph.tsx';
import {
  type AskWords,
  HANDOVER_WORDS as H,
  type HandStart,
  HELD_MS,
  LISTED,
  matching,
  SEARCH_ABOVE,
  SEND_MS,
  whoWords,
} from './handover.ts';
import type { Person } from './members.ts';
import { noMatchLine } from './people.ts';
import { fold } from './switcher.ts';
import { Ask, Head, RowWords, TextAction } from '../components/SettingsParts.tsx';
import { useLater } from '../useLater.ts';
import './handover.css';

type Who = Pick<Person, 'id' | 'name' | 'initials' | 'tone'>;

const fieldIn = (box: HTMLElement | null) => box?.querySelector<HTMLInputElement>('input') ?? null;
const optionsIn = (box: HTMLElement | null) => [
  ...(box?.querySelectorAll<HTMLElement>('[role=option]') ?? []),
];

/** Members' one confirm with the handover in it (sc-614, A): who leads what, who takes it, and what will move. */
export function HandoverAsk({
  words,
  nobody = false,
  events,
  offered,
  viewer,
  start,
  onKeep,
  onDone,
}: {
  words: AskWords;
  nobody?: boolean;
  events: readonly SampleEvent[];
  offered: readonly Who[];
  viewer: string;
  start: HandStart;
  onKeep: () => void;
  onDone: (to: string | null) => void;
}) {
  const later = useLater();
  const landing = useId();
  const [to, setTo] = useState(start.to);
  const [phase, setPhase] = useState(start.phase === 'held' ? 'sending' : start.phase);
  const [held] = useState(start.phase === 'held');
  const done = useRef(onDone);
  const first = useMemo(
    () => ({
      get current() {
        return document.getElementById(landing);
      },
    }),
    [landing],
  );
  const count = events.length;
  const sending = phase === 'sending';

  useLayoutEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    if (!held) return;
    const timer = setTimeout(() => done.current(start.to), HELD_MS);

    return () => clearTimeout(timer);
  }, [held, start.to]);

  return (
    <Ask
      title={words.title}
      line={words.lead}
      keep={words.keep}
      go={words.go}
      red={words.red}
      busy={sending ? words.busy : undefined}
      failed={phase === 'failed' ? words.failed : undefined}
      first={start.menu ? first : undefined}
      onKeep={onKeep}
      onGo={() => {
        setPhase('sending');
        later(SEND_MS, () => done.current(to));
      }}
    >
      <HandTo
        nobody={nobody}
        people={offered}
        picked={to}
        viewer={viewer}
        count={count}
        off={sending}
        start={start}
        landing={landing}
        onPick={setTo}
      />
      <Moves events={events} />
      <p>{words.last}</p>
    </Ask>
  );
}

/** What will move: the first five, soonest first, then how many more. The confirm never scrolls inside itself. */
function Moves({ events }: { events: readonly SampleEvent[] }) {
  const more = events.length - LISTED;

  return (
    <div>
      <ul className="handover-moves" aria-label={H.willMove(events.length)}>
        {events.slice(0, LISTED).map((event) => (
          <li key={event.id}>
            <span className={`handover-tile today-cover is-${event.mesh}`} aria-hidden="true" />
            {event.name}
          </li>
        ))}
      </ul>
      {more > 0 && <p className="handover-more">{H.more(more)}</p>}
    </div>
  );
}

function Face({ who }: { who: Who | null }) {
  return who == null ? (
    <span className="handover-face is-nobody" aria-hidden="true">
      <Glyph name="people" size={20} weight={2.2} />
    </span>
  ) : (
    <span className={`handover-face desk-avatar tone${who.tone % 5}`} aria-hidden="true">
      {who.initials}
    </span>
  );
}

/** Who takes them: a button that drops Members' menu of people, a listbox (WAI-ARIA APG), with a search above 15. */
function HandTo({
  nobody,
  people,
  picked,
  viewer,
  count,
  off,
  start,
  landing,
  onPick,
}: {
  nobody: boolean;
  people: readonly Who[];
  picked: string | null;
  viewer: string;
  count: number;
  off: boolean;
  start: HandStart;
  landing: string;
  onPick: (to: string | null) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(start.menu);
  const [query, setQuery] = useState(start.query);
  const [heard, setHeard] = useState<{ query: string; words: string } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const into = useRef<'picked' | 'last' | null>(null);
  const typed = useRef({ text: '', at: 0 });
  const searchable = people.length > SEARCH_ABOVE;
  const wanted = searchable ? query : '';
  const shown = people.filter((one) => matching(one.name, wanted));
  const choices: (Who | null)[] = [...(nobody && wanted.trim() === '' ? [null] : []), ...shown];
  const current = people.find((one) => one.id === picked) ?? null;
  const words = whoWords(current, viewer, count);
  const said = heard != null && heard.query === wanted ? heard.words : '';

  useLayoutEffect(() => {
    const where = into.current;
    into.current = null;
    typed.current = { text: '', at: 0 };
    if (!open || where == null) return;
    if (searchable) return void fieldIn(menu.current)?.focus();

    const all = optionsIn(menu.current);
    const on = all.find((one) => one.getAttribute('aria-selected') === 'true') ?? all[0];
    (where === 'last' ? all.at(-1) : on)?.focus();
  }, [open, searchable]);

  useLayoutEffect(() => {
    const drop = menu.current;
    if (!open || drop == null) return;

    const fit = () => {
      const room = window.innerHeight - drop.getBoundingClientRect().top - 16;
      drop.style.setProperty('max-height', `${Math.max(160, room)}px`);
    };
    fit();
    window.addEventListener('resize', fit);

    return () => window.removeEventListener('resize', fit);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);

    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  useEffect(() => {
    if (!open || !searchable || wanted.trim() === '') return;
    const words = shown.length === 0 ? noMatchLine(wanted) : H.matches(shown.length);
    const timer = setTimeout(() => setHeard({ query: wanted, words }), 500);

    return () => clearTimeout(timer);
  }, [open, searchable, wanted, shown.length]);

  function close(): void {
    setOpen(false);
    button.current?.focus();
  }

  function pick(one: Who | null): void {
    onPick(one?.id ?? null);
    close();
  }

  function clear(): void {
    setQuery('');
    fieldIn(menu.current)?.focus();
  }

  function moveOn(event: KeyboardEvent): void {
    const box = button.current?.closest('[role=alertdialog]');
    const all = [...(box?.querySelectorAll<HTMLElement>('input, button, a[href]') ?? [])].filter(
      (one) => !menu.current?.contains(one),
    );
    const at = all.indexOf(button.current as HTMLElement);

    setOpen(false);
    all[(at + (event.shiftKey ? -1 : 1) + all.length) % all.length]?.focus();
  }

  function jump(key: string, all: HTMLElement[], at: number): void {
    const now = Date.now();
    const text = now - typed.current.at < 500 ? typed.current.text + key : key;
    typed.current = { text, at: now };
    const from = text.length === 1 ? at + 1 : Math.max(at, 0);
    const order = all.map((_, step) => (from + step) % all.length);
    const hit = order.find((index) => {
      const one = choices[index];
      return one !== undefined && fold(whoWords(one, viewer, count)).startsWith(fold(text));
    });
    if (hit != null) all[hit]?.focus();
  }

  function keys(event: KeyboardEvent<HTMLElement>): void {
    const all = optionsIn(menu.current);
    const at = all.indexOf(event.currentTarget);
    const inField = event.currentTarget instanceof HTMLInputElement;

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        return close();
      case 'Tab':
        event.preventDefault();
        event.stopPropagation();
        return moveOn(event);
      case 'ArrowDown':
        event.preventDefault();
        return void (at < 0 ? all[0] : all[Math.min(at + 1, all.length - 1)])?.focus();
      case 'ArrowUp':
        event.preventDefault();
        return void (at > 0 ? all[at - 1] : searchable ? fieldIn(menu.current) : all[0])?.focus();
      case 'Home':
      case 'End':
        if (inField) return;
        event.preventDefault();
        return void (event.key === 'Home' ? all[0] : all.at(-1))?.focus();
      case 'Enter':
      case ' ':
        if (at < 0) return;
        event.preventDefault();
        return pick(choices[at] ?? null);
    }

    if (inField || event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    if (!searchable) return jump(event.key, all, at);
    setQuery((now) => now + event.key);
    fieldIn(menu.current)?.focus();
  }

  return (
    <div className="handover-to">
      <button
        ref={button}
        id={`${id}-who`}
        type="button"
        className={['handover-who', open && 'is-open', off && 'is-off'].filter(Boolean).join(' ')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-label={H.handTo(count, words)}
        {...offButton(off, { dim: false })}
        onClick={() => {
          if (open) return close();
          into.current = 'picked';
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (off || open || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
          event.preventDefault();
          into.current = event.key === 'ArrowUp' ? 'last' : 'picked';
          setOpen(true);
        }}
      >
        <Face who={current} />
        <span className="handover-who-name">{words}</span>
        <Glyph name="chevdown" size={18} weight={2.4} />
      </button>
      {open && (
        <div ref={menu} className="handover-menu">
          {searchable && (
            <div className="handover-search">
              <Glyph name="search" size={18} weight={2.2} />
              <input
                id={landing}
                type="search"
                aria-label={H.search}
                aria-controls={`${id}-list`}
                placeholder={H.search}
                value={query}
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={keys}
              />
              {query !== '' && (
                <button
                  type="button"
                  className="handover-clear"
                  aria-label={H.clearSearch}
                  onClick={clear}
                  onKeyDown={keys}
                >
                  <span className="handover-clear-disc" aria-hidden="true">
                    <Glyph name="clear" size={11} weight={3} />
                  </span>
                </button>
              )}
            </div>
          )}
          {choices.length === 0 ? (
            <div className="handover-none">
              <p>{noMatchLine(wanted)}</p>
              <button type="button" className="desk-text" onClick={clear} onKeyDown={keys}>
                {H.clearSearch}
              </button>
            </div>
          ) : (
            <ul
              id={`${id}-list`}
              role="listbox"
              aria-labelledby={`${id}-who`}
              className="handover-list"
            >
              {choices.map((one) => {
                const on = (one?.id ?? null) === picked;

                return (
                  <li
                    key={one?.id ?? 'nobody'}
                    id={on && !searchable ? landing : undefined}
                    role="option"
                    aria-selected={on}
                    tabIndex={-1}
                    className="handover-option"
                    onClick={() => pick(one)}
                    onKeyDown={keys}
                  >
                    <span className="handover-tick">
                      {on && <Glyph name="tick" size={16} weight={2.6} />}
                    </span>
                    <Face who={one} />
                    <span className="handover-option-name">{whoWords(one, viewer, count)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {searchable && (
            <p className="desk-unseen" role="status">
              {said}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** "Leads {n} events" on a suspended member's page, with Hand over now for those who may. */
export function LeadsBlock({
  events,
  onHandOver,
}: {
  events: readonly SampleEvent[];
  onHandOver: (() => void) | null;
}) {
  return (
    <section className="desk-block">
      <Head title={H.leadsHead(events.length)}>
        {onHandOver != null && <TextAction label={H.handOverNow} onClick={onHandOver} />}
      </Head>
      <ul className="desk-rows has-lead">
        {events.map((event) => (
          <li key={event.id} className="desk-row handover-event">
            <span
              className={`handover-tile is-row today-cover is-${event.mesh}`}
              aria-hidden="true"
            />
            <RowWords title={event.name} />
          </li>
        ))}
      </ul>
    </section>
  );
}
