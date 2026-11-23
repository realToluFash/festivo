import { exportFileName, exportNarrowing, formattingLocale } from '@soirely/domain';
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
import { useTranslation } from 'react-i18next';
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
import { useSideListWidth } from '../../layout/useLayout.ts';
import { Ask } from '../../components/Summary.tsx';
import { AddGuest, ChoosePeople, ReviewList } from './GuestAdd.tsx';
import { EditGuest, MarkInvited, RecordReply } from './GuestEdit.tsx';
import { GuestPage } from './GuestPage.tsx';
import { AgreeWhatsApp } from './GuestWhatsApp.tsx';
import {
  type Counts,
  type ListFilter,
  GROUPS,
  type GroupKey,
  type GuestsState,
  type Person,
  ADD_STATES,
  AGREE_STATES,
  EDIT_STATES,
  PASTE_STATES,
  RECORD_STATES,
  REVIEW_STATES,
  cardWords,
  notCopiedLine,
  countsAt,
  guestsOpening,
  groupRows,
  isIn,
  markedInvited,
  markedNotInvited,
  rowsOf,
  changedRows,
  filterCount,
  filterWord,
  inViewOf,
  refreshingAt,
  titleRowOf,
  chooseChanged,
} from './GuestsModel.ts';
import { RefreshingWords } from './RefreshingWords.tsx';
import { changesSince, lastLooked, takeLook } from './ChangedSince.ts';
import { ExportButton, ExportPanel, ExportSheet, ShareStandIn } from './GuestExport.tsx';
import {
  ENGLISH_SHEET,
  exportDay,
  exportStart,
  exportWordsIn,
  exportedName,
  fileName,
  narrowing,
  sheetWordsIn,
} from './GuestExportModel.ts';
import { GuestsFailed, GuestsLoading, GuestsRows } from './GuestsList.tsx';
import { GuestToast, GuestsCard, GuestsTitle, type Layout } from './GuestsParts.tsx';
import { type SampleGuest, TODAY, WEDDING } from './GuestsSample.ts';
import { W, say } from './GuestsWords.ts';
import {
  PasteButton,
  PasteDemo,
  PasteNotice,
  PasteRow,
  WhoseReply,
  usePaste,
} from './PasteReply.tsx';
import {
  type PasteFlow,
  pasteShown,
  pasteStart,
  waitingCount,
  whoseRows,
} from './PasteReplyModel.ts';

