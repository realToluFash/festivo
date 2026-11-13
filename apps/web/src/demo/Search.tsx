import { initials } from '@soirely/domain';
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
import { useNavigate } from 'react-router';

import { Glyph } from '../components/Glyph.tsx';
import { Tag, type Tell, TextAction } from '../components/SettingsParts.tsx';
import { useDeskDialog } from '../layers.ts';
import { sampleEvent } from './events.ts';
import { hasGuests } from './guests.ts';
import {
  type Found,
  type Phase,
  REACHES,
  type Reach,
  SEARCH_WORDS as W,
  type Standing,
  type SearchStart,
  type Stop,
  TYPING_PAUSE_MS,
  browserPlatform,
  eventName,
  groupsFor,
  keyHint,
  moved,
  phaseOf,
  saidOf,
  searchStart,
  stopsOf,
} from './search.ts';
import './search.css';

const SearchOpen = createContext<(() => void) | null>(null);

/** The palette a page holds: opened by the sidebar's row, and opened or closed by ⌘K or Ctrl+K anywhere on it. */
function useDeskSearch(
  first: SearchStart | null,
  reach: Reach,
): {
  shown: SearchStart | null;
  open: () => void;
  close: () => void;
} {
  const [shown, setShown] = useState<SearchStart | null>(first);
  const fresh = useCallback(() => searchStart(null, reach), [reach]);
  const open = useCallback(() => setShown((now) => now ?? fresh()), [fresh]);
  const close = useCallback(() => setShown(null), []);

  useEffect(() => {
    const keys = (event: globalThis.KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return;

      event.preventDefault();
      setShown((now) => (now == null ? fresh() : null));
    };

    window.addEventListener('keydown', keys);

    return () => window.removeEventListener('keydown', keys);
  }, [fresh]);

  return { shown, open, close };
}

/** A page's search: the palette over it while open, and the opener its sidebar's row reaches. `reach` is what the person looking may find. */
export function DeskSearch({
  first = null,
  reach = REACHES.owner,
  tell,
  children,
}: {
  first?: SearchStart | null;
  reach?: Reach;
  tell: Tell;
  children: ReactNode;
}) {
  const { shown, open, close } = useDeskSearch(first, reach);

  return (
    <SearchOpen value={open}>
      {children}
      {shown != null && <SearchPalette start={shown} tell={tell} onClose={close} />}
    </SearchOpen>
  );
}

/** The sidebar's Search, with the key hint the reader's keyboard has. */
export function SearchRow() {
  const open = useContext(SearchOpen);
  const hint = useMemo(() => keyHint(browserPlatform()), []);

  return (
    <button
      type="button"
      className="today-search"
      aria-keyshortcuts="Meta+K Control+K"
      aria-haspopup="dialog"
      onClick={() => open?.()}
    >
      <Glyph name="search" size={16} />
      <span className="today-grow">{W.search}</span>
      <kbd className="today-key" aria-hidden="true">
        {hint}
      </kbd>
    </button>
  );
}

