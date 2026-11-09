import {
  type CalendarItem,
  type CalendarMonth,
  type CalendarView,
  addDays,
  firstDayOfWeek,
  inMonth,
  keptCalendarPlace,
  monthOfDay,
  shiftMonth,
  weekdayNames,
} from '@soirely/domain';
import {
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import {
  type CalEvent,
  type CalendarLens,
  type Item,
  CalendarFrameContext,
  agendaOf,
  eased,
  firstOf,
  keep,
  monthHasItems,
  monthIndex,
  monthKey,
  monthName,
  movedDay,
  pinnedOf,
  sameMonth,
  topsOf,
  weekStart,
  weeksOf,
} from './calendarWeeks.ts';
import { AgendaList, BrokenLine, DayPanel, MonthWeeks } from './CalendarWeeks.tsx';
import { Glyph } from './Glyph.tsx';
import './calendar.css';

const SPAN = 12;
const EDGE = 800;

export type CalendarLoad = 'loading' | 'failed' | 'loaded';

export interface BoardStart<S extends string> {
  view: CalendarView;
  at: string;
  show: S;
  menu: boolean;
  open: string | null;
}

interface Aim {
  day: string;
  glide: boolean;
  turn: boolean;
  pin: CalendarMonth | null;
}

function glideTime(box: HTMLElement): number {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true) return 0;

  const value = getComputedStyle(box).getPropertyValue('--motionSlow').trim();
  const time = Number.parseFloat(value);

  if (!Number.isFinite(time)) return 0;

  return value.endsWith('ms') ? time : time * 1000;
}

function agendaTop(box: HTMLElement, { day, turn }: Aim): number | null {
  const found = turn
    ? [...box.querySelectorAll<HTMLElement>('[data-month]')].find(
        (one) => one.dataset.month === monthKey(monthOfDay(day)),
      )
    : [...box.querySelectorAll<HTMLElement>('[data-entry]')].find(
        (one) => (one.dataset.entry ?? '') >= day,
      );

  return found?.offsetTop ?? null;
}

function agendaPinned(box: HTMLElement): CalendarMonth | null {
  let month: string | undefined;

  for (const one of box.querySelectorAll<HTMLElement>('[data-month]')) {
    if (one.offsetTop > box.scrollTop + 0.5) break;
    month = one.dataset.month;
  }

  return month == null ? null : monthOfDay(`${month}-01`);
}

function landed(
  view: CalendarView,
  lens: CalendarLens | null,
  days: ReadonlyMap<string, Item[]>,
  day: string,
): string {
  return view === 'agenda' && lens != null ? lens.landing(days, day) : day;
}

/** The Calendar's title and its way into Subscribe, as the web demo's /demo/calendar draws them. */
export function CalendarTop({
  titleRef,
  subscribe,
  onSubscribe,
  children,
}: {
  titleRef?: RefObject<HTMLHeadingElement | null>;
  subscribe: RefObject<HTMLButtonElement | null>;
  onSubscribe: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <header className="desk-top ev-top">
      <h1 ref={titleRef} className="desk-title ev-title" tabIndex={-1}>
        {t('calendar.title')}
      </h1>
      {children}
      <button ref={subscribe} type="button" className="cal-subscribe" onClick={onSubscribe}>
        <Glyph name="calendar" size={18} weight={2.2} />
        {t('calendarFeed.open')}
      </button>
    </header>
  );
}

