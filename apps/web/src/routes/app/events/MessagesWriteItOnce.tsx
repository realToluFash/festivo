import { ApiError, type GuestMessagePreview, type OrganisationEvent } from '@soirely/api-client';
import {
  INSERTABLE_TOKENS,
  type MessageSegment,
  type MessageToken,
  fillMessage,
  hasTokens,
  hasTypedBraces,
  messageSegments,
  tokenValues,
} from '@soirely/domain';
import type { TFunction } from 'i18next';
import {
  type KeyboardEvent,
  type RefObject,
  useEffect,
  useEffectEvent,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../../../api.ts';
import { Glyph } from '../../../components/Glyph.tsx';
import { useSession } from '../../../session.ts';
import { languageName, languageNameInSentence } from '../settings/organisationDetails.ts';
import { tokenName, tokenWord } from './messageWords.ts';
import { insertOpensUnder, shownBox } from './insertPlacement.ts';
import './messagesPreview.css';

/** A message's words with each token as its chip, for a bubble and the field alike. */
export function MessageWords({ wire }: { wire: string }) {
  const { t } = useTranslation();

  return messageSegments(wire).map((segment, at) =>
    segment.kind === 'text' ? (
      segment.text
    ) : (
      <span key={at} className="mg-token" role="img" aria-label={tokenName(t, segment.token)}>
        {tokenWord(t, segment.token)}
      </span>
    ),
  );
}

function chipOf(t: TFunction, token: MessageToken): HTMLElement {
  const chip = document.createElement('span');

  chip.className = 'mg-token';
  chip.contentEditable = 'false';
  chip.dataset.token = token;
  chip.setAttribute('role', 'img');
  chip.setAttribute('aria-label', tokenName(t, token));
  chip.textContent = tokenWord(t, token);

  return chip;
}

function read(node: Node): MessageSegment[] {
  const parts: MessageSegment[] = [];

  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE)
      parts.push({ kind: 'text', text: child.textContent ?? '' });
    else if (child instanceof HTMLElement && child.dataset.token != null)
      parts.push({ kind: 'token', token: child.dataset.token as MessageToken });
    else if (child instanceof HTMLBRElement) parts.push({ kind: 'text', text: '\n' });
    else if (child instanceof HTMLElement) {
      if (child.tagName === 'DIV' && parts.length > 0) parts.push({ kind: 'text', text: '\n' });
      parts.push(...read(child));
    }
  });

  return parts.reduce<MessageSegment[]>((joined, part) => {
    const last = joined.at(-1);

    if (part.kind === 'text' && last?.kind === 'text')
      return [...joined.slice(0, -1), { kind: 'text', text: last.text + part.text }];

    return [...joined, part];
  }, []);
}

function caretToEnd(node: HTMLElement): void {
  const range = document.createRange();

  range.selectNodeContents(node);
  range.collapse(false);
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
}

export interface FieldHandle {
  insert: (token: MessageToken) => void;
}

/** The Message: typed text and chips that only Insert makes, each removed whole by one Backspace, since a chip is not editable inside. */
export function MessageField({
  fieldRef,
  first,
  editable,
  describedBy,
  invalid,
  onChange,
  onKeyDown,
}: {
  fieldRef: RefObject<FieldHandle | null>;
  first: readonly MessageSegment[];
  editable: boolean;
  describedBy: string | undefined;
  invalid: boolean;
  onChange: (segments: MessageSegment[]) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}) {
  const { t } = useTranslation();
  const box = useRef<HTMLDivElement>(null);
  const seeded = useRef(first);
  const toEnd = useRef(false);

  useLayoutEffect(() => {
    const field = box.current;

    if (field == null) return;
    field.replaceChildren(
      ...seeded.current.map((part) =>
        part.kind === 'text' ? document.createTextNode(part.text) : chipOf(t, part.token),
      ),
    );
    toEnd.current = field.childNodes.length > 0;
  }, [t]);

  useImperativeHandle(fieldRef, () => ({
    insert(token: MessageToken) {
      const field = box.current;
      const chip = chipOf(t, token);
      const at = window.getSelection();
      const range = at != null && at.rangeCount > 0 ? at.getRangeAt(0) : null;

      if (field == null) return;
      if (range != null && field.contains(range.startContainer)) {
        range.deleteContents();
        range.insertNode(chip);
      } else field.append(chip);
      onChange(read(field));
      field.focus();

      const after = document.createRange();

      after.setStartAfter(chip);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(after);
    },
  }));

  return (
    <div
      ref={box}
      className="mg-field"
      contentEditable={editable ? 'true' : 'false'}
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={t('eventMessages.message')}
      aria-readonly={!editable}
      aria-invalid={invalid ? true : undefined}
      aria-describedby={describedBy}
      data-placeholder={t('eventMessages.writeToGuests')}
      data-focus="body"
      tabIndex={0}
      onFocus={() => {
        const field = box.current;

        if (!toEnd.current || field == null) return;
        toEnd.current = false;
        queueMicrotask(() => caretToEnd(field));
      }}
      onPaste={(event) => {
        event.preventDefault();
        document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
      }}
      onInput={() => {
        const field = box.current;
        const now = field == null ? [] : read(field);

        if (field != null && now.every((part) => part.kind === 'text' && part.text.trim() === ''))
          field.replaceChildren();
        onChange(now);
      }}
      onKeyDown={onKeyDown}
    />
  );
}

