import { monthOfDay } from '@soirely/domain';
import { type KeyboardEvent, type Ref, useId } from 'react';
import { Link } from 'react-router';

import {
  type AgendaEntry,
  type Bar,
  type Item,
  type Mark,
  type Week,
  type WeekDay,
  CAL_WORDS as W,
  TODAY,
  agendaLabel,
  barLabel,
  barOffRule,
  barWords,
  dayLabel,
  dayNumber,
  dayTitle,
  itemKey,
  itemLink,
  markLabel,
  markWords,
  monthEdge,
  monthKey,
  monthName,
  rowLine,
  weekdayShort,
} from './calendar.ts';
import { PhaseTag, Thumb } from './EventParts.tsx';
import type { Shown } from './events.ts';
import { Glyph } from '../components/Glyph.tsx';
import { Chevron, RowWords } from './SettingsParts.tsx';

export type Move = (key: string, from: string) => boolean;

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
  onOpen: (day: string) => void;
  onMove: Move;
  onFocusIn: (day: string | undefined) => void;
  onFocusOut: () => void;
}) {
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
                    one.day === TODAY && 'is-today',
                    one.day.endsWith('-01') && 'is-first',
                    one.day === lit && 'is-lit',
                    one.day === open && 'is-open',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  data-day={one.day}
                  aria-label={dayLabel(one.day, one.count, locale)}
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
                    {W.more(one.more)}
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

function BarMark({ shown }: { shown: Shown }) {
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
  const { event } = bar.item;

  return (
    <Link
      to={itemLink(bar.item)}
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
      aria-label={barLabel(bar.item, locale)}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      {barOffRule(event.shown) && <BarMark shown={event.shown} />}
      <span className="cal-bar-words">{barWords(event)}</span>
    </Link>
  );
}

function MarkLink({
  mark,
  locale,
  onKeyDown,
}: {
  mark: Mark;
  locale: string;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}) {
  return (
    <Link
      to={itemLink(mark.item)}
      className={`cal-piece cal-mark is-from-${mark.from} is-row-${mark.row}`}
      data-piece={mark.key}
      aria-label={markLabel(mark.item, locale)}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <span className="cal-square" aria-hidden="true" />
      <span className="cal-mark-words">{markWords(mark.item, locale)}</span>
    </Link>
  );
}

function ItemRow({ item, locale }: { item: Item; locale: string }) {
  return (
    <li>
      {item.kind === 'event' ? (
        <Link className="desk-row cal-row" to={itemLink(item)} aria-label={barLabel(item, locale)}>
          <Thumb event={item.event} size={40} />
          <RowWords
            title={item.event.name}
            tag={<PhaseTag shown={item.event.shown} />}
            lines={[rowLine(item, locale)]}
          />
          <Chevron />
        </Link>
      ) : (
        <Link className="desk-row cal-row" to={itemLink(item)} aria-label={markLabel(item, locale)}>
          <span className={`cal-tile is-${item.event.mesh}`} aria-hidden="true">
            <span className="cal-square" />
          </span>
          <RowWords
            title={item.milestone.title}
            tag={
              <span className="desk-tag cal-event-tag">
                <span className="cal-square" aria-hidden="true" />
                {W.event}
              </span>
            }
            lines={[rowLine(item, locale)]}
          />
          <Chevron />
        </Link>
      )}
    </li>
  );
}

function Rows({ items, locale }: { items: readonly Item[]; locale: string }) {
  return (
    <ul className="desk-rows has-lead cal-rows">
      {items.map((item) => (
        <ItemRow key={itemKey(item)} item={item} locale={locale} />
      ))}
    </ul>
  );
}

export function DayPanel({
  day,
  items,
  locale,
  headingRef,
  onClose,
}: {
  day: string;
  items: readonly Item[];
  locale: string;
  headingRef: Ref<HTMLHeadingElement>;
  onClose: () => void;
}) {
  const id = useId();

  return (
    <aside className="cal-panel" aria-labelledby={id}>
      <div className="cal-panel-head">
        <h2 id={id} ref={headingRef} tabIndex={-1}>
          {dayTitle(day, locale)}
        </h2>
        <button type="button" className="desk-text" onClick={onClose}>
          {W.close}
        </button>
      </div>
      {items.length === 0 ? (
        <p className="cal-nothing">{W.emptyDay}</p>
      ) : (
        <Rows items={items} locale={locale} />
      )}
    </aside>
  );
}

export function AgendaList({
  entries,
  locale,
}: {
  entries: readonly AgendaEntry[];
  locale: string;
}) {
  return (
    <div className="cal-agenda">
      {entries.map((entry) => {
        const month = monthOfDay(entry.day);
        const key = monthKey(month);

        return (
          <div key={entry.empty ? `${key}|none` : entry.day} className="cal-entry">
            {entry.turn != null && (
              <p className="cal-turn" data-month={key}>
                {monthName(month, locale)}
              </p>
            )}
            <div
              className={entry.day === TODAY ? 'cal-agenda-day is-today' : 'cal-agenda-day'}
              data-month={key}
              data-entry={entry.day}
            >
              {entry.empty ? (
                <>
                  <span className="cal-date" aria-hidden="true" />
                  <p className="cal-nothing">{W.emptyMonth(monthName(month, locale))}</p>
                </>
              ) : (
                <>
                  <h2 className="cal-date" aria-label={agendaLabel(entry.day, locale)}>
                    <span className="cal-weekday">{weekdayShort(entry.day, locale)}</span>
                    <span className="cal-date-number">{dayNumber(entry.day, locale)}</span>
                  </h2>
                  {entry.items.length === 0 ? (
                    <p className="cal-nothing">{W.emptyDay}</p>
                  ) : (
                    <Rows items={entry.items} locale={locale} />
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
