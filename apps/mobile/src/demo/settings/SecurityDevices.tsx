import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { type Ref, useMemo } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { LEAD_INSET, LineIcon } from './AccountCard.tsx';
import { deviceExpires, deviceLine, deviceSignedIn, WORDS } from './SecurityModel.ts';
import type { Device } from './SecuritySample.ts';
import { OpenRow, RowList, Section, TextAction } from '../../components/Summary.tsx';

/** One row per sign-in, this device first, each opening in place with when and where it signed in and Sign out. */
export function DevicesSection({
  devices,
  opened,
  signOutRef,
  onBlock,
  onToggle,
  onSignOut,
  onSignOutHere,
}: {
  devices: readonly Device[];
  opened: string | null;
  signOutRef: Ref<ViewInstance>;
  onBlock: (id: string, block: ViewInstance | null) => void;
  onToggle: (id: string) => void;
  onSignOut: (device: Device) => void;
  onSignOutHere: () => void;
}) {
  const locale = useMemo(() => formattingLocale('en', getLocales()[0]?.languageTag), []);
  const ordered = [...devices].sort((a, b) => Number(b.here) - Number(a.here));

  return (
    <Section title={WORDS.signedInOn} foot={WORDS.devicesFoot}>
      <RowList
        items={ordered.map((device) => {
          const line = deviceLine(device, locale);
          const open = opened === device.id;

          return {
            key: device.id,
            inset: LEAD_INSET,
            selected: open,
            row: (
              <View ref={(block) => onBlock(device.id, block)} collapsable={false}>
                <OpenRow
                  title={device.name}
                  line={line}
                  lead={<LineIcon name={device.kind} />}
                  weight="semibold"
                  lit
                  open={open}
                  onToggle={() => onToggle(device.id)}
                  accessibilityLabel={`${device.name}. ${line}`}
                  testID={`security.device.${device.id}`}
                >
                  <View>
                    <Text size={14} weight="medium" style={styles.when}>
                      {deviceSignedIn(device, locale)}
                    </Text>
                    <Text size={14} weight="medium" style={styles.when}>
                      {deviceExpires(device, locale)}
                    </Text>
                  </View>
                  {device.here ? (
                    <TextAction
                      label={WORDS.signOut}
                      glyph="signOut"
                      onPress={onSignOutHere}
                      consequence={WORDS.signOutHereNote}
                      testID="security.device.here.signOut"
                    />
                  ) : (
                    <TextAction
                      ref={signOutRef}
                      label={WORDS.signOutAsking}
                      removes
                      onPress={() => onSignOut(device)}
                      consequence={WORDS.signOutNote}
                      accessibilityLabel={`${WORDS.signOut} ${device.name}`}
                      testID={`security.device.${device.id}.signOut`}
                    />
                  )}
                </OpenRow>
              </View>
            ),
          };
        })}
      />
    </Section>
  );
}

/** Red text at the end of the page, while another device is signed in. */
export function Everywhere({
  everywhereRef,
  blockRef,
  onPress,
}: {
  everywhereRef: Ref<ViewInstance>;
  blockRef: Ref<ViewInstance>;
  onPress: () => void;
}) {
  return (
    <View ref={blockRef} collapsable={false}>
      <TextAction
        ref={everywhereRef}
        label={WORDS.everywhere}
        removes
        onPress={onPress}
        consequence={WORDS.everywhereNote}
        accessibilityLabel="Sign out everywhere else"
        testID="security.everywhere"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  when: { color: tokens.colorInkSecondary, fontVariant: ['tabular-nums'] },
});
