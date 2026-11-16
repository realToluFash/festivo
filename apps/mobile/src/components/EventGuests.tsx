import {
  type Guest,
  type GuestInvitationHow,
  type GuestList,
  type Headcount,
  type OrganisationEvent,
  type TaggedGuest,
  ApiError,
  ApiUnreachableError,
  realtimeTopic,
} from '@soirely/api-client';
import {
  REPLY_KEY,
  type Choice,
  type Counts,
  type EventPhase,
  type Person,
  type Standing,
  countsOf,
  eventAllows,
  hasAllergy,
  haventLine,
  invitationLine,
  repliedRefusal,
  replyDate,
  roleHolds,
  rowWords,
  shownReply,
  viewOf,
} from '@soirely/domain';
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
  type TextInputInstance,
  type ViewInstance,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { followReadingAgain } from '../followTopic.ts';
import { dateLocale } from '../i18n/index.ts';
import type { Shown } from '../kit/eventsList.ts';
import { sidebarCardOf } from '../kit/eventTop.ts';
import { type PhaseCard, filterChoices, markOf, phaseCardOf } from '../kit/guestRows.ts';
import { pasteShown, waiting, whoseRows } from '../kit/pasteReply.ts';
import { type GuestReplies, guestRepliesOf, guestReplyBy } from '../kit/replyBy.ts';
import { type ScreenOffline, useHandOffline, useOffline } from '../offline.ts';
import { useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { SearchField } from './EventsSearch.tsx';
import { Glyph } from './Glyph.tsx';
import { GuestDetails, type GuestNotice, type GuestPane } from './GuestDetails.tsx';
import { GuestRecord } from './GuestRecord.tsx';
import { GuestForm, type GuestFormMode } from './GuestForm.tsx';
import { AllergyMark } from './GuestNeeds.tsx';
import { GuestsCard } from './GuestsCard.tsx';
import { type MarkRefusal, MarkInvited } from './GuestInvitation.tsx';
import { DraftRow, useMakeLive } from './MakeLive.tsx';
import { type ScreenReaderTarget, moveScreenReaderFocus } from './screenReaderFocus.ts';
import type { LayoutKind } from '../layout/useLayout.ts';
import { type ListAndPageSpacing, ListAndPage, useListAndPageLayout } from './ListAndPage.tsx';
import { LIST_EDGES } from './listFrame.ts';
import { useReadOut } from './ReadOut.tsx';
import {
  GroupHead,
  PasteButton,
  PasteNotice,
  PasteRow,
  WhoseReply,
  usePaste,
} from './PasteReply.tsx';
import { MarkSlot } from './ReplyMark.tsx';
import { FailedBlock, type StepProps } from './Summary.tsx';
import {
  type Anchor,
  AnchoredMenu,
  anchorUnder,
  useAnchorFollowsTurn,
} from './SummaryOverlays.tsx';
import { Row, RowList, TextAction } from './SummaryRows.tsx';
import { Text, type TextHandle } from './Text.tsx';

/** How often the list is read again while open with no live line to the hub: changes from others show within 10 seconds. */
const READ_AGAIN_MS = 10_000;
const FOCUS_AFTER_MS = 450;

/** sc-54450's copied message and where the host is with it; it lives here only, and goes when Guests is shown again. */
interface Pasted {
  quote: string;
  all: boolean;
  typed: string;
}

type Load =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'loaded'; list: GuestList; headcount: Headcount };

const CHOICE_KEY: Record<Choice, string> = {
  all: 'guestList.all',
  invited: 'guestList.invited',
  coming: REPLY_KEY.coming,
  maybe: REPLY_KEY.maybe,
  noReply: REPLY_KEY.noReply,
  held: REPLY_KEY.held,
  notComing: REPLY_KEY.notComing,
  notYetInvited: REPLY_KEY.notYetInvited,
};

/** What Guests puts in the frame's top: Add guest at the end of the title row, and on a phone the ‹ back to the list from a guest's details. */
export interface GuestsTop {
  add: (() => void) | null;
  back: (() => void) | null;
  toSearch: boolean;
}

