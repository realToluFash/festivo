import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import type { OrganisationEvent } from '@soirely/api-client';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppFrame } from '../../../src/components/AppFrame.tsx';
import { CheckInView } from '../../../src/components/CheckInView.tsx';
import { Back } from '../../../src/components/SettingsParts.tsx';
import { useSidebarCard } from '../../../src/components/sidebarCard.ts';
import { Text, type TextHandle } from '../../../src/components/Text.tsx';
import { CHECK_IN_FROM } from '../../../src/kit/myNight.ts';
import { goToArea, goUpToEvent } from '../../../src/kit/upToEvent.ts';
import { useLayout } from '../../../src/layout/useLayout.ts';
import { tokens } from '../../../src/theme/tokens.ts';

/** /events/<id>/check-in (sc-1454): the door, opened from the event's Guests with Open check-in, or from Your night's Check-in (sc-28230), which it leads back to. On a phone it draws its own compact bar and no tab bar; upright, the way back beside the bell; on a tablet the title scrolls with the list, as the demo's `door` does. */
export default function EventCheckIn() {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const {
    id = '',
    focus,
    tap,
    [CHECK_IN_FROM]: from,
  } = useLocalSearchParams<{
    id?: string;
    focus?: string;
    tap?: string;
    [CHECK_IN_FROM]?: string;
  }>();
  const navigation = useNavigation();
  const phone = kind === 'phone';
  const landscape = kind === 'tabletLandscape';
  const fromNight = from === 'night';
  const back = () =>
    fromNight
      ? router.dismissTo({ pathname: '/events/[id]/my-night', params: { id } })
      : goToArea(navigation, router, id, 'guests');
  const backLabel = fromNight ? t('myNight.title') : t('checkIn.back');
  const title = useRef<TextHandle>(null);
  const [event, setEvent] = useState<OrganisationEvent | null>(null);
  const card = useSidebarCard(event?.id === id ? event : null);
  const insets = useSafeAreaInsets();

  return (
    <AppFrame
      current="events"
      title={t('checkIn.title')}
      titleRef={title}
      back={landscape ? undefined : { label: backLabel, onPress: back, pill: true }}
      backInBody={landscape}
      ownChrome={phone}
      untitled={!phone}
      inEvent={{
        area: 'guests',
        onArea: (area) =>
          area === 'overview'
            ? goUpToEvent(navigation, router, id)
            : goToArea(navigation, router, id, area),
        card,
      }}
    >
      <CheckInView
        eventId={id}
        kind={kind}
        nav={
          phone ? (
            <View style={[styles.navArea, { paddingTop: insets.top }]}>
              <View style={styles.nav}>
                <Back label={backLabel} onPress={back} testID="checkIn.back" />
                <View style={styles.navTitle} pointerEvents="none">
                  <Text
                    ref={title}
                    size={17}
                    weight="bold"
                    numberOfLines={1}
                    accessibilityRole="header"
                  >
                    {t('checkIn.title')}
                  </Text>
                </View>
              </View>
            </View>
          ) : null
        }
        top={
          phone ? null : (
            <Text
              ref={title}
              size={landscape ? 26 : 30}
              weight="bold"
              accessibilityRole="header"
              style={styles.title}
            >
              {t('checkIn.title')}
            </Text>
          )
        }
        onEvent={setEvent}
        onScan={() => router.push({ pathname: '/events/[id]/scan', params: { id } })}
        searchAsk={focus === 'search' ? (tap ?? '0') : null}
      />
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  nav: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spaceSm,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorBorder,
  },
  title: { letterSpacing: -0.6 },
  navArea: { backgroundColor: tokens.colorCard },
  navTitle: {
    position: 'absolute',
    left: 120,
    right: 120,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
