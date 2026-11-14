import { formatEventClock, monthOfDay } from '@soirely/domain';
import { type KeyboardEvent, type Ref, useContext, useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import {
  type AgendaEntry,
  type Bar,
  type CalendarLens,
  type Item,
  type Mark,
  type Week,
  type WeekDay,
  CalendarFrameContext,
  agendaLabel,
  agendaStop,
  barLabel,
  barOffRule,
  barWords,
  dayLabel,
  dayNumber,
  dayTitle,
  itemKey,
  markLabel,
  markWords,
  monthEdge,
  monthKey,
  monthName,
  rowLine,
  weekdayShort,
} from './calendarWeeks.ts';
import { type ListPhase, phaseTag } from '../eventsList.ts';
import { EventThumb } from './EventCard.tsx';
import { Glyph } from './Glyph.tsx';
import { Chevron, RowWords, Tag } from './SettingsParts.tsx';

export type Move = (key: string, from: string) => boolean;

const OWNER_WORD = {
  event: 'timeline.owner_event',
  you: 'timeline.owner_you',
  automatic: 'timeline.owner_automatic',
} as const;

export function BrokenLine({ words }: { words: string }) {
  return (
    <div className="cal-broken" role="alert">
      <span className="cal-broken-mark" aria-hidden="true">
        <Glyph name="clear" size={15} weight={2.8} />
      </span>
      <p>{words}</p>
    </div>
  );
}

function stopsOf(row: Element, day: WeekDay): HTMLElement[] {
  const pieces = [...row.querySelectorAll<HTMLElement>('[data-piece]')];
  const stops = day.keys.map((key) => pieces.find((piece) => piece.dataset.piece === key));
  const more = [...row.querySelectorAll<HTMLElement>('[data-more]')].find(
    (one) => one.dataset.more === day.day,
  );

  return [...stops, day.more > 0 ? more : undefined].filter(
    (one): one is HTMLElement => one != null,
  );
}

function dayButton(row: Element, day: string): HTMLElement | undefined {
  return [...row.querySelectorAll<HTMLElement>('[data-day]')].find(
    (one) => one.dataset.day === day,
  );
}

/** Tab from a day steps through what it shows in its list's order, then "+‹n› more"; past the last, focus leaves from the day. */
function stepped(event: KeyboardEvent<HTMLElement>, day: WeekDay | undefined): void {
  const row = event.currentTarget.closest('[role="row"]');

  if (event.key !== 'Tab' || row == null || day == null) return;

  const stops = stopsOf(row, day);
  const at = stops.indexOf(event.currentTarget);
  const next = event.shiftKey
    ? at < 0
      ? undefined
      : (stops[at - 1] ?? dayButton(row, day.day))
    : stops[at + 1];

  if (next != null) {
    event.preventDefault();
    next.focus();
  } else if (at >= 0 && !event.shiftKey) dayButton(row, day.day)?.focus();
}

export function MonthWeeks({
  weeks,
  locale,
  label,
  focusDay,
  lit,
  open,
  loading,
  lens,
  onOpen,
  onMove,
  onFocusIn,
  onFocusOut,
}: {
  weeks: readonly Week[];
  locale: string;
  label: string;
  focusDay: string;
  lit: string | null;
  open: string | null;
  loading: boolean;
  lens: CalendarLens | null;
  onOpen: (day: string) => void;
  onMove: Move;
  onFocusIn: (day: string | undefined) => void;
  onFocusOut: () => void;
}) {
  const { t } = useTranslation();
  const { today } = useContext(CalendarFrameContext);

  function keys(event: KeyboardEvent<HTMLElement>, day: WeekDay | undefined): void {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Tab') stepped(event, day);
    else if (onMove(event.key, day?.day ?? focusDay)) event.preventDefault();
  }

  return (
    <div
      className="cal-grid"
      role="grid"
      aria-label={label}
      aria-busy={loading}
      inert={loading}
      onFocus={(event) => onFocusIn(event.target.dataset.day)}
      onBlur={(event) => {
        if (!(
          event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)
        ))
          onFocusOut();
      }}
    >
      {weeks.map((week) => {
        const here = week.days.find((one) => one.day === focusDay);

        return (
          <div
            key={week.start}
            role="row"
            className={`cal-week is-rows-${week.rows}${week.over ? ' has-more' : ''}`}
          >
            {week.days.map((one, at) => (
              <div key={one.day} role="gridcell" className="cal-cell">
                <button
                  type="button"
                  className={[
                    'cal-day',
                    one.day === today && 'is-today',
                    one.day.endsWith('-01') && 'is-first',
                    one.day === lit && 'is-lit',
                    one.day === open && 'is-open',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  data-day={one.day}
                  aria-label={dayLabel(t, one.day, today, one.count, locale)}
                  aria-current={one.day === today ? 'date' : undefined}
                  tabIndex={one.day === focusDay ? 0 : -1}
                  onClick={() => onOpen(one.day)}
                  onKeyDown={(event) => keys(event, one)}
                >
                  <span className="cal-number">
                    {one.day.endsWith('-01')
                      ? monthEdge(one.day, locale)
                      : dayNumber(one.day, locale)}
                  </span>
                </button>
                {week.pieces
                  .filter((piece) => piece.from === at)
                  .map((piece) =>
                    loading ? (
                      <span
                        key={piece.key}
                        className={`cal-piece cal-bar is-loading is-from-${piece.from} is-span-${piece.kind === 'bar' ? piece.span : 1} is-row-${piece.row}`}
                        aria-hidden="true"
                      />
                    ) : piece.kind === 'bar' ? (
                      <BarLink
                        key={piece.key}
                        bar={piece}
                        locale={locale}
                        onKeyDown={(event) => keys(event, here)}
                      />
                    ) : (
                      <MarkLink
                        key={piece.key}
                        mark={piece}
                        locale={locale}
                        lens={lens}
                        onKeyDown={(event) => keys(event, here)}
                      />
                    ),
                  )}
                {one.more > 0 && !loading && (
                  <button
                    type="button"
                    className={`cal-more is-from-${at}`}
                    data-more={one.day}
                    tabIndex={-1}
                    onClick={() => onOpen(one.day)}
                    onKeyDown={(event) => keys(event, here)}
                  >
                    {t('calendar.moreItems', { count: one.more })}
                  </button>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function BarMark({ shown }: { shown: ListPhase }) {
  if (shown === 'paused')
    return (
      <span className="cal-bar-mark is-paused" aria-hidden="true">
        <span />
        <span />
      </span>
    );

  return (
    <span className={`cal-bar-mark is-${shown === 'draft' ? 'open' : 'ended'}`} aria-hidden="true">
      {shown !== 'draft' && <span />}
    </span>
  );
}

function BarLink({
  bar,
  locale,
  onKeyDown,
}: {
  bar: Bar;
  locale: string;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}) {
  const { t } = useTranslation();
  const { now, zone, linkOf } = useContext(CalendarFrameContext);
  const { event } = bar.item;

  return (
    <Link
      to={linkOf(bar.item)}
      className={[
        'cal-piece cal-bar',
        `is-from-${bar.from} is-span-${bar.span} is-row-${bar.row} is-${event.mesh}`,
        !bar.starts && 'is-carried',
        !bar.ends && 'is-cut',
      ]
        .filter(Boolean)
        .join(' ')}
      data-piece={bar.key}
      data-shown={event.shown}
      aria-label={barLabel(t, bar.item, zone, locale, now)}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      {barOffRule(event.shown) && <BarMark shown={event.shown} />}
      <span className="cal-bar-words">{barWords(t, event)}</span>
    </Link>
  );
}

function YouDot() {
  return <span className="cal-you" aria-hidden="true" />;
}

function MarkLink({
  mark,
  locale,
  lens,
  onKeyDown,
}: {
  mark: Mark;
  locale: string;
  lens: CalendarLens | null;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}) {
  const { t } = useTranslation();
  const { zone, linkOf } = useContext(CalendarFrameContext);
  const { item } = mark;
  const late = lens?.late(item) === true;

  return (
    <Link
      to={linkOf(item)}
      className={`cal-piece cal-mark is-from-${mark.from} is-row-${mark.row}`}
      data-piece={mark.key}
      aria-label={markLabel(t, item, zone, locale)}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      {late ? (
        <Glyph name="clock" size={12} weight={2.6} className="cal-late-mark" />
      ) : item.milestone.owner === 'you' ? (
        <YouDot />
      ) : (
        <span className="cal-square" aria-hidden="true" />
      )}
      {late ? (
        <span className="cal-mark-words">
          <span className="cal-late">
            {formatEventClock(item.milestone.at, item.event.timeZone, locale)}
          </span>{' '}
          {item.milestone.title}
        </span>
      ) : (
        <span className="cal-mark-words">{markWords(item, locale)}</span>
      )}
    </Link>
  );
}

function ItemRow({
  item,
  locale,
  lens,
  tabIndex,
}: {
  item: Item;
  locale: string;
  lens: CalendarLens | null;
  tabIndex?: number | undefined;
}) {
  const { t } = useTranslation();
  const { now, zone, linkOf } = useContext(CalendarFrameContext);

  if (item.kind === 'event')
    return (
      <li>
        <Link
          className="desk-row cal-row"
          to={linkOf(item)}
          aria-label={barLabel(t, item, zone, locale, now)}
          tabIndex={tabIndex}
        >
          <EventThumb event={item.event} size={40} />
          <RowWords
            title={item.event.name}
            tag={<Tag {...phaseTag(item.event.shown, t)} />}
            lines={[rowLine(t, item, zone, locale, now)]}
          />
          <Chevron />
        </Link>
      </li>
    );

  const { owner } = item.milestone;
  const you = owner === 'you';

  return (
    <li>
      <Link
        className="desk-row cal-row"
        to={linkOf(item)}
        aria-label={lens == null ? markLabel(t, item, zone, locale) : lens.label(item)}
        tabIndex={tabIndex}
      >
        <span className={`cal-tile is-${item.event.mesh}`} aria-hidden="true">
          {you ? <YouDot /> : <span className="cal-square" />}
        </span>
        <RowWords
          title={item.milestone.title}
          tag={
            you ? (
              <span className="desk-tag cal-you-tag">
                <YouDot />
                {t(OWNER_WORD.you)}
              </span>
            ) : (
              <span className="desk-tag cal-event-tag">
                <span className="cal-square" aria-hidden="true" />
                {t(OWNER_WORD[owner])}
              </span>
            )
          }
          lines={lens == null ? [rowLine(t, item, zone, locale, now)] : lens.lines(item)}
        />
        <Chevron />
      </Link>
    </li>
  );
}

function Rows({
  items,
  locale,
  lens,
  stop,
}: {
  items: readonly Item[];
  locale: string;
  lens: CalendarLens | null;
  /** Agenda's one Tab stop: the row that takes it, or false on a day without it. */
  stop?: number | false;
}) {
  return (
    <ul className="desk-rows has-lead cal-rows">
      {items.map((item, at) => (
        <ItemRow
          key={itemKey(item)}
          item={item}
          locale={locale}
          lens={lens}
          tabIndex={stop == null ? undefined : stop === at ? 0 : -1}
        />
      ))}
    </ul>
  );
}

/** Tab and Shift+Tab in Agenda move one row at a time in date order; past either end, focus leaves the list. */
function rowStep(event: globalThis.KeyboardEvent): void {
  const list = event.currentTarget;

  if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return;
  if (!(list instanceof HTMLElement && event.target instanceof HTMLElement)) return;

  const from = event.target;
  const rows = [...list.querySelectorAll<HTMLElement>('.cal-row')];
  const at = rows.indexOf(from);
  const after = (row: HTMLElement) =>
    (from.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  const next = event.shiftKey
    ? at >= 0
      ? rows[at - 1]
      : rows.filter((row) => !after(row)).at(-1)
    : at >= 0
      ? rows[at + 1]
      : rows.find(after);

  if (next == null) return;
  event.preventDefault();
  next.focus();
}

export function DayPanel({
  day,
  items,
  locale,
  lens,
  headingRef,
  onClose,
}: {
  day: string;
  items: readonly Item[];
  locale: string;
  lens: CalendarLens | null;
  headingRef: Ref<HTMLHeadingElement>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <aside className="cal-panel" aria-labelledby={id}>
      <div className="cal-panel-head">
        <h2 id={id} ref={headingRef} tabIndex={-1}>
          {dayTitle(day, locale)}
        </h2>
        <button type="button" className="desk-text" onClick={onClose}>
          {t('calendar.close')}
        </button>
      </div>
      {items.length === 0 ? (
        <p className="cal-nothing">{lens?.emptyDay ?? t('calendar.emptyDay')}</p>
      ) : (
        <Rows items={items} locale={locale} lens={lens} />
      )}
    </aside>
  );
}

export function AgendaList({
  entries,
  from,
  landing,
  lens,
  locale,
}: {
  entries: readonly AgendaEntry[];
  from: string;
  landing: string;
  lens: CalendarLens | null;
  locale: string;
}) {
  const { t } = useTranslation();
  const { today } = useContext(CalendarFrameContext);
  const stop = agendaStop(entries, from);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = list.current;

    box?.addEventListener('keydown', rowStep);

    return () => box?.removeEventListener('keydown', rowStep);
  }, []);

  return (
    <div ref={list} className="cal-agenda">
      {entries.map((entry) => {
        const month = monthOfDay(entry.day);
        const key = monthKey(month);
        const named = monthName(month, locale);

        return (
          <div key={entry.empty ? `${key}|none` : entry.day} className="cal-entry">
            {entry.turn != null && (
              <p className="cal-turn" data-month={key}>
                {named}
              </p>
            )}
            <div
              className={entry.day === today ? 'cal-agenda-day is-today' : 'cal-agenda-day'}
              data-month={key}
              data-entry={entry.day}
            >
              {entry.empty ? (
                <>
                  <span className="cal-date" aria-hidden="true" />
                  <p className="cal-nothing" tabIndex={-1}>
                    {lens == null
                      ? t('calendar.emptyMonth', { month: named })
                      : lens.emptyMonth(named)}
                  </p>
                </>
              ) : (
                <>
                  <h2
                    className="cal-date"
                    aria-label={agendaLabel(t, entry.day, today, locale)}
                    tabIndex={entry.day === today || entry.day === landing ? -1 : undefined}
                  >
                    <span className="cal-weekday">{weekdayShort(entry.day, locale)}</span>
                    <span className="cal-date-number">{dayNumber(entry.day, locale)}</span>
                  </h2>
                  {entry.items.length === 0 ? (
                    <p className="cal-nothing">{t('calendar.emptyDay')}</p>
                  ) : (
                    <Rows
                      items={entry.items}
                      locale={locale}
                      lens={lens}
                      stop={entry === stop?.entry && stop.row}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
