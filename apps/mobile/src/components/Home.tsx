import { type Membership, primaryEmailAddress } from '@soirely/api-client';
import { roleName } from '@soirely/domain';
import { router } from 'expo-router';
import { type Ref, type RefObject, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { DESTINATION_HREF } from '../kit/appNav.ts';
import { stepOpeners } from '../kit/stepOpeners.ts';
import { type LayoutKind, useLayout } from '../layout/useLayout.ts';
import { useSignedIn } from '../signedIn.ts';
import { useTappedSwitch } from '../tappedSwitch.ts';
import { tokens } from '../theme/tokens.ts';
import { AnswerHeading } from './AnswerHeading.tsx';
import { AppFrame, useOpenSwitcher } from './AppFrame.tsx';
import { bodyEdges } from './bodyEdges.ts';
import { PrimaryButton, SecondaryButton } from './Buttons.tsx';
import { LinkedNotice } from './LinkedNotice.tsx';
import { NoOrganisation } from './NoOrganisation.tsx';
import { Screen, useFocusOnAnswer } from './Screen.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import { NOTICE_PLACES, type NoticePlace, SignInRulesNotices } from './SignInRulesNotices.tsx';
import { cardFrame } from './cardFrame.ts';
import { Text, type TextHandle } from './Text.tsx';

/** The signed-in home, `AppSettings-*` state `home`: where the app opens once somebody is in. */
export function Home() {
  const { t } = useTranslation();

  return (
    <AppFrame current="home" title={t('frame.home')} bodyTakesSwitch>
      <HomeBody />
    </AppFrame>
  );
}

function HomeBody() {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { account, organisation } = useSignedIn();
  const openSwitcher = useOpenSwitcher();
  const switchButton = useRef<ViewInstance>(null);
  const { place, heading, onClosed } = useNextAfterClosed();

  return (
    <Screen edges={bodyEdges(kind)} contentStyle={CONTENT[kind]}>
      <LinkedNotice wordsRef={place('linked')} onDismissed={() => onClosed('linked')} />
      {organisation != null && (
        <SignInRulesNotices
          key={organisation.id}
          organisation={organisation}
          place={place}
          onClosed={onClosed}
        />
      )}
      {account != null && organisation == null && <NoOrganisation titleRef={heading} />}
      {account != null && organisation != null && (
        <View style={[cardFrame(kind), styles.card]}>
          <SignedInHeading organisation={organisation} headingRef={heading} />
          <View style={styles.lines}>
            <Text size={tokens.typeBodyPhone.size}>
              {t('switcher.yourRole', { role: roleName(t, organisation.role) })}
            </Text>
            <Text size={tokens.typeBodyPhone.size} muted>
              {t('settings.signedInAs', { email: primaryEmailAddress(account) ?? '' })}
            </Text>
          </View>
          <View style={styles.actions}>
            <PrimaryButton
              label={t('home.openSettings')}
              onPress={() => router.navigate(DESTINATION_HREF.settings)}
              testID="home.openSettings"
            />
            {openSwitcher != null && (
              <SecondaryButton
                label={t('home.switchOrganisation')}
                onPress={() => openSwitcher(switchButton)}
                ref={switchButton}
                testID="home.switchOrganisation"
              />
            )}
          </View>
        </View>
      )}
    </Screen>
  );
}

/** A notice closed with its own button hands focus to the next notice under it, or to the heading when none is left (sc-11173). */
function useNextAfterClosed() {
  const [places] = useState(() => stepOpeners<ViewInstance>());
  const heading = useRef<TextHandle>(null);
  const [last, setLast] = useState<{ at: NoticePlace } | null>(null);
  const next = useMemo<RefObject<ScreenReaderTarget | null>>(
    () => ({
      get current() {
        const after = last == null ? [] : NOTICE_PLACES.slice(NOTICE_PLACES.indexOf(last.at) + 1);
        const notice = after.map((at) => places.target(at, null)).find((view) => view != null);

        return notice ?? heading.current;
      },
    }),
    [last, places],
  );
  useFocusOnAnswer(last ?? undefined, next);

  return {
    heading,
    place: (at: NoticePlace): Ref<ViewInstance> => places.ref(at),
    onClosed: (at: NoticePlace) => setLast({ at }),
  };
}

function SignedInHeading({
  organisation,
  headingRef,
}: {
  organisation: Membership;
  headingRef: RefObject<TextHandle | null>;
}) {
  const { t } = useTranslation();

  return (
    <AnswerHeading
      ref={headingRef}
      size={tokens.typeTitleDialog.size}
      weight="bold"
      answer={useTappedSwitch()}
    >
      {t('home.signedInTo', { name: organisation.name })}
    </AnswerHeading>
  );
}

const styles = StyleSheet.create({
  phone: {
    gap: tokens.spaceLg,
    paddingTop: tokens.spaceXxl,
    paddingHorizontal: tokens.spaceXl,
    paddingBottom: tokens.space3xl,
  },
  portrait: {
    gap: tokens.spaceXl,
    paddingTop: tokens.space3xl,
    paddingHorizontal: tokens.space4xl,
    paddingBottom: tokens.space6xl,
  },
  landscape: {
    gap: tokens.spaceXxl,
    paddingTop: tokens.space4xl,
    paddingHorizontal: tokens.space5xl,
    paddingBottom: tokens.space6xl,
  },
  card: { gap: 14 },
  lines: { gap: tokens.spaceXxs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
});

const CONTENT: Record<LayoutKind, object> = {
  phone: styles.phone,
  tabletPortrait: styles.portrait,
  tabletLandscape: styles.landscape,
};
