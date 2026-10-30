import { ApiError, type OrganisationEvent, type TaggedEvent } from '@soirely/api-client';
import {
  type EventPhase,
  changedWords,
  makeLiveHostError,
  makeLiveRow,
  makeLiveWithHost,
  needsHost,
  rereadOf,
} from '@soirely/domain';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { api } from '../../../api.ts';
import { useDialogKeys } from '../../../dialogFocus.ts';
import { offButton } from '../../../offButton.ts';
import { FieldError } from './EventFields.tsx';
import { describedBy } from './eventFieldOrder.ts';
import { PHASE_WORD } from './eventWords.ts';
import { LifecycleDialog } from './LifecycleDialog.tsx';
import { type Refused } from './useLifecycleAction.ts';

/** A word and a shape of its own, never colour alone (WCAG 2.2 §1.4.1). */
export function StatusPill({ phase }: { phase: EventPhase }) {
  const { t } = useTranslation();

  return (
    <span className={`pill-quiet pill-phase pill-${phase.replace('_', '-')}`}>
      {t(PHASE_WORD[phase])}
    </span>
  );
}

/** `askHost` while the draft had no host when it opened; `notice` is what a reread after a 412 found (sc-22143). */
interface Confirming {
  kind: 'confirm';
  askHost: boolean;
  typed: string;
  error: string | null;
  notice: 'stillNoHost' | 'nowHosted' | null;
  pending: boolean;
  failed: boolean;
}

type Focus = 'host' | 'hostsNow' | 'go';

const HOST_ID = 'make-live-host';

/** A Draft's line for the areas it blocks (Guests so far), with Make live beside it, as `/event-states.json` says. */
export function DraftRow({
  event,
  tag,
  now,
  manages,
  heading,
  onChange,
  onMadeLive,
}: {
  event: OrganisationEvent;
  tag: string;
  now: Date;
  manages: boolean;
  heading: RefObject<HTMLHeadingElement | null>;
  onChange: (event: OrganisationEvent, tag?: string) => void;
  onMadeLive: () => void;
}) {
  const { t } = useTranslation();
  const row = makeLiveRow(event, now);
  const [opened, setOpened] = useState<TaggedEvent>({ event, tag });
  const [asking, setAsking] = useState<Confirming | Refused | null>(null);
  const opener = useRef<HTMLButtonElement>(null);

  function close(): void {
    setAsking(null);
    window.setTimeout(() => (opener.current ?? heading.current)?.focus(), 0);
  }

  function changed(latest: TaggedEvent): void {
    setOpened(latest);
    onChange(latest.event, latest.tag);
  }

  function refused(refusal: Omit<Refused, 'kind'>): void {
    setAsking({ kind: 'refused', ...refusal });
  }

  async function reread(): Promise<TaggedEvent | null> {
    try {
      const latest = await api.taggedEvent(event.id);
      changed(latest);

      return latest;
    } catch {
      return null;
    }
  }

  async function go(current: Confirming): Promise<void> {
    const error =
      current.askHost && needsHost(opened.event) ? makeLiveHostError(current.typed, t) : null;

    if (error != null) {
      setAsking({ ...current, error, failed: false });
      return;
    }

    setAsking({ ...current, error: null, pending: true, failed: false });
    const step = await makeLiveWithHost(api, opened, current.typed);
    const settled = { ...current, error: null, pending: false };

    if (step.kind === 'live') {
      setAsking(null);
      changed(step.tagged);
      onMadeLive();
      window.setTimeout(() => heading.current?.focus(), 0);
      return;
    }

    if (step.kind === 'hostRefused') {
      setAsking({ ...settled, error: step.message });
      return;
    }

    if (step.kind === 'stale') {
      const latest = await reread();
      const found = latest == null ? null : rereadOf(latest.event);

      if (latest == null) {
        setAsking({ ...settled, failed: true });
      } else if (found === 'noHost') {
        setAsking({ ...settled, askHost: true, notice: 'stillNoHost' });
      } else if (found === 'hosted') {
        setAsking({ ...settled, askHost: false, typed: '', notice: 'nowHosted' });
      } else {
        const [title, line] = changedWords(latest.event);
        refused({ title: t(title), lines: [t(line)] });
      }
      return;
    }

    if (step.saved != null) changed(step.saved);

    const problem = step.error instanceof ApiError ? step.error : null;

    if (problem?.is('plan_limit') === true) {
      refused({
        title: t('eventLive.planLimit', {
          plan: problem.problem.plan ?? '',
          limit: problem.problem.limit ?? 0,
          count: problem.problem.limit ?? 0,
        }),
        lines: [t('eventLive.planLimitStays')],
      });
    } else if (problem?.is('event_concluded') === true) {
      await reread();
      refused({ title: t('eventLive.notMadeLive'), lines: [t('eventLive.endPassed')] });
    } else {
      setAsking({ ...settled, failed: true });
    }
  }

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
                onClick={() => {
                  setOpened({ event, tag });
                  setAsking({
                    kind: 'confirm',
                    askHost: needsHost(event),
                    typed: '',
                    error: null,
                    notice: null,
                    pending: false,
                    failed: false,
                  });
                }}
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
      {asking?.kind === 'refused' && (
        <LifecycleDialog
          id="make-live"
          asking={asking}
          title=""
          lines={[]}
          failed=""
          keep=""
          confirm=""
          tone="primary"
          onGo={() => undefined}
          onClose={close}
        />
      )}
      {asking?.kind === 'confirm' && (
        <MakeLiveDialog
          asking={asking}
          event={opened.event}
          onType={(typed) => setAsking({ ...asking, typed, error: null })}
          onGo={() => void go(asking)}
          onClose={close}
        />
      )}
    </>
  );
}

