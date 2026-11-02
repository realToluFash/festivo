import { fallsOnEarlierDay, formatDay, formatTimeOfDay, nextMidnight } from '@soirely/domain';
import {
  type ReactNode,
  type Ref,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { dateLocale } from '../i18n/index.ts';
import { type Stale, StaleScreen } from '../offline.ts';

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [stale, show] = useState<Stale | null>(null);

  return <StaleScreen.Provider value={{ stale, show }}>{children}</StaleScreen.Provider>;
}

/** Under the header, taking its own room: what was in view stays in view, as `ReleaseBand` keeps it. */
export function OfflineBand() {
  const { stale } = useContext(StaleScreen);
  const band = useRef<HTMLDivElement>(null);
  const before = useRef<{ edge: number; scrolled: boolean; field: Element | null } | null>(null);
  const showing = stale != null;

  // Measured while the band is away, so its arrival can be told apart from the browser's own scroll anchoring.
  useLayoutEffect(() => {
    if (showing) return;

    const measure = () => {
      if (band.current == null) return;

      before.current = {
        edge: band.current.getBoundingClientRect().bottom,
        scrolled: window.scrollY > 0,
        field: inView(document.activeElement) ? document.activeElement : null,
      };
    };
    measure();
    window.addEventListener('scroll', measure, { passive: true });
    document.addEventListener('focusin', measure);

    return () => {
      window.removeEventListener('scroll', measure);
      document.removeEventListener('focusin', measure);
    };
  }, [showing]);

  useLayoutEffect(() => {
    const was = before.current;

    if (!showing || was == null || band.current == null) return;

    before.current = null;
    const moved = band.current.getBoundingClientRect().bottom - was.edge;
    const pushedOut = was.field != null && !inView(was.field);

    if (moved !== 0 && (was.scrolled || pushedOut)) window.scrollBy(0, moved);
  }, [showing]);

  return <StaleBand stale={stale} ref={band} />;
}

/** The band itself, for a load that keeps its own: the page's, or the bell's feed inside its popover. */
export function StaleBand({
  stale,
  className = 'offline-band',
  ref,
}: {
  stale: Stale | null;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => new Date());
  const [said, setSaid] = useState('');
  const at = stale?.at ?? null;

  useEffect(() => {
    if (at == null) return;

    const tick = () => setNow(new Date());
    tick();
    let timer = window.setTimeout(function turn() {
      tick();
      timer = window.setTimeout(turn, nextMidnight().getTime() - Date.now());
    }, nextMidnight().getTime() - Date.now());

    return () => window.clearTimeout(timer);
  }, [at]);

  const words =
    at == null
      ? ''
      : fallsOnEarlierDay(at, now)
        ? t('offline.asOfDay', {
            day: formatDay(at, dateLocale()),
            time: formatTimeOfDay(at, dateLocale()),
          })
        : t('offline.asOf', { time: formatTimeOfDay(at, dateLocale()) });

  const showing = stale != null;
  const unanswered = stale?.unanswered ?? 0;
  const wordsNow = useRef(words);

  useLayoutEffect(() => {
    wordsNow.current = words;
  });

  // Announced when it appears and after each unanswered press, never at midnight: nobody asked for that change.
  useEffect(() => {
    setSaid('');

    if (!showing) return;

    const timer = window.setTimeout(() => setSaid(wordsNow.current), 50);

    return () => window.clearTimeout(timer);
  }, [showing, unanswered]);

  return (
    <div ref={ref} className={showing ? className : undefined}>
      <div aria-live="polite" aria-atomic="true" className="visually-hidden">
        {said}
      </div>
      {stale != null && (
        <>
          <p className="offline-band-words">
            <OfflineMark />
            <span>{words}</span>
          </p>
          <button type="button" className="offline-band-retry" onClick={stale.retry}>
            {t('events.retry')}
          </button>
        </>
      )}
    </div>
  );
}

/** sc-4028's crossed-out signal, so one state has one shape. */
function OfflineMark() {
  return (
    <svg
      className="offline-band-mark"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M1.5 6a9.5 9.5 0 0 1 13 0M3.8 8.6a6.2 6.2 0 0 1 8.4 0M6.1 11.1a2.9 2.9 0 0 1 3.8 0" />
      <path d="M2 2l12 12" />
    </svg>
  );
}

export function Refreshing() {
  const { t } = useTranslation();

  return (
    <span className="offline-refreshing">
      <span className="offline-refreshing-mark" aria-hidden="true" />
      {t('offline.refreshing')}
    </span>
  );
}

function inView(element: Element | null): boolean {
  if (element == null || element === document.body) return false;

  const { top, bottom } = element.getBoundingClientRect();

  return top >= 0 && bottom <= window.innerHeight;
}
