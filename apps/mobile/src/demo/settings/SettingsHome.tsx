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
import {
  ChooseASection,
  PersonCard as ProductPersonCard,
  SettingsSignOut,
  rowSide,
  useSectionRows,
} from '../../components/SettingsHome.tsx';
import { SettingsListBody } from '../../components/SettingsList.tsx';
import { SwitchedNotice } from '../../components/SwitchedNotice.tsx';
import { LegalLinks } from '../LegalLinks.tsx';
import { TOP_TITLE, topTitle } from '../../components/topTitle.ts';

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

/** The product's rows in the demo's words, Personalisation's tile ahead of the app, and Data and control after the organisation's. */
function useDemoList(
  dense: boolean,
  open: ShellSection | null,
  onSignOut: () => void,
  onDemo: () => void,
) {
  const shell = useShell();
  const words = useContext(SettingsWordsContext);
  const rowOf = useSectionRows(YOU.organisation);
  const dataRow = useDataRow(dense);
  const side = rowSide(dense);
  const groups = groupsFor(shell.viewer, words).map(({ heading, sections, data }) => {
    const rows = sections.map((section) => ({
      ...(section === 'personalisation'
        ? { key: section, tile: <HeldTile side={side} /> }
        : rowOf(section, side)),
      ...words.rows[section],
    }));

    return { heading, rows: data ? [...rows, dataRow.row] : rows };
  });

  return {
    groups,
    open: dataRow.lit ? DATA_ROW : open,
    onOpen: (key: string) => (key === DATA_ROW ? dataRow.open() : shell.openSection(key as Listed)),
    renderCard: (size: 'phone' | 'portrait' | 'column') => (
      <PersonCard size={size} open={dense && shell.open === 'account'} />
    ),
    renderFoot: (height: number, beside: boolean) => (
      <>
        <SettingsDemoRow dense={dense} onDemo={onDemo} />
        <SettingsSignOut
          label={words.signOut}
          height={height}
          onSignOut={onSignOut}
          under={beside ? undefined : <LegalLinks style={styles.legal} />}
        />
      </>
    ),
    under: <LegalLinks style={styles.legalUnder} />,
  };
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
  const list = useDemoList(false, null, onSignOut, onDemo);

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
          <SettingsListBody size="phone" {...list} />
        </ScrollView>
        <View style={[styles.statusStrip, { height: insets.top }]} pointerEvents="none" />
        <TabBarFade />
        <SettingsTabBar bottom={foot} />
      </View>
    );
  }

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
        <SettingsListBody size="portrait" {...list} />
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
  const list = useDemoList(true, shell.open, onSignOut, onDemo);

  return (
    <SettingsListBody
      size="column"
      {...list}
      top={
        <>
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
          <SwitchedNotice style={styles.switched} />
        </>
      }
    />
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
