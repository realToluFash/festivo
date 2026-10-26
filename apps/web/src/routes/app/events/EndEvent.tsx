import { ApiError, type EventStatus, type OrganisationEvent } from '@soirely/api-client';
import { type EventPhase, calledOff, endLabel, formatEventDate } from '@soirely/domain';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { useDialogKeys } from '../../../dialogFocus.ts';
import { dateLocale } from '../../../i18n/index.ts';
import { offButton } from '../../../offButton.ts';
import { NOW_STATE } from './eventWords.ts';

type Label = 'callOff' | 'endNow';

type Asking =
  | { kind: 'confirm'; label: Label; pending: boolean; failed: boolean }
  | { kind: 'changed'; status: EventStatus }
  | { kind: 'concluded' };

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
  const [asking, setAsking] = useState<Asking | null>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const label = endLabel(event, phase, now);

  const close = () => {
    setAsking(null);
    window.setTimeout(() => (opener.current ?? heading.current)?.focus(), 0);
  };

  const reload = (then: (latest: OrganisationEvent) => Asking) =>
    api.event(event.id).then(
      (latest) => {
        onChange(latest);
        setAsking(then(latest));
      },
      () =>
        setAsking((was) =>
          was?.kind === 'confirm' ? { ...was, pending: false, failed: true } : was,
        ),
    );

  const go = (chosen: Label) => {
    setAsking({ kind: 'confirm', label: chosen, pending: true, failed: false });
    api.endEvent(event.id).then(
      ({ event: ended }) => {
        setAsking(null);
        onChange(ended);
        onEnded();
        window.setTimeout(() => heading.current?.focus(), 0);
      },
      (error: unknown) => {
        if (error instanceof ApiError && error.is('event_state_invalid')) {
          void reload((latest) => ({ kind: 'changed', status: latest.status }));
        } else if (error instanceof ApiError && error.is('event_concluded')) {
          void reload(() => ({ kind: 'concluded' }));
        } else {
          setAsking({ kind: 'confirm', label: chosen, pending: false, failed: true });
        }
      },
    );
  };

  return (
    <>
      {label != null && (
        <button
          ref={opener}
          type="button"
          className="button"
          onClick={() => setAsking({ kind: 'confirm', label, pending: false, failed: false })}
        >
          {t(`eventEnd.${label}`)}
        </button>
      )}
      {asking != null && <EndDialog name={event.name} asking={asking} onGo={go} onClose={close} />}
    </>
  );
}

function EndDialog({
  name,
  asking,
  onGo,
  onClose,
}: {
  name: string;
  asking: Asking;
  onGo: (label: Label) => void;
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
          t(asking.label === 'callOff' ? 'eventEnd.callOffTitle' : 'eventEnd.endTitle', {
            name,
          }),
          [
            t(asking.label === 'callOff' ? 'eventEnd.callOffBody' : 'eventEnd.endBody'),
            t('eventEnd.final'),
            ...(asking.failed ? [t('eventEnd.failed')] : []),
          ],
        ]
      : asking.kind === 'changed'
        ? [t('eventLive.changedElsewhere'), [t(NOW_STATE[asking.status])]]
        : [t('eventEnd.notEnded'), [t('eventEnd.alreadyOver')]];

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={dialog}
        className="dialog event-live-dialog"
        role={asking.kind === 'confirm' ? 'dialog' : 'alertdialog'}
        aria-modal="true"
        aria-labelledby="end-event-title"
        aria-describedby="end-event-body"
      >
        <div className="dialog-heading">
          <h2 id="end-event-title">{title}</h2>
          <div id="end-event-body">
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
                {t('eventEnd.keepItOn')}
              </button>
              <button
                type="button"
                className="button button-danger"
                {...offButton(pending, { dim: false })}
                aria-busy={pending}
                onClick={() => onGo(asking.label)}
              >
                {t(`eventEnd.${asking.label}`)}
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
