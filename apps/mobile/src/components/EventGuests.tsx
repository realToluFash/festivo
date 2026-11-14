import {
  type GuestList,
  type Headcount,
  type OrganisationEvent,
  type TaggedGuest,
  ApiError,
  realtimeTopic,
} from '@soirely/api-client';
import {
  CHOICES,
  REPLY_KEY,
  type Choice,
  type Counts,
  type Person,
  type Standing,
  countsOf,
  roleHolds,
  rowWords,
  viewOf,
} from '@soirely/domain';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
  type TextInputInstance,
  type ViewInstance,
} from 'react-native';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { followTopic } from '../followTopic.ts';
import { dateLocale } from '../i18n/index.ts';
import { markOf } from '../kit/guestRows.ts';
import { type ScreenOffline, useHandOffline, useOffline } from '../offline.ts';
import { useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton } from './Buttons.tsx';
import { SearchField } from './EventsSearch.tsx';
import { Glyph } from './Glyph.tsx';
import { GuestDetails, type GuestPane } from './GuestDetails.tsx';
import { GuestForm, type GuestFormMode } from './GuestForm.tsx';
import { type ListAndPageSpacing, ListAndPage, useListAndPageLayout } from './ListAndPage.tsx';
import { LIST_EDGES } from './listFrame.ts';
import { useReadOut } from './ReadOut.tsx';
import { MarkSlot } from './ReplyMark.tsx';
import { FailedBlock } from './Summary.tsx';
import { type Anchor, AnchoredMenu, anchorUnder } from './SummaryOverlays.tsx';
import { Row, RowList, TextAction } from './SummaryRows.tsx';
import { Text, type TextHandle } from './Text.tsx';

/** How often the list is read again while open with no live line to the hub: changes from others show within 10 seconds. */
const READ_AGAIN_MS = 10_000;

type Load =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'loaded'; list: GuestList; headcount: Headcount };

const CHOICE_KEY: Record<Choice, string> = {
  all: 'guestList.all',
  coming: REPLY_KEY.coming,
  maybe: REPLY_KEY.maybe,
  noReply: REPLY_KEY.noReply,
  held: REPLY_KEY.held,
  notComing: REPLY_KEY.notComing,
  notYetInvited: REPLY_KEY.notYetInvited,
};

