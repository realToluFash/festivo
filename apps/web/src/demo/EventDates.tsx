import type { MilestoneOwner } from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';

import { Glyph, type GlyphName } from '../components/Glyph.tsx';
import { RowWords } from '../components/SettingsParts.tsx';
import { Skeleton } from '../components/Skeleton.tsx';
import { Thumb } from './EventParts.tsx';
import { type SampleEvent, lineOf } from './events.ts';
import { DATES_LOADS, type DatesLoad } from './allDates.ts';
import { KW, datesOf, kw, momentOf } from './kitchen.ts';
import './kitchen.css';

const OWNER: Record<MilestoneOwner, { word: string; key: string; glyph: GlyphName }> = {
  event: { word: KW.event, key: KW.keyEvent, glyph: 'events' },
  you: { word: KW.you, key: KW.keyYou, glyph: 'user' },
  automatic: { word: KW.automatic, key: KW.keyAutomatic, glyph: 'refresh' },
};

function Lead({ owner }: { owner: MilestoneOwner }) {
  return (
    <span className="ev-lead" aria-hidden="true">
      <Glyph name={OWNER[owner].glyph} size={22} weight={2} />
    </span>
  );
}

const RETRY_MS = 700;

function useDatesLoad(): [DatesLoad, boolean, () => void] {
  const [params] = useSearchParams();
  const state = params.get('state');
  const named = state != null && Object.hasOwn(DATES_LOADS, state) ? state : null;
  const [load, setLoad] = useState<DatesLoad>(
    named == null ? 'loaded' : DATES_LOADS[named as keyof typeof DATES_LOADS],
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (attempt === 0 || named === 'allDatesLoading') return;
    const fails = named === 'allDatesFailedAgain' && attempt === 1;
    const timer = window.setTimeout(() => setLoad(fails ? 'failed' : 'loaded'), RETRY_MS);

    return () => window.clearTimeout(timer);
  }, [attempt, named]);

  return [
    load,
    attempt > 0,
    () => {
      setLoad('loading');
      setAttempt((n) => n + 1);
    },
  ];
}

/** All dates in A (board Kitchen-A-Milestone): every milestone earliest first, whose it is in its lead and line, a tag only off the rule, its action under it. */
export function AllDates({ event, now }: { event: SampleEvent; now: Date }) {
  const { t } = useTranslation();
  const marked = datesOf(event, now);
  const [load, retried, retry] = useDatesLoad();
  const title = useRef<HTMLHeadingElement>(null);

  return (
    <div className="dates">
      <h1 ref={title} className="gs-title" tabIndex={-1}>
        {KW.allDates}
      </h1>
      <div className="ev-strip">
        <Thumb event={event} size={40} />
        <RowWords title={event.name} lines={[lineOf(event, now)]} />
      </div>
      {load === 'loading' && (
        <Skeleton words={t('timeline.loading')} shape="rows" rowHeight={56} rows={3} inCard />
      )}
      {load === 'failed' && (
        <div className="dates-failed" role={retried ? 'alert' : undefined}>
          <p>
            <Glyph name="alert" size={16} weight={2.2} />
            {t('timeline.failed')}
          </p>
          <button
            type="button"
            className="gs-pill is-secondary"
            onClick={() => {
              retry();
              title.current?.focus();
            }}
          >
            {t('timeline.retry')}
          </button>
        </div>
      )}
      {load === 'loaded' && <Dates event={event} now={now} marked={marked} />}
    </div>
  );
}

function Dates({
  event,
  now,
  marked,
}: {
  event: SampleEvent;
  now: Date;
  marked: ReturnType<typeof datesOf>;
}) {
  return (
    <>
      <p className="dates-intro">{kw(KW.intro, { zone: event.timeZone })}</p>
      <ol className="desk-rows ev-details">
        {marked.map(({ milestone, standing, nextUp }) => (
          <li key={`${milestone.at}|${milestone.title}`} className="ev-part">
            <div className="desk-row dates-row">
              <Lead owner={milestone.owner} />
              <RowWords
                title={milestone.title}
                lines={[
                  <span key="when">
                    {OWNER[milestone.owner].word} ·{' '}
                    <time dateTime={milestone.at}>
                      {momentOf(milestone.at, event.timeZone, now)}
                    </time>
                  </span>,
                  ...(milestone.note == null ? [] : [milestone.note]),
                ]}
              />
              <span className="dates-tags">
                {standing === 'overdue' && (
                  <span className="dates-tag is-overdue">
                    <Glyph name="alert" size={13} weight={2.4} />
                    {KW.overdue}
                  </span>
                )}
                {standing === 'passed' && (
                  <span className="dates-tag is-passed">
                    <Glyph name="tick" size={13} weight={2.6} />
                    {KW.passed}
                  </span>
                )}
                {nextUp && <span className="dates-tag">{KW.nextUpTag}</span>}
              </span>
            </div>
            {milestone.action != null && (
              <Link className="desk-text ev-maps" to={milestone.action.link}>
                {milestone.action.label}
                <Glyph name="arrow" size={16} weight={2.4} />
              </Link>
            )}
          </li>
        ))}
      </ol>
      <dl className="dates-key">
        {(['event', 'you', 'automatic'] as const).map((owner) => (
          <div key={owner} className="dates-key-row">
            <Lead owner={owner} />
            <dt>{OWNER[owner].word}</dt>
            <dd>{OWNER[owner].key}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
