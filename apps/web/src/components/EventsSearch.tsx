import {
  EVENT_TYPES,
  type EventType,
  type EventsFilters,
  type EventsLook,
  type EventsTab,
  type EventsWhen,
  NO_EVENTS_FILTERS,
  filtered,
  formatWallDay,
  listFormat,
  searching,
  whenSpan,
  withHostToggled,
  withTypeToggled,
} from '@soirely/domain';
import type { TFunction } from 'i18next';
import { type ReactNode, useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Glyph } from './Glyph.tsx';
import { Head, TextAction } from './SettingsParts.tsx';
import './EventsSearch.css';

/** How long typing rests before it searches; Return searches at once. */
const TYPING_PAUSE = 300;

export type FilterView = 'top' | 'type' | 'when' | 'host';

const VIEW_WORD: Record<Exclude<FilterView, 'top'>, string> = {
  type: 'eventsSearch.type',
  when: 'eventsSearch.when',
  host: 'eventsSearch.hostedBy',
};

const TAB_WORD: Record<EventsTab, string> = {
  upcoming: 'events.tabUpcoming',
  drafts: 'events.tabDrafts',
  past: 'events.tabPast',
};

const WHENS: readonly [EventsWhen['kind'], string][] = [
  ['any', 'eventsSearch.anyTime'],
  ['week', 'eventsSearch.thisWeek'],
  ['month', 'eventsSearch.thisMonth'],
  ['next3', 'eventsSearch.next3Months'],
  ['between', 'eventsSearch.between'],
];

/** Where today is and the week starts, which This week, This month and Next 3 months are counted from. */
export interface Calendar {
  today: string;
  firstDay: number;
  locale: string;
}

function whenWord(when: EventsWhen, calendar: Calendar, t: TFunction): string {
  switch (when.kind) {
    case 'any':
      return t('eventsSearch.anyTime');
    case 'week':
      return t('eventsSearch.thisWeek');
    case 'month':
      return t('eventsSearch.thisMonth');
    case 'next3':
      return t('eventsSearch.next3Months');
    case 'between': {
      const day = (value: string) => formatWallDay(value, calendar.locale);

      return when.from !== '' && when.to !== ''
        ? t('events.days', { first: day(when.from), last: day(when.to) })
        : day(when.from || when.to);
    }
  }
}

function chosenWords(filters: EventsFilters, calendar: Calendar, t: TFunction): string[] {
  return [
    ...filters.types.map((type) => t(`eventTypes.${type}`)),
    ...(filters.when.kind === 'any' ? [] : [whenWord(filters.when, calendar, t)]),
    ...filters.hosts,
  ];
}

/** What Filter's button reads: All, or what is chosen. */
function filterWord(filters: EventsFilters, calendar: Calendar, t: TFunction): string {
  const chosen = chosenWords(filters, calendar, t);

  return chosen.length === 0
    ? t('eventsSearch.all')
    : listFormat(calendar.locale, { type: 'unit', style: 'short' }).format(chosen);
}

function noMatchLine(look: EventsLook, calendar: Calendar, t: TFunction): string {
  const q = look.q.trim();
  const chosen = listFormat(calendar.locale, { type: 'conjunction' }).format(
    chosenWords(look.filters, calendar, t),
  );

  if (searching(q) && filtered(look.filters))
    return t('eventsSearch.searchedAndFiltered', { q, filters: chosen });

  return searching(q)
    ? t('eventsSearch.searched', { q })
    : t('eventsSearch.filtered', { filters: chosen });
}

