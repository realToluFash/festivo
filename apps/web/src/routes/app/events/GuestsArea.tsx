import {
  ApiError,
  GUEST_NAME_MAXIMUM,
  type GroupChoice,
  type Guest,
  type GuestInvitationHow,
  type GuestDetails,
  type GuestGroup,
  type GuestList,
  type OrganisationEvent,
  GUESTS_TOGETHER_MOST,
  asGuestList,
  realtimeTopic,
} from '@soirely/api-client';
import {
  CHOICES,
  type Choice,
  type Counts,
  MOST_COMPANIONS,
  type Problem,
  type Problems,
  REPLY_KEY,
  type Standing,
  type Typed,
  type ViewRow,
  countsOf,
  deviceCountry,
  dietary,
  eventAllows,
  firstProblem,
  invitationLine,
  isListed,
  makeLiveRow,
  newGuestOf,
  phoneScreenCountry,
  problemsOf,
  rowWords,
  shownPhase,
  shownReply,
  viewOf,
  violationProblems,
  withGuest as listedWith,
  withGuestAt,
  withoutGuest,
  companionShown,
  listFormat,
  NO_NEEDS,
  type NeedsProblems,
  type NeedsTyped,
  firstNeedsFailing,
  hasAllergy,
  needsFailingCount,
  needsInputOf,
  needsViolations,
  problemsByWho,
} from '@soirely/domain';
import {
  type ReactNode,
  type RefObject,
  memo,
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { type TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Link, useBlocker, useNavigate, useSearchParams } from 'react-router';

import { api } from '../../../api.ts';
import { GlassMark } from '../../../components/EventCard.tsx';
import { Glyph } from '../../../components/Glyph.tsx';
import { SearchField } from '../../../components/SearchField.tsx';
import {
  Ask,
  CardStep,
  Chevron,
  Menu,
  RowWords,
  TextAction,
} from '../../../components/SettingsParts.tsx';
import { Toast } from '../../../components/Toast.tsx';
import { currentLocale, dateLocale } from '../../../i18n/index.ts';
import { LayersContext, focusWhenFree, useDeskLayers } from '../../../layers.ts';
import { type Mesh, meshFor } from '../../../mesh.ts';
import { pageTitle, usePageTitle } from '../../../pageTitle.ts';
import { phoneProblemMessage } from '../../../phoneProblem.ts';
import { useLoadedAt, useServerNow } from '../../../serverNow.ts';
import { canOn, useSession } from '../../../session.ts';
import { useMakeLive } from './MakeLive.tsx';
import { inPlace } from './openInPlace.ts';
import { GroupChips, GroupField, GroupTag, GroupsColumn } from './GuestGroups.tsx';
import {
  GroupSheet,
  MarkMany,
  RemoveMany,
  ResultLine,
  SelectBar,
  SelectedSaid,
} from './GuestSelect.tsx';
import {
  type Action,
  type Line,
  type MarkQuestion,
  companionsWith,
  markQuestion,
  onlyCompanions,
  removeQuestion,
  shownGuests,
} from './guestSelect.ts';
import { choiceLine, groupRefusal, listOpen, refusedLine } from './guestGroups.ts';
import { GuestColumn, ReplyMark, guestAddress } from './GuestColumn.tsx';
import {
  CompanionField,
  GuestField,
  LanguageField,
  PhoneField,
  PlacesStepper,
} from './GuestFields.tsx';
import {
  AllergyMark,
  type CompanionNeeds,
  CompanionNeedsSection,
  NeedsRefused,
  NeedsSection,
} from './GuestNeeds.tsx';
import { useNeedsOpen } from './guestNeeds.ts';
import { useGuestsAddress } from './useGuestsAddress.ts';
import { useHubTopics } from './useHubTopics.ts';
import { keepAsked, keptAsked } from './whatsAppSend.ts';
import '../../../components/desk.css';
import '../../../components/SettingsParts.css';
import '../../../components/EventsSearch.css';
import '../../../components/eventsDesk.css';
import '../../../components/EventsList.css';
import '../../../components/eventPage.css';
import './guests.css';

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; list: GuestList };

const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]';

/** The guest list as the API holds it, published to every page open on it. */
function useLiveGuests(eventId: string, onList: (list: GuestList) => void, onGap: () => void) {
  useHubTopics(
    [realtimeTopic('EventGuests', eventId)],
    () => api.guestsSubscription(eventId),
    (data) => {
      const list = asGuestList(data);
      if (list == null) onGap();
      else onList(list);
    },
    onGap,
  );
}

/** The code the Mobile number starts on, as the account's own Mobile number field picks it. */
function useStartingCountry(asks: boolean): string {
  const session = useSession();
  const [numbers, setNumbers] = useState<
    readonly { primary: boolean; countryCode: string | null }[]
  >([]);

  useEffect(() => {
    if (!asks) return;
    let current = true;

    api.me().then(
      (me) => current && setNumbers(me.phoneNumbers),
      () => undefined,
    );

    return () => {
      current = false;
    };
  }, [asks]);

  return phoneScreenCountry(
    { organisationCountry: session.organisationCountry ?? null, phoneNumbers: numbers },
    deviceCountry(navigator.languages),
  );
}

/** Focus asked for by `data-focus` key, given once the next render has drawn it. */
function useFocusKeys(root: RefObject<HTMLElement | null>) {
  const pending = useRef<{ keys: string[]; turn: number } | null>(null);
  const asked = useRef(0);
  const [committedTurn, commitTurn] = useReducer((_: number, turn: number) => turn, 0);

  useEffect(() => {
    if (pending.current == null || pending.current.turn !== committedTurn) return;
    const { keys, turn } = pending.current;

    pending.current = null;

    // A request still retrying for its target must not take the focus from a later one.
    focusWhenFree(() => {
      if (turn !== asked.current) return null;
      for (const key of keys) {
        const at = root.current?.querySelector<HTMLElement>(`[data-focus="${key}"]`);

        if (at == null) continue;

        return at.matches(FOCUSABLE) ? at : at.querySelector<HTMLElement>(FOCUSABLE);
      }

      return null;
    });
  });

  return useCallback((...keys: string[]) => {
    const turn = ++asked.current;

    pending.current = { keys, turn };
    commitTurn(turn);
  }, []);
}

/** A deleted event's Guests answers as an event that never existed does, its heading focused (sc-1468). */
export function GuestsGone({ heading }: { heading: RefObject<HTMLHeadingElement | null> }) {
  const { t } = useTranslation();

  usePageTitle(pageTitle(t, [t('eventPage.notFound')]));
  useEffect(() => heading.current?.focus(), [heading]);

  return (
    <div className="desk ev gs">
      <div className="ev-wide gs-page">
        <header className="gs-top">
          <h1 ref={heading} className="gs-title" tabIndex={-1}>
            {t('eventPage.notFound')}
          </h1>
        </header>
      </div>
    </div>
  );
}

const NO_GUESTS: GuestList['guests'] = [];

const NONE: ReadonlySet<string> = new Set();

