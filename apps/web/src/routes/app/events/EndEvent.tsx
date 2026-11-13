import { type OrganisationEvent } from '@soirely/api-client';
import { type EventPhase, cleanThankYou, endLabel, thankYouOver } from '@soirely/domain';
import { type RefObject, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { InManage, LifecycleDialog } from './LifecycleDialog.tsx';
import { ThankYouField } from './ThankYou.tsx';
import { useLifecycleAction } from './useLifecycleAction.ts';

type Label = 'callOff' | 'endNow';

/** `Lifecycle` (tweak: Call off, End now): one action, labelled Call off before the start and End now from it. */
export function EndButton({
  event,
  phase,
  now,
  heading,
  inManage = false,
  onChange,
  onEnded,
}: {
  event: OrganisationEvent;
  phase: EventPhase;
  now: Date;
  heading: RefObject<HTMLHeadingElement | null>;
  inManage?: boolean;
  onChange: (event: OrganisationEvent, tag: string) => void;
  /** Whether a thank-you went with it. */
  onEnded: (thanked: boolean) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const box = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState('');
  const [tried, setTried] = useState(false);
  const label = endLabel(event, phase, now);
  const { asking, opener, ask, go, close } = useLifecycleAction<{ label: Label }>({
    event,
    heading,
    onChange,
    onDone: () => onEnded(cleanThankYou(draft) !== ''),
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
              onClick={() => {
                setDraft('');
                setTried(false);
                ask({ label });
              }}
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
            failed={t(
              callOff
                ? 'eventEnd.callOffFailed'
                : cleanThankYou(draft) === ''
                  ? 'eventEnd.failed'
                  : 'thankYou.notEnded',
            )}
            keep={t('eventEnd.keepItOn')}
            confirm={t(callOff ? 'eventEnd.callOff' : 'eventEnd.endNow')}
            sending={t(callOff ? 'eventEnd.callingOff' : 'eventEnd.ending')}
            tone="danger"
            onGo={() => {
              if (asking.kind !== 'confirm') return;
              if (!callOff && thankYouOver(draft)) {
                setTried(true);
                box.current?.focus();
                return;
              }
              go({ label: asking.label }, () =>
                callOff ? api.endEvent(event.id) : api.endEvent(event.id, cleanThankYou(draft)),
              );
            }}
            onClose={close}
          >
            {!callOff && (
              <ThankYouField
                id={`${id}-thank-you`}
                label="shown"
                optional
                help={t('thankYou.hint')}
                value={draft}
                tried={tried}
                box={box}
                onChange={(value) => {
                  setDraft(value);
                  setTried((was) => was && thankYouOver(value));
                }}
              />
            )}
          </LifecycleDialog>
        </InManage>
      )}
    </>
  );
}
