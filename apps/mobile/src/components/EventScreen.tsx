import type { Membership, OrganisationEvent } from '@soirely/api-client';
import { type EventArea, rememberTabHolding, roleHolds } from '@soirely/domain';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { DESTINATION_HREF } from '../kit/appNav.ts';
import { offersDelete } from '../kit/eventDelete.ts';
import { backToOriginal } from '../kit/eventDuplicate.ts';
import { type EditAt, EVENT_AREA, areaBack } from '../kit/eventNav.ts';
import { markDeleted, takeCoverRefused, takeSaved } from '../kit/eventSaved.ts';
import { type Opened, openedOf, openedWithoutAsking } from '../kit/eventsOpen.ts';
import { SHOWN_EVENT, goUpToEvent } from '../kit/upToEvent.ts';
import { useServerNow } from '../kit/serverNow.ts';
import { useLayout } from '../layout/useLayout.ts';
import { useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { AppFrame, BackButton } from './AppFrame.tsx';
import { bodyEdges } from './bodyEdges.ts';
import { SecondaryButton } from './Buttons.tsx';
import { cardFrame } from './cardFrame.ts';
import { EventNotFound, EventPage, EventTop, EventsFailed, usePhaseOf } from './Events.tsx';
import { Notice } from './Notice.tsx';
import { ReadOut } from './ReadOut.tsx';
import { Screen, useScrolledToTop } from './Screen.tsx';
import { Arrived, Skeleton } from './Skeleton.tsx';
import { Text } from './Text.tsx';
import { useEdgeSwipeBack } from './useEdgeSwipeBack.ts';
import { useSystemBack } from './useSystemBack.ts';

/** An event's page, a screen of its own pushed over Events, Happening now or Calendar (sc-22103). */
export function EventScreen({
  eventId,
  area,
  copiedFrom,
  keepsTab,
}: {
  eventId: string;
  area: EventArea;
  /** The event this one was duplicated from, when Duplicate opened it (sc-22145). */
  copiedFrom?: string | undefined;
  /** Opened from Happening now, so Back returns to the tab that was showing. */
  keepsTab: boolean;
}) {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { account, organisation } = useSignedIn();
  const organisationId = organisation?.id;
  const reads = organisation != null && roleHolds(organisation, 'events.read');
  const creates = organisation != null && roleHolds(organisation, 'events.create');
  const manages = organisation != null && roleHolds(organisation, 'events.manage');
  const deletes = offersDelete(organisation);
  const phone = kind === 'phone';
  const navigation = useNavigation<{
    setParams(params: { [SHOWN_EVENT]?: string; [EVENT_AREA]?: EventArea }): void;
    getState(): { routes: readonly { params?: unknown }[]; index: number } | undefined;
  }>();
  const [savedEvent, setSavedEvent] = useState<string | null>(null);
  const [coverRefused, setCoverRefused] = useState<{ eventId: string; reason: string } | null>(
    null,
  );
  const opened = useOpened(eventId, account != null, organisation);
  const { reload, change } = opened;
  const event = opened.kind === 'loaded' ? opened.event : null;
  const now = useServerNow();
  const phase = usePhaseOf(event, now);
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
      setSavedEvent(takeSaved());
      setCoverRefused(takeCoverRefused());
      reload();

      // Gone while the page is covered, so the next save mounts Saved afresh and scrolls up to it.
      return () => setSavedEvent(null);
    }, [reload]),
  );

  const chooseArea = (next: EventArea) => navigation.setParams({ [EVENT_AREA]: next });
  const leave = () => {
    if (original != null) goUpToEvent(navigation, router, original);
    else if (router.canGoBack()) router.back();
    else router.replace(DESTINATION_HREF.events);
  };
  const back = areaBack(area) === 'overview' ? () => chooseArea('overview') : leave;
  const backLabel =
    area !== 'overview'
      ? t('eventNav.overview')
      : original != null
        ? t('timeline.backToEvent')
        : t('eventsScreen.title');

  useSystemBack(true, back);
  useEdgeSwipeBack(area !== 'overview', back);

  const onEdit = manages
    ? (at?: EditAt) =>
        router.push(`/events/${encodeURIComponent(eventId)}/edit${at == null ? '' : `?at=${at}`}`)
    : undefined;
  const onDuplicate = creates
    ? () => router.push(`/events/${encodeURIComponent(eventId)}/duplicate`)
    : undefined;
  const onDeleted = deletes
    ? (gone: OrganisationEvent) => {
        markDeleted(gone.name);
        router.dismissTo(DESTINATION_HREF.events);
      }
    : undefined;

  const body =
    organisation != null && !reads ? (
      <EventNotFound onBack={leave} />
    ) : event != null ? (
      area === 'overview' ? (
        <Arrived style={styles.stack}>
          {savedEvent === eventId && <Saved />}
          <EventPage
            kind={kind}
            event={event}
            manages={manages}
            onChange={change}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onDeleted={onDeleted}
          />
          {coverRefused?.eventId === eventId && (
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
                  onPress={() => onEdit()}
                  testID="events.page.coverRefused.edit"
                />
              )}
            </View>
          )}
        </Arrived>
      ) : (
        <PlaceholderArea area={area}>
          <EventTop
            kind={kind}
            event={event}
            phase={phase ?? event.phase}
            manages={manages}
            now={now}
            onChange={change}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
          />
        </PlaceholderArea>
      )
    ) : opened.kind === 'notFound' ? (
      <EventNotFound onBack={leave} />
    ) : opened.kind === 'failed' ? (
      <EventsFailed onRetry={opened.retry} testID="events.page.retry" />
    ) : (
      <Skeleton
        words={t('eventsScreen.loadingEvent')}
        shape="cards"
        titled
        cards={[{ lines: 2 }, { lines: 3 }, { lines: 2 }]}
      />
    );

  return (
    <AppFrame
      current="events"
      title={t(`eventNav.${area}`)}
      back={phone ? { label: backLabel, onPress: back } : undefined}
      backInBody
      inEvent={event == null ? undefined : { area, onArea: chooseArea }}
    >
      <Screen edges={bodyEdges(kind)} contentStyle={phone ? styles.phone : styles.tablet}>
        {!phone && <BackButton label={backLabel} onPress={back} testID="events.back" />}
        {body}
      </Screen>
    </AppFrame>
  );
}

