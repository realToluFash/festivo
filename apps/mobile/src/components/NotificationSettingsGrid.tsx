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
import { BellMark } from './BellMark.tsx';
import { FieldError } from './Field.tsx';
import { Notice } from './Notice.tsx';
import { OnOffSwitch } from './OnOffSwitch.tsx';
import { useReadOut } from './ReadOut.tsx';
import { Text } from './Text.tsx';
import { cardFrame } from './cardFrame.ts';
import { Arrived, Skeleton } from './Skeleton.tsx';

const CHANNELS: readonly Channel[] = ['push', 'email'];

/** `NotificationSettings-*` (sc-3980): six categories against Push and Email, each switch saved as it changes. */
export function NotificationSettingsGrid({
  kind,
  watch,
  refresh,
  onLoaded,
}: {
  kind: LayoutKind;
  watch: <T>(load: Promise<T>) => Promise<T>;
  refresh: number;
  onLoaded: (loaded: boolean) => void;
}) {
  const { t } = useTranslation();
  const [grid, setGrid] = useState<SettingsGrid>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [tap, setTap] = useState<object | undefined>(undefined);
  const [blocked, setBlocked] = useState(false);
  const [column, setColumn] = useState<{ measured: string; width: number }>();
  const phone = kind === 'phone';
  const locale = currentLocale();
  const measured = `${kind}:${locale}`;
  const width = column?.measured === measured ? column.width : undefined;
  const inset = phone ? styles.insetPhone : styles.insetTablet;

  useEffect(() => {
    let current = true;
    void readSettings({
      notificationSettings: () => watch(api.notificationSettings()),
      setNotificationSetting: (...change) => api.setNotificationSetting(...change),
    }).then((apply) => {
      if (current) setGrid(apply);
    });

    return () => {
      current = false;
    };
  }, [attempt, refresh, watch]);

  const loaded = grid.status === 'loaded';

  useEffect(() => onLoaded(loaded), [loaded, onLoaded]);

  useEffect(() => followPushBlocked(setBlocked), []);

  useReadOut(grid.status === 'loaded' && grid.saved ? t('notificationSettings.saved') : null, {
    answer: tap,
  });

  if (grid.status === 'loading') {
    return <Skeleton words={t('pending.loading')} shape="rows" rowHeight={56} />;
  }

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
    <Arrived>
      <View style={[cardFrame(kind), styles.flush]} testID="notificationSettings">
        {blocked && (
          <View style={[styles.blocked, inset]}>
            <BellBlocked />
            <Text
              size={tokens.typeBody.size}
              style={styles.blockedInk}
              accessibilityRole="text"
              testID="notificationSettings.pushBlocked"
            >
              {t('notificationSettings.pushBlocked')}
            </Text>
          </View>
        )}
        <View
          style={[styles.row, styles.headings, inset]}
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
              style={[styles.heading, { width }, width == null && styles.unmeasured]}
              accessible={false}
            >
              {t(`notificationSettings.${channel}`)}
            </Text>
          ))}
        </View>
        {settingRows(grid.settings).map((setting, index) => {
          const name = t(`notificationSettings.category.${setting.category}`);
          const note = t(
            `notificationSettings.note.${setting.category}`,
            usageThresholdsIn(locale),
          );
          const failed = grid.unsaved?.category === setting.category ? grid.unsaved.channel : null;

          return (
            <View
              key={setting.category}
              style={[styles.category, styles.divided, inset, index === 0 && styles.first]}
            >
              <View style={styles.row}>
                <View style={styles.name}>
                  <Text
                    size={tokens.typeBodyPhone.size}
                    weight="semibold"
                    accessibilityRole="header"
                  >
                    {name}
                  </Text>
                  <Text size={tokens.typeBody.size} muted>
                    {note}
                  </Text>
                </View>
                {CHANNELS.map((channel) => (
                  <View
                    key={`${channel}:${measured}`}
                    style={[styles.cell, phone ? styles.cellPhone : styles.cellTablet]}
                    onLayout={(event) => {
                      const cell = event.nativeEvent.layout.width;
                      setColumn((widest) => ({
                        measured,
                        width: Math.max(widest?.measured === measured ? widest.width : 0, cell),
                      }));
                    }}
                  >
                    <OnOffSwitch
                      on={setting[channel].on}
                      words={{
                        on: t('notificationSettings.on'),
                        off: t('notificationSettings.off'),
                      }}
                      label={t('notificationSettings.switchName', {
                        category: name,
                        channel: t(`notificationSettings.${channel}`),
                      })}
                      hint={note}
                      locked={!setting[channel].switchable}
                      stacked={phone}
                      steady
                      busy={isSaving(grid, { category: setting.category, channel })}
                      onChange={(on) => change(setting.category, channel, on)}
                      testID={`notificationSettings.${setting.category}.${channel}`}
                    />
                  </View>
                ))}
              </View>
              {failed != null && (
                <FieldError
                  message={t(
                    failed === 'push'
                      ? 'notificationSettings.pushNotSaved'
                      : 'notificationSettings.emailNotSaved',
                  )}
                />
              )}
            </View>
          );
        })}
        <Text size={tokens.typeBody.size} muted style={[styles.footer, inset]}>
          {t('notificationSettings.quietHours', quietHoursIn(locale))}
        </Text>
      </View>
    </Arrived>
  );
}

/** The bell with a slash beside the push-blocked words, decoration only. */
function BellBlocked() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <BellMark ink={tokens.marks.info.ink} slashed />
    </View>
  );
}

const styles = StyleSheet.create({
  flush: { gap: 0, padding: 0, overflow: 'hidden' },
  insetPhone: { paddingHorizontal: tokens.spaceXl },
  insetTablet: { paddingHorizontal: tokens.spaceXxl },
  blocked: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceSm,
    paddingVertical: tokens.spaceLg,
    backgroundColor: tokens.colorInset,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colorInsetBorder,
  },
  blockedInk: { flex: 1, color: tokens.marks.info.ink },
  headings: { paddingTop: tokens.spaceLg, paddingBottom: tokens.spaceSm },
  footer: {
    paddingVertical: tokens.spaceLg,
    borderTopWidth: 1,
    borderTopColor: tokens.colorInsetBorder,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
  name: { flex: 1, minWidth: 0, gap: tokens.spaceXxs },
  heading: { textAlign: 'center' },
  unmeasured: { opacity: 0 },
  cell: { alignItems: 'center' },
  cellPhone: { minWidth: tokens.sizeHit },
  cellTablet: { minWidth: 88 },
  category: { gap: tokens.spaceSm },
  divided: {
    paddingVertical: tokens.spaceLg,
    borderTopWidth: 1,
    borderTopColor: tokens.colorInsetBorder,
  },
  first: { borderTopWidth: 0, paddingTop: tokens.spaceSm },
});
