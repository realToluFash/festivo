import { ApiError, type LedEvent } from '@soirely/api-client';
import { initials } from '@soirely/domain';
import {
  type KeyboardEvent,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { LayersContext, useDeskDialog } from '../layers.ts';
import { meshFor } from '../mesh.ts';
import { offButton } from '../offButton.ts';
import { ActionPair } from './ActionPair.tsx';
import { Glyph } from './Glyph.tsx';
import { fold } from './orgMenu.ts';
import { Ask, Head, RowWords, TextAction } from './SettingsParts.tsx';
import './handover.css';

export const SEARCH_ABOVE = 15;
export const LISTED = 5;

export interface Who {
  id: string;
  name: string;
  tone: number;
}

export interface AskWords {
  title: string;
  lead: string;
  last: string;
  keep: string;
  go: string;
  red: boolean;
  busy: string;
  failed: string;
  checking: string;
  notLoaded: string;
}

export type Work =
  | { state: 'checking' }
  | { state: 'notLoaded' }
  | { state: 'loaded'; events: LedEvent[]; offered: Who[]; viewer: string | null };

export type Sending = 'asking' | 'sending' | 'failed' | 'refused';

export function matching(name: string, typed: string): boolean {
  const wanted = fold(typed.trim());

  return wanted === '' || ` ${fold(name)}`.includes(` ${wanted}`);
}

/** The server's handover.choose_recipient: somebody began leading an event while the confirm stood open. */
export function refusedHandTo(error: unknown): boolean {
  return error instanceof ApiError && error.status === 422 && 'handTo' in error.fieldErrors();
}

/** The work list and whoever may take it, read as the confirm opens: active members, never the one leaving (`self` when it is the viewer). */
export function useWork(
  organisation: string,
  departing: string | 'self',
  load: () => Promise<LedEvent[]>,
): { work: Work; retry: () => void } {
  const [work, setWork] = useState<Work>({ state: 'checking' });
  const [asked, setAsked] = useState(0);
  const loader = useRef(load);

  useLayoutEffect(() => {
    loader.current = load;
  });

  useEffect(() => {
    let live = true;

    Promise.all([loader.current(), api.everyMember(organisation, 'active')])
      .then(([events, members]) => {
        if (!live) return;
        const offered = members
          .filter(
            (one) =>
              one.status === 'active' && (departing === 'self' ? !one.self : one.id !== departing),
          )
          .map((one, tone) => ({ id: one.id, name: one.user.name, tone }));
        const viewer = members.find((one) => one.self)?.id ?? null;
        setWork({ state: 'loaded', events, offered, viewer });
      })
      .catch(() => {
        if (live) setWork({ state: 'notLoaded' });
      });

    return () => {
      live = false;
    };
  }, [organisation, departing, asked]);

  return {
    work,
    retry: () => {
      setWork({ state: 'checking' });
      setAsked((now) => now + 1);
    },
  };
}

/** The confirm while the work list is on its way, then failing to come; nothing can be confirmed until it is in. */
export function WorkNotIn({
  work,
  words,
  onKeep,
  onRetry,
}: {
  work: Extract<Work, { state: 'checking' | 'notLoaded' }>;
  words: AskWords;
  onKeep: () => void;
  onRetry: () => void;
}) {
  const { t } = useTranslation();

  return work.state === 'checking' ? (
    <CheckingAsk title={words.title} words={words} onKeep={onKeep} />
  ) : (
    <Ask
      title={words.title}
      line={words.last}
      keep={words.keep}
      go={t('handover.tryAgain')}
      red={false}
      failed={words.notLoaded}
      onKeep={onKeep}
      onGo={onRetry}
    />
  );
}

/** Remove's, Leave's and Hand over now's confirm with the handover in it (sc-614): who leads what, who takes it, and what will move. */
export function HandoverAsk({
  words,
  nobody = false,
  events,
  offered,
  viewer,
  organisation,
  to,
  sending,
  onPick,
  onKeep,
  onGo,
}: {
  words: AskWords;
  nobody?: boolean;
  events: readonly LedEvent[];
  offered: readonly Who[];
  viewer: string;
  organisation: string;
  to: string | null;
  sending: Sending;
  onPick: (to: string | null) => void;
  onKeep: () => void;
  onGo: () => void;
}) {
  const { t } = useTranslation();
  const landing = useId();
  const busy = sending === 'sending';

  return (
    <Ask
      title={words.title}
      line={words.lead}
      keep={words.keep}
      go={words.go}
      red={words.red}
      busy={busy ? words.busy : undefined}
      failed={
        sending === 'failed'
          ? words.failed
          : sending === 'refused'
            ? t('handover.chooseRecipient')
            : undefined
      }
      onKeep={onKeep}
      onGo={onGo}
    >
      <HandTo
        nobody={nobody}
        people={offered}
        picked={to}
        viewer={viewer}
        organisation={organisation}
        count={events.length}
        off={busy}
        landing={landing}
        onPick={onPick}
      />
      <Moves events={events} />
      <p>{words.last}</p>
    </Ask>
  );
}

function CheckingAsk(props: { title: string; words: AskWords; onKeep: () => void }) {
  const { host } = useContext(LayersContext);

  return host == null ? null : createPortal(<CheckingBox {...props} />, host);
}

function CheckingBox({
  title,
  words,
  onKeep,
}: {
  title: string;
  words: AskWords;
  onKeep: () => void;
}) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const keep = useRef<HTMLButtonElement>(null);

  useDeskDialog(box, keep, onKeep, false);

  return (
    <>
      <div className="dialog-scrim is-over" aria-hidden="true" />
      <div
        ref={box}
        className="desk-ask"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-line`}
      >
        <h2 id={`${id}-title`}>{title}</h2>
        <div className="desk-ask-body">
          <p id={`${id}-line`}>{words.last}</p>
          <Checking words={words.checking} />
        </div>
        <ActionPair
          className="desk-ask-pair"
          dismiss={
            <button ref={keep} type="button" className="desk-text" onClick={onKeep}>
              {words.keep}
            </button>
          }
          confirm={null}
        />
      </div>
    </>
  );
}

function Checking({ words }: { words: string }) {
  return (
    <p className="handover-checking" role="status">
      <span className="pending-spinner desk-turning" aria-hidden="true" />
      {words}
    </p>
  );
}

function Moves({ events }: { events: readonly LedEvent[] }) {
  const { t } = useTranslation();
  const more = events.length - LISTED;

  return (
    <div>
      <ul className="handover-moves" aria-label={t('handover.willMove', { count: events.length })}>
        {events.slice(0, LISTED).map((event) => (
          <li key={event.id}>
            <span
              className={`handover-tile today-cover is-${meshFor(event.id)}`}
              aria-hidden="true"
            />
            <span className="handover-move-name" title={event.title}>
              {event.title}
            </span>
          </li>
        ))}
      </ul>
      {more > 0 && <p className="handover-more">{t('handover.more', { count: more })}</p>}
    </div>
  );
}

function Face({ who }: { who: Who | null }) {
  return who == null ? (
    <span className="handover-face is-nobody" aria-hidden="true">
      <Glyph name="people" size={20} weight={2.2} />
    </span>
  ) : (
    <span className={`handover-face desk-avatar tone${who.tone % 5}`} aria-hidden="true">
      {initials(who.name)}
    </span>
  );
}

const fieldIn = (box: HTMLElement | null) => box?.querySelector<HTMLInputElement>('input') ?? null;
const optionsIn = (box: HTMLElement | null) => [
  ...(box?.querySelectorAll<HTMLElement>('[role=option]') ?? []),
];

/** Who takes them: a button that drops a listbox of people (WAI-ARIA APG), with a search above 15. */
function HandTo({
  nobody,
  people,
  picked,
  viewer,
  organisation,
  count,
  off,
  landing,
  onPick,
}: {
  nobody: boolean;
  people: readonly Who[];
  picked: string | null;
  viewer: string;
  organisation: string;
  count: number;
  off: boolean;
  landing: string;
  onPick: (to: string | null) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [heard, setHeard] = useState<{ query: string; words: string } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const into = useRef<'picked' | 'last' | null>(null);
  const typed = useRef({ text: '', at: 0 });
  const searchable = people.length > SEARCH_ABOVE;
  const wanted = searchable ? query : '';
  const shown = people.filter((one) => matching(one.name, wanted));
  const choices: (Who | null)[] = [...(nobody && wanted.trim() === '' ? [null] : []), ...shown];
  const current = people.find((one) => one.id === picked) ?? null;
  const whoWords = (one: Who | null) =>
    one == null
      ? t('handover.nobody', { count })
      : one.id === viewer
        ? t('handover.yours', { name: one.name })
        : one.name;
  const words = whoWords(current);
  const noMatch = t('handover.noMatch', { organisation, typed: wanted.trim() });
  const said = heard != null && heard.query === wanted ? heard.words : '';

  useLayoutEffect(() => {
    const where = into.current;
    into.current = null;
    typed.current = { text: '', at: 0 };
    if (!open || where == null) return;
    if (searchable) return void fieldIn(menu.current)?.focus();

    const all = optionsIn(menu.current);
    const on = all.find((one) => one.getAttribute('aria-selected') === 'true') ?? all[0];
    (where === 'last' ? all.at(-1) : on)?.focus();
  }, [open, searchable]);

  useLayoutEffect(() => {
    const drop = menu.current;
    if (!open || drop == null) return;

    const fit = () => {
      const room = window.innerHeight - drop.getBoundingClientRect().top - 16;
      drop.style.setProperty('max-height', `${Math.max(160, room)}px`);
    };
    fit();
    window.addEventListener('resize', fit);

    return () => window.removeEventListener('resize', fit);
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

  useEffect(() => {
    if (!open || !searchable || wanted.trim() === '') return;
    const words = shown.length === 0 ? noMatch : t('handover.matches', { count: shown.length });
    const timer = setTimeout(() => setHeard({ query: wanted, words }), 500);

    return () => clearTimeout(timer);
  }, [open, searchable, wanted, shown.length, noMatch, t]);

  function close(): void {
    setOpen(false);
    button.current?.focus();
  }

  function pick(one: Who | null): void {
    onPick(one?.id ?? null);
    close();
  }

  function clear(): void {
    setQuery('');
    fieldIn(menu.current)?.focus();
  }

  function moveOn(event: KeyboardEvent): void {
    const box = button.current?.closest('[role=alertdialog]');
    const all = [...(box?.querySelectorAll<HTMLElement>('input, button, a[href]') ?? [])].filter(
      (one) => !menu.current?.contains(one),
    );
    const at = all.indexOf(button.current as HTMLElement);

    setOpen(false);
    all[(at + (event.shiftKey ? -1 : 1) + all.length) % all.length]?.focus();
  }

  function jump(key: string, all: HTMLElement[], at: number): void {
    const now = Date.now();
    const text = now - typed.current.at < 500 ? typed.current.text + key : key;
    typed.current = { text, at: now };
    const from = text.length === 1 ? at + 1 : Math.max(at, 0);
    const order = all.map((_, step) => (from + step) % all.length);
    const hit = order.find((index) => {
      const one = choices[index];
      return one !== undefined && fold(whoWords(one)).startsWith(fold(text));
    });
    if (hit != null) all[hit]?.focus();
  }

  function keys(event: KeyboardEvent<HTMLElement>): void {
    const all = optionsIn(menu.current);
    const at = all.indexOf(event.currentTarget);
    const inField = event.currentTarget instanceof HTMLInputElement;

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        return close();
      case 'Tab':
        event.preventDefault();
        event.stopPropagation();
        return moveOn(event);
      case 'ArrowDown':
        event.preventDefault();
        return void (at < 0 ? all[0] : all[Math.min(at + 1, all.length - 1)])?.focus();
      case 'ArrowUp':
        event.preventDefault();
        return void (at > 0 ? all[at - 1] : searchable ? fieldIn(menu.current) : all[0])?.focus();
      case 'Home':
      case 'End':
        if (inField) return;
        event.preventDefault();
        return void (event.key === 'Home' ? all[0] : all.at(-1))?.focus();
      case 'Enter':
      case ' ':
        if (at < 0) return;
        event.preventDefault();
        return pick(choices[at] ?? null);
    }

    if (inField || event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    if (!searchable) return jump(event.key, all, at);
    setQuery((now) => now + event.key);
    fieldIn(menu.current)?.focus();
  }

  return (
    <div className="handover-to">
      <button
        ref={button}
        id={`${id}-who`}
        type="button"
        className={['handover-who', open && 'is-open', off && 'is-off'].filter(Boolean).join(' ')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-label={t('handover.handTo', { count, who: words })}
        {...offButton(off, { dim: false })}
        onClick={() => {
          if (open) return close();
          into.current = 'picked';
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (off || open || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
          event.preventDefault();
          into.current = event.key === 'ArrowUp' ? 'last' : 'picked';
          setOpen(true);
        }}
      >
        <Face who={current} />
        <span className="handover-who-name">{words}</span>
        <Glyph name="chevdown" size={18} weight={2.4} />
      </button>
      {open && (
        <div ref={menu} className="handover-menu">
          {searchable && (
            <div className="handover-search">
              <Glyph name="search" size={18} weight={2.2} />
              <input
                id={landing}
                type="search"
                aria-label={t('handover.search')}
                aria-controls={`${id}-list`}
                placeholder={t('handover.search')}
                value={query}
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={keys}
              />
              {query !== '' && (
                <button
                  type="button"
                  className="handover-clear"
                  aria-label={t('handover.clearSearch')}
                  onClick={clear}
                  onKeyDown={keys}
                >
                  <span className="handover-clear-disc" aria-hidden="true">
                    <Glyph name="clear" size={11} weight={3} />
                  </span>
                </button>
              )}
            </div>
          )}
          {choices.length === 0 ? (
            <div className="handover-none">
              <p>{noMatch}</p>
              <button type="button" className="desk-text" onClick={clear} onKeyDown={keys}>
                {t('handover.clearSearch')}
              </button>
            </div>
          ) : (
            <ul
              id={`${id}-list`}
              role="listbox"
              aria-labelledby={`${id}-who`}
              className="handover-list"
            >
              {choices.map((one) => {
                const on = (one?.id ?? null) === picked;

                return (
                  <li
                    key={one?.id ?? 'nobody'}
                    role="option"
                    aria-selected={on}
                    tabIndex={-1}
                    className="handover-option"
                    onClick={() => pick(one)}
                    onKeyDown={keys}
                  >
                    <span className="handover-tick">
                      {on && <Glyph name="tick" size={16} weight={2.6} />}
                    </span>
                    <Face who={one} />
                    <span className="handover-option-name">{whoWords(one)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {searchable && (
            <p className="desk-unseen" role="status">
              {said}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** A suspended member's page before their work list is in: it says nothing of what they lead, and Hand over now waits. */
export function LeadsNotIn({
  name,
  failed,
  onRetry,
}: {
  name: string;
  failed: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation();

  if (!failed) return <Checking words={t('handover.checking', { name })} />;

  return (
    <div className="handover-not-in">
      <p role="alert" className="handover-not-in-line">
        <span className="handover-not-in-mark">
          <Glyph name="alert" size={18} weight={2.2} />
        </span>
        {t('handover.notLoaded', { name })}
      </p>
      <TextAction label={t('handover.tryAgain')} onClick={onRetry} />
    </div>
  );
}

/** "Leads {n} events" on a suspended member's page, with Hand over now for those who may. */
export function LeadsBlock({
  events,
  onHandOver,
}: {
  events: readonly LedEvent[];
  onHandOver: (() => void) | null;
}) {
  const { t } = useTranslation();

  return (
    <section className="desk-block">
      <Head title={t('handover.leadsHead', { count: events.length })}>
        {onHandOver != null && (
          <TextAction label={t('handover.handOverNow')} onClick={onHandOver} />
        )}
      </Head>
      <ul className="desk-rows has-lead">
        {events.map((event) => (
          <li key={event.id} className="desk-row handover-event">
            <span
              className={`handover-tile is-row today-cover is-${meshFor(event.id)}`}
              aria-hidden="true"
            />
            <RowWords title={event.title} />
          </li>
        ))}
      </ul>
    </section>
  );
}
