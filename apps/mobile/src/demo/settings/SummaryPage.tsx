import type { ReactNode, Ref } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Back } from '../../components/SettingsParts.tsx';
import { useShell } from '../../components/settingsShell.ts';
import { PageToast, type PageToastProps } from '../../components/Summary.tsx';
import { TitleCap } from '../../components/Text.tsx';
import { Title, useTitleCap } from '../../components/Title.tsx';
import { PHONE_TAB_BAR, TabBarFade } from '../../components/TodayCover.tsx';
import { tokens } from '../../theme/tokens.ts';
import { PAGE_TITLE, PANE_TITLE, pageTitle, paneTitle } from '../../components/topTitle.ts';
import { Bell, Landscape, OrgPill, PortraitTop, SettingsTabBar } from './Frame.tsx';
import { useWayBackToNone } from '../../components/wayBackToNone.ts';

/** A section page in B, summary first: back and the bell on top, the title, then the card and the lists. Back draws no larger than the title (sc-67471). */
export function SummaryPage({
  title,
  back,
  column,
  scrollRef,
  onScroll,
  toast,
  band,
  children,
}: {
  title?: string;
  back?: { label?: string; onPress: () => void } | null;
  column?: ReactNode;
  scrollRef?: Ref<ScrollViewInstance>;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  toast?: PageToastProps | null | undefined;
  /** The offline band, under the top and across the page, as the product's AppFrame places it. */
  band?: ReactNode;
  children: ReactNode;
}) {
  const shell = useShell();
  const insets = useSafeAreaInsets();
  const backTo = back === undefined ? { onPress: shell.toSettings } : back;
  const bar = useWayBackToNone() == null ? PHONE_TAB_BAR : 0;
  const titled = shell.layout === 'landscape' ? PANE_TITLE : PAGE_TITLE;
  const drawn = useTitleCap(`${titled}|${title ?? ''}`, titled);
  const cap = title == null ? null : drawn.cap;
  const onDrawn = drawn.onDrawn;

  if (shell.layout === 'landscape')
    return (
      <Landscape column={column ?? shell.listColumn} band={band}>
        <ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          scrollEventThrottle={64}
          style={styles.grow}
          contentContainerStyle={styles.pane}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {title != null && (
            <PageTitle text={title} size={PANE_TITLE} look={paneTitle} onDrawn={onDrawn} />
          )}
          <TitleCap.Provider value={cap}>{children}</TitleCap.Provider>
        </ScrollView>
        {toast != null && <PageToast {...toast} bottom={tokens.spaceLg} />}
      </Landscape>
    );

  const phone = shell.layout === 'phone';
  const foot = Math.max(insets.bottom - tokens.spaceXxs, tokens.spaceLg);

  return (
    <View style={styles.page}>
      {!phone && <PortraitTop />}
      {phone && band != null && <View style={{ height: insets.top }} />}
      {band}
      <ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={64}
        style={styles.grow}
        contentContainerStyle={
          phone
            ? {
                paddingTop: (band == null ? insets.top : 0) + tokens.spaceXxs,
                paddingHorizontal: tokens.spaceXxl,
                paddingBottom: foot + bar + tokens.space6xl * 2,
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
          {backTo != null && (
            <TitleCap.Provider value={cap}>
              <Back {...backTo} />
            </TitleCap.Provider>
          )}
          {phone && backTo == null && <OrgPill />}
          <View style={styles.grow} />
          {phone && <Bell tell={shell.tell} />}
        </View>
        {title == null ? (
          <View style={styles.untitled} />
        ) : (
          <PageTitle text={title} size={PAGE_TITLE} look={pageTitle} onDrawn={onDrawn} />
        )}
        <TitleCap.Provider value={cap}>
          <View style={styles.blocks}>{children}</View>
        </TitleCap.Provider>
      </ScrollView>
      {phone && (
        <>
          <View style={[styles.statusStrip, { height: insets.top }]} pointerEvents="none" />
          {bar > 0 && <TabBarFade />}
          <SettingsTabBar bottom={foot} />
        </>
      )}
      {toast != null && (
        <PageToast
          {...toast}
          bottom={phone ? foot + bar + tokens.spaceLg : Math.max(insets.bottom, tokens.spaceLg)}
        />
      )}
    </View>
  );
}

function PageTitle({
  text,
  size,
  look,
  onDrawn,
}: {
  text: string;
  size: number;
  look: { letterSpacing: number };
  onDrawn: (size: number) => void;
}) {
  return (
    <Title size={size} accessibilityRole="header" style={[styles.title, look]} onDrawn={onDrawn}>
      {text}
    </Title>
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
