import { router } from 'expo-router';
import { createContext, type ReactNode, useContext } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { CARD_PIECES, Confetti, Cover } from '../../components/Cover.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { Glass, PHONE_TAB_BAR, PhoneTabBar, TabBarFade } from '../../components/TodayCover.tsx';
import { Bell, Landscape, OrgPill, PortraitTop } from './Frame.tsx';
import { WORDS as PERSONALISATION } from './PersonalisationModel.ts';
import { SchemeTile } from './PersonalisationParts.tsx';
import { dataHref } from './DataModel.ts';
import { DataTile, useDataNav, useDataOpen } from './DataParts.tsx';
import { DATA_WORDS } from './DataWords.ts';
import { demoGroups, managesOrganisation, YOU } from './sample.ts';
import { type ShellSection, useShell, type Viewer } from '../../components/settingsShell.ts';
import { Caps, Pill, Tile, TYPE } from '../../components/SettingsParts.tsx';
import { SwitchedNotice } from '../../components/SwitchedNotice.tsx';
import { SELECTED_ROW } from '../../components/SummaryRows.tsx';
import { LegalLinks } from '../LegalLinks.tsx';

type Listed = Exclude<ShellSection, 'account'>;

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

/** How far the Tint reaches past the open card on its side, as a lit row's does. */
const LIT_PAST = tokens.spaceMd;

