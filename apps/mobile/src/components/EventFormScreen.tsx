import { type TaggedEvent } from '@soirely/api-client';
import { roleHolds } from '@soirely/domain';
import { Redirect, router, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DESTINATION_HREF } from '../kit/appNav.ts';
import { formTitles } from '../kit/formTitles.ts';
import { goUpToEvent } from '../kit/upToEvent.ts';
import { markSaved } from '../kit/eventSaved.ts';
import { type LayoutKind, useLayout } from '../layout/useLayout.ts';
import { useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { AppFrame } from './AppFrame.tsx';
import { bodyEdges } from './bodyEdges.ts';
import { QuietButton, SecondaryButton } from './Buttons.tsx';
import { EventForm, readTagged } from './EventForm.tsx';
import { Notice } from './Notice.tsx';
import { readOut } from './ReadOut.tsx';
import { Screen } from './Screen.tsx';
import { Text } from './Text.tsx';
import { Arrived, Skeleton } from './Skeleton.tsx';
import type { EditAt } from '../kit/eventNav.ts';

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'notFound' } | TaggedEvent;

function eventHref(eventId: string): `/events/${string}` {
  return `/events/${encodeURIComponent(eventId)}`;
}

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

/** An event's page > Edit details, `App event form` state Edit details (sc-3595). */
export function EditEventScreen({ eventId, at }: { eventId: string; at: EditAt | undefined }) {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { organisation } = useSignedIn();
  const organisationId = organisation?.id;
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [reads, setReads] = useState(0);
  const manages = organisation != null && roleHolds(organisation, 'events.manage');
  const navigation = useNavigation();

  useEffect(() => {
    if (organisationId == null || !manages) return;
    let live = true;

    void readTagged(eventId, organisationId).then((read) => {
      if (!live) return;
      setLoad(typeof read === 'string' ? { kind: read } : read);
    });

    return () => {
      live = false;
    };
  }, [eventId, organisationId, manages, attempt]);

  if (organisation != null && !manages) return <Redirect href={eventHref(eventId)} />;

  return (
    <FormFrame kind={kind} title={t('eventEdit.title')} onCancel={() => leave(eventHref(eventId))}>
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
          <SecondaryButton
            label={t('eventsScreen.retry')}
            onPress={() => {
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
      {'event' in load && organisation != null && (
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
              setReads((n) => n + 1);
            }}
          />
        </Arrived>
      )}
    </FormFrame>
  );
}

/** Cancel sits top left: the phone's header back row, a tablet's first control. */
export function FormFrame({
  kind,
  title,
  shortTitle,
  onCancel,
  cancelOff = false,
  children,
}: {
  kind: LayoutKind;
  title: string;
  shortTitle?: string;
  onCancel: () => void;
  cancelOff?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const phone = kind === 'phone';
  const { bar, heading } = formTitles(kind, title, shortTitle, t('eventsScreen.title'));

  return (
    <AppFrame
      current="events"
      title={bar}
      back={
        phone
          ? { label: t('eventEdit.cancel'), onPress: () => cancelOff || onCancel(), off: cancelOff }
          : undefined
      }
      backInBody={!cancelOff}
    >
      <Screen edges={bodyEdges(kind)} contentStyle={CONTENT[kind]}>
        {heading != null && (
          <View style={styles.head}>
            {!phone && (
              <QuietButton
                label={t('eventEdit.cancel')}
                onPress={onCancel}
                off={cancelOff}
                testID="eventForm.cancel"
              />
            )}
            {heading != null && (
              <Text size={tokens.typeTitlePhone.size} weight="bold" accessibilityRole="header">
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