/** The Calendar in A · Weeks as lanes (calendar-lanes-spec): the toolbar, then the weeks as one scroll or Agenda, with a day open beside them. */
export function CalendarBoard<S extends string, E extends CalEvent>({
  start,
  events,
  load,
  shows,
  showWords,
  daysFor,
  lensOf,
  held,
  locale,
  onRetry,
}: {
  start: BoardStart<S>;
  events: readonly E[];
  load: CalendarLoad;
  /** The Show menu's choices, the first of them everything. */
  shows: readonly S[];
  showWords: Record<S, string>;
  daysFor: (events: readonly E[], show: S, locale: string) => Map<string, CalendarItem<E>[]>;
  lensOf: (show: S) => CalendarLens | null;
  /** A dialog is over the page, so Escape is its own. */
  held: boolean;
  locale: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const { today } = useContext(CalendarFrameContext);
  const firstDay = firstDayOfWeek(locale);
  const [view, setView] = useState<CalendarView>(start.view);
  const [show, setShow] = useState<S>(start.show);
  const [menu, setMenu] = useState(start.menu);
  const [open, setOpen] = useState(start.open);
  const [focusDay, setFocusDay] = useState(start.open ?? start.at);
  const [agendaDay, setAgendaDay] = useState(start.at);
  const [inGrid, setInGrid] = useState(false);
  const [range, setRange] = useState(() => {
    const month = monthOfDay(start.at);

    return { from: shiftMonth(month, -SPAN), to: shiftMonth(month, SPAN) };
  });
  const [pinned, setPinned] = useState(() =>
    monthOfDay(start.view === 'month' ? addDays(weekStart(start.at, firstDay), 6) : start.at),
  );
  const [, setRedraw] = useState(0);
  const lens = lensOf(show);
  const days = useMemo(() => daysFor(events, show, locale), [daysFor, events, show, locale]);
  const weeks = useMemo(
    () => weeksOf(range.from, range.to, firstDay, days),
    [range, firstDay, days],
  );
  const tops = useMemo(() => topsOf(weeks), [weeks]);
  const narrow = lens != null;
  const entries = useMemo(
    () => agendaOf(range.from, range.to, days, today, !narrow),
    [range, days, today, narrow],
  );
  const scroller = useRef<HTMLDivElement>(null);
  const showButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const aim = useRef<Aim | null>({
    day: landed(start.view, lens, days, start.at),
    glide: false,
    turn: false,
    pin: null,
  });
  const focusTo = useRef<string | null>(null);
  const toPanel = useRef(false);
  const headingTo = useRef<string | null>(null);
  const growing = useRef<number | 'after' | null>(null);
  const gliding = useRef(0);
  const loaded = useRef(load === 'loaded');

  function pinFor(day: string): CalendarMonth {
    return monthOfDay(view === 'month' ? addDays(weekStart(day, firstDay), 6) : day);
  }

  function placeOf(month: CalendarMonth): string {
    return inMonth(today, month) ? today : firstOf(month);
  }

  function reach(day: string): void {
    const month = monthOfDay(day);

    setRange((now) => {
      const from =
        monthIndex(month) - 1 < monthIndex(now.from) ? shiftMonth(month, -SPAN) : now.from;
      const to = monthIndex(month) + 1 > monthIndex(now.to) ? shiftMonth(month, SPAN) : now.to;

      return from === now.from && to === now.to ? now : { from, to };
    });
    setRedraw((times) => times + 1);
  }

  function goTo(next: Aim, anchor = next.day): void {
    aim.current = next;
    setAgendaDay(anchor);
    reach(next.day);
  }

  function slide(box: HTMLElement, top: number, glide: boolean, done: () => void): void {
    window.cancelAnimationFrame(gliding.current);

    const to = Math.max(0, Math.min(top, box.scrollHeight - box.clientHeight));
    const time = glide ? glideTime(box) : 0;
    const from = box.scrollTop;

    if (time <= 0 || from === to) {
      box.scrollTop = to;
      gliding.current = 0;
      done();

      return;
    }

    const began = performance.now();
    const frame = (now: number) => {
      const progress = Math.min(1, (now - began) / time);

      box.scrollTop = from + (to - from) * eased(progress);
      if (progress < 1) gliding.current = window.requestAnimationFrame(frame);
      else {
        gliding.current = 0;
        done();
      }
    };

    gliding.current = window.requestAnimationFrame(frame);
  }

  useLayoutEffect(() => {
    const box = scroller.current;

    if (box == null || growing.current == null) return;
    if (growing.current !== 'after') box.scrollTop = box.scrollHeight - growing.current;
    growing.current = null;
  }, [range]);

  // The weeks grow to the rows their events need once they arrive, so the scroll goes back to its month.
  useLayoutEffect(() => {
    if (load !== 'loaded' || loaded.current) return;

    loaded.current = true;
    aim.current = {
      day: landed(view, lens, days, placeOf(pinned)),
      glide: false,
      turn: false,
      pin: pinned,
    };
  });

  useLayoutEffect(() => {
    const box = scroller.current;
    const target = aim.current;

    if (box != null && target != null) {
      const top =
        view === 'month'
          ? (tops[weeks.findIndex((week) => week.start === weekStart(target.day, firstDay))] ??
            null)
          : agendaTop(box, target);

      if (top != null) {
        aim.current = null;
        slide(box, top, target.glide, () => {
          if (target.pin != null) setPinned(target.pin);
        });
      }
    }

    const day = focusTo.current;
    const button = day == null ? null : box?.querySelector<HTMLElement>(`[data-day="${day}"]`);

    if (button != null) {
      focusTo.current = null;
      button.focus({ preventScroll: true });
      button.scrollIntoView?.({ block: 'nearest' });
    }
    if (toPanel.current && heading.current != null) {
      toPanel.current = false;
      heading.current.focus();
    }

    const landing = headingTo.current;
    const landingHeading =
      landing == null
        ? null
        : [...(box?.querySelectorAll<HTMLElement>('[data-entry]') ?? [])]
            .find((one) => one.dataset.entry === landing)
            ?.querySelector<HTMLElement>('h2.cal-date, .cal-nothing[tabindex]');

    if (landingHeading != null) {
      headingTo.current = null;
      landingHeading.focus({ preventScroll: true });
    }
  });

  useEffect(() => {
    keep(keptCalendarPlace({ view, month: pinned }));
  }, [view, pinned]);

  useEffect(() => {
    if (open == null || menu || held) return;

    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;

      focusTo.current = open;
      setOpen(null);
    };

    document.addEventListener('keydown', escape);

    return () => document.removeEventListener('keydown', escape);
  }, [open, menu, held]);

  function scrolled(): void {
    const box = scroller.current;

    if (box == null) return;

    const month = view === 'month' ? pinnedOf(weeks, tops, box.scrollTop) : agendaPinned(box);

    if (month != null && !sameMonth(month, pinned)) setPinned(month);
    if (gliding.current !== 0 || growing.current != null || aim.current != null) return;

    if (box.scrollTop < EDGE) {
      growing.current = box.scrollHeight - box.scrollTop;
      setRange((now) => ({ ...now, from: shiftMonth(now.from, -SPAN) }));
    } else if (box.scrollHeight - box.scrollTop - box.clientHeight < EDGE) {
      growing.current = 'after';
      setRange((now) => ({ ...now, to: shiftMonth(now.to, SPAN) }));
    }
  }

  function step(by: number): void {
    const month = shiftMonth(pinned, by);
    const day = placeOf(month);

    setFocusDay(day);
    goTo({ day: firstOf(month), glide: true, turn: true, pin: month }, day);
  }

  function toToday(): void {
    const day = landed(view, lens, days, today);

    setFocusDay(today);
    headingTo.current = view === 'agenda' && load !== 'failed' ? day : null;
    goTo({ day, glide: true, turn: false, pin: pinFor(today) });
  }

  function pickView(next: CalendarView): void {
    if (next === view) return;

    headingTo.current = null;
    setView(next);
    setOpen(null);
    goTo({
      day: landed(next, lens, days, placeOf(pinned)),
      glide: false,
      turn: false,
      pin: pinned,
    });
  }

  function pickShow(next: S): void {
    setShow(next);
    setMenu(false);
    showButton.current?.focus();
    goTo({
      day: landed(view, lensOf(next), daysFor(events, next, locale), placeOf(pinned)),
      glide: false,
      turn: false,
      pin: pinned,
    });
  }

  function openDay(day: string): void {
    setOpen(day);
    setFocusDay(day);
    toPanel.current = true;
  }

  function closeDay(): void {
    focusTo.current = open;
    setOpen(null);
  }

  function move(key: string, from: string): boolean {
    const next = movedDay(from, key, firstDay);

    if (next == null) return false;

    setFocusDay(next);
    focusTo.current = next;
    reach(next);

    return true;
  }

  const everything = show === shows[0];
  const pinnedName = monthName(pinned, locale);
  const quietMonth = view === 'month' && load === 'loaded' && !monthHasItems(pinned, days);
  const lit = open ?? (inGrid ? focusDay : null);

  return (
    <>
      <div className="cal-tools">
        <div className="cal-month-row">
          <h2 className="cal-month" aria-live="polite">
            {pinnedName}
          </h2>
          <div className="cal-steps">
            <button
              type="button"
              className="cal-round"
              aria-label={t('calendar.previous')}
              onClick={() => step(-1)}
            >
              <Glyph name="back" size={19} weight={2.3} />
            </button>
            <button type="button" className="cal-pill" onClick={toToday}>
              {t('calendar.today')}
            </button>
            <button
              type="button"
              className="cal-round"
              aria-label={t('calendar.next')}
              onClick={() => step(1)}
            >
              <Glyph name="chevron" size={19} weight={2.3} />
            </button>
          </div>
        </div>
        <div className="cal-choices">
          <ViewSwitch view={view} onPick={pickView} />
          <div className="cal-show-at">
            <button
              ref={showButton}
              type="button"
              className={everything ? 'cal-pill cal-show' : 'cal-pill cal-show is-on'}
              aria-haspopup="menu"
              aria-expanded={menu}
              aria-label={t('calendar.chosen', {
                name: t('calendar.show'),
                word: showWords[show],
              })}
              onClick={() => setMenu((now) => !now)}
            >
              <Glyph name="filter" size={17} weight={2.2} />
              {everything ? t('calendar.show') : showWords[show]}
            </button>
            {menu && (
              <ShowMenu
                show={show}
                shows={shows}
                words={showWords}
                button={showButton}
                onPick={pickShow}
                onClose={(back) => {
                  setMenu(false);
                  if (back) showButton.current?.focus();
                }}
              />
            )}
          </div>
        </div>
      </div>
      {load === 'failed' ? (
        <div className="cal-failed">
          <BrokenLine words={t('calendar.failed')} />
          <button type="button" className="cal-retry" onClick={onRetry}>
            {t('calendar.retry')}
          </button>
        </div>
      ) : (
        <>
          {load === 'loading' && (
            <p className="cal-loading" role="status">
              <span className="cal-spinner" aria-hidden="true" />
              {t('calendar.loading')}
            </p>
          )}
          {quietMonth && (
            <p className="cal-quiet">
              {lens == null
                ? t('calendar.emptyMonth', { month: pinnedName })
                : lens.emptyMonth(pinnedName)}
            </p>
          )}
          <div className={open == null ? 'cal-body' : 'cal-body is-open'}>
            <div className="cal-weeks">
              <div ref={scroller} className="cal-scroll" onScroll={scrolled}>
                {view === 'month' && (
                  <div className="cal-heads" aria-hidden="true">
                    {weekdayNames(locale, firstDay, 'short').map((name) => (
                      <span key={name}>{name}</span>
                    ))}
                  </div>
                )}
                {view === 'month' ? (
                  <MonthWeeks
                    weeks={weeks}
                    locale={locale}
                    label={pinnedName}
                    focusDay={focusDay}
                    lit={lit}
                    open={open}
                    loading={load === 'loading'}
                    lens={lens}
                    onOpen={openDay}
                    onMove={move}
                    onFocusIn={(at) => {
                      setInGrid(true);
                      if (at != null) setFocusDay(at);
                    }}
                    onFocusOut={() => setInGrid(false)}
                  />
                ) : (
                  <AgendaList
                    entries={entries}
                    from={agendaDay}
                    landing={landed('agenda', lens, days, today)}
                    lens={lens}
                    locale={locale}
                  />
                )}
              </div>
            </div>
            {open != null && view === 'month' && (
              <DayPanel
                day={open}
                items={days.get(open) ?? []}
                locale={locale}
                lens={lens}
                headingRef={heading}
                onClose={closeDay}
              />
            )}
          </div>
        </>
      )}
    </>
  );
}

