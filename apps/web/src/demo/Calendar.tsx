import {
  type CalendarMonth,
  type CalendarShow,
  type CalendarView,
  CALENDAR_SHOWS,
  addDays,
  calendarDays,
  firstDayOfWeek,
  formattingLocale,
  inMonth,
  keptCalendarPlace,
  monthOfDay,
  shiftMonth,
  weekdayNames,
} from '@soirely/domain';
import { type RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import {
  type CalendarStart,
  type Feed,
  CAL_WORDS as W,
  FEED_WORDS,
  KEPT,
  TODAY,
  agendaOf,
  calendarStart,
  calendarStateOf,
  eased,
  firstOf,
  listedOf,
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
} from './calendar.ts';
import { CalendarSubscribe } from './CalendarSubscribe.tsx';
import { AgendaList, BrokenLine, DayPanel, MonthWeeks } from './CalendarWeeks.tsx';
import { EventsShell } from './EventParts.tsx';
import { CLOCKS, REUNION, TODAY_IDS, resetSample, sampleEvent, sampleEvents } from './events.ts';
import { FirstRun } from './Events.tsx';
import { Glyph } from './Glyph.tsx';
import { AccessPaused, Switched } from './OrgSwitcher.tsx';
import { SIDEBAR_EVENTS } from './settings.ts';
import { usePaused, useSwitcherStart } from './switcher.ts';
import type { Tell } from './TodayParts.tsx';
import { TodaySidebar } from './TodaySidebar.tsx';
import './calendar.css';

const SPAN = 12;
const EDGE = 800;

interface Aim {
  day: string;
  glide: boolean;
  turn: boolean;
  pin: CalendarMonth | null;
}

function readKept(): string | null {
  try {
    return window.localStorage.getItem(KEPT);
  } catch {
    return null;
  }
}

function keep(place: string): boolean {
  try {
    window.localStorage.setItem(KEPT, place);

    return true;
  } catch {
    return false;
  }
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

/** The Calendar at a desk in B · A · Weeks as lanes (calendar-lanes-spec): the weeks as one scroll, on the demo's sample. */
export function Calendar() {
  const [params] = useSearchParams();
  const raw = params.get('state');
  useSwitcherStart();

  return <CalendarAt key={raw ?? ''} raw={raw} />;
}

function CalendarAt({ raw }: { raw: string | null }) {
  const paused = usePaused();
  const [start] = useState(() => {
    if (raw != null) resetSample();

    return calendarStart(calendarStateOf(raw), readKept());
  });

  return (
    <EventsShell
      renderSide={(tell, covered) => (
        <TodaySidebar
          events={
            start.none ? [] : SIDEBAR_EVENTS.filter((key) => sampleEvent(TODAY_IDS[key]) != null)
          }
          tell={tell}
          calendar
          inert={covered}
        />
      )}
    >
      {(tell) =>
        paused ? (
          <div className="desk-page">
            <Switched />
            <AccessPaused />
          </div>
        ) : (
          <CalendarPage start={start} tell={tell} />
        )
      }
    </EventsShell>
  );
}

function CalendarPage({ start, tell }: { start: CalendarStart; tell: Tell }) {
  const [locale] = useState(() => formattingLocale('en', navigator.language));
  const firstDay = firstDayOfWeek(locale);
  const [load, setLoad] = useState(start.load);
  const [view, setView] = useState<CalendarView>(start.view);
  const [show, setShow] = useState<CalendarShow>(start.show);
  const [menu, setMenu] = useState(start.menu);
  const [open, setOpen] = useState(start.open);
  const [feed, setFeed] = useState<Feed | null>(start.feed);
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
  const events = useMemo(
    () =>
      start.none
        ? []
        : listedOf(start.reunion ? [...sampleEvents(), REUNION] : sampleEvents(), CLOCKS.rest),
    [start],
  );
  const days = useMemo(() => calendarDays(events, show), [events, show]);
  const weeks = useMemo(
    () => weeksOf(range.from, range.to, firstDay, days),
    [range, firstDay, days],
  );
  const tops = useMemo(() => topsOf(weeks), [weeks]);
  const entries = useMemo(() => agendaOf(range.from, range.to, days, TODAY), [range, days]);
  const scroller = useRef<HTMLDivElement>(null);
  const showButton = useRef<HTMLButtonElement>(null);
  const subscribe = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const aim = useRef<Aim | null>({ day: start.at, glide: false, turn: false, pin: null });
  const focusTo = useRef<string | null>(null);
  const toPanel = useRef(false);
  const toTodayHeading = useRef(false);
  const growing = useRef<number | 'after' | null>(null);
  const gliding = useRef(0);

  function pinFor(day: string): CalendarMonth {
    return monthOfDay(view === 'month' ? addDays(weekStart(day, firstDay), 6) : day);
  }

  function placeOf(month: CalendarMonth): string {
    return inMonth(TODAY, month) ? TODAY : firstOf(month);
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

  function goTo(next: Aim): void {
    aim.current = next;
    setAgendaDay(next.day);
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

    const todayHeading = toTodayHeading.current
      ? box?.querySelector<HTMLElement>('.cal-agenda-day.is-today .cal-date')
      : null;

    if (todayHeading != null) {
      toTodayHeading.current = false;
      todayHeading.focus({ preventScroll: true });
    }
  });

  useEffect(() => {
    keep(keptCalendarPlace({ view, month: pinned }));
  }, [view, pinned]);

  useEffect(() => {
    if (open == null || menu || feed != null) return;

    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;

      focusTo.current = open;
      setOpen(null);
    };

    document.addEventListener('keydown', escape);

    return () => document.removeEventListener('keydown', escape);
  }, [open, menu, feed]);

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

    goTo({ day: firstOf(month), glide: true, turn: true, pin: month });
  }

  function toToday(): void {
    setFocusDay(TODAY);
    toTodayHeading.current = view === 'agenda';
    goTo({ day: TODAY, glide: true, turn: false, pin: pinFor(TODAY) });
  }

  function pickView(next: CalendarView): void {
    if (next === view) return;

    setView(next);
    setOpen(null);
    goTo({ day: placeOf(pinned), glide: false, turn: false, pin: pinned });
  }

  function pickShow(next: CalendarShow): void {
    setShow(next);
    setMenu(false);
    showButton.current?.focus();
    goTo({ day: placeOf(pinned), glide: false, turn: false, pin: pinned });
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

  function retry(): void {
    setLoad('loading');
    window.setTimeout(() => setLoad('loaded'), 700);
  }

  const showWord = show === 'events' ? W.showEvents : W.showAll;
  const quietMonth = view === 'month' && load === 'loaded' && !monthHasItems(pinned, days);
  const lit = open ?? (inGrid ? focusDay : null);

  return (
    <div className="desk-page cal-page">
      <header className="desk-top ev-top">
        <h1 className="desk-title ev-title" tabIndex={-1}>
          {W.title}
        </h1>
        <button
          ref={subscribe}
          type="button"
          className="cal-subscribe"
          onClick={() => setFeed('open')}
        >
          <Glyph name="calendar" size={18} weight={2.2} />
          {FEED_WORDS.open}
        </button>
      </header>
      <Switched />
      {start.none ? (
        <div className="cal-first">
          <FirstRun tell={tell} />
        </div>
      ) : (
        <>
          <div className="cal-tools">
            <div className="cal-month-row">
              <h2 className="cal-month" aria-live="polite">
                {monthName(pinned, locale)}
              </h2>
              <div className="cal-steps">
                <button
                  type="button"
                  className="cal-round"
                  aria-label={W.previous}
                  onClick={() => step(-1)}
                >
                  <Glyph name="back" size={19} weight={2.3} />
                </button>
                <button type="button" className="cal-pill" onClick={toToday}>
                  {W.today}
                </button>
                <button
                  type="button"
                  className="cal-round"
                  aria-label={W.next}
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
                  className={show === 'events' ? 'cal-pill cal-show is-on' : 'cal-pill cal-show'}
                  aria-haspopup="menu"
                  aria-expanded={menu}
                  aria-label={W.chosen(W.show, showWord)}
                  onClick={() => setMenu((now) => !now)}
                >
                  <Glyph name="filter" size={17} weight={2.2} />
                  {show === 'events' ? W.showEvents : W.show}
                </button>
                {menu && (
                  <ShowMenu
                    show={show}
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
              <BrokenLine words={W.failed} />
              <button type="button" className="cal-retry" onClick={retry}>
                {W.retry}
              </button>
            </div>
          ) : (
            <>
              {load === 'loading' && (
                <p className="cal-loading" role="status">
                  <span className="cal-spinner" aria-hidden="true" />
                  {W.loading}
                </p>
              )}
              {quietMonth && <p className="cal-quiet">{W.emptyMonth(monthName(pinned, locale))}</p>}
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
                        label={monthName(pinned, locale)}
                        focusDay={focusDay}
                        lit={lit}
                        open={open}
                        loading={load === 'loading'}
                        onOpen={openDay}
                        onMove={move}
                        onFocusIn={(at) => {
                          setInGrid(true);
                          if (at != null) setFocusDay(at);
                        }}
                        onFocusOut={() => setInGrid(false)}
                      />
                    ) : (
                      <AgendaList entries={entries} from={agendaDay} locale={locale} />
                    )}
                  </div>
                </div>
                {open != null && view === 'month' && (
                  <DayPanel
                    day={open}
                    items={days.get(open) ?? []}
                    locale={locale}
                    headingRef={heading}
                    onClose={closeDay}
                  />
                )}
              </div>
            </>
          )}
        </>
      )}
      {feed != null && (
        <CalendarSubscribe
          start={feed}
          onClose={() => {
            setFeed(null);
            subscribe.current?.focus();
          }}
        />
      )}
    </div>
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
  const group = useRef<HTMLDivElement>(null);

  return (
    <div ref={group} className="cal-views" role="radiogroup" aria-label={W.view}>
      {VIEWS.map((one) => {
        const word = one === 'month' ? W.month : W.agenda;

        return (
          <button
            key={one}
            type="button"
            role="radio"
            className="cal-view"
            data-view={one}
            aria-checked={view === one}
            aria-label={W.chosen(W.view, word)}
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

function ShowMenu({
  show,
  button,
  onPick,
  onClose,
}: {
  show: CalendarShow;
  button: RefObject<HTMLButtonElement | null>;
  onPick: (next: CalendarShow) => void;
  onClose: (back: boolean) => void;
}) {
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
    <div ref={menu} className="cal-menu" role="menu" aria-label={W.show}>
      {CALENDAR_SHOWS.map((one) => (
        <button
          key={one}
          type="button"
          role="menuitemradio"
          className="cal-menu-item"
          aria-checked={show === one}
          tabIndex={-1}
          onClick={() => onPick(one)}
        >
          <span className="today-grow">{one === 'events' ? W.showEvents : W.showAll}</span>
          <span className="cal-menu-tick">
            {show === one && <Glyph name="tick" size={18} weight={2.6} />}
          </span>
        </button>
      ))}
    </div>
  );
}
