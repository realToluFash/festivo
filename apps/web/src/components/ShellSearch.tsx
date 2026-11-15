import { searchFailure, type SearchReach } from '@soirely/api-client';
import {
  SEARCH_LEAST,
  type SearchGroup,
  type SearchGroupKey,
  type SearchRow as Row,
  type SearchStanding,
  initials,
  searchFieldKeys,
  searchGroups,
  searchMoved,
  searchTotal,
  serverClock,
} from '@soirely/domain';
import {
  createContext,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { api } from '../api.ts';
import { dateLocale } from '../i18n/index.ts';
import { useDeskDialog } from '../layers.ts';
import { meshFor } from '../mesh.ts';
import { eventsSearchLink, keyHint, searchLink } from '../searchLinks.ts';
import { Glyph } from './Glyph.tsx';
import { type MarkKind, Tag, TextAction } from './SettingsParts.tsx';
import './search.css';
import './today.css';

/** The wait after the last key before a search is sent. */
export const TYPING_PAUSE_MS = 250;

const SearchOpen = createContext<(() => void) | null>(null);

/** The signed-in shell's Search (sc-39534): the sidebar's row opens it, and ⌘K or Ctrl+K opens or closes it from any screen. */
export function ShellSearch({
  organisationId,
  children,
}: {
  organisationId: string | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (organisationId == null) return undefined;

    const keys = (event: globalThis.KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return;

      event.preventDefault();
      setOpen((now) => !now);
    };

    window.addEventListener('keydown', keys);

    return () => window.removeEventListener('keydown', keys);
  }, [organisationId]);

  return (
    <SearchOpen value={organisationId == null ? null : show}>
      {children}
      {open && organisationId != null && (
        <SearchPalette key={organisationId} organisationId={organisationId} onClose={close} />
      )}
    </SearchOpen>
  );
}

/** The sidebar's Search, with the key hint the reader's keyboard has. */
export function SearchRow() {
  const { t } = useTranslation();
  const open = useContext(SearchOpen);
  const hint = useMemo(() => keyHint(browserPlatform()), []);

  if (open == null) return null;

  return (
    <button
      type="button"
      className="today-search"
      aria-keyshortcuts="Meta+K Control+K"
      aria-haspopup="dialog"
      onClick={open}
    >
      <Glyph name="search" size={16} />
      <span className="today-grow">{t('search.row')}</span>
      <kbd className="today-key" aria-hidden="true">
        {hint}
      </kbd>
    </button>
  );
}

function browserPlatform(): string | undefined {
  const agent = navigator as Navigator & { userAgentData?: { platform?: string } };

  return agent.userAgentData?.platform ?? navigator.platform;
}

type Answer =
  | { kind: 'idle' }
  | { kind: 'short' }
  | { kind: 'loading'; term: string }
  | { kind: 'found'; term: string; groups: SearchGroup[] }
  | { kind: 'offline' }
  | { kind: 'failed' };

type Stop = { kind: 'row'; row: Row; group: SearchGroupKey } | { kind: 'more' };

const NO_REACH: SearchReach = { events: false, guests: false, members: false };

const STANDING_MARKS: Record<SearchStanding, MarkKind> = {
  invited: 'waiting',
  pending_approval: 'waiting',
  suspended: 'paused',
};

