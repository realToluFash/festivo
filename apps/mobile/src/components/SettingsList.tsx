import { primaryEmailAddress } from '@soirely/api-client';
import { initials, roleName } from '@soirely/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useRef } from 'react';
import {
  type LayoutRectangle,
  ScrollView,
  type ScrollViewInstance,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  DESTINATION_HREF,
  SECTION_HREF,
  type SettingsSection,
  settingsGroups,
} from '../kit/appNav.ts';
import { OPENED_IN_PLACE_OF_SETTINGS, sectionTakesBack } from '../kit/systemBack.ts';
import { demoHere } from '../demo/DemoEntry.tsx';
import { SettingsDemoRow } from '../demo/settings/SettingsDemoRow.tsx';
import {
  type LayoutKind,
  SETTINGS_LIST_WIDTH,
  settingsListBeside,
  useLayout,
  useSideListWidth,
} from '../layout/useLayout.ts';
import { signOutHere, useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { FrameTop } from './AppFrame.tsx';
import { SETTINGS_COLUMN } from './listFrame.ts';
import { Caps } from './SettingsParts.tsx';
import {
  type ListedSection,
  PersonCard,
  type SettingsPerson,
  type SettingsRow,
  SettingsGroup,
  SettingsSignOut,
  rowSide,
  settingsHomeStyles,
  useSectionRows,
} from './SettingsHome.tsx';

/** The section keeps its place in the tree on every layout, so a rotation keeps what was typed. */
export function SettingsSplit({
  open,
  givesWay = false,
  children,
}: {
  open: SettingsSection | null;
  /** The section's own list takes the Settings list's place. */
  givesWay?: boolean;
  children: ReactNode;
}) {
  const { kind } = useLayout();
  const beside = settingsListBeside(kind);

  return (
    <View style={[styles.fill, beside && styles.row]}>
      {beside && !givesWay && <SettingsList kind={kind} open={open} />}
      <View style={styles.fill}>{children}</View>
    </View>
  );
}

export function SettingsList({ kind, open }: { kind: LayoutKind; open: SettingsSection | null }) {
  const { t } = useTranslation();
  const { account, organisation } = useSignedIn();
  const width = useSideListWidth(SETTINGS_LIST_WIDTH);
  const alone = !settingsListBeside(kind);
  const size = kind === 'phone' ? 'phone' : alone ? 'portrait' : 'column';
  const rowOf = useSectionRows(organisation?.name ?? null);
  const person: SettingsPerson = {
    name: account?.name ?? '',
    initials: initials(account?.name ?? ''),
    email: account == null ? '' : (primaryEmailAddress(account) ?? ''),
    role: organisation == null ? null : roleName(t, organisation.role),
    organisation: organisation?.name ?? null,
  };
  const go = (section: SettingsSection) => {
    if (open === section) return;
    if (alone) router.push(SECTION_HREF[section]);
    else
      router.replace({
        pathname: SECTION_HREF[section],
        params: { from: OPENED_IN_PLACE_OF_SETTINGS },
      });
  };
  const groups = settingsGroups(organisation).map(({ heading, sections }) => ({
    heading: t(`settings.${heading}`),
    rows: sections
      .filter((section): section is ListedSection => section !== 'account')
      .map((section) => rowOf(section, rowSide(size === 'column'))),
  }));

  return (
    <SettingsListBody
      size={size}
      groups={groups}
      open={open}
      onOpen={(key) => go(key as SettingsSection)}
      renderCard={(cardSize) => (
        <PersonCard
          person={person}
          size={cardSize}
          open={open === 'account'}
          onPress={() => go('account')}
        />
      )}
      renderFoot={(height) => (
        <>
          {demoHere() && (
            <SettingsDemoRow dense={size === 'column'} onDemo={() => router.push('/demo')} />
          )}
          <SettingsSignOut height={height} onSignOut={signOutHere} />
        </>
      )}
      top={<FrameTop rowStyle={styles.columnTop} />}
      columnStyle={[styles.tabletList, { width }]}
    />
  );
}

export interface SettingsListGroup {
  heading: string;
  rows: readonly SettingsRow[];
}

/** The Settings list under its title, one copy for the app and its demo: your card, the groups and the foot; upright your account's group beside the organisation's, on its side a column that scrolls on its own. */
export function SettingsListBody({
  size,
  groups,
  open,
  onOpen,
  renderCard,
  renderFoot,
  under,
  top,
  columnStyle,
}: {
  size: 'phone' | 'portrait' | 'column';
  groups: readonly SettingsListGroup[];
  open: string | null;
  onOpen: (key: string) => void;
  renderCard: (size: 'phone' | 'portrait' | 'column') => ReactNode;
  /** Upright with two columns, `beside` is true: what goes under the foot alone goes under both instead. */
  renderFoot: (height: number, beside: boolean) => ReactNode;
  /** Under both columns upright, as the demo's Terms · Privacy. */
  under?: ReactNode;
  /** The column's title row on its side. */
  top?: ReactNode;
  columnStyle?: StyleProp<ViewStyle>;
}) {
  const dense = size === 'column';
  const scroll = useRef<ScrollViewInstance>(null);
  // Each section mounts the list afresh at its top, so the open row is brought into view once.
  const seen = useRef<{ viewport?: number; row?: LayoutRectangle; revealed?: boolean }>({});
  const reveal = (next: { viewport?: number; row?: LayoutRectangle }) => {
    seen.current = { ...seen.current, ...next };
    const { viewport, row, revealed } = seen.current;
    if (viewport == null || row == null || revealed === true) return;
    seen.current.revealed = true;
    if (row.y + row.height > viewport) {
      scroll.current?.scrollTo({
        y: row.y + row.height - viewport + tokens.spaceXl,
        animated: false,
      });
    }
  };
  const group = ({ heading, rows }: SettingsListGroup, headingTop: number) =>
    rows.length === 0 ? null : (
      <View
        key={heading}
        onLayout={
          dense && rows.some((row) => row.key === open)
            ? (event) => reveal({ row: event.nativeEvent.layout })
            : undefined
        }
      >
        <Caps text={heading} top={headingTop} />
        <SettingsGroup rows={rows} dense={dense} open={open} onOpen={onOpen} />
      </View>
    );

  if (size === 'phone')
    return (
      <View>
        {renderCard('phone')}
        {groups.map((each) => group(each, 26))}
        <View style={settingsHomeStyles.footPhone}>
          {renderFoot(tokens.sizeHitPhoneHero, false)}
        </View>
      </View>
    );

  if (size === 'portrait') {
    const [yours, theirs] = groups;
    const beside = theirs != null;
    const left = (
      <>
        {yours != null && group(yours, tokens.space4xl)}
        <View style={settingsHomeStyles.footPhone}>
          {renderFoot(tokens.sizeHitPhoneHero, beside)}
        </View>
      </>
    );

    return (
      <View>
        {renderCard('portrait')}
        {theirs == null ? (
          <View style={settingsHomeStyles.single}>{left}</View>
        ) : (
          <>
            <View style={settingsHomeStyles.columns}>
              <View style={styles.fill}>{left}</View>
              <View style={styles.fill}>{group(theirs, tokens.space4xl)}</View>
            </View>
            {under}
          </>
        )}
      </View>
    );
  }

  return (
    <ScrollView
      ref={scroll}
      style={columnStyle}
      contentContainerStyle={settingsHomeStyles.column}
      onLayout={(event) => reveal({ viewport: event.nativeEvent.layout.height })}
      showsVerticalScrollIndicator={false}
    >
      {top}
      {renderCard('column')}
      {groups.map((each, index) => group(each, index === 0 ? tokens.spaceXxl : tokens.spaceXl))}
      <View style={settingsHomeStyles.footColumn}>{renderFoot(tokens.sizeHit, false)}</View>
    </ScrollView>
  );
}

// A tablet on its side opens a section in place of the last, so a window shrunk to a phone or turned upright may have no Settings under it, for the header's back or Android's (sc-19104).
export function useBackToSettings() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const systemBack = sectionTakesBack(from);

  return (label: string) => ({
    label,
    onPress: () => router.dismissTo(DESTINATION_HREF.settings),
    systemBack,
    pill: true,
  });
}

const styles = StyleSheet.create({
  fill: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row' },
  columnTop: { minHeight: tokens.sizeHit, marginBottom: tokens.spaceLg },
  tabletList: {
    flexGrow: 0,
    flexShrink: 0,
    ...SETTINGS_COLUMN,
  },
});
