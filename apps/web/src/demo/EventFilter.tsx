import { EVENT_TYPES, type EventType } from '@soirely/domain';
import { useEffect, useId, useRef, useState } from 'react';

import {
  type Filters,
  type When,
  DISTINCT_HOSTS,
  EVENT_WORDS as W,
  NO_FILTERS,
  TYPE_WORDS,
  filterWord,
  filtering,
  whenOf,
  whenRange,
  whenWord,
} from './events.ts';
import { Glyph } from './Glyph.tsx';

type View = 'top' | 'type' | 'when' | 'host';

const VIEW_WORDS: Record<Exclude<View, 'top'>, string> = {
  type: W.type,
  when: W.when,
  host: W.hostedBy,
};

const WHENS: readonly [When, string][] = [
  ['any', W.anyTime],
  ['week', W.thisWeek],
  ['month', W.thisMonth],
  ['quarter', W.nextThreeMonths],
  ['between', W.between],
];

/** The one Filter menu, as Members' drills in: Type, When and Hosted by, each naming its choice; Clear filters once something is chosen. */
export function FilterMenu({
  filters,
  off,
  start,
  now,
  onFilters,
}: {
  filters: Filters;
  off: boolean;
  start: View | null;
  now: Date;
  onFilters: (next: Filters) => void;
}) {
  const id = useId();
  const [view, setView] = useState<View | null>(start);
  const [between, setBetween] = useState(whenOf(filters, now) === 'between');
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const from = useRef<View>('top');
  const word = filterWord(filters, now);
  const open = view != null;

  useEffect(() => {
    if (view == null) return;

    const items = () => [
      ...(menu.current?.querySelectorAll<HTMLElement>('[role^=menuitem]') ?? []),
    ];
    const close = (back: boolean) => {
      setView(null);
      if (back) button.current?.focus();
    };
    const keys = (event: KeyboardEvent) => {
      const all = items();
      const at = all.indexOf(document.activeElement as HTMLElement);

      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
      } else if (event.key === 'Tab') close(false);
      else if (event.key === 'ArrowLeft' && view !== 'top') {
        event.preventDefault();
        from.current = view;
        setView('top');
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (!(document.activeElement instanceof HTMLButtonElement) && at < 0) return;
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        const next = at < 0 ? (step > 0 ? 0 : all.length - 1) : at + step;
        all[(next + all.length) % all.length]?.focus();
      } else if (event.key === 'Home' || event.key === 'End') {
        if (at < 0) return;
        event.preventDefault();
        (event.key === 'Home' ? all[0] : all.at(-1))?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;

      if (!menu.current?.contains(target) && !button.current?.contains(target)) close(false);
    };

    document.addEventListener('keydown', keys);
    document.addEventListener('pointerdown', outside);

    return () => {
      document.removeEventListener('keydown', keys);
      document.removeEventListener('pointerdown', outside);
    };
  }, [view]);

  useEffect(() => {
    if (view == null) return;

    const all = [...(menu.current?.querySelectorAll<HTMLElement>('[role^=menuitem]') ?? [])];
    const back =
      view === 'top'
        ? menu.current?.querySelector<HTMLElement>(`[data-view=${from.current}]`)
        : null;

    (back ?? (view === 'top' ? all[0] : all[1]))?.focus();
  }, [view]);

  function drill(next: View): void {
    from.current = view ?? 'top';
    setView(next);
  }

  function toggle<T extends string>(list: readonly T[], one: T): T[] {
    return list.includes(one) ? list.filter((item) => item !== one) : [...list, one];
  }

  function when(next: When): void {
    setBetween(next === 'between');
    if (next === 'any') onFilters({ ...filters, from: '', to: '' });
    else if (next !== 'between') {
      const [first, last] = whenRange(next, now);
      onFilters({ ...filters, from: first, to: last });
    }
  }

  const picked = between ? 'between' : whenOf(filters, now);
  const top: readonly [Exclude<View, 'top'>, string][] = [
    [
      'type',
      filters.types.length === 0
        ? W.anyType
        : filters.types.map((type) => TYPE_WORDS[type]).join(', '),
    ],
    ['when', whenWord(filters, now)],
    ['host', filters.hosts.length === 0 ? W.anyone : filters.hosts.join(', ')],
  ];

  return (
    <div className="ev-filter-at">
      <button
        ref={button}
        type="button"
        className={off ? 'ev-filter is-off' : 'ev-filter'}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        aria-label={W.filterLabel(word)}
        aria-disabled={off}
        onClick={() => {
          if (off) return;
          from.current = 'top';
          setView(open ? null : 'top');
        }}
      >
        <Glyph name="filter" size={18} weight={2.2} />
        <span className="ev-filter-word">{word}</span>
        <Glyph name={open ? 'chevup' : 'chevdown'} size={16} weight={2.4} />
      </button>
      {open && (
        <div
          ref={menu}
          id={`${id}-menu`}
          className="ev-menu"
          role="menu"
          aria-label={view === 'top' ? W.filter : VIEW_WORDS[view]}
        >
          {view === 'top' ? (
            <>
              {top.map(([one, value]) => (
                <button
                  key={one}
                  type="button"
                  role="menuitem"
                  className="ev-menu-item"
                  data-view={one}
                  tabIndex={-1}
                  aria-haspopup="menu"
                  onClick={() => drill(one)}
                >
                  <span className="today-grow">{VIEW_WORDS[one]}</span>
                  <span className="ev-menu-value">{value}</span>
                  <Glyph name="chevron" size={16} weight={2.3} className="desk-chevron" />
                </button>
              ))}
              {filtering(filters) && (
                <>
                  <span className="ev-menu-rule" role="separator" />
                  <button
                    type="button"
                    role="menuitem"
                    className="ev-menu-item is-violet"
                    tabIndex={-1}
                    onClick={() => {
                      setBetween(false);
                      onFilters({ ...NO_FILTERS, q: filters.q });
                      setView(null);
                      button.current?.focus();
                    }}
                  >
                    {W.clearFilters}
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                className="ev-menu-back"
                tabIndex={-1}
                aria-label={`Back to ${W.filter}`}
                onClick={() => {
                  from.current = view;
                  setView('top');
                }}
              >
                <Glyph name="back" size={18} weight={2.4} />
                <span>{VIEW_WORDS[view]}</span>
              </button>
              <span className="ev-menu-rule" role="separator" />
              {view === 'type' &&
                EVENT_TYPES.map((type: EventType) => (
                  <Check
                    key={type}
                    word={TYPE_WORDS[type]}
                    on={filters.types.includes(type)}
                    onToggle={() =>
                      onFilters({
                        ...filters,
                        types: EVENT_TYPES.filter((one) =>
                          toggle(filters.types, type).includes(one),
                        ),
                      })
                    }
                  />
                ))}
              {view === 'host' &&
                DISTINCT_HOSTS.map((host) => (
                  <Check
                    key={host}
                    word={host}
                    on={filters.hosts.includes(host)}
                    onToggle={() =>
                      onFilters({
                        ...filters,
                        hosts: DISTINCT_HOSTS.filter((one) =>
                          toggle(filters.hosts, host).includes(one),
                        ),
                      })
                    }
                  />
                ))}
              {view === 'when' && (
                <>
                  {WHENS.map(([one, words]) => (
                    <button
                      key={one}
                      type="button"
                      role="menuitemradio"
                      className="ev-menu-item is-choice"
                      aria-checked={one === picked}
                      tabIndex={-1}
                      onClick={() => when(one)}
                    >
                      <span className="ev-menu-radio" aria-hidden="true" />
                      {words}
                    </button>
                  ))}
                  {picked === 'between' && (
                    <div className="ev-between" role="group" aria-label={W.between}>
                      <DateBox
                        label={W.from}
                        value={filters.from}
                        onChange={(value) => onFilters({ ...filters, from: value })}
                      />
                      <DateBox
                        label={W.to}
                        value={filters.to}
                        onChange={(value) => onFilters({ ...filters, to: value })}
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Check({ word, on, onToggle }: { word: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      className="ev-menu-item is-choice"
      aria-checked={on}
      tabIndex={-1}
      onClick={onToggle}
    >
      <span className="ev-menu-check" aria-hidden="true">
        {on && <Glyph name="tick" size={14} weight={3} />}
      </span>
      {word}
    </button>
  );
}

function DateBox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();

  return (
    <div className="ev-date">
      <label htmlFor={id} className="desk-label">
        {label}
      </label>
      <input
        id={id}
        type="date"
        className="ev-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
