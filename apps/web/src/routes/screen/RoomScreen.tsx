import { ApiError, type RoomScreen as Screen, realtimeTopic } from '@soirely/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';

import { api } from '../../api.ts';
import { dateLocale, showLanguage } from '../../i18n/index.ts';
import { NotFound } from '../public/NotFound.tsx';
import { useHubTopics } from '../app/events/useHubTopics.ts';
import { ASK_AGAIN_MS, FIRST_ASK_RETRY_MS, screenLanguage, screenTime } from './roomScreen.ts';
import './roomScreen.css';

type Load =
  { kind: 'asking' } | { kind: 'gone' } | { kind: 'shown'; screen: Screen; offline: boolean };

/** /s/:token (sc-3897): a place's room screen on any browser, with no sign-in. */
export function RoomScreenPage() {
  const { token = '' } = useParams();
  const [params] = useSearchParams();

  return <RoomScreen key={token} token={token} asked={params.get('lang')} />;
}

function RoomScreen({ token, asked }: { token: string; asked: string | null }) {
  const [load, setLoad] = useState<Load>({ kind: 'asking' });
  const asking = useRef(0);
  const shown = load.kind === 'shown' ? load.screen : null;
  const replaced = shown?.kind === 'replaced';

  const ask = useCallback(() => {
    const mine = ++asking.current;

    api.roomScreen(token).then(
      async (screen) => {
        await showLanguage(screenLanguage(asked, screen));
        if (mine === asking.current) setLoad({ kind: 'shown', screen, offline: false });
      },
      (error: unknown) => {
        if (mine !== asking.current) return;
        if (error instanceof ApiError && error.status === 404) setLoad({ kind: 'gone' });
        else setLoad((was) => (was.kind === 'shown' ? { ...was, offline: true } : was));
      },
    );
  }, [token, asked]);

  useEffect(ask, [ask]);

  const heard = load.kind === 'shown';

  useEffect(() => {
    if (replaced) return undefined;
    const timer = setInterval(ask, heard ? ASK_AGAIN_MS : FIRST_ASK_RETRY_MS);
    const lost = () => setLoad((was) => (was.kind === 'shown' ? { ...was, offline: true } : was));

    window.addEventListener('online', ask);
    window.addEventListener('offline', lost);

    return () => {
      clearInterval(timer);
      window.removeEventListener('online', ask);
      window.removeEventListener('offline', lost);
    };
  }, [ask, replaced, heard]);

  useEffect(() => () => void showLanguage(null), []);

  const eventId = shown != null && shown.kind !== 'replaced' ? shown.eventId : null;

  useHubTopics(
    eventId == null || replaced ? [] : [realtimeTopic('EventScreens', eventId)],
    () => api.roomScreenSubscription(token),
    ask,
    ask,
  );

  if (load.kind === 'gone') return <NotFound />;

  return (
    <main className="rs-room">
      <div className="rs-stage">
        <div className="rs-fill" data-testid="room-screen">
          {load.kind === 'shown' && <Shown screen={load.screen} offline={load.offline} />}
          {!replaced && <FullScreen />}
        </div>
      </div>
    </main>
  );
}

function Shown({ screen, offline }: { screen: Screen; offline: boolean }) {
  const { t } = useTranslation();

  if (screen.kind === 'replaced')
    return (
      <div className="rs-centre">
        <p className="rs-said">{t('roomScreen.replaced')}</p>
      </div>
    );
  if (screen.kind === 'finished')
    return (
      <div className="rs-centre">
        <h1 className="rs-big">{t('roomScreen.thanks')}</h1>
        <p className="rs-name">{screen.event}</p>
      </div>
    );
  if (screen.kind === 'nothingLeft')
    return (
      <div className="rs-centre">
        <h1 className="rs-big">{screen.event}</h1>
        {offline && <AsOf at={screen.at} />}
      </div>
    );

  return (
    <>
      <h1 className="rs-name rs-event">{screen.event}</h1>
      <div className={screen.now == null ? 'rs-body is-between' : 'rs-body'}>
        {screen.now != null && (
          <section className="rs-now" aria-labelledby="rs-now-h">
            <h2 id="rs-now-h" className="rs-label">
              {t('roomScreen.now')}
            </h2>
            <p key={screen.now.id} className="rs-big rs-change" dir="auto">
              {screen.now.title}
            </p>
          </section>
        )}
        {screen.coming.length > 0 && (
          <section className="rs-coming" aria-labelledby="rs-coming-h">
            <h2 id="rs-coming-h" className="rs-label">
              {t('roomScreen.comingUp')}
            </h2>
            <ol className="rs-list">
              {screen.coming.map((one) => (
                <li key={one.id} className="rs-item rs-change">
                  <time className="rs-time" dateTime={one.startsAt}>
                    {screenTime(one.startsAt, dateLocale())}
                  </time>
                  <span className="rs-title" dir="auto">
                    {one.title}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
      {offline && <AsOf at={screen.at} />}
    </>
  );
}

function AsOf({ at }: { at: string }) {
  const { t } = useTranslation();

  return (
    <p className="rs-asof" role="status">
      <span className="rs-dot" aria-hidden="true" />
      {t('roomScreen.asOf', { time: screenTime(at, dateLocale()) })}
    </p>
  );
}

/** Browsers allow full screen only on a press (Fullscreen API), so it is a button, gone once full. */
function FullScreen() {
  const { t } = useTranslation();
  const [full, setFull] = useState(() => document.fullscreenElement != null);

  useEffect(() => {
    const changed = () => setFull(document.fullscreenElement != null);

    document.addEventListener('fullscreenchange', changed);

    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);

  if (full) return null;

  return (
    <button
      type="button"
      className="rs-full"
      onClick={() => void document.documentElement.requestFullscreen?.().catch(() => undefined)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="rs-full-icon">
        <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
      </svg>
      {t('roomScreen.fullScreen')}
    </button>
  );
}
