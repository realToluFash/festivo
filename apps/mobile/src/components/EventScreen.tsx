import type { Membership, OrganisationEvent } from '@soirely/api-client';
import {
  type Choice,
  type EventArea,
  rememberTabHolding,
  roleHolds,
  takesCardStep,
} from '@soirely/domain';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import {
  type ReactNode,
  type RefObject,
  createRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import {
  NOT_OFFLINE,
  type ScreenOffline,
  type Stale,
  keepsWhatLoaded,
  useOffline,
} from '../offline.ts';
import { DESTINATION_HREF } from '../kit/appNav.ts';
import { offersDelete } from '../kit/eventDelete.ts';
import { offersEdit } from '../kit/eventEdit.ts';
import { closesOnLatest, partLocked } from '../kit/eventOverview.ts';
import { DUPLICATING, backToOriginal } from '../kit/eventDuplicate.ts';
import {
  EDIT_AT_PARAM,
  EDIT_LEAVES,
  type EditPart,
  EVENT_AREA,
  type EventPlace,
  GUESTS_FILTER,
  areaBack,
} from '../kit/eventNav.ts';
import { markDeleted, takeCoverRefused } from '../kit/eventSaved.ts';
import { type Opened, openedOf, openedWithoutAsking } from '../kit/eventsOpen.ts';
import { ASKS_END, SHOWN_EVENT, goUpToEvent } from '../kit/upToEvent.ts';
import { useServerNow } from '../kit/serverNow.ts';
import { useLayout } from '../layout/useLayout.ts';
import { useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { AppFrame, BackButton } from './AppFrame.tsx';
import { BellRow, PaneBell } from './BellButton.tsx';
import { bodyEdges } from './bodyEdges.ts';
import { SecondaryButton } from './Buttons.tsx';
import { cardFrame } from './cardFrame.ts';
import { DuplicateEvent } from './DuplicateEvent.tsx';
import { EventNotice } from './EventNotice.tsx';
import { EventPage } from './EventPage.tsx';
import { EDIT_PARTS } from './EventEdits.tsx';
import { EventEditScreen } from './EventPartEdits.tsx';
import { EventGuests, type GuestsTop } from './EventGuests.tsx';
import { ExportButton } from './GuestExport.tsx';
import { EventPeople } from './EventPeople.tsx';
import { EventNotFound, EventTop, EventsFailed, usePhaseOf } from './Events.tsx';
import { Refreshing } from './Refreshing.tsx';
import { Screen } from './Screen.tsx';
import { LoadingBlock, PageToast, TextAction } from './Summary.tsx';
import type { ToastAction } from './Toast.tsx';
import { phoneTabBarClearance } from './TodayCover.tsx';
import { Arrived } from './Skeleton.tsx';
import { type ScreenReaderTarget, moveScreenReaderFocus } from './screenReaderFocus.ts';
import { Text, type TextHandle } from './Text.tsx';
import { BodyTitle } from './Title.tsx';
import { TopPrimary, usePrimaryLabel } from './TopPrimary.tsx';
import { COLUMN_TITLE, PAGE_TITLE, columnTitle, pageTitle } from './topTitle.ts';
import { useSidebarCard } from './sidebarCard.ts';
import { eventTop } from '../kit/eventTop.ts';
import { EdgeSwipeBack } from './useEdgeSwipeBack.ts';
import { useSystemBack } from './useSystemBack.ts';

/** An event's page, a screen of its own pushed over Events, Happening now or Calendar (sc-22103). */
export function EventScreen({
  eventId,
  area,
  filter = 'all',
  copiedFrom,
  opensDuplicate = false,
  opensEdit,
  editLeaves = false,
  keepsTab,
  opensGuest,
  opensEndNow = false,
}: {
  eventId: string;
  area: EventPlace;
  /** The choice Guests opens on, from a figure that counts it (sc-3786). */
  filter?: Choice;
  /** The event this one was duplicated from, when Duplicate opened it (sc-22145). */
  copiedFrom?: string | undefined;
  /** Opened by an Events card's Duplicate, so Duplicate is over the page as it opens. */
  opensDuplicate?: boolean;
  /** Opened by a link to the part's edit (sc-48600). */
  opensEdit?: EditPart | undefined;
  /** The link came from a screen in the app, an Events card's Change dates: Cancel goes back to it. From outside the app, Cancel closes onto the event's page (Decided, 15 Nov). */
  editLeaves?: boolean;
  /** Opened from Happening now, so Back returns to the tab that was showing. */
  keepsTab: boolean;
  /** The guest whose details Guests opens on, as a match in Search opens them (sc-39534). */
  opensGuest?: string | undefined;
  /** Opened by the night's End now, so End now's confirmation is over the page as it opens (sc-3895). */
  opensEndNow?: boolean;
}) {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { account, organisation } = useSignedIn();
  const organisationId = organisation?.id;
  const phone = kind === 'phone';
  const navigation = useNavigation<{
    setParams(params: {
      [SHOWN_EVENT]?: string;
      [EVENT_AREA]?: EventPlace;
      [GUESTS_FILTER]?: Choice | undefined;
      [DUPLICATING]?: string | undefined;
      [EDIT_AT_PARAM]?: string | undefined;
      [EDIT_LEAVES]?: string | undefined;
      [ASKS_END]?: string | undefined;
    }): void;
    getState(): { routes: readonly { params?: unknown }[]; index: number } | undefined;
  }>();
  const [editing, setEditing] = useState<{
    part: EditPart;
    count: number;
    open: boolean;
    leaves: boolean;
    opener: RefObject<ScreenReaderTarget | null>;
  } | null>(null);
  const [partRows] = useState(
    () =>
      Object.fromEntries(EDIT_PARTS.map((part) => [part, createRef<ViewInstance>()])) as Record<
        EditPart,
        RefObject<ViewInstance | null>
      >,
  );
  const [guestsOffline, setGuestsOffline] = useState<ScreenOffline>(NOT_OFFLINE);
  const [guestsTop, setGuestsTop] = useState<GuestsTop>({
    add: null,
    exports: null,
    back: null,
    toSearch: false,
  });
  const guestsAdd = useRef<ViewInstance>(null);
  const guestsExport = useRef<ViewInstance>(null);
  const [toast, setToast] = useState<{
    eventId: string;
    area: EventPlace;
    words: string;
    action?: ToastAction | null | undefined;
  } | null>(null);
  const withdrawToastAction = useCallback(
    () => setToast((was) => (was == null ? null : { ...was, action: null })),
    [],
  );
  const [duplicating, setDuplicating] = useState<{
    opener: RefObject<ScreenReaderTarget | null>;
    count: number;
    open: boolean;
  } | null>(null);
  const insets = useSafeAreaInsets();
  const [coverRefused, setCoverRefused] = useState<{ eventId: string; reason: string } | null>(
    null,
  );
  const title = useRef<TextHandle>(null);
  const cardName = useRef<TextHandle>(null);
  const opened = useOpened(eventId, account != null, organisation, () =>
    moveScreenReaderFocus(cardName.current ?? title.current),
  );
  const { reload, freshen, change } = opened;
  const top = eventTop(kind, area, opened.kind);
  const { cardNamed, areaTitled } = top;
  const event = opened.kind === 'loaded' ? opened.event : null;
  const creates = event != null && roleHolds(event, 'events.create');
  const manages = offersEdit(event);
  const deletes = offersDelete(event);
  const now = useServerNow();
  const phase = usePhaseOf(event, now);
  const card = useSidebarCard(event);
  const original = backToOriginal(eventId, eventId, copiedFrom);

  useEffect(() => {
    navigation.setParams({ [SHOWN_EVENT]: eventId });
  }, [navigation, eventId]);

  useEffect(() => {
    if (organisationId != null && phase != null && !keepsTab) {
      rememberTabHolding(organisationId, phase);
    }
  }, [organisationId, phase, keepsTab]);

  useFocusEffect(
    useCallback(() => {
      setCoverRefused(takeCoverRefused());
      freshen();
    }, [freshen]),
  );

  const guestsClear = area === 'guests' && guestsOffline.stale == null;
  const eventStale = opened.stale != null;

  // Each answer after a return is the guests' load's, which the event's watch leaves alone (sc-27096), so without this the event's band never clears. It also fires on entering Guests, before their first read answers.
  useEffect(() => {
    if (guestsClear && eventStale) freshen();
  }, [guestsClear, eventStale, freshen]);

  const chooseArea = (next: EventPlace, choice?: Choice) =>
    navigation.setParams({ [EVENT_AREA]: next, [GUESTS_FILTER]: choice });
  const leave = () => {
    if (original != null) goUpToEvent(navigation, router, original);
    else if (router.canGoBack()) router.back();
    else router.replace(DESTINATION_HREF.events);
  };
  const fromSearch = phone && opensGuest != null;
  const back = !fromSearch && areaBack(area) === 'overview' ? () => chooseArea('overview') : leave;
  const backLabel = fromSearch
    ? t('todayScreen.search')
    : area !== 'overview'
      ? t('eventNav.overview')
      : original != null
        ? t('timeline.backToEvent')
        : t('eventsScreen.title');

  useSystemBack(true, back);

  const partRef = (part: EditPart): RefObject<ViewInstance | null> => partRows[part];
  const openEdit = (
    part: EditPart,
    opener: RefObject<ScreenReaderTarget | null>,
    leaves = false,
  ) => {
    setEditing((was) => ({ part, count: (was?.count ?? 0) + 1, open: true, leaves, opener }));
  };
  const closeEdit = (opener?: RefObject<ScreenReaderTarget | null>) =>
    setEditing((was) =>
      was == null ? was : { ...was, open: false, ...(opener == null ? {} : { opener }) },
    );
  const onEdit = manages ? openEdit : undefined;
  const [linked, setLinked] = useState<EditPart | undefined>();

  if (event != null && opensEdit !== linked) {
    setLinked(opensEdit);
    if (opensEdit != null && manages && !partLocked(opensEdit, phase ?? event.phase))
      openEdit(opensEdit, partRef(opensEdit), editLeaves);
  }
  const loaded = event != null;

  useEffect(() => {
    if (opensEdit != null && loaded)
      navigation.setParams({ [EDIT_AT_PARAM]: undefined, [EDIT_LEAVES]: undefined });
  }, [opensEdit, loaded, navigation]);
  const onDuplicate = creates
    ? (opener: RefObject<ScreenReaderTarget | null>) =>
        setDuplicating((now) => ({ opener, count: (now?.count ?? 0) + 1, open: true }))
    : undefined;
  const fromList = useRef(opensDuplicate);

  useEffect(() => {
    if (!fromList.current || event == null || !creates) return;
    fromList.current = false;
    navigation.setParams({ [DUPLICATING]: undefined });
    setDuplicating({ opener: cardName.current == null ? title : cardName, count: 1, open: true });
  }, [event, creates, navigation]);
  const onDeleted = deletes
    ? (gone: OrganisationEvent) => {
        markDeleted(gone.name);
        router.dismissTo(DESTINATION_HREF.events);
      }
    : undefined;

  const body =
    event != null ? (
      area === 'overview' ? (
        <Arrived style={styles.stack}>
          <EventPage
            kind={kind}
            event={event}
            onGuests={(choice) => chooseArea('guests', choice)}
            nameRef={cardNamed ? cardName : undefined}
            manages={manages}
            takes={(action) => takesCardStep(event, action)}
            onChange={change}
            onEdit={onEdit}
            partRef={partRef}
            onDuplicate={onDuplicate}
            onDeleted={onDeleted}
            tell={(words) => setToast({ eventId, area, words })}
            opensEndNow={opensEndNow}
            onEndNowOpened={() => navigation.setParams({ [ASKS_END]: undefined })}
            notice={
              coverRefused?.eventId === eventId ? (
                <EventNotice
                  tone="broken"
                  words={t('eventCover.createdWithout', { reason: coverRefused.reason })}
                  actions={
                    onEdit == null ? null : (
                      <TextAction
                        label={t('eventCover.upload')}
                        glyph="camera"
                        onPress={() => {
                          setCoverRefused(null);
                          onEdit('cover', partRef('cover'));
                        }}
                        testID="events.page.coverRefused.upload"
                      />
                    )
                  }
                />
              ) : null
            }
          />
        </Arrived>
      ) : area === 'people' ? (
        <EventPeople
          key={event.id}
          event={event}
          tell={(words) => setToast(words == null ? null : { eventId, area, words })}
        />
      ) : (
        <PlaceholderArea
          area={area}
          action={
            area === 'schedule' ? (
              <RunViewEntry event={event} happening={phase === 'happening_now'} />
            ) : null
          }
        >
          <EventTop
            kind={kind}
            event={event}
            phase={phase ?? event.phase}
            manages={manages}
            now={now}
            onChange={change}
            onEdit={onEdit == null ? undefined : (part) => onEdit(part, partRef(part))}
            onDuplicate={onDuplicate}
          />
        </PlaceholderArea>
      )
    ) : opened.kind === 'notFound' ? (
      <EventNotFound onBack={leave} />
    ) : opened.kind === 'failed' ? (
      <EventsFailed onRetry={opened.retry} testID="events.page.retry" />
    ) : (
      <LoadingBlock words={t('eventsScreen.loadingEvent')} />
    );

  const guests = area === 'guests' && event != null;
  const refreshing =
    opened.refreshing || (guests && guestsOffline.refreshing) ? (
      <Refreshing testID="events.page.refreshing" />
    ) : null;
  const underTitle =
    area === 'people' && event != null ? (
      <Text size={15} weight="medium" style={styles.secondary}>
        {event.name}
      </Text>
    ) : undefined;
  const guestsTitleSize = kind === 'tabletLandscape' ? COLUMN_TITLE : PAGE_TITLE;
  const guestsTitleStyle = kind === 'tabletLandscape' ? columnTitle : pageTitle;
  const guestsLabel = usePrimaryLabel({
    title: t('eventNav.guests'),
    size: guestsTitleSize,
    style: guestsTitleStyle,
    label: guests && guestsTop.add != null ? t('guestList.addGuest') : undefined,
    gap: tokens.spaceSm,
    labelled: !phone,
  });
  const addGuest =
    guests && guestsTop.add != null ? (
      <TopPrimary
        ref={guestsAdd}
        label={t('guestList.addGuest')}
        onPress={guestsTop.add}
        wide={guestsLabel.wide}
        testID="guests.add"
      />
    ) : null;
  const exportGuests =
    guests && guestsTop.exports != null ? (
      <ExportButton
        ref={guestsExport}
        kind={kind}
        offline={guestsOffline.stale != null}
        onPress={guestsTop.exports}
      />
    ) : null;
  const guestBack = guests ? guestsTop.back : null;
  const titledInList = areaTitled || guests;
  const frameBack =
    guestBack != null
      ? {
          label: guestsTop.toSearch ? t('todayScreen.search') : t('eventNav.guests'),
          onPress: guestBack,
        }
      : top.frameBack === 'area'
        ? { label: backLabel, onPress: back }
        : top.frameBack === 'events'
          ? {
              label: original != null ? t('timeline.backToEvent') : t('eventsScreen.title'),
              onPress: leave,
            }
          : undefined;

  return (
    <AppFrame
      current="events"
      title={t(`eventNav.${area}`)}
      titleRef={title}
      untitled={cardNamed || titledInList}
      offline={guests ? (guestsOffline.stale ?? opened.stale) : opened.stale}
      besideBack={phone || cardNamed ? refreshing : undefined}
      besideTitle={titledInList || phone ? undefined : refreshing}
      back={frameBack}
      backInBody={top.frameBack == null}
      inEvent={
        top.inEvent
          ? {
              area,
              onArea: chooseArea,
              card,
              up:
                original != null ? { label: t('timeline.backToEvent'), onPress: leave } : undefined,
            }
          : undefined
      }
      underTitle={titledInList ? undefined : underTitle}
    >
      <EdgeSwipeBack active={area !== 'overview' && guestBack == null} onBack={back} />
      {guests ? (
        <EventGuests
          key={`${event.id}.${filter}`}
          event={event}
          filter={filter}
          opens={opensGuest}
          leave={fromSearch ? leave : undefined}
          phase={phase}
          now={now}
          onEventChange={change}
          onEventStale={reload}
          addRef={guestsAdd}
          exportRef={guestsExport}
          tell={(words, action) => setToast({ eventId, area, words, action })}
          withdrawAction={withdrawToastAction}
          onTop={setGuestsTop}
          heading={
            <View style={styles.titleRow}>
              <View style={styles.fill} onLayout={guestsLabel.onSlot}>
                {guestsLabel.measure}
                <BodyTitle
                  size={guestsTitleSize}
                  accessibilityRole="header"
                  ref={title}
                  style={guestsTitleStyle}
                >
                  {t('eventNav.guests')}
                </BodyTitle>
              </View>
              {!phone && refreshing}
              {exportGuests}
              {addGuest}
              <PaneBell />
            </View>
          }
          onOffline={setGuestsOffline}
        />
      ) : (
        <Screen
          edges={bodyEdges(kind)}
          contentStyle={
            phone
              ? cardNamed
                ? styles.phoneUntitled
                : styles.phone
              : kind === 'tabletPortrait'
                ? styles.tabletPortrait
                : cardNamed
                  ? styles.landscapeUntitled
                  : styles.tabletLandscape
          }
        >
          {kind === 'tabletLandscape' && cardNamed && refreshing}
          {cardNamed && event == null && <BellRow />}
          {top.bodyBack && <BackButton label={backLabel} onPress={back} testID="events.back" />}
          {areaTitled && (
            <View style={styles.areaTop}>
              <View style={styles.titleRow}>
                <View style={styles.fill}>
                  <BodyTitle
                    size={PAGE_TITLE}
                    accessibilityRole="header"
                    ref={title}
                    style={pageTitle}
                  >
                    {t(`eventNav.${area}`)}
                  </BodyTitle>
                </View>
                {refreshing}
              </View>
              {underTitle}
            </View>
          )}
          {body}
        </Screen>
      )}
      {event != null && duplicating != null && (
        <DuplicateEvent
          key={duplicating.count}
          open={duplicating.open}
          event={event}
          opener={duplicating.opener}
          onClose={() => setDuplicating((now) => (now == null ? now : { ...now, open: false }))}
        />
      )}
      {event != null && editing != null && (
        <EventEditScreen
          key={editing.count}
          part={editing.part}
          open={editing.open}
          event={event}
          opener={editing.opener}
          onClose={() => {
            if (editing.leaves && router.canGoBack()) router.back();
            else closeEdit();
          }}
          onSaved={(saved, said) => {
            change(saved);
            if (editing.part === 'cover') setCoverRefused(null);
            closeEdit(partRef(editing.part));
            setToast({ eventId, area, words: said ?? t('eventEdit.saved') });
          }}
          onLatest={(latest) => {
            change(latest);
            if (closesOnLatest(editing.part, latest.phase)) closeEdit(partRef('dates'));
            else setEditing((was) => (was == null ? was : { ...was, count: was.count + 1 }));
          }}
        />
      )}
      {toast?.eventId === eventId && toast.area === area && (
        <PageToast
          words={toast.words}
          action={toast.action}
          onClose={() => setToast(null)}
          bottom={
            phone
              ? phoneTabBarClearance(insets.bottom) + tokens.spaceXl + tokens.spaceHair
              : Math.max(insets.bottom, tokens.spaceLg)
          }
        />
      )}
    </AppFrame>
  );
}

/** An area no epic has built yet: under the Top, its own name and a line saying it is coming, and nothing to press. */
function PlaceholderArea({
  area,
  action,
  children,
}: {
  area: Exclude<EventArea, 'overview'>;
  /** What the area already offers before it is built, under the line saying it is coming. */
  action: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { kind } = useLayout();

  return (
    <View style={styles.stack} testID={`events.area.${area}`}>
      {children}
      <View style={cardFrame(kind)}>
        <Text size={tokens.typeRowTitle.size} weight="semibold" accessibilityRole="header">
          {t(`eventNav.${area}`)}
        </Text>
        <Text size={tokens.typeBody.size} muted>
          {t(`eventNav.${area}Coming`)}
        </Text>
        {action}
      </View>
    </View>
  );
}

/** The Schedule's way into the run view (sc-1404), for anyone who can read the run of show once it holds an item, and into Run of show while the event is happening (sc-3895). */
function RunViewEntry({ event, happening }: { event: OrganisationEvent; happening: boolean }) {
  const { t } = useTranslation();
  const reads = event.permissions.includes('run_of_show.read');
  const [items, setItems] = useState<{ for: string; count: number } | null>(null);

  useEffect(() => {
    if (!reads) return undefined;
    let current = true;

    api.schedule(event.id).then(
      (schedule) => current && setItems({ for: event.id, count: schedule.items.length }),
      () => undefined,
    );

    return () => {
      current = false;
    };
  }, [event.id, reads]);

  if (!reads || items?.for !== event.id) return null;
  if (items.count === 0 && !happening) return null;

  return (
    <View style={styles.runEntry}>
      {happening && (
        <SecondaryButton
          label={t('night.open')}
          link
          onPress={() => router.push({ pathname: '/events/[id]/night', params: { id: event.id } })}
          testID="events.schedule.night"
        />
      )}
      {items.count > 0 && (
        <SecondaryButton
          label={t('runView.open')}
          link
          onPress={() => router.push({ pathname: '/events/[id]/run', params: { id: event.id } })}
          testID="events.schedule.run"
        />
      )}
    </View>
  );
}

/** The event is read on its own, so a link, a push and Calendar open it as Events does. */
function useOpened(
  eventId: string,
  accountLoaded: boolean,
  organisation: Membership | null,
  focusTitle: () => void,
): Opened & {
  retry: () => void;
  reload: () => void;
  freshen: () => void;
  change: (event: OrganisationEvent) => void;
  stale: Stale | null;
  refreshing: boolean;
} {
  const organisationId = organisation?.id;
  const settled = openedWithoutAsking(accountLoaded, organisation);
  const asks = settled == null;
  const [held, setHeld] = useState<{ for: string | null; opened: Opened }>({
    for: null,
    opened: { kind: 'loading' },
  });
  const [attempt, setAttempt] = useState(0);
  const key = `${organisationId ?? ''}/${eventId}`;
  const retry = useCallback(() => {
    setHeld({ for: null, opened: { kind: 'loading' } });
    setAttempt((n) => n + 1);
  }, []);
  // A reload keeps the page in place until the new read lands.
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const change = useCallback(
    (event: OrganisationEvent) => setHeld({ for: key, opened: { kind: 'loaded', event } }),
    [key],
  );

  const { watch, freshen, stale, refreshing } = useOffline({
    loaded: held.for === key && held.opened.kind === 'loaded',
    reload,
    focusTitle,
  });

  useEffect(() => {
    if (eventId === '' || organisationId == null || !asks) return;
    let live = true;

    watch(api.event(eventId)).then(
      (event) => live && setHeld({ for: key, opened: openedOf({ event }, organisationId) }),
      (error: unknown) =>
        live &&
        setHeld((before) =>
          before.for === key && before.opened.kind === 'loaded' && keepsWhatLoaded(error)
            ? before
            : { for: key, opened: openedOf({ error }, organisationId) },
        ),
    );

    return () => {
      live = false;
    };
  }, [eventId, organisationId, asks, key, attempt, watch]);

  if (settled != null)
    return { ...settled, retry, reload, freshen, change, stale: null, refreshing: false };

  return {
    ...(held.for === key ? held.opened : { kind: 'loading' }),
    retry,
    reload,
    freshen,
    change,
    stale,
    refreshing,
  };
}

const styles = StyleSheet.create({
  stack: { gap: tokens.spaceMd },
  runEntry: { paddingTop: tokens.spaceMd, alignItems: 'flex-start', gap: tokens.spaceSm },
  secondary: { color: tokens.colorInkSecondary },
  fill: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  areaTop: { gap: tokens.spaceXxs },
  phone: {
    gap: tokens.spaceLg,
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.spaceXxl,
    paddingBottom: tokens.space3xl,
  },
  phoneUntitled: {
    gap: tokens.spaceLg,
    paddingTop: 0,
    paddingHorizontal: tokens.spaceXxl,
    paddingBottom: tokens.space3xl,
  },
  landscapeUntitled: {
    gap: 18,
    paddingTop: 26,
    paddingHorizontal: 30,
    paddingBottom: tokens.space6xl * 2,
  },
  tabletPortrait: {
    gap: tokens.spaceLg,
    paddingTop: tokens.space3xl,
    paddingHorizontal: tokens.space5xl,
    paddingBottom: tokens.space6xl,
  },
  tabletLandscape: {
    gap: tokens.spaceLg,
    paddingTop: tokens.space3xl,
    paddingHorizontal: tokens.space4xl,
    paddingBottom: tokens.space6xl,
  },
});
