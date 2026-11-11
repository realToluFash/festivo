import { type Href, router } from 'expo-router';
import { createContext, useContext } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { PHONE_TAB_BAR, TabBarFade } from '../../components/TodayCover.tsx';
import { Bell, Landscape, OrgPill, PortraitTop, SettingsTabBar } from './Frame.tsx';
import { type Held, HeldStandIn } from './Held.tsx';
import { inUse, useHeldChoice, WORDS as PERSONALISATION } from './PersonalisationModel.ts';
import { SettingsDemoRow } from './SettingsDemoRow.tsx';
import { SchemeTile } from '../../components/SchemeParts.tsx';
import { dataHref } from './DataModel.ts';
import { DataTile, useDataNav, useDataOpen } from './DataParts.tsx';
import { DATA_WORDS } from './DataWords.ts';
import { demoGroups, managesOrganisation, YOU } from './sample.ts';
import { type ShellSection, useShell, type Viewer } from '../../components/settingsShell.ts';
import { Caps } from '../../components/SettingsParts.tsx';
import {
  ChooseASection,
  PersonCard as ProductPersonCard,
  SettingsGroup,
  SettingsSignOut,
  rowSide,
  settingsHomeStyles,
  useSectionRows,
} from '../../components/SettingsHome.tsx';
import { SwitchedNotice } from '../../components/SwitchedNotice.tsx';
import { LegalLinks } from '../LegalLinks.tsx';
import { TOP_TITLE, topTitle } from '../topTitle.ts';

type Listed = Exclude<ShellSection, 'account'>;

const DATA_ROW = 'dataAndControl';

/** Settings' words: the page's title, its headings, the rows and their lines (the organisation's row carries its name), the role on your card and Sign out. */
export interface SettingsWords {
  title: string;
  headings: Record<ReturnType<typeof demoGroups>[number]['heading'], string>;
  rows: Record<Listed, { title: string; line: string }>;
  role: (role: string) => string;
  signOut: string;
}

export const SETTINGS_WORDS: SettingsWords = {
  title: 'Settings',
  headings: { yourAccount: 'Your account', organisationHeading: 'Organisation' },
  rows: {
    security: {
      title: 'Security',
      line: 'Password, ways to sign in, two-factor, signed-in devices',
    },
    notifications: {
      title: 'Notifications',
      line: 'Push and email, for each kind of notification',
    },
    personalisation: { title: 'Personalisation', line: PERSONALISATION.listLine },
    organisation: { title: YOU.organisation, line: 'Name, contact address, currency, time zone' },
    members: { title: 'Members', line: 'Who is in it, and their roles' },
    signInRules: { title: 'Sign-in rules', line: 'How people sign in, and for how long' },
  },
  role: (role) => role,
  signOut: 'Sign out',
};

/** English unless a state draws the page in another language, as Bold text's Spanish state does. */
export const SettingsWordsContext = createContext(SETTINGS_WORDS);