/** The Portuguese catalogue's word for a filter, for the Export sheet's Filtro line (sc-72136). */
const PT_FILTER: Partial<Record<string, string>> = {
  all: 'guestList.all',
  invited: 'guestList.invited',
  coming: 'guestList.reply.coming',
  maybe: 'guestList.reply.maybe',
  notcoming: 'guestList.reply.notComing',
  held: 'guestList.reply.held',
  noreply: 'guestList.reply.noReply',
  notyet: 'guestList.reply.notYetInvited',
};
const SEARCH_PAUSE_MS = 300;
const FOCUS_AFTER_MS = 450;
// As the product's Guests list on a tablet on its side, widened at the accessibility sizes (sc-67659).
const LIST_WIDTH = 400;

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
  sinceFrom = null,
  behind,
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
  /** A count on Overview opens the guests it counts; the bell's Guest replies item opens Changed since you looked (sc-4331). */
  filterFrom: ListFilter | null;
  /** sc-4331: the last look the bell's item counts from, taken before it marked the item read. */
  sinceFrom?: string | null;
  /** Upright, ‹ above the list names the screen the event was opened over, as at its other areas: Event over another event's page from the bell (sc-84453). */
  behind?: { label: string; onPress: () => void } | undefined;
  onWrite: () => void;
  onConversation: (guest: string) => void;
  onMakeLive: () => void;
}) {
  const shell = useShell();
  const layout: Layout = shell.layout;
  const listWidth = useSideListWidth(LIST_WIDTH);
  const insets = useSafeAreaInsets();
  const locale = formattingLocale('en', getLocales()[0]?.languageTag);
  const opening = useMemo(() => guestsOpening(given, event.id, locale), [given, event.id, locale]);
  const { state, start, role, replyBy } = opening;
  const pasted = useMemo(() => pasteStart(state), [state]);
  const [paste, setPaste] = useState<PasteFlow | null>(pasted.flow);
  const { t, i18n } = useTranslation();
  const titleRow = titleRowOf(state);
  const inPortuguese = titleRow.locale === 'pt';
  const portuguese = useMemo(() => i18n.getFixedT('pt'), [i18n]);
  // sc-71821: on the phone Refreshing… keeps main's place beside Back where the pill stays whole, else it takes its own line under the heading.
  const [besideBack, setBesideBack] = useState(false);
  const refreshing = refreshingAt(state) ? (
    <RefreshingWords
      words={inPortuguese ? portuguese('eventsScreen.refreshing') : t('eventsScreen.refreshing')}
      testID="guests.refreshing"
    />
  ) : null;
  const [guests, setGuests] = useState(opening.guests);
  const [added, setAdded] = useState(opening.added);
  const [filter, setFilter] = useState<ListFilter>(filterFrom ?? start.filter);
  const [since, setSince] = useState(filterFrom === 'changed' ? sinceFrom : start.since);
  const [looked, setLooked] = useState(lastLooked);
  const changeFails = useRef(start.changeFails !== null);
  const [changeFailed, setChangeFailed] = useState(start.changeFails === 'failed');
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
    pasted.recorded
      ? { words: W.recorded }
      : start.toast === 'saved'
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
  const [flagged, setFlagged] = useState(start.flagged);
  const [copyFailed, setCopyFailed] = useState(start.copyFailed);
  const [unmarked, setUnmarked] = useState(start.unmarked);
  const [status, setStatus] = useState<string | null>(start.recorded ? W.recorded : null);
  const exported = useMemo(() => exportStart(state), [state]);
  const [exporting, setExporting] = useState(exported.open);
  const [exportRound, setExportRound] = useState(0);
  const day = exportDay(now, event.timeZone);
  const fileFor = (format: 'xlsx' | 'csv') =>
    inPortuguese
      ? exportFileName(portuguese, { ...event, name: exportedName(state, event.name) }, now, format)
      : fileName(exportedName(state, event.name), day, format);
  const [sharing, setSharing] = useState<string | null>(exported.share ? fileFor('xlsx') : null);
  const refs = useRef<Partial<Record<string, ViewInstance | null>>>({});
  const from = useRef<string>(start.focus ?? 'card');
  const nameRef = useRef<TextHandle>(null);
  const whoseRef = useRef<TextHandle>(null);
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
  const listed = changesSince(since);
  const unseen = event.id === WEDDING ? changesSince(looked).length : 0;

  useEffect(() => {
    if (typed === searched) return;
    const wait = setTimeout(() => setSearched(typed), SEARCH_PAUSE_MS);
    return () => clearTimeout(wait);
  }, [typed, searched]);

  useEffect(() => {
    if (start.focus == null || start.overlay != null) return;
    const wait = setTimeout(
      () => moveScreenReaderFocus(refs.current[start.focus ?? ''] ?? null),
      FOCUS_AFTER_MS,
    );
    return () => clearTimeout(wait);
  }, [start.focus, start.overlay]);

  const refFor = useCallback(
    (key: string) => (node: ViewInstance | null) => {
      refs.current[key] = node;
    },
    [],
  );
  const openGuest = (key: string, row: string) => {
    from.current = row;
    setPaste(null);
    setStatus(null);
    setNotReplaced(null);
    setCopyFailed(false);
    setUnmarked(null);
    setReplies(null);
    setReplaced(false);
    setGuestPhase('ok');
    setExporting(false);
    setOpen(key);
    if (layout !== 'landscape') scroll.current?.scrollTo({ y: 0, animated: false });
    setTimeout(() => moveScreenReaderFocus(nameRef.current), FOCUS_AFTER_MS);
  };
  const openWhose = (quote: string) => {
    setOpen(null);
    setExporting(false);
    setPaste({ step: 'whose', quote, all: false, typed: '', guest: null, start: null });
    if (layout !== 'landscape') scroll.current?.scrollTo({ y: 0, animated: false });
    setTimeout(() => moveScreenReaderFocus(whoseRef.current), FOCUS_AFTER_MS);
  };
  const { nothing, onText } = usePaste(openWhose, pasted.nothing);
  const closeWhose = () => {
    setPaste(null);
    setTimeout(() => moveScreenReaderFocus(fieldRef.current), FOCUS_AFTER_MS);
  };
  const pickWhose = (key: string) => {
    if (paste == null) return;
    from.current = `paste.${key}`;
    setRound((count) => count + 1);
    setPaste({ ...paste, step: 'record', guest: key, start: null });
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
  const chooseFilter = (key: ListFilter) => {
    if (key === filter) return;
    const choice = chooseChanged(key, changeFails.current);
    setChangeFailed(choice.failed);
    if (!choice.applies) return;
    if (key === 'changed') {
      setSince(takeLook(now));
      setLooked(lastLooked());
    }
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
  const rows: Person[] =
    filter === 'changed'
      ? changedRows(guests, listed, searched, now, locale, contacts, owner)
      : looking
        ? rowsOf(guests, filter, searched, locale, replyBy, contacts, owner)
        : [];
  const groups: Partial<Record<GroupKey, Person[]>> = {};
  if (!looking)
    for (const group of GROUPS)
      groups[group] = groupRows(
        guests,
        group,
        locale,
        replyBy,
        event.id !== WEDDING || expanded.includes(group),
        owner,
      );
  const showAll = (group: GroupKey) => {
    const before = new Set((groups[group] ?? []).map((p) => p.key));
    const next = groupRows(guests, group, locale, replyBy, true, owner).find(
      (p) => !before.has(p.key),
    );
    setExpanded((was) => [...was, group]);
    if (next != null)
      setTimeout(() => moveScreenReaderFocus(refs.current[next.key] ?? null), FOCUS_AFTER_MS);
  };

  const inView = inViewOf({
    filter,
    searched,
    rows: rows.length,
    filtered: filter === 'changed' ? rows.length : filterCount(filter, counts),
    total,
  });
  const openExport = () => {
    from.current = 'export';
    setExportRound((count) => count + 1);
    setExporting(true);
  };
  const choicePt = PT_FILTER[filter];
  const exportProps = {
    words: inPortuguese ? sheetWordsIn(portuguese) : ENGLISH_SHEET,
    file: fileFor,
    inView,
    everyone: total,
    narrowed: inPortuguese
      ? exportNarrowing(
          portuguese,
          choicePt == null ? filterWord(filter) : portuguese(choicePt),
          searched,
          [],
        )
      : narrowing(filterWord(filter), searched),
    needs: exported.needs,
    offline,
    format: exported.format,
    making: exportRound === 0 ? exported.making : ('ready' as const),
    refused: exportRound === 0 && exported.dropped,
    onClose: () => {
      setExporting(false);
      if (layout === 'landscape')
        setTimeout(() => moveScreenReaderFocus(refs.current.export ?? null), FOCUS_AFTER_MS);
    },
    onShare: (file: string) => {
      setExporting(false);
      setSharing(file);
    },
  };

  const showPaste = pasteShown({
    phase,
    empty,
    role,
    replies,
    replyBy,
    today: TODAY,
    invited: counts.invited,
  });
  const demoPaste = isIn(PASTE_STATES, state);
  const pasteBelow = !showPaste ? null : layout === 'portrait' ? (
    nothing || demoPaste ? (
      <View style={styles.pasteBelow}>
        {nothing && <PasteNotice />}
        {demoPaste && <PasteDemo onText={onText} />}
      </View>
    ) : null
  ) : (
    <PasteRow nothing={nothing} onText={onText} demo={demoPaste} />
  );
  const pasteGuest = guests.find((g) => g.key === paste?.guest) ?? null;
  const whose =
    paste == null ? null : (
      <WhoseReply
        layout={layout}
        quote={paste.quote}
        all={paste.all}
        onShowAll={() => setPaste({ ...paste, all: true })}
        typed={paste.typed}
        onTyped={(typed) => setPaste({ ...paste, typed })}
        rows={whoseRows(guests, paste.typed, locale, t)}
        waiting={waitingCount(guests)}
        onPick={pickWhose}
        onBack={closeWhose}
        refFor={refFor}
        titleRef={whoseRef}
      />
    );

  const exportShown = owner && phase === 'ok' && !empty && titleRow.export;
  const list = (
    <>
      <GuestsTitle
        layout={layout}
        title={inPortuguese ? portuguese('eventNav.guests') : W.guests}
        plusLabel={inPortuguese ? portuguese('guestList.addGuest') : W.addGuest}
        plus={owner && phase !== 'loading' && !empty}
        onPlus={() => show('add', 'plus')}
        extra={
          exportShown ? (
            <ExportButton
              ref={refFor('export')}
              layout={layout}
              offline={offline}
              words={inPortuguese ? exportWordsIn(portuguese) : undefined}
              onPress={openExport}
            />
          ) : null
        }
        extraWidest={
          exportShown ? (
            <ExportButton
              layout={layout}
              offline={offline}
              words={inPortuguese ? exportWordsIn(portuguese) : undefined}
              onPress={openExport}
              measured
            />
          ) : null
        }
        refreshing={
          refreshing == null || (layout === 'phone' && besideBack)
            ? null
            : { node: refreshing, row: layout !== 'phone' }
        }
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
              also={words.also == null ? null : { label: W.makeLive, onPress: onMakeLive }}
            />
          )}
          {!empty && (
            <GuestsRows
              layout={layout}
              counts={counts}
              total={total}
              filter={filter}
              changed={filter === 'changed' ? listed.length : unseen}
              onFilter={chooseFilter}
              changeFailed={changeFailed}
              onRetryChanged={() => {
                changeFails.current = false;
                chooseFilter('changed');
              }}
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
              walkIns={
                looking ? [] : rowsOf(guests, 'walkin', '', locale, replyBy, contacts, owner)
              }
              expanded={expanded}
              onShowAll={showAll}
              lit={layout === 'landscape' ? open : null}
              onOpen={openGuest}
              refFor={refFor}
              fieldRef={fieldRef}
              pasteInRow={
                showPaste && layout === 'portrait' ? <PasteButton onText={onText} inRow /> : null
              }
              paste={pasteBelow}
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
        flagged={guest != null && flagged.includes(guest.key)}
        copyFailed={copyFailed ? notCopiedLine(state) : null}
        unmarked={unmarked}
        status={status}
        nameRef={nameRef}
        refFor={refFor}
        actions={{
          onRecord: () => show('record', guest?.kind === 'notyet' ? 'recordNotYet' : 'record'),
          onEdit: () => show('edit', 'edit'),
          onCopy: () => {
            from.current = 'copy';
            setCopyFailed(false);
            setToast({ words: W.linkCopied, mark: guest?.kind === 'notyet' });
          },
          onReplace: () => show('replace', 'replace'),
          onReplaceFromNotice: () => show('replace', 'flagReplace'),
          onMark: () => show('mark', 'mark'),
          onUnmark: () => {
            if (guest == null) return;
            replace(markedNotInvited(guest));
            setUnmarked('done');
            setTimeout(() => moveScreenReaderFocus(nameRef.current), FOCUS_AFTER_MS);
          },
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
      {paste != null && pasteGuest != null && (
        <RecordReply
          locale={locale}
          key={`fromMessage:${pasteGuest.key}:${round}`}
          open={paste.step === 'record'}
          guest={pasteGuest}
          start={null}
          opener={opener}
          message={{ quote: paste.quote, offline, start: paste.start }}
          onClose={() => setPaste({ ...paste, step: 'whose', start: null })}
          onSaved={(next) => {
            replace(next);
            setPaste(null);
            setToast({ words: W.recorded });
          }}
        />
      )}
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
              from.current = 'record';
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
              setUnmarked(null);
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
              from.current = 'replace';
              close();
              setNotReplaced(null);
              setReplaced(true);
              setFlagged((keys) => keys.filter((key) => key !== guest.key));
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
      {layout !== 'landscape' && (
        <ExportSheet
          key={`export:${exportRound}`}
          open={exporting}
          opener={opener}
          {...exportProps}
        />
      )}
      <ShareStandIn file={sharing} opener={opener} onClose={() => setSharing(null)} />
      {told}
    </>
  );

  const band = offline && <OfflineBand onRetry={() => setOffline(false)} />;

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
            style={[styles.listPane, { width: listWidth }]}
            contentContainerStyle={styles.listBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {list}
          </ScrollView>
          {exporting ? (
            <ExportPanel key={`export:${exportRound}`} {...exportProps} />
          ) : (
            <ScrollView
              style={styles.grow}
              contentContainerStyle={styles.guestBody}
              showsVerticalScrollIndicator={false}
            >
              {whose ?? page ?? <Nobody />}
            </ScrollView>
          )}
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
      back={
        whose != null
          ? { label: W.guests, onPress: closeWhose }
          : page != null
            ? { label: W.guests, onPress: closeGuest }
            : null
      }
      behind={behind}
      phoneBack={
        refreshing != null && inPortuguese
          ? { label: portuguese('eventNav.overview'), onPress: () => onArea('overview') }
          : undefined
      }
      besideBack={
        refreshing != null && layout === 'phone' && whose == null && page == null
          ? { node: refreshing, onPlaced: setBesideBack }
          : undefined
      }
      overlay={overlays}
    >
      {whose != null ? (
        <>
          {band && (
            <View style={layout === 'phone' ? styles.bandPhone : styles.bandWide}>{band}</View>
          )}
          {whose}
        </>
      ) : (
        (page ?? (
          <>
            {band && (
              <View style={layout === 'phone' ? styles.bandPhone : styles.bandWide}>{band}</View>
            )}
            {list}
          </>
        ))
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
  listPane: { flexGrow: 0, borderRightWidth: 1, borderRightColor: tokens.colorBorder },
  listBody: { paddingTop: 22, paddingHorizontal: 20, paddingBottom: tokens.space6xl * 2, gap: 18 },
  guestBody: { paddingTop: 22, paddingHorizontal: 32, paddingBottom: tokens.space6xl * 2, gap: 18 },
  bandPhone: { marginHorizontal: -tokens.spaceXxl },
  bandWide: { marginHorizontal: -tokens.space5xl },
  nobody: { paddingTop: 120, alignItems: 'center' },
  pasteBelow: { gap: tokens.spaceSm },
});
