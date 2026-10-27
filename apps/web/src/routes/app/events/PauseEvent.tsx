import { ApiError, type EventStatus, type OrganisationEvent } from '@soirely/api-client';
import { type EventPhase, eventAllows } from '@soirely/domain';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { useDialogKeys } from '../../../dialogFocus.ts';
import { offButton } from '../../../offButton.ts';
import { NOW_STATE } from './eventWords.ts';

type Asking =
  { kind: 'confirm'; pending: boolean; failed: boolean } | { kind: 'changed'; status: EventStatus };

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
  const [asking, setAsking] = useState<Asking | null>(null);
  const opener = useRef<HTMLButtonElement>(null);

  const close = () => {
    setAsking(null);
    window.setTimeout(() => (opener.current ?? heading.current)?.focus(), 0);
  };

  const go = () => {
    setAsking({ kind: 'confirm', pending: true, failed: false });
    api.pauseEvent(event.id).then(
      ({ event: paused }) => {
        setAsking(null);
        onChange(paused);
        onPaused();
        window.setTimeout(() => heading.current?.focus(), 0);
      },
      (error: unknown) => {
        if (!(error instanceof ApiError && error.is('event_state_invalid'))) {
          setAsking({ kind: 'confirm', pending: false, failed: true });

          return;
        }

        void api.event(event.id).then(
          (latest) => {
            onChange(latest);
            setAsking({ kind: 'changed', status: latest.status });
          },
          () => setAsking({ kind: 'confirm', pending: false, failed: true }),
        );
      },
    );
  };

  return (
    <>
      {eventAllows(phase, 'pause') && (
        <button
          ref={opener}
          type="button"
          className="button"
          onClick={() => setAsking({ kind: 'confirm', pending: false, failed: false })}
        >
          {t('eventPause.pause')}
        </button>
      )}
      {asking != null && (
        <PauseDialog name={event.name} asking={asking} onGo={go} onClose={close} />
      )}
    </>
  );
}

function PauseDialog({
  name,
  asking,
  onGo,
  onClose,
}: {
  name: string;
  asking: Asking;
  onGo: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const pending = asking.kind === 'confirm' && asking.pending;

  useEffect(() => first.current?.focus(), [asking.kind]);
  useDialogKeys(dialog, onClose, pending);

  const [title, lines] =
    asking.kind === 'confirm'
      ? [
          t('eventPause.title', { name }),
          [
            t('eventPause.body'),
            t('eventPause.nothingLost'),
            ...(asking.failed ? [t('eventPause.failed')] : []),
          ],
        ]
      : [t('eventLive.changedElsewhere'), [t(NOW_STATE[asking.status])]];

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={dialog}
        className="dialog event-live-dialog"
        role={asking.kind === 'confirm' ? 'dialog' : 'alertdialog'}
        aria-modal="true"
        aria-labelledby="pause-event-title"
        aria-describedby="pause-event-body"
      >
        <div className="dialog-heading">
          <h2 id="pause-event-title">{title}</h2>
          <div id="pause-event-body">
            {lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
        <div className="dialog-actions">
          {asking.kind === 'confirm' ? (
            <>
              <button
                ref={first}
                type="button"
                className="button"
                {...offButton(pending, { dim: false })}
                onClick={onClose}
              >
                {t('eventPause.keepItLive')}
              </button>
              <button
                type="button"
                className="button button-primary"
                {...offButton(pending, { dim: false })}
                aria-busy={pending}
                onClick={onGo}
              >
                {t('eventPause.pause')}
              </button>
            </>
          ) : (
            <button ref={first} type="button" className="button button-primary" onClick={onClose}>
              {t('eventLive.close')}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/** `Event View` (tweak: Paused): the amber line and the page's primary Resume, which asks nothing; past the end the phase is Finished and neither shows. */
export function PausedRow({
  event,
  phase,
  manages,
  onChange,
  onResumed,
}: {
  event: OrganisationEvent;
  phase: EventPhase;
  manages: boolean;
  onChange: (event: OrganisationEvent) => void;
  onResumed: () => void;
}) {
  const { t } = useTranslation();
  const [state, setState] = useState<'idle' | 'pending' | 'failed'>('idle');

  if (phase !== 'paused') return null;

  const resume = () => {
    setState('pending');
    api.resumeEvent(event.id).then(
      ({ event: resumed }) => {
        setState('idle');
        onChange(resumed);
        onResumed();
      },
      (error: unknown) => {
        if (!(error instanceof ApiError && error.is('event_state_invalid'))) {
          setState('failed');

          return;
        }

        void api.event(event.id).then(
          (latest) => {
            setState('idle');
            onChange(latest);
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
        <p>{t('eventPause.notice')}</p>
        {state === 'failed' && <p role="alert">{t('eventPause.resumeFailed')}</p>}
        {manages && eventAllows(phase, 'resume') && (
          <div className="notice-action">
            <button
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
