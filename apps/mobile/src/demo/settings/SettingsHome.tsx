import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { PHONE_TAB_BAR, PhoneTabBar, TabBarFade } from '../../components/TodayCover.tsx';
import { Bell, Landscape, OrgPill, PortraitTop } from './Frame.tsx';
import { WORDS as PERSONALISATION } from './PersonalisationModel.ts';
import { SchemeTile } from './PersonalisationParts.tsx';
import { demoGroups, YOU } from './sample.ts';
import { type ShellSection, useShell, type Viewer } from '../../components/settingsShell.ts';
import { Caps, TYPE } from '../../components/SettingsParts.tsx';
import {
  ChooseASection,
  PersonCard as ProductPersonCard,
  SettingsDemoRow,
  SettingsGroup,
  SettingsSignOut,
  rowSide,
  settingsHomeStyles,
  useSectionRows,
} from '../../components/SettingsHome.tsx';
import { SwitchedNotice } from '../../components/SwitchedNotice.tsx';
import { LegalLinks } from '../LegalLinks.tsx';

type Listed = Exclude<ShellSection, 'account'>;

const HEADINGS = { yourAccount: 'Your account', organisationHeading: 'Organisation' } as const;

/** The sections a viewer sees; Your account is the card at the top. */
export function groupsFor(viewer: Viewer) {
  return demoGroups(viewer).map(({ heading, sections }) => ({
    heading: HEADINGS[heading],
    sections: sections.filter((section): section is Listed => section !== 'account'),
  }));
}

export function sectionsFor(viewer: Viewer): readonly ShellSection[] {
  return demoGroups(viewer).flatMap(({ sections }) => sections);
}

interface Handlers {
  onSignOut: () => void;
  onDemo: () => void;
}

/** The product's card, for whoever the demo is looking as. */
function PersonCard({
  size,
  open = false,
}: {
  size: 'phone' | 'portrait' | 'column';
  open?: boolean;
}) {
  const shell = useShell();

  return (
    <ProductPersonCard
      person={{ ...shell.looking, organisation: YOU.organisation }}
      size={size}
      open={open}
      onPress={() => shell.openSection('account')}
    />
  );
}

/** The product's rows, with Personalisation's ahead of the app. */
function Group({
  sections,
  dense,
  open,
}: {
  sections: readonly Listed[];
  dense: boolean;
  open: ShellSection | null;
}) {
  const shell = useShell();
  const rowOf = useSectionRows(YOU.organisation);
  const side = rowSide(dense);
  const rows = sections.map((section) =>
    section === 'personalisation'
      ? {
          key: section,
          title: 'Personalisation',
          line: PERSONALISATION.listLine,
          tile: <SchemeTile side={side} />,
        }
      : rowOf(section, side),
  );

  return (
    <SettingsGroup
      rows={rows}
      dense={dense}
      open={open}
      onOpen={(key) => shell.openSection(key as Listed)}
    />
  );
}

function SignOut({
  height,
  onSignOut,
  legal = true,
}: {
  height: number;
  onSignOut: () => void;
  /** Terms · Privacy under it; upright with two columns they go under both instead. */
  legal?: boolean;
}) {
  return (
    <SettingsSignOut
      height={height}
      onSignOut={onSignOut}
      under={legal ? <LegalLinks style={styles.legal} /> : undefined}
    />
  );
}