/** Search as a command palette over the page, as its demo draws it: a WAI-ARIA combobox over a grouped listbox. */
function SearchPalette({
  organisationId,
  onClose,
}: {
  organisationId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dialog = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  useDeskDialog(dialog, field, onClose);
  const id = useId();
  const listId = `${id}-list`;
  const [reach, setReach] = useState<SearchReach | null>(null);
  const [typed, setTyped] = useState('');
  const [answer, setAnswer] = useState<Answer>({ kind: 'idle' });
  const [lit, setLit] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const words = searchFieldKeys(reach ?? NO_REACH);
  const groups = useMemo(() => (answer.kind === 'found' ? answer.groups : []), [answer]);
  const stops = useMemo(
    () =>
      groups.flatMap((group): Stop[] => [
        ...group.rows.map((row): Stop => ({ kind: 'row', row, group: group.key })),
        ...(group.more ? [{ kind: 'more' } as const] : []),
      ]),
    [groups],
  );
  const litAt = Math.min(lit, stops.length - 1);
  const optionId = (index: number) => `${id}-option-${index}`;

  useEffect(() => {
    let current = true;

    api.searchReach(organisationId).then(
      (found) => current && setReach(found),
      () => undefined,
    );

    return () => {
      current = false;
    };
  }, [organisationId]);

  useEffect(() => {
    const asked = typed.trim();
    const stop = new AbortController();
    const wait = window.setTimeout(() => {
      setLit(0);
      if (asked === '') return setAnswer({ kind: 'idle' });
      if (asked.length < SEARCH_LEAST) return setAnswer({ kind: 'short' });

      setAnswer({ kind: 'loading', term: asked });
      api.search(organisationId, asked, stop.signal).then(
        (found) =>
          setAnswer({
            kind: 'found',
            term: asked,
            groups: searchGroups(
              found,
              (key, values) => t(key, values ?? {}),
              serverClock.now(),
              dateLocale(),
            ),
          }),
        (error: unknown) => {
          if (stop.signal.aborted) return;
          const failure = searchFailure(error);
          setAnswer(
            failure === 'refused' ? { kind: 'found', term: asked, groups: [] } : { kind: failure },
          );
        },
      );
    }, TYPING_PAUSE_MS);

    return () => {
      window.clearTimeout(wait);
      stop.abort();
    };
  }, [organisationId, typed, attempt, t]);

  useEffect(() => {
    if (litAt < 0) return;
    document.getElementById(`${id}-option-${litAt}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [id, litAt]);

  function choose(stop: Stop): void {
    onClose();
    if (stop.kind === 'row') void navigate(searchLink(stop.row));
    else if (answer.kind === 'found') void navigate(eventsSearchLink(answer.term));
  }

  function clear(): void {
    setTyped('');
    setAnswer({ kind: 'idle' });
    field.current?.focus();
  }

  function retry(): void {
    setAnswer({ kind: 'loading', term: typed.trim() });
    setAttempt((now) => now + 1);
    field.current?.focus();
  }

  function keys(event: KeyboardEvent<HTMLInputElement>): void {
    const to = searchMoved(litAt, event.key, stops.length);
    if (to != null) {
      event.preventDefault();
      setLit(to);
    } else if (event.key === 'Enter') {
      const stop = stops[litAt];
      if (stop == null) return;
      event.preventDefault();
      choose(stop);
    }
  }

  const said =
    answer.kind === 'loading'
      ? t('search.searching')
      : answer.kind === 'found'
        ? groups.length === 0
          ? t('search.nothing', { term: answer.term })
          : t('search.matches', { count: searchTotal(groups) })
        : answer.kind === 'offline'
          ? t('eventsSearch.searchOff')
          : answer.kind === 'failed'
            ? t('search.failed')
            : '';

  return (
    <>
      <button
        type="button"
        className="dialog-scrim search-scrim"
        tabIndex={-1}
        aria-label={t('search.close')}
        onClick={onClose}
      />
      <div
        ref={dialog}
        className="search-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('search.row')}
      >
        <div className="search-field">
          <Glyph name="search" size={20} />
          <input
            ref={field}
            type="text"
            role="combobox"
            aria-label={t('search.row')}
            placeholder={t(words.placeholder)}
            value={typed}
            autoComplete="off"
            spellCheck={false}
            aria-autocomplete="list"
            aria-expanded={stops.length > 0}
            aria-controls={listId}
            aria-activedescendant={litAt >= 0 ? optionId(litAt) : undefined}
            onChange={(change) => setTyped(change.target.value)}
            onKeyDown={keys}
          />
        </div>
        <div className="search-body">
          {answer.kind === 'idle' && words.hint != null && (
            <p className="search-said">{t(words.hint)}</p>
          )}
          {answer.kind === 'short' && <p className="search-said">{t('search.short')}</p>}
          {answer.kind === 'loading' && (
            <div className="search-bones" aria-hidden="true">
              {[0, 1, 2].map((bone) => (
                <div key={bone} className="skeleton-row skeleton-row-56 search-bone">
                  <span className="skeleton-tile search-lead" />
                  <span className="skeleton-row-bars">
                    <span className="skeleton-bar skeleton-bar-first" />
                    <span className="skeleton-bar skeleton-bar-second" />
                  </span>
                </div>
              ))}
            </div>
          )}
          {answer.kind === 'offline' && (
            <p className="search-said search-nothing">{t('eventsSearch.searchOff')}</p>
          )}
          {answer.kind === 'failed' && (
            <div className="search-said">
              <p className="search-nothing" aria-hidden="true">
                {t('search.failed')}
              </p>
              <TextAction label={t('search.tryAgain')} onClick={retry} />
            </div>
          )}
          {answer.kind === 'found' && groups.length === 0 && (
            <div className="search-said">
              <p className="search-nothing" aria-hidden="true">
                {t('search.nothing', { term: answer.term })}
              </p>
              <TextAction label={t('search.clear')} onClick={clear} />
            </div>
          )}
          <div
            id={listId}
            role="listbox"
            aria-label={t('search.results')}
            className={stops.length > 0 ? 'search-list' : 'search-list is-empty'}
          >
            {groups.map((group) => {
              const heading = t(`search.heading.${group.key}`);

              return (
                <div
                  key={group.key}
                  role="group"
                  aria-label={t('search.headingCount', { heading, count: group.total })}
                  className="search-group"
                >
                  <div className="search-head" aria-hidden="true">
                    {heading}
                    <span className="search-count">{group.total.toLocaleString(dateLocale())}</span>
                  </div>
                  {stops.map((stop, at) =>
                    (stop.kind === 'row' ? stop.group : 'events') !== group.key ? null : (
                      <Option
                        key={stop.kind === 'row' ? stop.row.id : 'more'}
                        id={optionId(at)}
                        stop={stop}
                        lit={at === litAt}
                        onChoose={() => {
                          setLit(at);
                          choose(stop);
                        }}
                      />
                    ),
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <p className="search-keys">{t('search.keys')}</p>
        <p className="visually-hidden" role="status">
          {said}
        </p>
      </div>
    </>
  );
}

function Option({
  id,
  stop,
  lit,
  onChoose,
}: {
  id: string;
  stop: Stop;
  lit: boolean;
  onChoose: () => void;
}) {
  const { t } = useTranslation();
  const row = stop.kind === 'row' ? stop.row : null;
  const kind = row == null ? 'search-more' : 'search-row';
  const standing = row?.kind === 'member' && row.standing != null ? row.standing : null;
  const standingWord = standing == null ? null : t(`search.standing.${standing}`);
  const said =
    row == null ? undefined : [row.name, row.line, standingWord].filter(Boolean).join(', ');

  return (
    <div
      id={id}
      role="option"
      tabIndex={-1}
      aria-selected={lit}
      aria-label={said}
      title={row == null ? undefined : `${row.name}\n${row.line}`}
      className={lit ? `${kind} is-lit` : kind}
      onPointerDown={(pointer) => pointer.preventDefault()}
      onClick={onChoose}
      onKeyDown={(key) => {
        if (key.key === 'Enter') onChoose();
      }}
    >
      {row == null ? (
        t('search.showAll')
      ) : (
        <>
          {row.kind === 'event' ? (
            <span
              className={`today-cover is-${meshFor(row.id)} search-lead search-tile`}
              aria-hidden="true"
            />
          ) : (
            <span className="search-lead search-face" aria-hidden="true">
              {initials(row.name)}
            </span>
          )}
          <span className="search-words" aria-hidden="true">
            <span className="search-name">{row.name}</span>
            <span className="search-line">{row.line}</span>
          </span>
          {standing != null && standingWord != null && (
            <Tag kind={STANDING_MARKS[standing]} word={standingWord} />
          )}
        </>
      )}
    </div>
  );
}
