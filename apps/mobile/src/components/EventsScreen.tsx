import type { Membership, OrganisationEvent } from '@soirely/api-client';
import { roleHolds } from '@soirely/domain';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, RefreshControl, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { DESTINATION_HREF } from '../kit/appNav.ts';
import { offersDelete } from '../kit/eventDelete.ts';
import { takeCoverRefused, takeSaved } from '../kit/eventSaved.ts';
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
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { EventList, EventNotFound, EventPage, EventsFailed, NoEvents } from './Events.tsx';
import { type ListAndPageSpacing, ListAndPage, useListAndPageKind } from './ListAndPage.tsx';
import { Notice } from './Notice.tsx';
import { ReadOut } from './ReadOut.tsx';
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
  const kind = useListAndPageKind(SPACING, 'nothing');
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
  const select = (id: string | null) => {
    if (id != null) setDeleted(null);
    setSelected({ in: organisationId, id });
  };

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
      api.events(organisationId, { finished: true, itemsPerPage: 200 }),
    ]).then(
      ([unfinished, finished]) =>
        live &&
        setHeld({
          in: organisationId,
          load: { kind: 'loaded', events: [...unfinished, ...finished.events], refreshing: false },
        }),
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
  const onDeleted = deletes
    ? (event: OrganisationEvent) => {
        setHeld((before) =>
          before.load.kind === 'loaded'
            ? {
                in: before.in,
                load: {
                  ...before.load,
                  events: before.load.events.filter((each) => each.id !== event.id),
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

  if (organisation != null && !reads && open == null) {
    return <Redirect href={DESTINATION_HREF.home} />;
  }

  const onEdit = manages
    ? () => open != null && router.push(`/events/${encodeURIComponent(open)}/edit`)
    : undefined;
  const found = listed ?? (opened.kind === 'loaded' ? opened.event : null);
  const shown = found == null ? null : latest(found);
  const page =
    open == null ? null : shown != null ? (
      <View style={styles.stack}>
        {savedEvent === open && (
          <ReadOut words={t('eventEdit.saved')}>
            <Notice tone="done" mark={tokens.marks.done.glyph} body={t('eventEdit.saved')} />
          </ReadOut>
        )}
        <EventPage
          kind={kind}
          event={shown}
          manages={manages}
          onChange={onChange}
          onEdit={onEdit}
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
      <EventNotFound onBack={() => select(null)} />
    ) : opened.kind === 'failed' ? (
      <EventsFailed onRetry={opened.retry} testID="events.page.retry" />
    ) : (
      <Waiting words={t('eventsScreen.loadingEvent')} />
    );
  const inFront = page != null;
  const pageName = shown?.name ?? null;
  const newEvent = () => router.push('/events/new');

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
      {load.events.length === 0 ? (
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
          <EventList events={load.events} open={open} onOpen={select} />
        </>
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
        kind={kind}
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
