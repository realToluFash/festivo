import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { MeasuredWords } from '../../components/Title.tsx';
import { useShellLayout } from '../../components/settingsShell.ts';
import { wordsIn } from '../../layout/textSize.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { LegalLinks } from '../LegalLinks.tsx';
import { Choices } from '../focusedHeader/FocusedHeaderScreen.tsx';
import {
  HEADER_LANGUAGES,
  HEADER_SIZES,
  scaleFor,
  type HeaderLanguage,
  type HeaderSize,
} from '../focusedHeader/focusedHeaderRules.ts';
import {
  SIGN_OUT_GAP,
  SIGN_OUT_GLYPH,
  SIGN_OUT_RING,
  SIGN_OUT_SIDE,
  SIGN_OUT_TEXT,
  signOutTextSize,
} from './signOutSizeRules.ts';

export interface SignOutSizeStart {
  size: HeaderSize;
  language: HeaderLanguage;
}

const PAGE_SIDE = tokens.spaceXxl;
const TABLET_COLUMN = 540;

/** Settings' foot at a text size and language the board chooses: Sign out grows to hold its words, each word whole. */
export function SignOutSizeScreen({ start }: { start: SignOutSizeStart }) {
  const { i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const tablet = useShellLayout() !== 'phone';
  const [size, setSize] = useState(start.size);
  const [language, setLanguage] = useState(start.language);
  const words = useMemo(
    () => i18n.cloneInstance({ lng: language, initAsync: false }),
    [i18n, language],
  );
  const t = words.t.bind(words);
  const room = Math.min(windowWidth - 2 * PAGE_SIDE, tablet ? TABLET_COLUMN : Infinity);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[
        styles.body,
        {
          paddingTop: insets.top + tokens.space3xl,
          paddingBottom: insets.bottom + tokens.space5xl,
        },
      ]}
    >
      <View style={{ width: room }}>
        <DemoSignOut
          scale={scaleFor(size, fontScale)}
          label={t('settings.signOut')}
          room={room}
          onPress={() => router.replace('/demo/welcome')}
        />
        <LegalLinks style={styles.legal} />
      </View>
      <View style={{ width: room }}>
        <DemoOnly title="Stand-ins for the phone’s own text size and language. Sign out is drawn at the size chosen; Terms and Privacy under it at this phone’s size. One tap on Sign out signs out, to Welcome. No string is added.">
          <Choices
            heading="Text size"
            options={HEADER_SIZES}
            chosen={size}
            onChoose={setSize}
            id="size"
            prefix="demo.signOut"
          />
          <Choices
            heading="Language"
            options={HEADER_LANGUAGES}
            chosen={language}
            onChoose={setLanguage}
            id="language"
            prefix="demo.signOut"
          />
        </DemoOnly>
      </View>
    </ScrollView>
  );
}

/** Sign out as proposed: at least 52, a capsule as tall as its words, the glyph growing with them, a second line before a smaller label. */
function DemoSignOut({
  scale,
  label,
  room,
  onPress,
}: {
  scale: number;
  label: string;
  room: number;
  onPress: () => void;
}) {
  const full = SIGN_OUT_TEXT * scale;
  const [measured, setMeasured] = useState<{ key: string; widths: Record<string, number> }>({
    key: '',
    widths: {},
  });
  const key = `${full}|${label}`;
  const labelWords = wordsIn([label]);
  const widths = measured.key === key ? measured.widths : {};
  const widest = labelWords.every((word) => widths[word] != null)
    ? Math.max(...labelWords.map((word) => widths[word] ?? 0))
    : null;
  const size = widest == null ? full : signOutTextSize(scale, widest, room);

  return (
    <>
      <MeasuredWords
        words={labelWords}
        size={full}
        weight="semibold"
        allowFontScaling={false}
        onWidth={(word, width) =>
          setMeasured((now) => {
            const kept = now.key === key ? now.widths : {};

            return kept[word] === width ? now : { key, widths: { ...kept, [word]: width } };
          })
        }
      />
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={label}
        testID="settings.signOut"
      >
        <Glyph
          name="signOut"
          size={(SIGN_OUT_GLYPH / SIGN_OUT_TEXT) * size}
          ink={tokens.colorInk}
          weight={2.1}
        />
        <Text
          size={size}
          weight="semibold"
          allowFontScaling={false}
          accessible={false}
          style={styles.label}
        >
          {label}
        </Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorCard },
  body: { alignItems: 'center', gap: tokens.space3xl },
  legal: { marginTop: tokens.spaceXs },
  pill: {
    minHeight: tokens.sizeHitPhoneHero,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SIGN_OUT_GAP,
    paddingHorizontal: SIGN_OUT_SIDE,
    paddingVertical: tokens.spaceLg,
    borderWidth: SIGN_OUT_RING,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorCard,
  },
  label: { flexShrink: 1, textAlign: 'center', color: tokens.colorInk },
  pressed: { opacity: tokens.opacityPressed },
});
