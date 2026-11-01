import { type ListedEvent } from '@soirely/api-client';
import {
  addDays,
  agendaDays,
  CALENDAR_SHOWS,
  type CalendarCell,
  type CalendarItem,
  type CalendarMonth,
  type CalendarPlace,
  type CalendarShow,
  type CalendarView,
  calendarDays,
  cellShown,
  dayDate,
  firstDayOfWeek,
  formatEventClock,
  formatWallDay,
  inMonth,
  keptCalendarPlace,
  monthGrid,
  monthOfDay,
  namesBar,
  namesZone,
  PHASE_LOOK,
  readCalendarPlace,
  shiftMonth,
  wallDay,
  weekdayNames,
} from '@soirely/domain';
import {
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { type TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';
import { useDialogKeys } from '../../../dialogFocus.ts';
import { dateLocale } from '../../../i18n/index.ts';
import { usePhoneWidth } from '../../../phoneWidth.ts';
import { useServerNow } from '../../../serverNow.ts';
import { can, useSession } from '../../../session.ts';
import { PHASE_WORD } from '../events/eventWords.ts';
import { FirstRun } from '../events/FirstRun.tsx';
import { StatusPill } from '../events/MakeLive.tsx';
import { CalendarSubscribe } from './CalendarSubscribe.tsx';

const KEPT = 'soirely.calendar';

const WIDE = '(width >= 64rem)';

const SHOW_WORD: Record<CalendarShow, string> = {
  all: 'calendar.showAll',
  events: 'calendar.showEvents',
};

const OWNER_WORD = {
  event: 'timeline.owner_event',
  you: 'timeline.owner_you',
  automatic: 'timeline.owner_automatic',
} as const;

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; events: ListedEvent[] };

type Item = CalendarItem<ListedEvent>;

export function Calendar() {
  const session = useSession();
  const organisation = session.organisation;

  if (organisation == null) return null;

  return (
    <CalendarOf
      key={organisation.id}
      organisationId={organisation.id}
      organisationName={organisation.name}
      creates={can(session, 'events.create')}
    />
  );
}

function CalendarOf({
  organisationId,
  organisationName,
  creates,
}: {
  organisationId: string;
  organisationName: string;
  creates: boolean;
}) {
  const { t } = useTranslation();
  const phone = usePhoneWidth();
  const wide = useWide();
  const now = useServerNow();
  const locale = dateLocale();
  const today = wallDay(now, readerZone());
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [kept, setKept] = useState(() => readCalendarPlace(readKept()));
  const [show, setShow] = useState<CalendarShow>('all');
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [focusDay, setFocusDay] = useState(today);
  const title = useRef<HTMLHeadingElement>(null);
  const grid = useRef<HTMLTableElement>(null);
  const agenda = useRef<HTMLDivElement>(null);
  const moveFocus = useRef<'grid' | 'today' | null>(null);
  const view: CalendarView = kept?.view ?? (phone ? 'agenda' : 'month');
  const month: CalendarMonth = kept?.month ?? monthOfDay(today);

  useEffect(() => {
    let current = true;

    api.allEvents(organisationId).then(
      (events) => current && setLoad({ kind: 'loaded', events }),
      () => current && setLoad({ kind: 'failed' }),
    );

    return () => {
      current = false;
    };
  }, [organisationId, attempt]);

  useLayoutEffect(() => {
    const target = moveFocus.current;

    moveFocus.current = null;
    if (target === 'grid') {
      grid.current?.querySelector<HTMLElement>(`[data-day="${focusDay}"]`)?.focus();
    } else if (target === 'today') {
      const heading = agenda.current?.querySelector<HTMLElement>(`[data-day="${today}"]`);
      const landing = heading ?? title.current;

      landing?.scrollIntoView({ block: 'start' });
      landing?.focus({ preventScroll: true });
    }
  });

  const keep = (place: CalendarPlace) => {
    setKept(place);
    writeKept(keptCalendarPlace(place));
  };

  const goToMonth = (next: CalendarMonth) => {
    keep({ view, month: next });
    setOpenDay(null);
    setFocusDay(inMonth(today, next) ? today : `${monthKey(next)}-01`);
  };

  const goToToday = () => {
    keep({ view, month: monthOfDay(today) });
    setOpenDay(null);
    setFocusDay(today);
    if (view === 'agenda') moveFocus.current = 'today';
  };

  const moveTo = (day: string) => {
    if (!inMonth(day, month)) keep({ view, month: monthOfDay(day) });
    setFocusDay(day);
    moveFocus.current = 'grid';
  };

  const closeDay = useCallback(() => {
    setOpenDay(null);
    moveFocus.current = 'grid';
  }, []);

  const subscribe = (
    <CalendarSubscribe organisationId={organisationId} organisationName={organisationName} />
  );

  if (load.kind === 'loaded' && load.events.length === 0) {
    return (
      <div className="calendar">
        <div className="calendar-heading">
          <h1 ref={title} tabIndex={-1}>
            {t('calendar.title')}
          </h1>
          {subscribe}
        </div>
        <FirstRun creates={creates} createLabel="events.newEvent" />
      </div>
    );
  }

  const days = load.kind === 'loaded' ? calendarDays(load.events, show) : new Map<string, Item[]>();
  const firstDay = firstDayOfWeek(locale);
  const fit = phone ? 1 : 2;
  const openItems = openDay == null ? [] : (days.get(openDay) ?? []);

  return (
    <div className="calendar">
      <div className="calendar-heading">
        <h1 className="calendar-title" ref={title} tabIndex={-1}>
          {t('calendar.title')}
        </h1>
        {subscribe}
      </div>
      <div className="calendar-toolbar">
        <div className="calendar-move">
          <button
            type="button"
            className="button calendar-step calendar-step-previous"
            aria-label={t('calendar.previous')}
            onClick={() => goToMonth(shiftMonth(month, -1))}
          >
            <span className="calendar-step-word">{t('calendar.previous')}</span>
          </button>
          <button type="button" className="button" onClick={goToToday}>
            {t('calendar.today')}
          </button>
          <button
            type="button"
            className="button calendar-step calendar-step-next"
            aria-label={t('calendar.next')}
            onClick={() => goToMonth(shiftMonth(month, 1))}
          >
            <span className="calendar-step-word">{t('calendar.next')}</span>
          </button>
        </div>
        <h2 className="calendar-month" aria-live="polite">
          {monthName(month, locale)}
        </h2>
        <div className="calendar-views" role="group" aria-label={t('calendar.view')}>
          {(['month', 'agenda'] as const).map((one) => (
            <button
              key={one}
              type="button"
              className="calendar-view"
              aria-pressed={view === one}
              onClick={() => {
                keep({ view: one, month });
                setOpenDay(null);
              }}
            >
              {t(one === 'month' ? 'calendar.month' : 'calendar.agenda')}
            </button>
          ))}
        </div>
        <label className="calendar-show">
          <span>{t('calendar.show')}</span>
          <select
            value={show}
            onChange={(event) => setShow(event.target.value === 'events' ? 'events' : 'all')}
          >
            {CALENDAR_SHOWS.map((one) => (
              <option key={one} value={one}>
                {t(SHOW_WORD[one])}
              </option>
            ))}
          </select>
        </label>
      </div>

      {load.kind === 'loading' && <CalendarLoading view={view} />}
      {load.kind === 'failed' && (
        <div className="notice notice-broken" role={attempt > 0 ? 'alert' : undefined}>
          <span className="mark mark-broken" aria-hidden="true">
            ✕
          </span>
          <div className="notice-body">
            <p>{t('calendar.failed')}</p>
            <button
              type="button"
              className="button"
              onClick={() => {
                setLoad({ kind: 'loading' });
                setAttempt((n) => n + 1);
              }}
            >
              {t('calendar.retry')}
            </button>
          </div>
        </div>
      )}
      {load.kind === 'loaded' && view === 'month' && (
        <div
          className={
            openDay != null && wide ? 'calendar-body calendar-body-split' : 'calendar-body'
          }
        >
          <MonthGrid
            grid={grid}
            weeks={monthGrid(month, firstDay, days)}
            firstDay={firstDay}
            fit={fit}
            today={today}
            focusDay={inMonth(focusDay, month) ? focusDay : `${monthKey(month)}-01`}
            onMove={moveTo}
            onOpen={(day) => {
              setFocusDay(day);
              setOpenDay(day);
            }}
          />
          {openDay != null && (
            <DayList
              day={openDay}
              today={today}
              items={openItems}
              asPanel={wide}
              onClose={closeDay}
            />
          )}
        </div>
      )}
      {load.kind === 'loaded' && view === 'agenda' && (
        <Agenda agenda={agenda} month={month} days={agendaDays(month, days)} today={today} />
      )}
    </div>
  );
}

function MonthGrid({
  grid,
  weeks,
  firstDay,
  fit,
  today,
  focusDay,
  onMove,
  onOpen,
}: {
  grid: RefObject<HTMLTableElement | null>;
  weeks: CalendarCell<ListedEvent>[][];
  firstDay: number;
  fit: number;
  today: string;
  focusDay: string;
  onMove: (day: string) => void;
  onOpen: (day: string) => void;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const long = weekdayNames(locale, firstDay, 'long');
  const short = weekdayNames(locale, firstDay, 'short');

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, day: string) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];

    if (step == null) return;

    event.preventDefault();
    onMove(addDays(day, document.dir === 'rtl' && Math.abs(step) === 1 ? -step : step));
  };

  return (
    <table ref={grid} className="calendar-grid" role="grid" aria-label={t('calendar.month')}>
      <thead>
        <tr>
          {short.map((name, index) => (
            <th key={name} className="calendar-head" scope="col" abbr={long[index]}>
              {name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week) => (
          <tr key={week[0]?.day}>
            {week.map((cell) => {
              const { shown, more } = cellShown(cell, fit);

              return (
                <td
                  key={cell.day}
                  className={cell.inMonth ? 'calendar-cell' : 'calendar-cell calendar-cell-out'}
                >
                  <button
                    type="button"
                    className="calendar-day"
                    data-day={cell.day}
                    tabIndex={cell.day === focusDay ? 0 : -1}
                    aria-current={cell.day === today ? 'date' : undefined}
                    aria-label={dayName(t, cell.day, today, cell.items.length, locale)}
                    onClick={() => onOpen(cell.day)}
                    onKeyDown={(event) => onKeyDown(event, cell.day)}
                  >
                    <span className="calendar-day-number" aria-hidden="true">
                      {dayDate(cell.day).getUTCDate()}
                    </span>
                    <span className="calendar-day-items" aria-hidden="true">
                      {shown.map((item, index) =>
                        item == null ? (
                          <span key={`gap-${index}`} className="calendar-bar calendar-bar-gap" />
                        ) : (
                          <CellItem key={itemKey(item)} item={item} firstDay={firstDay} />
                        ),
                      )}
                      {more > 0 && (
                        <span className="calendar-more">{t('calendar.more', { count: more })}</span>
                      )}
                    </span>
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CellItem({ item, firstDay }: { item: Item; firstDay: number }) {
  const { t } = useTranslation();
  const locale = dateLocale();

  if (item.kind === 'milestone') {
    return (
      <span className={`calendar-line calendar-line-${item.milestone.owner}`}>
        <span className="calendar-line-owner">{t(OWNER_WORD[item.milestone.owner])}</span>
        <span className="calendar-line-time">
          {formatEventClock(item.milestone.at, item.event.timeZone, locale)}
        </span>
        <span className="calendar-line-title">{item.milestone.title}</span>
      </span>
    );
  }

  const look = PHASE_LOOK[item.event.phase];
  const edges = `${item.first ? '' : ' calendar-bar-carried'}${item.last ? '' : ' calendar-bar-carries'}`;

  return (
    <span
      className={`calendar-bar status-chip${edges}`}
      data-tone={look.tone}
      data-shape={look.shape}
    >
      {namesBar(item.day, item.first, firstDay) && (
        <>
          <span className="calendar-bar-name">{item.event.name}</span>
          <span className="calendar-bar-word">{t(PHASE_WORD[item.event.phase])}</span>
        </>
      )}
    </span>
  );
}

function DayList({
  day,
  today,
  items,
  asPanel,
  onClose,
}: {
  day: string;
  today: string;
  items: Item[];
  asPanel: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => close.current?.focus(), [day]);

  const body = (
    <>
      <div className="calendar-day-list-head">
        <h3 id="calendar-day-list-title">
          {formatWallWeekday(day, dateLocale())}
          {day === today && (
            <span className="pill-quiet calendar-today">{t('calendar.today')}</span>
          )}
        </h3>
        <button ref={close} type="button" className="link-button" onClick={onClose}>
          {t('calendar.close')}
        </button>
      </div>
      {items.length === 0 ? (
        <p className="muted">{t('calendar.emptyDay')}</p>
      ) : (
        <ItemRows items={items} />
      )}
    </>
  );

  return asPanel ? (
    <DayPanel onClose={onClose}>{body}</DayPanel>
  ) : (
    <DayDialog onClose={onClose}>{body}</DayDialog>
  );
}

/** Beside the grid, so the month stays in reach: Escape closes it, and Tab carries on past it. */
function DayPanel({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', escape);

    return () => document.removeEventListener('keydown', escape);
  }, [onClose]);

  return (
    <aside
      className="card calendar-day-list calendar-day-panel"
      aria-labelledby="calendar-day-list-title"
    >
      {children}
    </aside>
  );
}

/** A centred modal, and on a phone's width the bottom sheet, as LifecycleDialog is. */
function DayDialog({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDivElement>(null);

  useDialogKeys(dialog, onClose, false);

  return (
    <>
      <button
        type="button"
        className="dialog-scrim"
        tabIndex={-1}
        aria-label={t('calendar.close')}
        onClick={onClose}
      />
      <div
        ref={dialog}
        className="dialog calendar-day-list"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-day-list-title"
      >
        {children}
      </div>
    </>
  );
}

function Agenda({
  agenda,
  month,
  days,
  today,
}: {
  agenda: RefObject<HTMLDivElement | null>;
  month: CalendarMonth;
  days: { day: string; items: Item[] }[];
  today: string;
}) {
  const { t } = useTranslation();
  const locale = dateLocale();

  if (days.length === 0) {
    return (
      <div ref={agenda} className="card calendar-agenda-empty">
        <p className="muted">{t('calendar.emptyMonth', { month: monthName(month, locale) })}</p>
      </div>
    );
  }

  return (
    <div ref={agenda} className="calendar-agenda">
      {days.map(({ day, items }) => (
        <section key={day} className="calendar-agenda-day" aria-labelledby={`calendar-${day}`}>
          <h3 id={`calendar-${day}`} data-day={day} tabIndex={-1}>
            {formatWallWeekday(day, locale)}
            {day === today && (
              <span className="pill-quiet calendar-today">{t('calendar.today')}</span>
            )}
          </h3>
          <ItemRows items={items} />
        </section>
      ))}
    </div>
  );
}

function ItemRows({ items }: { items: Item[] }) {
  return (
    <ul className="card calendar-rows">
      {items.map((item) => (
        <li key={itemKey(item)}>
          {item.kind === 'event' ? <EventRow item={item} /> : <MilestoneRow item={item} />}
        </li>
      ))}
    </ul>
  );
}

function EventRow({ item }: { item: Extract<Item, { kind: 'event' }> }) {
  const { t } = useTranslation();
  const { event } = item;
  const locale = dateLocale();
  const time = formatEventClock(event.startsAt, event.timeZone, locale);
  const first = wallDay(event.startsAt, event.timeZone);

  return (
    <Link className="calendar-row" to={`/app/events/${encodeURIComponent(event.id)}`}>
      <StatusPill phase={event.phase} />
      <span className="calendar-row-title">{event.name}</span>
      <span className="muted calendar-row-when">
        {namesZone(event.timeZone, readerZone())
          ? t('calendar.timeInZone', { time, timeZone: event.timeZone })
          : time}
        {item.multiDay && (
          <>
            {' · '}
            {t('calendar.range', {
              from: formatWallDay(first, locale),
              to: formatWallDay(addDays(first, event.dayCount - 1), locale),
            })}
          </>
        )}
      </span>
    </Link>
  );
}

function MilestoneRow({ item }: { item: Extract<Item, { kind: 'milestone' }> }) {
  const { t } = useTranslation();
  const { event, milestone } = item;
  const time = formatEventClock(milestone.at, event.timeZone, dateLocale());
  const to = milestone.action?.link ?? `/app/events/${encodeURIComponent(event.id)}/dates`;

  return (
    <Link className="calendar-row" to={to}>
      <span className={`pill-quiet timeline-owner timeline-owner-${milestone.owner}`}>
        {t(OWNER_WORD[milestone.owner])}
      </span>
      <span className="calendar-row-title">{milestone.title}</span>
      <span className="muted calendar-row-when">
        {namesZone(event.timeZone, readerZone())
          ? t('calendar.timeInZone', { time, timeZone: event.timeZone })
          : time}
      </span>
    </Link>
  );
}

function CalendarLoading({ view }: { view: CalendarView }) {
  const { t } = useTranslation();

  return (
    <div className={`calendar-skeleton calendar-skeleton-${view}`}>
      <p className="muted" role="status">
        <span className="pending-spinner" aria-hidden="true" />
        {t('calendar.loading')}
      </p>
    </div>
  );
}

function useWide(): boolean {
  return useSyncExternalStore(
    (changed) => {
      const query = window.matchMedia(WIDE);
      query.addEventListener('change', changed);

      return () => query.removeEventListener('change', changed);
    },
    () => window.matchMedia(WIDE).matches,
  );
}

function readKept(): string | null {
  try {
    return window.localStorage.getItem(KEPT);
  } catch {
    return null;
  }
}

function writeKept(place: string): void {
  try {
    window.localStorage.setItem(KEPT, place);
  } catch {
    // A browser that keeps nothing opens on this month next time.
  }
}

function readerZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function monthKey({ year, month }: CalendarMonth): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function monthName(month: CalendarMonth, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(dayDate(`${monthKey(month)}-01`));
}

function formatWallWeekday(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(dayDate(day));
}

function dayName(t: TFunction, day: string, today: string, count: number, locale: string): string {
  const date = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(dayDate(day));
  const named = day === today ? t('calendar.todayDay', { day: date }) : date;

  return count === 0 ? named : t('calendar.dayWithItems', { day: named, count });
}

function itemKey(item: Item): string {
  return item.kind === 'event'
    ? `event-${item.event.id}`
    : `milestone-${item.event.id}-${item.milestone.at}-${item.milestone.title}`;
}