export function GuestsArea({
  event,
  tag,
  heading,
  onChange,
}: {
  event: OrganisationEvent;
  tag: string;
  heading: RefObject<HTMLHeadingElement | null>;
  onChange: (event: OrganisationEvent, tag: string) => void;
}) {
  const { t } = useTranslation();
  const { layers, covered, setHost } = useDeskLayers();
  const now = useServerNow();
  const phase = shownPhase(event, useLoadedAt(event), now);
  const invites = eventAllows(phase, 'invite');
  const root = useRef<HTMLDivElement>(null);
  const focus = useFocusKeys(root);
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [heard, setHeard] = useState(0);
  const [flagged, setFlagged] = useState<ReadonlySet<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [params, setParams] = useSearchParams();
  const open = adding ? null : params.get('guest');
  const [counted, setCounted] = useState<Counts | 'failed' | null>(null);
  const [recount, setRecount] = useState(0);
  const { choice, q, setChoice, setQ, clear } = useGuestsAddress();
  const [dietaryOnly, setDietary] = useState(false);
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [grouping, setGrouping] = useState(false);
  const [menu, setMenu] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<Standing>>(new Set());
  const [stamp, setStamp] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [asking, setAsking] = useState<(() => void) | null>(null);
  const [saved, setSaved] = useState(false);
  const [removed, setRemoved] = useState<{ guest: Guest; at: number } | null>(null);
  const [backOnList, setBackOnList] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(NONE);
  const [selectionCleared, setSelectionCleared] = useState(false);
  const [sheet, setSheet] = useState<{ refused: string | null } | null>(null);
  const [removing, setRemoving] = useState<{ busy: boolean } | null>(null);
  // The guests selected as the dialog opened: one removed meanwhile is still sent, so the line counts it (sc-46880).
  const [marking, setMarking] = useState<{ ids: string[]; asked: MarkQuestion } | null>(null);
  const [notLiveAt, setNotLiveAt] = useState<string | null>(null);
  const [line, setLine] = useState<Line | null>(null);
  const [removal, setRemoval] = useState<string | null>(null);
  const [asked, setAsked] = useState<ReadonlySet<string>>(() =>
    invites ? keptAsked(event.id) : new Set(),
  );
  const lastRow = useRef<string | null>(open);
  const addAfter = useRef(false);
  const groupsAfter = useRef(false);
  const headingOwed = useRef(false);
  const column = useRef<HTMLElement>(null);
  const manages = canOn(event, 'guests.manage');
  const country = useStartingCountry(manages);
  const away = useBlocker(dirty);
  const navigate = useNavigate();
  const opener = useRef<HTMLButtonElement>(null);
  const makeLive = useMakeLive({
    event,
    tag,
    heading,
    opener,
    onChange,
    onMadeLive: () => undefined,
  });

  useEffect(() => {
    if (!dirty) return;

    const ask = (leaving: BeforeUnloadEvent): void => leaving.preventDefault();
    window.addEventListener('beforeunload', ask);

    return () => window.removeEventListener('beforeunload', ask);
  }, [dirty]);

  useEffect(() => {
    if (open != null) lastRow.current = open;
  }, [open]);

  usePageTitle(pageTitle(t, [t('eventPage.guests'), event.name]));

  const erasing = removed?.guest.id ?? null;

  // Leaving the page ends the undo as running out would (sc-3774).
  useEffect(() => {
    if (erasing == null) return;
    const erase = (): void => void api.eraseGuest(event.id, erasing).catch(() => undefined);

    window.addEventListener('pagehide', erase);

    return () => window.removeEventListener('pagehide', erase);
  }, [event.id, erasing]);

  // The same for many guests' one Undo (sc-3776).
  useEffect(() => {
    if (removal == null) return;
    const erase = (): void => void api.eraseGuestsRemoval(event.id, removal).catch(() => undefined);

    window.addEventListener('pagehide', erase);

    return () => window.removeEventListener('pagehide', erase);
  }, [event.id, removal]);

  const unmounting = useRef<{ eventId: string; id: string | null; removal: string | null }>({
    eventId: event.id,
    id: null,
    removal: null,
  });

  useEffect(() => {
    unmounting.current = { eventId: event.id, id: erasing, removal };
  });

  useEffect(
    () => () => {
      const { eventId, id, removal: many } = unmounting.current;

      if (id != null) void api.eraseGuest(eventId, id).catch(() => undefined);
      if (many != null) void api.eraseGuestsRemoval(eventId, many).catch(() => undefined);
    },
    [],
  );

  useEffect(() => {
    let current = true;

    api.guests(event.id).then(
      (list) => current && setLoad({ kind: 'loaded', list }),
      () => current && setLoad((was) => (was.kind === 'loaded' ? was : { kind: 'failed' })),
    );

    return () => {
      current = false;
    };
  }, [event.id, attempt]);

  useEffect(() => {
    let current = true;

    api.headcount(event.id).then(
      (headcount) => current && setCounted(countsOf(headcount.counts)),
      () => current && setCounted((was) => (was == null ? 'failed' : was)),
    );

    return () => {
      current = false;
    };
  }, [event.id, attempt, recount]);

  useEffect(() => {
    let current = true;

    if (manages) {
      api.flaggedGuests(event.id).then(
        (ids) => current && setFlagged(new Set(ids)),
        () => undefined,
      );
    }

    return () => {
      current = false;
    };
  }, [event.id, manages, attempt, heard]);

  useLiveGuests(
    event.id,
    (list) => {
      setStamp((n) => n + 1);
      setHeard((n) => n + 1);
      setRecount((n) => n + 1);
      if (manages) setAttempt((n) => n + 1);
      else setLoad({ kind: 'loaded', list });
    },
    () => setAttempt((n) => n + 1),
  );

  function withGuest(id: string | null) {
    return (was: URLSearchParams) => {
      const at = new URLSearchParams(was);

      if (id == null) at.delete('guest');
      else at.set('guest', id);

      return at;
    };
  }

  function startAdd(): void {
    if (dirty) {
      addAfter.current = true;
      setParams(withGuest(null), { replace: true });
      return;
    }
    if (open != null) setParams(withGuest(null), { replace: true });
    showAdd();
  }

  function showAdd(): void {
    setGrouping(false);
    setAdding(true);
    focus('fullName');
  }

  function openGroups(): void {
    if (dirty) {
      groupsAfter.current = true;
      setParams(withGuest(null), { replace: true });
      return;
    }
    if (open != null) setParams(withGuest(null), { replace: true });
    showGroups();
  }

  function showGroups(): void {
    setAdding(false);
    setGrouping(true);
    setAttempt((n) => n + 1);
    focus('form-heading');
  }

  function closeGroups(): void {
    setGrouping(false);
    focus('groups', 'title');
  }

  function openGuest(id: string): void {
    setAdding(false);
    setGrouping(false);
    setParams(withGuest(id));
    headingOwed.current = id !== open;
    focus('guest-heading');
  }

  function close(): void {
    setParams(withGuest(null));
    focus(`row:${lastRow.current ?? ''}`, 'title');
  }

  const onEscape = useEffectEvent((key: globalThis.KeyboardEvent) => {
    if (key.key !== 'Escape' || key.defaultPrevented || adding || listOpen(key)) return;
    if (grouping) {
      if (key.target instanceof Element && key.target.closest('.gg-rename') != null) return;
      key.preventDefault();
      closeGroups();
      return;
    }
    if (open == null || dirty) return;
    key.preventDefault();
    close();
  });

  useEffect(() => {
    const at = column.current;
    const listen = (key: globalThis.KeyboardEvent) => onEscape(key);

    at?.addEventListener('keydown', listen);

    return () => at?.removeEventListener('keydown', listen);
  });

  function changed(guest: GuestDetails): void {
    setRecount((n) => n + 1);
    setLoad((was) =>
      was.kind === 'loaded'
        ? {
            kind: 'loaded',
            list: {
              ...was.list,
              guests: was.list.guests.map((one) => (one.id === guest.id ? guest : one)),
            },
          }
        : was,
    );
  }

  /** Off the list at once, with Undo open; a guest still inside an earlier undo is erased now, since only one message shows. */
  async function remove(gone: GuestDetails): Promise<void> {
    await api.removeGuest(event.id, gone.id);
    if (removed != null) void api.eraseGuest(event.id, removed.guest.id).catch(() => undefined);
    const at = guests.findIndex((one) => one.id === gone.id);
    const row = guests[at] ?? gone;

    setLoad((was) =>
      was.kind === 'loaded' ? { kind: 'loaded', list: withoutGuest(was.list, gone.id).list } : was,
    );
    setRecount((n) => n + 1);
    setBackOnList(null);
    setRemoved({ guest: row, at });
    setParams(withGuest(null));
    focus('undo');
  }

  function undoRemoval(): void {
    if (removed == null) return;
    const { guest, at } = removed;

    setRemoved(null);
    api.undoGuestRemoval(event.id, guest.id).then(
      () => {
        setLoad((was) =>
          was.kind === 'loaded' ? { kind: 'loaded', list: withGuestAt(was.list, guest, at) } : was,
        );
        setRecount((n) => n + 1);
        setBackOnList(guest.id);
        lastRow.current = guest.id;
        setParams(withGuest(guest.id));
        headingOwed.current = true;
        focus('guest-heading');
      },
      () => setAttempt((n) => n + 1),
    );
  }

  function removedLine(guest: Guest): string {
    const names = guest.companions.map((one) => one.fullName);
    const companions = names.map((_, at) => companionShown(t, guest.fullName, names, at));

    return companions.length === 0
      ? t('guestList.guestRemoved', { name: guest.fullName })
      : t('guestList.guestRemovedWith', {
          name: guest.fullName,
          companions: listFormat(currentLocale(), { style: 'long', type: 'conjunction' }).format(
            companions,
          ),
        });
  }

  /** The 404 "already removed by someone else": Back to guests drops their row. */
  function removedAlready(id: string): void {
    setLoad((was) =>
      was.kind === 'loaded' ? { kind: 'loaded', list: withoutGuest(was.list, id).list } : was,
    );
    setRecount((n) => n + 1);
    setParams(withGuest(null));
    focus('title');
  }

  /** A phase that no longer invites: the event is read again, so the page says why, and the refusal still reaches the caller. */
  function phaseRefused(error: unknown): never {
    if (error instanceof ApiError && error.is('event_state_invalid')) {
      void api.taggedEvent(event.id).then(
        (latest) => {
          onChange(latest.event, latest.tag);
          window.setTimeout(() => heading.current?.focus(), 0);
        },
        () => undefined,
      );
    }

    throw error;
  }

  const guests = load.kind === 'loaded' ? load.list.guests : NO_GUESTS;
  const stillAsked = new Set(
    invites
      ? [...asked].filter((id) => {
          const guest = guests.find((one) => one.id === id);

          return guest == null || shownReply(guest) === 'notYetInvited';
        })
      : [],
  );

  // Once the phase line shows, a question has nothing to answer it with, and none comes back if the event is Live again.
  if (stillAsked.size !== asked.size) setAsked(stillAsked);

  useEffect(() => keepAsked(event.id, asked), [event.id, asked]);

  function ask(id: string, open: boolean): void {
    setAsked((was) => {
      const next = new Set(was);

      if (open) next.add(id);
      else next.delete(id);

      return next;
    });
  }

  /** With Not yet invited on, the guest just marked leaves the list, so focus goes to the row that took their place. */
  function sentFrom(id: string): void {
    const rows = view.kind === 'rows' ? view.rows : view.groups.flatMap((group) => group.rows);
    const at = rows.findIndex((row) => row.person.guest.id === id);

    if (choice !== 'notYetInvited' || at < 0) {
      focus('guest-heading');
      return;
    }
    const others = (from: readonly ViewRow[]) => from.filter((row) => row.person.guest.id !== id);
    const next = others(rows.slice(at))[0] ?? others(rows.slice(0, at)).at(-1);

    setParams(withGuest(null));
    focus(next == null ? 'none-heading' : `row:${next.person.id}`, 'title');
  }

  /** A new name on the form became a group as the guest was saved: the list is read again to carry it. */
  function madeGroup(guest: Guest): boolean {
    const id = guest.group?.id;

    return id != null && load.kind === 'loaded' && !load.list.groups.some((one) => one.id === id);
  }
  const shows =
    load.kind === 'failed' || counted === 'failed'
      ? 'failed'
      : load.kind === 'loading' || counted == null
        ? 'loading'
        : 'loaded';
  const counts = typeof counted === 'object' ? counted : null;
  const dietaryOn = manages && dietaryOnly;
  const { view, shown } = useMemo(
    () =>
      counts == null
        ? { view: { kind: 'rows' as const, rows: [] }, shown: 0 }
        : viewOf(guests, counts, choice, q, expanded, dietaryOn, groupFilter),
    [guests, counts, choice, q, expanded, dietaryOn, groupFilter],
  );
  const looking = choice !== 'all' || q.trim() !== '' || dietaryOn || groupFilter != null;
  const listLook = `${choice}\n${q}\n${dietaryOn}\n${groupFilter ?? ''}`;
  const [lookedAt, setLookedAt] = useState(listLook);

  // A tab, a search or a filter changes what is shown, so nothing hidden stays selected (PM #5003).
  if (lookedAt !== listLook) {
    setLookedAt(listLook);
    if (selected.size > 0) {
      setSelected(NONE);
      setSelectionCleared(true);
    }
  }

  const shownIds = useMemo(() => (manages ? shownGuests(view) : []), [manages, view]);
  // Only guests the person can see selected are acted on: one removed meanwhile drops out of the count.
  const picked = useMemo(() => {
    const shownSet = new Set(shownIds);

    return new Set([...selected].filter((id) => shownSet.has(id)));
  }, [selected, shownIds]);
  const everyone = shownIds.length > 0 && shownIds.every((id) => picked.has(id));
  const companionsPicked = companionsWith(guests, picked);
  const undoing = line?.kind === 'removed' && removal != null;
  const bar = manages && picked.size > 0 && (line == null || line.kind === 'undone');
  const showsList = guests.length > 0 || line != null;

  function select(next: ReadonlySet<string>): void {
    setSelected(next);
    setSelectionCleared(false);
    if (!undoing) setLine(null);
  }

  function toggle(id: string): void {
    const next = new Set(picked);

    if (next.has(id)) next.delete(id);
    else next.add(id);
    select(next);
  }

  function ended(next: Line): void {
    setLine(next);
    setSheet(null);
    setRemoving(null);
    setMarking(null);
    focus('many-line');
  }

  /** A removal still inside its Undo is erased once another action ends it, since one line shows at a time. */
  function endUndo(): void {
    if (removal != null) void api.eraseGuestsRemoval(event.id, removal).catch(() => undefined);
    setRemoval(null);
  }

  function pressMark(): void {
    if (picked.size > GUESTS_TOGETHER_MOST) return;
    const asked = markQuestion(guests, picked);

    if (asked.marks === 0) {
      ended({ kind: 'nothing', already: asked.already.length, gone: 0 });
      return;
    }
    setMarking({ ids: [...picked], asked });
  }

  /** A phase that no longer invites is read again, so Mark as invited leaves the bar while the selection stays. */
  function mark(how: GuestInvitationHow, ids: readonly string[] = [...picked]): void {
    api.markGuestsInvited(event.id, ids, how).then(
      (marked) => {
        endUndo();
        setSelected(NONE);
        setRecount((n) => n + 1);
        setAttempt((n) => n + 1);
        ended(
          marked.marked === 0
            ? { kind: 'nothing', already: marked.already, gone: marked.gone }
            : { kind: 'marked', marked, how },
        );
      },
      (error: unknown) => {
        if (error instanceof ApiError && error.is('event_state_invalid')) {
          setNotLiveAt(tag);
          void api.taggedEvent(event.id).then(
            (latest) => onChange(latest.event, latest.tag),
            () => undefined,
          );
          ended({ kind: 'notLive' });
          return;
        }
        ended({ kind: 'failed', action: { kind: 'mark', how, ids } });
      },
    );
  }

  function move(to: { id: string } | { name: string }, ids: readonly string[] = [...picked]): void {
    api.moveGuestsToGroup(event.id, ids, to).then(
      (moved) => {
        endUndo();
        setSelected(NONE);
        setRecount((n) => n + 1);
        setAttempt((n) => n + 1);
        ended({ kind: 'moved', moved });
      },
      (error: unknown) => {
        const refused = refusedLine(error, 'group.name', 'group.id');

        if (refused != null && sheet != null) {
          setSheet({ refused });
          return;
        }
        ended({ kind: 'failed', action: { kind: 'move', to } });
      },
    );
  }

  function removeMany(ids: readonly string[] = [...picked]): void {
    setRemoving({ busy: true });
    api.removeGuests(event.id, ids).then(
      (removed) => {
        endUndo();
        const gone = new Set(ids);

        setLoad((was) =>
          was.kind === 'loaded'
            ? {
                kind: 'loaded',
                list: [...gone].reduce((list, id) => withoutGuest(list, id).list, was.list),
              }
            : was,
        );
        setSelected(NONE);
        setRecount((n) => n + 1);
        setRemoval(removed.removal);
        if (open != null && gone.has(open)) setParams(withGuest(null));
        ended({ kind: 'removed', removed });
      },
      () => ended({ kind: 'failed', action: { kind: 'remove' } }),
    );
  }

  function retry(action: Action): void {
    if (action.kind === 'mark') mark(action.how, action.ids);
    else if (action.kind === 'move') move(action.to);
    else removeMany();
  }

  function pressAdd(): void {
    if (picked.size > GUESTS_TOGETHER_MOST) return;
    setSheet({ refused: null });
  }

  function pressRemove(): void {
    if (picked.size > GUESTS_TOGETHER_MOST) return;
    setRemoving({ busy: false });
  }

  function undoMany(): void {
    if (removal == null) return;
    const undone = removal;

    setRemoval(null);
    api.undoGuestsRemoval(event.id, undone).then(
      () => {
        const back = line?.kind === 'removed' ? line.removed.guests : 0;

        setAttempt((n) => n + 1);
        setRecount((n) => n + 1);
        ended({ kind: 'undone', guests: back });
      },
      () => {
        setLine(null);
        setAttempt((n) => n + 1);
      },
    );
  }

  function lineGone(): void {
    endUndo();
    setLine(null);
  }

  /** The card as `/demo/guests` draws it: a Draft, Paused or Finished event says so on the card, in place of its counts' step. */
  function cover(counts: Counts): Cover {
    const empty = guests.length === 0;
    const comingOf = empty
      ? t('guestList.noGuests')
      : counts.invited === 0
        ? t('guestList.onTheList', { count: counts.all })
        : t('guestList.comingOf', {
            comingWords: t('guestList.countComing', { count: counts.coming }),
            invitedWords: t('guestList.countInvited', { count: counts.invited }),
          });
    const draft = phase === 'draft' ? makeLiveRow(event, now) : null;

    if (draft != null) {
      const live = !canOn(event, 'events.manage')
        ? null
        : draft.makeLive
          ? 'makeLive'
          : 'changeDates';
      const add = empty && manages;

      return {
        tag: { mark: 'draft', word: t('events.draft') },
        says: empty ? t('guestList.noGuests') : t('guestList.onTheList', { count: counts.all }),
        line: t(`eventLive.${draft.line}`),
        step: add ? 'add' : live,
        also: add ? live : null,
      };
    }
    if (phase === 'paused' || phase === 'finished')
      return {
        tag:
          phase === 'paused'
            ? { mark: 'paused', word: t('events.paused') }
            : { mark: null, word: t('events.finished') },
        says: comingOf,
        line: t(phase === 'paused' ? 'guestList.pausedLine' : 'guestList.finishedLine'),
      };
    if (empty)
      return {
        says: t('guestList.noGuests'),
        step: manages ? 'add' : null,
      };

    return { says: comingOf, line: counts.invited === 0 ? null : haventLine(t, counts) };
  }

  function onStep(step: CoverStep): void {
    if (step === 'add') startAdd();
    else if (step === 'makeLive') makeLive.start();
    else {
      const dates = inPlace(event.id, 'dates');
      void navigate(dates.to, { state: dates.state });
    }
  }

  function clearView(): void {
    clear();
    setDietary(false);
    setGroupFilter(null);
    focus('find');
  }

  const card = shows === 'loaded' && counts != null ? cover(counts) : null;

  return (
    <LayersContext value={layers}>
      <div ref={root} className="desk ev gs">
        <div className="ev-wide gs-page" inert={covered}>
          <div className="ev-crumb-row">
            <nav className="ev-crumb" aria-label={t('eventPage.crumb')}>
              <ol>
                <li className="ev-crumb-part">
                  <Link to="/app/events">{t('events.title')}</Link>
                </li>
                <li className="ev-crumb-part">
                  <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                  <Link
                    className="ev-crumb-name"
                    to={`/app/events/${encodeURIComponent(event.id)}`}
                  >
                    {event.name}
                  </Link>
                </li>
                <li className="ev-crumb-part" aria-current="page">
                  <Glyph name="chevron" size={15} weight={2.4} className="desk-chevron" />
                  <span className="ev-crumb-name">{t('eventPage.guests')}</span>
                </li>
              </ol>
            </nav>
          </div>
          <header className="gs-top">
            <h1 ref={heading} className="gs-title" tabIndex={-1} data-focus="title">
              {t('eventPage.guests')}
            </h1>
            {shows === 'loaded' && (
              <button
                type="button"
                className="gs-pill is-secondary"
                aria-pressed={grouping}
                data-focus="groups"
                onClick={openGroups}
              >
                {t('guestGroups.groups')}
              </button>
            )}
            {manages && card != null && card.step !== 'add' && (
              <button type="button" className="ev-new" data-focus="add" onClick={startAdd}>
                <Glyph name="plus" size={18} weight={2.4} />
                {t('guestList.addGuest')}
              </button>
            )}
          </header>
          {shows === 'loading' && (
            <div className="desk-loading gs-bones" role="status" aria-busy="true">
              <span className="desk-unseen">{t('pending.loading')}</span>
              <span className="desk-sunk gs-bone-card" aria-hidden="true" />
              <span className="desk-sunk gs-bone-field" aria-hidden="true" />
              <ul className="desk-rows gs-rows" aria-hidden="true">
                {[1, 2, 3, 4, 1].map((bone, index) => (
                  <li key={index} className="desk-row is-bones">
                    <span className="desk-sunk gs-bone-mark" />
                    <span className="desk-row-words">
                      <span className={`desk-sunk is-title b${bone}`} />
                      <span className={`desk-sunk is-line b${bone}`} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {shows === 'failed' && (
            <div className="desk-failed gs-failed" role="alert">
              <h2>{t('guestList.loadFailed')}</h2>
              <p className="desk-line">{t('guestList.loadFailedLine')}</p>
              <TextAction
                label={t('events.retry')}
                onClick={() => {
                  setLoad({ kind: 'loading' });
                  setCounted(null);
                  setAttempt((n) => n + 1);
                }}
              />
            </div>
          )}
          {shows === 'loaded' && (
            <>
              {card != null && (
                <GuestsCover
                  mesh={meshFor(event.id)}
                  cover={card}
                  makeLiveRef={opener}
                  onStep={onStep}
                />
              )}
              {(showsList || adding || grouping) && (
                <div className="gs-cols">
                  <section className="gs-list" aria-label={t('eventPage.guests')}>
                    {showsList && counts != null && (
                      <>
                        <SearchRow
                          q={q}
                          choice={choice}
                          counts={counts}
                          menu={menu}
                          onQ={setQ}
                          onChoice={setChoice}
                          onMenu={setMenu}
                        />
                        {manages && (
                          <div className="gs-chips gs-filters">
                            <button
                              type="button"
                              className={dietaryOnly ? 'gs-chip is-on' : 'gs-chip'}
                              aria-pressed={dietaryOnly}
                              data-focus="dietary"
                              onClick={() => setDietary((was) => !was)}
                            >
                              {dietaryOnly && <Glyph name="tick" size={16} weight={2.6} />}
                              {t('guestNeeds.dietaryNotes')}
                            </button>
                          </div>
                        )}
                        {load.kind === 'loaded' && (
                          <GroupChips
                            list={load.list}
                            filter={groupFilter}
                            onFilter={setGroupFilter}
                          />
                        )}
                        <div className={looking ? 'gs-shown' : 'visually-hidden'}>
                          <p role="status">
                            {looking ? t('guestList.shown', { shown, total: counts.all }) : ''}
                          </p>
                          {looking && (
                            <TextAction label={t('guestList.clear')} onClick={clearView} />
                          )}
                        </div>
                        <div role="status" className="gb-cleared">
                          {selectionCleared && (
                            <div className="gm-line is-quiet">
                              <Glyph name="info" size={18} weight={2.4} />
                              <p>
                                <span>{t('guestSelect.cleared')}</span>
                                <span className="gb-why">{t('guestSelect.clearedWhy')}</span>
                              </p>
                            </div>
                          )}
                        </div>
                        <SelectedSaid
                          count={bar ? picked.size : null}
                          companions={companionsPicked}
                        />
                        {!manages && (
                          <p className="desk-note gb-note">{t('guestSelect.viewOnly')}</p>
                        )}
                        {manages && shownIds.length > 0 && (
                          <label className="gs-tick gm-all">
                            <input
                              type="checkbox"
                              className="gs-box"
                              checked={everyone}
                              data-focus="many-all"
                              ref={(box) => {
                                if (box != null)
                                  box.indeterminate =
                                    !everyone && shownIds.some((id) => picked.has(id));
                              }}
                              onChange={() => select(everyone ? NONE : new Set(shownIds))}
                            />
                            {t('guestSelect.selectAll', { count: shownIds.length })}
                          </label>
                        )}
                        {manages && onlyCompanions(view) && (
                          <p className="desk-note gb-note">{t('guestSelect.heldNote')}</p>
                        )}
                        {manages && (
                          <div className="gm-dock">
                            <div
                              className="gm-said"
                              data-focus="many-line"
                              tabIndex={-1}
                              role="status"
                            >
                              {line != null && (
                                <ResultLine
                                  key={line.kind === 'removed' ? line.removed.removal : line.kind}
                                  line={line}
                                  undo={undoing}
                                  onUndo={undoMany}
                                  onGone={lineGone}
                                  onRetry={retry}
                                />
                              )}
                            </div>
                            {bar && (
                              <SelectBar
                                count={picked.size}
                                companions={companionsPicked}
                                onMark={invites && notLiveAt !== tag ? pressMark : null}
                                onAdd={pressAdd}
                                onRemove={pressRemove}
                                onClear={() => {
                                  select(NONE);
                                  focus('many-all');
                                }}
                              />
                            )}
                          </div>
                        )}
                        {shown === 0 ? (
                          <div className="gs-none">
                            <h2 tabIndex={-1} data-focus="none-heading">
                              {t('guestList.noMatch')}
                            </h2>
                            <p className="desk-line">{t('guestList.noMatchLine')}</p>
                            <TextAction label={t('guestList.clear')} onClick={clearView} />
                          </div>
                        ) : view.kind === 'rows' ? (
                          <Rows
                            rows={view.rows}
                            look={`${choice} ${q}`}
                            choice={choice}
                            eventId={event.id}
                            timeZone={event.timeZone}
                            open={open}
                            onOpen={openGuest}
                            picked={manages ? picked : null}
                            onPick={toggle}
                          />
                        ) : (
                          view.groups.map((group) => (
                            <Group
                              key={group.standing}
                              standing={group.standing}
                              count={group.count}
                              collapsed={group.collapsed}
                              onAll={() => {
                                setExpanded((was) => new Set([...was, group.standing]));
                                focus(`row:${group.next ?? ''}`);
                              }}
                            >
                              <Rows
                                rows={group.rows}
                                look={`${choice} ${q}`}
                                choice={choice}
                                eventId={event.id}
                                timeZone={event.timeZone}
                                open={open}
                                onOpen={openGuest}
                                picked={manages ? picked : null}
                                onPick={toggle}
                              />
                            </Group>
                          ))
                        )}
                      </>
                    )}
                  </section>
                  {grouping && load.kind === 'loaded' && (
                    <section
                      ref={column}
                      className="gs-column"
                      aria-label={t('guestGroups.groups')}
                    >
                      <GroupsColumn
                        eventId={event.id}
                        list={load.list}
                        manages={manages}
                        focus={focus}
                        onChanged={(deleted) => {
                          if (deleted != null && groupFilter === deleted) setGroupFilter(null);
                          setAttempt((n) => n + 1);
                        }}
                        onDone={closeGroups}
                      />
                    </section>
                  )}
                  {!adding && !grouping && (
                    <section
                      ref={column}
                      className="gs-column"
                      aria-label={guests.find((one) => one.id === open)?.fullName}
                    >
                      {open == null ? (
                        shown > 0 && <p className="gs-pick">{t('guestList.pick')}</p>
                      ) : (
                        <GuestColumn
                          key={open}
                          eventId={event.id}
                          guestId={open}
                          timeZone={event.timeZone}
                          event={event}
                          mesh={meshFor(event.id)}
                          manages={manages}
                          guests={guests}
                          groups={load.kind === 'loaded' ? load.list.groups : []}
                          country={country}
                          stamp={stamp}
                          invites={invites}
                          draft={phase === 'draft'}
                          flagged={flagged.has(open)}
                          onCopy={() => api.guestLink(event.id, open).catch(phaseRefused)}
                          onLink={() => api.guestLink(event.id, open)}
                          onMark={(how) => api.markInvited(event.id, open, how).catch(phaseRefused)}
                          asked={stillAsked.has(open)}
                          onAsked={(on) => ask(open, on)}
                          onSentMarked={() => sentFrom(open)}
                          onUnmark={() => api.markNotInvited(event.id, open)}
                          onChanged={changed}
                          onReplace={() =>
                            api
                              .replaceGuestLink(event.id, open)
                              .then(() =>
                                setFlagged((was) => new Set([...was].filter((id) => id !== open))),
                              )
                          }
                          focus={focus}
                          onDirty={setDirty}
                          onAsk={(then) => setAsking(() => then)}
                          onClose={close}
                          backOnList={backOnList === open}
                          onRemove={remove}
                          onRemovedAlready={() => removedAlready(open)}
                          onShown={() => {
                            if (!headingOwed.current) return;
                            headingOwed.current = false;
                            focus('guest-heading');
                          }}
                          onSaved={(guest) => {
                            changed(guest);
                            if (madeGroup(guest)) setAttempt((n) => n + 1);
                            setSaved(true);
                          }}
                        />
                      )}
                    </section>
                  )}
                  {adding && (
                    <section className="gs-column" aria-label={t('guestList.addGuest')}>
                      <AddForm
                        eventId={event.id}
                        guests={guests}
                        groups={load.kind === 'loaded' ? load.list.groups : []}
                        country={country}
                        focus={focus}
                        onAdded={(guest) => {
                          setRecount((n) => n + 1);
                          if (madeGroup(guest)) setAttempt((n) => n + 1);
                          setLoad((was) =>
                            was.kind === 'loaded'
                              ? { kind: 'loaded', list: listedWith(was.list, guest) }
                              : was,
                          );
                        }}
                        onDone={() => {
                          setAdding(false);
                          focus('add', 'title');
                        }}
                      />
                    </section>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        {(asking != null || away.state === 'blocked') && (
          <Ask
            title={t('guestList.discardTitle')}
            line={t('guestList.discardLine', {
              name: guests.find((one) => one.id === open)?.fullName ?? '',
            })}
            keep={t('guestList.keepEditing')}
            go={t('guestList.discard')}
            onKeep={() => {
              addAfter.current = false;
              groupsAfter.current = false;
              setAsking(null);
              away.reset?.();
            }}
            onGo={() => {
              const then = asking;

              setAsking(null);
              setDirty(false);
              if (then != null) then();
              else away.proceed?.();
              if (addAfter.current) {
                addAfter.current = false;
                showAdd();
              }
              if (groupsAfter.current) {
                groupsAfter.current = false;
                showGroups();
              }
            }}
          />
        )}
        {sheet != null && load.kind === 'loaded' && (
          <GroupSheet
            count={picked.size}
            list={load.list}
            refused={sheet.refused}
            onCancel={() => {
              setSheet(null);
              focus('many-add');
            }}
            onMove={(to) => move(to)}
          />
        )}
        {marking != null && (
          <MarkMany
            asked={marking.asked}
            onCancel={() => {
              setMarking(null);
              focus('many-mark');
            }}
            onMark={(how) => mark(how, marking.ids)}
          />
        )}
        {removing != null && picked.size > 0 && (
          <RemoveMany
            asked={removeQuestion(guests, picked)}
            busy={removing.busy}
            onKeep={() => {
              setRemoving(null);
              focus('many-remove');
            }}
            onRemove={() => removeMany()}
          />
        )}
        {makeLive.dialogs}
        {saved && <Toast words={t('guestList.saved')} onClose={() => setSaved(false)} />}
        {removed != null && (
          <Toast
            key={removed.guest.id}
            words={removedLine(removed.guest)}
            counted={{ said: t('guestList.undoOpen') }}
            onUndo={undoRemoval}
            onClose={() => {
              setRemoved(null);
              void api.eraseGuest(event.id, removed.guest.id).catch(() => undefined);
            }}
          />
        )}
        <div ref={setHost} className="desk-layers" />
      </div>
    </LayersContext>
  );
}

const PIECES = [1, 2, 3, 4, 5, 6];

/** "25 haven’t replied (21 guests and 4 companions).", the bracket only with a companion among them, and "Everyone has replied." at 0. */
function haventLine(t: TFunction, counts: Counts): string {
  if (counts.havent === 0) return t('guestList.everyoneReplied');
  const havent = t('guestList.havent', { count: counts.havent });

  return counts.haventCompanions === 0
    ? t('guestList.haventLine', { havent })
    : t('guestList.haventWho', {
        havent,
        guests: t('guestList.countGuests', { count: counts.haventGuests }),
        companions: t('guestList.countCompanions', { count: counts.haventCompanions }),
      });
}

type CoverStep = 'add' | 'makeLive' | 'changeDates';

interface Cover {
  tag?: { mark: 'draft' | 'paused' | null; word: string } | null;
  says: string;
  line?: string | null;
  step?: CoverStep | null;
  /** sc-50409: Make live or Change dates beside an empty Draft's Add guest, quieter, as the app's card (sc-46879). */
  also?: Exclude<CoverStep, 'add'> | null;
}

const STEP_KEY: Record<CoverStep, string> = {
  add: 'guestList.addGuest',
  makeLive: 'eventLive.makeLive',
  changeDates: 'eventLive.changeDates',
};

/** How the room stands, in the event's colours, with the one step this page can take. */
function GuestsCover({
  mesh,
  cover: { tag = null, says, line = null, step = null, also = null },
  makeLiveRef,
  onStep,
}: {
  mesh: Mesh;
  cover: Cover;
  makeLiveRef: RefObject<HTMLButtonElement | null>;
  onStep: (step: CoverStep) => void;
}) {
  const { t } = useTranslation();

  return (
    <section className={`ev-card today-cover is-${mesh} gs-card is-page`}>
      <span className="ev-scrim" aria-hidden="true" />
      {PIECES.map((piece) => (
        <span key={piece} className={`desk-piece p${piece}`} aria-hidden="true" />
      ))}
      <div className="ev-card-inner gs-card-inner">
        {tag != null && (
          <ul className="desk-glass-tags">
            <li className="desk-glass">
              {tag.mark != null && <GlassMark mark={tag.mark} />}
              {tag.word}
            </li>
          </ul>
        )}
        <p className="gs-says">{says}</p>
        {line != null && <p className="desk-on-card">{line}</p>}
        {step != null && (
          <div className={also == null ? 'ev-card-foot' : 'ev-card-foot gs-card-steps'}>
            <CardStep
              ref={step === 'makeLive' ? makeLiveRef : undefined}
              label={t(STEP_KEY[step])}
              onClick={() => onStep(step)}
            />
            {also != null && (
              <button
                ref={also === 'makeLive' ? makeLiveRef : undefined}
                type="button"
                className="gs-card-also"
                onClick={() => onStep(also)}
              >
                {t(STEP_KEY[also])}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

const CHOICE_KEY: Record<Choice, string> = {
  all: 'guestList.all',
  invited: 'guestNumbers.invited',
  coming: REPLY_KEY.coming,
  maybe: REPLY_KEY.maybe,
  noReply: REPLY_KEY.noReply,
  held: REPLY_KEY.held,
  notComing: REPLY_KEY.notComing,
  notYetInvited: REPLY_KEY.notYetInvited,
};

/** Find a guest, and the house filter menu beside it reading "{choice} · {n}". */
function SearchRow({
  q,
  choice,
  counts,
  menu,
  onQ,
  onChoice,
  onMenu,
}: {
  q: string;
  choice: Choice;
  counts: Counts;
  menu: boolean;
  onQ: (q: string) => void;
  onChoice: (choice: Choice) => void;
  onMenu: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const onClose = useCallback(() => onMenu(false), [onMenu]);

  return (
    <div className="ev-search-row gs-search-row">
      <div className="ev-search" role="search">
        <SearchField
          label={t('guestList.find')}
          clearLabel={t('guestList.clearSearch')}
          value={q}
          focusKey="find"
          onChange={onQ}
          onClear={() => onQ('')}
        />
      </div>
      <div className="gs-menu">
        <Menu
          items={CHOICES.filter((key) => key !== 'notYetInvited' || counts[key] > 0).map((key) => ({
            key,
            word: t(CHOICE_KEY[key]),
            count: counts[key],
          }))}
          picked={choice}
          open={menu}
          onOpen={() => onMenu(true)}
          onClose={onClose}
          onPick={(key) => onChoice(key as Choice)}
        />
      </div>
    </div>
  );
}

/** A reply's group on All: its word and count, its first rows, then Show all {n}. */
function Group({
  standing,
  count,
  collapsed,
  onAll,
  children,
}: {
  standing: Standing;
  count: number;
  collapsed: boolean;
  onAll: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <section className="gs-group" aria-labelledby={id}>
      <h2 id={id} className="gs-group-head">
        {t(REPLY_KEY[standing])}
        <span className="gs-group-count">
          {' · '}
          {t('guestList.figure', { count })}
        </span>
      </h2>
      {children}
      {collapsed && <TextAction label={t('guestList.showAll', { count })} onClick={onAll} />}
    </section>
  );
}

/** Rows drawn in one frame: a search matching most of 2,000 guests draws its first rows, then the rest a frame at a time, so the list changes in under 100 ms. */
const ROWS_PER_FRAME = 100;

const RowsPart = memo(RowsFrom);

/** Each row is a link to its guest's address; a companion's opens their guest. */
function Rows({
  rows,
  look,
  ...rest
}: {
  rows: readonly ViewRow[];
  /** The choice and search: a new one starts again from the first rows. */
  look: string;
  choice: Choice;
  eventId: string;
  timeZone: string;
  open: string | null;
  onOpen: (id: string) => void;
  /** The guests selected, or null without guests.manage, when no row has a box (sc-3776). */
  picked: ReadonlySet<string> | null;
  onPick: (id: string) => void;
}) {
  const [drawn, setDrawn] = useState({ look, upTo: ROWS_PER_FRAME });
  const upTo = drawn.look === look ? drawn.upTo : ROWS_PER_FRAME;

  if (drawn.look !== look) setDrawn({ look, upTo });

  useEffect(() => {
    if (upTo >= rows.length) return;

    const frame = requestAnimationFrame(() =>
      setDrawn((was) => (was.look === look ? { look, upTo: was.upTo + ROWS_PER_FRAME } : was)),
    );

    return () => cancelAnimationFrame(frame);
  }, [look, upTo, rows.length]);

  const parts = [];

  for (let from = 0; from < Math.min(upTo, rows.length); from += ROWS_PER_FRAME)
    parts.push(
      <RowsPart key={from} rows={rows} from={from} to={from + ROWS_PER_FRAME} {...rest} />,
    );

  return <ul className="desk-rows gs-rows">{parts}</ul>;
}

function RowsFrom({
  rows,
  from,
  to,
  choice,
  eventId,
  timeZone,
  open,
  onOpen,
  picked,
  onPick,
}: {
  rows: readonly ViewRow[];
  from: number;
  to: number;
  choice: Choice;
  eventId: string;
  /** The event's: a reply's date is the day it was in the event's zone. */
  timeZone: string;
  open: string | null;
  onOpen: (id: string) => void;
  picked: ReadonlySet<string> | null;
  onPick: (id: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      {rows.slice(from, to).map(({ person, indent }) => {
        const { guest, companion } = person;
        const noReply = choice === 'noReply';
        const { name, line } = rowWords(t, person, indent, timeZone, dateLocale(), {
          places: noReply ? null : 'named',
          contact: true,
          invitation:
            noReply && companion == null ? invitationLine(t, guest, timeZone, dateLocale()) : null,
        });

        if (companion == null)
          return (
            <li key={guest.id} className={picked == null ? undefined : 'gm-pick'}>
              {picked != null && (
                <label className="gm-box">
                  <input
                    type="checkbox"
                    className="gs-box"
                    aria-label={t('guestSelect.select', { name: guest.fullName })}
                    checked={picked.has(guest.id)}
                    onChange={() => onPick(guest.id)}
                  />
                </label>
              )}
              <RowLink
                eventId={eventId}
                guestId={guest.id}
                rowId={guest.id}
                open={open}
                onOpen={onOpen}
              >
                <span className="gs-lead">
                  <ReplyMark reply={shownReply(guest)} />
                </span>
                <RowWords title={name} lines={[line]} />
                <NeedsTags needs={guest.needs} group={guest.group?.name ?? null} />
              </RowLink>
            </li>
          );

        return (
          <li key={companion.id} className={indent ? 'is-companion' : undefined}>
            <RowLink
              eventId={eventId}
              guestId={guest.id}
              rowId={companion.id}
              open={null}
              onOpen={onOpen}
            >
              <span className="gs-lead">
                <ReplyMark reply={companion.state} />
              </span>
              <RowWords title={name} lines={[line]} />
              <NeedsTags
                needs={companion.needs}
                group={indent ? null : (guest.group?.name ?? null)}
              />
            </RowLink>
          </li>
        );
      })}
    </>
  );
}

/** sc-3777: the Allergy mark, then the grey Dietary notes tag, both words in the row's name; only sent to those who manage guests. sc-3775's group tag is last, for everyone. */
function NeedsTags({ needs, group }: { needs: Guest['needs']; group: string | null }) {
  const { t } = useTranslation();
  const allergy = hasAllergy(needs);
  const tagged = dietary(needs);

  if (!allergy && !tagged && group == null) return null;

  return (
    <span className="gs-row-tags">
      {allergy && <AllergyMark />}
      {tagged && <span className="gs-tag">{t('guestNeeds.dietaryNotes')}</span>}
      {group != null && <GroupTag name={group} />}
    </span>
  );
}

function RowLink({
  eventId,
  guestId,
  rowId,
  open,
  onOpen,
  children,
}: {
  eventId: string;
  guestId: string;
  rowId: string;
  open: string | null;
  onOpen: (id: string) => void;
  children: ReactNode;
}) {
  const on = open === guestId;

  return (
    <Link
      to={guestAddress(eventId, guestId)}
      className={on ? 'desk-row gs-row is-on' : 'desk-row gs-row'}
      aria-current={on ? 'true' : undefined}
      data-focus={`row:${rowId}`}
      onClick={(press) => {
        if (press.metaKey || press.ctrlKey || press.shiftKey || press.button !== 0) return;
        press.preventDefault();
        onOpen(guestId);
      }}
    >
      {children}
      <Chevron />
    </Link>
  );
}

function fieldOf(key: string, problems: Problems): string {
  return key === 'mobile' && problems.mobile === 'noCountry' ? 'country' : key;
}

interface AddTyped extends Omit<Typed, 'country' | 'companions'> {
  companions: readonly { name: string; needs: NeedsTyped }[];
  needs: NeedsTyped;
}

const EMPTY: AddTyped = {
  fullName: '',
  email: '',
  number: '',
  companions: [],
  language: null,
  needs: NO_NEEDS,
};

function needsByWho(typed: AddTyped): Record<string, NeedsProblems> {
  return problemsByWho([typed.needs, ...typed.companions.map((one) => one.needs)]);
}

/** Add guest in place beside the list: it stays open after each guest, cleared, focus back on Full name. */
function AddForm({
  eventId,
  guests,
  groups,
  country,
  focus,
  onAdded,
  onDone,
}: {
  eventId: string;
  guests: readonly Guest[];
  groups: readonly GuestGroup[];
  country: string;
  focus: (...keys: string[]) => void;
  onAdded: (guest: Guest) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState<AddTyped>(EMPTY);
  const [picked, setPicked] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [refused, setRefused] = useState<Problems>({});
  const [duplicate, setDuplicate] = useState(false);
  const [failed, setFailed] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [group, setGroup] = useState<GroupChoice | undefined>(undefined);
  const [groupRefused, setGroupRefused] = useState<string | undefined>(undefined);
  const [round, setRound] = useState(0);
  const groupLine = groupRefused ?? (tried ? choiceLine(t, groups, group) : undefined);
  const box = useRef<HTMLDivElement>(null);
  const values: Typed = {
    ...typed,
    companions: typed.companions.map((one) => one.name),
    country: picked ?? country,
  };
  const problems: Problems = { ...(tried ? problemsOf(values) : {}), ...refused };
  const [needsRefused, setNeedsRefused] = useState<Record<string, NeedsProblems>>({});
  const opened = useNeedsOpen();
  const needsProblems: Record<string, NeedsProblems> = {
    ...(tried ? needsByWho(typed) : {}),
    ...needsRefused,
  };

  function change(next: Partial<AddTyped>): void {
    setTyped((was) => ({ ...was, ...next }));
    setRefused({});
    setNeedsRefused({});
    if (next.fullName != null) setDuplicate(false);
  }

  function words(key: string): string | undefined {
    const problem: Problem | undefined = problems[key];

    if (problem == null) return undefined;
    if (typeof problem === 'object') return problem.refused;
    if (problem === 'blank') return t('guestList.blankName');
    if (problem === 'tooLong') return t('guestList.nameTooLong', { most: GUEST_NAME_MAXIMUM });
    if (problem === 'emailShape') return t('forms.emailShape');

    return (
      phoneProblemMessage(
        problem === 'phoneTooShort'
          ? 'tooShort'
          : problem === 'phoneTooLong'
            ? 'tooLong'
            : 'noCountry',
        values.country,
        t,
      ) ?? undefined
    );
  }

  async function add(allowDuplicate = false): Promise<void> {
    if (busy) return;
    const first = firstProblem(problemsOf(values), values.companions.length);
    const needsFound = needsByWho(typed);
    const needsFirst = firstNeedsFailing(needsFound);
    const groupFirst = choiceLine(t, groups, group);

    if (first != null || groupFirst != null || needsFirst != null) {
      setTried(true);
      setRefused({});
      setNeedsRefused({});
      setGroupRefused(undefined);
      opened.openFailing(needsFound);
      if (first != null) focus(fieldOf(first, problemsOf(values)));
      else if (groupFirst != null) focus('group');
      else if (needsFirst != null) focus(needsFirst);
      return;
    }
    if (!allowDuplicate && isListed(guests, values.fullName)) {
      setDuplicate(true);
      focus('duplicate');
      return;
    }
    setBusy(true);
    setFailed(false);
    setSaid(null);
    try {
      const sent = newGuestOf(values, allowDuplicate);
      const guest = await api.addGuest(eventId, {
        ...sent,
        ...(group === undefined ? {} : { group }),
        needs: needsInputOf(typed.needs),
        companions: (sent.companions ?? []).map((one, at) => ({
          ...one,
          needs: needsInputOf(typed.companions[at]?.needs ?? NO_NEEDS),
        })),
      });

      onAdded(guest);
      setSaid(t('guestList.justAdded', { name: guest.fullName }));
      setTyped(EMPTY);
      setGroup(undefined);
      setRound((was) => was + 1);
      opened.closeAll();
      setTried(false);
      setDuplicate(false);
      focus('fullName');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'guest_already_listed') {
        setDuplicate(true);
        focus('duplicate');
      } else if (error instanceof ApiError && error.status === 422) {
        const violations = error.problem.violations ?? [];
        const found = violationProblems(violations, values);
        const at = firstProblem(found, values.companions.length);
        const theirNeeds = needsViolations(violations, (who) =>
          who === 'guest'
            ? typed.needs
            : (typed.companions[Number(who.slice(1))]?.needs ?? NO_NEEDS),
        );
        const needsAt = firstNeedsFailing(theirNeeds);
        const groupAt = groupRefusal(error);

        if (at == null && groupAt == null && needsAt == null) setFailed(true);
        else {
          setRefused(found);
          setNeedsRefused(theirNeeds);
          setGroupRefused(groupAt ?? undefined);
          opened.openFailing(theirNeeds);
          if (at != null) focus(fieldOf(at, found));
          else if (groupAt != null) focus('group');
          else if (needsAt != null) focus(needsAt);
        }
      } else setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const onEscape = useEffectEvent((event: globalThis.KeyboardEvent) => {
    if (event.key !== 'Escape' || event.defaultPrevented || listOpen(event)) return;
    event.preventDefault();
    onDone();
  });

  useEffect(() => {
    const at = box.current;
    const listen = (event: globalThis.KeyboardEvent) => onEscape(event);

    at?.addEventListener('keydown', listen);

    return () => at?.removeEventListener('keydown', listen);
  }, []);

  return (
    <div ref={box} className="gs-form">
      <div className="gs-col-head">
        <h2 className="gs-col-title" tabIndex={-1} data-focus="form-heading">
          {t('guestList.addGuest')}
        </h2>
        <div className="gs-col-actions">
          <button type="button" className="desk-text" onClick={onDone}>
            {t('guestList.done')}
          </button>
        </div>
      </div>
      {said != null && (
        <p className="gs-ok" role="status">
          <Glyph name="tick" size={17} weight={2.6} />
          {said}
        </p>
      )}
      {failed && (
        <p className="desk-error gs-refused" role="alert">
          <Glyph name="alert" size={15} weight={2.2} />
          {t('guestList.notAdded')}
        </p>
      )}
      <NeedsRefused count={needsFailingCount(needsProblems)} />
      <div className="desk-fields gs-fields">
        <GuestField
          label={t('account.fullName')}
          value={typed.fullName}
          error={words('fullName')}
          focusKey="fullName"
          onChange={(fullName) => change({ fullName })}
        />
        <GuestField
          label={t('guestList.emailAddress')}
          value={typed.email}
          optional
          type="email"
          error={words('email')}
          focusKey="email"
          onChange={(email) => change({ email })}
        />
        <PhoneField
          country={values.country}
          number={typed.number}
          error={words('mobile')}
          onCountry={(code) => {
            setPicked(code);
            setRefused({});
          }}
          onNumber={(number) => change({ number })}
        />
        <LanguageField
          value={typed.language}
          chose={null}
          onChange={(language) => change({ language })}
        />
        <GroupField
          key={round}
          groups={groups}
          value={group}
          error={groupLine}
          onChange={(next) => {
            setGroup(next);
            setGroupRefused(undefined);
          }}
        />
        <NeedsSection
          title={t('guestNeeds.needs')}
          needs={typed.needs}
          problems={needsProblems.guest ?? {}}
          open={opened.open.has('guest')}
          focusKey="needs"
          onOpen={(open) => opened.toggle('guest', open)}
          onChange={(needs) => change({ needs })}
        />
        {duplicate && (
          <div className="gs-amber" role="alert">
            <h3 className="gs-amber-head" tabIndex={-1} data-focus="duplicate">
              <Glyph name="alert" size={17} weight={2.2} />
              {t('guestList.duplicate', { name: values.fullName.trim() })}
            </h3>
            <div className="gs-pair">
              <button
                type="button"
                className="gs-pill is-primary"
                aria-busy={busy || undefined}
                onClick={() => void add(true)}
              >
                {t('guestList.addAnyway')}
              </button>
              <button
                type="button"
                className="gs-pill is-secondary"
                onClick={() => {
                  setDuplicate(false);
                  focus('fullName');
                }}
              >
                {t('guestList.cancel')}
              </button>
            </div>
          </div>
        )}
        <CompanionFields
          host={values.fullName.trim()}
          companions={typed.companions}
          words={words}
          needs={{ problems: needsProblems, open: opened.open, toggle: opened.toggle }}
          focus={focus}
          onChange={(companions) => change({ companions })}
        />
      </div>
      <button
        type="button"
        className="gs-pill is-primary is-tall"
        aria-busy={busy || undefined}
        onClick={() => void add()}
      >
        {t('guestList.addGuest')}
      </button>
    </div>
  );
}

function CompanionFields({
  host,
  companions,
  words,
  needs,
  focus,
  onChange,
}: {
  host: string;
  companions: AddTyped['companions'];
  words: (key: string) => string | undefined;
  needs: CompanionNeeds;
  focus: (...keys: string[]) => void;
  onChange: (companions: AddTyped['companions']) => void;
}) {
  const { t } = useTranslation();
  const count = companions.length;

  return (
    <fieldset className="gs-fieldset gs-companions">
      <legend className="gs-legend">{t('guestList.companionsTitle')}</legend>
      <PlacesStepper
        host={host}
        names={companions.map((one) => one.name)}
        onStep={(kept, added) =>
          onChange([
            ...kept.flatMap((at) => companions[at] ?? []),
            ...Array.from({ length: added }, () => ({ name: '', needs: NO_NEEDS })),
          ])
        }
      />
      {companions.map(({ name, needs: theirs }, at) => {
        const placeholder =
          host === ''
            ? ''
            : at === 0
              ? t('guestList.guestOf', { host })
              : t('guestList.guestOfNth', { host, nth: at + 1 });
        const label = t('guestList.companionName', { nth: at + 1, total: count });
        const error = words(`companion-${at}`);

        return (
          <div key={at} className="gs-companion-block">
            <CompanionField
              at={at}
              name={name}
              host={host}
              label={label}
              placeholder={placeholder}
              error={error}
              onChange={(typed) =>
                onChange(
                  companions.map((each, index) => (index === at ? { ...each, name: typed } : each)),
                )
              }
              onRemove={() => {
                onChange(companions.filter((_, index) => index !== at));
                focus(`companion-${at + 1 < count ? at : at - 1}`, 'places');
              }}
            />
            <CompanionNeedsSection
              at={at}
              typed={theirs}
              needs={needs}
              onChange={(next) =>
                onChange(
                  companions.map((each, index) => (index === at ? { ...each, needs: next } : each)),
                )
              }
            />
          </div>
        );
      })}
      {count >= MOST_COMPANIONS && (
        <p className="gs-most">{t('guestList.mostCompanions', { most: MOST_COMPANIONS })}</p>
      )}
    </fieldset>
  );
}
