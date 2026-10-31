import type { ListedEvent, Membership, OrganisationEvent } from '@soirely/api-client';
import {
  type EventsTab,
  rememberEventsTab,
  rememberedEventsTab,
  roleHolds,
  serverClock,
  withPastPage,
} from '@soirely/domain';
import { Redirect, router, useFocusEffect, useNavigation } from 'expo-router';
import { type RefCallback, useCallback, useEffect, useState } from 'react';
import { AppState, RefreshControl, StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { DESTINATION_HREF } from '../kit/appNav.ts';
import { SHOWN_EVENT, goUpToEvent } from '../kit/upToEvent.ts';
import { backToOriginal } from '../kit/eventDuplicate.ts';
import { offersDelete } from '../kit/eventDelete.ts';
import { takeCoverRefused, takeSaved } from '../kit/eventSaved.ts';
import {
  type Opened,
  type Selection,
  hasNoEvents,
  openedOf,
  openedWithoutAsking,
  pageless,
  selectionIn,
} from '../kit/eventsOpen.ts';
import { useLayout } from '../layout/useLayout.ts';
import { useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { AppFrame } from './AppFrame.tsx';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { EventNotFound, EventPage, EventsFailed, NoEvents } from './Events.tsx';
import { EventsHome, type HomeLoad } from './EventsHome.tsx';
import { type ListAndPageSpacing, ListAndPage, useListAndPageLayout } from './ListAndPage.tsx';
import { Notice } from './Notice.tsx';
import { ReadOut } from './ReadOut.tsx';
import { FocusBack, type StepClosed, stepClosed, useScrolledToTop } from './Screen.tsx';
import { Text } from './Text.tsx';
import { cardFrame } from './cardFrame.ts';
import { useSystemBack } from './useSystemBack.ts';

type Load =
  { kind: 'loading' } | { kind: 'failed' } | ({ kind: 'loaded'; refreshing: boolean } & HomeLoad);

const PAST_PAGE = 10;

const LOADING: Load = { kind: 'loading' };

/** Events, `EventsHome-*` and `EventView-*` (sc-1593): the organisation's events, read-only, and an event's page. */
export function EventsScreen({
  linked = null,
  copiedFrom,
}: {
  linked?: string | null;
  /** The event this one was duplicated from, when Duplicate opened it (sc-22145). */
  copiedFrom?: string | undefined;
}) {
  const { t } = useTranslation();
  const { kind } = useListAndPageLayout(SPACING, 'nothing');
  const { account, organisation } = useSignedIn();
  const organisationId = organisation?.id;
  const reads = organisation != null && roleHolds(organisation, 'events.read');
  const creates = organisation != null && roleHolds(organisation, 'events.create');
  const manages = organisation != null && roleHolds(organisation, 'events.manage');
  const deletes = offersDelete(organisation);
  const [deleted, setDeleted] = useState<string | null>(null);
  const [savedEvent, setSavedEvent] = useState<string | null>(null);
  const [coverRefused, setCoverRefused] = useState<{ eventId: string; reason: string } | null>(
    null,
  );
  const phone = kind === 'phone';
  const landscape = kind === 'tabletLandscape';

  const [held, setHeld] = useState<{ in: string | undefined; load: Load }>({
    in: organisationId,
    load: LOADING,
  });
  const load = held.in === organisationId ? held.load : LOADING;
  const [attempt, setAttempt] = useState(0);
  // An event changed on its page, until the next load reads it from the server too.
  const [changed, setChanged] = useState<OrganisationEvent | null>(null);

  const [selected, setSelected] = useState<Selection>({ in: organisationId, id: linked });
  const current = selectionIn(selected, organisationId);
  if (current !== selected) setSelected(current);
  const open = current.id;
  const [closed, setClosed] = useState<StepClosed | undefined>(undefined);
  const select = (id: string | null, back?: StepClosed) => {
    if (id != null) setDeleted(null);
    setSelected({ in: organisationId, id });
    setClosed(back);
  };
  const toList = () => select(null, open == null ? undefined : stepClosed(`row.${open}`));
  const navigation = useNavigation<{
    setParams(params: { [SHOWN_EVENT]: string | undefined }): void;
    getState(): { routes: readonly { params?: unknown }[]; index: number } | undefined;
  }>();
  const original = backToOriginal(linked, open, copiedFrom);
  const back =
    original == null
      ? { label: t('eventsScreen.title'), onPress: toList }
      : {
          label: t('timeline.backToEvent'),
          onPress: () => goUpToEvent(navigation, router, original),
        };

  useEffect(() => {
    navigation.setParams({ [SHOWN_EVENT]: open ?? undefined });
  }, [navigation, open]);

  // The rows stay in place while they reload; a failed load gives way to loading.
  const reload = useCallback(() => {
    setChanged(null);
    setHeld((before) => ({
      in: before.in,
      load: before.load.kind === 'loaded' ? { ...before.load, refreshing: true } : LOADING,
    }));
    setAttempt((n) => n + 1);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setSavedEvent(takeSaved());
      setCoverRefused(takeCoverRefused());
      setDeleted(null);
      reload();

      // Gone while the page is covered, so the next save mounts Saved afresh and scrolls up to it.
      return () => setSavedEvent(null);
    }, [reload]),
  );

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') reload();
    });

    return () => listener.remove();
  }, [reload]);

  useEffect(() => {
    if (organisationId == null || !reads || attempt === 0) return;
    let live = true;

    Promise.all([
      api.unfinishedEvents(organisationId),
      api.events(organisationId, { finished: true, itemsPerPage: PAST_PAGE }),
    ]).then(
      ([unfinished, past]) =>
        live &&
        setHeld({
          in: organisationId,
          load: {
            kind: 'loaded',
            unfinished,
            past: past.events,
            pastTotal: past.total,
            pastPages: 1,
            at: serverClock.now(),
            refreshing: false,
          },
        }),
      () => live && setHeld({ in: organisationId, load: { kind: 'failed' } }),
    );

    return () => {
      live = false;
    };
  }, [organisationId, reads, attempt]);

  const [tab, setTab] = useState<{ in: string | undefined; tab: EventsTab }>(() => ({
    in: organisationId,
    tab: organisationId == null ? 'upcoming' : rememberedEventsTab(organisationId),
  }));
  if (tab.in !== organisationId) {
    setTab({
      in: organisationId,
      tab: organisationId == null ? 'upcoming' : rememberedEventsTab(organisationId),
    });
  }
  const [more, setMore] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [moreShown, setMoreShown] = useState<string | null>(null);
  const showMore = () => {
    if (organisationId == null || load.kind !== 'loaded') return;
    const loaded = load;

    setMore('loading');
    api
      .events(organisationId, {
        finished: true,
        page: loaded.pastPages + 1,
        itemsPerPage: PAST_PAGE,
      })
      .then(
        (page) => {
          const read = withPastPage(loaded, page, PAST_PAGE);

          setHeld({ in: organisationId, load: read.load });
          setMoreShown(t('eventsScreen.moreShown', { count: read.added }));
          setMore('idle');
        },
        () => setMore('failed'),
      );
  };
  const everyLoaded = load.kind === 'loaded' ? [...load.unfinished, ...load.past] : [];
  const listed = open != null ? (everyLoaded.find((event) => event.id === open) ?? null) : null;
  const latest = (event: OrganisationEvent) => (changed?.id === event.id ? changed : event);
  const onChange = (event: OrganisationEvent) => {
    setChanged(event);
    setHeld((before) =>
      before.load.kind === 'loaded'
        ? {
            in: before.in,
            load: {
              ...before.load,
              unfinished: before.load.unfinished.map((each) => kept(each, event)),
              past: before.load.past.map((each) => kept(each, event)),
            },
          }
        : before,
    );
  };
  const onDeleted = deletes
    ? (event: OrganisationEvent) => {
        setHeld((before) =>
          before.load.kind === 'loaded'
            ? {
                in: before.in,
                load: {
                  ...before.load,
                  unfinished: before.load.unfinished.filter((each) => each.id !== event.id),
                  past: before.load.past.filter((each) => each.id !== event.id),
                },
              }
            : before,
        );
        setDeleted(event.name);
        select(null);
        reload();
      }
    : undefined;
  const opened = useOpened(
    open != null && listed == null && (load.kind !== 'loading' || !reads) ? open : null,
    account != null,
    organisation,
  );

  useSystemBack(linked != null && !landscape && open == null, () =>
    router.dismissTo(DESTINATION_HREF.home),
  );
  useSystemBack(landscape && original != null, back.onPress);

  if (organisation != null && !reads && open == null) {
    return <Redirect href={DESTINATION_HREF.home} />;
  }

  const onEdit = manages
    ? () => open != null && router.push(`/events/${encodeURIComponent(open)}/edit`)
    : undefined;
  const onDuplicate = creates
    ? () => open != null && router.push(`/events/${encodeURIComponent(open)}/duplicate`)
    : undefined;
  const found = listed ?? (opened.kind === 'loaded' ? opened.event : null);
  const shown = found == null ? null : latest(found);
  const page =
    open == null ? null : shown != null ? (
      <View style={styles.stack}>
        {savedEvent === open && <Saved />}
        <EventPage
          kind={kind}
          event={shown}
          manages={manages}
          onChange={onChange}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDeleted={onDeleted}
        />
        {coverRefused?.eventId === open && (
          <View style={styles.stack}>
            <Notice
              tone="broken"
              mark={tokens.marks.broken.glyph}
              body={t('eventCover.createdWithout', { reason: coverRefused.reason })}
              announce
            />
            {onEdit != null && (
              <SecondaryButton
                label={t('eventEdit.open')}
                onPress={onEdit}
                testID="events.page.coverRefused.edit"
              />
            )}
          </View>
        )}
      </View>
    ) : opened.kind === 'notFound' ? (
      <EventNotFound onBack={toList} />
    ) : opened.kind === 'failed' ? (
      <EventsFailed onRetry={opened.retry} testID="events.page.retry" />
    ) : (
      <Waiting words={t('eventsScreen.loadingEvent')} />
    );
  const inFront = page != null;
  const newEvent = () => router.push('/events/new');

  const list = (opener: (key: string) => RefCallback<ViewInstance>) =>
    !reads ? null : load.kind === 'loading' ? (
      <Waiting words={t('eventsScreen.loading')} />
    ) : load.kind === 'failed' ? (
      <EventsFailed onRetry={reload} testID="events.retry" />
    ) : (
      <View style={styles.stack}>
        {deleted != null && (
          <ReadOut words={t('eventDelete.deleted', { event: deleted })}>
            <Notice
              tone="done"
              mark={tokens.marks.done.glyph}
              body={t('eventDelete.deleted', { event: deleted })}
            />
          </ReadOut>
        )}
        {load.refreshing && (
          <Text
            size={tokens.typeSmall.size}
            muted
            accessibilityRole="text"
            testID="events.refreshing"
          >
            {t('eventsScreen.refreshing')}
          </Text>
        )}
        {hasNoEvents(load) ? (
          <NoEvents kind={kind} onCreate={creates ? newEvent : undefined} />
        ) : (
          <>
            {creates && (
              <PrimaryButton
                label={t('eventsScreen.newEvent')}
                onPress={newEvent}
                testID="events.new"
              />
            )}
            <EventsHome
              kind={kind}
              load={load}
              tab={tab.tab}
              onTab={(next) => {
                if (organisationId != null) rememberEventsTab(organisationId, next);
                setTab({ in: organisationId, tab: next });
              }}
              open={open}
              onOpen={select}
              opener={opener}
              more={more}
              shown={moreShown}
              onShowMore={showMore}
            />
          </>
        )}
      </View>
    );

  return (
    <AppFrame
      current="events"
      title={t('eventsScreen.title')}
      back={phone && inFront ? back : undefined}
    >
      <ListAndPage
        kind={kind}
        list={<FocusBack closed={closed}>{list}</FocusBack>}
        listRefresh={
          reads && load.kind === 'loaded' ? (
            <RefreshControl refreshing={load.refreshing} onRefresh={reload} />
          ) : undefined
        }
        page={
          page ??
          (landscape && reads && (
            <Notice tone="quiet" mark={tokens.marks.info.glyph} body={t('eventsScreen.choose')} />
          ))
        }
        pageInFront={inFront}
        pageless={pageless(load, inFront)}
        pageKey={open ?? ''}
        back={{
          label: original == null ? t('eventsScreen.back') : t('eventsScreen.backToEvent'),
          onPress: back.onPress,
          testID: 'events.back',
          revealsList: original == null,
        }}
        spacing={SPACING}
      />
    </AppFrame>
  );
}

