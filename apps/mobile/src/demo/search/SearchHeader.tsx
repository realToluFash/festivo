import { type Href, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Bell } from '../../components/BellButton.tsx';
import { PillRow } from '../../components/ListTop.tsx';
import { OrgPill } from '../../components/OrgPill.tsx';
import { RoundButton } from '../../components/SettingsParts.tsx';
import { Text } from '../../components/Text.tsx';
import { Toast } from '../../components/Toast.tsx';
import { useLayout } from '../../layout/useLayout.ts';
import { tokens } from '../../theme/tokens.ts';
import { SAMPLE } from '../samples.ts';
import { SEARCH_WORDS as W, searchHref } from './searchRules.ts';

export function openSearch(role: string | null = null): void {
  router.push(searchHref(role) as Href);
}

/** The 44 search button the header gains, left of the bell. */
export function SearchButton() {
  return (
    <RoundButton
      glyph="search"
      label={W.search}
      onPress={() => openSearch()}
      testID="demo.search.open"
    />
  );
}

/** The top of Today, Events, Calendar and Settings on a phone or an upright iPad, as Search proposes it: the pill, then Search and the bell. */
export function SearchHeaderScreen() {
  const insets = useSafeAreaInsets();
  const { kind } = useLayout();
  const [told, setTold] = useState<string | null>(null);
  const tell = setTold;

  return (
    <View
      style={[
        styles.screen,
        kind !== 'phone' && styles.tablet,
        { paddingTop: insets.top + tokens.spaceMd },
      ]}
    >
      <PillRow
        pill={
          <OrgPill
            id="org-ire"
            name={SAMPLE.organisation}
            waiting={null}
            label={`${SAMPLE.organisation}. Switch organisation`}
            onPress={() => tell('Switching organisation has its own design.')}
          />
        }
        bell={
          <View style={styles.ends}>
            <SearchButton />
            <Bell unread={3} onPress={() => tell('Notifications have their own design.')} />
          </View>
        }
      />
      <Text size={34} weight="bold" accessibilityRole="header" style={styles.title}>
        Events
      </Text>
      {told != null && (
        <View style={[styles.toast, { bottom: insets.bottom + tokens.spaceXl }]}>
          <Toast key={told} words={told} onClose={() => setTold(null)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colorCard, paddingHorizontal: tokens.spaceXl },
  tablet: { paddingHorizontal: tokens.space3xl },
  ends: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  title: { letterSpacing: -0.5 },
  toast: { position: 'absolute', left: tokens.spaceXl, right: tokens.spaceXl },
});