/** Make live's confirmation (sc-3584); on a draft with no host it asks for one in Host 1 (sc-22143). */
function MakeLiveDialog({
  asking,
  event,
  onType,
  onGo,
  onClose,
}: {
  asking: Confirming;
  event: OrganisationEvent;
  onType: (typed: string) => void;
  onGo: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDivElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const host = useRef<HTMLTextAreaElement>(null);
  const hostsNow = useRef<HTMLDivElement>(null);
  const go = useRef<HTMLButtonElement>(null);
  const { askHost, typed, error, notice, pending, failed } = asking;
  const focus: Focus | null = pending
    ? null
    : notice === 'nowHosted'
      ? 'hostsNow'
      : failed
        ? 'go'
        : askHost
          ? 'host'
          : null;

  useDialogKeys(dialog, onClose, pending);

  useEffect(() => keep.current?.focus(), []);

  useEffect(() => {
    const target =
      focus === 'host' ? host.current : focus === 'hostsNow' ? hostsNow.current : go.current;
    if (focus != null) target?.focus();
  }, [focus, error, notice, failed]);

  return (
    <>
      <div className="dialog-scrim" aria-hidden="true" />
      <div
        ref={dialog}
        className="dialog event-live-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="make-live-title"
        aria-describedby="make-live-body"
      >
        <div className="dialog-heading">
          <h2 id="make-live-title">{t('eventLive.confirmTitle', { name: event.name })}</h2>
          <div id="make-live-body">
            <p>{t('eventLive.confirmGuests')}</p>
            <p>{t('eventLive.confirmFinal')}</p>
          </div>
        </div>

        {notice === 'nowHosted' && (
          <div ref={hostsNow} className="event-live-hosts-now" role="group" tabIndex={-1}>
            <p className="notice-title">{t('eventLive.notSavedChanged')}</p>
            <p id="make-live-hosts-now">{t('eventLive.hostsNow')}</p>
            <ul aria-labelledby="make-live-hosts-now">
              {event.hosts.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
        )}

        {askHost && (
          <div className="field">
            {notice === 'stillNoHost' && (
              <div className="notice notice-broken" role="alert">
                <span className="mark mark-broken" aria-hidden="true">
                  ✕
                </span>
                <p className="notice-title">{t('eventEdit.changedElsewhere')}</p>
              </div>
            )}
            <label htmlFor={HOST_ID}>{t('eventHosts.label', { position: 1 })}</label>
            <textarea
              ref={host}
              id={HOST_ID}
              className={
                error == null ? 'input event-host-name' : 'input event-host-name input-wrong'
              }
              rows={1}
              value={typed}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="go"
              readOnly={pending}
              aria-invalid={error != null}
              aria-describedby={describedBy(
                error == null ? null : `${HOST_ID}-error`,
                `${HOST_ID}-help`,
              )}
              onChange={(change) => onType(change.target.value.replace(/[\r\n]+/g, ' '))}
              onKeyDown={(key) => {
                if (key.key !== 'Enter' || key.nativeEvent.isComposing) return;

                key.preventDefault();
                if (!pending) onGo();
              }}
            />
            <FieldError id={`${HOST_ID}-error`} message={error ?? undefined} />
            <p className="field-help" id={`${HOST_ID}-help`}>
              {t('eventLive.hostExplainer')}
            </p>
          </div>
        )}

        {failed && (
          <div className="notice notice-broken" role="alert">
            <span className="mark mark-broken" aria-hidden="true">
              ✕
            </span>
            <p className="notice-title">{t('eventLive.failed')}</p>
          </div>
        )}

        <div className="dialog-actions">
          <button
            ref={keep}
            type="button"
            className="button"
            {...offButton(pending, { dim: false })}
            onClick={onClose}
          >
            {t('eventLive.notYet')}
          </button>
          <button
            ref={go}
            type="button"
            className="button button-primary"
            {...offButton(pending, { dim: false })}
            aria-busy={pending}
            onClick={onGo}
          >
            {t('eventLive.makeLive')}
          </button>
        </div>
      </div>
    </>
  );
}
