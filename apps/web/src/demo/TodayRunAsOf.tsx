import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';

import { Glyph } from '../components/Glyph.tsx';
import { Actions, type BannerActions } from '../components/TodayBanner.tsx';
import type { Now, Open } from '../components/today.ts';
import type { RunNow, RunStop } from '../components/todayRun.ts';
import '../components/todayRun.css';
import './nowAge.css';

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

/** sc-4028's crossed-out signal, as Today's offline band draws it, so one state has one shape. */
function OfflineMark() {
  return (
    <svg
      className="na-mark"
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

/** The product's RunNowBanner (sc-61017) with sc-62416's line under the figure, "Offline · as of 16:38", once its reads stop landing. The developer moves `asOf` into components/TodayRunBanner.tsx. */
export function RunNowAsOfBanner({
  now,
  run,
  asOf,
  actions,
  open,
  titleRef,
}: {
  now: Now;
  run: RunNow;
  /** The line's words, or null while the last landed read is 60 seconds old or less, or none has failed since. */
  asOf: string | null;
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
          {/* Always there, so a screen reader hears the line once, politely, as it appears, and not again while its words stay the same. */}
          <p role="status" className="na-line">
            {asOf != null && (
              <>
                <OfflineMark />
                <span>{asOf}</span>
              </>
            )}
          </p>
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
