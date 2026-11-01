import {
  type EventsTab,
  rememberEventsTab,
  rememberedEventsTab,
  roleHolds,
  serverClock,
  withPastPage,
} from '@soirely/domain';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, RefreshControl, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { DESTINATION_HREF } from '../kit/appNav.ts';
import { eventHref } from '../kit/eventNav.ts';
import { takeDeleted } from '../kit/eventSaved.ts';
import { hasNoEvents } from '../kit/eventsOpen.ts';
import { useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { AppFrame } from './AppFrame.tsx';
import { EventsFailed, NoEvents } from './Events.tsx';
import { EventsHome, EventsSummary, type HomeLoad } from './EventsHome.tsx';
import { type ListAndPageSpacing, ListAndPage, useListAndPageLayout } from './ListAndPage.tsx';
import { Notice } from './Notice.tsx';
import { ReadOut } from './ReadOut.tsx';
import { AnswerInView } from './Screen.tsx';
import { Text } from './Text.tsx';
import { Arrived, Skeleton } from './Skeleton.tsx';

type Load =
  { kind: 'loading' } | { kind: 'failed' } | ({ kind: 'loaded'; refreshing: boolean } & HomeLoad);

const PAST_PAGE = 10;

const LOADING: Load = { kind: 'loading' };

/** Events, `EventsHome-*` (sc-1593): the organisation's events; an event's page is pushed over it (sc-22103). */
export function EventsScreen() {
  const { t } = useTranslation();
  const { kind } = useListAndPageLayout(SPACING, 'nothing');
  const { organisation } = useSignedIn();
  const organisationId = organisation?.id;
  const reads = organisation != null && roleHolds(organisation, 'events.read');
  const creates = organisation != null && roleHolds(organisation, 'events.create');
  const [deleted, setDeleted] = useState<string | null>(null);

  const [held, setHeld] = useState<{ in: string | undefined; load: Load }>({
    in: organisationId,
    load: LOADING,
  });
  const load = held.in === organisationId ? held.load : LOADING;
  const [attempt, setAttempt] = useState(0);

  // The rows stay in place while they reload; a failed load gives way to loading.
  const reload = useCallback(() => {
    setHeld((before) => ({
      in: before.in,
      load: before.load.kind === 'loaded' ? { ...before.load, refreshing: true } : LOADING,
    }));
    setAttempt((n) => n + 1);
  }, []);

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

  useFocusEffect(
    useCallback(() => {
      setDeleted(takeDeleted());
      // Back from an event's page lands on the tab that now holds it.
      if (organisationId != null) {
        setTab({ in: organisationId, tab: rememberedEventsTab(organisationId) });
      }
      reload();
    }, [reload, organisationId]),
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

  if (organisation != null && !reads) {
    return <Redirect href={DESTINATION_HREF.home} />;
  }

  const newEvent = () => router.push('/events/new');
  const openEvent = (id: string, fromHappeningNow: boolean) => {
    setDeleted(null);
    router.push(eventHref(id, fromHappeningNow));
  };

  const list = !reads ? null : load.kind === 'loading' ? (
    <Skeleton words={t('eventsScreen.loading')} shape="rows" rowHeight={76} picture />
  ) : load.kind === 'failed' ? (
    <EventsFailed onRetry={reload} testID="events.retry" />
  ) : (
    <Arrived style={styles.stack}>
      {deleted != null && (
        <AnswerInView key={deleted}>
          <ReadOut words={t('eventDelete.deleted', { event: deleted })}>
            <Notice
              tone="done"
              mark={tokens.marks.done.glyph}
              body={t('eventDelete.deleted', { event: deleted })}
            />
          </ReadOut>
        </AnswerInView>
      )}
      {hasNoEvents(load) ? (
        <NoEvents kind={kind} onCreate={creates ? newEvent : undefined} />
      ) : (
        <EventsHome
          kind={kind}
          load={load}
          tab={tab.tab}
          onTab={(next) => {
            if (organisationId != null) rememberEventsTab(organisationId, next);
            setTab({ in: organisationId, tab: next });
          }}
          onOpen={openEvent}
          more={more}
          shown={moreShown}
          onShowMore={showMore}
        />
      )}
    </Arrived>
  );
  const firstVisit = load.kind === 'loaded' && hasNoEvents(load);
  const underTitle =
    !reads || load.kind !== 'loaded' ? null : load.refreshing ? (
      <Text
        size={tokens.typeBodyPhone.size}
        muted
        accessibilityRole="text"
        testID="events.refreshing"
      >
        {t('eventsScreen.refreshing')}
      </Text>
    ) : !firstVisit ? (
      <EventsSummary load={load} />
    ) : null;

  return (
    <AppFrame
      current="events"
      title={t('eventsScreen.title')}
      underTitle={underTitle}
      primary={
        creates && !firstVisit
          ? { label: t('eventsScreen.newEvent'), onPress: newEvent, testID: 'events.new' }
          : undefined
      }
    >
      <ListAndPage
        kind={kind}
        list={list}
        listRefresh={
          reads && load.kind === 'loaded' ? (
            <RefreshControl refreshing={load.refreshing} onRefresh={reload} />
          ) : undefined
        }
        page={null}
        pageInFront={false}
        pageless
        pageKey=""
        back={{ label: t('eventsScreen.back'), onPress: () => undefined, testID: 'events.back' }}
        spacing={SPACING}
      />
    </AppFrame>
  );
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
