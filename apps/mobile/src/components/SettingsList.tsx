import { primaryEmailAddress } from '@soirely/api-client';
import { router } from 'expo-router';
import { Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  DESTINATION_HREF,
  SECTION_HREF,
  type SettingsSection,
  settingsGroups,
} from '../kit/appNav.ts';
import { type LayoutKind, useLayout } from '../layout/useLayout.ts';
import { signOutHere, useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { Text } from './Text.tsx';

const LIST_WIDTH = 320;

/** The section keeps its place in the tree on every layout, so a rotation keeps what was typed. */
export function SettingsSplit({
  open,
  children,
}: {
  open: SettingsSection | null;
  children: ReactNode;
}) {
  const { kind } = useLayout();

  return (
    <View style={[styles.fill, kind !== 'phone' && styles.row]}>
      {kind !== 'phone' && <SettingsList kind={kind} open={open} />}
      <View style={styles.fill}>{children}</View>
    </View>
  );
}

export function SettingsList({ kind, open }: { kind: LayoutKind; open: SettingsSection | null }) {
  const { t } = useTranslation();
  const { account, organisation } = useSignedIn();
  const phone = kind === 'phone';
  const line: Record<SettingsSection, string> = {
    account: t('settings.accountLine'),
    security: t('settings.securityLine'),
    organisation: t('settings.organisationLine', { name: organisation?.name ?? '' }),
    members: t('settings.membersLine', { name: organisation?.name ?? '' }),
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
      <View key={section}>
        {phone && index > 0 && <View style={styles.divider} />}
        <Pressable
          style={[
            styles.section,
            !phone && styles.sectionTablet,
            open === section && styles.sectionOpen,
          ]}
          onPress={() =>
            phone ? router.push(SECTION_HREF[section]) : router.replace(SECTION_HREF[section])
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
        <Text size={tokens.typeBody.size} muted>
          {t('settings.signedInAs', { email: primaryEmailAddress(account) ?? '' })}
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
    <View style={styles.tabletList} accessibilityLabel={t('settings.sections')}>
      {groups.map(({ key, heading, rows }) => (
        <Fragment key={key}>
          {heading}
          {rows}
        </Fragment>
      ))}
      <View style={styles.fill} />
      {signOut}
    </View>
  );
}

/** On a phone a section opens over the list, so its way back is to Settings. */
export function backToSettings(label: string) {
  return {
    label,
    onPress: () => (router.canGoBack() ? router.back() : router.replace(DESTINATION_HREF.settings)),
  };
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
  label: { paddingHorizontal: tokens.spaceXxs, letterSpacing: 1.2, textTransform: 'uppercase' },
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
    height: tokens.sizeHitPhonePrimary,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.sizeHitPhonePrimary / 2,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    backgroundColor: tokens.colorCard,
  },
  signOutDense: { height: tokens.sizeHit, borderRadius: tokens.sizeHit / 2 },
  tabletList: {
    width: LIST_WIDTH,
    gap: tokens.spaceXs,
    paddingVertical: tokens.spaceXl,
    paddingHorizontal: tokens.spaceLg,
    backgroundColor: tokens.colorCard,
    borderRightWidth: 1,
    borderRightColor: tokens.colorBorder,
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
