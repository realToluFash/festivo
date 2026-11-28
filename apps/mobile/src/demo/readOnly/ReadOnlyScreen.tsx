import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QuietButton } from '../../components/Buttons.tsx';
import { SheetLayer } from '../../components/FormLayers.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { Pill } from '../../components/SettingsParts.tsx';
import { Text } from '../../components/Text.tsx';
import { Title } from '../../components/Title.tsx';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import { ORGANISATION, REFUSALS, RW, type ReadOnlyState, wayPastOf } from './readOnlyRules.ts';

/** sc-3937 in the app: sc-3930's refusal, a bottom sheet on a phone and a centred dialog on a tablet, over the screen it was met on. */
export function ReadOnlyScreen({ refused, role }: ReadOnlyState) {
  const insets = useSafeAreaInsets();
  const { kind } = useLayout();
  const [open, setOpen] = useState(true);
  const [told, setTold] = useState<string | null>(null);
  const refusal = REFUSALS[refused];
  const back = () => {
    setOpen(false);
    setTold(`${refusal.back}: the work is as it was.`);
  };

  return (
    <View style={[styles.page, { paddingTop: insets.top + tokens.spaceXl }]}>
      <View style={[styles.shell, kind !== 'phone' && styles.wide]}>
        <Title size={kind === 'phone' ? 28 : 34} accessibilityRole="header">
          {refusal.on}
        </Title>
        <Text size={tokens.typeBodyPhone.size} muted>
          The screen the refusal was met on, as a shell. Nothing on it changed.
        </Text>
        <DemoOnly
          title={
            told ??
            `Read-only. Role: ${role === 'manage' ? 'billing.manage' : 'anyone else'}. The app shows no banner, and no refusal says where the payment is made.`
          }
        >
          {!open && (
            <QuietButton
              label="Show the refusal again"
              onPress={() => {
                setTold(null);
                setOpen(true);
              }}
              testID="demo.readOnly.again"
            />
          )}
          <QuietButton label="Back to the demo" onPress={goBack} testID="demo.readOnly.back" />
        </DemoOnly>
      </View>
      {open && (
        <SheetLayer label={refusal.back} alert onClose={back}>
          <View style={styles.sheet}>
            <View style={styles.titleRow}>
              <View style={styles.hard}>
                <Glyph name="x" size={14} ink={tokens.colorInk} weight={2.6} />
              </View>
              <Text size={20} weight="bold" accessibilityRole="header" style={styles.grow}>
                {RW.title(ORGANISATION)}
              </Text>
            </View>
            <View style={styles.safe}>
              <Glyph name="shield" size={16} ink={tokens.colorAccentText} weight={2.2} />
              <Text size={14.5} weight="semibold" style={[styles.grow, styles.safeInk]}>
                {refusal.safe}
              </Text>
            </View>
            <Text size={15} weight="medium">
              {wayPastOf(role) === 'inApp' ? RW.inApp : RW.ask}
            </Text>
            <Pill
              label={refusal.back}
              kind="secondary"
              height={tokens.sizeHitPhonePrimary}
              onPress={back}
              testID="demo.readOnly.wayBack"
            />
          </View>
        </SheetLayer>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorCard },
  shell: { gap: tokens.spaceLg, paddingHorizontal: tokens.spaceXxl },
  wide: { paddingHorizontal: tokens.space5xl },
  sheet: { gap: 14, paddingHorizontal: tokens.spaceXxl, paddingTop: 22, paddingBottom: 34 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  hard: {
    width: 24,
    height: 24,
    marginTop: 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInset,
  },
  grow: { flex: 1, minWidth: 0 },
  safe: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: tokens.colorAccentTint,
  },
  safeInk: { color: tokens.colorAccentText },
});
