import { formatWallDay } from '@soirely/domain';
import { useEffect, useId, useRef, useState } from 'react';

import { type EditState, type SampleEvent, EVENT_WORDS as W, localDay } from './events.ts';
import { Opened } from '../components/EventPageParts.tsx';
import { dayOf, wordsFor } from './guest.ts';
import {
  REPLY_BY_WORDS as R,
  type ReplyByCheck,
  haventRepliedOf,
  replyByCheck,
  showsPreview,
  haventCountOf,
} from './replyBy.ts';
import { Glyph } from '../components/Glyph.tsx';
import { Ask, TextAction } from '../components/SettingsParts.tsx';

const GUEST_WORDS = wordsFor('en');
const LOCALE = 'en-US';

/** What each state has typed into the field, over the event's own date. */
function typedFor(state: EditState | null, was: string | null): string {
  switch (state) {
    case 'replyByError':
      return '2026-11-05';
    case 'replyBySooner':
      return '2026-11-03';
    case 'replyByNow':
      return '2026-11-02';
    default:
      return was ?? '';
  }
}

function askedFor(state: EditState | null): ReplyByCheck | null {
  if (state === 'replyBySooner') return 'sooner';
  if (state === 'replyByNow') return 'now';

  return null;
}

/** Reply by (sc-3780): the date guests answer by, in the event's zone; closing sooner or now asks first, never in red. */
export function ReplyByPart({
  event,
  state,
  replyBy,
  now,
  onDirty,
  onClose,
  onSave,
}: {
  event: SampleEvent;
  state: EditState | null;
  replyBy: string | null;
  now: Date;
  onDirty: (dirty: boolean) => void;
  onClose: () => void;
  onSave: (next: string | null) => void;
}) {
  const [typed, setTyped] = useState(() => typedFor(state, replyBy));
  const [tried, setTried] = useState(state === 'replyByError');
  const [asking, setAsking] = useState<ReplyByCheck | null>(askedFor(state));
  const [askedFirst] = useState(asking != null);
  const field = useRef<HTMLInputElement>(null);
  const id = useId();
  const next = typed === '' ? null : typed;
  const check = replyByCheck({
    next,
    was: replyBy,
    startsAt: event.startsAt,
    now,
    timeZone: event.timeZone,
    noReply: haventCountOf(event.id),
  });
  const wrong = tried && check === 'tooLate';
  const changed = next !== replyBy;
  const told = [`${id}-hint`, wrong ? `${id}-error` : null].filter(Boolean).join(' ');

  useEffect(() => onDirty(changed), [changed, onDirty]);
  useEffect(() => {
    if (!askedFirst) field.current?.focus();
  }, [askedFirst]);

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
    onSave(next);
  }

  return (
    <Opened label={R.replyBy} changed={changed} onCancel={onClose} onSave={save}>
      <div className="desk-field">
        <label htmlFor={id} className="desk-label">
          {R.replyBy}
          <span className="ev-optional">{` · ${W.optional}`}</span>
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
          }}
        />
        {wrong && (
          <p id={`${id}-error`} className="desk-error" role="alert">
            <Glyph name="alert" size={15} weight={2.2} />
            {R.tooLate}
          </p>
        )}
        <p id={`${id}-hint`} className="desk-help">
          {R.hint(event.timeZone)}
        </p>
        {next != null && (
          <TextAction
            label={R.remove}
            onClick={() => {
              setTyped('');
              setTried(false);
              field.current?.focus();
            }}
          />
        )}
      </div>
      {next != null && showsPreview(next, check, localDay(now.toISOString(), event.timeZone)) && (
        <p className="ev-reply-preview">{R.preview(GUEST_WORDS.replyBy(dayOf(next, 'en')))}</p>
      )}
      {asking != null && next != null && (
        <Ask
          title={asking === 'sooner' ? R.soonerTitle(formatWallDay(next, LOCALE)) : R.nowTitle}
          line={haventRepliedOf(event.id)}
          keep={replyBy == null ? W.cancel : R.keep(formatWallDay(replyBy, LOCALE))}
          go={asking === 'sooner' ? R.sooner : R.now}
          red={false}
          onKeep={() => setAsking(null)}
          onGo={() => {
            setAsking(null);
            onSave(next);
          }}
        >
          <p>{asking === 'sooner' ? R.soonerLine : R.nowLine}</p>
        </Ask>
      )}
    </Opened>
  );
}
