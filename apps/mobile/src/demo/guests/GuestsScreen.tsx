import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { type Href, router } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  type ScreenReaderTarget,
  moveScreenReaderFocus,
} from '../../components/screenReaderFocus.ts';
import { Text, type TextHandle } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { type AreaBadge, EventFrame } from '../events/EventFrame.tsx';
import { OfflineBand } from '../events/EventsList.tsx';
import type { Shown } from '../events/EventsModel.ts';
import type { AreaKey } from '../events/EventsSample.ts';
import { useShell } from '../../components/settingsShell.ts';
import { PHONE_TAB_BAR } from '../../components/TodayCover.tsx';
import { Ask } from '../../components/Summary.tsx';
import { AddGuest, ChoosePeople, ReviewList } from './GuestAdd.tsx';
import { EditGuest, MarkInvited, RecordReply } from './GuestEdit.tsx';
import { GuestPage } from './GuestPage.tsx';
import { AgreeWhatsApp } from './GuestWhatsApp.tsx';
import {
  type Counts,
  type FilterKey,
  GROUPS,
  type GroupKey,
  type GuestsState,
  type Person,
  ADD_STATES,
  AGREE_STATES,
  EDIT_STATES,
  RECORD_STATES,
  REVIEW_STATES,
  cardWords,
  countsAt,
  guestsOpening,
  groupRows,
  isIn,
  markedInvited,
  rowsOf,
} from './GuestsModel.ts';
import { GuestsFailed, GuestsLoading, GuestsRows } from './GuestsList.tsx';
import { GuestToast, GuestsCard, GuestsTitle, type Layout } from './GuestsParts.tsx';
import { type SampleGuest, TODAY, WEDDING } from './GuestsSample.ts';
import { W, say } from './GuestsWords.ts';

const SEARCH_PAUSE_MS = 300;
const FOCUS_AFTER_MS = 450;

/** Where the door opens from each day state: before 16:00 it says when it opens; from then it checks in. */
function doorFrom(state: GuestsState | null): string {
  return state === 'staffDayBefore' ? 'beforeOpen' : 'door';
}