/** An area no epic has built yet: under the Top, its own name and a line saying it is coming, and nothing to press. */
function PlaceholderArea({
  area,
  children,
}: {
  area: Exclude<EventArea, 'overview'>;
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
      </View>
    </View>
  );
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

/** The event is read on its own, so a link, a push and Calendar open it as Events does. */
function useOpened(
  eventId: string,
  accountLoaded: boolean,
  organisation: Membership | null,
): Opened & {
  retry: () => void;
  reload: () => void;
  change: (event: OrganisationEvent) => void;
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

  useEffect(() => {
    if (eventId === '' || organisationId == null || !asks) return;
    let live = true;

    api.event(eventId).then(
      (event) => live && setHeld({ for: key, opened: openedOf({ event }, organisationId) }),
      (error: unknown) =>
        live &&
        setHeld((before) =>
          before.for === key && before.opened.kind === 'loaded'
            ? before
            : { for: key, opened: openedOf({ error }, organisationId) },
        ),
    );

    return () => {
      live = false;
    };
  }, [eventId, organisationId, asks, key, attempt]);

  if (settled != null) return { ...settled, retry, reload, change };

  return { ...(held.for === key ? held.opened : { kind: 'loading' }), retry, reload, change };
}

const styles = StyleSheet.create({
  stack: { gap: tokens.spaceMd },
  phone: {
    gap: tokens.spaceLg,
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.spaceXl,
    paddingBottom: tokens.space3xl,
  },
  tablet: {
    gap: tokens.spaceLg,
    paddingTop: tokens.space3xl,
    paddingHorizontal: tokens.space4xl,
    paddingBottom: tokens.space6xl,
  },
});