/** You, as the Confetti card at the top of Settings: it opens Your account. */
export function PersonCard({
  size,
  open = false,
}: {
  size: 'phone' | 'portrait' | 'column';
  open?: boolean;
}) {
  const shell = useShell();
  const words = useContext(SettingsWordsContext);
  const you = shell.looking;
  const look = {
    phone: {
      height: 148,
      avatar: 60,
      name: 22,
      mail: 15,
      radius: 26,
      scale: 1,
      pad: tokens.spaceXl,
    },
    portrait: {
      height: 180,
      avatar: 76,
      name: 28,
      mail: 16,
      radius: 28,
      scale: 1.3,
      pad: tokens.spaceXl,
    },
    column: {
      height: 104,
      avatar: 48,
      name: 18,
      mail: 13.5,
      radius: 22,
      scale: 0.8,
      pad: tokens.spaceLg,
    },
  }[size];
  const role = you.role == null ? null : `${words.role(you.role)} · ${YOU.organisation}`;

  return (
    <View
      style={[
        styles.personPlate,
        open && { backgroundColor: tokens.colorAccentTint, borderRadius: look.radius + LIT_PAST },
      ]}
    >
      <Pressable
        onPress={() => shell.openSection('account')}
        style={({ pressed }) => [
          styles.person,
          { minHeight: look.height, borderRadius: look.radius, paddingVertical: look.pad },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected: open }}
        accessibilityLabel={`Your account. ${you.name}, ${you.email}${you.role == null ? '' : `, ${you.role} of ${YOU.organisation}`}`}
      >
        <View style={[StyleSheet.absoluteFill, { borderRadius: look.radius, overflow: 'hidden' }]}>
          <Cover shade="side" pieces={[]} />
          <Confetti pieces={CARD_PIECES} scale={look.scale} />
        </View>
        <View
          style={[
            styles.personAvatar,
            { width: look.avatar, height: look.avatar, borderRadius: look.avatar / 2 },
          ]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text
            size={Math.round(look.avatar * 0.36)}
            weight="bold"
            accessible={false}
            style={styles.accent}
          >
            {you.initials}
          </Text>
        </View>
        <View style={styles.personWords}>
          <Text
            size={look.name}
            weight="bold"
            accessible={false}
            style={[styles.white, styles.tight]}
          >
            {you.name}
          </Text>
          <Text size={look.mail} weight="medium" accessible={false} style={styles.white}>
            {you.email}
          </Text>
          {role != null && (
            <Glass height={28} style={styles.roleChip}>
              <Text size={13} weight="semibold" accessible={false} style={styles.white}>
                {role}
              </Text>
            </Glass>
          )}
        </View>
        <Glass height={36} style={styles.personChevron}>
          <Glyph name="chevron" size={18} ink={tokens.colorInkOnDark} weight={2.4} />
        </Glass>
      </Pressable>
    </View>
  );
}

function Row({
  section,
  dense,
  first,
  open,
}: {
  section: Listed;
  dense: boolean;
  first: boolean;
  open: boolean;
}) {
  const shell = useShell();
  const { title, line } = useContext(SettingsWordsContext).rows[section];
  const tile = dense ? 32 : 36;

  return (
    <ListRow
      title={title}
      line={line}
      tile={
        section === 'personalisation' ? (
          <SchemeTile side={tile} />
        ) : (
          <Tile of={section} side={tile} initials={section === 'organisation' ? 'IE' : undefined} />
        )
      }
      dense={dense}
      first={first}
      open={open}
      onPress={() => shell.openSection(section)}
      testID={`settings.${section}`}
    />
  );
}

/** Data and control, a row of the demo's own: on its side it changes the page beside the list. */
function DataRow({ dense, first }: { dense: boolean; first: boolean }) {
  const shell = useShell();
  const lit = useDataOpen();
  const nav = useDataNav();
  const href = dataHref('hub', { as: nav.viewer });

  return (
    <ListRow
      title={DATA_WORDS.title}
      line={DATA_WORDS.settingsLine}
      tile={<DataTile side={dense ? 32 : 36} />}
      dense={dense}
      first={first}
      open={lit != null}
      onPress={() => {
        if (shell.layout !== 'landscape') router.push(href);
        else if (lit == null) router.replace(href);
        else if (lit !== 'hub') nav.toHub();
      }}
      testID="settings.dataAndControl"
    />
  );
}

function ListRow({
  title,
  line,
  tile,
  dense,
  first,
  open,
  onPress,
  testID,
}: {
  title: string;
  line: string;
  tile: ReactNode;
  dense: boolean;
  first: boolean;
  open: boolean;
  onPress: () => void;
  testID: string;
}) {
  const side = dense ? 32 : 36;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        dense && styles.rowDense,
        open && styles.rowOpen,
        pressed && !open && styles.rowPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: open }}
      accessibilityLabel={`${title}. ${line}`}
      testID={testID}
    >
      {!first && !open && <View style={[styles.rule, { left: tokens.spaceXl + side + 12 }]} />}
      {tile}
      <View style={styles.rowWords}>
        <Text
          size={dense ? 15.5 : TYPE.row}
          weight="semibold"
          accessible={false}
          style={open ? styles.accent : undefined}
        >
          {title}
        </Text>
        <Text
          size={dense ? 13 : TYPE.small}
          weight="medium"
          accessible={false}
          style={styles.secondary}
        >
          {line}
        </Text>
      </View>
      <Glyph
        name="chevron"
        size={18}
        ink={open ? tokens.colorAccent : tokens.colorInkTertiary}
        weight={2.2}
      />
    </Pressable>
  );
}

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
  const last = sections[sections.length - 1];

  return (
    <View style={styles.group}>
      {sections.map((section, index) => (
        <Row
          key={section}
          section={section}
          dense={dense}
          first={index === 0 || sections[index - 1] === open}
          open={section === open}
        />
      ))}
      {data && <DataRow dense={dense} first={last == null || last === open} />}
    </View>
  );
}

