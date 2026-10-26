import type { Membership, OrganisationEvent } from '@soirely/api-client';
import { roleHolds } from '@soirely/domain';
import { Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, RefreshControl, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { DESTINATION_HREF } from '../kit/appNav.ts';
import {
  type Opened,
  type Selection,
  openedOf,
  openedWithoutAsking,
  selectionIn,
} from '../kit/eventsOpen.ts';
import { useLayout } from '../layout/useLayout.ts';
import { useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { AppFrame } from './AppFrame.tsx';
import { EventList, EventNotFound, EventPage, EventsFailed, NoEvents } from './Events.tsx';
import { type ListAndPageSpacing, ListAndPage } from './ListAndPage.tsx';
import { Notice } from './Notice.tsx';
import { Text } from './Text.tsx';
import { cardFrame } from './cardFrame.ts';

type Load =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'loaded'; events: OrganisationEvent[]; refreshing: boolean };

const LOADING: Load = { kind: 'loading' };

/** Events, `EventsHome-*` and `EventView-*` (sc-1593): the organisation's events, read-only, and an event's page. */
export function EventsScreen({ linked = null }: { linked?: string | null }) {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { account, organisation } = useSignedIn();
  const organisationId = organisation?.id;
  const reads = organisation != null && roleHolds(organisation, 'events.read');
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
  const select = (id: string | null) => setSelected({ in: organisationId, id });

  // The rows stay in place while they reload; a failed load gives way to loading.
  const reload = useCallback(() => {
    setChanged(null);
    setHeld((before) => ({
      in: before.in,
      load: before.load.kind === 'loaded' ? { ...before.load, refreshing: true } : LOADING,
    }));
    setAttempt((n) => n + 1);
  }, []);

  useFocusEffect(reload);

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') reload();
    });

    return () => listener.remove();
  }, [reload]);

  useEffect(() => {
    if (organisationId == null || !reads || attempt === 0) return;
    let live = true;

    api.events(organisationId).then(
      (events) =>
        live &&
        setHeld({ in: organisationId, load: { kind: 'loaded', events, refreshing: false } }),
      () => live && setHeld({ in: organisationId, load: { kind: 'failed' } }),
    );

    return () => {
      live = false;
    };
  }, [organisationId, reads, attempt]);

  const listed =
    load.kind === 'loaded' && open != null
      ? (load.events.find((event) => event.id === open) ?? null)
      : null;
  const manages = organisation != null && roleHolds(organisation, 'events.manage');
  const latest = (event: OrganisationEvent) => (changed?.id === event.id ? changed : event);
  const onChange = (event: OrganisationEvent) => {
    setChanged(event);
    setHeld((before) =>
      before.load.kind === 'loaded'
        ? {
            in: before.in,
            load: {
              ...before.load,
              events: before.load.events.map((each) => (each.id === event.id ? event : each)),
            },
          }
        : before,
    );
  };
  const opened = useOpened(
    open != null && listed == null && (load.kind !== 'loading' || !reads) ? open : null,
    account != null,
    organisation,
  );

  if (organisation != null && !reads && open == null) {
    return <Redirect href={DESTINATION_HREF.home} />;
  }

  const page =
    open == null ? null : listed != null ? (
      <EventPage kind={kind} event={latest(listed)} manages={manages} onChange={onChange} />
    ) : opened.kind === 'loaded' ? (
      <EventPage kind={kind} event={latest(opened.event)} manages={manages} onChange={onChange} />
    ) : opened.kind === 'notFound' ? (
      <EventNotFound onBack={() => select(null)} />
    ) : opened.kind === 'failed' ? (
      <EventsFailed onRetry={opened.retry} testID="events.page.retry" />
    ) : (
      <Waiting words={t('eventsScreen.loadingEvent')} />
    );
  const inFront = page != null;
  const pageName = listed?.name ?? (opened.kind === 'loaded' ? opened.event.name : null);

  const heading = !phone && (
    <Text size={tokens.typeTitlePhone.size} weight="bold" accessibilityRole="header">
      {t('eventsScreen.title')}
    </Text>
  );

  const list = !reads ? null : load.kind === 'loading' ? (
    <Waiting words={t('eventsScreen.loading')} />
  ) : load.kind === 'failed' ? (
    <EventsFailed onRetry={reload} testID="events.retry" />
  ) : (
    <View style={styles.stack}>
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
      {load.events.length === 0 ? (
        <NoEvents
          kind={kind}
          creates={organisation != null && roleHolds(organisation, 'events.create')}
        />
      ) : (
        <EventList events={load.events} open={open} onOpen={select} />
      )}
    </View>
  );

  return (
    <AppFrame
      current="events"
      title={phone && inFront ? (pageName ?? t('eventsScreen.title')) : t('eventsScreen.title')}
      back={
        phone && inFront
          ? { label: t('eventsScreen.title'), onPress: () => select(null) }
          : undefined
      }
    >
      <ListAndPage
        heading={heading}
        list={list}
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
        pageKey={open ?? ''}
        pageBelowUpright
        back={{
          label: t('eventsScreen.title'),
          onPress: () => select(null),
          testID: 'events.back',
        }}
        spacing={SPACING}
      />
    </AppFrame>
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