/** The event's Guests in A: the card and its one step, Find a guest and the filter, the groups; a guest's page pushed in its place. */
export function GuestsScreen({
  state: given,
  event,
  now,
  more,
  onMore,
  onArea,
  badge,
  filterFrom,
  onWrite,
  onConversation,
  onMakeLive,
}: {
  state: GuestsState | null;
  event: Shown;
  now: Date;
  more: boolean;
  onMore: (open: boolean) => void;
  onArea: (area: AreaKey) => void;
  badge: AreaBadge | null;
  /** A count on Overview opens the guests it counts. */
  filterFrom: FilterKey | null;
  onWrite: () => void;
  onConversation: (guest: string) => void;
  onMakeLive: () => void;
}) {
  const shell = useShell();
  const layout: Layout = shell.layout;
  const insets = useSafeAreaInsets();
  const locale = formattingLocale('en', getLocales()[0]?.languageTag);
  const opening = useMemo(() => guestsOpening(given, event.id, locale), [given, event.id, locale]);
  const { state, start, role, replyBy } = opening;
  const [guests, setGuests] = useState(opening.guests);
  const [added, setAdded] = useState(opening.added);
  const [filter, setFilter] = useState<FilterKey>(filterFrom ?? start.filter);
  const [typed, setTyped] = useState(start.typed);
  const [searched, setSearched] = useState(start.typed);
  const [phase, setPhase] = useState(start.phase);
  const [offline, setOffline] = useState(start.offline);
  const [open, setOpen] = useState<string | null>(start.open);
  const [guestPhase, setGuestPhase] = useState(start.guestPhase);
  const [overlay, setOverlay] = useState(start.overlay);
  const [round, setRound] = useState(0);
  const [empty, setEmpty] = useState(start.empty);
  const [expanded, setExpanded] = useState<GroupKey[]>([]);
  const [toast, setToast] = useState<{ words: string; mark?: boolean } | null>(
    start.toast === 'saved'
      ? { words: W.saved }
      : start.toast === 'copied'
        ? { words: W.linkCopied, mark: true }
        : start.toast === 'manyAdded'
          ? { words: say.manyAdded(start.added) }
          : null,
  );
  const [replies, setReplies] = useState(start.replies);
  const [replaced, setReplaced] = useState(start.replaced);
  const [notReplaced, setNotReplaced] = useState(start.notReplaced);
  const [status, setStatus] = useState<string | null>(start.recorded ? W.recorded : null);
  const refs = useRef<Partial<Record<string, ViewInstance | null>>>({});
  const from = useRef<string>('card');
  const nameRef = useRef<TextHandle>(null);
  const fieldRef = useRef<TextInputInstance>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const opener = useMemo(
    () => ({
      get current(): ScreenReaderTarget | null {
        return refs.current[from.current] ?? null;
      },
    }),
    [],
  );
  const first = round === 0 ? state : null;
  const counts: Counts = countsAt(state, event.id, guests, added);
  const total = counts.list;
  const contacts = role === 'owner';
  const owner = role === 'owner';
  const guest = guests.find((g) => g.key === open) ?? null;
  const looking = filter !== 'all' || searched.trim() !== '';

  useEffect(() => {
    if (typed === searched) return;
    const wait = setTimeout(() => setSearched(typed), SEARCH_PAUSE_MS);
    return () => clearTimeout(wait);
  }, [typed, searched]);

  const refFor = useCallback(
    (key: string) => (node: ViewInstance | null) => {
      refs.current[key] = node;
    },
    [],
  );
  const openGuest = (key: string, row: string) => {
    from.current = row;
    setStatus(null);
    setNotReplaced(false);
    setReplies(null);
    setReplaced(false);
    setGuestPhase('ok');
    setOpen(key);
    if (layout !== 'landscape') scroll.current?.scrollTo({ y: 0, animated: false });
    setTimeout(() => moveScreenReaderFocus(nameRef.current), FOCUS_AFTER_MS);
  };
  const closeGuest = () => {
    const back = from.current;
    setOpen(null);
    setTimeout(() => moveScreenReaderFocus(refs.current[back] ?? null), FOCUS_AFTER_MS);
  };
  const show = (next: typeof overlay, opened: string) => {
    from.current = opened;
    setRound((count) => count + 1);
    setOverlay(next);
  };
  const close = () => setOverlay(null);
  const onStep = () => {
    const words = cardWords(state, role, counts, empty, locale, replyBy);
    if (words.step === 'addGuest') show('add', 'card');
    else if (words.step === 'write') onWrite();
    else if (words.step === 'makeLive') onMakeLive();
    else if (words.step === 'openCheckIn')
      router.push(`/demo/guests/check-in?state=${doorFrom(state)}` as Href);
  };
  const chooseFilter = (key: FilterKey) => {
    setFilter(key);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const replace = (g: SampleGuest) =>
    setGuests((all) => all.map((one) => (one.key === g.key ? g : one)));

  const words = cardWords(state, role, counts, empty, locale, replyBy);
  const stepLabel: Record<NonNullable<typeof words.step>, string> = {
    addGuest: W.addGuest,
    write: W.writeToThem,
    makeLive: W.makeLive,
    openCheckIn: W.openCheckIn,
  };
  const rows: Person[] = looking ? rowsOf(guests, filter, searched, locale, replyBy, contacts) : [];
  const groups: Partial<Record<GroupKey, Person[]>> = {};
  if (!looking)
    for (const group of GROUPS)
      groups[group] = groupRows(
        guests,
        group,
        locale,
        replyBy,
        event.id !== WEDDING || expanded.includes(group),
      );
  const showAll = (group: GroupKey) => {
    const before = new Set((groups[group] ?? []).map((p) => p.key));
    const next = groupRows(guests, group, locale, replyBy, true).find((p) => !before.has(p.key));
    setExpanded((was) => [...was, group]);
    if (next != null)
      setTimeout(() => moveScreenReaderFocus(refs.current[next.key] ?? null), FOCUS_AFTER_MS);
  };

  const list = (
    <>
      <GuestsTitle
        layout={layout}
        plus={owner && phase !== 'loading' && !empty}
        onPlus={() => show('add', 'plus')}
      />
      {phase === 'loading' ? (
        <GuestsLoading cardHeight={layout === 'landscape' ? 140 : 180} />
      ) : phase === 'failed' ? (
        <GuestsFailed onRetry={() => setPhase('ok')} />
      ) : (
        <>
          {searched.trim() === '' && (
            <GuestsCard
              event={event}
              words={words}
              layout={layout}
              onStep={onStep}
              stepLabel={words.step == null ? null : stepLabel[words.step]}
            />
          )}
          {!empty && (
            <GuestsRows
              layout={layout}
              counts={counts}
              total={total}
              filter={filter}
              onFilter={chooseFilter}
              typed={typed}
              onTyped={(text) => {
                setTyped(text);
                if (text === '') setSearched('');
              }}
              searched={searched}
              onSearch={() => setSearched(typed)}
              menu={start.menu}
              rows={rows}
              groups={groups}
              walkIns={looking ? [] : rowsOf(guests, 'walkin', '', locale, replyBy)}
              expanded={expanded}
              onShowAll={showAll}
              lit={layout === 'landscape' ? open : null}
              onOpen={openGuest}
              refFor={refFor}
              fieldRef={fieldRef}
            />
          )}
        </>
      )}
    </>
  );

  const page =
    guest != null || guestPhase !== 'ok' ? (
      <GuestPage
        replyBy={replyBy}
        event={event}
        guest={guest}
        phase={guestPhase}
        role={role === 'staff' ? 'viewer' : role}
        layout={layout}
        locale={locale}
        replies={replies}
        replaced={replaced}
        notReplaced={notReplaced}
        status={status}
        invites={event.status !== 'draft'}
        nameRef={nameRef}
        refFor={refFor}
        actions={{
          onRecord: () => show('record', 'record'),
          onEdit: () => show('edit', 'edit'),
          onCopy: () => {
            from.current = 'copy';
            setToast({ words: W.linkCopied, mark: guest?.kind === 'notyet' });
          },
          onReplace: () => show('replace', 'replace'),
          onMark: () => show('mark', 'mark'),
          onAgree: () => show('whatsApp', 'whatsApp'),
          onLetChange: () => setReplies('reopened'),
          onConversation: () => onConversation(open ?? ''),
          onBack: closeGuest,
        }}
      />
    ) : null;

  const told =
    toast == null ? null : (
      <GuestToast
        words={toast.words}
        action={
          toast.mark === true
            ? {
                label: W.markAsInvited,
                onPress: () => {
                  setToast(null);
                  show('mark', 'copy');
                },
              }
            : null
        }
        onClose={() => setToast(null)}
        bottom={
          layout === 'phone'
            ? Math.max(insets.bottom - tokens.spaceXxs, tokens.spaceLg) +
              PHONE_TAB_BAR +
              tokens.spaceXl
            : Math.max(insets.bottom, tokens.spaceLg)
        }
      />
    );

  const adding =
    overlay === 'add' || overlay === 'picker' || overlay === 'android' || overlay === 'review';
  const overlays = (
    <>
      {guest != null && (
        <>
          <EditGuest
            key={`edit:${round}`}
            open={overlay === 'edit'}
            guest={guest}
            guests={guests}
            start={first != null && isIn(EDIT_STATES, first) ? first : null}
            opener={opener}
            onClose={close}
            onSaved={(next) => {
              replace(next);
              close();
              setToast({ words: W.saved });
            }}
          />
          <RecordReply
            locale={locale}
            key={`record:${round}`}
            open={overlay === 'record'}
            guest={guest}
            start={first != null && isIn(RECORD_STATES, first) ? first : null}
            opener={opener}
            onClose={close}
            onSaved={(next) => {
              replace(next);
              close();
              setReplies(null);
              setStatus(W.recorded);
            }}
          />
          <AgreeWhatsApp
            key={`whatsApp:${round}`}
            open={overlay === 'whatsApp'}
            guest={guest}
            start={first != null && isIn(AGREE_STATES, first) ? first : null}
            opener={opener}
            onClose={close}
            onSaved={(next) => {
              replace(next);
              from.current = 'whatsAppRow';
              close();
              setToast({ words: W.saved });
            }}
          />
          <MarkInvited
            key={`mark:${round}`}
            open={overlay === 'mark'}
            start={
              first === 'markAsInvited' || first === 'markRefused' || first === 'markNotSaved'
                ? first
                : null
            }
            opener={opener}
            onClose={close}
            onMarked={(how) => {
              replace(markedInvited(guest, how, TODAY));
              close();
            }}
          />
          <Ask
            open={overlay === 'replace'}
            opener={opener}
            title={say.replaceTitle(guest.name)}
            line={W.replaceLine}
            keep={{ label: W.replaceKeep, testID: 'guest.replace.keep' }}
            confirm={{ label: W.replaceDo, testID: 'guest.replace.do' }}
            onKeep={close}
            onConfirm={() => {
              close();
              setNotReplaced(false);
              setReplaced(true);
            }}
            width={340}
          />
        </>
      )}
      {(adding || round > 0) && (
        <>
          <AddGuest
            key={`add:${round}`}
            open={overlay === 'add' || overlay === 'picker'}
            start={first != null && isIn(ADD_STATES, first) ? first : null}
            guests={guests}
            opener={opener}
            onClose={close}
            onAdded={(g) => {
              setEmpty(false);
              setGuests((all) => [...all, g].sort((a, b) => a.name.localeCompare(b.name)));
            }}
            onFromContacts={() => setOverlay(Platform.OS === 'android' ? 'android' : 'picker')}
            picking={overlay === 'picker'}
            onPicked={() => setOverlay('review')}
            onPickClose={() => setOverlay('add')}
          />
          <ChoosePeople
            key={`android:${round}`}
            open={overlay === 'android'}
            start={first != null && isIn(ADD_STATES, first) ? first : null}
            opener={opener}
            onClose={() => setOverlay('add')}
            onReview={() => setOverlay('review')}
          />
          <ReviewList
            key={`review:${round}`}
            open={overlay === 'review'}
            start={first != null && isIn(REVIEW_STATES, first) ? first : null}
            opener={opener}
            onClose={() => setOverlay('add')}
            onAdded={(count) => {
              setAdded((was) => was + count);
              setOverlay(null);
              setFilter('all');
              setToast({ words: say.manyAdded(count) });
            }}
            onPickAgain={() => setOverlay(Platform.OS === 'android' ? 'android' : 'picker')}
          />
        </>
      )}
      {told}
    </>
  );

  const band = offline && <OfflineBand onRetry={() => setOffline(false)} testID="guests.offline" />;

  if (layout === 'landscape')
    return (
      <EventFrame
        event={event}
        now={now}
        area="guests"
        onArea={onArea}
        more={more}
        onMore={onMore}
        fill
        badge={badge}
        overlay={overlays}
      >
        {band}
        <View style={styles.panes}>
          <ScrollView
            ref={scroll}
            style={styles.listPane}
            contentContainerStyle={styles.listBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {list}
          </ScrollView>
          <ScrollView
            style={styles.grow}
            contentContainerStyle={styles.guestBody}
            showsVerticalScrollIndicator={false}
          >
            {page ?? <Nobody />}
          </ScrollView>
        </View>
      </EventFrame>
    );

  return (
    <EventFrame
      event={event}
      now={now}
      area="guests"
      onArea={onArea}
      more={more}
      onMore={onMore}
      badge={badge}
      scrollRef={scroll}
      back={page != null ? { label: W.guests, onPress: closeGuest } : null}
      overlay={overlays}
    >
      {page ?? (
        <>
          {band && (
            <View style={layout === 'phone' ? styles.bandPhone : styles.bandWide}>{band}</View>
          )}
          {list}
        </>
      )}
    </EventFrame>
  );
}

function Nobody(): ReactNode {
  return (
    <View style={styles.nobody}>
      <Text size={15} weight="medium" style={styles.secondary}>
        {W.pickAGuest}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  panes: { flex: 1, flexDirection: 'row' },
  listPane: { width: 400, flexGrow: 0, borderRightWidth: 1, borderRightColor: tokens.colorBorder },
  listBody: { paddingTop: 22, paddingHorizontal: 20, paddingBottom: tokens.space6xl * 2, gap: 18 },
  guestBody: { paddingTop: 22, paddingHorizontal: 32, paddingBottom: tokens.space6xl * 2, gap: 18 },
  bandPhone: { marginHorizontal: -tokens.spaceXxl },
  bandWide: { marginHorizontal: -tokens.space5xl },
  nobody: { paddingTop: 120, alignItems: 'center' },
});
