import { hostsLine } from '@soirely/domain';
import { type RefObject, useEffect, useId, useRef, useState } from 'react';

import { Alert, Opened } from '../components/EventPageParts.tsx';
import { Glyph } from '../components/Glyph.tsx';
import { Ask, Head } from '../components/SettingsParts.tsx';
import { type SampleEvent, EVENT_WORDS as W } from './events.ts';
import {
  type Card,
  type EndField,
  THANK_YOU_MS,
  TY_WORDS,
  cleanThankYou,
  closed,
  opened,
  pressedSave,
  settled,
  thankYouCount,
  thankYouOver,
  thankYouTooLong,
  typed,
} from './thankYou.ts';
import './arrivalNote.css';
import './thankYou.css';

const LOCALE = 'en-US';

/** The field in the card and in End now: the count sits in its description and is not read out as you type. */
function ThankYouField({
  id,
  label,
  optional,
  help,
  value,
  tried,
  box,
  onChange,
}: {
  id: string;
  label: 'shown' | 'unseen';
  optional: boolean;
  help: string;
  value: string;
  tried: boolean;
  box: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
}) {
  const over = thankYouOver(value);

  return (
    <div className="desk-field">
      <label htmlFor={id} className={label === 'shown' ? 'desk-label' : 'desk-unseen'}>
        {TY_WORDS.title}
        {optional && <span className="ev-optional">{` · ${W.optional}`}</span>}
      </label>
      <div className={tried ? 'desk-box ev-note-box is-wrong' : 'desk-box ev-note-box'}>
        <textarea
          ref={box}
          id={id}
          rows={4}
          dir="auto"
          value={value}
          placeholder={TY_WORDS.placeholder}
          aria-invalid={tried}
          aria-describedby={[tried ? `${id}-error` : null, `${id}-help`, `${id}-count`]
            .filter(Boolean)
            .join(' ')}
          onChange={(change) => onChange(change.target.value)}
        />
      </div>
      {tried && (
        <p id={`${id}-error`} className="desk-error">
          <Glyph name="alert" size={15} weight={2.2} />
          {thankYouTooLong(LOCALE)}
        </p>
      )}
      <div className="ty-under">
        <p id={`${id}-help`} className="desk-help">
          {help}
        </p>
        <p
          id={`${id}-count`}
          className={over ? 'desk-help ty-count is-over' : 'desk-help ty-count'}
        >
          {thankYouCount(value, LOCALE)}
        </p>
      </div>
    </div>
  );
}

/** The hosts' line as every guest reads it: plain text, signed with the event's hosts, never the member who wrote it. */
function Line({ event, line }: { event: SampleEvent; line: string }) {
  return (
    <figure className="ty-line">
      <blockquote dir="auto">{line}</blockquote>
      <figcaption>{hostsLine(event.hosts, LOCALE)}</figcaption>
    </figure>
  );
}

/** sc-6476: first on a Finished event's Overview. Add, then the line with Edit; read-only without the permission to end it. */
export function ThankYouCard({
  event,
  card,
  onCard,
  onSaid,
}: {
  event: SampleEvent;
  card: Card;
  onCard: (next: Card) => void;
  onSaid: (words: string) => void;
}) {
  const id = useId();
  const box = useRef<HTMLTextAreaElement>(null);
  const action = useRef<HTMLButtonElement>(null);
  const [moved, setMoved] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!moved) return;
    if (card.open) box.current?.focus();
    else action.current?.focus();
  }, [card.open, moved]);

  useEffect(
    () => () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    },
    [],
  );

  function save(): void {
    const next = pressedSave(card);

    onCard(next);
    if (next.tried) box.current?.focus();
    if (!next.busy || card.busy) return;
    timer.current = window.setTimeout(() => {
      const answer = settled(next);

      onCard(answer.card);
      setMoved(true);
      if (answer.said === 'saved') onSaid(TY_WORDS.saved);
      if (answer.said === 'removed') onSaid(TY_WORDS.removed);
    }, THANK_YOU_MS);
  }

  return (
    <section className="desk-block ty" aria-labelledby={`${id}-title`}>
      <Head title={<span id={`${id}-title`}>{TY_WORDS.title}</span>} />
      {card.open ? (
        <Opened
          label={TY_WORDS.title}
          changed={card.draft !== card.line}
          verb={card.busy ? TY_WORDS.saving : W.save}
          busy={card.busy}
          onCancel={() => {
            setMoved(true);
            onCard(closed(card));
          }}
          onSave={save}
        >
          <ThankYouField
            id={`${id}-field`}
            label="unseen"
            optional={false}
            help={card.line === '' ? TY_WORDS.hint : TY_WORDS.remove}
            value={card.draft}
            tried={card.tried}
            box={box}
            onChange={(value) => onCard(typed(card, value))}
          />
          {card.failed && <Alert>{TY_WORDS.notSaved}</Alert>}
        </Opened>
      ) : card.line === '' ? (
        <>
          <p className="desk-line">{TY_WORDS.hint}</p>
          <ActionButton
            button={action}
            label={TY_WORDS.add}
            plus
            onPress={() => {
              setMoved(true);
              onCard(opened(card));
            }}
          />
        </>
      ) : (
        <>
          <Line event={event} line={card.line} />
          {card.canEnd && (
            <ActionButton
              button={action}
              label={TY_WORDS.edit}
              onPress={() => {
                setMoved(true);
                onCard(opened(card));
              }}
            />
          )}
        </>
      )}
    </section>
  );
}

function ActionButton({
  button,
  label,
  plus = false,
  onPress,
}: {
  button: RefObject<HTMLButtonElement | null>;
  label: string;
  plus?: boolean;
  onPress: () => void;
}) {
  return (
    <div className="ty-action">
      <button ref={button} type="button" className="desk-text" onClick={onPress}>
        {plus && <Glyph name="plus" size={17} weight={2.3} />}
        {label}
      </button>
    </div>
  );
}

/** End {event} now?, with the optional thank-you: one request ends it and saves the line. */
export function EndNowAsk({
  event,
  start,
  onKeep,
  onEnded,
}: {
  event: SampleEvent;
  start: EndField;
  onKeep: () => void;
  onEnded: (line: string) => void;
}) {
  const id = useId();
  const box = useRef<HTMLTextAreaElement>(null);
  const [field, setField] = useState(start);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    },
    [],
  );

  function go(): void {
    if (field.busy) return;
    if (thankYouOver(field.draft)) {
      setField({ ...field, tried: true, failed: false });
      box.current?.focus();
      return;
    }
    setField({ ...field, busy: true, failed: false });
    const line = cleanThankYou(field.draft);
    timer.current = window.setTimeout(() => onEnded(line), THANK_YOU_MS);
  }

  return (
    <Ask
      title={W.endTitle(event.name)}
      line={W.endLine}
      keep={W.keepItOn}
      go={W.endNow}
      busy={field.busy ? TY_WORDS.ending : undefined}
      failed={
        field.failed
          ? cleanThankYou(field.draft) === ''
            ? TY_WORDS.notEndedPlain
            : TY_WORDS.notEnded
          : undefined
      }
      first={start.tried ? box : undefined}
      onKeep={onKeep}
      onGo={go}
    >
      <ThankYouField
        id={`${id}-field`}
        label="shown"
        optional
        help={TY_WORDS.hint}
        value={field.draft}
        tried={field.tried}
        box={box}
        onChange={(value) =>
          setField({ ...field, draft: value, tried: field.tried && thankYouOver(value) })
        }
      />
    </Ask>
  );
}