function itemsIn(menu: HTMLElement | null): HTMLElement[] {
  return [...(menu?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])];
}

/** Insert: a menu of the tokens, each its word as the chip draws it and its line; a pick goes back into the field. */
export function InsertMenu({ onPick }: { onPick: (token: MessageToken) => void }) {
  const { t } = useTranslation();
  const id = useId();
  const [open, setOpen] = useState(false);
  const into = useRef(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const [under, setUnder] = useState(false);

  useLayoutEffect(() => {
    if (!open || button.current == null || menu.current == null) return;
    setUnder(
      insertOpensUnder(
        button.current.getBoundingClientRect(),
        shownBox(button.current),
        menu.current.offsetHeight,
      ),
    );
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !into.current) return;
    into.current = false;
    itemsIn(menu.current)[0]?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const outside = (event: PointerEvent) => {
      const target = event.target as Node;

      if (!menu.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };

    document.addEventListener('pointerdown', outside);

    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  function keys(event: KeyboardEvent<HTMLElement>, at: number): void {
    const all = itemsIn(menu.current);

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        all[(at + (event.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length]?.focus();
        return;
      case 'Home':
      case 'End':
        event.preventDefault();
        (event.key === 'Home' ? all[0] : all.at(-1))?.focus();
        return;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        button.current?.focus();
        return;
      case 'Tab':
        setOpen(false);
        return;
      default:
    }
  }

  return (
    <div className="mg-insert-at">
      <button
        ref={button}
        type="button"
        className="desk-text"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        data-focus="insert"
        onClick={() => {
          into.current = !open;
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (open || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
          event.preventDefault();
          into.current = true;
          setOpen(true);
        }}
      >
        <Glyph name="braces" size={17} weight={2.2} />
        {t('eventMessages.insert')}
      </button>
      {open && (
        <ul
          ref={menu}
          id={`${id}-menu`}
          role="menu"
          aria-label={t('eventMessages.insert')}
          className="mg-pop mg-insert-list"
          data-under={under || undefined}
        >
          {INSERTABLE_TOKENS.map((token, at) => (
            <li key={token} role="none">
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-label={tokenWord(t, token)}
                aria-describedby={`${id}-${token}`}
                className="mg-insert-row"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setOpen(false);
                  onPick(token);
                }}
                onKeyDown={(event) => keys(event, at)}
              >
                <span className="mg-token" aria-hidden="true">
                  {tokenWord(t, token)}
                </span>
                <span id={`${id}-${token}`} className="mg-insert-line">
                  {t(`eventMessages.tokenLine.${token}`)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Load =
  | { kind: 'loading' }
  | { kind: 'failed'; id: string; tries: number }
  | { kind: 'loaded'; id: string; tries: number; preview: GuestMessagePreview };

/** As one guest will see it: their page with the message filled in, what Soirely sends them, and the lines that say why. */
export function MessagePreview({
  event,
  people,
  subject,
  wire,
  now,
  onGone,
}: {
  event: OrganisationEvent;
  people: readonly { id: string; name: string; language: string }[];
  subject: string;
  wire: string;
  now: Date;
  onGone: (person: { id: string; name: string }) => void;
}) {
  const { t } = useTranslation();
  const [who, setWho] = useState(people[0]?.id ?? '');
  const [tries, setTries] = useState(0);
  const [got, setGot] = useState<Load>({ kind: 'loading' });
  const [said, setSaid] = useState<string | null>(null);
  const load: Load =
    got.kind !== 'loading' && got.id === who && got.tries === tries ? got : { kind: 'loading' };
  const sendsId = useId();
  const person = people.find((one) => one.id === who) ?? people[0];
  const gone = useEffectEvent((id: string) => {
    const left = people.filter((one) => one.id !== id);
    const them = people.find((one) => one.id === id);

    if (them == null) return;
    onGone(them);
    if (left[0] == null) return;
    setSaid(t('eventMessages.noLongerGuest', { name: them.name, next: left[0].name }));
    setWho(left[0].id);
  });

  useEffect(() => {
    let current = true;

    api.guestMessagePreview(event.id, who).then(
      (preview) => current && setGot({ kind: 'loaded', id: who, tries, preview }),
      (error: unknown) => {
        if (!current) return;
        if (error instanceof ApiError && error.status === 404) gone(who);
        else setGot({ kind: 'failed', id: who, tries });
      },
    );

    return () => {
      current = false;
    };
  }, [event.id, who, tries]);

  if (person == null) return null;

  const segments = messageSegments(wire);

  return (
    <div className="mg-preview">
      <div className="mg-preview-top">
        <h3 className="mg-preview-heading" tabIndex={-1} data-focus="preview-heading">
          {t('eventMessages.previewHeading', { name: person.name })}
        </h3>
        <PreviewAs
          who={who}
          options={people.map((one) => ({
            id: one.id,
            words: t('eventMessages.previewOption', {
              name: one.name,
              language: languageName(t, one.language),
            }),
          }))}
          onPick={(id) => {
            setSaid(null);
            setWho(id);
          }}
        />
      </div>
      <div role="status">
        {said != null && (
          <p className="mg-preview-gone">
            <Glyph name="info" size={16} weight={2.2} />
            {said}
          </p>
        )}
      </div>
      <p className="desk-unseen" role="status">
        {load.kind === 'loading' ? t('eventMessages.filling', { name: person.name }) : ''}
      </p>
      {load.kind === 'failed' ? (
        <div className="mg-preview-failed" role="alert">
          <p className="mg-preview-failed-words">
            <Glyph name="alert" size={18} weight={2.2} />
            {t('eventMessages.previewFailed', { name: person.name })}
          </p>
          <p className="desk-line">{t('eventMessages.previewFailedLine')}</p>
          <button type="button" className="desk-text" onClick={() => setTries((n) => n + 1)}>
            {t('eventMessages.tryAgain')}
          </button>
        </div>
      ) : load.kind === 'loading' ? (
        <PreviewBones name={person.name} />
      ) : (
        <Filled
          event={event}
          preview={load.preview}
          subject={subject}
          segments={segments}
          now={now}
          sendsId={sendsId}
        />
      )}
    </div>
  );
}

function Filled({
  event,
  preview,
  subject,
  segments,
  now,
  sendsId,
}: {
  event: OrganisationEvent;
  preview: GuestMessagePreview;
  subject: string;
  segments: MessageSegment[];
  now: Date;
  sendsId: string;
}) {
  const { t } = useTranslation();
  const organisation = useSession().organisation?.name ?? '';
  const { guest } = preview;
  const values = tokenValues(
    { fullName: guest.name, greetAs: guest.greetAs },
    event,
    guest.language,
    now,
  );
  const language = languageNameInSentence(t, guest.language);
  const greets = segments.some((part) => part.kind === 'token' && part.token === 'greeting');
  const lines = [
    ...(greets
      ? [
          guest.greetAs == null
            ? t('eventMessages.greetedAsName', { name: guest.name })
            : t('eventMessages.greetedAsGreetAs', { greetAs: guest.greetAs }),
        ]
      : []),
    t(`eventMessages.languageFrom.${guest.languageFrom}`, { language }),
    t('eventMessages.onlyOurs'),
    ...(hasTypedBraces(segments) ? [t('eventMessages.typedBraces')] : []),
    ...(hasTokens(segments) ? [] : [t('eventMessages.nothingToFill')]),
  ];
  const lang = guest.language;

  return (
    <>
      <div className="mg-preview-cols">
        <div className="mg-page" lang={lang}>
          <div className="mg-page-cover">
            <p className="mg-page-name">{event.name}</p>
            <p className="mg-page-when">{values.date}</p>
          </div>
          <figure className="mg-page-figure">
            {subject.trim() !== '' && <p className="mg-page-subject">{subject}</p>}
            <blockquote>{fillMessage(segments, values)}</blockquote>
            <figcaption>{values.hosts}</figcaption>
          </figure>
        </div>
        {preview.notices.length > 0 && (
          <section className="mg-sends" aria-labelledby={sendsId}>
            <h3 id={sendsId}>{t('eventMessages.whatSoirelySends')}</h3>
            {preview.notices.map((notice) => (
              <div key={notice.channel} className="mg-email">
                <p className="mg-notice-head">
                  <Glyph name="mail" size={15} weight={2.2} />
                  {t('eventMessages.emailFrom', { organisation })}
                </p>
                <div className="mg-notice-words" lang={lang}>
                  <p className="mg-email-subject">{notice.subject}</p>
                  <p className="mg-notice-text">{notice.text}</p>
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
      <ul className="mg-preview-lines">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </>
  );
}

function PreviewBones({ name }: { name: string }) {
  const { t } = useTranslation();

  return (
    <div className="mg-preview-bones" aria-hidden="true">
      <p className="mg-preview-filling">{t('eventMessages.filling', { name })}</p>
      <div className="mg-preview-cols">
        <div className="mg-bone-page">
          <span className="mg-bone-cover" />
          <span className="mg-bone-text is-long" />
          <span className="mg-bone-text" />
          <span className="mg-bone-text is-short" />
        </div>
        <div className="mg-bone-sends">
          <span className="mg-bone-notice" />
          <span className="mg-bone-notice is-short" />
        </div>
      </div>
    </div>
  );
}

function optionsIn(list: HTMLElement | null): HTMLElement[] {
  return [...(list?.querySelectorAll<HTMLElement>('[role=option]') ?? [])];
}

/** Preview as: a button that drops the people in To as a listbox (WAI-ARIA APG), the chosen one ticked. */
function PreviewAs({
  who,
  options,
  onPick,
}: {
  who: string;
  options: readonly { id: string; words: string }[];
  onPick: (id: string) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    optionsIn(list.current)
      .find((one) => one.getAttribute('aria-selected') === 'true')
      ?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const outside = (event: PointerEvent) => {
      const target = event.target as Node;

      if (!list.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };

    document.addEventListener('pointerdown', outside);

    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  function choose(next: string): void {
    setOpen(false);
    button.current?.focus();
    if (next !== who) onPick(next);
  }

  function keys(event: KeyboardEvent<HTMLElement>, at: number): void {
    const all = optionsIn(list.current);

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        all[
          Math.min(Math.max(at + (event.key === 'ArrowDown' ? 1 : -1), 0), all.length - 1)
        ]?.focus();
        return;
      case 'Home':
      case 'End':
        event.preventDefault();
        (event.key === 'Home' ? all[0] : all.at(-1))?.focus();
        return;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const one = options[at];

        if (one != null) choose(one.id);
        return;
      }
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        button.current?.focus();
        return;
      case 'Tab':
        setOpen(false);
        return;
      default:
    }
  }

  return (
    <div className="mg-preview-pick">
      <span id={`${id}-label`} className="mg-preview-as">
        {t('eventMessages.previewAs')}
      </span>
      <div className="mg-preview-as-at">
        <button
          ref={button}
          id={`${id}-button`}
          type="button"
          className="mg-preview-as-button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? `${id}-list` : undefined}
          aria-labelledby={`${id}-label ${id}-button`}
          data-focus="preview-as"
          onClick={() => setOpen(!open)}
          onKeyDown={(event) => {
            if (open || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
            event.preventDefault();
            setOpen(true);
          }}
        >
          <span className="mg-preview-as-words">
            {options.find((one) => one.id === who)?.words ?? ''}
          </span>
          <Glyph name="chevdown" size={15} weight={2.4} />
        </button>
        {open && (
          <ul
            ref={list}
            id={`${id}-list`}
            role="listbox"
            aria-labelledby={`${id}-label`}
            className="mg-pop mg-preview-as-list"
          >
            {options.map((one, at) => (
              <li
                key={one.id}
                role="option"
                aria-selected={one.id === who}
                tabIndex={-1}
                className="mg-preview-as-option"
                onClick={() => choose(one.id)}
                onKeyDown={(event) => keys(event, at)}
              >
                <span className="mg-preview-as-tick">
                  {one.id === who && <Glyph name="tick" size={15} weight={2.6} />}
                </span>
                {one.words}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
