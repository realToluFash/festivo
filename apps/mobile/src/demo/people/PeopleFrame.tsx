import { type ComponentProps, createContext, type ReactNode, useCallback, useContext } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, TitleCap } from '../../components/Text.tsx';
import { Title, usePageTitleDrawn, useTitleCap } from '../../components/Title.tsx';
import { PAGE_TITLE, pageTitle } from '../../components/topTitle.ts';
import { tokens } from '../../theme/tokens.ts';
import { Bell, PortraitTop } from '../settings/Frame.tsx';
import { EVENT } from './PeopleSample.ts';
import { BellRow, EventFrame } from '../events/EventFrame.tsx';
import { useShell } from '../../components/settingsShell.ts';
import { Back } from '../../components/SettingsParts.tsx';
import { PageToast, type PageToastProps } from '../../components/Summary.tsx';

/** The event's frame People draws in as every other area does: People lit in it on the iPad (sc-67665), More lit under it on the phone (sc-70351). */
export type InEvent = Omit<ComponentProps<typeof EventFrame>, 'area' | 'toast' | 'children'>;

export const PeopleInEvent = createContext<InEvent | null>(null);

/** People's title tells its own page and, in the event's frame, the frame the size it drew at, so the frame caps ‹ Events and the page under it as it does Guests' (sc-67665). */
function PeopleTitle({ onDrawn }: { onDrawn: (size: number) => void }) {
  const frameDrawn = usePageTitleDrawn();
  const drawn = useCallback(
    (size: number) => {
      onDrawn(size);
      frameDrawn?.(size);
    },
    [onDrawn, frameDrawn],
  );

  return (
    <Title size={PAGE_TITLE} accessibilityRole="header" style={pageTitle} onDrawn={drawn}>
      People
    </Title>
  );
}

/** A page inside an event: back, the title over the event's name, then the blocks 18 apart; in the event's frame, named for the frame's event, with the frame's back, bell and, on the phone, tab bar. Nothing under the title draws larger than it, the frame's ‹ Events included (sc-67471, sc-67665). */
export function PeoplePage({
  back,
  event = EVENT,
  toast,
  children,
}: {
  back: { label: string; onPress: () => void };
  event?: string;
  toast?: PageToastProps | null | undefined;
  children: ReactNode;
}) {
  const { layout, tell } = useShell();
  const insets = useSafeAreaInsets();
  const phone = layout === 'phone';
  const { cap, onDrawn } = useTitleCap(`${PAGE_TITLE}|People`, PAGE_TITLE);
  const inEvent = useContext(PeopleInEvent);
  const head = (
    <View style={inEvent == null || phone ? styles.title : styles.titleInEvent}>
      <BellRow>
        <PeopleTitle onDrawn={onDrawn} />
      </BellRow>
      <Text size={15} weight="medium" style={styles.secondary}>
        {inEvent == null ? event : inEvent.event.name}
      </Text>
    </View>
  );

  if (inEvent != null)
    return (
      <TitleCap.Provider value={cap}>
        <EventFrame
          {...inEvent}
          area="people"
          toast={toast == null ? null : { words: toast.words, onClose: toast.onClose }}
        >
          <View>
            {head}
            <View style={styles.blocks}>{children}</View>
          </View>
        </EventFrame>
      </TitleCap.Provider>
    );

  const page = (
    <TitleCap.Provider value={cap}>
      <View style={styles.top}>
        <Back label={back.label} onPress={back.onPress} />
        <View style={styles.grow} />
        {phone && <Bell tell={tell} />}
      </View>
      {head}
      <View style={styles.blocks}>{children}</View>
    </TitleCap.Provider>
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

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  page: { flex: 1, backgroundColor: tokens.colorCard },
  secondary: { color: tokens.colorInkSecondary },
  top: { flexDirection: 'row', alignItems: 'center' },
  title: { gap: tokens.spaceXxs, paddingTop: 14, paddingBottom: tokens.spaceXl },
  titleInEvent: { gap: tokens.spaceXxs, paddingBottom: tokens.spaceXl },
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
});
