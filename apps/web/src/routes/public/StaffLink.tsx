import { ApiError, type StaffLinkWindow } from '@soirely/api-client';
import { formatWallClock, wallOfZoned } from '@soirely/domain';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { api } from '../../api.ts';
import { Brand } from '../../components/Brand.tsx';
import { dateLocale } from '../../i18n/index.ts';
import './staffLink.css';

type Load =
  | { kind: 'asking' }
  | { kind: 'gone' }
  | { kind: 'failed'; words: string | null }
  | { kind: 'shown'; window: StaffLinkWindow };

/** /w/:token (sc-3912): a person's own link to their shift, on any browser, with no sign-in. */
export function StaffLinkPage() {
  const { token = '' } = useParams();

  return <StaffLink key={token} token={token} />;
}

function StaffLink({ token }: { token: string }) {
  const [load, setLoad] = useState<Load>({ kind: 'asking' });

  useEffect(() => {
    let current = true;
    const ask = (seen: boolean) =>
      api.staffLinkWindow(token, seen).then(
        (window) => current && setLoad({ kind: 'shown', window }),
        (error: unknown) => {
          if (!current) return;
          if (error instanceof ApiError && error.status === 404) setLoad({ kind: 'gone' });
          else
            setLoad({
              kind: 'failed',
              words: error instanceof ApiError && error.status === 429 ? (error.problem.detail ?? null) : null,
            });
        },
      );
    const seenNow = () => {
      if (document.visibilityState !== 'visible') return;
      document.removeEventListener('visibilitychange', seenNow);
      void ask(true);
    };

    if (document.visibilityState === 'visible') void ask(true);
    else {
      void ask(false);
      document.addEventListener('visibilitychange', seenNow);
    }

    return () => {
      current = false;
      document.removeEventListener('visibilitychange', seenNow);
    };
  }, [token]);

  return (
    <main id="content" className="wl">
      <header className="wl-bar">
        <span className="wl-brand">
          <Brand />
        </span>
      </header>
      <div className="wl-column">
        <Shown load={load} />
      </div>
    </main>
  );
}

function Shown({ load }: { load: Load }) {
  const { t, i18n } = useTranslation();

  if (load.kind === 'asking') return null;
  if (load.kind === 'failed')
    return (
      <p className="wl-card" role="alert">
        {load.words ?? t('staffLink.failed')}
      </p>
    );
  if (load.kind === 'gone')
    return (
      <Ended
        title={t('staffLink.goneTitle')}
        body={t('staffLink.goneBody')}
        next={t('staffLink.goneNext')}
        foot={t('staffLink.foot')}
      />
    );
  if (load.window.state === 'ended')
    return (
      <Ended
        title={t('staffLink.endedTitle')}
        body={t('staffLink.endedBody')}
        next={t('staffLink.endedNext')}
        foot={t('staffLink.foot')}
      />
    );
  if (load.window.state === 'not_yet') {
    const locale = dateLocale(i18n.language);
    const wall = wallOfZoned(load.window.from);

    return (
      <Ended
        title={t('staffLink.notYetTitle', {
          time: formatWallClock(wall, locale),
          day: wallDayLong(wall, locale),
        })}
        body={t('staffLink.notYetBody')}
        next={t('staffLink.notYetNext')}
        foot={t('staffLink.notYetFoot')}
      />
    );
  }

  return null;
}

function Ended({
  title,
  body,
  next,
  foot,
}: {
  title: string;
  body: string;
  next: string;
  foot: string;
}) {
  return (
    <>
      <div className="wl-card">
        <h1 className="wl-title">{title}</h1>
        <p>{body}</p>
        <p>{next}</p>
      </div>
      <p className="wl-foot">{foot}</p>
    </>
  );
}

/** "Saturday, Oct 24", for the wall-clock day the link opens on in the event's zone. */
function wallDayLong(wall: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${wall.slice(0, 10)}T00:00Z`));
}