/** An edit on the event's page, with the milestones the list read, until the next load reads both again. */
function kept(listed: ListedEvent, changed: OrganisationEvent): ListedEvent {
  return listed.id === changed.id ? { ...changed, milestones: listed.milestones } : listed;
}

/** A save goes back to the page where it was scrolled, so Saved brings itself into sight (sc-21336). */
function Saved() {
  const { t } = useTranslation();
  const top = useScrolledToTop();

  return (
    <View ref={top} collapsable={false}>
      <ReadOut words={t('eventEdit.saved')}>
        <Notice tone="done" mark={tokens.marks.done.glyph} body={t('eventEdit.saved')} />
      </ReadOut>
    </View>
  );
}

function Waiting({ words }: { words: string }) {
  const { kind } = useLayout();

  return (
    <View style={cardFrame(kind)}>
      <Text size={tokens.typeBodyPhone.size} muted accessibilityRole="text">
        {words}
      </Text>
    </View>
  );
}

/** An event opened by a link is read on its own, since the list may not hold it. */
function useOpened(
  eventId: string | null,
  accountLoaded: boolean,
  organisation: Membership | null,
): Opened & { retry: () => void } {
  const organisationId = organisation?.id;
  const settled = openedWithoutAsking(accountLoaded, organisation);
  const asks = settled == null;
  const [held, setHeld] = useState<{ for: string | null; opened: Opened }>({
    for: null,
    opened: { kind: 'loading' },
  });
  const [attempt, setAttempt] = useState(0);
  const key = `${organisationId ?? ''}/${eventId ?? ''}`;
  const retry = useCallback(() => {
    setHeld({ for: null, opened: { kind: 'loading' } });
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (eventId == null || organisationId == null || !asks) return;
    let live = true;

    api.event(eventId).then(
      (event) => live && setHeld({ for: key, opened: openedOf({ event }, organisationId) }),
      (error: unknown) =>
        live && setHeld({ for: key, opened: openedOf({ error }, organisationId) }),
    );

    return () => {
      live = false;
    };
  }, [eventId, organisationId, asks, key, attempt]);

  if (settled != null) return { ...settled, retry };

  return { ...(held.for === key ? held.opened : { kind: 'loading' }), retry };
}

const styles = StyleSheet.create({
  stack: { gap: tokens.spaceMd },
  phone: {
    gap: tokens.spaceLg,
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.spaceXl,
    paddingBottom: tokens.space3xl,
  },
  portrait: {
    gap: 14,
    paddingTop: tokens.space3xl,
    paddingHorizontal: tokens.space4xl,
    paddingBottom: tokens.space6xl,
  },
  landscape: {
    gap: 14,
    paddingTop: tokens.space3xl,
    paddingHorizontal: tokens.space3xl,
  },
  column: { gap: tokens.spaceLg, paddingBottom: tokens.space5xl },
});

const SPACING: ListAndPageSpacing = {
  phone: styles.phone,
  tabletPortrait: styles.portrait,
  landscape: styles.landscape,
  column: styles.column,
  listWidth: 360,
  between: tokens.spaceXxl,
};
