import {
  type KeyboardEvent,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { Glyph } from '../components/Glyph.tsx';
import { useLater } from '../useLater.ts';
import {
  type Draft,
  type Segment,
  CHANNELS,
  EVENT_NAME,
  HOSTS,
  MW,
  ORGANISATION,
  PAGE_WHEN,
  THEIR_LINK,
  filled,
  many,
} from './messages.ts';
import { useInbox } from './messagesContext.ts';
import { asBuilt } from './messagesNotice.ts';
import { WhereGlyph } from './MessagesParts.tsx';
import {
  type Language,
  type Person,
  type PersonId,
  FIRST_PERSON,
  PEOPLE,
} from './messagesPreviewSample.ts';
import { PW, STAND_INS } from './messagesPreviewWords.ts';
import './messagesPreview.css';

export const FILL_MS = 900;
const EVENT_DAY = new Date('2026-11-05T12:00:00Z');
const HOST_NAMES = ['Adaeze Obi', 'Tunde Bakare'];
const LANGUAGE_NAMES = new Intl.DisplayNames(['en'], { type: 'language' });

function personOf(id: PersonId): Person {
  return PEOPLE.find((one) => one.id === id) ?? (PEOPLE[0] as Person);
}

function languageName(person: Person): string {
  return LANGUAGE_NAMES.of(person.language) ?? person.language;
}

function optionWords(person: Person): string {
  return filled(PW.option, { name: person.name, language: languageName(person) });
}

/** Soirely's own formatting in a guest's language other than English, bracketed as a stand-in. */
function ours(language: Language, words: string): string {
  return language === 'en' ? words : `[${words}]`;
}

function dayIn(language: Language, weekday: 'long' | 'short'): string {
  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : language, {
    weekday,
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(EVENT_DAY);
}

function hostsFor(person: Person): string {
  if (person.language === 'en') return HOSTS;

  return ours(
    person.language,
    new Intl.ListFormat(person.language, { style: 'long', type: 'conjunction' }).format(HOST_NAMES),
  );
}

function whenFor(person: Person): string {
  if (person.language === 'en') return PAGE_WHEN;

  const [, ...rest] = PAGE_WHEN.split(' · ');

  return [ours(person.language, dayIn(person.language, 'short')), ...rest].join(' · ');
}

/** Each token filled for this guest; braces the host typed are text and stay as typed. */
function filledFor(body: readonly Segment[], person: Person): string {
  return body
    .map((part) => {
      if (part.kind === 'text') return part.text;
      switch (part.token) {
        case 'greeting':
          return person.greetAs ?? person.name;
        case 'event':
          return EVENT_NAME;
        case 'date':
          return ours(person.language, dayIn(person.language, 'long'));
        default:
          return hostsFor(person);
      }
    })
    .join('');
}

function linesFor(body: readonly Segment[], person: Person): string[] {
  const greets = body.some((part) => part.kind === 'token' && part.token === 'greeting');
  const tokens = body.some((part) => part.kind === 'token');
  const typed = body.some((part) => part.kind === 'text' && /\{[^{}]*\}/u.test(part.text));
  const language = languageName(person);
  const from =
    person.from === 'chose'
      ? PW.choseLanguage
      : person.from === 'set'
        ? MW.inLanguage
        : PW.organisationLanguage;

  return [
    ...(greets
      ? [
          person.greetAs == null
            ? filled(MW.greetedAs, { name: person.name })
            : filled(PW.greetedAs, { greetAs: person.greetAs }),
        ]
      : []),
    filled(from, { language }),
    MW.onlyOurs,
    ...(typed ? [PW.typedBraces] : []),
    ...(tokens ? [] : [PW.nothingToFill]),
  ];
}

function noticeFor(person: Person) {
  const greeting = person.greetAs ?? person.name;

  if (person.language === 'en')
    return {
      subject: filled(MW.noticeSubject, { event: EVENT_NAME, hosts: HOSTS }),
      dear: filled(MW.dear, { greeting }),
      body: filled(MW.noticeBody, { hosts: HOSTS, event: EVENT_NAME }),
      button: MW.readOnPage,
      stop: filled(MW.stopEmails, { organisation: ORGANISATION }),
      sms: filled(MW.noticeSms, { hosts: HOSTS, event: EVENT_NAME, link: THEIR_LINK }),
    };

  const words = STAND_INS[person.language];

  return {
    ...words,
    dear: filled(words.dear, { greeting }),
    sms: filled(words.sms, { link: THEIR_LINK }),
  };
}

/** The message as the chosen guest's page shows it, and Soirely's notice by each ticked channel they have (sc-3960). */
export function Preview({ draft }: { draft: Draft }) {
  const { act, mesh } = useInbox();
  const later = useLater();
  const [who, setWho] = useState<PersonId>(draft.previewAs ?? FIRST_PERSON);
  const [filling, setFilling] = useState(draft.opens === 'filling');
  const [first] = useState(draft.opens === 'previewAs');
  const person = personOf(who);
  const notice = noticeFor(person);
  const lang = person.language === 'en' ? undefined : person.language;
  const shown = CHANNELS.filter((channel) => draft.ticks[channel] && person.has.includes(channel));
  const sendsId = useId();
  const seen = useEffectEvent(() => {
    if (draft.opens != null) act({ kind: 'draft', draft: { opens: undefined } });
  });

  useEffect(() => {
    seen();
  }, []);

  function pick(id: PersonId): void {
    setWho(id);
    setFilling(true);
    act({ kind: 'draft', draft: { previewAs: id } });
    later(FILL_MS, () => setFilling(false));
  }

  return (
    <div className="mg-preview">
      <div className="mg-preview-top">
        <h3 className="mg-preview-heading">{filled(MW.previewAs, { name: person.name })}</h3>
        <PreviewAs
          who={who}
          options={PEOPLE.map((one) => ({ id: one.id, words: optionWords(one) }))}
          first={first}
          onPick={(id) => pick(id as PersonId)}
        />
      </div>
      <p className="desk-unseen" role="status">
        {filling ? filled(PW.filling, { name: person.name }) : ''}
      </p>
      {filling ? (
        <PreviewBones name={person.name} />
      ) : (
        <>
          <div className="mg-preview-cols">
            <div className="mg-page">
              <div className={`mg-page-cover today-cover is-${mesh}`}>
                <span className="desk-piece p1" aria-hidden="true" />
                <span className="desk-piece p2" aria-hidden="true" />
                <span className="desk-piece p4" aria-hidden="true" />
                <p className="mg-page-name">{EVENT_NAME}</p>
                <p className="mg-page-when">{whenFor(person)}</p>
              </div>
              <figure className="mg-page-figure">
                {draft.subject.trim() !== '' && <p className="mg-page-subject">{draft.subject}</p>}
                <blockquote>{filledFor(draft.body, person)}</blockquote>
                <figcaption>{hostsFor(person)}</figcaption>
              </figure>
            </div>
            {shown.length > 0 && (
              <section className="mg-sends" aria-labelledby={sendsId}>
                <h3 id={sendsId}>{MW.whatSoirelySends}</h3>
                {shown.includes('email') && (
                  <div className="mg-email">
                    <p className="mg-notice-head">
                      <WhereGlyph where="email" />
                      {filled(MW.emailFrom, { organisation: ORGANISATION })}
                    </p>
                    <div className="mg-notice-words" lang={lang}>
                      <p className="mg-email-subject">{notice.subject}</p>
                      <p>
                        {notice.dear}
                        <br />
                        {notice.body}
                      </p>
                      <span className="mg-email-button">{notice.button}</span>
                      <span className="mg-email-stop">{notice.stop}</span>
                    </div>
                  </div>
                )}
                {shown.includes('sms') && (
                  <div className="mg-notice">
                    <p className="mg-notice-head">
                      <WhereGlyph where="sms" />
                      {many('smsParts', asBuilt(notice.sms).parts)}
                    </p>
                    <p className="mg-notice-bubble" lang={lang}>
                      {notice.sms}
                    </p>
                  </div>
                )}
                {shown.includes('whatsApp') && (
                  <div className="mg-notice">
                    <p className="mg-notice-head">
                      <WhereGlyph where="whatsApp" />
                      {MW.whatsAppTemplate}
                    </p>
                    <div className="mg-notice-bubble is-wa" lang={lang}>
                      <p>{notice.body}</p>
                      <span>{notice.button}</span>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
          <ul className="mg-preview-lines">
            {linesFor(draft.body, person).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** While the preview fills for another guest: the words, and the page and its notices as Sunk shapes. */
export function PreviewBones({ name }: { name: string }) {
  return (
    <div className="mg-preview-bones" aria-hidden="true">
      <p className="mg-preview-filling">{filled(PW.filling, { name })}</p>
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
      <span className="mg-bone-text is-long" />
      <span className="mg-bone-text" />
    </div>
  );
}

function optionsIn(list: HTMLElement | null): HTMLElement[] {
  return [...(list?.querySelectorAll<HTMLElement>('[role=option]') ?? [])];
}

/** Preview as: a button that drops the people in To as a listbox (WAI-ARIA APG), the chosen one ticked. */
export function PreviewAs({
  who,
  options,
  first,
  onPick,
}: {
  who: string;
  options: readonly { id: string; words: string }[];
  first: boolean;
  onPick: (id: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(first);
  const into = useRef(first);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);

  useLayoutEffect(() => {
    if (!open || !into.current) return;
    into.current = false;
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

  function close(back: boolean): void {
    setOpen(false);
    if (back) button.current?.focus();
  }

  function choose(next: string): void {
    close(true);
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
        close(true);
        return;
      case 'Tab':
        close(false);
        return;
      default:
    }
  }

  return (
    <div className="mg-preview-pick">
      <span id={`${id}-label`} className="mg-preview-as">
        {PW.previewAs}
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
          onClick={() => {
            if (open) return close(false);
            into.current = true;
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (open || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
            event.preventDefault();
            into.current = true;
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
