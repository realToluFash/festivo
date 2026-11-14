import { type OrganisationEvent } from '@soirely/api-client';
import { type EventPhase, endLabel } from '@soirely/domain';
import { type RefObject, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { InManage, LifecycleDialog } from './LifecycleDialog.tsx';
import { useLifecycleAction } from './useLifecycleAction.ts';

type Label = 'callOff' | 'endNow';

/** `Lifecycle` (tweak: Call off, End now): one action, labelled Call off before the start and End now from it. */
export function EndButton({
  event,
  phase,
  now,
  heading,
  inManage = false,
  asks,
  onChange,
  onEnded,
}: {
  event: OrganisationEvent;
  phase: EventPhase;
  now: Date;
  heading: RefObject<HTMLHeadingElement | null>;
  inManage?: boolean;
  /** Opens this button's own confirmation from elsewhere, as Delete event's refusal does (sc-14445). */
  asks?: RefObject<(() => void) | null>;
  onChange: (event: OrganisationEvent, tag: string) => void;
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

  useEffect(() => {
    if (asks == null) return;
    asks.current = label == null ? null : () => ask({ label });

    return () => {
      asks.current = null;
    };
  });

  return (
    <>
      {label != null && (
        <InManage
          on={inManage}
          red
          line={`${t(label === 'callOff' ? 'eventEnd.callOffBody' : 'eventEnd.endBody')} ${t('eventEnd.final')}`}
        >
          {(look) => (
            <button
              ref={opener}
              type="button"
              className={look?.className ?? 'button'}
              aria-describedby={look?.describedBy}
              onClick={() => ask({ label })}
            >
              {t(label === 'callOff' ? 'eventEnd.callOffOpen' : 'eventEnd.endNowOpen')}
            </button>
          )}
        </InManage>
      )}
      {asking != null && (
        <InManage on={inManage}>
          <LifecycleDialog
            id="end-event"
            asking={asking}
            title={t(callOff ? 'eventEnd.callOffTitle' : 'eventEnd.endTitle', { name: event.name })}
            lines={[t(callOff ? 'eventEnd.callOffBody' : 'eventEnd.endBody'), t('eventEnd.final')]}
            failed={t(callOff ? 'eventEnd.callOffFailed' : 'eventEnd.failed')}
            keep={t('eventEnd.keepItOn')}
            confirm={t(callOff ? 'eventEnd.callOff' : 'eventEnd.endNow')}
            sending={t(callOff ? 'eventEnd.callingOff' : 'eventEnd.ending')}
            tone="danger"
            onGo={() =>
              asking.kind === 'confirm' && go({ label: asking.label }, () => api.endEvent(event.id))
            }
            onClose={close}
          />
        </InManage>
      )}
    </>
  );
}
