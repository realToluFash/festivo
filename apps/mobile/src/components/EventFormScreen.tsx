import { ApiError, type OrganisationEvent, type TaggedEvent } from '@soirely/api-client';
import { roleHolds } from '@soirely/domain';
import { Redirect, router, useNavigation } from 'expo-router';
import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DESTINATION_HREF } from '../kit/appNav.ts';
import { offersEdit } from '../kit/eventEdit.ts';
import { eventHref } from '../kit/eventNav.ts';
import { formTitles } from '../kit/formTitles.ts';
import { goToArea, goUpToEvent } from '../kit/upToEvent.ts';
import { markSaved } from '../kit/eventSaved.ts';
import { type LayoutKind, useLayout } from '../layout/useLayout.ts';
import {
  NOT_OFFLINE,
  type ScreenOffline,
  type Stale,
  useHandOffline,
  useOffline,
} from '../offline.ts';
import { formAfterLoad, formShownAt } from '../offlineLoad.ts';
import { rereadOrganisations, useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { api } from '../api.ts';
import { AppFrame, type InsideEvent, besideRow } from './AppFrame.tsx';
import { bodyEdges } from './bodyEdges.ts';
import { PrimaryButton, QuietButton } from './Buttons.tsx';
import { EventForm } from './EventForm.tsx';
import { Notice } from './Notice.tsx';
import { readOut } from './ReadOut.tsx';
import { Refreshing } from './Refreshing.tsx';
import { moveScreenReaderFocus } from './screenReaderFocus.ts';
import { Screen } from './Screen.tsx';
import { Text, type TextHandle } from './Text.tsx';
import { Arrived, Skeleton } from './Skeleton.tsx';
import { useSidebarCard } from './sidebarCard.ts';
import type { EditAt } from '../kit/eventNav.ts';

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'notFound' } | TaggedEvent;

/** Cancel asks first while anything is typed; a form opened by a link has nothing behind it to go back to. */
function leave(to: '/events' | `/events/${string}`): void {
  if (router.canGoBack()) router.back();
  else router.replace(to);
}

/** Events > New event, `App event form` state New event (sc-3595). */
export function NewEventScreen() {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { organisation } = useSignedIn();

  if (organisation != null && !roleHolds(organisation, 'events.create'))
    return <Redirect href={DESTINATION_HREF.events} />;

  return (
    <FormFrame kind={kind} title={t('eventForm.title')} onCancel={() => leave('/events')}>
      {organisation != null && (
        <EventForm
          key={organisation.id}
          kind={kind}
          organisation={organisation}
          onCreated={(eventId) => {
            readOut(t('eventForm.created'), { interrupts: true });
            router.replace(eventHref(eventId));
          }}
          onSaved={() => {}}
          onLatest={() => {}}
        />
      )}
    </FormFrame>
  );
}

/** An event's page > Edit details, `App event form` state Edit details (sc-3595), with its band and Refreshing… (sc-27086). */
export function EditEventScreen({ eventId, at }: { eventId: string; at: EditAt | undefined }) {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { organisation } = useSignedIn();
  const navigation = useNavigation();
  const title = useRef<TextHandle>(null);
  const [offline, setOffline] = useState<ScreenOffline>(NOT_OFFLINE);
  const [event, setEvent] = useState<OrganisationEvent | null>(null);
  const card = useSidebarCard(event);

  return (
    <FormFrame
      kind={kind}
      title={t('eventEdit.title')}
      titleRef={title}
      offline={offline.stale}
      refreshing={offline.refreshing ? <Refreshing testID="eventForm.refreshing" /> : null}
      onCancel={() => leave(eventHref(eventId))}
      inEvent={{
        area: 'overview',
        onArea: (area) =>
          area === 'overview'
            ? goUpToEvent(navigation, router, eventId)
            : goToArea(navigation, router, eventId, area),
        card,
      }}
    >
      <EditEventLoad
        key={`${organisation?.id ?? ''}:${eventId}`}
        eventId={eventId}
        at={at}
        kind={kind}
        heading={title}
        onOffline={setOffline}
        onEvent={setEvent}
      />
    </FormFrame>
  );
}