/** Settings itself: on a phone one column; upright your account's group beside the organisation's. */
export function SettingsHome({ onSignOut, onDemo }: Handlers) {
  const shell = useShell();
  const insets = useSafeAreaInsets();
  const groups = groupsFor(shell.viewer);

  if (shell.layout === 'landscape')
    return (
      <Landscape column={shell.listColumn}>
        <ChooseASection />
      </Landscape>
    );

  if (shell.layout === 'phone') {
    const foot = Math.max(insets.bottom - tokens.spaceXxs, tokens.spaceLg);

    return (
      <View style={styles.page}>
        <ScrollView
          style={styles.grow}
          contentContainerStyle={{
            paddingTop: insets.top + tokens.spaceXs,
            paddingHorizontal: tokens.spaceXxl,
            paddingBottom: foot + PHONE_TAB_BAR + tokens.space6xl,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.orgRow}>
            <OrgPill />
            <View style={styles.grow} />
            <Bell tell={shell.tell} />
          </View>
          <View style={styles.titleRow}>
            <Text
              size={TYPE.titlePhone}
              weight="bold"
              accessibilityRole="header"
              style={[styles.grow, styles.title]}
            >
              Settings
            </Text>
          </View>
          <SwitchedNotice style={styles.switched} />
          <PersonCard size="phone" />
          {groups.map(({ heading, sections }) =>
            sections.length === 0 ? null : (
              <View key={heading}>
                <Caps text={heading} top={26} />
                <Group sections={sections} dense={false} open={null} />
              </View>
            ),
          )}
          <View style={settingsHomeStyles.footPhone}>
            <SettingsDemoRow dense={false} onDemo={onDemo} />
            <SignOut height={tokens.sizeHitPhoneHero} onSignOut={onSignOut} />
          </View>
        </ScrollView>
        <View style={[styles.statusStrip, { height: insets.top }]} pointerEvents="none" />
        <TabBarFade />
        <PhoneTabBar bottom={foot} onTab={shell.onTab} at="Settings" />
      </View>
    );
  }

  const [yours, organisation] = groups;
  const left = (
    <>
      {yours != null && yours.sections.length > 0 && (
        <>
          <Caps text={yours.heading} top={tokens.space4xl} />
          <Group sections={yours.sections} dense={false} open={null} />
        </>
      )}
      <View style={settingsHomeStyles.footPhone}>
        <SettingsDemoRow dense={false} onDemo={onDemo} />
        <SignOut
          height={tokens.sizeHitPhoneHero}
          onSignOut={onSignOut}
          legal={organisation == null}
        />
      </View>
    </>
  );

  return (
    <View style={styles.page}>
      <PortraitTop at="Settings" />
      <ScrollView
        style={styles.grow}
        contentContainerStyle={{
          paddingHorizontal: tokens.space5xl,
          paddingBottom: insets.bottom + tokens.space6xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          size={TYPE.titlePortrait}
          weight="bold"
          accessibilityRole="header"
          style={[styles.title, styles.portraitTitle]}
        >
          Settings
        </Text>
        <SwitchedNotice style={styles.switched} />
        <PersonCard size="portrait" />
        {organisation == null ? (
          <View style={settingsHomeStyles.single}>{left}</View>
        ) : (
          <>
            <View style={settingsHomeStyles.columns}>
              <View style={styles.grow}>{left}</View>
              <View style={styles.grow}>
                <Caps text={organisation.heading} top={tokens.space4xl} />
                <Group sections={organisation.sections} dense={false} open={null} />
              </View>
            </View>
            <LegalLinks style={styles.legalUnder} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** On its side, the Settings list stays in its column while a section is open beside it. */
export function SettingsColumn({ onSignOut, onDemo }: Handlers) {
  const shell = useShell();
  const groups = groupsFor(shell.viewer);

  return (
    <ScrollView
      contentContainerStyle={settingsHomeStyles.column}
      showsVerticalScrollIndicator={false}
    >
      <PersonCard size="column" open={shell.open === 'account'} />
      {groups.map(({ heading, sections }, index) =>
        sections.length === 0 ? null : (
          <View key={heading}>
            <Caps text={heading} top={index === 0 ? tokens.spaceXxl : tokens.spaceXl} />
            <Group sections={sections} dense open={shell.open} />
          </View>
        ),
      )}
      <View style={settingsHomeStyles.footColumn}>
        <SettingsDemoRow dense onDemo={onDemo} />
        <SignOut height={tokens.sizeHit} onSignOut={onSignOut} />
      </View>
    </ScrollView>
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
  orgRow: { flexDirection: 'row', alignItems: 'center', marginBottom: tokens.spaceSm },
  title: { letterSpacing: -0.5 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingTop: tokens.spaceXs,
    paddingBottom: 18,
  },
  portraitTitle: { paddingTop: 30, paddingBottom: 22, paddingHorizontal: tokens.spaceHair },
  switched: { marginBottom: tokens.spaceXl },
  legal: { marginTop: tokens.spaceXs },
  legalUnder: { marginTop: tokens.spaceXl },
});
