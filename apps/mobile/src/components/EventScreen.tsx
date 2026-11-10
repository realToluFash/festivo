import type { Membership, OrganisationEvent } from '@soirely/api-client';
import { type EventArea, rememberTabHolding, roleHolds, takesCardStep } from '@soirely/domain';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { type Stale, keepsWhatLoaded, useOffline } from '../offline.ts';
import { DESTINATION_HREF } from '../kit/appNav.ts';
import { offersDelete } from '../kit/eventDelete.ts';
import { backToOriginal } from '../kit/eventDuplicate.ts';
import { type EditAt, EVENT_AREA, type EventPlace, areaBack } from '../kit/eventNav.ts';
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
import { EventPage } from './EventPage.tsx';
import { EventPeople } from './EventPeople.tsx';
import { EventNotFound, EventTop, EventsFailed, usePhaseOf } from './Events.tsx';
import { Notice } from './Notice.tsx';
import { ReadOut } from './ReadOut.tsx';
import { Refreshing } from './Refreshing.tsx';
import { Screen, useScrolledToTop } from './Screen.tsx';
import { PageToast } from './Summary.tsx';
import { Arrived, Skeleton } from './Skeleton.tsx';
import { moveScreenReaderFocus } from './screenReaderFocus.ts';
import { Text, type TextHandle } from './Text.tsx';
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
  area: EventPlace;
  /** The event this one was duplicated from, when Duplicate opened it (sc-22145). */
  copiedFrom?: string | undefined;
  /** Opened from Happening now, so Back returns to the tab that was showing. */
  keepsTab: boolean;
}) {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { account, organisation } = useSignedIn();
  const organisationId = organisation?.id;
  const phone = kind === 'phone';
  const navigation = useNavigation<{
    setParams(params: { [SHOWN_EVENT]?: string; [EVENT_AREA]?: EventPlace }): void;
    getState(): { routes: readonly { params?: unknown }[]; index: number } | undefined;
  }>();
  const [savedEvent, setSavedEvent] = useState<string | null>(null);
  const [toast, setToast] = useState<{ eventId: string; words: string } | null>(null);
  const insets = useSafeAreaInsets();
  const [coverRefused, setCoverRefused] = useState<{ eventId: string; reason: string } | null>(
    null,
  );
  const title = useRef<TextHandle>(null);
  const opened = useOpened(eventId, account != null, organisation, () =>
    moveScreenReaderFocus(title.current),
  );
  const { reload, freshen, change } = opened;
  const event = opened.kind === 'loaded' ? opened.event : null;
  const creates = event != null && roleHolds(event, 'events.create');
  const manages = event != null && roleHolds(event, 'events.manage');
  const deletes = offersDelete(event);
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
      const saved = takeSaved();
      setSavedEvent(saved);
      setCoverRefused(takeCoverRefused());
      // A load already out may have left before the save, so it cannot be joined.
      if (saved != null) reload();
      else freshen();

      // Gone while the page is covered, so the next save mounts Saved afresh and scrolls up to it.
      return () => setSavedEvent(null);
    }, [reload, freshen]),
  );

  const chooseArea = (next: EventPlace) => navigation.setParams({ [EVENT_AREA]: next });
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
    event != null ? (
      area === 'overview' ? (
        <Arrived style={styles.stack}>
          {savedEvent === eventId && <Saved />}
          <EventPage
            kind={kind}
            event={event}
            manages={manages}
            takes={(action) => takesCardStep(event, action)}
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
      ) : area === 'people' ? (
        <EventPeople
          key={event.id}
          event={event}
          tell={(words) => setToast(words == null ? null : { eventId, words })}
        />
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

  const refreshing = opened.refreshing ? <Refreshing testID="events.page.refreshing" /> : null;

  return (
    <AppFrame
      current="events"
      title={t(`eventNav.${area}`)}
      titleRef={title}
      offline={opened.stale}
      besideBack={phone ? refreshing : undefined}
      besideTitle={phone ? undefined : refreshing}
      back={phone ? { label: backLabel, onPress: back } : undefined}
      backInBody
      inEvent={event == null ? undefined : { area, onArea: chooseArea }}
      underTitle={
        area === 'people' && event != null ? (
          <Text size={15} weight="medium" style={styles.secondary}>
            {event.name}
          </Text>
        ) : undefined
      }
    >
      <Screen edges={bodyEdges(kind)} contentStyle={phone ? styles.phone : styles.tablet}>
        {!phone && <BackButton label={backLabel} onPress={back} testID="events.back" />}
        {body}
      </Screen>
      {toast?.eventId === eventId && area === 'people' && (
        <PageToast
          words={toast.words}
          onClose={() => setToast(null)}
          bottom={insets.bottom + tokens.spaceLg}
        />
      )}
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
  secondary: { color: tokens.colorInkSecondary },
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
