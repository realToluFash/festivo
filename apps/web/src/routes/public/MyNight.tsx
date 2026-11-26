import { ApiError, type MyNight, type MyNightTable } from '@soirely/api-client';
import { formatEventClock } from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../api.ts';
import { Brand } from '../../components/Brand.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { dateLocale } from '../../i18n/index.ts';
import {
  clockAt,
  clockOpensAt,
  crossesMidnight,
  dietaryOf,
  headingOf,
  weekdayOf,
} from './myNight.ts';
import { atWords } from '../app/events/doorCodes.ts';
import './myNight.css';

/** Changes to their station, shift or lead show within 10 seconds (sc-3915). */
const EVERY_MS = 10_000;

type Seen =
  | { kind: 'loading' }
  | {
      kind: 'shown';
      night: MyNight;
      updated: string | null;
      readAt: string;
      /** When it was read, the page's now until the next read. */
      at: number;
      stale: boolean;
    };

/** The person's whole night at their own link, signed in (sc-3915), as the web demo's /demo/my-night draws it. */
export function MyNightPage({
  token,
  name,
  onSignOut,
  onLost,
}: {
  token: string;
  name: string;
  onSignOut: () => void;
  /** The link no longer answers this account: read it again for what it says now. */
  onLost: () => void;
}) {
  const { t } = useTranslation();
  const [seen, setSeen] = useState<Seen>({ kind: 'loading' });
  const [round, setRound] = useState(0);
  const lost = useRef(onLost);

  useEffect(() => {
    lost.current = onLost;
  });

  useEffect(() => {
    let current = true;
    const read = () =>
      api.staffLinkNight(token).then(
        (night) => current && setSeen((was) => shown(was, night)),
        (error: unknown) => {
          if (!current) return;
          if (error instanceof ApiError && error.status === 404) lost.current();
          else setSeen((was) => (was.kind === 'shown' ? { ...was, stale: true } : was));
        },
      );
    void read();
    const every = window.setInterval(() => void read(), EVERY_MS);

    return () => {
      current = false;
      window.clearInterval(every);
    };
  }, [token, round]);

  const night = seen.kind === 'shown' ? seen.night : null;
  const now = seen.kind === 'shown' ? seen.at : 0;

  return (
    <main id="content" className="myn">
      <header className="myn-bar">
        <span className="myn-brand">
          <Brand />
        </span>
        <You name={name} night={night} now={now} place="bar" onSignOut={onSignOut} />
      </header>
      <div className="myn-live" role="status" aria-live="polite">
        {seen.kind === 'shown' && seen.updated != null && (
          <p className="myn-updated">
            <span className="myn-ring" aria-hidden="true">
              <Glyph name="tick" size={14} weight={3} />
            </span>
            <span>{t('staffLink.night.updated', { station: seen.updated })}</span>
          </p>
        )}
      </div>
      {seen.kind === 'shown' && seen.stale && (
        <div className="myn-stale" role="status">
          <span className="myn-ring myn-ring-amber" aria-hidden="true">
            !
          </span>
          <div className="myn-stale-words">
            <p className="myn-strong">{t('staffLink.night.staleTitle')}</p>
            <p>{t('staffLink.night.staleBody', { time: seen.readAt })}</p>
          </div>
          <button type="button" className="myn-secondary" onClick={() => setRound((n) => n + 1)}>
            {t('staffLink.night.tryAgain')}
          </button>
        </div>
      )}
      <div className="myn-page">
        {night == null ? <Loading /> : <Night night={night} now={now} />}
        <You name={name} night={night} now={now} place="foot" onSignOut={onSignOut} />
      </div>
    </main>
  );
}

/** The night as it now reads, announcing a move to another station; the lead and the tables move with it. */
function shown(was: Seen, night: MyNight): Seen {
  const before = was.kind === 'shown' ? headingOf(was.night) : null;
  const moved = before != null && before !== headingOf(night) && night.station != null;

  return {
    kind: 'shown',
    night,
    updated: moved ? night.station : was.kind === 'shown' ? was.updated : null,
    readAt: formatEventClock(new Date().toISOString(), night.event.timeZone, dateLocale()),
    at: Date.now(),
    stale: false,
  };
}

function Night({ night, now }: { night: MyNight; now: number }) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const opens = clockOpensAt(night, new Date(now));
  const opensWords =
    opens == null
      ? null
      : t('staffLink.night.clockOpensAt', {
          time: formatEventClock(opens, night.event.timeZone, locale),
        });

  return (
    <>
      <div className="myn-head">
        <p className="myn-only">{t('staffLink.night.only', { time: endsWords(night, now, t) })}</p>
        <p className="myn-event">{night.event.name}</p>
      </div>
      <div className="myn-columns">
        <div className="myn-column">
          <div className="myn-on">
            <h1>
              <span className="myn-on-label">{t('staffLink.night.onTonight')}</span>{' '}
              <span className="myn-on-station">{headingOf(night)}</span>
            </h1>
          </div>
          {opensWords != null && (
            <section className="myn-clock" aria-label={opensWords}>
              <button type="button" className="myn-clock-button" disabled>
                {opensWords}
              </button>
              <p className="myn-clock-help">{t('staffLink.night.clockOpensLine')}</p>
            </section>
          )}
          {night.shift != null && <Shift night={night} shift={night.shift} />}
          <YourLead lead={night.lead} />
        </div>
        <div className="myn-column">
          {night.timing.length > 0 && <Timing night={night} />}
          {night.tables != null && <Tables night={night} tables={night.tables} now={now} />}
        </div>
      </div>
    </>
  );
}

