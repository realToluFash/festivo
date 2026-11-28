import { ApiError, type RoomScreen as Screen, realtimeTopic } from '@soirely/api-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router';

import { api } from '../../api.ts';
import { dateLocale, showLanguage } from '../../i18n/index.ts';
import { NotFound } from '../public/NotFound.tsx';
import { useHubTopics } from '../app/events/useHubTopics.ts';
import {
  ASK_AGAIN_FAILING_MS,
  ASK_EVERY_MS,
  ASK_TIMEOUT_MS,
  OUT_OF_TOUCH_MS,
  screenLanguage,
  screenTime,
} from './roomScreen.ts';
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
  const asks = useRef({
    sent: 0,
    applied: 0,
    lastSentAt: 0,
    failingSince: null as number | null,
    gone: false,
    open: new Set<AbortController>(),
  });
  const outOfTouch = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const shown = load.kind === 'shown' ? load.screen : null;
  const replaced = shown?.kind === 'replaced';

  const lost = useCallback(
    () => setLoad((was) => (was.kind === 'shown' ? { ...was, offline: true } : was)),
    [],
  );

  const ask = useCallback(() => {
    const state = asks.current;
    const mine = ++state.sent;
    const sentAt = Date.now();
    const abort = new AbortController();
    let settled = false;

    state.lastSentAt = sentAt;
    state.open.add(abort);

    const settle = (): boolean => {
      if (settled) return false;
      settled = true;
      state.open.delete(abort);
      clearTimeout(timeout);

      return !state.gone && mine > state.applied;
    };
    const failed = () => {
      if (!settle() || state.failingSince != null) return;
      state.failingSince = sentAt;
      outOfTouch.current = setTimeout(lost, sentAt + OUT_OF_TOUCH_MS - Date.now());
    };
    const timeout = setTimeout(() => {
      failed();
      abort.abort();
    }, ASK_TIMEOUT_MS);

    api.roomScreen(token, { signal: abort.signal }).then(
      async (screen) => {
        if (!settle()) return;
        state.applied = mine;
        state.failingSince = null;
        clearTimeout(outOfTouch.current);
        await showLanguage(screenLanguage(asked, screen));
        if (!state.gone && state.applied === mine)
          setLoad({ kind: 'shown', screen, offline: false });
      },
      (error: unknown) => {
        if (!(error instanceof ApiError && error.status === 404)) failed();
        else if (settle()) {
          state.applied = mine;
          setLoad({ kind: 'gone' });
        }
      },
    );
  }, [token, asked, lost]);

  useEffect(() => {
    const state = asks.current;
    state.gone = false;

    return () => {
      state.gone = true;
      state.open.forEach((open) => open.abort());
      clearTimeout(outOfTouch.current);
    };
  }, []);

  useEffect(ask, [ask]);

  useEffect(() => {
    if (replaced) return undefined;
    const state = asks.current;
    const timer = setInterval(() => {
      const every = state.failingSince == null ? ASK_EVERY_MS : ASK_AGAIN_FAILING_MS;
      if (Date.now() - state.lastSentAt >= every) ask();
    }, ASK_AGAIN_FAILING_MS / 4);

    window.addEventListener('online', ask);
    window.addEventListener('offline', lost);

    return () => {
      clearInterval(timer);
      window.removeEventListener('online', ask);
      window.removeEventListener('offline', lost);
    };
  }, [ask, lost, replaced]);

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
    <main className="room-room">
      <div className="room-stage">
        <div className="room-fill" data-testid="room-screen">
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
      <div className="room-centre">
        <p className="room-said">{t('roomScreen.replaced')}</p>
      </div>
    );
  if (screen.kind === 'finished')
    return (
      <div className="room-centre">
        <h1 className="room-big">{t('roomScreen.thanks')}</h1>
        <p className="room-name">{screen.event}</p>
      </div>
    );
  if (screen.kind === 'nothingLeft')
    return (
      <div className="room-centre">
        <h1 className="room-big">{screen.event}</h1>
        {offline && <AsOf at={screen.at} />}
      </div>
    );

  return (
    <>
      <h1 className="room-name room-event">{screen.event}</h1>
      <div className={screen.now == null ? 'room-body is-between' : 'room-body'}>
        {screen.now != null && (
          <section className="room-now" aria-labelledby="room-now-h">
            <h2 id="room-now-h" className="room-label">
              {t('roomScreen.now')}
            </h2>
            <p key={screen.now.id} className="room-big room-change" dir="auto">
              {screen.now.title}
            </p>
          </section>
        )}
        {screen.coming.length > 0 && (
          <section className="room-coming" aria-labelledby="room-coming-h">
            <h2 id="room-coming-h" className="room-label">
              {t('roomScreen.comingUp')}
            </h2>
            <ol className="room-list">
              {screen.coming.map((one) => (
                <li key={one.id} className="room-item room-change">
                  <time className="room-time" dateTime={one.startsAt}>
                    {screenTime(one.startsAt, dateLocale())}
                  </time>
                  <span className="room-title" dir="auto">
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
    <p className="room-asof" role="status">
      <span className="room-dot" aria-hidden="true" />
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
      className="room-full"
      onClick={() => void document.documentElement.requestFullscreen?.().catch(() => undefined)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="room-full-icon">
        <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
      </svg>
      {t('roomScreen.fullScreen')}
    </button>
  );
}