/** An event's Guests in the app (sc-3785): the list to find and read a guest, and the small edits; planning at scale stays on the web. */
export function EventGuests({
  event,
  heading,
  onOffline,
}: {
  event: OrganisationEvent;
  heading: ReactNode;
  onOffline: (offline: ScreenOffline) => void;
}) {
  const { t } = useTranslation();
  const { account } = useSignedIn();
  const eventId = event.id;
  const manages = roleHolds(event, 'guests.manage');
  const { kind } = useListAndPageLayout(SPACING, 'nothing');
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [choice, setChoice] = useState<Choice>('all');
  const [typed, setTyped] = useState('');
  const [expanded, setExpanded] = useState<ReadonlySet<Standing>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [pane, setPane] = useState<GuestPane>({ kind: 'loading' });
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<GuestFormMode | null>(null);
  const [round, setRound] = useState(0);
  const [added, setAdded] = useState<string | null>(null);
  const title = useRef<TextHandle>(null);
  const guestName = useRef<TextHandle>(null);
  const addButton = useRef<ViewInstance>(null);
  const editButton = useRef<ViewInstance>(null);
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

  const readGuest = useCallback(
    (guestId: string, quiet: boolean) => {
      const mine = ++reading.current.guest;
      if (!quiet) setPane({ kind: 'loading' });

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
  const reload = useCallback(() => {
    readList(watch);
    if (open != null && form == null) readGuest(open, true);
  }, [readList, watch, open, form, readGuest]);

  useEffect(() => {
    reloadRef.current = reload;
  });

  useHandOffline(onOffline, { stale, refreshing });

  useEffect(() => {
    readList(watch);
  }, [readList, watch]);

  useEffect(() => {
    let every: ReturnType<typeof setInterval> | undefined;
    const readAgain = () => {
      every ??= setInterval(() => reloadRef.current(), READ_AGAIN_MS);
    };
    readAgain();
    const live = followTopic(realtimeTopic('EventGuests', eventId), {
      subscribe: () => api.guestsSubscription(eventId),
      onData: () => reloadRef.current(),
      onGap: () => {
        clearInterval(every);
        every = undefined;
        reloadRef.current();
      },
      onDrop: readAgain,
    });

    return () => {
      live.stop();
      clearInterval(every);
    };
  }, [eventId]);

  const openGuest = (guestId: string) => {
    setSaved(false);
    setAdded(null);
    setOpen(guestId);
    readGuest(guestId, false);
  };
  const closeGuest = () => {
    setOpen(null);
    setSaved(false);
  };
  const openForm = (mode: GuestFormMode, from: ViewInstance | null) => {
    opener.current = from;
    setRound((was) => was + 1);
    setForm(mode);
  };

  const counts = loaded ? countsOf(load.headcount.counts) : null;
  const empty = loaded && load.list.guests.length === 0;
  const timeZone = event.timeZone;
  const locale = dateLocale();

  const list =
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
      <View style={styles.empty} testID="guests.empty">
        <Text size={20} weight="bold" accessibilityRole="header">
          {t('guestList.noGuests')}
        </Text>
        {manages && (
          <PrimaryButton
            ref={addButton}
            label={t('guestList.addGuest')}
            onPress={() => openForm({ kind: 'add' }, addButton.current)}
            testID="guests.add"
          />
        )}
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
        manages={manages}
        added={added}
        addRef={addButton}
        onAdd={() => openForm({ kind: 'add' }, addButton.current)}
        searchRef={searchField}
        timeZone={timeZone}
        locale={locale}
      />
    );

  const page =
    open == null ? (
      <View style={styles.pick}>
        <Text size={15} weight="medium" style={styles.secondary}>
          {t('guestList.pick')}
        </Text>
      </View>
    ) : (
      <GuestDetails
        pane={pane}
        manages={manages}
        timeZone={timeZone}
        saved={saved}
        nameRef={guestName}
        editRef={editButton}
        onEdit={() => {
          const tagged = tags.current.get(open);
          if (tagged != null) openForm({ kind: 'edit', tagged }, editButton.current);
        }}
        onBack={closeGuest}
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
        pageKey={open ?? ''}
        pageInFront={open != null}
        pageless={!loaded || empty}
        back={{ label: t('guestList.backToGuests'), onPress: closeGuest, testID: 'guest.back' }}
        spacing={SPACING}
      />
      {form != null && (
        <GuestForm
          key={round}
          open
          mode={form}
          eventId={eventId}
          startCountry={account?.organisationCountry ?? ''}
          opener={opener}
          onClose={() => setForm(null)}
          onSaved={({ guest, tagged }) => {
            setForm(null);
            if (tagged != null) {
              tags.current.set(guest.id, tagged);
              setPane({ kind: 'guest', guest: tagged.guest });
              setSaved(true);
            } else {
              setAdded(guest.fullName);
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
  manages,
  added,
  addRef,
  onAdd,
  searchRef,
  timeZone,
  locale,
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
  manages: boolean;
  added: string | null;
  addRef: React.RefObject<ViewInstance | null>;
  onAdd: () => void;
  searchRef: React.RefObject<TextInputInstance | null>;
  timeZone: string;
  locale: string;
}) {
  const { t } = useTranslation();
  const { view, shown } = viewOf(list.guests, counts, choice, typed, expanded);
  const looking = choice !== 'all' || typed.trim() !== '';
  const clear = () => {
    onTyped('');
    onChoice('all');
  };
  const says =
    counts.invited === 0
      ? t('guestList.onTheList', { count: counts.all })
      : t('guestList.comingOf', {
          comingWords: t('guestList.countComing', { count: counts.coming }),
          invitedWords: t('guestList.countInvited', { count: counts.invited }),
        });
  const row = (person: Person, indent: boolean) => {
    const { name, line } = rowWords(t, person, indent, timeZone, locale, false);
    const selected = open === person.guest.id && person.companion == null;
    const item = (
      <Row
        title={name}
        line={line}
        lead={<MarkSlot kind={markOf(person.standing)} />}
        opens
        selected={selected}
        pad={person.companion == null ? 11 : 8}
        onPress={() => onOpen(person.guest.id)}
        accessibilityLabel={`${name}, ${line}`}
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
      {added != null && <AddedLine name={added} />}
      <View style={styles.countRow}>
        <View style={styles.grow}>
          <Text size={17} weight="bold" style={styles.figures} testID="guests.count">
            {says}
          </Text>
          {counts.invited > 0 && (
            <Text size={15} weight="medium" style={[styles.secondary, styles.figures]}>
              {haventLine(t, counts)}
            </Text>
          )}
        </View>
        {manages && (
          <TextAction
            ref={addRef}
            label={t('guestList.addGuest')}
            glyph="plus"
            onPress={onAdd}
            testID="guests.add"
          />
        )}
      </View>
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
      </View>
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
            <View style={styles.groupHead} accessible accessibilityRole="header">
              <Text size={18} weight="bold" accessible={false} style={styles.headTitle}>
                {t(REPLY_KEY[group.standing])}
              </Text>
              <Text
                size={18}
                weight="bold"
                accessible={false}
                style={[styles.secondary, styles.figures, styles.headTitle]}
              >
                {` · ${t('guestList.figure', { count: group.count })}`}
              </Text>
            </View>
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

function haventLine(t: TFunction, counts: Counts) {
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
  const [at, setAt] = useState<Anchor | null>(null);
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
        width={230}
        testID="guests.filter.menu"
      >
        {CHOICES.map((key) => {
          const on = key === choice;
          const n = t('guestList.figure', { count: counts[key] });

          return (
            <Pressable
              key={key}
              onPress={() => {
                setAt(null);
                onChoose(key);
              }}
              style={({ pressed }) => [styles.menuRow, pressed && styles.menuPressed]}
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

function AddedLine({ name }: { name: string }) {
  const { t } = useTranslation();
  const words = t('guestList.justAdded', { name });
  useReadOut(words);

  return (
    <View style={styles.added} testID="guests.added">
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
  countRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shownRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  indent: { paddingLeft: 40 },
  groupHead: { minHeight: tokens.sizeHit, flexDirection: 'row', alignItems: 'center' },
  headTitle: { letterSpacing: -0.18, lineHeight: 18 * 1.25 },
  empty: { gap: tokens.spaceLg, paddingTop: tokens.spaceXs, alignItems: 'flex-start' },
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
});

const SPACING: ListAndPageSpacing = {
  phone: styles.phone,
  tabletPortrait: styles.portrait,
  landscape: styles.landscape,
  column: styles.column,
  listWidth: 400,
  between: tokens.spaceXxl,
};
