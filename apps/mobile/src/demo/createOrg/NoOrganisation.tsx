import { router } from 'expo-router';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '../../components/Brand.tsx';
import { Text } from '../../components/Text.tsx';
import type { Tell } from '../../components/TodayParts.tsx';
import { useLayout } from '../../layout/useLayout.ts';
import { tokens } from '../../theme/tokens.ts';
import { useStartWalk } from '../OrgSwitcher.tsx';
import { VIEWER } from '../OrgSwitcherModel.ts';
import { DraftTile } from '../../components/DraftTile.tsx';
import { Pill } from '../../components/SettingsParts.tsx';
import { TextAction } from '../../components/SummaryRows.tsx';

const COLUMN = 560;

/** Main's NoOrganisation, its words and order, in B's parts: no tab bar and no switcher, as nothing here belongs to an organisation. */
export function NoOrganisation({ tell }: { tell: Tell }) {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const insets = useSafeAreaInsets();
  const start = useRef<ViewInstance>(null);
  const startWalk = useStartWalk(start);
  const email = VIEWER.email;
  const phone = kind === 'phone';

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + (phone ? tokens.spaceXxl : 60),
          paddingBottom: insets.bottom + tokens.space3xl,
        },
      ]}
      testID="noOrganisation"
    >
      {!phone && (
        <View style={styles.corner}>
          <Brand lockup height={24} />
        </View>
      )}
      <View style={[styles.column, !phone && styles.columnWide]}>
        {phone && <Brand lockup height={24} />}
        <Text size={28} weight="bold" accessibilityRole="header" style={styles.title}>
          {t('noOrganisation.title')}
        </Text>
        <Text size={16} weight="medium" style={styles.body}>
          {t('noOrganisation.body')}
        </Text>
        <Text size={16} weight="medium" muted style={styles.body}>
          {t('noOrganisation.wayOn', { email })}
        </Text>
        <View style={styles.own}>
          <DraftTile name="" side={48} radius={16} initials={18} />
          <View style={styles.ownWords}>
            <Text size={20} weight="bold" accessibilityRole="header" style={styles.ownTitle}>
              {t('noOrganisation.startTitle')}
            </Text>
            <Text size={15} weight="medium" muted style={styles.ownBody}>
              {t('noOrganisation.startBody')}
            </Text>
          </View>
          <Pill
            ref={start}
            label={t('noOrganisation.start')}
            onPress={startWalk}
            testID="noOrganisation.start"
          />
        </View>
        <View style={styles.signedIn}>
          <Text size={14} weight="medium" muted style={styles.ownBody}>
            {t('noOrganisation.signedInAs', { email })}
          </Text>
          <View style={styles.ways}>
            <TextAction
              label={t('noOrganisation.account')}
              onPress={() => router.push('/demo/settings/account')}
              testID="noOrganisation.account"
            />
            <TextAction
              label={t('settings.signOut')}
              onPress={() => tell('Sign out has its own design.')}
              testID="noOrganisation.signOut"
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  content: { flexGrow: 1, alignItems: 'center', paddingHorizontal: tokens.spaceXxl },
  column: { alignSelf: 'stretch', maxWidth: '100%', gap: tokens.spaceXl },
  columnWide: { alignSelf: 'center', width: COLUMN },
  corner: { alignSelf: 'flex-start', marginBottom: tokens.space3xl },
  title: { lineHeight: 28 * 1.15, letterSpacing: 28 * -0.02, marginTop: tokens.spaceSm },
  body: { lineHeight: 16 * 1.45 },
  own: {
    gap: tokens.spaceLg,
    padding: tokens.spaceXxl,
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorAccentTint,
  },
  ownWords: { gap: tokens.spaceXs },
  ownTitle: { lineHeight: 20 * 1.25 },
  ownBody: { lineHeight: 15 * 1.4 },
  signedIn: { gap: tokens.spaceXxs },
  ways: { flexDirection: 'row', flexWrap: 'wrap', columnGap: tokens.space3xl },
});