/** The sections a viewer sees; Your account is the card at the top. Data and control follows Sign-in rules for whoever manages the organisation (sc-560). */
export function groupsFor(viewer: Viewer, words: SettingsWords = SETTINGS_WORDS) {
  return demoGroups(viewer).map(({ heading, sections }) => ({
    heading: words.headings[heading],
    sections: sections.filter((section): section is Listed => section !== 'account'),
    data: heading === 'organisationHeading' && managesOrganisation(viewer),
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
  const words = useContext(SettingsWordsContext);
  const you = shell.looking;

  return (
    <ProductPersonCard
      person={{
        ...you,
        role: you.role == null ? null : words.role(you.role),
        organisation: YOU.organisation,
      }}
      size={size}
      open={open}
      onPress={() => shell.openSection('account')}
    />
  );
}

/** Data and control, a row of the demo's own: on its side it changes the page beside the list. */
function useDataRow(dense: boolean) {
  const shell = useShell();
  const lit = useDataOpen();
  const nav = useDataNav();
  const href = dataHref('hub', { as: nav.viewer }) as Href;

  return {
    lit: lit != null,
    row: {
      key: DATA_ROW,
      title: DATA_WORDS.title,
      line: DATA_WORDS.settingsLine,
      tile: <DataTile side={rowSide(dense)} />,
    },
    open: () => {
      if (shell.layout !== 'landscape') router.push(href);
      else if (lit == null) router.replace(href);
      else if (lit !== 'hub') nav.toHub();
    },
  };
}

/** The product's rows, with Personalisation's ahead of the app. */
function Group({
  sections,
  dense,
  open,
  data = false,
}: {
  sections: readonly Listed[];
  dense: boolean;
  open: ShellSection | null;
  data?: boolean;
}) {
  const shell = useShell();
  const words = useContext(SettingsWordsContext).rows;
  const rowOf = useSectionRows(YOU.organisation);
  const side = rowSide(dense);
  const rows = sections.map((section) => ({
    ...(section === 'personalisation'
      ? { key: section, tile: <HeldTile side={side} /> }
      : rowOf(section, side)),
    ...words[section],
  }));
  const dataRow = useDataRow(dense);

  return (
    <SettingsGroup
      rows={data ? [...rows, dataRow.row] : rows}
      dense={dense}
      open={data && dataRow.lit ? DATA_ROW : open}
      onOpen={(key) => (key === DATA_ROW ? dataRow.open() : shell.openSection(key as Listed))}
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
  const { signOut } = useContext(SettingsWordsContext);

  return (
    <SettingsSignOut
      label={signOut}
      height={height}
      onSignOut={onSignOut}
      under={legal ? <LegalLinks style={styles.legal} /> : undefined}
    />
  );
}

/** Settings itself: on a phone one column; upright your account's group beside the organisation's. */
export function SettingsHome({
  onSignOut,
  onDemo,
  held = null,
}: Handlers & { held?: Held | null }) {
  const shell = useShell();
  const insets = useSafeAreaInsets();
  const words = useContext(SettingsWordsContext);
  const groups = groupsFor(shell.viewer, words);

  if (held != null) return <HeldSettings held={held} onSignOut={onSignOut} />;

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
              size={TOP_TITLE}
              weight="bold"
              accessibilityRole="header"
              style={[styles.grow, topTitle]}
            >
              {words.title}
            </Text>
          </View>
          <SwitchedNotice style={styles.switched} />
          <PersonCard size="phone" />
          {groups.map(({ heading, sections, data }) =>
            sections.length === 0 ? null : (
              <View key={heading}>
                <Caps text={heading} top={26} />
                <Group sections={sections} dense={false} open={null} data={data} />
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
        <SettingsTabBar bottom={foot} />
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
          size={TOP_TITLE}
          weight="bold"
          accessibilityRole="header"
          style={[topTitle, styles.portraitTitle]}
        >
          {words.title}
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
                <Group
                  sections={organisation.sections}
                  dense={false}
                  open={null}
                  data={organisation.data}
                />
              </View>
            </View>
            <LegalLinks style={styles.legalUnder} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** Paused access or two-factor overdue in place of Settings: the pill and the bell stay, so the switcher is a tap away. */
function HeldSettings({ held, onSignOut }: { held: Held; onSignOut: () => void }) {
  const shell = useShell();
  const insets = useSafeAreaInsets();
  const standIn = <HeldStandIn held={held} onSignOut={onSignOut} />;

  if (shell.layout === 'landscape')
    return (
      <Landscape column={null}>
        <View style={styles.heldSide}>{standIn}</View>
      </Landscape>
    );

  if (shell.layout === 'portrait')
    return (
      <View style={styles.page}>
        <PortraitTop at="Settings" />
        <View style={styles.heldUpright}>{standIn}</View>
      </View>
    );

  const foot = Math.max(insets.bottom - tokens.spaceXxs, tokens.spaceLg);

  return (
    <View style={styles.page}>
      <View
        style={[
          styles.heldPhone,
          { paddingTop: insets.top + tokens.spaceXs, paddingBottom: foot + PHONE_TAB_BAR },
        ]}
      >
        <View style={styles.orgRow}>
          <OrgPill />
          <View style={styles.grow} />
          <Bell tell={shell.tell} />
        </View>
        {standIn}
      </View>
      <TabBarFade />
      <SettingsTabBar bottom={foot} />
    </View>
  );
}

/** On its side, the Settings list stays in its column while a section is open beside it. */
export function SettingsColumn({ onSignOut, onDemo }: Handlers) {
  const shell = useShell();
  const words = useContext(SettingsWordsContext);
  const groups = groupsFor(shell.viewer, words);

  return (
    <ScrollView
      contentContainerStyle={settingsHomeStyles.column}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.columnTop}>
        <Text
          size={TOP_TITLE}
          weight="bold"
          accessibilityRole="header"
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[styles.grow, topTitle]}
        >
          {words.title}
        </Text>
        <Bell tell={shell.tell} />
      </View>
      <PersonCard size="column" open={shell.open === 'account'} />
      {groups.map(({ heading, sections, data }, index) =>
        sections.length === 0 ? null : (
          <View key={heading}>
            <Caps text={heading} top={index === 0 ? tokens.spaceXxl : tokens.spaceXl} />
            <Group sections={sections} dense open={shell.open} data={data} />
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
  heldPhone: { flex: 1, paddingHorizontal: tokens.spaceXxl },
  heldUpright: { flex: 1, paddingHorizontal: tokens.space5xl },
  heldSide: { flex: 1, paddingHorizontal: 30 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingTop: tokens.spaceXs,
    paddingBottom: 18,
  },
  columnTop: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    marginBottom: tokens.spaceLg,
  },
  portraitTitle: { paddingTop: 30, paddingBottom: 22, paddingHorizontal: tokens.spaceHair },
  switched: { marginBottom: tokens.spaceXl },
  legal: { marginTop: tokens.spaceXs },
  legalUnder: { marginTop: tokens.spaceXl },
});

/** Personalisation's tile in the demo's list: the demo's own pick, held in memory. */
function HeldTile({ side }: { side: number }) {
  return <SchemeTile side={side} scheme={inUse(useHeldChoice())} />;
}