function DemoRow({ dense, onDemo }: { dense: boolean; onDemo: () => void }) {
  return (
    <View style={styles.group}>
      <Pressable
        onPress={onDemo}
        style={({ pressed }) => [
          styles.row,
          dense && styles.rowDense,
          pressed && styles.rowPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Design demo, in development and QA builds. The designs, working on sample data"
      >
        <Tile of="demo" side={dense ? 32 : 36} />
        <View style={styles.rowWords}>
          <View style={styles.demoTitle}>
            <Text size={dense ? 15.5 : TYPE.row} weight="semibold" accessible={false}>
              Design demo
            </Text>
            <View style={styles.tag}>
              <Text size={12} weight="semibold" accessible={false} style={styles.secondary}>
                Dev and QA
              </Text>
            </View>
          </View>
          <Text
            size={dense ? 13 : TYPE.small}
            weight="medium"
            accessible={false}
            style={styles.secondary}
          >
            The designs, working on sample data
          </Text>
        </View>
        <Glyph name="chevron" size={18} ink={tokens.colorInkTertiary} weight={2.2} />
      </Pressable>
    </View>
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
    <View>
      <Pill label={signOut} kind="secondary" glyph="signOut" height={height} onPress={onSignOut} />
      {legal && <LegalLinks style={styles.legal} />}
    </View>
  );
}

/** Settings itself: on a phone one column; upright your account's group beside the organisation's. */
export function SettingsHome({ onSignOut, onDemo }: Handlers) {
  const shell = useShell();
  const insets = useSafeAreaInsets();
  const words = useContext(SettingsWordsContext);
  const groups = groupsFor(shell.viewer, words);

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
          <View style={styles.footPhone}>
            <DemoRow dense={false} onDemo={onDemo} />
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
      <View style={styles.footPhone}>
        <DemoRow dense={false} onDemo={onDemo} />
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
          {words.title}
        </Text>
        <SwitchedNotice style={styles.switched} />
        <PersonCard size="portrait" />
        {organisation == null ? (
          <View style={styles.single}>{left}</View>
        ) : (
          <>
            <View style={styles.columns}>
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

/** On its side, the Settings list stays in its column while a section is open beside it. */
export function SettingsColumn({ onSignOut, onDemo }: Handlers) {
  const shell = useShell();
  const groups = groupsFor(shell.viewer, useContext(SettingsWordsContext));

  return (
    <ScrollView contentContainerStyle={styles.column} showsVerticalScrollIndicator={false}>
      <PersonCard size="column" open={shell.open === 'account'} />
      {groups.map(({ heading, sections, data }, index) =>
        sections.length === 0 ? null : (
          <View key={heading}>
            <Caps text={heading} top={index === 0 ? tokens.spaceXxl : tokens.spaceXl} />
            <Group sections={sections} dense open={shell.open} data={data} />
          </View>
        ),
      )}
      <View style={styles.footColumn}>
        <DemoRow dense onDemo={onDemo} />
        <SignOut height={tokens.sizeHit} onSignOut={onSignOut} />
      </View>
    </ScrollView>
  );
}

function ChooseASection() {
  return (
    <View style={styles.choose}>
      <View
        style={styles.chooseMark}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Glyph name="settings" size={30} ink={tokens.colorAccent} />
        <Confetti
          pieces={[
            [0.02, 0.06, 'half', 18, -18, 'sun'],
            [1.08, 0.02, 'bar', 18, 24, 'rose'],
            [1.16, 0.8, 'half', 14, 200, 'sky'],
            [-0.06, 0.86, 'bar', 14, 62, 'rose'],
          ]}
        />
      </View>
      <Text size={22} weight="bold" accessibilityRole="header">
        Choose a section
      </Text>
    </View>
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
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccent },
  white: { color: tokens.colorInkOnDark },
  tight: { letterSpacing: -0.3 },
  pressed: { opacity: 0.9 },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXl,
    paddingLeft: tokens.spaceXxl,
    paddingRight: tokens.spaceXl,
  },
  personPlate: { margin: -LIT_PAST, padding: LIT_PAST },
  personAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInkOnDark,
  },
  personWords: { flex: 1, minWidth: 0, gap: 3, alignItems: 'flex-start' },
  roleChip: { marginTop: tokens.spaceXs, paddingHorizontal: 11 },
  personChevron: { width: 36, justifyContent: 'center' },
  group: {
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorInset,
    padding: tokens.spaceXxs,
  },
  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 11,
    paddingLeft: tokens.spaceXl,
    paddingRight: 14,
    borderRadius: tokens.spaceXl,
  },
  rowDense: { minHeight: tokens.sizeListRow, gap: 12, paddingVertical: 9 },
  // No ring: sc-31724.
  rowOpen: SELECTED_ROW,
  rowPressed: { backgroundColor: tokens.colorNeutralFill },
  rule: { position: 'absolute', right: 0, top: 0, height: 1, backgroundColor: tokens.colorBorder },
  rowWords: { flex: 1, minWidth: 0, gap: 2 },
  demoTitle: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
  tag: {
    minHeight: 22,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceSm,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  footPhone: { marginTop: 26, gap: 22 },
  legal: { marginTop: tokens.spaceXs },
  legalUnder: { marginTop: tokens.spaceXl },
  footColumn: { marginTop: tokens.spaceXl, gap: tokens.spaceLg },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.space3xl },
  single: { maxWidth: 520 },
  column: {
    paddingTop: tokens.spaceXl,
    paddingLeft: tokens.spaceXl,
    paddingRight: 14,
    paddingBottom: tokens.space6xl,
  },
  choose: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  chooseMark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorAccentTint,
  },
});
