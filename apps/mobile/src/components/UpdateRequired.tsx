import Constants from 'expo-constants';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  BackHandler,
  Easing,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { config } from '../config.ts';
import { useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { createUpdateGate, isBelow, storeUrl } from '../updateRequired.ts';
import { PrimaryButton } from './Buttons.tsx';
import { moveScreenReaderFocus } from './screenReaderFocus.ts';
import { Text, type TextHandle } from './Text.tsx';

/** Checks on opening and on each return to the foreground, and puts `UpdateRequired-*` in place of the app for a build below its platform's minimum (sc-22620). */
export function UpdateGate({ children }: { children: ReactNode }) {
  const [showing, setShowing] = useState(false);
  // Stays mounted after `showing` ends, until the fade out has run.
  const [shown, setShown] = useState(false);
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const platform = storePlatform();
    if (platform == null) return;

    const build = Constants.expoConfig?.version;
    const gate = createUpdateGate((next) => {
      if (next) setShown(true);
      setShowing(next);
    });

    const open = (): void => {
      gate.opened(Date.now());
      const check = gate.check;

      api.minimumAppVersions().then(
        (minimums) => gate.answered(isBelow(build, minimums[platform]), check, Date.now()),
        () => gate.answered(null, check, Date.now()),
      );
    };

    open();

    let last = AppState.currentState;
    const listener = AppState.addEventListener('change', (next) => {
      if (last === 'background' && next === 'active') open();
      last = next;
    });

    return () => listener.remove();
  }, []);

  useEffect(() => {
    let live = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!live) return;

      const to = showing ? 1 : 0;
      if (reduced) {
        opacity.setValue(to);
        if (!showing) setShown(false);
        return;
      }

      Animated.timing(opacity, {
        toValue: to,
        duration: tokens.motionBase,
        easing: Easing.bezier(0.2, 0, 0, 1),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !showing) setShown(false);
      });
    });

    return () => {
      live = false;
    };
  }, [showing, opacity]);

  useEffect(() => {
    if (!showing) return;

    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      BackHandler.exitApp();
      return true;
    });

    return () => listener.remove();
  }, [showing]);

  return (
    <>
      <View
        style={styles.fill}
        importantForAccessibility={showing ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={showing}
        pointerEvents={showing ? 'none' : 'auto'}
      >
        {children}
      </View>
      {shown && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity }]} accessibilityViewIsModal>
          <UpdateRequired />
        </Animated.View>
      )}
    </>
  );
}

/** No shell: no header, tab bar, back or close, so nothing beneath can be reached from it. */
function UpdateRequired() {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const insets = useSafeAreaInsets();
  const heading = useRef<TextHandle>(null);
  const phone = kind === 'phone';

  useEffect(() => {
    moveScreenReaderFocus(heading.current);
  }, []);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + tokens.space3xl,
          paddingBottom: insets.bottom + tokens.space3xl,
          paddingLeft: insets.left + tokens.spaceXl,
          paddingRight: insets.right + tokens.spaceXl,
        },
      ]}
    >
      <View style={[styles.column, { maxWidth: phone ? 360 : 440 }]}>
        <View
          style={styles.mark}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <Text
            size={28}
            weight="bold"
            allowFontScaling={false}
            accessible={false}
            style={styles.markGlyph}
          >
            ↓
          </Text>
        </View>
        <Text
          ref={heading}
          size={22}
          weight="bold"
          accessibilityRole="header"
          style={styles.centred}
        >
          {t('updateRequired.title')}
        </Text>
        <Text size={tokens.typeBodyPhone.size} muted style={styles.centred}>
          {t('updateRequired.body')}
        </Text>
        <View style={styles.action}>
          <PrimaryButton
            label={t('updateRequired.update')}
            onPress={() =>
              void Linking.openURL(storeUrl(storePlatform() ?? 'android', config.appStoreId))
            }
            testID="updateRequired.update"
          />
        </View>
      </View>
    </ScrollView>
  );
}

function storePlatform(): 'ios' | 'android' | null {
  if (Platform.OS === 'ios' || Platform.OS === 'android') return Platform.OS;
  return null;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { flex: 1, backgroundColor: tokens.colorPage },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  column: { width: '100%', alignItems: 'center', gap: tokens.spaceLg },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorAccentTint,
    marginBottom: tokens.spaceXs,
  },
  markGlyph: { color: tokens.colorAccentText },
  centred: { textAlign: 'center' },
  action: { alignSelf: 'stretch', marginTop: tokens.spaceSm },
});
