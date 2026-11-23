import { roleName } from '@soirely/domain';
import { type Href, router } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, TitleCap } from '../../components/Text.tsx';
import { Title, useTitleCap } from '../../components/Title.tsx';
import { tokens } from '../../theme/tokens.ts';
import { frameTitleSize } from '../../layout/textSize.ts';
import { useLayout } from '../../layout/useLayout.ts';
import { PHONE_TAB_BAR, TabBarFade } from '../../components/TodayCover.tsx';
import {
  Bell,
  HeldPortraitTop,
  Landscape,
  OrgPill,
  PortraitTop,
  SearchAndBell,
  SettingsTabBar,
} from './Frame.tsx';
import { Back } from '../../components/SettingsParts.tsx';
import { useWayBackToNone } from '../../components/wayBackToNone.ts';
import { HeldStandIn } from './Held.tsx';
import type { Held } from './HeldModel.ts';
import { useHeldChoice } from './PersonalisationModel.ts';
import { SettingsDemoRow } from './SettingsDemoRow.tsx';
import { dataHref } from './DataModel.ts';
import { DataTile, useDataNav, useDataOpen } from './DataParts.tsx';
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
import { PausedHere } from '../OrgSwitcher.tsx';
import { PAGE_TITLE, TOP_TITLE, topTitle } from '../../components/topTitle.ts';

type Listed = Exclude<ShellSection, 'account'>;

const DATA_ROW = 'dataAndControl';

/** The sections a viewer sees; Your account is the card at the top. Data and control follows Sign-in rules for whoever manages the organisation (sc-560). */
function groupsFor(viewer: Viewer) {
  return demoGroups(viewer).map(({ heading, sections }) => ({
    heading,
    sections: sections.filter((section): section is Listed => section !== 'account'),
    data: heading === 'organisationHeading' && managesOrganisation(viewer),
  }));
}