function Loading() {
  const { t } = useTranslation();

  return (
    <div className="myn-card myn-loading" role="status">
      <p>{t('staffLink.night.loading')}</p>
      <span className="myn-bone" aria-hidden="true" />
      <span className="myn-bone myn-bone-short" aria-hidden="true" />
    </div>
  );
}

function Shift({ night, shift }: { night: MyNight; shift: NonNullable<MyNight['shift']> }) {
  const { t } = useTranslation();
  const locale = dateLocale();
  const end = clockAt(shift.endsAt, locale);

  return (
    <section className="myn-card" aria-labelledby="myn-shift">
      <h2 id="myn-shift">{t('staffLink.night.yourShift')}</h2>
      <p className="myn-big">{shift.job}</p>
      <p className="myn-time">
        {t('staffLink.night.times', { start: clockAt(shift.startsAt, locale), end })}
      </p>
      {crossesMidnight(shift) && (
        <p className="myn-time myn-quiet">
          {t('staffLink.night.endsOn', { day: weekdayOf(shift.endsAt, locale), time: end })}
        </p>
      )}
      {night.later != null && (
        <p className="myn-inset myn-time">
          {t('staffLink.night.later', {
            job: night.later.job,
            time: clockAt(night.later.startsAt, locale),
          })}
        </p>
      )}
    </section>
  );
}

function YourLead({ lead }: { lead: MyNight['lead'] }) {
  const { t } = useTranslation();

  return (
    <section className="myn-card" aria-labelledby="myn-lead">
      <h2 id="myn-lead">{t('staffLink.night.yourLead')}</h2>
      {lead == null ? (
        <p className="myn-quiet">{t('staffLink.night.noLead')}</p>
      ) : (
        <div className="myn-lead">
          <div className="myn-lead-who">
            <p className="myn-big">{lead.name}</p>
            {lead.floor && (
              <p className="myn-flag">
                <Flag />
                {t('staffLink.night.floorLead')}
              </p>
            )}
          </div>
          {lead.phone != null && (
            <a
              className="button button-primary myn-call"
              href={`tel:${lead.phone}`}
              aria-label={t(
                lead.floor ? 'staffLink.night.callFloorLead' : 'staffLink.night.callLead',
                {
                  name: lead.name,
                },
              )}
            >
              <Glyph name="phone" size={18} />
              <span>{t('staffLink.night.call')}</span>
            </a>
          )}
        </div>
      )}
    </section>
  );
}

function Flag() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 22V3" />
      <path d="M5 4h13l-3 4.5L18 13H5" />
    </svg>
  );
}

function Timing({ night }: { night: MyNight }) {
  const { t } = useTranslation();
  const locale = dateLocale();

  return (
    <section className="myn-card" aria-labelledby="myn-timing">
      <h2 id="myn-timing">{t('staffLink.night.timing')}</h2>
      <ol className="myn-moments">
        {night.timing.map((moment) => (
          <li key={`${moment.at}${moment.title}`}>
            <span className="myn-time myn-at">{clockAt(moment.at, locale)}</span>
            <span className="myn-what">
              <span>{moment.title}</span>
              <span className="myn-for">
                <span
                  className={moment.for === 'staff' ? 'myn-square' : 'myn-circle'}
                  aria-hidden="true"
                />
                {moment.for === 'staff' ? t('staffLink.night.staff') : t('staffLink.night.guests')}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Tables({ night, tables, now }: { night: MyNight; tables: MyNightTable[]; now: number }) {
  const { t } = useTranslation();
  const open = now >= Date.parse(night.doorsAt);

  return (
    <section className="myn-card" aria-labelledby="myn-tables">
      <h2 id="myn-tables">{t('staffLink.night.yourTables')}</h2>
      {open ? (
        tables.map((table) => (
          <div key={table.name} className="myn-table">
            <h3>
              <span>{table.name}</span>
              <span className="myn-count">
                {t('staffLink.night.guestCount', { count: table.guests.length })}
              </span>
            </h3>
            <ul>
              {table.guests.map((guest, index) => {
                const dietary = dietaryOf(t, guest);

                return (
                  <li key={`${guest.name}${index}`}>
                    <span>{guest.name}</span>
                    {dietary != null && (
                      <span className="myn-diet">
                        <span className="myn-diamond" aria-hidden="true" />
                        {dietary}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      ) : (
        <p className="myn-inset myn-opens">
          <Glyph name="clock" size={18} />
          <span>
            {t('staffLink.night.opensAt', { time: clockAt(night.doorsAt, dateLocale()) })}
          </span>
        </p>
      )}
    </section>
  );
}

/** The link's end, with its day whenever that is not today on the event's clock. */
function endsWords(night: MyNight, now: number, t: ReturnType<typeof useTranslation>['t']): string {
  return atWords(
    night.endsAt,
    {
      endsAt: night.endsAt,
      timeZone: night.event.timeZone,
      locale: dateLocale(),
      now: new Date(now),
    },
    t,
  );
}

/** Signed in as, the browser's line and Sign out: under the page on a phone, in the bar from 800. */
function You({
  name,
  night,
  now,
  place,
  onSignOut,
}: {
  name: string;
  night: MyNight | null;
  now: number;
  place: 'bar' | 'foot';
  onSignOut: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className={place === 'bar' ? 'myn-you myn-you-bar' : 'myn-you myn-you-foot'}>
      <p className="myn-strong">{t('redeem.signedInAs', { name })}</p>
      {night != null && (
        <p className="myn-alone">
          {t('staffLink.night.alone', { time: endsWords(night, now, t) })}
        </p>
      )}
      <button type="button" className="myn-secondary" onClick={onSignOut}>
        {t('redeem.signOut')}
      </button>
    </div>
  );
}
