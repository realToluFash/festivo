import { primaryEmailAddress } from '@soirely/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { Fragment, type ReactNode, useRef } from 'react';
import {
  type LayoutRectangle,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  DESTINATION_HREF,
  SECTION_HREF,
  type SettingsSection,
  settingsGroups,
} from '../kit/appNav.ts';
import { OPENED_IN_PLACE_OF_SETTINGS, sectionTakesBack } from '../kit/systemBack.ts';
import { breakableEmail } from '../layout/textSize.ts';
import {
  type LayoutKind,
  SETTINGS_LIST_WIDTH,
  useLayout,
  useSideListWidth,
} from '../layout/useLayout.ts';
import { signOutHere, useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { tracking } from '../theme/tracking.ts';
import { Text } from './Text.tsx';

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

  return (
    <View style={[styles.fill, kind !== 'phone' && styles.row]}>
      {kind !== 'phone' && !givesWay && <SettingsList kind={kind} open={open} />}
      <View style={styles.fill}>{children}</View>
    </View>
  );
}

export function SettingsList({ kind, open }: { kind: LayoutKind; open: SettingsSection | null }) {
  const { t } = useTranslation();
  const { account, organisation } = useSignedIn();
  const width = useSideListWidth(SETTINGS_LIST_WIDTH);
  const phone = kind === 'phone';
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
  const line: Record<SettingsSection, string> = {
    account: t('settings.accountLine'),
    security: t('settings.securityLine'),
    notifications: t('settings.notificationsLine'),
    organisation: t('settings.organisationLine', { name: organisation?.name ?? '' }),
    members: t('settings.membersLine', { name: organisation?.name ?? '' }),
    roles: t('settings.rolesLine', { name: organisation?.name ?? '' }),
    signInRules: t('settings.signInRulesLine', { name: organisation?.name ?? '' }),
  };
  const groups = settingsGroups(organisation).map(({ heading, sections }, group) => ({
    heading: (
      <Text
        size={tokens.typeLabel.size}
        weight="semibold"
        muted
        accessibilityRole="header"
        style={[
          styles.label,
          !phone && styles.labelTablet,
          !phone && group > 0 && styles.labelLater,
        ]}
      >
        {t(`settings.${heading}`)}
      </Text>
    ),
    key: heading,
    rows: sections.map((section, index) => (
      <View
        key={section}
        onLayout={
          !phone && open === section
            ? (event) => reveal({ row: event.nativeEvent.layout })
            : undefined
        }
      >
        {phone && index > 0 && <View style={styles.divider} />}
        <Pressable
          style={[
            styles.section,
            !phone && styles.sectionTablet,
            open === section && styles.sectionOpen,
          ]}
          onPress={() =>
            phone
              ? router.push(SECTION_HREF[section])
              : router.replace({
                  pathname: SECTION_HREF[section],
                  params: { from: OPENED_IN_PLACE_OF_SETTINGS },
                })
          }
          accessibilityRole="button"
          accessibilityState={{ selected: open === section }}
          testID={`settings.${section}`}
        >
          <View style={styles.fill}>
            <Text size={tokens.typeTitleSection.size} weight="semibold">
              {t(`settings.${section}`)}
            </Text>
            <Text size={tokens.typeBody.size} muted>
              {line[section]}
            </Text>
          </View>
          <Text
            size={tokens.typeTitleDialog.size}
            muted
            accessibilityElementsHidden
            importantForAccessibility="no"
            accessible={false}
          >
            ›
          </Text>
        </Pressable>
      </View>
    )),
  }));
  const signOut = (
    <View style={[styles.foot, !phone && styles.footTablet]}>
      {kind !== 'tabletLandscape' && account != null && (
        <Text
          size={tokens.typeBody.size}
          muted
          accessibilityLabel={t('settings.signedInAs', {
            email: primaryEmailAddress(account) ?? '',
          })}
        >
          {t('settings.signedInAs', { email: breakableEmail(primaryEmailAddress(account) ?? '') })}
        </Text>
      )}
      <Pressable
        style={[styles.signOut, kind === 'tabletLandscape' && styles.signOutDense]}
        onPress={signOutHere}
        accessibilityRole="button"
        testID="settings.signOut"
      >
        <Text size={tokens.typeBodyPhone.size} weight="semibold">
          {t('settings.signOut')}
        </Text>
      </Pressable>
    </View>
  );

  if (phone) {
    return (
      <View style={styles.phoneList}>
        {groups.map(({ key, heading, rows }) => (
          <Fragment key={key}>
            {heading}
            <View style={styles.card}>{rows}</View>
          </Fragment>
        ))}
        {signOut}
      </View>
    );
  }

  return (
    <ScrollView
      ref={scroll}
      style={[styles.tabletList, { width }]}
      contentContainerStyle={styles.tabletLines}
      onLayout={(event) => reveal({ viewport: event.nativeEvent.layout.height })}
    >
      {groups.map(({ key, heading, rows }) => (
        <Fragment key={key}>
          {heading}
          {rows}
        </Fragment>
      ))}
      <View style={styles.fill} />
      {signOut}
    </ScrollView>
  );
}