function EditEventLoad({
  eventId,
  at,
  kind,
  heading,
  onOffline,
  onEvent,
}: {
  eventId: string;
  at: EditAt | undefined;
  kind: LayoutKind;
  heading: RefObject<TextHandle | null>;
  onOffline: (offline: ScreenOffline) => void;
  /** The event as read, for the iPad sidebar's card (sc-30413). */
  onEvent: (event: OrganisationEvent | null) => void;
}) {
  const { t } = useTranslation();
  const { organisation } = useSignedIn();
  const organisationId = organisation?.id;
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [reads, setReads] = useState(0);
  const [shownAt, setShownAt] = useState<Date | null>(null);
  const navigation = useNavigation();
  const { watch, stale, refreshing } = useOffline({
    loaded: 'event' in load,
    reload: () => setRefresh((n) => n + 1),
    focusTitle: () => moveScreenReaderFocus(heading.current),
    since: shownAt,
  });

  useHandOffline(onOffline, { stale, refreshing });

  const read = 'event' in load ? load.event : null;
  useEffect(() => onEvent(read), [read, onEvent]);

  // Once the form shows, a load only asks whether Soirely answers: the form and the tag it saves against stay as opened (Decided, 2 Nov).
  useEffect(() => {
    if (organisationId == null) return;
    let live = true;
    const settle = (read: Load) => live && setLoad((was) => formAfterLoad(was, read));

    watch(api.taggedEvent(eventId)).then(
      (tagged) => {
        const ours = tagged.event.organisationId === organisationId;
        if (ours && live) setShownAt((was) => formShownAt(was, 'loaded', new Date()));
        settle(ours ? tagged : { kind: 'notFound' });
      },
      (error: unknown) =>
        settle(
          error instanceof ApiError && (error.status === 404 || error.status === 403)
            ? { kind: 'notFound' }
            : { kind: 'failed' },
        ),
    );

    return () => {
      live = false;
    };
  }, [eventId, organisationId, attempt, refresh, watch]);

  return (
    <>
      {'kind' in load && load.kind === 'loading' && (
        <Skeleton
          words={t('eventsScreen.loadingEvent')}
          shape="cards"
          cards={[
            { lines: 0, fields: 3 },
            { lines: 0, fields: 2 },
          ]}
        />
      )}
      {'kind' in load && load.kind === 'failed' && (
        <View style={styles.stack} accessibilityRole="alert">
          <Notice
            tone="broken"
            mark={tokens.marks.broken.glyph}
            body={t('eventsScreen.failedLoad')}
            announce
          />
          <PrimaryButton
            label={t('eventsScreen.retry')}
            onPress={() => {
              void rereadOrganisations();
              setLoad({ kind: 'loading' });
              setAttempt((n) => n + 1);
            }}
            testID="eventForm.retry"
          />
        </View>
      )}
      {'kind' in load && load.kind === 'notFound' && (
        <Notice
          tone="quiet"
          mark={tokens.marks.info.glyph}
          title={t('eventsScreen.notFound')}
          heading
        />
      )}
      {'event' in load && !offersEdit(load.event) && <Redirect href={eventHref(eventId)} />}
      {'event' in load && organisation != null && offersEdit(load.event) && (
        <Arrived style={formGap(kind)}>
          <EventForm
            key={reads}
            kind={kind}
            organisation={organisation}
            opened={load}
            arriveAt={reads === 0 ? at : undefined}
            onCreated={() => {}}
            onSaved={(outcome) => {
              if (outcome === 'saved') markSaved(eventId);
              goUpToEvent(navigation, router, eventId);
            }}
            onLatest={(latest) => {
              setLoad(latest);
              setShownAt((was) => formShownAt(was, 'latest', new Date()));
              setReads((n) => n + 1);
            }}
          />
        </Arrived>
      )}
    </>
  );
}

/** Cancel sits top left: the phone's header back row, a tablet's first control. */
export function FormFrame({
  kind,
  title,
  shortTitle,
  onCancel,
  cancelOff = false,
  inEvent,
  titleRef,
  offline = null,
  refreshing,
  children,
}: {
  kind: LayoutKind;
  title: string;
  shortTitle?: string;
  onCancel: () => void;
  cancelOff?: boolean;
  inEvent?: InsideEvent;
  /** The form's own title, wherever the layout draws it: it takes focus once Try again answers. */
  titleRef?: RefObject<TextHandle | null>;
  offline?: Stale | null;
  /** Beside Cancel, the form's Back (sc-27086). */
  refreshing?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const phone = kind === 'phone';
  const { bar, heading } = formTitles(kind, title, shortTitle, t('eventsScreen.title'));

  return (
    <AppFrame
      current="events"
      title={bar}
      titleRef={heading == null ? titleRef : undefined}
      offline={offline}
      besideBack={phone ? refreshing : undefined}
      back={
        phone
          ? { label: t('eventEdit.cancel'), onPress: () => cancelOff || onCancel(), off: cancelOff }
          : undefined
      }
      backInBody={!cancelOff}
      inEvent={inEvent}
    >
      <Screen edges={bodyEdges(kind)} contentStyle={CONTENT[kind]}>
        {heading != null && (
          <View style={styles.head}>
            {/* Cancel stays put as Refreshing… comes and goes, so TalkBack keeps its place there. */}
            {!phone && (
              <View style={[besideRow.row, styles.across]}>
                <QuietButton
                  label={t('eventEdit.cancel')}
                  onPress={onCancel}
                  off={cancelOff}
                  testID="eventForm.cancel"
                />
                {refreshing}
              </View>
            )}
            {heading != null && (
              <Text
                size={tokens.typeTitlePhone.size}
                weight="bold"
                accessibilityRole="header"
                ref={titleRef}
              >
                {heading}
              </Text>
            )}
          </View>
        )}
        {children}
      </Screen>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  stack: { gap: tokens.spaceMd },
  head: { gap: tokens.spaceSm, alignItems: 'flex-start' },
  across: { alignSelf: 'stretch' },
  phone: {
    gap: tokens.spaceLg,
    paddingTop: tokens.spaceXl,
    paddingHorizontal: tokens.spaceXl,
    paddingBottom: tokens.space3xl,
  },
  portrait: { gap: tokens.spaceXl, padding: tokens.space3xl, paddingBottom: tokens.space6xl },
  landscape: {
    gap: tokens.spaceXxl,
    paddingTop: tokens.space4xl,
    paddingHorizontal: tokens.space5xl,
    paddingBottom: tokens.space6xl,
    maxWidth: 760,
  },
});

/** A form's sections keep the frame's spacing while they fade in under one wrapper. */
export function formGap(kind: LayoutKind) {
  return {
    gap: {
      phone: tokens.spaceLg,
      tabletPortrait: tokens.spaceXl,
      tabletLandscape: tokens.spaceXxl,
    }[kind],
  };
}

const CONTENT: Record<LayoutKind, object> = {
  phone: styles.phone,
  tabletPortrait: styles.portrait,
  tabletLandscape: styles.landscape,
};
