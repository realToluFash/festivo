import { ApiError, type OrganisationEvent, type TaggedEvent } from '@soirely/api-client';
import { formatWallDay, wallDay } from '@soirely/domain';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { Broken, Opened } from '../../../components/EventPageParts.tsx';
import { Glyph } from '../../../components/Glyph.tsx';
import { Ask, TextAction } from '../../../components/SettingsParts.tsx';
import { dateLocale } from '../../../i18n/index.ts';
import { type ReplyByCheck, closesAtClock, replyByCheck, showsPreview } from '../../../replyBy.ts';
import { type Havent, replyBySaid, useHavent } from './replyByHavent.ts';

/** Close replies sooner or now: never red, since nothing is thrown away. */
export function ReplyByAsk({
  asking,
  next,
  havent,
  keep,
  onKeep,
  onGo,
}: {
  asking: 'sooner' | 'now';
  next: string;
  havent: Havent | null;
  keep: string;
  onKeep: () => void;
  onGo: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Ask
      title={
        asking === 'sooner'
          ? t('eventReplyBy.soonerTitle', { date: formatWallDay(next, dateLocale()) })
          : t('eventReplyBy.nowTitle')
      }
      line={havent?.line}
      keep={keep}
      go={asking === 'sooner' ? t('eventReplyBy.sooner') : t('eventReplyBy.now')}
      red={false}
      onKeep={onKeep}
      onGo={onGo}
    >
      <p>{asking === 'sooner' ? t('eventReplyBy.soonerLine') : t('eventReplyBy.nowLine')}</p>
    </Ask>
  );
}

/** Reply by (sc-3780): the day guests answer by, in the event's zone; closing sooner or now asks first. */
export function ReplyByPart({
  event,
  tag,
  now,
  onDirty,
  onClose,
  onSaved,
  onLatest,
}: {
  event: OrganisationEvent;
  tag: string;
  now: Date;
  onDirty: (dirty: boolean) => void;
  onClose: () => void;
  onSaved: (saved: TaggedEvent, said: string) => void;
  onLatest: (latest: TaggedEvent) => void;
}) {
  const { t } = useTranslation();
  const havent = useHavent(event);
  const was = event.replyBy ?? null;
  const [typed, setTyped] = useState(was ?? '');
  const [tried, setTried] = useState(false);
  const [refusedHere, setRefusedHere] = useState(false);
  const [asking, setAsking] = useState<ReplyByCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<'changed' | 'failed' | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const id = useId();
  const next = typed === '' ? null : typed;
  const check = replyByCheck({
    next,
    was,
    startsAt: event.startsAt,
    now,
    timeZone: event.timeZone,
    noReply: havent?.count ?? 1,
  });
  const wrong = (tried && check === 'tooLate') || refusedHere;
  const changed = next !== was;
  const told = [`${id}-hint`, wrong ? `${id}-error` : null].filter(Boolean).join(' ');
  const locale = dateLocale();

  useEffect(() => onDirty(changed), [changed, onDirty]);
  useEffect(() => field.current?.focus(), []);

  async function send(): Promise<void> {
    setBusy(true);
    try {
      const saved = await api.updateEvent(event.id, { replyBy: next }, tag);
      setBusy(false);
      onSaved(saved, replyBySaid(next, now, event.timeZone, t));
    } catch (error) {
      setBusy(false);
      if (error instanceof ApiError && error.status === 412) return setOutcome('changed');
      if (
        error instanceof ApiError &&
        error.status === 422 &&
        error.fieldErrors().replyBy != null
      ) {
        setOutcome(null);
        setRefusedHere(true);
        field.current?.focus();
        return;
      }
      setOutcome('failed');
    }
  }

  function save(): void {
    setTried(true);
    if (check === 'tooLate') {
      field.current?.focus();
      return;
    }
    if (check === 'sooner' || check === 'now') {
      setAsking(check);
      return;
    }
    void send();
  }

  return (
    <Opened
      label={t('eventReplyBy.replyBy')}
      changed={changed}
      refused={outcome === 'changed'}
      busy={busy}
      onLatest={() => {
        void api.taggedEvent(event.id).then(
          (latest) => {
            setOutcome(null);
            onLatest(latest);
          },
          () => setOutcome('failed'),
        );
      }}
      onCancel={onClose}
      onSave={save}
    >
      {outcome === 'failed' && <Broken>{t('eventEdit.notSaved')}</Broken>}
      <div className="desk-field">
        <label htmlFor={id} className="desk-label">
          {t('eventReplyBy.replyBy')}
          <span className="ev-optional">{` · ${t('eventForm.optional')}`}</span>
        </label>
        <input
          ref={field}
          id={id}
          type="date"
          className={wrong ? 'ev-input is-wrong' : 'ev-input'}
          value={typed}
          aria-invalid={wrong}
          aria-describedby={told}
          onChange={(change) => {
            setTyped(change.target.value);
            setTried(false);
            setRefusedHere(false);
          }}
        />
        {wrong && (
          <p id={`${id}-error`} className="desk-error" role="alert">
            <Glyph name="alert" size={15} weight={2.2} />
            {t('eventReplyBy.tooLate')}
          </p>
        )}
        <p id={`${id}-hint`} className="desk-help">
          {t('eventReplyBy.hint', { time: closesAtClock(locale), zone: event.timeZone })}
        </p>
        {next != null && (
          <TextAction
            label={t('eventReplyBy.remove')}
            onClick={() => {
              setTyped('');
              setTried(false);
              setRefusedHere(false);
              field.current?.focus();
            }}
          />
        )}
      </div>
      {next != null && showsPreview(next, check, wallDay(now, event.timeZone)) && (
        <p className="ev-reply-preview">
          {t('eventReplyBy.preview', {
            sentence: t('guest.replyBy', {
              date: new Intl.DateTimeFormat(locale, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC',
              }).format(new Date(`${next}T12:00:00Z`)),
            }),
          })}
        </p>
      )}
      {(asking === 'sooner' || asking === 'now') && next != null && (
        <ReplyByAsk
          asking={asking}
          next={next}
          havent={havent}
          keep={
            was == null
              ? t('eventEdit.cancel')
              : t('eventReplyBy.keep', { date: formatWallDay(was, locale) })
          }
          onKeep={() => setAsking(null)}
          onGo={() => {
            setAsking(null);
            void send();
          }}
        />
      )}
    </Opened>
  );
}