/** Search as a command palette over the page (sc-39534, direction A). */
export function SearchPalette({
  start,
  tell,
  onClose,
}: {
  start: SearchStart;
  tell: Tell;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const dialog = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  useDeskDialog(dialog, field, onClose);
  const id = useId();
  const listId = `${id}-list`;
  const [typed, setTyped] = useState(start.term);
  const [term, setTerm] = useState(start.term);
  const [phase, setPhase] = useState<Phase>(start.phase);
  const [lit, setLit] = useState(0);
  const groups = useMemo(
    () => (phase === 'found' ? groupsFor(term, start.reach) : []),
    [phase, term, start.reach],
  );
  const stops = useMemo(() => stopsOf(groups), [groups]);
  const hint = W.idle(start.reach);
  const litAt = Math.min(lit, stops.length - 1);
  const optionId = (index: number) => `${id}-option-${index}`;

  useEffect(() => {
    if (typed === term) return undefined;

    const wait = window.setTimeout(() => {
      setTerm(typed);
      setPhase(phaseOf(typed));
      setLit(0);
    }, TYPING_PAUSE_MS);

    return () => window.clearTimeout(wait);
  }, [typed, term]);

  useEffect(() => {
    if (litAt < 0) return;
    document.getElementById(`${id}-option-${litAt}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [id, litAt]);

  function go(row: Found): void {
    onClose();
    if (row.kind === 'event') {
      if (sampleEvent(row.id) != null) void navigate(`/demo/events/${row.id}`);
      else tell(`${row.name} has its own design.`);
    } else if (row.kind === 'guest') {
      if (row.guest != null) void navigate(`/demo/guests?event=${row.event}&guest=${row.guest}`);
      else if (hasGuests(row.event)) void navigate(`/demo/guests?event=${row.event}`);
      else tell(W.ownDesign(eventName(row.event)));
    } else void navigate('/demo/settings/members');
  }

  function choose(stop: Stop): void {
    if (stop.kind === 'more') {
      onClose();
      void navigate(`/demo/events?q=${encodeURIComponent(term.trim())}`);
    } else go(stop.row);
  }

  function clear(): void {
    setTyped('');
    setTerm('');
    setPhase('idle');
    setLit(0);
    field.current?.focus();
  }

  function keys(event: KeyboardEvent<HTMLInputElement>): void {
    const to = moved(litAt, event.key, stops.length);
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

  const said = phase === 'loading' ? W.searching : phase === 'found' ? saidOf(term, groups) : '';

  return (
    <>
      <button
        type="button"
        className="dialog-scrim search-scrim"
        tabIndex={-1}
        aria-label="Close"
        onClick={onClose}
      />
      <div
        ref={dialog}
        className="search-panel"
        role="dialog"
        aria-modal="true"
        aria-label={W.search}
      >
        <div className="search-field">
          <Glyph name="search" size={20} />
          <input
            ref={field}
            type="text"
            role="combobox"
            aria-label={W.search}
            placeholder={W.placeholder(start.reach)}
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
          {phase === 'idle' && hint != null && <p className="search-said">{hint}</p>}
          {phase === 'short' && <p className="search-said">{W.short}</p>}
          {phase === 'loading' && (
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
          {phase === 'offline' && <p className="search-said search-nothing">{W.offline}</p>}
          {phase === 'found' && groups.length === 0 && (
            <div className="search-said">
              <p className="search-nothing" aria-hidden="true">
                {W.nothing(term.trim())}
              </p>
              <TextAction label={W.clear} onClick={clear} />
            </div>
          )}
          <div
            id={listId}
            role="listbox"
            aria-label={W.results}
            className={stops.length > 0 ? 'search-list' : 'search-list is-empty'}
          >
            {groups.map((group) => {
              const shown = stops.filter((stop) => stop.group === group.key);

              return (
                <div
                  key={group.key}
                  role="group"
                  aria-labelledby={`${id}-${group.key}`}
                  className="search-group"
                >
                  <div id={`${id}-${group.key}`} className="search-head" aria-hidden="true">
                    {group.heading}
                    <span className="search-count">{group.rows.length}</span>
                  </div>
                  {shown.map((stop) => {
                    const at = stops.indexOf(stop);

                    return (
                      <Option
                        key={stop.kind === 'row' ? stop.row.id : `${group.key}-more`}
                        id={optionId(at)}
                        stop={stop}
                        lit={at === litAt}
                        onChoose={() => {
                          setLit(at);
                          choose(stop);
                        }}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        <p className="search-keys">{W.keys}</p>
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
  const row = stop.kind === 'row' ? stop.row : null;
  const kind = row == null ? 'search-more' : 'search-row';
  const standing = row?.kind === 'member' ? row.standing : null;
  const said = row == null ? undefined : [row.name, row.line, standing].filter(Boolean).join(', ');

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
        W.showAll
      ) : (
        <>
          {row.kind === 'event' ? (
            <span
              className={`today-cover is-${row.mesh} search-lead search-tile`}
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
          {standing != null && <Tag kind={STANDING_MARKS[standing]} word={standing} />}
        </>
      )}
    </div>
  );
}

const STANDING_MARKS: Record<Standing, 'waiting' | 'paused'> = {
  Invited: 'waiting',
  'Awaiting approval': 'waiting',
  Suspended: 'paused',
};
