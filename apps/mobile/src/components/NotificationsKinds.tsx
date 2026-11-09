import type { NotificationCategory, NotificationSetting } from '@soirely/api-client';
import { settingRows } from '@soirely/domain';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../../components/Text.tsx';
import { type Channel, isSaving } from '../../kit/notificationSettings.ts';
import { tokens } from '../../theme/tokens.ts';
import { Glyph, type GlyphName } from '../../components/Glyph.tsx';
import { LEAD_INSET, LineIcon } from '../../components/AccountCard.tsx';
import {
  CATEGORY_NAMES,
  CHANNEL_NAMES,
  CHANNELS,
  categoryNote,
  lockedLine,
  NOT_SAVED,
  type NotificationsPage,
  quietHoursLine,
  rowSays,
  rowValue,
  switchName,
  WORDS,
} from './NotificationsModel.ts';
import { SwitchTrack } from './NotificationsSwitch.tsx';
import { OpenRow, RowList, type RowTag, Section } from '../../components/Summary.tsx';

const LEADS: Record<NotificationCategory, GlyphName> = {
  guest_replies: 'users',
  messages: 'chat',
  event_day: 'today',
  event_changes: 'calendar',
  money: 'wallet',
  account_security: 'shield',
};

const TAGS: Record<'saving' | 'saved', RowTag> = {
  saving: { kind: 'now', word: WORDS.saving, turning: true },
  saved: { kind: 'yes', word: WORDS.saved },
};

/** The six kinds in the product's order, each opening in place to its Push and Email switches, quiet hours at the foot. */
export function KindsSection({
  page,
  settings,
  blocked,
  locale,
  onToggle,
  onSwitch,
}: {
  page: NotificationsPage;
  settings: readonly NotificationSetting[];
  blocked: boolean;
  locale: string;
  onToggle: (category: NotificationCategory) => void;
  onSwitch: (category: NotificationCategory, channel: Channel, on: boolean) => void;
}) {
  const { grid } = page;
  const unsaved = grid.status === 'loaded' ? grid.unsaved : null;

  return (
    <Section title={WORDS.kinds} foot={quietHoursLine(locale)}>
      <RowList
        items={settingRows(settings).map((setting) => {
          const { category } = setting;
          const open = page.opened === category;
          const says = rowSays(page, category);
          const tag = says == null ? null : TAGS[says];
          const value = rowValue(setting);
          const failed = unsaved?.category === category ? unsaved.channel : null;

          return {
            key: category,
            inset: LEAD_INSET,
            selected: open,
            row: (
              <View>
                <OpenRow
                  title={CATEGORY_NAMES[category]}
                  line={value}
                  lead={<LineIcon name={LEADS[category]} />}
                  tag={tag}
                  weight="semibold"
                  lit
                  open={open}
                  onToggle={() => onToggle(category)}
                  accessibilityLabel={[CATEGORY_NAMES[category], tag?.word, value]
                    .filter(Boolean)
                    .join('. ')}
                  testID={`notifications.${category}`}
                >
                  <Text size={14} weight="medium" style={[styles.secondary, styles.note]}>
                    {categoryNote(category, locale)}
                  </Text>
                  {CHANNELS.map((channel, index) => {
                    const locked = !setting[channel].switchable;

                    return (
                      <View key={channel}>
                        {index > 0 && <View style={styles.hairline} />}
                        <SwitchRow
                          title={CHANNEL_NAMES[channel]}
                          line={switchLine(channel, locked, blocked)}
                          on={setting[channel].on}
                          locked={locked}
                          busy={isSaving(grid, { category, channel })}
                          label={switchName(category, channel)}
                          onChange={(on) => onSwitch(category, channel, on)}
                          testID={`notifications.${category}.${channel}`}
                        />
                        {failed === channel && <NotSaved channel={channel} category={category} />}
                      </View>
                    );
                  })}
                </OpenRow>
                {!open && failed != null && (
                  <View style={styles.closedLine}>
                    <NotSaved channel={failed} category={category} />
                  </View>
                )}
              </View>
            ),
          };
        })}
      />
    </Section>
  );
}

function switchLine(channel: Channel, locked: boolean, blocked: boolean): string | undefined {
  if (locked) return lockedLine(channel);

  return channel === 'push' && blocked ? WORDS.blockedHere : undefined;
}

/** A whole row is the switch, named as the build names it; the lock and On or Off sit before the track. */
function SwitchRow({
  title,
  line,
  on,
  locked,
  busy,
  label,
  onChange,
  testID,
}: {
  title: string;
  line: string | undefined;
  on: boolean;
  locked: boolean;
  busy: boolean;
  label: string;
  onChange: (on: boolean) => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={line}
      accessibilityState={{ checked: on, disabled: locked || busy, busy }}
      disabled={locked || busy}
      onPress={() => onChange(!on)}
      style={[styles.switchRow, { minHeight: line == null ? 52 : 64 }]}
      testID={testID}
    >
      <View style={styles.words}>
        <Text size={16} weight="semibold" accessible={false}>
          {title}
        </Text>
        {line != null && (
          <Text size={14} weight="medium" accessible={false} style={styles.secondary}>
            {line}
          </Text>
        )}
      </View>
      <View style={styles.control}>
        {locked && <Glyph name="lock" size={14} ink={tokens.colorInkSecondary} weight={2.3} />}
        <Text
          size={15}
          weight="semibold"
          accessible={false}
          style={[styles.word, !on && styles.secondary]}
        >
          {on ? WORDS.on : WORDS.off}
        </Text>
        <SwitchTrack on={on} />
      </View>
    </Pressable>
  );
}

function NotSaved({ channel, category }: { channel: Channel; category: NotificationCategory }) {
  return (
    <View
      accessible
      accessibilityRole="alert"
      style={styles.failed}
      testID={`notifications.${category}.notSaved`}
    >
      <View style={styles.mark}>
        <Glyph name="alert" size={15} ink={tokens.colorBroken} weight={2.2} />
      </View>
      <Text size={13.5} weight="medium" accessible={false} style={[styles.broken, styles.words]}>
        {NOT_SAVED[channel]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  broken: { color: tokens.colorBroken },
  note: { lineHeight: Math.round(14 * 1.45) },
  hairline: { height: 1, backgroundColor: tokens.colorBorder },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingVertical: tokens.spaceXs,
  },
  words: { flex: 1, minWidth: 0, gap: 3 },
  control: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  word: { minWidth: 26, textAlign: 'right' },
  failed: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceXs,
    paddingBottom: tokens.spaceXs,
  },
  mark: { marginTop: 1 },
  closedLine: { paddingLeft: LEAD_INSET, paddingBottom: tokens.spaceSm },
});
