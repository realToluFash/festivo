import { useTranslation } from 'react-i18next';

import { Glyph } from '../components/Glyph.tsx';
import { type BannerActions, BannerBell } from '../components/TodayBanner.tsx';
import type { Now, Open } from '../components/today.ts';
import type { RunNow, RunStop } from './todayRun.ts';
import { nowWordsIn } from './todayRun.ts';
import './todayNow.css';

type Words = ReturnType<typeof nowWordsIn>;

/** Each stop a shape as well as a place: filled once done, the large ringed dot Now, a ring Next, a small ring still to come. */
function Rail({ rail, said, words }: { rail: readonly RunStop[]; said: string; words: Words }) {
  return (
    <ol className="tn-rail" role="img" aria-label={said}>
      {rail.map((stop) => (
        <li key={stop.time} className={`tn-stop is-${stop.state}`}>
          <span className="tn-stop-line" aria-hidden="true">
            <span className="tn-stop-node" />
          </span>
          <span className="tn-stop-time">{words.clock(stop.time)}</span>
          <span className="tn-stop-title">{stop.title}</span>
        </li>
      ))}
    </ol>
  );
}

/** On an event day for a role with run_of_show.read, Now is the run of show (sc-61017, by sc-29875): the item Now, its until line and the run view's figure, Next alone on its row, the rail, and Open run of show. */
export function RunNowBanner({
  now,
  run,
  actions,
  open,
  language,
  locale,
}: {
  now: Now;
  run: RunNow;
  actions: BannerActions;
  open: Open;
  language: string;
  locale: string;
}) {
  const { t } = useTranslation();
  const words = nowWordsIn(language, locale);
  const headline = run.title ?? (run.everything ? t('night.everything') : t('night.nothingOn'));
  const figure =
    run.figure == null
      ? null
      : run.figure.kind === 'onTime'
        ? { shown: t('runView.onTime'), said: t('runView.onTime') }
        : run.figure.kind === 'last'
          ? { shown: t('runView.last'), said: t('runView.last') }
          : {
              shown: t('runView.behind', { count: run.figure.minutes }),
              said: words.behindSaid(run.figure.minutes),
            };
  const bell = actions.bell;

  return (
    <header className={`today-now today-cover is-${now.event.mesh} tn`}>
      <span className="today-now-shade" aria-hidden="true" />
      <div className="today-now-top">
        <div className="today-now-chips">
          <span className="today-chip is-light">
            <span className="today-live-dot is-ringed" aria-hidden="true" />
            {t('today.liveNow')}
          </span>
          <span className="today-chip is-dark">{now.live}</span>
        </div>
        <div className="today-actions">
          {actions.create && (
            <button type="button" className="today-glass" onClick={() => open({ to: 'create' })}>
              <Glyph name="plus" size={18} />
              {t('events.newEvent')}
            </button>
          )}
          {typeof bell === 'object' && bell != null && 'unread' in bell ? (
            <BannerBell unread={bell.unread} onOpen={() => open({ to: 'notifications' })} />
          ) : (
            bell
          )}
        </div>
      </div>
      <div className="today-now-mid">
        <div className="today-now-words">
          <p className="today-now-event">{now.name}</p>
          <h1 className="today-now-title tn-headline">{headline}</h1>
          {(run.until != null || figure != null) && (
            <div className="today-now-line tn-line">
              {run.until != null && (
                <span className="today-now-until">{words.until(run.until)}</span>
              )}
              {figure != null && (
                <span className="today-chip is-glass tn-figure">
                  <span aria-hidden="true">{figure.shown}</span>
                  <span className="visually-hidden">{figure.said}</span>
                </span>
              )}
            </div>
          )}
        </div>
        <div className="today-now-side">
          {run.next != null && (
            <div className="today-next-up tn-next">
              <span className="today-next-label">{t('today.next')}</span>
              <span className="today-next-what">
                <span className="today-figures">{words.clock(run.next.time)}</span> {run.next.title}
              </span>
            </div>
          )}
          <button type="button" className="today-white" onClick={() => open({ to: 'runOfShow' })}>
            {t('today.openRunOfShow')}
            <Glyph name="arrow" size={18} />
          </button>
        </div>
      </div>
      <Rail rail={run.rail} said={words.railSaid(run.rail)} words={words} />
    </header>
  );
}
