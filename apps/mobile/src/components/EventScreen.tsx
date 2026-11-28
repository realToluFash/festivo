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
  eventHref,
} from '../kit/eventNav.ts';
import { markDeleted, takeCoverRefused } from '../kit/eventSaved.ts';
import { outsideArea, outsideOn, readsOverview, wayBack } from '../kit/outsideEvent.ts';
import {
  type LinkFrom,
  linkFromIn,
  type Opened,
  openedOf,
  openedOrMoved,
  openedWithoutAsking,
} from '../kit/eventsOpen.ts';
import { ASKS_END, SHOWN_EVENT, goUpToEvent } from '../kit/upToEvent.ts';
import { useServerNow } from '../kit/serverNow.ts';
import { backRow } from '../layout/backRow.ts';
import { useLayout } from '../layout/useLayout.ts';
import { rereadAccount, switchOrganisation, useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { AppFrame } from './AppFrame.tsx';
import { BellRow } from './BellButton.tsx';
import { bodyEdges } from './bodyEdges.ts';
import { SecondaryButton } from './Buttons.tsx';
import { cardFrame } from './cardFrame.ts';
import { DuplicateEvent } from './DuplicateEvent.tsx';
import { EventNotice } from './EventNotice.tsx';
import { EventPage } from './EventPage.tsx';
import { OutsideOverview } from './OutsideOverview.tsx';
import { EDIT_PARTS } from './EventEdits.tsx';
import { EventEditScreen } from './EventPartEdits.tsx';
import { EventGuests, type GuestsTop } from './EventGuests.tsx';
import { ExportButton } from './GuestExport.tsx';
import { GuestsHeading } from './GuestsHeading.tsx';
import { EventPeople } from './EventPeople.tsx';
import { EventMenu } from './EventMenu.tsx';
import { EventNotFound, EventTop, EventsFailed, OutsideNotFound, usePhaseOf } from './Events.tsx';
import { Refreshing } from './Refreshing.tsx';
import { StaffRosterList } from './staff/StaffRosterList.tsx';
import { Screen } from './Screen.tsx';
import { StepScreen } from '../steps/StepScreen.tsx';
import { LoadingBlock, PageToast, TextAction, type ToastAt } from './Summary.tsx';
import type { ToastAction } from './Toast.tsx';
import { phoneTabBarClearance } from './TodayCover.tsx';
import { Arrived } from './Skeleton.tsx';
import { type ScreenReaderTarget, moveScreenReaderFocus } from './screenReaderFocus.ts';
import { Text, type TextHandle } from './Text.tsx';
import { BodyTitle } from './Title.tsx';
import { PAGE_TITLE, pageTitle } from './topTitle.ts';
import { useSidebarCard } from './sidebarCard.ts';
import { backToEvents, eventTop } from '../kit/eventTop.ts';
import { BACK_KEY, eventBack, overviewGivesWay } from '../kit/eventBack.ts';
import { SEARCH_HREF, SEARCH_OPENED_WITH } from '../kit/searchLinks.ts';
import { toastOverPage } from '../kit/savedRowFocus.ts';
import { EdgeSwipeBack } from './useEdgeSwipeBack.ts';
import { useSystemBack } from './useSystemBack.ts';

const NO_STAFF: readonly EventPlace[] = ['staff'];

interface Editing {
  part: EditPart;
  count: number;
  open: boolean;
  leaves: boolean;
  opener: RefObject<ScreenReaderTarget | null>;
  /** Closed by Save, which shows the saved toast. */
  saved?: boolean;
}

/** An event's page, a screen of its own pushed over Events, Happening now or Calendar (sc-22103). */
export function EventScreen({
  eventId,
  area: asked,
  filter = 'all',
  changedSince,
  copiedFrom,
  opensDuplicate = false,
  opensEdit,
  editLeaves = false,
  keepsTab,
  opensGuest,
  opensEndNow = false,
  cameFrom,
  searched,
}: {
  eventId: string;
  area: EventPlace;
  /** The choice Guests opens on, from a figure that counts it (sc-3786). */
  filter?: Choice;
  /** Changed since you looked, from the look it counts from, when the bell opened it (sc-4331). */
  changedSince?: string | undefined;
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
  /** Chosen from the list of events held from outside, in this event: the way back if it has gone (sc-68438). */
  cameFrom?: string | undefined;
  /** What was typed in a tablet's Search, which closes before the event opens: ‹ Search opens it again with that (sc-83008). */
  searched?: string | undefined;
}) {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const signedIn = useSignedIn();
  const { account, organisation } = signedIn;
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
    getState():
      { routes: readonly { name?: string; params?: unknown }[]; index: number } | undefined;
  }>();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [partRows] = useState(
    () =>
      Object.fromEntries(EDIT_PARTS.map((part) => [part, createRef<ViewInstance>()])) as Record<
        EditPart,
        RefObject<ViewInstance | null>
      >,
  );
  const [guestsOffline, setGuestsOffline] = useState<ScreenOffline>(NOT_OFFLINE);
  const [refreshingBesideBack, setRefreshingBesideBack] = useState(false);
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
    id?: string | undefined;
    action?: ToastAction | null | undefined;
    /** The Save it says, whose row rests above it with a screen reader on (sc-86228). */
    over?: Editing | undefined;
  } | null>(null);
  const [toastAt, setToastAt] = useState<ToastAt | null>(null);
  const [toastClosed, setToastClosed] = useState<{ of: Editing } | null>(null);
  const saves = useRef(0);
  const closeToast = () => {
    if (toast?.over != null) setToastClosed({ of: toast.over });
    setToast(null);
  };
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
  const outside = outsideOn(signedIn, eventId);
  const area = outside == null ? asked : outsideArea(outside.role, asked);
  // An event's link from another of the account's organisations moves it there once the event has loaded, said at the head of Overview until the person leaves it (sc-80863).
  const [moved, setMoved] = useState<{ into: string; words: string } | null>(null);
  const opened = useOpened(
    eventId,
    account != null,
    organisation,
    outside != null,
    () => moveScreenReaderFocus(cardName.current ?? title.current),
    area === 'overview',
    (into, landed) => {
      const name = signedIn.organisations.find(({ id }) => id === into)?.name;

      if (name == null) return;
      switchOrganisation(into, () => {
        landed();
        setMoved({ into, words: t('switcher.switched', { name }) });
      });
    },
    signedIn.organisations,
  );
  if (moved != null && (area !== 'overview' || moved.into !== organisationId)) setMoved(null);
  const { reload, freshen, change, refresh } = opened;
  const top = eventTop(kind, area, opened.kind);
  const { cardNamed, areaTitled } = top;
  const event = opened.kind === 'loaded' ? opened.event : null;
  const noStaff = event != null && !event.permissions.includes('staff.read');
  const creates = event != null && roleHolds(event, 'events.create');
  const manages = offersEdit(event);
  const deletes = offersDelete(event);
  const now = useServerNow();
  const phase = usePhaseOf(event, now);
  const card = useSidebarCard(event);
  const original = backToOriginal(eventId, eventId, copiedFrom);
  const gone =
    account != null &&
    organisation == null &&
    signedIn.pausedIn == null &&
    (opened.kind === 'notFound' || outside == null);
  const away = gone ? wayBack(signedIn, eventId, cameFrom, now) : null;
  const listsGone = opened.kind === 'notFound' && outside != null;

  useEffect(() => {
    if (listsGone) void rereadAccount().catch(() => undefined);
  }, [listsGone]);

  useEffect(() => {
    navigation.setParams({ [SHOWN_EVENT]: eventId });
  }, [navigation, eventId]);

  useEffect(() => {
    if (organisationId != null && outside == null && phase != null && !keepsTab) {
      rememberTabHolding(organisationId, phase);
    }
  }, [organisationId, outside, phase, keepsTab]);

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
  const staffClosed = noStaff && area === 'staff';

  useEffect(() => {
    if (staffClosed) navigation.setParams({ [EVENT_AREA]: 'overview' });
  }, [staffClosed, navigation]);
  const stack = navigation.getState();
  const behind = eventBack(stack?.routes ?? [], stack?.index ?? 0, searched);
  const leave = () => {
    if (original != null) goUpToEvent(navigation, router, original);
    else if (behind.way === 'back' && router.canGoBack()) router.back();
    else if (behind.way === 'search')
      router.replace({ pathname: SEARCH_HREF, params: { [SEARCH_OPENED_WITH]: behind.term } });
    else backToEvents(router);
  };
  const fromSearch = phone && opensGuest != null;
  const back = !fromSearch && areaBack(area) === 'overview' ? () => chooseArea('overview') : leave;
  // Held from outside, Overview is the account's whole app: nothing behind it to go back to (sc-71).
  const backs = outside == null || area !== 'overview';
  const bare = area === 'overview' && outside != null && readsOverview(outside.role);
  const backLabel = fromSearch
    ? t('todayScreen.search')
    : area !== 'overview'
      ? t('eventNav.overview')
      : original != null
        ? t('timeline.backToEvent')
        : t(BACK_KEY[behind.screen]);

  useSystemBack(backs, back);

  const partRef = (part: EditPart): RefObject<ViewInstance | null> => partRows[part];
  const nobody = useRef<ScreenReaderTarget>(null);
  const openEdit = (
    part: EditPart,
    opener: RefObject<ScreenReaderTarget | null>,
    leaves = false,
  ) => {
    setEditing((was) => ({ part, count: (was?.count ?? 0) + 1, open: true, leaves, opener }));
  };
  const closeEdit = (opener?: RefObject<ScreenReaderTarget | null>) =>
    setEditing((was) =>
      was == null
        ? was
        : { ...was, open: false, saved: false, ...(opener == null ? {} : { opener }) },
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
      area === 'overview' && outside != null && readsOverview(outside.role) ? (
        <Arrived style={styles.stack}>
          <OutsideOverview
            event={event}
            held={outside}
            you={kind === 'tabletLandscape' ? null : { name: account?.name ?? '' }}
            nameRef={cardNamed ? cardName : undefined}
            onGuests={() => chooseArea('guests')}
            onPeople={() => chooseArea('people')}
            onCheckIn={
              outside.role === 'can_check_in' && kind !== 'tabletLandscape'
                ? () => router.push({ pathname: '/events/[id]/check-in', params: { id: event.id } })
                : null
            }
          />
        </Arrived>
      ) : area === 'overview' ? (
        <Arrived style={styles.stack}>
          <EventPage
            kind={kind}
            event={event}
            onGuests={(choice) => chooseArea('guests', choice)}
            onPeople={() => chooseArea('people')}
            nameRef={cardNamed ? cardName : undefined}
            manages={manages}
            takes={(action) => takesCardStep(event, action)}
            onChange={change}
            onEdit={onEdit}
            partRef={partRef}
            watched={{ refresh, underBand: eventStale }}
            closedOnto={editing?.open === false ? editing : null}
            toast={
              toast?.eventId === eventId && toast.area === area
                ? toastOverPage(toast, toastAt)
                : null
            }
            toastClosed={toastClosed}
            onDuplicate={onDuplicate}
            onDeleted={onDeleted}
            tell={(words) => setToast({ eventId, area, words })}
            opensEndNow={opensEndNow}
            onEndNowOpened={() => navigation.setParams({ [ASKS_END]: undefined })}
            moved={moved}
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
      ) : area === 'staff' && !noStaff ? (
        <View style={styles.stack} testID="events.area.staff">
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
          <HoursEntry event={event} />
          <StaffRosterList
            key={event.id}
            eventId={event.id}
            when={event}
            manages={event.permissions.includes('staff.manage')}
            finished={(phase ?? event.phase) === 'finished'}
          />
        </View>
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
      <EventNotFound onBack={() => backToEvents(router)} />
    ) : opened.kind === 'failed' ? (
      <EventsFailed
        words={t('eventsScreen.failedLoadEvent')}
        onRetry={opened.retry}
        testID="events.page.retry"
      />
    ) : (
      <LoadingBlock words={t('eventsScreen.loadingEvent')} />
    );

  const guests = area === 'guests' && event != null;
  const menu = area === 'menu' && event != null;
  const refreshing =
    opened.refreshing || (guests && guestsOffline.refreshing) ? (
      <Refreshing testID="events.page.refreshing" wraps={guests || area === 'overview'} />
    ) : null;
  const underTitle =
    area === 'people' && event != null ? (
      <Text size={15} weight="medium" style={[styles.secondary, phone && styles.nameUnderTitle]}>
        {event.name}
      </Text>
    ) : undefined;
  const exportGuests =
    guests && guestsTop.exports != null ? (
      <ExportButton
        ref={guestsExport}
        kind={kind}
        offline={guestsOffline.stale != null}
        onPress={guestsTop.exports}
      />
    ) : null;
  const exportWidest =
    guests && guestsTop.exports != null ? (
      <ExportButton
        kind={kind}
        offline={guestsOffline.stale != null}
        onPress={guestsTop.exports}
        measured
      />
    ) : null;
  const guestBack = guests ? guestsTop.back : null;
  // On Guests' list on a phone, Refreshing… stays beside Back only where the pill stays whole, else it takes its own line under the heading (sc-71821).
  const overviewBack = area === 'overview' && backs && top.frameBack != null;
  const besideBackRow = backRow({
    phone,
    guestsList: guests && guestBack == null,
    cardNamed,
    overview: overviewGivesWay(kind, overviewBack),
  });
  const ownLine =
    besideBackRow === 'givingWay' && area === 'overview' && !refreshingBesideBack
      ? refreshing
      : null;
  const titledInList = areaTitled || guests || menu;
  const frameBack = !backs
    ? undefined
    : guestBack != null
      ? {
          label: guestsTop.toSearch ? t('todayScreen.search') : t('eventNav.guests'),
          onPress: guestBack,
        }
      : top.frameBack === 'area'
        ? { label: backLabel, onPress: back }
        : top.frameBack === 'events' && outside == null
          ? {
              label: original != null ? t('timeline.backToEvent') : t(BACK_KEY[behind.screen]),
              onPress: leave,
            }
          : undefined;

  // With no organisation there is no frame to stand in: no Events to go back to and no tabs, only the way on (sc-68438).
  if (away != null)
    return (
      <StepScreen>
        <OutsideNotFound
          back={away.kind === 'event' ? away.event.name : null}
          onBack={() => {
            void rereadAccount()
              .catch(() => undefined)
              .then(() =>
                away.kind === 'event'
                  ? router.replace(eventHref(away.event.id))
                  : router.replace('/'),
              );
          }}
        />
      </StepScreen>
    );

  return (
    <AppFrame
      current="events"
      title={t(`eventNav.${area}`)}
      titleRef={title}
      untitled={cardNamed || titledInList}
      bareList={!top.inEvent}
      offline={guests ? (guestsOffline.stale ?? opened.stale) : opened.stale}
      besideBack={
        besideBackRow === 'givingWay'
          ? { status: refreshing, onPlaced: setRefreshingBesideBack }
          : besideBackRow === 'beside'
            ? refreshing
            : undefined
      }
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
              outside: outside == null ? undefined : { id: outside.id, role: outside.role },
              hidden: noStaff ? NO_STAFF : undefined,
              bare,
            }
          : undefined
      }
      underTitle={titledInList ? undefined : underTitle}
    >
      <EdgeSwipeBack active={area !== 'overview' && guestBack == null} onBack={back} />
      {guests ? (
        <EventGuests
          key={`${event.id}.${filter}.${changedSince ?? ''}`}
          event={event}
          filter={filter}
          changedSince={changedSince}
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
            <GuestsHeading
              kind={kind}
              titleRef={title}
              refreshing={besideBackRow === 'givingWay' && refreshingBesideBack ? null : refreshing}
              exports={exportGuests}
              exportsWidest={exportWidest}
              onAdd={guestsTop.add ?? null}
              addRef={guestsAdd}
            />
          }
          onOffline={setGuestsOffline}
        />
      ) : menu && event != null ? (
        <EventMenu
          key={event.id}
          event={event}
          kind={kind}
          titleRef={title}
          onGuests={() => chooseArea('guests')}
        />
      ) : (
        <Screen
          edges={bodyEdges(kind)}
          contentStyle={{
            ...(phone
              ? cardNamed
                ? styles.phoneUntitled
                : styles.phone
              : kind === 'tabletPortrait'
                ? styles.tabletPortrait
                : cardNamed
                  ? styles.landscapeUntitled
                  : styles.tabletLandscape),
            ...(area === 'people' ? PEOPLE_UNDER_NAME[kind] : null),
          }}
        >
          {kind === 'tabletLandscape' && cardNamed && refreshing}
          {cardNamed && event == null && !bare && <BellRow />}
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
          {ownLine}
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
          opener={editing.saved === true ? nobody : editing.opener}
          onClose={() => {
            if (editing.leaves && router.canGoBack()) router.back();
            else closeEdit();
          }}
          onSaved={(saved, said) => {
            change(saved);
            if (editing.part === 'cover') setCoverRefused(null);
            const closed = { ...editing, open: false, opener: partRef(editing.part), saved: true };
            setEditing(closed);
            saves.current += 1;
            setToast({
              eventId,
              area,
              words: said ?? t('eventEdit.saved'),
              id: `saved-${saves.current}`,
              over: closed,
            });
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
          id={toast.id}
          action={toast.action}
          onClose={closeToast}
          onAt={setToastAt}
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

/** Staff's way into the event's hours worked (sc-234) and Who's here (sc-3918), for anyone who can see its staff. */
function HoursEntry({ event }: { event: OrganisationEvent }) {
  const { t } = useTranslation();
  if (!event.permissions.includes('staff.read')) return null;

  return (
    <View style={styles.runEntry}>
      <SecondaryButton
        label={t('staffHours.open')}
        link
        onPress={() => router.push({ pathname: '/events/[id]/hours', params: { id: event.id } })}
        testID="events.staff.hours"
      />
      <SecondaryButton
        label={t('whosHere.open')}
        link
        onPress={() =>
          router.push({ pathname: '/events/[id]/whos-here', params: { id: event.id } })
        }
        testID="events.staff.whosHere"
      />
    </View>
  );
}

/** The event is read on its own, so a link, a push and Calendar open it as Events does. */
function useOpened(
  eventId: string,
  accountLoaded: boolean,
  organisation: Membership | null,
  outside: boolean,
  focusTitle: () => void,
  overview: boolean,
  moveInto: (organisationId: string, landed: () => void) => void,
  memberships: readonly Membership[],
): Opened & {
  retry: () => void;
  reload: () => void;
  freshen: () => void;
  change: (event: OrganisationEvent) => void;
  stale: Stale | null;
  refreshing: boolean;
  /** Counts the reloads, the band's Try again among them, for the dates the page reads beside the event (sc-98386). */
  refresh: number;
} {
  const organisationId = organisation?.id;
  const settled = openedWithoutAsking(accountLoaded, organisation, outside);
  const asks = settled == null;
  const [held, setHeld] = useState<{ for: string | null; opened: Opened }>({
    for: null,
    opened: { kind: 'loading' },
  });
  const [attempt, setAttempt] = useState(0);
  const key = `${organisationId ?? ''}/${eventId}`;
  const [link, setLink] = useState<LinkFrom>({ eventId, from: organisationId });
  const linkNow = linkFromIn(link, eventId, organisationId);
  if (linkNow !== link) setLink(linkNow);
  const moves = useRef({ moveInto, memberships, overview, from: linkNow.from });
  useEffect(() => {
    moves.current = { moveInto, memberships, overview, from: linkNow.from };
  });
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
    if (eventId === '' || (organisationId == null && !outside) || !asks) return;
    let live = true;
    const holder = outside ? null : (organisationId ?? null);

    watch(api.event(eventId)).then(
      (event) => {
        if (!live) return;
        const { memberships: all, overview: onOverview, moveInto: move, from } = moves.current;
        const next = openedOrMoved(event, holder, all, onOverview, from);

        if ('opened' in next) {
          setHeld({ for: key, opened: next.opened });
          return;
        }
        // Until the move lands the page stays in this organisation, so Stay on an unsaved-changes ask leaves it as it would be here.
        setHeld({ for: key, opened: openedOf({ event }, holder) });
        move(next.moves, () =>
          setHeld({ for: `${next.moves}/${eventId}`, opened: { kind: 'loaded', event } }),
        );
      },
      (error: unknown) =>
        live &&
        setHeld((before) =>
          before.for === key && before.opened.kind === 'loaded' && keepsWhatLoaded(error)
            ? before
            : { for: key, opened: openedOf({ error }, holder) },
        ),
    );

    return () => {
      live = false;
    };
  }, [eventId, organisationId, outside, asks, key, attempt, watch]);

  if (settled != null)
    return {
      ...settled,
      retry,
      reload,
      freshen,
      change,
      stale: null,
      refreshing: false,
      refresh: attempt,
    };

  return {
    ...(held.for === key ? held.opened : { kind: 'loading' }),
    retry,
    reload,
    freshen,
    change,
    stale,
    refreshing,
    refresh: attempt,
  };
}

/** People's blocks start 16 under the event's name at every size, as its demo draws them; the frame's own foot counts towards it. */
const PEOPLE_UNDER_NAME = StyleSheet.create({
  phone: { paddingTop: 0 },
  tabletPortrait: { gap: tokens.spaceXl },
  tabletLandscape: { paddingTop: tokens.spaceXl - tokens.spaceLg },
});

const styles = StyleSheet.create({
  stack: { gap: tokens.spaceMd },
  nameUnderTitle: { marginTop: tokens.spaceXxs },
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
