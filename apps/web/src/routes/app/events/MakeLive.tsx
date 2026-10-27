import { type OrganisationEvent } from '@soirely/api-client';
import { type EventPhase, makeLiveRow, needsHost } from '@soirely/domain';
import { type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';
import { PHASE_WORD } from './eventWords.ts';
import { LifecycleDialog } from './LifecycleDialog.tsx';
import { useLifecycleAction } from './useLifecycleAction.ts';

/** A word and a shape of its own, never colour alone (WCAG 2.2 §1.4.1). */
export function StatusPill({ phase }: { phase: EventPhase }) {
  const { t } = useTranslation();

  return (
    <span className={`pill-quiet pill-phase pill-${phase.replace('_', '-')}`}>
      {t(PHASE_WORD[phase])}
    </span>
  );
}

/** A Draft's line for the areas it blocks (Guests so far), with Make live beside it, as `/event-states.json` says. */
export function DraftRow({
  event,
  now,
  manages,
  heading,
  onChange,
  onMadeLive,
}: {
  event: OrganisationEvent;
  now: Date;
  manages: boolean;
  heading: RefObject<HTMLHeadingElement | null>;
  onChange: (event: OrganisationEvent) => void;
  onMadeLive: () => void;
}) {
  const { t } = useTranslation();
  const row = makeLiveRow(event, now);
  const hostWanted = {
    title: t('eventLive.needsHostTitle'),
    lines: [t('eventLive.needsHostBody')],
    link: {
      label: t('eventLive.addHosts'),
      to: `/app/events/${encodeURIComponent(event.id)}/edit#hosts`,
    },
  };
  const { asking, opener, ask, tell, go, close } = useLifecycleAction<object>({
    event,
    heading,
    onChange,
    onDone: onMadeLive,
    refusalOf: (error) =>
      error.is('event_host_required')
        ? { reload: true, then: () => hostWanted }
        : error.is('event_concluded')
          ? {
              reload: true,
              then: () => ({
                title: t('eventLive.notMadeLive'),
                lines: [t('eventLive.endPassed')],
              }),
            }
          : error.is('plan_limit')
            ? {
                reload: false,
                then: () => ({
                  title: t('eventLive.planLimit', {
                    plan: error.problem.plan ?? '',
                    limit: error.problem.limit ?? 0,
                    count: error.problem.limit ?? 0,
                  }),
                  lines: [t('eventLive.planLimitStays')],
                }),
              }
            : null,
  });

  return (
    <>
      {row != null && (
        <div className="event-draft-row">
          <span className="mark mark-off" aria-hidden="true" />
          <p className="event-draft-line">{t(`eventLive.${row.line}`)}</p>
          {manages &&
            (row.makeLive ? (
              <button
                ref={opener}
                type="button"
                className="button button-primary"
                onClick={() => (needsHost(event) ? tell(hostWanted) : ask({}))}
              >
                {t('eventLive.makeLive')}
              </button>
            ) : (
              <Link className="button" to={`/app/events/${encodeURIComponent(event.id)}/edit`}>
                {t('eventLive.changeDates')}
              </Link>
            ))}
        </div>
      )}
      {asking != null && (
        <LifecycleDialog
          id="make-live"
          asking={asking}
          title={t('eventLive.confirmTitle', { name: event.name })}
          lines={[t('eventLive.confirmGuests'), t('eventLive.confirmFinal')]}
          failed={t('eventLive.failed')}
          keep={t('eventLive.notYet')}
          confirm={t('eventLive.makeLive')}
          tone="primary"
          onGo={() => go({}, () => api.makeLive(event.id))}
          onClose={close}
        />
      )}
    </>
  );
}
