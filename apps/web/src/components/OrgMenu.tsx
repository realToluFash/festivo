import { type InvitationRefusalCode, initials, refusalBody } from '@soirely/domain';
import {
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { meshFor } from '../mesh.ts';
import { offButton } from '../offButton.ts';
import { useFocusOnceShown } from '../stepFocus.ts';
import { Glyph } from './Glyph.tsx';
import { Notice } from './Notice.tsx';
import { SEARCH_FROM, columnsOf, holds, stepTo } from './orgMenu.ts';
import './orgMenu.css';

const WIDEST = 500;
const EDGE = 12;
const SPARE = 12;

export interface MenuPlace {
  id: string;
  name: string;
  /** The role as it reads, in the shown language. */
  role: string;
}

export type MenuTile =
  | { kind: 'place'; id: string; place: MenuPlace }
  | { kind: 'offer'; id: string; name: string }
  | { kind: 'invitation'; id: string; name: string; role: string | null };

export interface PanelTools {
  /** Focus goes to what the panel's answer lands on, or to the first tile after the places, at the next render. */
  land: (to: 'panel' | 'more') => void;
  show: (id: string | null) => void;
}

/** The switcher's menu of places (OrgSwitcher-B-Places-Web, page 29): the places as tiles, then the offer, the invitations and Create, a panel opening under the tile it answers. */
export function OrgMenu({
  menu,
  anchor,
  places,
  current,
  others,
  start = null,
  into,
  answer,
  onPick,
  onCreate,
}: {
  menu: RefObject<HTMLDivElement | null>;
  anchor: RefObject<HTMLButtonElement | null>;
  places: readonly MenuPlace[];
  /** Null while access to the organisation on screen is paused, when none is current. */
  current: string | null;
  others: readonly MenuTile[];
  start?: { panel: string | null; query: string } | null;
  into: boolean;
  answer: (tile: MenuTile, tools: PanelTools) => ReactNode;
  onPick: (place: MenuPlace) => void;
  onCreate: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [query, setQuery] = useState(start?.query ?? '');
  const [panel, setPanel] = useState<string | null>(start?.panel ?? null);
  const [at, setAt] = useState<number | null>(null);
  const [wide, setWide] = useState(() => window.innerWidth);
  const [scrolled, setScrolled] = useState(false);
  const [heard, setHeard] = useState<{ query: string; words: string } | null>(null);
  const [arrive] = useState(into);
  const [typing] = useState(query !== '');
  const body = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const shown = useRef<HTMLDivElement>(null);
  const options = useRef<(HTMLDivElement | null)[]>([]);

  const searchable = places.length > SEARCH_FROM;
  const typed = searchable ? query : '';
  const listed = places.filter((place) => holds(place.name, typed));
  const tiles: MenuTile[] = [
    ...listed.map((place): MenuTile => ({ kind: 'place', id: place.id, place })),
    ...others.filter((tile) => tile.kind !== 'place' && holds(tile.name, typed)),
  ];
  const found = tiles.length;
  const nothing = typed.trim() !== '' && found === 0;
  const across = columnsOf(Math.min(WIDEST, wide - 2 * EDGE) - 2 - 2 * EDGE);
  const chosen = listed.findIndex((place) => place.id === current);
  const roving = Math.min(at ?? Math.max(0, chosen), Math.max(0, listed.length - 1));
  const opened = panel == null ? -1 : tiles.findIndex((tile) => tile.id === panel);
  const rowEnd =
    opened < 0 ? -1 : Math.min(Math.floor(opened / across) * across + across - 1, tiles.length);
  const panelAfter = opened < 0 ? null : Math.max(rowEnd, listed.length - 1) - listed.length;
  const said = heard != null && heard.query === typed && typed.trim() !== '' ? heard.words : '';

  const landOn = useFocusOnceShown();
  const tools = useMemo<PanelTools>(
    () => ({
      land: (to) =>
        landOn(() =>
          document.querySelector<HTMLElement>(
            to === 'panel' ? `[id="${id}-panel"] [data-lands]` : `[id="${id}-more"] > .sw-cell`,
          ),
        ),
      show: setPanel,
    }),
    [landOn, id],
  );

  useLayoutEffect(() => {
    const drop = menu.current;
    const opener = anchor.current;
    if (drop == null || opener == null) return;

    const place = (): void => {
      const box = opener.getBoundingClientRect();
      const top = box.bottom + 8;
      const left = Math.max(EDGE, Math.min(box.left, window.innerWidth - EDGE - drop.offsetWidth));
      drop.style.setProperty('top', `${top}px`);
      drop.style.setProperty('left', `${left}px`);
      drop.style.setProperty('max-height', `${Math.max(0, window.innerHeight - top - EDGE)}px`);
    };
    const resize = (): void => {
      setWide(window.innerWidth);
      place();
    };

    place();
    const watch = typeof ResizeObserver === 'function' ? new ResizeObserver(place) : null;
    watch?.observe(opener);
    window.addEventListener('resize', resize);

    return () => {
      watch?.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [anchor, menu]);

  useLayoutEffect(() => {
    const scroller = body.current;
    if (scroller == null) return;

    const bar = scroller.offsetWidth - scroller.clientWidth;
    scroller.style.setProperty('padding-right', `${Math.max(0, EDGE - bar)}px`);
  });

  useLayoutEffect(() => {
    const lit = body.current?.querySelector<HTMLElement>('[role="option"][tabindex="0"]');
    if (lit == null || body.current == null) return;

    reveal(body.current, lit);
    if (arrive) lit.focus();
  }, [arrive]);

  useLayoutEffect(() => {
    if (typing) field.current?.focus();
  }, [typing]);

  useLayoutEffect(() => {
    const box = shown.current;
    if (box == null) return;

    box.style.setProperty('--swCols', String(across));
    box.style.setProperty('--swCol', String(opened % across));
    if (body.current != null) reveal(body.current, box);
  }, [panel, opened, across]);

  useEffect(() => {
    if (!searchable || typed.trim() === '') return;

    const timer = window.setTimeout(
      () => setHeard({ query: typed, words: t('switcher.matches', { count: found }) }),
      500,
    );

    return () => window.clearTimeout(timer);
  }, [searchable, typed, found, t]);

  function clear(): void {
    setQuery('');
    setPanel(null);
    field.current?.focus();
  }

  function onOption(event: KeyboardEvent<HTMLDivElement>, index: number): void {
    const place = listed[index];
    if (place != null && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onPick(place);

      return;
    }

    const next = stepTo(event.key, index, listed.length, across);
    if (next == null) return;

    event.preventDefault();
    setAt(next);
    options.current[next]?.focus();
  }

  const openTile = opened < 0 ? undefined : tiles[opened];
  const panelNode =
    openTile == null ? null : (
      <div
        ref={shown}
        key={`panel-${panel}`}
        id={`${id}-panel`}
        role="group"
        aria-label={
          openTile.kind === 'offer'
            ? t('domainJoining.usesSoirely', { organisation: openTile.name })
            : openTile.kind === 'place'
              ? openTile.place.name
              : openTile.name
        }
        className="sw-panel"
      >
        {answer(openTile, tools)}
      </div>
    );

  const more: ReactNode[] = tiles.slice(listed.length).map((tile) => {
    if (tile.kind === 'place') return null;

    const open = tile.id === panel;
    const line =
      tile.kind === 'offer'
        ? t('switcher.canAsk')
        : tile.role == null
          ? t('invitations.fromNobodyNoRole')
          : t('invitations.fromNobody', { role: tile.role });

    return (
      <button
        key={tile.id}
        type="button"
        className={open ? 'sw-cell is-open' : 'sw-cell'}
        aria-label={t('switcher.option', { name: tile.name, line })}
        aria-expanded={open}
        aria-controls={open ? `${id}-panel` : undefined}
        onClick={() => setPanel((now) => (now === tile.id ? null : tile.id))}
      >
        <span className="sw-mark" aria-hidden="true">
          <span className="sw-tile is-dashed">{initials(tile.name)}</span>
          {tile.kind === 'invitation' ? (
            <span className="sw-badge is-invite">
              <span className="sw-ring is-small" />
            </span>
          ) : (
            <span className="sw-badge is-offer">
              <Glyph name="plus" size={12} weight={2.6} />
            </span>
          )}
        </span>
        <span className="sw-name">{tile.name}</span>
        <span className={tile.kind === 'invitation' ? 'sw-line is-invite' : 'sw-line'}>{line}</span>
      </button>
    );
  });
  more.push(
    <button key="create" type="button" className="sw-cell is-create" onClick={onCreate}>
      <span className="sw-mark" aria-hidden="true">
        <span className="sw-tile is-create">
          <Glyph name="plus" size={20} weight={2.4} />
        </span>
      </span>
      <span className="sw-name">{t('createOrganisation.row')}</span>
    </button>,
  );
  if (panelAfter != null) more.splice(panelAfter + 1, 0, panelNode);

  return (
    <div ref={menu} className="sw-menu">
      <div className={scrolled ? 'sw-head is-scrolled' : 'sw-head'}>
        <h2 className="sw-asks">{t('switcher.asks')}</h2>
        {searchable && (
          <div className="sw-search">
            <Glyph name="search" size={18} weight={2.2} />
            <input
              ref={field}
              type="search"
              aria-label={t('switcher.search')}
              placeholder={t('switcher.search')}
              value={query}
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => {
                setQuery(event.target.value);
                setPanel(null);
                setAt(0);
              }}
            />
            {query !== '' && (
              <button
                type="button"
                className="sw-clear"
                aria-label={t('switcher.clearSearch')}
                onClick={clear}
              >
                <span className="sw-clear-disc" aria-hidden="true">
                  <Glyph name="clear" size={11} weight={3} />
                </span>
              </button>
            )}
          </div>
        )}
      </div>
      <div
        ref={body}
        className="sw-body"
        onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 0)}
      >
        {nothing && (
          <div className="sw-none">
            <p>{t('switcher.noMatch', { query: typed.trim() })}</p>
            <button type="button" className="sw-clear-words" onClick={clear}>
              {t('switcher.clearSearch')}
            </button>
          </div>
        )}
        <div className="sw-grid">
          {listed.length > 0 && (
            <div role="listbox" aria-label={t('switcher.heading')} className="sw-list">
              {listed.map((place, index) => {
                const isCurrent = index === chosen;
                const line = t('switcher.yourRole', { role: place.role });

                return (
                  <div
                    key={place.id}
                    ref={(node) => {
                      options.current[index] = node;
                    }}
                    role="option"
                    aria-selected={isCurrent}
                    aria-label={t(isCurrent ? 'switcher.optionCurrent' : 'switcher.option', {
                      name: place.name,
                      line,
                    })}
                    tabIndex={index === roving ? 0 : -1}
                    className={isCurrent ? 'sw-cell is-current' : 'sw-cell'}
                    onClick={() => onPick(place)}
                    onKeyDown={(event) => onOption(event, index)}
                    onFocus={() => setAt(index)}
                  >
                    <span className="sw-mark" aria-hidden="true">
                      <span className={`sw-tile today-cover is-${meshFor(place.id)}`}>
                        {initials(place.name)}
                      </span>
                      {isCurrent && (
                        <span className="sw-badge is-tick">
                          <Glyph name="tick" size={11} weight={3.2} />
                        </span>
                      )}
                    </span>
                    <span className="sw-name">{place.name}</span>
                    <span className="sw-line">{line}</span>
                    {isCurrent && <span className="sw-current">{t('switcher.current')}</span>}
                  </div>
                );
              })}
            </div>
          )}
          <div id={`${id}-more`} className="sw-more">
            {more}
          </div>
        </div>
        <p className="sw-note">{t('switcher.remembered')}</p>
      </div>
      <p className="visually-hidden" role="status">
        {said}
      </p>
    </div>
  );
}

function reveal(scroller: HTMLElement, element: HTMLElement): void {
  const box = element.getBoundingClientRect();
  const view = scroller.getBoundingClientRect();
  const above = view.top - (box.top - SPARE);
  const below = box.bottom + SPARE - view.bottom;

  if (above > 0) scroller.scrollTop -= above;
  else if (below > 0) scroller.scrollTop += Math.min(below, box.top - SPARE - view.top);
}

export function JoinedAnswer({
  name,
  role,
  onOpen,
}: {
  name: string;
  role: string;
  onOpen: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <Notice kind="done" lands>
        {t('invitations.joined', { organisation: name, role })}
      </Notice>
      <button type="button" className="sw-button is-primary is-whole" onClick={onOpen}>
        {t('invitations.open', { organisation: name })}
      </button>
    </>
  );
}

export function InvitationAnswer({
  name,
  line,
  until,
  children,
}: {
  name: string;
  line: string;
  until: string;
  children: ReactNode;
}) {
  return (
    <>
      <p className="sw-panel-title">{name}</p>
      <div className="sw-panel-lines">
        <p>{line}</p>
        <p className="sw-until">{until}</p>
      </div>
      {children}
    </>
  );
}

/** Accept and join, or Decline, with what declining tells; the pressed one holds while it is sent. */
export function InvitationActions({
  name,
  note,
  failed,
  busy = null,
  onAccept,
  onDecline,
}: {
  name: string;
  note: string;
  failed: boolean;
  busy?: 'accept' | 'decline' | null;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      {failed && <Notice kind="broken">{t('invitations.failed')}</Notice>}
      <div className={failed ? 'sw-actions is-close' : 'sw-actions'}>
        <button
          type="button"
          className="sw-button is-primary"
          aria-label={t('invitations.acceptLabel', { organisation: name })}
          aria-busy={busy === 'accept' || undefined}
          {...offButton(busy != null, { dim: busy === 'decline' })}
          onClick={onAccept}
        >
          {busy === 'accept' ? t('invitations.joining') : t('invitations.accept')}
        </button>
        <button
          type="button"
          className="sw-button is-ghost"
          aria-label={t('invitations.declineLabel', { organisation: name })}
          aria-busy={busy === 'decline' || undefined}
          {...offButton(busy != null, { dim: busy === 'accept' })}
          onClick={onDecline}
        >
          {busy === 'decline' ? t('invitations.declining') : t('invitations.decline')}
        </button>
      </div>
      <p className="sw-panel-note">{note}</p>
    </>
  );
}

/** Why the answer was refused: an expired invitation asks for attention, a withdrawn one is quiet. */
export function RefusalAnswer({
  refusal,
  inviter,
  organisation,
  email,
  signedInAs,
}: {
  refusal: InvitationRefusalCode;
  inviter: string | null;
  organisation: string;
  email: string;
  signedInAs: string;
}) {
  const { t } = useTranslation();

  return (
    <Notice kind={refusal === 'invitation_expired' ? 'attention' : 'quiet'} lands>
      <strong>{t(`invitations.refused.${refusal}.word`)}</strong>{' '}
      {t(refusalBody(refusal, inviter != null), {
        inviter: inviter ?? '',
        organisation,
        email,
        signedInAs,
      })}
    </Notice>
  );
}

export type OfferStanding = 'unasked' | 'asked' | 'unavailable';

/** An organisation at the domain of the primary address: Ask to join, or Not now. */
export function OfferAnswer({
  name,
  domain,
  email,
  standing,
  askedHere,
  busy = false,
  onAsk,
  onNotNow,
}: {
  name: string;
  domain: string;
  email: string;
  standing: OfferStanding;
  /** Asked from this panel, so focus lands on the line rather than it being announced. */
  askedHere: boolean;
  busy?: boolean;
  onAsk: () => void;
  onNotNow: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <p className="sw-panel-title">{t('domainJoining.usesSoirely', { organisation: name })}</p>
      <p className="sw-panel-body">{t('domainJoining.switcherBody', { domain })}</p>
      {standing === 'asked' ? (
        <p
          className="sw-asked sw-lands"
          role={askedHere ? undefined : 'status'}
          tabIndex={-1}
          data-lands={askedHere ? '' : undefined}
        >
          <span className="sw-ring is-asked" aria-hidden="true" />
          <span>
            <strong>{t('domainJoining.waiting')}</strong>
            {' · '}
            {t('domainJoining.switcherAsked', { email })}
          </span>
        </p>
      ) : (
        <>
          {standing === 'unavailable' && (
            <p className="sw-refused sw-lands" role="alert" tabIndex={-1} data-lands>
              {t('domainJoining.unavailable')}
            </p>
          )}
          <div className={standing === 'unavailable' ? 'sw-actions is-close' : 'sw-actions'}>
            <button
              type="button"
              className="sw-button is-primary"
              aria-label={t('domainJoining.askLabel', { organisation: name })}
              aria-busy={busy || undefined}
              {...offButton(busy, { dim: false })}
              onClick={onAsk}
            >
              {t('domainJoining.ask')}
            </button>
            <button
              type="button"
              className="sw-button is-ghost"
              {...offButton(busy)}
              onClick={onNotNow}
            >
              {t('domainJoining.notNow')}
            </button>
          </div>
        </>
      )}
    </>
  );
}
