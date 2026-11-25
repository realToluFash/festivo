import type { GuestPage } from '@soirely/api-client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Glyph } from '../../components/Glyph.tsx';
import './guestDay.css';

/** Set once, from the page as it loaded: a Coming guest's live page on the event's day (sc-24381). */
export function leadsOnTheDay(page: GuestPage): boolean {
  return page.onTheDay && page.phase === 'live' && page.guest.reply?.answer === 'coming';
}

export interface Place {
  name: string | null;
  address: string | null;
  note: string | null;
}

export function placeOf(page: GuestPage): Place {
  const { venue, arrivalNote } = page.event;

  return {
    name: venue?.name ?? null,
    address: venue?.address ?? null,
    note: page.phase === 'live' ? arrivalNote : null,
  };
}

export function hasWhere(place: Place): boolean {
  return place.name != null || place.address != null || place.note != null;
}

/** Google Maps' search on the address alone, as the event-change email links it. */
export function mapsLink(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/** sc-1301's code under Your code; the screen stays on while its card is in view. */
export function YourCode({ qrSvg, withCompanions }: { qrSvg: string; withCompanions: boolean }) {
  const { t } = useTranslation();
  const [card, setCard] = useState<HTMLDivElement | null>(null);
  useWakeLock(card);

  return (
    <section className="gp-day-code" aria-labelledby="gp-door">
      <h2 id="gp-door" className="gp-h2">
        {t('guest.yourCode')}
      </h2>
      <div ref={setCard} className="gp-day-card">
        <p className="gp-day-door">{t('guest.doorTitle')}</p>
        <div className="gp-code">
          <img
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`}
            alt={t('guest.doorCode')}
            width={196}
            height={196}
          />
        </div>
        <p className="gp-sub">{t(withCompanions ? 'guest.doorLine' : 'guest.doorLineAlone')}</p>
      </div>
    </section>
  );
}

/** The start time, the venue and the host's arrival note, shown once on the day; nothing when there is none of them. */
export function WhereBlock({ page, when }: { page: GuestPage; when: string }) {
  const { t } = useTranslation();
  const place = placeOf(page);

  if (!hasWhere(place)) return null;

  return (
    <section className="gp-day-block" aria-labelledby="gp-where-h">
      <h2 id="gp-where-h" className="gp-h2">
        {t('guest.where')}
      </h2>
      <div className="gp-day-place">
        <p className="gp-day-time">
          <time dateTime={page.event.startsAt}>{when}</time>
        </p>
        {place.name != null && <p className="gp-day-venue">{place.name}</p>}
        {place.address != null && (
          <>
            <p className="gp-day-address">{place.address}</p>
            <a
              className="gp-text"
              href={mapsLink(place.address)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Glyph name="map" weight={2.2} />
              <span>{t('eventPage.openInMaps')}</span>
            </a>
          </>
        )}
      </div>
      {place.note != null && (
        <p className="gp-day-note" dir="auto">
          {place.note}
        </p>
      )}
    </section>
  );
}

export function wantsLock(inView: boolean, visible: boolean): boolean {
  return inView && visible;
}

/** Holds a screen wake lock while `target` is at least partly on screen and the page is shown, and asks again when the page comes back. */
export function useWakeLock(target: HTMLElement | null): void {
  useEffect(() => {
    if (target == null || !('wakeLock' in navigator) || typeof IntersectionObserver === 'undefined')
      return;

    const { wakeLock } = navigator;
    let inView = false;
    let held: WakeLockSentinel | null = null;
    let asking = false;
    let gone = false;
    const wanted = () => !gone && wantsLock(inView, document.visibilityState === 'visible');

    const settle = (): void => {
      if (wanted() && held == null && !asking) {
        asking = true;
        wakeLock.request('screen').then(
          (sentinel) => {
            asking = false;
            if (!wanted()) {
              void sentinel.release();
              return;
            }
            held = sentinel;
            // The browser lets the lock go by itself when the page is hidden.
            sentinel.addEventListener('release', () => {
              if (held === sentinel) held = null;
            });
          },
          () => {
            asking = false;
          },
        );
      } else if (!wanted() && held != null) {
        const was = held;
        held = null;
        void was.release();
      }
    };

    const seen = new IntersectionObserver((entries) => {
      inView = entries.at(-1)?.isIntersecting ?? false;
      settle();
    });
    seen.observe(target);
    document.addEventListener('visibilitychange', settle);

    return () => {
      gone = true;
      seen.disconnect();
      document.removeEventListener('visibilitychange', settle);
      settle();
    };
  }, [target]);
}