// A tablet opens a section in place of the last, so a window shrunk to a phone may have no Settings under it, for the header's back or Android's (sc-19104).
export function useBackToSettings() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  const systemBack = sectionTakesBack(from);

  return (label: string) => ({
    label,
    onPress: () => router.dismissTo(DESTINATION_HREF.settings),
    systemBack,
  });
}

/** What a tablet shows beside the list before a section is chosen. */
export function ChooseSection() {
  const { t } = useTranslation();
  const { organisation } = useSignedIn();

  return (
    <View style={styles.choose}>
      <Text size={tokens.typeTitleSection.size} weight="semibold">
        {t('settings.choose')}
      </Text>
      <Text size={tokens.typeBodyPhone.size} muted style={styles.center}>
        {organisation == null
          ? t('settings.chooseLine')
          : t('settings.chooseLineWithOrganisation', { name: organisation.name })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row' },
  center: { textAlign: 'center' },
  phoneList: { gap: tokens.spaceLg },
  label: {
    paddingHorizontal: tokens.spaceXxs,
    letterSpacing: tracking(tokens.typeLabel),
    textTransform: 'uppercase',
  },
  labelTablet: { paddingHorizontal: 14, paddingVertical: tokens.spaceXxs },
  labelLater: { paddingTop: tokens.spaceLg },
  card: {
    overflow: 'hidden',
    borderRadius: tokens.radiusCardPhone,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  divider: {
    height: 1,
    marginHorizontal: tokens.spaceXl,
    backgroundColor: tokens.colorInsetBorder,
  },
  section: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingVertical: tokens.spaceMd,
    paddingHorizontal: tokens.spaceXl,
  },
  sectionTablet: {
    paddingVertical: tokens.spaceSm,
    paddingHorizontal: 14,
    borderRadius: tokens.radiusField,
  },
  sectionOpen: { backgroundColor: tokens.colorNeutralFill },
  foot: { gap: tokens.spaceSm, paddingTop: tokens.spaceSm, paddingHorizontal: tokens.spaceXxs },
  footTablet: { paddingTop: 0, paddingHorizontal: tokens.spaceHair },
  signOut: {
    minHeight: tokens.sizeHitPhonePrimary,
    paddingVertical: tokens.spaceXxs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.sizeHitPhonePrimary / 2,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    backgroundColor: tokens.colorCard,
  },
  signOutDense: { minHeight: tokens.sizeHit, borderRadius: tokens.sizeHit / 2 },
  tabletList: {
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: tokens.colorCard,
    borderRightWidth: 1,
    borderRightColor: tokens.colorBorder,
  },
  // A short list still reaches the foot, so signing out sits at the bottom until the list outgrows the screen.
  tabletLines: {
    flexGrow: 1,
    gap: tokens.spaceXs,
    paddingVertical: tokens.spaceXl,
    paddingHorizontal: tokens.spaceLg,
  },
  choose: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spaceSm,
    paddingVertical: tokens.space6xl,
    paddingHorizontal: tokens.spaceXl,
  },
});