/** The field and Filter, one row above the tabs, in a search landmark. Typing searches once it rests, without moving focus. */
export function EventsSearchRow({
  look,
  offline,
  waiting = false,
  hosts,
  menuStart = null,
  calendar,
  onLook,
}: {
  look: EventsLook;
  offline: boolean;
  /** Off while the list loads, with no word about a connection. */
  waiting?: boolean;
  hosts: readonly string[];
  menuStart?: FilterView | null;
  calendar: Calendar;
  /** `typing` while the field changes it, which replaces the address's entry rather than adding one. */
  onLook: (next: EventsLook, typing?: boolean) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const field = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState(look.q);
  const [given, setGiven] = useState(look.q);
  const off = offline || waiting;
  const rested = useEffectEvent((q: string) => {
    if (q !== look.q) onLook({ ...look, q }, true);
  });

  if (look.q !== given) {
    setGiven(look.q);
    setTyped(look.q);
  }

  useEffect(() => {
    const rest = window.setTimeout(() => rested(typed), TYPING_PAUSE);

    return () => window.clearTimeout(rest);
  }, [typed]);

  const search = (q: string, typing: boolean) => {
    setTyped(q);
    onLook({ ...look, q }, typing);
  };

  return (
    <div className="ev-search-row">
      <div className="ev-search" role="search">
        <div className={off ? 'ev-field is-off' : 'ev-field'}>
          <Glyph name="search" size={18} weight={2.2} />
          <input
            ref={field}
            type="search"
            aria-label={t('eventsSearch.label')}
            placeholder={t('eventsSearch.label')}
            value={typed}
            readOnly={off}
            aria-disabled={off}
            aria-describedby={offline ? `${id}-off` : undefined}
            spellCheck={false}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                search(typed, true);
              } else if (event.key === 'Escape' && typed !== '') {
                event.preventDefault();
                search('', true);
              }
            }}
          />
          {typed !== '' && !off && (
            <button
              type="button"
              className="ev-clear"
              aria-label={t('eventsSearch.clearSearch')}
              onClick={() => {
                search('', false);
                field.current?.focus();
              }}
            >
              <span className="ev-clear-disc" aria-hidden="true">
                <Glyph name="clear" size={12} weight={3} />
              </span>
            </button>
          )}
        </div>
        {offline && (
          <p id={`${id}-off`} className="desk-note">
            {t('eventsSearch.searchOff')}
          </p>
        )}
      </div>
      <EventsFilterMenu
        filters={look.filters}
        off={off}
        hosts={hosts}
        start={menuStart}
        calendar={calendar}
        onFilters={(filters) => onLook({ ...look, q: typed, filters })}
      />
    </div>
  );
}

