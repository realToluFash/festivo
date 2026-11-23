import type { EventPicks } from '@soirely/api-client';
import { createContext, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { hostCount, shareOf } from './seePicks.ts';
import './seePicks.css';

const POLL_MS = 8000;

interface OnMenu {
  eventId: string;
  picks: EventPicks;
}

const Picked = createContext<OnMenu | null>(null);

export const MenuPicksProvider = Picked.Provider;

export function useEventPicks(eventId: string): OnMenu | null {
  const [picks, setPicks] = useState<EventPicks | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let current = true;
    api.menuPicks(eventId).then(
      (next) => {
        if (current) setPicks(next);
      },
      () => undefined,
    );

    return () => {
      current = false;
    };
  }, [eventId, tick]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((n) => n + 1), POLL_MS);

    return () => window.clearInterval(timer);
  }, []);

  return picks == null ? null : { eventId, picks };
}

export const useMenuPicks = (): OnMenu | null => useContext(Picked);

function useFigure(id: string): { count: number; share: number } | null {
  const shown = useMenuPicks();
  if (shown == null) return null;
  const row = shown.picks.courses.flatMap((course) => course.rows).find((one) => one.id === id);
  const count = row == null ? 0 : row.chosen + row.defaulted;

  return { count, share: shareOf(count, shown.picks.room) };
}

export function DishPicks({ id }: { id: string }) {
  const { t } = useTranslation();
  const figure = useFigure(id);
  if (figure == null) return null;

  return (
    <p className="pk-row-picks">
      {t('seePicks.menuPicks', { count: figure.count, share: figure.share })}
    </p>
  );
}

export function VariantPicks({ id }: { id: string }) {
  const { t } = useTranslation();
  const figure = useFigure(id);
  if (figure == null) return null;

  return (
    <p className="vr-picks">
      <span>{t('seePicks.number', { n: figure.count })}</span>
      <span>{t('seePicks.percent', { n: figure.share })}</span>
    </p>
  );
}

const picksPath = (eventId: string) => `/app/events/${encodeURIComponent(eventId)}/menu/picks`;

export function SeePicksLink({ courseId, course }: { courseId: string; course: string }) {
  const { t } = useTranslation();
  const shown = useMenuPicks();
  if (shown == null || !shown.picks.courses.some((one) => one.id === courseId)) return null;

  return (
    <Link
      className="gs-pill is-secondary pk-see"
      to={`${picksPath(shown.eventId)}#pk-${courseId}`}
      aria-label={`${t('seePicks.title')} · ${course}`}
    >
      {t('seePicks.title')}
    </Link>
  );
}

/** Kitchen sheet beside Preview as guest (sc-3911), once the menu has picks to count. */
export function KitchenSheetLink() {
  const { t } = useTranslation();
  const shown = useMenuPicks();
  if (shown == null || shown.picks.courses.length === 0) return null;

  return (
    <Link
      className="gs-pill is-secondary mc-preview"
      to={`/app/events/${encodeURIComponent(shown.eventId)}/menu/kitchen`}
    >
      <Glyph name="page" size={16} weight={2.4} />
      {t('kitchenSheet.title')}
    </Link>
  );
}

export function useCanChoose(): boolean {
  return useMenuPicks()?.picks.canChoose === true;
}

export function WhoHasntLink({ courseId, course }: { courseId: string; course: string }) {
  const { t } = useTranslation();
  const shown = useMenuPicks();
  if (shown?.picks.canChoose !== true) return null;

  return (
    <Link
      className="gs-pill is-secondary mc-who-hasnt"
      to={`${picksPath(shown.eventId)}?course=${encodeURIComponent(courseId)}`}
      aria-label={t('seePicks.whoHasntAria', { course })}
    >
      {t('seePicks.whoHasnt')}
    </Link>
  );
}

export function PicksSummary({ closeLine }: { closeLine: string | null }) {
  const { t } = useTranslation();
  const shown = useMenuPicks();
  if (shown == null) return null;
  const { picks } = shown;
  const waiting = picks.waiting?.reduce((sum, party) => sum + party.people.length, 0) ?? null;

  return (
    <aside className="desk-card pk-summary" aria-labelledby="pk-summary-title">
      <h2 id="pk-summary-title" className="pk-card-title">
        {t('seePicks.summaryTitle')}
      </h2>
      <p className="pk-header">
        {t('seePicks.header', {
          answered: picks.answered,
          room: picks.room,
          percent: picks.percent,
        })}
      </p>
      <ul className="pk-lines">
        <li>{t('seePicks.summaryHost', { count: hostCount(picks) })}</li>
        {waiting != null && <li>{t('seePicks.summaryWaiting', { count: waiting })}</li>}
      </ul>
      {closeLine != null && <p className="mn-quiet">{closeLine}</p>}
      <Link className="gs-pill is-primary pk-go" to={picksPath(shown.eventId)}>
        {t('seePicks.title')}
      </Link>
    </aside>
  );
}
