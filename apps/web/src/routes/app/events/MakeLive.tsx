import { ApiError, type EventStatus, type OrganisationEvent } from '@soirely/api-client';
import { type EventPhase, makeLiveRow, needsHost } from '@soirely/domain';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';
import { useDialogKeys } from '../../../dialogFocus.ts';
import { offButton } from '../../../offButton.ts';
import { NOW_STATE, PHASE_WORD } from './eventWords.ts';

/** A word and a shape of its own, never colour alone (WCAG 2.2 §1.4.1). */
export function StatusPill({ phase }: { phase: EventPhase }) {
  const { t } = useTranslation();

  return (
    <span className={`pill-quiet pill-phase pill-${phase.replace('_', '-')}`}>
      {t(PHASE_WORD[phase])}
    </span>
  );
}

type Asking =
  | { kind: 'confirm'; pending: boolean; failed: boolean }
  | { kind: 'changed'; status: EventStatus }
  | { kind: 'concluded' }
  | { kind: 'needsHost' }
  | { kind: 'planLimit'; plan: string; limit: number };

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
  const [asking, setAsking] = useState<Asking | null>(null);
  const makeLive = useRef<HTMLButtonElement>(null);
  const row = makeLiveRow(event, now);

  const close = () => {
    setAsking(null);
    window.setTimeout(() => (makeLive.current ?? heading.current)?.focus(), 0);
  };

  const reload = (then: (latest: OrganisationEvent) => Asking) =>
    api.event(event.id).then(
      (latest) => {
        onChange(latest);
        setAsking(then(latest));
      },
      () => setAsking({ kind: 'confirm', pending: false, failed: true }),
    );

  const go = () => {
    setAsking({ kind: 'confirm', pending: true, failed: false });
    api.makeLive(event.id).then(
      ({ event: live }) => {
        setAsking(null);
        onChange(live);
        onMadeLive();
        window.setTimeout(() => heading.current?.focus(), 0);
      },
      (error: unknown) => {
        if (error instanceof ApiError && error.is('event_state_invalid')) {
          void reload((latest) => ({ kind: 'changed', status: latest.status }));
        } else if (error instanceof ApiError && error.is('event_host_required')) {
          void reload(() => ({ kind: 'needsHost' }));
        } else if (error instanceof ApiError && error.is('event_concluded')) {
          void reload(() => ({ kind: 'concluded' }));
        } else if (error instanceof ApiError && error.is('plan_limit')) {
          setAsking({
            kind: 'planLimit',
            plan: error.problem.plan ?? '',
            limit: error.problem.limit ?? 0,
          });
        } else {
          setAsking({ kind: 'confirm', pending: false, failed: true });
        }
      },
    );
  };

  return (
    <>
      {row != null && (
        <div className="event-draft-row">
          <span className="mark mark-off" aria-hidden="true" />
          <p className="event-draft-line">{t(`eventLive.${row.line}`)}</p>
          {manages &&
            (row.makeLive ? (
              <button
                ref={makeLive}
                type="button"
                className="button button-primary"
                onClick={() =>
                  setAsking(
                    needsHost(event)
                      ? { kind: 'needsHost' }
                      : { kind: 'confirm', pending: false, failed: false },
                  )
                }
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
        <MakeLiveDialog
          name={event.name}
          eventId={event.id}
          asking={asking}
          onGo={go}
          onClose={close}
        />
      )}
    </>
  );
}

/** The phone's bottom sheet on narrow screens; the first line wraps rather than truncates. */
function MakeLiveDialog({
  name,
  eventId,
  asking,
  onGo,
  onClose,
}: {
  name: string;
  eventId: string;
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
          t('eventLive.confirmTitle', { name }),
          [
            t('eventLive.confirmGuests'),
            t('eventLive.confirmFinal'),
            ...(asking.failed ? [t('eventLive.failed')] : []),
          ],
        ]
      : asking.kind === 'changed'
        ? [t('eventLive.changedElsewhere'), [t(NOW_STATE[asking.status])]]
        : asking.kind === 'concluded'
          ? [t('eventLive.notMadeLive'), [t('eventLive.endPassed')]]
          : asking.kind === 'needsHost'
            ? [t('eventLive.needsHostTitle'), [t('eventLive.needsHostBody')]]
            : [
                t('eventLive.planLimit', {
                  plan: asking.plan,
                  limit: asking.limit,
                  count: asking.limit,
                }),
                [t('eventLive.planLimitStays')],
              ];

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={dialog}
        className="dialog event-live-dialog"
        role={asking.kind === 'confirm' ? 'dialog' : 'alertdialog'}
        aria-modal="true"
        aria-labelledby="make-live-title"
        aria-describedby="make-live-body"
      >
        <div className="dialog-heading">
          <h2 id="make-live-title">{title}</h2>
          <div id="make-live-body">
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
                {t('eventLive.notYet')}
              </button>
              <button
                type="button"
                className="button button-primary"
                {...offButton(pending, { dim: false })}
                aria-busy={pending}
                onClick={onGo}
              >
                {t('eventLive.makeLive')}
              </button>
            </>
          ) : asking.kind === 'needsHost' ? (
            <>
              <button ref={first} type="button" className="button" onClick={onClose}>
                {t('eventLive.close')}
              </button>
              <Link
                className="button button-primary"
                to={`/app/events/${encodeURIComponent(eventId)}/edit#hosts`}
              >
                {t('eventLive.addHosts')}
              </Link>
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
