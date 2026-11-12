import type { ReactNode, Ref } from 'react';
import { ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Back } from '../../components/SettingsParts.tsx';
import { useShell } from '../../components/settingsShell.ts';
import { PageToast, type PageToastProps } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { PHONE_TAB_BAR, TabBarFade } from '../../components/TodayCover.tsx';
import { tokens } from '../../theme/tokens.ts';
import { PAGE_TITLE, PANE_TITLE, pageTitle, paneTitle } from '../../components/topTitle.ts';
import { Bell, Landscape, OrgPill, PortraitTop, SettingsTabBar } from './Frame.tsx';

/** A section page in B, summary first: back and the bell on top, the title, then the card and the lists. */
export function SummaryPage({
  title,
  back,
  column,
  scrollRef,
  toast,
  children,
}: {
  title?: string;
  back?: { label?: string; onPress: () => void } | null;
  column?: ReactNode;
  scrollRef?: Ref<ScrollViewInstance>;
  toast?: PageToastProps | null | undefined;
  children: ReactNode;
}) {
  const shell = useShell();
  const insets = useSafeAreaInsets();
  const backTo = back === undefined ? { onPress: shell.toSettings } : back;

  if (shell.layout === 'landscape')
    return (
      <Landscape column={column ?? shell.listColumn}>
        <ScrollView
          ref={scrollRef}
          style={styles.grow}
          contentContainerStyle={styles.pane}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {title != null && <PageTitle text={title} size={PANE_TITLE} look={paneTitle} />}
          {children}
        </ScrollView>
        {toast != null && <PageToast {...toast} bottom={tokens.spaceLg} />}
      </Landscape>
    );

  const phone = shell.layout === 'phone';
  const foot = Math.max(insets.bottom - tokens.spaceXxs, tokens.spaceLg);

  return (
    <View style={styles.page}>
      {!phone && <PortraitTop />}
      <ScrollView
        ref={scrollRef}
        style={styles.grow}
        contentContainerStyle={
          phone
            ? {
                paddingTop: insets.top + tokens.spaceXxs,
                paddingHorizontal: tokens.spaceXxl,
                paddingBottom: foot + PHONE_TAB_BAR + tokens.space6xl * 2,
              }
            : {
                paddingTop: tokens.spaceXl,
                paddingHorizontal: tokens.space5xl,
                paddingBottom: insets.bottom + tokens.space6xl * 2,
              }
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.top}>
          {backTo != null && <Back {...backTo} />}
          {phone && backTo == null && <OrgPill />}
          <View style={styles.grow} />
          {phone && <Bell tell={shell.tell} />}
        </View>
        {title == null ? (
          <View style={styles.untitled} />
        ) : (
          <PageTitle text={title} size={PAGE_TITLE} look={pageTitle} />
        )}
        <View style={styles.blocks}>{children}</View>
      </ScrollView>
      {phone && (
        <>
          <View style={[styles.statusStrip, { height: insets.top }]} pointerEvents="none" />
          <TabBarFade />
          <SettingsTabBar bottom={foot} />
        </>
      )}
      {toast != null && (
        <PageToast
          {...toast}
          bottom={
            phone ? foot + PHONE_TAB_BAR + tokens.spaceLg : Math.max(insets.bottom, tokens.spaceLg)
          }
        />
      )}
    </View>
  );
}

function PageTitle({
  text,
  size,
  look,
}: {
  text: string;
  size: number;
  look: { letterSpacing: number };
}) {
  return (
    <Text size={size} weight="bold" accessibilityRole="header" style={[styles.title, look]}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  page: { flex: 1, backgroundColor: tokens.colorCard },
  statusStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: tokens.colorCard,
  },
  pane: { paddingTop: 26, paddingHorizontal: 30, paddingBottom: tokens.space6xl * 2, gap: 18 },
  top: { flexDirection: 'row', alignItems: 'center' },
  title: { paddingTop: 14, paddingBottom: tokens.spaceXl },
  untitled: { height: tokens.spaceXl },
  blocks: { gap: 18 },
});
