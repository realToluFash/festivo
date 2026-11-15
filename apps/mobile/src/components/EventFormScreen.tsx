import { roleHolds } from '@soirely/domain';
import { Redirect, router } from 'expo-router';
import { type ReactNode, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DESTINATION_HREF } from '../kit/appNav.ts';
import { eventHref } from '../kit/eventNav.ts';
import { formTitles } from '../kit/formTitles.ts';
import { type LayoutKind, useLayout } from '../layout/useLayout.ts';
import { type Stale } from '../offline.ts';
import { useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { AppFrame, type InsideEvent, besideRow } from './AppFrame.tsx';
import { bodyEdges } from './bodyEdges.ts';
import { QuietButton } from './Buttons.tsx';
import { EventForm } from './EventForm.tsx';
import { readOut } from './ReadOut.tsx';
import { Screen } from './Screen.tsx';
import { Text, type TextHandle } from './Text.tsx';

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
        />
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

const CONTENT: Record<LayoutKind, object> = {
  phone: styles.phone,
  tabletPortrait: styles.portrait,
  tabletLandscape: styles.landscape,
};
