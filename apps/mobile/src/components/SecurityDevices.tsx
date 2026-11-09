import type { Ref } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { DeviceView } from '../kit/securityPage.ts';
import { tokens } from '../theme/tokens.ts';
import { LEAD_INSET, LineIcon } from './AccountCard.tsx';
import { FieldError } from './Field.tsx';
import { OpenRow, RowList, Section, TextAction } from './Summary.tsx';
import { Text } from './Text.tsx';

/** One row per sign-in, this device first, each opening in place with when and where it signed in and Sign out. */
export function DevicesSection({
  devices,
  opened,
  error,
  signOutRef,
  onBlock,
  onToggle,
  onSignOut,
  onSignOutHere,
}: {
  devices: readonly DeviceView[];
  opened: string | null;
  /** What the server said to the opened row's Sign out. */
  error: string | null;
  signOutRef: Ref<ViewInstance>;
  onBlock: (id: string, block: ViewInstance | null) => void;
  onToggle: (id: string) => void;
  onSignOut: (device: DeviceView) => void;
  onSignOutHere: () => void;
}) {
  const { t } = useTranslation();
  const ordered = [...devices].sort((a, b) => Number(b.here) - Number(a.here));

  return (
    <Section title={t('devices.title')} foot={t('devices.intro')}>
      <RowList
        items={ordered.map((device) => {
          const open = opened === device.id;

          return {
            key: device.id,
            inset: LEAD_INSET,
            selected: open,
            row: (
              <View ref={(block) => onBlock(device.id, block)} collapsable={false}>
                <OpenRow
                  title={device.name}
                  line={device.line}
                  lead={<LineIcon name={device.kind} />}
                  weight="semibold"
                  lit
                  open={open}
                  onToggle={() => onToggle(device.id)}
                  accessibilityLabel={`${device.name}. ${device.line}`}
                  testID={`security.device.${device.id}`}
                >
                  <View>
                    <Text size={14} weight="medium" style={styles.when}>
                      {device.signedIn}
                    </Text>
                    <Text size={14} weight="medium" style={styles.when}>
                      {device.expires}
                    </Text>
                  </View>
                  {device.here ? (
                    <TextAction
                      label={t('devices.signOut')}
                      glyph="signOut"
                      onPress={onSignOutHere}
                      consequence={t('security.signOutHereNote')}
                      testID="security.device.here.signOut"
                    />
                  ) : (
                    <TextAction
                      ref={signOutRef}
                      label={t('devices.signOutAsks')}
                      removes
                      onPress={() => onSignOut(device)}
                      consequence={t('devices.signInAgain')}
                      accessibilityLabel={`${t('devices.signOut')} ${device.name}`}
                      testID={`security.device.${device.id}.signOut`}
                    />
                  )}
                  {open && error != null && <FieldError message={error} />}
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
  const { t } = useTranslation();

  return (
    <View ref={blockRef} collapsable={false}>
      <TextAction
        ref={everywhereRef}
        label={t('devices.everywhere')}
        removes
        onPress={onPress}
        consequence={t('devices.everywhereHint')}
        accessibilityLabel={t('security.everywhereLabel')}
        testID="security.everywhere"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  when: { color: tokens.colorInkSecondary, fontVariant: ['tabular-nums'] },
});
