import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CHECK_EVERY_MS, deployedDiffers } from '../release.ts';

/** Mounted once above every page with its live region there from load, so a screen reader reads it once. */
export function ReleaseBand({ differs = deployedDiffers }: { differs?: typeof deployedDiffers }) {
  const { t } = useTranslation();
  const [updated, setUpdated] = useState(false);
  const band = useRef<HTMLDivElement>(null);
  const before = useRef<{ edge: number; scrolled: boolean; field: Element | null } | null>(null);

  useEffect(() => {
    if (updated) return;

    let checking = false;
    let stopped = false;

    const check = async () => {
      if (checking || document.visibilityState !== 'visible') return;

      checking = true;
      const differ = await differs();
      checking = false;

      if (stopped || differ !== true || band.current == null) return;

      before.current = {
        edge: band.current.getBoundingClientRect().bottom,
        scrolled: window.scrollY > 0,
        field: inView(document.activeElement) ? document.activeElement : null,
      };
      setUpdated(true);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    const timer = window.setInterval(() => void check(), CHECK_EVERY_MS);

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
    };
  }, [updated, differs]);

  // What is in view stays put where the browser's scroll anchoring has not already kept it.
  useLayoutEffect(() => {
    const was = before.current;

    if (!updated || was == null || band.current == null) return;

    before.current = null;
    const moved = band.current.getBoundingClientRect().bottom - was.edge;
    const pushedOut = was.field != null && !inView(was.field);

    if (moved !== 0 && (was.scrolled || pushedOut)) window.scrollBy(0, moved);
  }, [updated]);

  return (
    <div ref={band} className={updated ? 'release-band' : undefined}>
      <p aria-live="polite" aria-atomic="true" className="release-band-words">
        {updated ? t('release.updated') : null}
      </p>
      {updated && (
        <button
          type="button"
          className="release-band-reload"
          onClick={() => window.location.reload()}
        >
          {t('release.reload')}
        </button>
      )}
    </div>
  );
}

function inView(element: Element | null): boolean {
  if (element == null || element === document.body) return false;

  const { top, bottom } = element.getBoundingClientRect();

  return top >= 0 && bottom <= window.innerHeight;
}
