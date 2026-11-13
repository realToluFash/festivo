import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Screen } from '../src/components/Screen.tsx';
import { Text } from '../src/components/Text.tsx';
import { useLayout } from '../src/layout/useLayout.ts';

/**
 * REMOVABLE. Delete this file and the link to it in app/index.tsx.
 *
 * It exists because the three layouts are the thing most often retrofitted and
 * most expensive to retrofit: a product built phone-only grows tablet support
 * as a set of width conditions sprinkled through screens that were never
 * designed for the space. Having all three branches render from day one means
 * the next screen is written against a pattern rather than inventing one.
 *
 * The three are STRUCTURALLY different, not one layout rescaled — which is the
 * whole point. Landscape earns a persistent detail pane; portrait stacks the
 * detail below the list; the phone shows one at a time.
 */
const ITEMS = ['Reception', 'Dinner', 'Speeches', 'Dancing'];

export default function Layouts() {
  const { t } = useTranslation();
  const { kind, width, height } = useLayout();
  const router = useRouter();

  return (
    <Screen scroll={kind === 'phone'}>
      <Pressable onPress={() => router.back()} accessibilityRole="button">
        <Text weight="medium">← {t('app.name')}</Text>
      </Pressable>

      <Text size={28} weight="bold">
        {t('layouts.title')}
      </Text>
      <Text muted>{t('layouts.intro')}</Text>

      <View style={styles.panel}>
        <View style={styles.row}>
          <Text muted>{t('layouts.kind')}</Text>
          <Text weight="medium">{kind}</Text>
        </View>
        <View style={styles.row}>
          <Text muted>{t('layouts.size')}</Text>
          <Text>{`${Math.round(width)} × ${Math.round(height)}`}</Text>
        </View>
        <Text size={14} muted>
          {t(`layouts.${kind}`)}
        </Text>
      </View>

      {kind === 'tabletLandscape' ? (
        <Landscape />
      ) : kind === 'tabletPortrait' ? (
        <Portrait />
      ) : (
        <Phone />
      )}
    </Screen>
  );
}

/** One column, and the controls within a thumb's reach of the bottom. */
function Phone() {
  const { t } = useTranslation();

  return (
    <View style={styles.stack}>
      <Pane title={t('layouts.listPane')} />
      <Text size={14} muted>
        {t('layouts.itemCount', { count: ITEMS.length })}
      </Text>
    </View>
  );
}

/** Two columns, with the detail beneath rather than beside. */
function Portrait() {
  const { t } = useTranslation();

  return (
    <View style={styles.stack}>
      <View style={styles.twoUp}>
        <Pane title={t('layouts.listPane')} />
        <Pane title={t('layouts.listPane')} />
      </View>
      <Pane title={t('layouts.detailPane')} />
    </View>
  );
}

/** A list beside a pane that stays put — the structure portrait cannot have. */
function Landscape() {
  const { t } = useTranslation();

  return (
    <View style={styles.sideBySide}>
      <View style={styles.listColumn}>
        <Pane title={t('layouts.listPane')} />
      </View>
      <View style={styles.detailColumn}>
        <Pane title={t('layouts.detailPane')} />
      </View>
    </View>
  );
}

function Pane({ title }: { title: string }) {
  const { t } = useTranslation();

  return (
    <View style={[styles.panel, styles.pane]}>
      <Text weight="medium">{title}</Text>
      {ITEMS.map((item) => (
        <Text key={item} muted>
          {item}
        </Text>
      ))}
      <Text size={14} muted>
        {t('layouts.itemCount', { count: ITEMS.length })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 16, gap: 8 },
  pane: { flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  stack: { gap: 16 },
  twoUp: { flexDirection: 'row', gap: 16 },
  sideBySide: { flexDirection: 'row', gap: 16, flex: 1, minHeight: 240 },
  listColumn: { flex: 2 },
  detailColumn: { flex: 3 },
});
