import { type OrganisationEvent } from '@soirely/api-client';
import { type EventPhase, calledOff, endLabel, formatEventDate } from '@soirely/domain';
import { type RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { dateLocale } from '../../../i18n/index.ts';
import { LifecycleDialog } from './LifecycleDialog.tsx';
import { useLifecycleAction } from './useLifecycleAction.ts';

type Label = 'callOff' | 'endNow';

/** `Lifecycle` (tweak: Call off, End now): one action, labelled Call off before the start and End now from it. */
export function EndButton({
  event,
  phase,
  now,
  heading,
  onChange,
  onEnded,
}: {
  event: OrganisationEvent;
  phase: EventPhase;
  now: Date;
  heading: RefObject<HTMLHeadingElement | null>;
  onChange: (event: OrganisationEvent) => void;
  onEnded: () => void;
}) {
  const { t } = useTranslation();
  const label = endLabel(event, phase, now);
  const { asking, opener, ask, go, close } = useLifecycleAction<{ label: Label }>({
    event,
    heading,
    onChange,
    onDone: onEnded,
    refusalOf: (error) =>
      error.is('event_concluded')
        ? {
            reload: true,
            then: () => ({ title: t('eventEnd.notEnded'), lines: [t('eventEnd.alreadyOver')] }),
          }
        : null,
  });
  const callOff = asking?.kind === 'confirm' && asking.label === 'callOff';

  return (
    <>
      {label != null && (
        <button ref={opener} type="button" className="button" onClick={() => ask({ label })}>
          {t(`eventEnd.${label}`)}
        </button>
      )}
      {asking != null && (
        <LifecycleDialog
          id="end-event"
          asking={asking}
          title={t(callOff ? 'eventEnd.callOffTitle' : 'eventEnd.endTitle', { name: event.name })}
          lines={[t(callOff ? 'eventEnd.callOffBody' : 'eventEnd.endBody'), t('eventEnd.final')]}
          failed={t('eventEnd.failed')}
          keep={t('eventEnd.keepItOn')}
          confirm={t(callOff ? 'eventEnd.callOff' : 'eventEnd.endNow')}
          tone="danger"
          onGo={() =>
            asking.kind === 'confirm' && go({ label: asking.label }, () => api.endEvent(event.id))
          }
          onClose={close}
        />
      )}
    </>
  );
}

/** `Event View` (tweak: Called off): the only place a host sees afterwards that the event never happened. */
export function CalledOffNotice({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();

  if (!calledOff(event) || event.concludedAt == null) return null;

  return (
    <div className="notice notice-quiet event-called-off">
      <span className="mark mark-info" aria-hidden="true">
        i
      </span>
      <p>
        {t('eventEnd.calledOffNotice', {
          date: formatEventDate(event.concludedAt, event.timeZone, dateLocale()),
        })}
      </p>
    </div>
  );
}
