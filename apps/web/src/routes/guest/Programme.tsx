import type { GuestPage, GuestProgrammeItem } from '@soirely/api-client';
import { formatWallClock, wallOfZoned } from '@soirely/domain';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { dateLocale } from '../../i18n/index.ts';
import { readerZone, wallDayOf } from './GuestParts.tsx';
import './programme.css';

/** sc-3899's The day, under the event's details: the items the hosts show to guests, a day's date over each list when there is more than one. */
export function Programme({ page }: { page: GuestPage }) {
  const { t } = useTranslation();
  const items = page.programme;

  if (items.length === 0) return null;

  const days = byDay(items);
  const places = new Set(items.map((one) => one.place)).size > 1;
  const { timeZone } = page.event;

  return (
    <section className="gp-prog" aria-labelledby="gp-prog-h">
      <h2 id="gp-prog-h" className="gp-h2">
        {days.length > 1 ? t('guest.programme') : t('guest.theDay')}
      </h2>
      {readerZone() !== timeZone && (
        <p className="gp-prog-zone">{t('guest.timesIn', { timeZone })}</p>
      )}
      {days.length === 1 ? (
        <Items items={items} places={places} />
      ) : (
        <div className="gp-prog-days">
          {days.map((one) => (
            <div key={one.day} className="gp-prog-day">
              <h3 className="gp-prog-h3">{wallDayOf(one.day)}</h3>
              <Items items={one.items} places={places} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Items({ items, places }: { items: readonly GuestProgrammeItem[]; places: boolean }) {
  const { t } = useTranslation();

  return (
    <ul className="gp-prog-list">
      {items.map((one, index) => (
        <li key={index} className="gp-prog-item">
          <time className="gp-prog-time" dateTime={one.startsAt}>
            {timeText(one, t)}
          </time>
          <span className="gp-prog-what" dir="auto">
            <span className="gp-prog-title">{one.title}</span>
            {places && one.place != null && (
              <span className="gp-prog-place">{` · ${one.place}`}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

function byDay(
  items: readonly GuestProgrammeItem[],
): { day: string; items: GuestProgrammeItem[] }[] {
  const days = new Map<string, GuestProgrammeItem[]>();

  for (const one of items) days.set(one.day, [...(days.get(one.day) ?? []), one]);

  return [...days].map(([day, rows]) => ({ day, items: rows }));
}

/** A start past midnight sits under the event day before, so it carries its weekday, as the Schedule page writes it. */
function timeText(one: GuestProgrammeItem, t: TFunction): string {
  const wall = wallOfZoned(one.startsAt);
  const time = formatWallClock(wall, dateLocale());

  if (wall.slice(0, 10) === one.day) return time;

  const weekday = new Intl.DateTimeFormat(dateLocale(), {
    timeZone: 'UTC',
    weekday: 'short',
  }).format(new Date(`${wall.slice(0, 10)}T12:00:00Z`));

  return t('schedule.weekdayAndTime', { weekday, time });
}
