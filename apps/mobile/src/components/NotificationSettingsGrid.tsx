import { quietHoursIn, settingRows, usageThresholdsIn } from '@soirely/domain';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { followPushBlocked } from '../appPush.ts';
import { currentLocale } from '../i18n/index.ts';
import {
  type Channel,
  type SettingsGrid,
  isSaving,
  readSettings,
  saveSetting,
  settingSaving,
} from '../kit/notificationSettings.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { Notice } from './Notice.tsx';
import { OnOffSwitch } from './OnOffSwitch.tsx';
import { useReadOut } from './ReadOut.tsx';
import { Text } from './Text.tsx';
import { cardFrame } from './cardFrame.ts';

const CHANNELS: readonly Channel[] = ['push', 'email'];

/** `NotificationSettings-*` (sc-3980): six categories against Push and Email, each switch saved as it changes. */
export function NotificationSettingsGrid({ kind }: { kind: LayoutKind }) {
  const { t } = useTranslation();
  const [grid, setGrid] = useState<SettingsGrid>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [tap, setTap] = useState<object | undefined>(undefined);
  const [blocked, setBlocked] = useState(false);
  const locale = currentLocale();

  useEffect(() => {
    let current = true;
    void readSettings(api).then((read) => {
      if (current) setGrid(read);
    });

    return () => {
      current = false;
    };
  }, [attempt]);

  useEffect(() => followPushBlocked(setBlocked), []);

  useReadOut(grid.status === 'loaded' && grid.saved ? t('notificationSettings.saved') : null, {
    answer: tap,
  });

  if (grid.status === 'loading') return null;

  if (grid.status === 'failed') {
    return (
      <Notice
        tone="broken"
        mark={tokens.marks.broken.glyph}
        body={t('notificationSettings.couldNotLoad')}
        announce
        action={{
          label: t('notificationSettings.tryAgain'),
          onPress: () => {
            setGrid({ status: 'loading' });
            setAttempt((tries) => tries + 1);
          },
          testID: 'notificationSettings.tryAgain',
        }}
      />
    );
  }

  const change = (
    category: (typeof grid.settings)[number]['category'],
    channel: Channel,
    on: boolean,
  ): void => {
    setGrid((current) => settingSaving(current, category, channel, on));
    void saveSetting(api, category, channel, on).then((apply) => {
      setGrid(apply);
      setTap({});
    });
  };

  return (
    <View style={cardFrame(kind)} testID="notificationSettings">
      {blocked && (
        <Text
          size={tokens.typeBody.size}
          accessibilityRole="text"
          testID="notificationSettings.pushBlocked"
        >
          {t('notificationSettings.pushBlocked')}
        </Text>
      )}
      <View
        style={styles.row}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.name} />
        {CHANNELS.map((channel) => (
          <Text
            key={channel}
            size={tokens.typeLabel.size}
            weight="semibold"
            muted
            style={styles.cell}
            accessible={false}
          >
            {t(`notificationSettings.${channel}`)}
          </Text>
        ))}
      </View>
      {settingRows(grid.settings).map((setting, index) => {
        const name = t(`notificationSettings.category.${setting.category}`);
        const note = t(`notificationSettings.note.${setting.category}`, usageThresholdsIn(locale));
        const failed = grid.unsaved?.category === setting.category ? grid.unsaved.channel : null;

        return (
          <View key={setting.category} style={[styles.category, index > 0 && styles.divided]}>
            <View style={styles.row}>
              <View style={styles.name}>
                <Text size={tokens.typeBodyPhone.size} weight="semibold" accessibilityRole="header">
                  {name}
                </Text>
                <Text size={tokens.typeBody.size} muted>
                  {note}
                </Text>
              </View>
              {CHANNELS.map((channel) => (
                <View key={channel} style={styles.cell}>
                  <OnOffSwitch
                    on={setting[channel].on}
                    words={{ on: t('notificationSettings.on'), off: t('notificationSettings.off') }}
                    label={t('notificationSettings.switchName', {
                      category: name,
                      channel: t(`notificationSettings.${channel}`),
                    })}
                    hint={note}
                    disabled={!setting[channel].switchable}
                    busy={isSaving(grid, { category: setting.category, channel })}
                    onChange={(on) => change(setting.category, channel, on)}
                    testID={`notificationSettings.${setting.category}.${channel}`}
                  />
                </View>
              ))}
            </View>
            {failed != null && (
              <Notice
                tone="broken"
                mark={tokens.marks.broken.glyph}
                body={t(
                  failed === 'push'
                    ? 'notificationSettings.pushNotSaved'
                    : 'notificationSettings.emailNotSaved',
                )}
                answer={tap}
              />
            )}
          </View>
        );
      })}
      <Text size={tokens.typeBody.size} muted>
        {t('notificationSettings.quietHours', quietHoursIn(locale))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  name: { flex: 1, minWidth: 0, gap: tokens.spaceXxs },
  cell: { width: 88, alignItems: 'center', textAlign: 'center' },
  category: { gap: tokens.spaceSm },
  divided: {
    paddingTop: tokens.spaceLg,
    borderTopWidth: 1,
    borderTopColor: tokens.colorInsetBorder,
  },
});
