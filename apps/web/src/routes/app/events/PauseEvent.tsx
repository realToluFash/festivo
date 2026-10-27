import { ApiError, type EventStatus, type OrganisationEvent } from '@soirely/api-client';
import { type EventPhase, changedWords, eventAllows } from '@soirely/domain';
import { type RefObject, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { offButton } from '../../../offButton.ts';
import { LifecycleDialog } from './LifecycleDialog.tsx';
import { useLifecycleAction } from './useLifecycleAction.ts';

/** `Lifecycle` (tweak: Pause): a secondary button beside Call off or End now, so it is never where a stray tap lands first. */
export function PauseButton({
  event,
  phase,
  heading,
  onChange,
  onPaused,
}: {
  event: OrganisationEvent;
  phase: EventPhase;
  heading: RefObject<HTMLHeadingElement | null>;
  onChange: (event: OrganisationEvent) => void;
  onPaused: () => void;
}) {
  const { t } = useTranslation();
  const { asking, opener, ask, go, close } = useLifecycleAction<object>({
    event,
    heading,
    onChange,
    onDone: onPaused,
  });

  return (
    <>
      {eventAllows(phase, 'pause') && (
        <button ref={opener} type="button" className="button" onClick={() => ask({})}>
          {t('eventPause.pause')}
        </button>
      )}
      {asking != null && (
        <LifecycleDialog
          id="pause-event"
          asking={asking}
          title={t('eventPause.title', { name: event.name })}
          lines={[t('eventPause.body'), t('eventPause.nothingLost')]}
          failed={t('eventPause.failed')}
          keep={t('eventPause.keepItLive')}
          confirm={t('eventPause.pause')}
          tone="primary"
          onGo={() => go({}, () => api.pauseEvent(event.id))}
          onClose={close}
        />
      )}
    </>
  );
}

/** `Event View` (tweak: Paused): the amber line and the page's primary Resume, which asks nothing; past the end the phase is Finished and neither shows. A refusal reloads the event, which may then be past Paused: the row stays to say so. */
export function PausedRow({
  event,
  phase,
  manages,
  heading,
  onChange,
  onResumed,
}: {
  event: OrganisationEvent;
  phase: EventPhase;
  manages: boolean;
  heading: RefObject<HTMLHeadingElement | null>;
  onChange: (event: OrganisationEvent) => void;
  onResumed: () => void;
}) {
  const { t } = useTranslation();
  const [state, setState] = useState<'idle' | 'pending' | 'failed'>('idle');
  const [changedTo, setChangedTo] = useState<EventStatus | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const changed = changedTo === event.status;

  if (phase !== 'paused' && !changed) return null;

  const resume = () => {
    setState('pending');
    setChangedTo(null);
    api.resumeEvent(event.id).then(
      ({ event: resumed }) => {
        setState('idle');
        onChange(resumed);
        onResumed();
        window.setTimeout(() => heading.current?.focus(), 0);
      },
      (error: unknown) => {
        if (!(error instanceof ApiError && error.is('event_state_invalid'))) {
          setState('failed');

          return;
        }

        void api.event(event.id).then(
          (latest) => {
            setState('idle');
            setChangedTo(latest.status);
            onChange(latest);
            window.setTimeout(() => heading.current?.focus(), 0);
          },
          () => setState('failed'),
        );
      },
    );
  };

  return (
    <div className="notice notice-attention event-paused">
      <span className="mark mark-paused" aria-hidden="true" />
      <div className="notice-body">
        {changed ? (
          <div role="alert">
            {changedWords(event).map((line) => (
              <p key={line}>{t(line)}</p>
            ))}
          </div>
        ) : (
          <p>{t('eventPause.notice')}</p>
        )}
        {state === 'failed' && <p role="alert">{t('eventPause.resumeFailed')}</p>}
        {manages && eventAllows(phase, 'resume') && (
          <div className="notice-action">
            <button
              ref={button}
              type="button"
              className="button button-primary"
              {...offButton(state === 'pending', { dim: false })}
              aria-busy={state === 'pending'}
              onClick={resume}
            >
              {t('eventPause.resume')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