/** An event's Guests in the app (sc-3785): the list to find and read a guest, and the small edits; planning at scale stays on the web. */
export function EventGuests({
  event,
  filter = 'all',
  opens,
  leave,
  phase,
  now,
  heading,
  addRef,
  onTop,
  onOffline,
  onEventChange,
  onEventStale,
}: {
  event: OrganisationEvent;
  /** The choice it opens on: a figure elsewhere opens the guests it counts (sc-3786). */
  filter?: Choice;
  /** The guest whose details it opens on (sc-39534). */
  opens?: string | undefined;
  /** Back from the guest it opened on leaves the event, so a phone returns to Search with its term and matches (sc-39534). */
  leave?: (() => void) | undefined;
  phase: EventPhase | null;
  now: Date;
  heading: ReactNode;
  /** The frame's Add guest, where focus goes back once the form closes. */
  addRef: RefObject<ViewInstance | null>;
  onTop: (top: GuestsTop) => void;
  onOffline: (offline: ScreenOffline) => void;
  onEventChange: (event: OrganisationEvent) => void;
  /** A refusal said the event's phase moved on, so the event is read again for its line. */
  onEventStale: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { account } = useSignedIn();
  const eventId = event.id;
  const manages = roleHolds(event, 'guests.manage');
  const invites = phase != null && eventAllows(phase, 'invite');
  const { kind } = useListAndPageLayout(SPACING, 'nothing');
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [choice, setChoice] = useState<Choice>(filter);
  const [typed, setTyped] = useState('');
  const [expanded, setExpanded] = useState<ReadonlySet<Standing>>(new Set());
  const [open, setOpen] = useState<string | null>(opens ?? null);
  const [pane, setPane] = useState<GuestPane>({ kind: 'loading' });
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<GuestFormMode | null>(null);
  const [round, setRound] = useState(0);
  const [done, setDone] = useState<Done>(null);
  const [notice, setNotice] = useState<GuestNotice>(null);
  const [marking, setMarking] = useState<{ round: number; sending: boolean; refusal: MarkRefusal }>(
    { round: 0, sending: false, refusal: null },
  );
  const [markOpen, setMarkOpen] = useState(false);
  const [recording, setRecording] = useState<TaggedGuest | null>(null);
  const [pasted, setPasted] = useState<Pasted | null>(null);
  const [fromMessage, setFromMessage] = useState<Guest | null>(null);
  const whoseTitle = useRef<TextHandle>(null);
  const recordButton = useRef<ViewInstance>(null);
  const recordNotYet = useRef<ViewInstance>(null);
  const title = useRef<TextHandle>(null);
  const guestName = useRef<TextHandle>(null);
  const emptyAdd = useRef<ViewInstance>(null);
  const editButton = useRef<ViewInstance>(null);
  const markButton = useRef<ViewInstance>(null);
  const coverMark = useRef<ViewInstance>(null);
  const unmarkButton = useRef<ViewInstance>(null);
  const reopenButton = useRef<ViewInstance>(null);
  const [reopening, setReopening] = useState({ busy: false, failed: false });
  const liveOpener = useRef<ViewInstance>(null);
  const makeLive = useMakeLive({ event, onChange: onEventChange, opener: liveOpener });
  const unmarking = useRef(false);
  const markOpener = useRef<ScreenReaderTarget | null>(null);
  const searchField = useRef<TextInputInstance>(null);
  const opener = useRef<ViewInstance | null>(null);
  const reading = useRef<{ list: number; guest: number }>({ list: 0, guest: 0 });
  const loaded = load.kind === 'loaded';

  const readList = useCallback(
    (watch: <T>(load: Promise<T>) => Promise<T>) => {
      const mine = ++reading.current.list;

      watch(Promise.all([api.guests(eventId), api.headcount(eventId)])).then(
        ([list, headcount]) => {
          if (mine === reading.current.list) setLoad({ kind: 'loaded', list, headcount });
        },
        () => {
          if (mine === reading.current.list)
            setLoad((was) => (was.kind === 'loaded' ? was : { kind: 'failed' }));
        },
      );
    },
    [eventId],
  );

  const reloadRef = useRef<() => void>(() => undefined);
  const tags = useRef(new Map<string, TaggedGuest>());
  const offline = useOffline({
    loaded,
    reload: () => reloadRef.current(),
    focusTitle: () => title.current?.focus?.(),
  });
  const { watch, freshen, stale, refreshing } = offline;

  const askGuest = useCallback(
    (guestId: string, quiet: boolean) => {
      const mine = ++reading.current.guest;

      watch(api.guest(eventId, guestId)).then(
        (tagged) => {
          if (mine === reading.current.guest) setPane({ kind: 'guest', guest: tagged.guest });
          tags.current.set(guestId, tagged);
        },
        (error: unknown) => {
          if (mine !== reading.current.guest) return;
          if (error instanceof ApiError && error.status === 404) setPane({ kind: 'notFound' });
          else if (!quiet) setPane({ kind: 'failed' });
        },
      );
    },
    [eventId, watch],
  );
  const readGuest = useCallback(
    (guestId: string, quiet: boolean) => {
      if (!quiet) setPane({ kind: 'loading' });
      askGuest(guestId, quiet);
    },
    [askGuest],
  );
  const reload = useCallback(() => {
    readList(watch);
    if (open != null && form == null && recording == null) readGuest(open, true);
  }, [readList, watch, open, form, recording, readGuest]);

  useEffect(() => {
    reloadRef.current = reload;
  });

  useHandOffline(onOffline, { stale, refreshing });

  useEffect(() => {
    readList(watch);
  }, [readList, watch]);

  const [opening] = useState(opens);
  useEffect(() => {
    if (opening != null) askGuest(opening, false);
  }, [opening, askGuest]);

  useEffect(
    () =>
      followReadingAgain(
        realtimeTopic('EventGuests', eventId),
        () => api.guestsSubscription(eventId),
        () => reloadRef.current(),
        READ_AGAIN_MS,
      ),
    [eventId],
  );

  const openGuest = (guestId: string) => {
    setPasted(null);
    setSaved(false);
    setDone(null);
    setNotice(null);
    setOpen(guestId);
    readGuest(guestId, false);
  };
  const closeGuest = useCallback(() => {
    setOpen(null);
    setSaved(false);
    setNotice(null);
    setReopening({ busy: false, failed: false });
  }, []);
  const openWhose = useCallback((quote: string) => {
    setOpen(null);
    setDone(null);
    setPasted({ quote, all: false, typed: '' });
    setTimeout(() => moveScreenReaderFocus(whoseTitle.current), FOCUS_AFTER_MS);
  }, []);
  const paste = usePaste(openWhose);
  const closeWhose = useCallback(() => {
    setPasted(null);
    setTimeout(() => moveScreenReaderFocus(searchField.current), FOCUS_AFTER_MS);
  }, []);
  const leaveRef = useRef(leave);
  useEffect(() => {
    leaveRef.current = leave;
  });
  const leaveGuest = useCallback(() => {
    if (leaveRef.current != null) leaveRef.current();
    else closeGuest();
  }, [closeGuest]);
  const showGuest = (tagged: TaggedGuest) => {
    tags.current.set(tagged.guest.id, tagged);
    setPane({ kind: 'guest', guest: tagged.guest });
    readList(watch);
  };
  const startMark = (from: ViewInstance | null) => {
    markOpener.current = from;
    setNotice(null);
    setSaved(false);
    setMarking((was) => ({ round: was.round + 1, sending: false, refusal: null }));
    setMarkOpen(true);
  };
  const mark = (guestId: string, how: GuestInvitationHow) => {
    setMarking((was) => ({ ...was, sending: true, refusal: null }));
    api.markInvited(eventId, guestId, how).then(
      (tagged) => {
        markOpener.current = guestName.current;
        setMarking((was) => ({ ...was, sending: false }));
        setMarkOpen(false);
        showGuest(tagged);
      },
      (error: unknown) => {
        if (error instanceof ApiError && error.is('event_state_invalid')) {
          markOpener.current = guestName.current;
          setMarking((was) => ({ ...was, sending: false }));
          setMarkOpen(false);
          onEventStale();
          return;
        }
        setMarking((was) => ({
          ...was,
          sending: false,
          refusal: error instanceof ApiUnreachableError ? 'offline' : 'notSaved',
        }));
      },
    );
  };
  const unmark = (guestId: string) => {
    if (unmarking.current) return;
    unmarking.current = true;
    setNotice(null);
    setSaved(false);
    api
      .markNotInvited(eventId, guestId)
      .finally(() => {
        unmarking.current = false;
      })
      .then(
        (tagged) => {
          setNotice({ kind: 'unmarked' });
          showGuest(tagged);
          guestName.current?.focus?.();
        },
        (error: unknown) => {
          if (error instanceof ApiUnreachableError) {
            setNotice({ kind: 'offline' });
            return;
          }
          const refused = repliedRefusal(error);
          const name = pane.kind === 'guest' ? pane.guest.fullName : '';

          if (refused != null) {
            setNotice({
              kind: 'refused',
              line: t('guestList.unmarkRefused', {
                name,
                reply: t(REPLY_KEY[refused.reply]),
                date: replyDate(refused.at, event.timeZone, dateLocale()),
              }),
            });
            readGuest(guestId, true);
          } else setNotice({ kind: 'failed' });
        },
      );
  };
  const openForm = useCallback((mode: GuestFormMode, from: ViewInstance | null) => {
    opener.current = from;
    setRound((was) => was + 1);
    setForm(mode);
  }, []);
  const add = useCallback(() => openForm({ kind: 'add' }, addRef.current), [openForm, addRef]);

  const counts = loaded ? countsOf(load.headcount.counts) : null;
  const empty = loaded && load.list.guests.length === 0;
  const pageOpen = open != null || pasted != null;
  const guestInFront = pageOpen && kind !== 'tabletLandscape';
  const leavesFromGuest = leave != null && open != null && open === opening;
  const guestBack = leavesFromGuest ? leaveGuest : closeGuest;
  const back = pasted != null ? closeWhose : guestBack;
  const adds = manages && loaded && !empty && !guestInFront;
  const shown = sidebarCardOf(event, phase);

  useLayoutEffect(() => {
    onTop({
      add: adds ? add : null,
      back: guestInFront ? back : null,
      toSearch: guestInFront && leavesFromGuest,
    });
  }, [onTop, adds, add, guestInFront, back, leavesFromGuest]);
  useLayoutEffect(() => () => onTop({ add: null, back: null, toSearch: false }), [onTop]);

  const timeZone = event.timeZone;
  const locale = dateLocale();
  const replies = guestRepliesOf(event, now);
  const reopen = (guestId: string) => {
    setReopening({ busy: true, failed: false });
    api.reopenGuestReplies(eventId, guestId).then(
      (tagged) => {
        setReopening({ busy: false, failed: false });
        showGuest(tagged);
      },
      () => setReopening({ busy: false, failed: true }),
    );
  };

  const phaseLine =
    phase == null || loaded ? null : (
      <PhaseLine event={event} phase={phase} now={now} onChange={onEventChange} />
    );
  const phaseCard = phaseCardOf(t, event, shown, phase, now);
  const liveStep: StepProps = {
    label: t('eventLive.makeLive'),
    ref: liveOpener,
    onPress: makeLive.start,
    testID: 'events.makeLive',
  };
  const rows =
    load.kind === 'loading' ? (
      <GuestsLoading />
    ) : load.kind === 'failed' ? (
      <View accessibilityRole="alert">
        <FailedBlock
          title={t('guestList.loadFailed')}
          line={t('guestList.loadFailedLine')}
          onRetry={() => {
            setLoad({ kind: 'loading' });
            readList(watch);
          }}
          testID="guests.failed.retry"
        />
      </View>
    ) : empty || counts == null ? (
      <View testID="guests.empty">
        <GuestsCard
          kind={kind}
          event={shown}
          tags={phaseCard?.tags ?? []}
          says={t('guestList.noGuests')}
          heading
          line={phaseCard?.line ?? null}
          also={phaseCard?.offersMakeLive === true ? liveStep : null}
          step={
            manages
              ? {
                  label: t('guestList.addGuest'),
                  ref: emptyAdd,
                  onPress: () => openForm({ kind: 'add' }, emptyAdd.current),
                  testID: 'guests.add',
                }
              : null
          }
        />
      </View>
    ) : (
      <GuestRows
        list={load.list}
        counts={counts}
        choice={choice}
        onChoice={setChoice}
        typed={typed}
        onTyped={setTyped}
        expanded={expanded}
        onShowAll={(standing) => setExpanded((was) => new Set([...was, standing]))}
        open={open}
        onOpen={openGuest}
        done={done}
        card={shown}
        phaseCard={phaseCard}
        makeLive={liveStep}
        kind={kind}
        searchRef={searchField}
        timeZone={timeZone}
        locale={locale}
        manages={manages}
        replies={replies}
        pasteInRow={kind === 'tabletPortrait' ? <PasteButton onText={paste.onText} inRow /> : null}
        pasteUnder={
          kind === 'tabletPortrait' ? (
            paste.nothing ? (
              <PasteNotice />
            ) : null
          ) : (
            <PasteRow nothing={paste.nothing} onText={paste.onText} />
          )
        }
      />
    );
  const list = (
    <>
      {phaseLine}
      {rows}
      {loaded && makeLive.sheet}
    </>
  );

  const page =
    pasted != null && loaded ? (
      <WhoseReply
        kind={kind}
        quote={pasted.quote}
        all={pasted.all}
        onShowAll={() => setPasted({ ...pasted, all: true })}
        typed={pasted.typed}
        onTyped={(typed) => setPasted({ ...pasted, typed })}
        rows={whoseRows(load.list.guests, pasted.typed, t, timeZone, locale, i18n.language)}
        waiting={load.list.guests.filter(waiting).length}
        onPick={(guestId) => {
          const guest = load.list.guests.find((one) => one.id === guestId);
          if (guest == null) return;
          opener.current = null;
          setRound((was) => was + 1);
          setFromMessage(guest);
        }}
        onBack={closeWhose}
        titleRef={whoseTitle}
      />
    ) : open == null ? (
      <View style={styles.pick}>
        <Text size={15} weight="medium" style={styles.secondary}>
          {t('guestList.pick')}
        </Text>
      </View>
    ) : (
      <GuestDetails
        kind={kind}
        event={shown}
        pane={pane}
        manages={manages}
        timeZone={timeZone}
        replies={replies}
        reopen={{
          ...reopening,
          ref: reopenButton,
          onPress: () => {
            if (open != null) reopen(open);
          },
        }}
        saved={saved}
        notice={notice}
        invitation={phase === 'draft' ? null : { manages, invites }}
        nameRef={guestName}
        editRef={editButton}
        markRef={markButton}
        coverMarkRef={coverMark}
        unmarkRef={unmarkButton}
        onEdit={() => {
          const tagged = tags.current.get(open);
          if (tagged != null) openForm({ kind: 'edit', tagged }, editButton.current);
        }}
        onMark={() => startMark(markButton.current)}
        onCoverMark={() => startMark(coverMark.current)}
        recordRef={recordButton}
        recordNotYetRef={recordNotYet}
        onUnmark={() => unmark(open)}
        onRecord={() => {
          const tagged = tags.current.get(open);
          if (tagged == null) return;
          setNotice(null);
          setSaved(false);
          opener.current =
            shownReply(tagged.guest) === 'notYetInvited'
              ? recordNotYet.current
              : recordButton.current;
          setRound((was) => was + 1);
          setRecording(tagged);
        }}
        onBack={guestBack}
        onRetry={() => readGuest(open, false)}
      />
    );

  return (
    <>
      <ListAndPage
        kind={kind}
        heading={heading}
        list={list}
        listRefresh={
          loaded ? (
            <RefreshControl refreshing={refreshing} onRefresh={stale?.retry ?? freshen} />
          ) : undefined
        }
        page={page}
        pageKey={pasted != null ? 'paste' : (open ?? '')}
        pageInFront={pageOpen}
        pageless={!loaded || empty}
        back={{
          label: leavesFromGuest ? t('todayScreen.search') : t('guestList.backToGuests'),
          onPress: back,
          testID: 'guest.back',
        }}
        backInFrame
        headingInList
        spacing={SPACING}
      />
      {open != null && (
        <MarkInvited
          key={marking.round}
          open={markOpen}
          sending={marking.sending}
          refusal={marking.refusal}
          opener={markOpener}
          onClose={() => setMarkOpen(false)}
          onMark={(how) => mark(open, how)}
        />
      )}
      {pasted != null && fromMessage != null && (
        <GuestRecord
          key={round}
          open
          guest={fromMessage}
          message={{ quote: pasted.quote }}
          eventId={eventId}
          timeZone={event.timeZone}
          opener={whoseTitle}
          onClose={() => setFromMessage(null)}
          onGone={() => {
            setFromMessage(null);
            readList(watch);
          }}
          onSaved={() => {
            setFromMessage(null);
            setPasted(null);
            setDone({ kind: 'recorded' });
            readList(watch);
          }}
        />
      )}
      {recording != null && (
        <GuestRecord
          key={round}
          open
          guest={recording.guest}
          eventId={eventId}
          timeZone={event.timeZone}
          opener={opener}
          onClose={() => setRecording(null)}
          onGone={() => {
            setRecording(null);
            readGuest(recording.guest.id, false);
            readList(watch);
          }}
          onSaved={(tagged) => {
            opener.current =
              shownReply(recording.guest) === 'notYetInvited'
                ? recordButton.current
                : guestName.current;
            setRecording(null);
            setNotice({ kind: 'recorded' });
            showGuest(tagged);
          }}
        />
      )}
      {form != null && (
        <GuestForm
          key={round}
          open
          mode={form}
          eventId={eventId}
          startCountry={account?.organisationCountry ?? ''}
          groups={
            load.kind === 'loaded'
              ? load.list.groups.map((one) => ({
                  id: one.id,
                  name: one.name,
                  people: one.counts.people,
                }))
              : []
          }
          onGroupsStale={() => readList(watch)}
          opener={opener}
          onClose={() => setForm(null)}
          onSaved={({ guest, tagged }) => {
            setForm(null);
            if (tagged != null) {
              tags.current.set(guest.id, tagged);
              setPane({ kind: 'guest', guest: tagged.guest });
              setSaved(true);
            } else {
              setDone({ kind: 'added', name: guest.fullName });
              setChoice('all');
            }
            readList(watch);
          }}
        />
      )}
    </>
  );
}

function GuestRows({
  list,
  counts,
  choice,
  onChoice,
  typed,
  onTyped,
  expanded,
  onShowAll,
  open,
  onOpen,
  done,
  card,
  phaseCard,
  makeLive,
  kind,
  searchRef,
  timeZone,
  locale,
  manages,
  replies,
  pasteInRow,
  pasteUnder,
}: {
  list: GuestList;
  counts: Counts;
  choice: Choice;
  onChoice: (choice: Choice) => void;
  typed: string;
  onTyped: (typed: string) => void;
  expanded: ReadonlySet<Standing>;
  onShowAll: (standing: Standing) => void;
  open: string | null;
  onOpen: (guestId: string) => void;
  done: Done;
  card: Shown | null;
  phaseCard: PhaseCard | null;
  makeLive: StepProps;
  kind: LayoutKind;
  searchRef: React.RefObject<TextInputInstance | null>;
  timeZone: string;
  locale: string;
  /** The allergy mark is for people who manage guests (sc-3777). */
  manages: boolean;
  replies: GuestReplies;
  /** sc-54450's Paste a reply: in the search row on an upright iPad, under it on a phone and in the list pane. */
  pasteInRow: ReactNode;
  pasteUnder: ReactNode;
}) {
  const { t } = useTranslation();
  const { view, shown } = viewOf(list.guests, counts, choice, typed, expanded);
  const looking = choice !== 'all' || typed.trim() !== '';
  const noReply = choice === 'noReply';
  const clear = () => {
    onTyped('');
    onChoice('all');
  };
  const pastes = pasteShown(manages, replies.closedOn, counts.invited);
  const says =
    counts.invited === 0 || phaseCard?.onList === true
      ? t('guestList.onTheList', { count: counts.all })
      : t('guestList.comingOf', {
          comingWords: t('guestList.countComing', { count: counts.coming }),
          invitedWords: t('guestList.countInvited', { count: counts.invited }),
        });
  const row = (person: Person, indent: boolean) => {
    const { name, line } = rowWords(t, person, indent, timeZone, locale, {
      places: noReply ? null : 'counted',
      contact: false,
      group: true,
      invitation:
        noReply && person.companion == null
          ? invitationLine(t, person.guest, timeZone, locale)
          : person.companion == null && person.guest.repliedAt != null
            ? guestReplyBy(
                person.guest,
                shownReply(person.guest),
                replies,
                manages,
                timeZone,
                locale,
                t,
              ).reply
            : null,
    });
    const allergy =
      manages &&
      (person.companion == null
        ? [person.guest, ...person.guest.companions].some((one) => hasAllergy(one.needs))
        : hasAllergy(person.companion.needs));
    const selected = open === person.guest.id && person.companion == null;
    const item = (
      <Row
        title={name}
        line={line}
        below={allergy ? <AllergyMark testID={`guests.row.${person.id}.allergy`} /> : undefined}
        lead={<MarkSlot kind={markOf(person.standing)} />}
        opens
        selected={selected}
        pad={person.companion == null ? 11 : 8}
        onPress={() => onOpen(person.guest.id)}
        accessibilityLabel={[name, line, allergy ? t('guestNeeds.allergy') : null]
          .filter((part) => part != null)
          .join(', ')}
        testID={`guests.row.${person.id}`}
      />
    );

    return {
      key: person.id,
      inset: indent ? 80 : 40,
      selected,
      row: indent ? <View style={styles.indent}>{item}</View> : item,
    };
  };

  return (
    <View style={styles.rows}>
      {done?.kind === 'added' && <DoneLine words={t('guestList.justAdded', { name: done.name })} />}
      {done?.kind === 'recorded' && (
        <DoneLine words={t('guestList.replyRecorded')} testID="guests.recorded" />
      )}
      {typed.trim() === '' && (
        <GuestsCard
          kind={kind}
          event={card}
          tags={phaseCard?.tags ?? []}
          says={says}
          line={phaseCard?.line ?? (counts.invited > 0 ? haventLine(t, counts) : null)}
          step={phaseCard?.offersMakeLive === true ? makeLive : null}
        />
      )}
      <View style={styles.searchRow}>
        <SearchField
          typed={typed}
          off={false}
          width={null}
          onTyped={onTyped}
          onSearch={() => undefined}
          onClear={() => onTyped('')}
          label={t('guestList.find')}
          testID="guests.search"
          ref={searchRef}
        />
        <FilterChoice choice={choice} counts={counts} onChoose={onChoice} />
        {pastes && pasteInRow}
      </View>
      {pastes && pasteUnder}
      {view.kind === 'rows' ? (
        <View>
          {looking && (
            <View style={styles.shownRow}>
              <Text
                size={14.5}
                weight="medium"
                style={[styles.secondary, styles.figures, styles.grow]}
              >
                {t('guestList.shown', { shown, total: counts.all })}
              </Text>
              <TextAction label={t('guestList.clear')} onPress={clear} testID="guests.clear" />
            </View>
          )}
          {view.rows.length === 0 ? (
            <NoMatch onClear={clear} />
          ) : (
            <RowList items={view.rows.map(({ person, indent }) => row(person, indent))} />
          )}
        </View>
      ) : (
        view.groups.map((group) => (
          <View key={group.standing} testID={`guests.group.${group.standing}`}>
            <GroupHead word={t(REPLY_KEY[group.standing])} count={group.count} />
            <RowList items={group.rows.map(({ person, indent }) => row(person, indent))} />
            {group.collapsed && (
              <TextAction
                label={t('guestList.showAll', { count: group.count })}
                figures
                onPress={() => onShowAll(group.standing)}
                testID={`guests.showAll.${group.standing}`}
              />
            )}
          </View>
        ))
      )}
    </View>
  );
}

/** The filter beside Find a guest: "All · 156", and the house menu under it with each choice counted. */
function FilterChoice({
  choice,
  counts,
  onChoose,
}: {
  choice: Choice;
  counts: Counts;
  onChoose: (choice: Choice) => void;
}) {
  const { t } = useTranslation();
  const trigger = useRef<ViewInstance>(null);
  const first = useRef<ViewInstance>(null);
  const [at, setAt] = useState<Anchor | null>(null);
  useAnchorFollowsTurn(trigger, at != null, setAt);
  const word = t(CHOICE_KEY[choice]);
  const figure = t('guestList.figure', { count: counts[choice] });

  return (
    <>
      <TextAction
        ref={trigger}
        label={`${word} · ${figure}`}
        after="down"
        figures
        onPress={() => anchorUnder(trigger, setAt)}
        testID="guests.filter"
      />
      <AnchoredMenu
        at={at}
        onClose={() => setAt(null)}
        opener={trigger}
        first={first}
        width={230}
        testID="guests.filter.menu"
      >
        {filterChoices(counts, choice).map((key, index) => {
          const on = key === choice;
          const n = t('guestList.figure', { count: counts[key] });

          return (
            <Pressable
              key={key}
              ref={index === 0 ? first : undefined}
              onPress={() => {
                setAt(null);
                onChoose(key);
              }}
              style={({ pressed }) => [
                styles.menuRow,
                key === 'invited' && styles.menuApart,
                pressed && styles.menuPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${t(CHOICE_KEY[key])}, ${n}`}
              testID={`guests.filter.${key}`}
            >
              <View style={styles.menuTick}>
                {on && <Glyph name="tick" size={16} ink={tokens.colorAccentText} weight={2.6} />}
              </View>
              <Text
                size={16}
                weight={on ? 'semibold' : 'medium'}
                accessible={false}
                style={[styles.grow, on && styles.accent]}
              >
                {t(CHOICE_KEY[key])}
              </Text>
              <Text
                size={15}
                weight="medium"
                accessible={false}
                style={[styles.secondary, styles.figures]}
              >
                {n}
              </Text>
            </Pressable>
          );
        })}
      </AnchoredMenu>
    </>
  );
}

/** Before the list is read, the phase's line stands above where the card will be: a Draft's with Make live, a Paused or Finished event's alone (sc-46879). */
function PhaseLine({
  event,
  phase,
  now,
  onChange,
}: {
  event: OrganisationEvent;
  phase: EventPhase;
  now: Date;
  onChange: (event: OrganisationEvent) => void;
}) {
  const { t } = useTranslation();

  if (phase === 'draft')
    return (
      <DraftRow
        event={event}
        manages={roleHolds(event, 'events.manage')}
        now={now}
        onChange={onChange}
      />
    );
  if (phase !== 'paused' && phase !== 'finished') return null;

  return (
    <Text size={15} weight="medium" style={styles.secondary} testID="guests.phaseLine">
      {t(phase === 'paused' ? 'guestList.pausedLine' : 'guestList.finishedLine')}
    </Text>
  );
}

/** The one done line over the list: a guest just added, or sc-54450's reply just recorded from a copied message. */
type Done = { kind: 'added'; name: string } | { kind: 'recorded' } | null;

function DoneLine({ words, testID = 'guests.added' }: { words: string; testID?: string }) {
  useReadOut(words);

  return (
    <View style={styles.added} testID={testID}>
      <Glyph name="tick" size={18} ink={tokens.colorAccentText} weight={2.6} />
      <Text size={15} weight="semibold" style={styles.grow}>
        {words}
      </Text>
    </View>
  );
}

function NoMatch({ onClear }: { onClear: () => void }) {
  const { t } = useTranslation();
  useReadOut(t('guestList.noMatch'));

  return (
    <View style={styles.noMatch} testID="guests.noMatch">
      <Text size={18} weight="bold" accessibilityRole="header">
        {t('guestList.noMatch')}
      </Text>
      <Text size={15} weight="medium" style={styles.secondary}>
        {t('guestList.noMatchLine')}
      </Text>
      <TextAction label={t('guestList.clear')} onPress={onClear} testID="guests.noMatch.clear" />
    </View>
  );
}

function GuestsLoading() {
  const { t } = useTranslation();
  useReadOut(t('pending.loading'));

  return (
    <View
      style={styles.loading}
      accessible
      accessibilityLabel={t('pending.loading')}
      testID="guests.loading"
    >
      <View style={styles.sunkField} />
      {['58%', '46%', '64%', '50%', '54%'].map((width) => (
        <View key={width} style={styles.sunkRow}>
          <View style={styles.sunkDisc} />
          <View style={[styles.barThick, { width: width as `${number}%` }]} />
        </View>
      ))}
    </View>
  );
}

const LIST_GAP = 18;

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  figures: { fontVariant: ['tabular-nums'] },
  rows: { gap: LIST_GAP },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shownRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  indent: { paddingLeft: 40 },
  pick: { paddingTop: 120, alignItems: 'center' },
  added: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  noMatch: { gap: 6, paddingTop: tokens.spaceXs },
  menuRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingHorizontal: tokens.spaceLg,
  },
  menuApart: {
    marginBottom: tokens.spaceXs,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorBorder,
  },
  menuPressed: { backgroundColor: tokens.colorInset },
  menuTick: { width: 18, alignItems: 'center' },
  loading: { gap: LIST_GAP },
  sunkField: { height: 48, borderRadius: 14, backgroundColor: tokens.colorNeutralFill },
  sunkRow: { height: 64, flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  sunkDisc: {
    width: 22,
    height: 22,
    marginHorizontal: 3,
    borderRadius: 11,
    backgroundColor: tokens.colorNeutralFill,
  },
  barThick: { height: 14, borderRadius: 7, backgroundColor: tokens.colorNeutralFill },
  phone: { ...LIST_EDGES.phone, gap: LIST_GAP, paddingBottom: tokens.space6xl * 2 },
  portrait: { ...LIST_EDGES.tabletPortrait, gap: LIST_GAP, paddingBottom: tokens.space6xl * 2 },
  landscape: { ...LIST_EDGES.tabletLandscape, gap: LIST_GAP },
  column: { gap: LIST_GAP, paddingBottom: tokens.space6xl * 2 },
  ruledList: {
    paddingTop: 22,
    paddingHorizontal: tokens.spaceXxl,
    gap: LIST_GAP,
    paddingBottom: tokens.space6xl * 2,
  },
  ruledPage: {
    paddingTop: 22,
    paddingHorizontal: 32,
    gap: LIST_GAP,
    paddingBottom: tokens.space6xl * 2,
  },
});

const SPACING: ListAndPageSpacing = {
  phone: styles.phone,
  tabletPortrait: styles.portrait,
  landscape: styles.landscape,
  column: styles.column,
  listWidth: 400,
  between: tokens.spaceXxl,
  ruled: { list: styles.ruledList, page: styles.ruledPage },
};
