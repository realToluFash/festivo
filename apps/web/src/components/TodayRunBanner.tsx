import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';

import { Glyph } from './Glyph.tsx';
import { Actions, type BannerActions } from './TodayBanner.tsx';
import type { Now, Open } from './today.ts';
import type { RunNow, RunStop } from './todayRun.ts';
import './todayRun.css';

/** Each stop a shape as well as a place: filled once done, the large ringed dot Now, a ring Next, a small ring still to come. */
function Rail({ rail, said }: { rail: readonly RunStop[]; said: string }) {
  return (
    <div className="tn-rail" role="img" aria-label={said}>
      {rail.map((stop, index) => (
        <span key={index} className={`tn-stop is-${stop.state}`}>
          <span className="tn-stop-line" aria-hidden="true">
            <span className="tn-stop-node" />
          </span>
          <span className="tn-stop-time">{stop.time}</span>
          <span className="tn-stop-title">{stop.title}</span>
        </span>
      ))}
    </div>
  );
}

function Said({ shown, said }: { shown: string; said: string | null }) {
  if (said == null) return shown;

  return (
    <>
      <span aria-hidden="true">{shown}</span>
      <span className="visually-hidden">{said}</span>
    </>
  );
}

/** On an event day for a role with run_of_show.read, Now is the run of show (sc-61017, by sc-29875): the item Now, its until line and the run view's figure, Next alone on its row, the rail, and Open run of show. */
export function RunNowBanner({
  now,
  run,
  actions,
  open,
  titleRef,
}: {
  now: Now;
  run: RunNow;
  actions: BannerActions;
  open: Open;
  titleRef?: Ref<HTMLHeadingElement>;
}) {
  const { t } = useTranslation();

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
        <Actions actions={actions} open={open} />
      </div>
      <div className="today-now-mid">
        <div className="today-now-words">
          <p className="today-now-event">{now.name}</p>
          <h1
            ref={titleRef}
            tabIndex={titleRef == null ? undefined : -1}
            className="today-now-title tn-headline"
          >
            {run.headline}
          </h1>
          {(run.until != null || run.figure != null) && (
            <div className="today-now-line tn-line">
              {run.until != null && (
                <span className="today-now-until">
                  <Said shown={run.until} said={run.untilSaid} />
                </span>
              )}
              {run.figure != null && (
                <span className="today-chip is-glass tn-figure">
                  <Said shown={run.figure.words} said={run.figure.said} />
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
                <span className="today-figures">{run.next.time}</span> {run.next.title}
              </span>
            </div>
          )}
          <button type="button" className="today-white" onClick={() => open({ to: 'runOfShow' })}>
            {t('today.openRunOfShow')}
            <Glyph name="arrow" size={18} />
          </button>
        </div>
      </div>
      <Rail rail={run.rail} said={run.railSaid} />
    </header>
  );
}
