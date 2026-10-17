import { ApiError, type TimeZoneOption } from '@soirely/api-client';
import { exactZone, formerName, matchingZones, zoneLabel } from '@soirely/domain';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, type TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { api } from '../api.ts';
import { type LayoutKind } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { PrimaryButton, QuietButton, SecondaryButton } from './Buttons.tsx';
import { cardFrame } from './cardFrame.ts';
import { Field, TextField } from './Field.tsx';
import { Notice } from './Notice.tsx';
import { useAboveKeyboard, useScrolledToTop } from './Screen.tsx';
import { Text } from './Text.tsx';

/** How many rows the list shows at once; the search narrows the rest. */
const SHOWN = 30;

/** The list scrolls inside this height, so the field and Save stay on screen (Account-*, Tweak `tz`). */
const LIST_HEIGHT = 264;

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
  zones,
  now,
  onSaved,
  onCancel,
}: {
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
  const top = useScrolledToTop();

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
  const noneMatch = typed.trim() !== '' && !showingPicked && matches.length === 0;

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
      <View ref={top}>
        <Field
          label={t('timeZone.find')}
          error={error}
          help={t('timeZone.help', { now: now ?? t('timeZone.nowUnset') })}
        >
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
            testID="timeZone.search"
          />
        </Field>
      </View>

      {matches.length > 0 && (
        <ScrollView
          style={styles.list}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          accessibilityLabel={t('timeZone.listLabel')}
        >
          {matches.map((zone) => (
            <Pressable
              key={zone.id}
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
        <Text size={tokens.typeBodyPhone.size} style={styles.secondary} accessibilityRole="alert">
          {t('timeZone.noneMatch', { typed: typed.trim() })}
        </Text>
      )}

      <View ref={aboveKeyboard} style={styles.group}>
        <PrimaryButton
          label={saving ? t('timeZone.saving') : t('timeZone.save')}
          onPress={() => void save()}
          busy={saving}
          testID="timeZone.save"
        />
      </View>
      <QuietButton label={t('timeZone.cancel')} onPress={onCancel} testID="timeZone.cancel" />
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: tokens.spaceXxs },
  secondary: { color: tokens.colorInkSecondary },
  list: {
    maxHeight: LIST_HEIGHT,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.radiusField,
    padding: tokens.spaceXxs,
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
