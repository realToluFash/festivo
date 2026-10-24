import { ApiError, type TimeZoneOption } from '@soirely/api-client';
import { exactZone, formerName, matchingZones, zoneLabel } from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  type TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { listRoom, shortWhileTyping } from '../kit/keyboard.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { useHeaderWithoutBack } from './AppFrame.tsx';
import { PrimaryButton, QuietButton, SecondaryButton } from './Buttons.tsx';
import { cardFrame } from './cardFrame.ts';
import { Field, TextField } from './Field.tsx';
import { Notice } from './Notice.tsx';
import { useAboveKeyboard, useRoomAboveKeyboard, useScrolledToTop } from './Screen.tsx';
import { Text } from './Text.tsx';

/** How many rows the list shows at once; the search narrows the rest. */
const SHOWN = 30;

/** The list scrolls inside this height, so the field and Save stay on screen (Account-*, Tweak `tz`). */
const LIST_HEIGHT = 264;

/** The list's padding and border, which the one-row floor counts along with the row. */
const LIST_PADDING = tokens.spaceXxs;
const LIST_BORDER = 1;
const LIST_FRAME = 2 * (LIST_PADDING + LIST_BORDER);

/** Your account > Account, the time zone the times sent to this person are written in (sc-868). */
export function TimeZoneCard({
  timezone,
  kind,
  onSaved,
}: {
  timezone: string | null;
  kind: LayoutKind;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [zones, setZones] = useState<TimeZoneOption[]>([]);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const frame = cardFrame(kind);

  useEffect(() => {
    let live = true;

    api
      .timezones()
      .then((list) => {
        if (live) setZones(list);
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, []);

  const current = zones.find((zone) => zone.id === timezone);
  const label = timezone == null ? null : current == null ? timezone : zoneLabel(current);

  return (
    <View style={frame}>
      <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
        {t('timeZone.title')}
      </Text>
      <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
        {t('timeZone.intro')}
      </Text>

      {editing ? (
        <Choosing
          phone={kind === 'phone'}
          zones={zones}
          now={label}
          onSaved={async (zone) => {
            await onSaved();
            setEditing(false);
            setSaved(zoneLabel(zone));
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <View style={styles.group}>
            <Text size={tokens.typeRowTitle.size} weight="semibold">
              {label ?? t('timeZone.unset')}
            </Text>
            {timezone != null && (
              <Text size={tokens.typeSmall.size} style={styles.secondary}>
                {timezone.replace(/_/g, ' ')}
              </Text>
            )}
          </View>
          {saved != null && (
            <Notice
              tone="done"
              mark={tokens.marks.done.glyph}
              body={t('timeZone.saved', { zone: saved })}
            />
          )}
          <SecondaryButton
            label={t('timeZone.change')}
            onPress={() => {
              setSaved(null);
              setEditing(true);
            }}
            testID="timeZone.change"
          />
        </>
      )}
    </View>
  );
}

/** A search over every zone; only a listed zone is ever sent. */
function Choosing({
  phone,
  zones,
  now,
  onSaved,
  onCancel,
}: {
  phone: boolean;
  zones: readonly TimeZoneOption[];
  now: string | null;
  onSaved: (zone: TimeZoneOption) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const [picked, setPicked] = useState<TimeZoneOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const input = useRef<TextInput>(null);
  const aboveKeyboard = useAboveKeyboard();
  const room = useRoomAboveKeyboard();
  // With no on-screen keyboard (a hardware one), nothing lifts, so the card is brought up on opening.
  const top = useScrolledToTop();
  const [groupHeight, setGroupHeight] = useState(0);
  const [listHeight, setListHeight] = useState(0);
  const [rowHeight, setRowHeight] = useState<number>(tokens.sizeHit);
  const { height } = useWindowDimensions();
  const short = shortWhileTyping({ os: Platform.OS, phone, height, keysUp: room != null });
  useHeaderWithoutBack(short);

  const showingPicked = picked != null && typed === zoneLabel(picked);
  const matches = showingPicked ? [] : matchingZones(zones, typed).slice(0, SHOWN);
  // "India · was Calcutta" only for the row a former name found (sc-986).
  const rowDetail = (zone: TimeZoneOption): string => {
    const was = formerName(zone, typed);

    if (was == null) return zone.country;

    return zone.country === ''
      ? t('timeZone.was', { name: was })
      : t('timeZone.countryWas', { country: zone.country, name: was });
  };
  const help = t('timeZone.help', { now: now ?? t('timeZone.nowUnset') });
  const noneMatch = typed.trim() !== '' && !showingPicked && matches.length === 0;
  const listMost =
    room == null
      ? LIST_HEIGHT
      : listRoom({
          room,
          rest: groupHeight - (matches.length > 0 ? listHeight : 0),
          oneRow: rowHeight + LIST_FRAME,
          most: LIST_HEIGHT,
        });

  async function save(): Promise<void> {
    if (saving) return;

    const zone = showingPicked ? picked : exactZone(zones, typed);
    if (zone == null) {
      setError(
        typed.trim() === '' || matches.length > 0
          ? t('timeZone.choose')
          : t('timeZone.chooseNoMatch', { typed: typed.trim() }),
      );
      input.current?.focus();
      return;
    }

    setSaving(true);

    try {
      await api.setTimezone(zone.id);
      await onSaved(zone);
    } catch (refusal) {
      setSaving(false);
      setError(
        refusal instanceof ApiError && refusal.status === 422
          ? t('timeZone.refused')
          : t('timeZone.failed'),
      );
    }
  }

  return (
    <>
      <View {...aboveKeyboard}>
        <View
          ref={top}
          onLayout={(event) => setGroupHeight(event.nativeEvent.layout.height)}
          style={styles.choosing}
        >
          <Field label={t('timeZone.find')} error={error} help={short ? undefined : help}>
            <TextField
              ref={input}
              wrong={error != null}
              editable={!saving}
              autoFocus
              autoCapitalize="none"
              placeholder={t('timeZone.placeholder')}
              value={typed}
              onChangeText={(text) => {
                setTyped(text);
                setPicked(null);
                setError(null);
              }}
              returnKeyType="done"
              onSubmitEditing={() => void save()}
              accessibilityLabel={t('timeZone.find')}
              accessibilityHint={short ? help : undefined}
              testID="timeZone.search"
            />
          </Field>

          {matches.length > 0 && (
            <ScrollView
              style={[styles.list, { maxHeight: listMost }]}
              onLayout={(event) => setListHeight(event.nativeEvent.layout.height)}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              accessibilityLabel={t('timeZone.listLabel')}
            >
              {matches.map((zone, index) => (
                <Pressable
                  key={zone.id}
                  onLayout={
                    index === 0
                      ? (event) => setRowHeight(event.nativeEvent.layout.height)
                      : undefined
                  }
                  style={styles.option}
                  accessibilityRole="button"
                  onPress={() => {
                    setPicked(zone);
                    setTyped(zoneLabel(zone));
                    setError(null);
                  }}
                  testID={`timeZone.option.${zone.id}`}
                >
                  <Text size={tokens.typeBodyPhone.size}>{zoneLabel(zone)}</Text>
                  <Text size={tokens.typeSmall.size} style={styles.secondary}>
                    {rowDetail(zone)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {noneMatch && error == null && (
            <Text
              size={tokens.typeBodyPhone.size}
              style={styles.secondary}
              accessibilityRole="alert"
            >
              {t('timeZone.noneMatch', { typed: typed.trim() })}
            </Text>
          )}

          <PrimaryButton
            label={saving ? t('timeZone.saving') : t('timeZone.save')}
            onPress={() => void save()}
            busy={saving}
            testID="timeZone.save"
          />
        </View>
      </View>
      <QuietButton label={t('timeZone.cancel')} onPress={onCancel} testID="timeZone.cancel" />
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: tokens.spaceXxs },
  choosing: { gap: tokens.spaceLg },
  secondary: { color: tokens.colorInkSecondary },
  list: {
    borderWidth: LIST_BORDER,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.radiusField,
    padding: LIST_PADDING,
  },
  option: {
    minHeight: tokens.sizeHit,
    justifyContent: 'center',
    gap: tokens.spaceXxs,
    paddingVertical: tokens.spaceXs,
    paddingHorizontal: tokens.spaceMd,
    borderRadius: tokens.radiusSmall,
  },
});