/** The one Filter menu, as Members' drills in: Type, When and Hosted by, each naming its choice; Clear filters once something is chosen. */
export function EventsFilterMenu({
  filters,
  off,
  hosts,
  start,
  calendar,
  onFilters,
}: {
  filters: EventsFilters;
  off: boolean;
  hosts: readonly string[];
  start: FilterView | null;
  calendar: Calendar;
  onFilters: (next: EventsFilters) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [view, setView] = useState<FilterView | null>(start);
  const [between, setBetween] = useState(filters.when.kind === 'between');
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const from = useRef<FilterView>('top');
  const word = filterWord(filters, calendar, t);
  const open = view != null;
  const offered = [...hosts, ...filters.hosts.filter((host) => !hosts.includes(host))];

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

  function drill(next: FilterView): void {
    from.current = view ?? 'top';
    setView(next);
  }

  function when(kind: EventsWhen['kind']): void {
    setBetween(kind === 'between');
    if (kind === 'between') {
      const span = whenSpan(filters.when, calendar.today, calendar.firstDay);

      if (span != null) onFilters({ ...filters, when: { kind, ...span } });
    } else onFilters({ ...filters, when: { kind } });
  }

  function day(edge: 'from' | 'to', value: string): void {
    const span = whenSpan(filters.when, calendar.today, calendar.firstDay) ?? { from: '', to: '' };
    const next = { ...span, [edge]: value };

    onFilters({ ...filters, when: { kind: 'between', ...next } });
  }

  const picked = between ? 'between' : filters.when.kind;
  const span = whenSpan(filters.when, calendar.today, calendar.firstDay);
  const top: readonly [Exclude<FilterView, 'top'>, string][] = [
    [
      'type',
      filters.types.length === 0
        ? t('eventsSearch.anyType')
        : listFormat(calendar.locale, { type: 'unit', style: 'short' }).format(
            filters.types.map((type) => t(`eventTypes.${type}`)),
          ),
    ],
    ['when', whenWord(filters.when, calendar, t)],
    [
      'host',
      filters.hosts.length === 0
        ? t('eventsSearch.anyone')
        : listFormat(calendar.locale, { type: 'unit', style: 'short' }).format(filters.hosts),
    ],
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
        aria-label={t('eventsSearch.filterLabel', { what: word })}
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
          aria-label={view === 'top' ? t('eventsSearch.filter') : t(VIEW_WORD[view])}
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
                  <span className="today-grow">{t(VIEW_WORD[one])}</span>
                  <span className="ev-menu-value">{value}</span>
                  <Glyph name="chevron" size={16} weight={2.3} className="desk-chevron" />
                </button>
              ))}
              {filtered(filters) && (
                <>
                  <span className="ev-menu-rule" role="separator" />
                  <button
                    type="button"
                    role="menuitem"
                    className="ev-menu-item is-violet"
                    tabIndex={-1}
                    onClick={() => {
                      setBetween(false);
                      onFilters(NO_EVENTS_FILTERS);
                      setView(null);
                      button.current?.focus();
                    }}
                  >
                    {t('eventsSearch.clearFilters')}
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
                aria-label={t('eventsSearch.backTo', { menu: t('eventsSearch.filter') })}
                onClick={() => {
                  from.current = view;
                  setView('top');
                }}
              >
                <Glyph name="back" size={18} weight={2.4} />
                <span>{t(VIEW_WORD[view])}</span>
              </button>
              <span className="ev-menu-rule" role="separator" />
              {view === 'type' &&
                EVENT_TYPES.map((type: EventType) => (
                  <Check
                    key={type}
                    word={t(`eventTypes.${type}`)}
                    on={filters.types.includes(type)}
                    onToggle={() => onFilters(withTypeToggled(filters, type))}
                  />
                ))}
              {view === 'host' &&
                offered.map((host) => (
                  <Check
                    key={host}
                    word={host}
                    on={filters.hosts.includes(host)}
                    onToggle={() => onFilters(withHostToggled(filters, host, offered))}
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
                      {t(words)}
                    </button>
                  ))}
                  {picked === 'between' && (
                    <div className="ev-between" role="group" aria-label={t('eventsSearch.between')}>
                      <DateBox
                        label={t('eventsSearch.from')}
                        value={span?.from ?? ''}
                        onChange={(value) => day('from', value)}
                      />
                      <DateBox
                        label={t('eventsSearch.to')}
                        value={span?.to ?? ''}
                        onChange={(value) => day('to', value)}
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

export interface ResultsGroup {
  tab: EventsTab;
  count: number;
  rows: ReactNode;
}

function matchCount(groups: readonly ResultsGroup[]): number {
  return groups.reduce((total, group) => total + group.count, 0);
}

/** The count, read out politely; mounted for as long as a search is on, empty while one loads, so the first count is a change a screen reader announces. */
export function EventsReadOut({ groups }: { groups: readonly ResultsGroup[] | null }) {
  const { t } = useTranslation();

  return (
    <p className="visually-hidden" role="status" aria-live="polite">
      {groups == null ? '' : t('eventsSearch.count', { count: matchCount(groups) })}
    </p>
  );
}

/** One set of results across Upcoming, Drafts and Past: the count first, then each group with its count; or what was searched, with Clear search and Clear filters. */
export function EventsResults({
  look,
  groups,
  calendar,
  onLook,
}: {
  look: EventsLook;
  groups: readonly ResultsGroup[];
  calendar: Calendar;
  onLook: (next: EventsLook) => void;
}) {
  const { t } = useTranslation();
  const count = matchCount(groups);
  const clearFilters = () => onLook({ ...look, filters: NO_EVENTS_FILTERS });

  return (
    <>
      <div className="ev-count-row">
        <p className="ev-count" aria-hidden="true">
          {t('eventsSearch.count', { count })}
        </p>
        {filtered(look.filters) && count > 0 && (
          <TextAction label={t('eventsSearch.clearFilters')} onClick={clearFilters} />
        )}
      </div>
      {count === 0 ? (
        <div className="ev-none" role="status">
          <h2>{t('eventsSearch.noMatch')}</h2>
          <p className="desk-line">{noMatchLine(look, calendar, t)}</p>
          <div className="ev-none-actions">
            {searching(look.q) && (
              <TextAction
                label={t('eventsSearch.clearSearch')}
                onClick={() => onLook({ ...look, q: '' })}
              />
            )}
            {filtered(look.filters) && (
              <TextAction label={t('eventsSearch.clearFilters')} onClick={clearFilters} />
            )}
          </div>
        </div>
      ) : (
        <div className="ev-groups">
          {groups.map(
            (group) =>
              group.count > 0 && (
                <section key={group.tab} aria-label={t(TAB_WORD[group.tab])}>
                  <Head title={t(TAB_WORD[group.tab])}>
                    <span className="ev-group-count">{group.count}</span>
                  </Head>
                  <ul className="desk-rows ev-rows">{group.rows}</ul>
                </section>
              ),
          )}
        </div>
      )}
    </>
  );
}
