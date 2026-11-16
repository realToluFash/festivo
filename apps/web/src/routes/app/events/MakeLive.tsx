import { ApiError, type OrganisationEvent, type TaggedEvent } from '@soirely/api-client';
import {
  type EventPhase,
  PHASE_LOOK,
  changedWords,
  makeLiveHostError,
  makeLiveRow,
  makeLiveWithHost,
  needsHost,
  rereadOf,
} from '@soirely/domain';
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { api } from '../../../api.ts';
import { focusWhenFree } from '../../../layers.ts';
import { MakeLiveDialog } from '../../../components/MakeLiveDialog.tsx';
import { AskAlert } from '../../../components/SettingsParts.tsx';
import { StatusChip } from '../../../components/StatusChip.tsx';
import { PHASE_WORD } from './eventWords.ts';
import { inPlace } from './openInPlace.ts';

/** A word and a shape of its own, never colour alone (WCAG 2.2 §1.4.1). */
export function StatusPill({ phase }: { phase: EventPhase }) {
  const { t } = useTranslation();

  return <StatusChip look={PHASE_LOOK[phase]}>{t(PHASE_WORD[phase])}</StatusChip>;
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

/** A refusal that ends the question: Close, and Change dates when the end has passed. */
interface Told {
  kind: 'told';
  title: string;
  line: string;
  changeDates: boolean;
}

/** Make live's question and its refusals, asked from whichever button `opener` holds (sc-3584, sc-22143). */
export function useMakeLive({
  event,
  tag,
  heading,
  opener,
  onChange,
  onMadeLive,
}: {
  event: OrganisationEvent;
  tag: string;
  heading: RefObject<HTMLHeadingElement | null>;
  opener: RefObject<HTMLButtonElement | null>;
  onChange: (event: OrganisationEvent, tag: string) => void;
  onMadeLive: () => void;
}): { start: () => void; dialogs: ReactNode } {
  const { t } = useTranslation();
  const [opened, setOpened] = useState<TaggedEvent>({ event, tag });
  const [asking, setAsking] = useState<Confirming | Told | null>(null);

  function close(): void {
    setAsking(null);
    window.setTimeout(() => (opener.current ?? heading.current)?.focus(), 0);
  }

  function changed(latest: TaggedEvent): void {
    setOpened(latest);
    onChange(latest.event, latest.tag);
  }

  function refused(title: string, line: string, changeDates = false): void {
    setAsking({ kind: 'told', title, line, changeDates });
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
      focusWhenFree(() => heading.current);
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
        refused(t(title), t(line));
      }
      return;
    }

    if (step.saved != null) changed(step.saved);

    const problem = step.error instanceof ApiError ? step.error : null;

    if (problem?.is('plan_limit') === true) {
      refused(
        t('eventLive.planLimit', {
          plan: problem.problem.plan ?? '',
          limit: problem.problem.limit ?? 0,
          count: problem.problem.limit ?? 0,
        }),
        t('eventLive.planLimitStays'),
      );
    } else if (problem?.is('event_concluded') === true) {
      await reread();
      refused(t('eventLive.notMadeLive'), t('eventLive.endPassed'), true);
    } else {
      setAsking({
        ...settled,
        ...(step.saved != null && { askHost: false, typed: '' }),
        failed: true,
      });
    }
  }

  function start(): void {
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
  }

  const dialogs = asking != null && (
    <MakeLiveAsking
      asking={asking}
      event={opened.event}
      onType={(typed) => asking.kind === 'confirm' && setAsking({ ...asking, typed, error: null })}
      onGo={() => asking.kind === 'confirm' && void go(asking)}
      onClose={close}
      onChangeDates={() => setAsking(null)}
    />
  );

  return { start, dialogs };
}

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
  onChange: (event: OrganisationEvent, tag: string) => void;
  onMadeLive: () => void;
}) {
  const { t } = useTranslation();
  const row = makeLiveRow(event, now, manages);
  const opener = useRef<HTMLButtonElement>(null);
  const makeLive = useMakeLive({ event, tag, heading, opener, onChange, onMadeLive });

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
                onClick={() => makeLive.start()}
              >
                {t('eventLive.makeLive')}
              </button>
            ) : (
              <Link className="button button-primary" {...inPlace(event.id, 'dates')}>
                {t('eventLive.changeDates')}
              </Link>
            ))}
        </div>
      )}
      {makeLive.dialogs}
    </>
  );
}

/** Make live's question and what it turns into, in the demo's dialog (sc-3584, sc-22143, sc-48603). */
function MakeLiveAsking({
  asking,
  event,
  onType,
  onGo,
  onClose,
  onChangeDates,
}: {
  asking: Confirming | Told;
  event: OrganisationEvent;
  onType: (typed: string) => void;
  onGo: () => void;
  onClose: () => void;
  onChangeDates: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const field = useRef<HTMLInputElement>(null);
  const hostsNow = useRef<HTMLDivElement>(null);
  const confirm = asking.kind === 'confirm' ? asking : null;
  const error = confirm?.error ?? null;
  const notice = confirm?.notice ?? null;

  useEffect(() => {
    if (error != null) field.current?.focus();
  }, [confirm, error]);

  useEffect(() => {
    if (notice === 'nowHosted') hostsNow.current?.focus();
    if (notice === 'stillNoHost') field.current?.focus();
  }, [notice]);

  if (confirm == null) {
    const told = asking as Told;

    return (
      <MakeLiveDialog
        title={told.title}
        line={told.line}
        told
        keep={t('eventLive.close')}
        go={told.changeDates ? t('eventLive.changeDates') : undefined}
        onKeep={onClose}
        onGo={() => {
          onChangeDates();
          const { to, state } = inPlace(event.id, 'dates');
          void navigate(to, { state });
        }}
      />
    );
  }

  const { askHost, typed, pending, failed } = confirm;

  return (
    <MakeLiveDialog
      title={t('eventLive.confirmTitle', { name: event.name })}
      line={`${t('eventLive.confirmGuests')} ${t('eventLive.confirmFinal')}`}
      host={
        askHost
          ? {
              label: t('eventHosts.label', { position: 1 }),
              value: typed,
              wrong: error,
              help: t('eventLive.hostExplainer'),
              onType,
            }
          : undefined
      }
      field={field}
      failed={failed ? t('eventLive.failed') : undefined}
      keep={t('eventLive.notYet')}
      go={t('eventLive.makeLive')}
      busy={pending ? t('eventLive.making') : undefined}
      onKeep={onClose}
      onGo={() => {
        if (!pending) onGo();
      }}
    >
      {notice === 'nowHosted' && (
        <div ref={hostsNow} className="event-live-hosts-now" role="group" tabIndex={-1}>
          <AskAlert>{t('eventLive.notSavedChanged')}</AskAlert>
          <p id="make-live-hosts-now">{t('eventLive.hostsNow')}</p>
          <ul aria-labelledby="make-live-hosts-now">
            {event.hosts.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      )}
      {notice === 'stillNoHost' && <AskAlert>{t('eventEdit.changedElsewhere')}</AskAlert>}
    </MakeLiveDialog>
  );
}