const VIEWS: readonly CalendarView[] = ['month', 'agenda'];

function ViewSwitch({
  view,
  onPick,
}: {
  view: CalendarView;
  onPick: (next: CalendarView) => void;
}) {
  const { t } = useTranslation();
  const group = useRef<HTMLDivElement>(null);

  return (
    <div ref={group} className="cal-views" role="radiogroup" aria-label={t('calendar.view')}>
      {VIEWS.map((one) => {
        const word = t(one === 'month' ? 'calendar.month' : 'calendar.agenda');

        return (
          <button
            key={one}
            type="button"
            role="radio"
            className="cal-view"
            data-view={one}
            aria-checked={view === one}
            aria-label={t('calendar.chosen', { name: t('calendar.view'), word })}
            tabIndex={view === one ? 0 : -1}
            onClick={() => onPick(one)}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;

              const other = one === 'month' ? 'agenda' : 'month';

              event.preventDefault();
              onPick(other);
              group.current?.querySelector<HTMLElement>(`[data-view="${other}"]`)?.focus();
            }}
          >
            {view === one && <Glyph name="tick" size={14} weight={2.8} />}
            {word}
          </button>
        );
      })}
    </div>
  );
}

function ShowMenu<S extends string>({
  show,
  shows,
  words,
  button,
  onPick,
  onClose,
}: {
  show: S;
  shows: readonly S[];
  words: Record<S, string>;
  button: RefObject<HTMLButtonElement | null>;
  onPick: (next: S) => void;
  onClose: (back: boolean) => void;
}) {
  const { t } = useTranslation();
  const menu = useRef<HTMLDivElement>(null);
  const closing = useRef(onClose);

  useLayoutEffect(() => {
    closing.current = onClose;
  });

  useLayoutEffect(() => {
    menu.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  }, []);

  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      const items = [
        ...(menu.current?.querySelectorAll<HTMLElement>('[role=menuitemradio]') ?? []),
      ];
      const at = items.findIndex((one) => one === document.activeElement);
      const to = (index: number) => items[(index + items.length) % items.length]?.focus();

      if (event.key === 'Escape') {
        event.preventDefault();
        closing.current(true);
      } else if (event.key === 'Tab') {
        event.preventDefault();
        closing.current(true);
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        to(at + (event.key === 'ArrowDown' ? 1 : -1));
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        to(event.key === 'Home' ? 0 : -1);
      }
    };
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;

      if (!menu.current?.contains(target) && !button.current?.contains(target))
        closing.current(false);
    };

    document.addEventListener('keydown', keys);
    document.addEventListener('pointerdown', outside);

    return () => {
      document.removeEventListener('keydown', keys);
      document.removeEventListener('pointerdown', outside);
    };
  }, [button]);

  return (
    <div ref={menu} className="cal-menu" role="menu" aria-label={t('calendar.show')}>
      {shows.map((one) => (
        <button
          key={one}
          type="button"
          role="menuitemradio"
          className="cal-menu-item"
          aria-checked={show === one}
          tabIndex={-1}
          onClick={() => onPick(one)}
        >
          <span className="today-grow">{words[one]}</span>
          <span className="cal-menu-tick">
            {show === one && <Glyph name="tick" size={18} weight={2.6} />}
          </span>
        </button>
      ))}
    </div>
  );
}
