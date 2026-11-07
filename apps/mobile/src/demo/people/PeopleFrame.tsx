import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReadOut } from '../../components/ReadOut.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Bell, PortraitTop } from '../settings/Frame.tsx';
import { PageToast, type PageToastProps } from '../settings/Summary.tsx';
import { EVENT, LOADING_WORDS } from './PeopleSample.ts';
import { useShell } from '../../components/settingsShell.ts';
import { Back } from '../../components/SettingsParts.tsx';

/** A page inside an event, drawn with no event around it in the demo: back, the title over the event's name, then the blocks 18 apart. */
export function PeoplePage({
  back,
  toast,
  children,
}: {
  back: { label: string; onPress: () => void };
  toast?: PageToastProps | null | undefined;
  children: ReactNode;
}) {
  const { layout, tell } = useShell();
  const insets = useSafeAreaInsets();
  const phone = layout === 'phone';
  const page = (
    <>
      <View style={styles.top}>
        <Back label={back.label} onPress={back.onPress} />
        <View style={styles.grow} />
        {phone && <Bell tell={tell} />}
      </View>
      <View style={styles.title}>
        <Text size={30} weight="bold" accessibilityRole="header" style={styles.titleText}>
          People
        </Text>
        <Text size={15} weight="medium" style={styles.secondary}>
          {EVENT}
        </Text>
      </View>
      <View style={styles.blocks}>{children}</View>
    </>
  );
  const told = toast != null && (
    <PageToast {...toast} bottom={Math.max(insets.bottom, tokens.spaceLg)} />
  );

  if (layout === 'landscape')
    return (
      <View style={[styles.chrome, { paddingTop: insets.top }]}>
        <View style={[styles.pane, { marginBottom: Math.max(insets.bottom, tokens.spaceMd) }]}>
          <ScrollView
            contentContainerStyle={styles.paneBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {page}
          </ScrollView>
        </View>
        {told}
      </View>
    );

  return (
    <View style={styles.page}>
      {!phone && <PortraitTop at="Events" />}
      <ScrollView
        style={styles.grow}
        contentContainerStyle={
          phone
            ? {
                paddingTop: insets.top + tokens.spaceXxs,
                paddingHorizontal: tokens.spaceXxl,
                paddingBottom: insets.bottom + tokens.space6xl,
              }
            : {
                paddingTop: 26,
                paddingHorizontal: tokens.space5xl,
                paddingBottom: insets.bottom + tokens.space6xl,
              }
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {page}
      </ScrollView>
      {phone && <View style={[styles.statusStrip, { height: insets.top }]} pointerEvents="none" />}
      {told}
    </View>
  );
}

/** Two Sunk groups where the list goes, a head, a line and rows, heard as the words alone. */
export function PeopleLoading() {
  useReadOut(LOADING_WORDS);

  return (
    <View
      style={styles.loading}
      accessible
      accessibilityLabel={LOADING_WORDS}
      accessibilityState={{ busy: true }}
    >
      {[1, 2].map((rows) => (
        <View key={rows} style={styles.sunkGroup}>
          <View style={styles.sunkHead} />
          <View style={styles.sunkLine} />
          <View>
            {Array.from({ length: rows }, (_, index) => (
              <View key={index}>
                {index > 0 && <View style={styles.sunkRule} />}
                <View style={styles.sunkRow}>
                  <View style={styles.sunkFace} />
                  <View style={[styles.sunkBar, { width: `${46 + 12 * index}%` }]} />
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  page: { flex: 1, backgroundColor: tokens.colorCard },
  secondary: { color: tokens.colorInkSecondary },
  top: { flexDirection: 'row', alignItems: 'center' },
  title: { gap: tokens.spaceXxs, paddingTop: 14, paddingBottom: tokens.spaceXl },
  titleText: { letterSpacing: 30 * -0.02 },
  blocks: { gap: 18 },
  statusStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: tokens.colorCard,
  },
  chrome: { flex: 1, backgroundColor: tokens.colorNeutralFill },
  pane: {
    flex: 1,
    marginHorizontal: tokens.spaceMd,
    borderRadius: tokens.space3xl,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
    overflow: 'hidden',
  },
  paneBody: { paddingTop: 26, paddingHorizontal: 26, paddingBottom: tokens.space6xl },
  loading: { gap: 26 },
  sunkGroup: { gap: tokens.spaceMd },
  sunkHead: {
    width: 96,
    height: 18,
    borderRadius: 9,
    backgroundColor: tokens.colorNeutralFill,
  },
  sunkLine: {
    width: '78%',
    height: 12,
    borderRadius: 6,
    backgroundColor: tokens.colorNeutralFill,
  },
  sunkRule: { height: 1, marginLeft: 52, backgroundColor: tokens.colorBorder },
  sunkRow: { height: 52, flexDirection: 'row', alignItems: 'center', gap: tokens.spaceLg },
  sunkFace: { width: 40, height: 40, borderRadius: 20, backgroundColor: tokens.colorNeutralFill },
  sunkBar: { height: 14, borderRadius: 7, backgroundColor: tokens.colorNeutralFill },
});