/** The demo's people hold the seeded roles, by their English names. */
const SEEDED: Readonly<Record<string, string>> = {
  Owner: 'owner',
  Admin: 'administrator',
  Member: 'member',
};

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
  const { t } = useTranslation();
  const you = shell.looking;

  return (
    <ProductPersonCard
      person={{
        ...you,
        role:
          you.role == null
            ? null
            : roleName(t, { seededAs: SEEDED[you.role] ?? null, name: you.role }),
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
  const { t } = useTranslation();
  const lit = useDataOpen();
  const nav = useDataNav();
  const href = dataHref('hub', { as: nav.viewer }) as Href;

  return {
    lit: lit != null,
    row: {
      key: DATA_ROW,
      title: t('settings.dataAndControl'),
      line: t('settings.dataAndControlLine'),
      tile: <DataTile side={rowSide(dense)} />,
    },
    open: () => {
      if (shell.layout !== 'landscape') router.push(href);
      else if (lit == null) router.replace(href);
      else if (lit !== 'hub') nav.toHub();
    },
  };
}

/** The product's rows, Personalisation's tile showing the demo's held pick, and Data and control after the organisation's. */
function useDemoList(
  dense: boolean,
  open: ShellSection | null,
  onSignOut: () => void,
  onDemo: () => void,
) {
  const shell = useShell();
  const { t } = useTranslation();
  const rowOf = useSectionRows(YOU.organisation, useHeldChoice());
  const dataRow = useDataRow(dense);
  const side = rowSide(dense);
  const groups = groupsFor(shell.viewer).map(({ heading, sections, data }) => {
    const rows = sections.map((section) => rowOf(section, side));

    return { heading: t(`settings.${heading}`), rows: data ? [...rows, dataRow.row] : rows };
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
  back,
}: Handlers & { held?: Held | null; back?: (() => void) | undefined }) {
  const shell = useShell();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const list = useDemoList(false, null, onSignOut, onDemo);
  const fromNone = useWayBackToNone();
  const backToNone = fromNone != null && (
    <Back label={t('noOrganisation.wayBack')} onPress={fromNone} testID="settings.fromNone.back" />
  );
  // As the product's frame: the title keeps its words whole, and nothing under it draws larger than it drew (sc-13496, sc-67338).
  const titleCap = useTitleCap(`${shell.layout}|${t('settings.title')}`, PAGE_TITLE);
  const title = (
    <Title size={TOP_TITLE} accessibilityRole="header" style={topTitle} onDrawn={titleCap.onDrawn}>
      {t('settings.title')}
    </Title>
  );

  if (held != null)
    return (
      <PausedHere.Provider value={held === 'paused'}>
        <HeldSettings
          held={held}
          back={back}
          onSignOut={onSignOut}
          title={
            held === 'overdue' ? (
              <HeldTitle onDrawn={titleCap.onDrawn}>{t('settings.title')}</HeldTitle>
            ) : null
          }
          cap={titleCap.cap}
        />
      </PausedHere.Provider>
    );

  if (shell.layout === 'landscape')
    return (
      <Landscape column={shell.listColumn}>
        <TitleCap.Provider value={titleCap.cap}>
          <ChooseASection />
        </TitleCap.Provider>
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
            paddingBottom: foot + (fromNone == null ? PHONE_TAB_BAR : 0) + tokens.space6xl,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.orgRow}>
            {backToNone || <OrgPill />}
            <View style={styles.grow} />
            {backToNone ? (
              <Bell tell={shell.tell} />
            ) : (
              <SearchAndBell tell={shell.tell} role={shell.looking.role} />
            )}
          </View>
          <View style={styles.titleRow}>
            <View style={styles.grow}>{title}</View>
          </View>
          <TitleCap.Provider value={titleCap.cap}>
            <SwitchedNotice style={styles.switched} />
            <SettingsListBody size="phone" {...list} />
          </TitleCap.Provider>
        </ScrollView>
        <View style={[styles.statusStrip, { height: insets.top }]} pointerEvents="none" />
        {fromNone == null && <TabBarFade />}
        <SettingsTabBar bottom={foot} />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <PortraitTop at="Settings" />
      {backToNone !== false && <View style={styles.portraitBack}>{backToNone}</View>}
      <ScrollView
        style={styles.grow}
        contentContainerStyle={{
          paddingHorizontal: tokens.space5xl,
          paddingBottom: insets.bottom + tokens.space6xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.portraitTitle}>{title}</View>
        <TitleCap.Provider value={titleCap.cap}>
          <SwitchedNotice style={styles.switched} />
          <SettingsListBody size="portrait" {...list} />
        </TitleCap.Provider>
      </ScrollView>
    </View>
  );
}

/** Paused access or two-factor overdue in place of Settings: the pill and the bell stay, so the switcher is a tap away. Paused draws no page title, and on its side the bell alone heads the content's right; it has no Search in any layout (sc-82858, sc-83881). Over a pushed section, ‹ Settings stays, and on a phone the bell ends its row (sc-83881). Overdue keeps the page's title above its card, on its side with the bell, as the product does (sc-85006). Every layout pads the card once, at the product's inset (sc-85022). */
/** The overdue page's title as the product's frame draws it, which is not the unheld Settings title: 30 on a tablet or a small phone, 34 on a phone, untracked (sc-85022). */
function HeldTitle({ children, onDrawn }: { children: string; onDrawn: (size: number) => void }) {
  const { kind, width, height } = useLayout();

  return (
    <Title
      size={frameTitleSize(kind !== 'phone', Math.min(width, height))}
      accessibilityRole="header"
      onDrawn={onDrawn}
    >
      {children}
    </Title>
  );
}

function HeldSettings({
  held,
  back,
  onSignOut,
  title,
  cap,
}: {
  held: Held;
  back?: (() => void) | undefined;
  onSignOut: () => void;
  title: ReactNode;
  cap: number | null;
}) {
  const shell = useShell();
  const search = held !== 'paused';
  const insets = useSafeAreaInsets();
  const standIn = (
    <TitleCap.Provider value={title == null ? null : cap}>
      <HeldStandIn held={held} onSignOut={onSignOut} />
    </TitleCap.Provider>
  );

  if (shell.layout === 'landscape')
    return (
      <Landscape column={null} search={search}>
        <View style={styles.heldSide}>
          <View style={styles.heldSideTop}>
            {title != null && <View style={styles.grow}>{title}</View>}
            <Bell tell={shell.tell} />
          </View>
          {standIn}
        </View>
      </Landscape>
    );

  if (shell.layout === 'portrait')
    return (
      <View style={styles.page}>
        <HeldPortraitTop search={search}>
          {back != null && (
            <View style={styles.heldBack}>
              <Back onPress={back} testID="settings.held.back" />
            </View>
          )}
          {title}
        </HeldPortraitTop>
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
        <View style={styles.heldRows}>
          {back != null ? (
            <>
              <View style={styles.orgRow}>
                <OrgPill />
              </View>
              <View style={styles.orgRow}>
                <Back onPress={back} testID="settings.held.back" />
                <View style={styles.grow} />
                <Bell tell={shell.tell} />
              </View>
            </>
          ) : (
            <View style={styles.orgRow}>
              <OrgPill />
              <View style={styles.grow} />
              {search ? (
                <SearchAndBell tell={shell.tell} role={shell.looking.role} />
              ) : (
                <Bell tell={shell.tell} />
              )}
            </View>
          )}
          {title != null && (
            <View style={styles.titleRow}>
              <View style={styles.grow}>{title}</View>
            </View>
          )}
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
  const { t } = useTranslation();
  const list = useDemoList(true, shell.open, onSignOut, onDemo);
  const fromNone = useWayBackToNone();

  return (
    <SettingsListBody
      size="column"
      {...list}
      top={
        <>
          {fromNone != null && (
            <View style={styles.columnBack}>
              <Back
                label={t('noOrganisation.wayBack')}
                onPress={fromNone}
                testID="settings.fromNone.back"
              />
            </View>
          )}
          <View style={styles.columnTop}>
            <Text
              size={TOP_TITLE}
              weight="bold"
              accessibilityRole="header"
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[styles.grow, topTitle]}
            >
              {t('settings.title')}
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
  heldPhone: { flex: 1 },
  // The pill and the bell at the header's edge; the stand-in keeps its own, as in the product (sc-85022).
  heldRows: { paddingHorizontal: tokens.spaceXxl },
  heldUpright: { flex: 1 },
  // Upright, ‹ sits in the top's band, on the pill's, the bell's and the card's 28pt edge (sc-85022).
  heldBack: { flexDirection: 'row' },
  heldSide: { flex: 1 },
  // The product's side header, 30pt in: overdue's title then the bell, or paused's bell alone at the content's top right (sc-83881, sc-85006, sc-85022).
  heldSideTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tokens.spaceLg,
    paddingTop: 26,
    paddingHorizontal: 30,
    paddingBottom: tokens.spaceLg,
  },
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
  portraitBack: { flexDirection: 'row', paddingHorizontal: tokens.space5xl },
  columnBack: { flexDirection: 'row', marginBottom: tokens.spaceXs },
  portraitTitle: { paddingTop: 30, paddingBottom: 22, paddingHorizontal: tokens.spaceHair },
  switched: { marginBottom: tokens.spaceXl },
  legal: { marginTop: tokens.spaceXs },
  legalUnder: { marginTop: tokens.spaceXl },
});
