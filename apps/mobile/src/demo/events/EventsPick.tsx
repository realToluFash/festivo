import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { formatEventDate, formatWallClock, formatWallDay } from '@soirely/domain';
import { type Ref, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type ViewInstance } from 'react-native';

import { TextField, type TextFieldProps } from '../../components/Field.tsx';
import { Text } from '../../components/Text.tsx';
import { pickedInto, pickerValue } from '../../kit/eventForm.ts';
import { weight } from '../../theme/fonts.ts';
import { tokens } from '../../theme/tokens.ts';
import { W } from './EventsWords.ts';
import { Pill } from '../../components/SettingsParts.tsx';

export interface Picking {
  title: string;
  mode: 'date' | 'time';
  field: { date: string; time: string };
  take: (next: { date: string; time: string }) => void;
}

/** Android's own dialog; on iOS the layer below, drawn in the window that is up. */
export function pick(picking: Picking, hold: (picking: Picking) => void): void {
  if (Platform.OS === 'android') {
    DateTimePickerAndroid.open({
      value: pickerValue(picking.field.date, picking.field.time, new Date()),
      mode: picking.mode,
      is24Hour: true,
      timeZoneName: 'UTC',
      onChange: (event, picked) => {
        if (event.type === 'set' && picked != null)
          picking.take(pickedInto(picking.mode, picked, picking.field));
      },
    });
    return;
  }
  hold(picking);
}

/** The calendar or the clock in a card over the screen, as main's picker sheet has it, with Done. */
export function PickerLayer({
  picking,
  locale,
  onClose,
}: {
  picking: Picking;
  locale: string;
  onClose: () => void;
}) {
  const [held, setHeld] = useState(() =>
    pickerValue(picking.field.date, picking.field.time, new Date()),
  );
  const done = () => {
    picking.take(pickedInto(picking.mode, held, picking.field));
    onClose();
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.scrim]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={W.cancel}
      />
      <View style={styles.card} accessibilityViewIsModal onAccessibilityEscape={onClose}>
        <Text size={18} weight="bold" accessibilityRole="header">
          {picking.title}
        </Text>
        <DateTimePicker
          value={held}
          mode={picking.mode}
          display={picking.mode === 'date' ? 'inline' : 'spinner'}
          timeZoneName="UTC"
          locale={locale}
          onChange={(_event, picked) => picked != null && setHeld(picked)}
        />
        <Pill label={W.done} onPress={done} testID="events.pick.done" />
      </View>
    </View>
  );
}

/** A date or a time as a box to tap, as main's form draws them: the date with its year, the time 24-hour. */
export function MomentBox({
  label,
  mode,
  value,
  locale,
  year = true,
  width,
  height = 52,
  wrong = false,
  onPress,
  ref,
  testID,
}: {
  label: string;
  mode: 'date' | 'time';
  value: string;
  locale: string;
  year?: boolean;
  width?: number;
  height?: number;
  wrong?: boolean;
  onPress: () => void;
  ref?: Ref<ViewInstance>;
  testID?: string;
}) {
  const words =
    mode === 'time'
      ? formatWallClock(value, locale)
      : year
        ? formatEventDate(`${value}T12:00:00Z`, 'UTC', locale)
        : formatWallDay(value, locale);
  const tall = height > tokens.sizeHit;
  const inside = (tall ? tokens.spacePillEnd : tokens.spaceLg) - (wrong ? 2 : 1.5);

  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      style={({ pressed }) => [
        styles.box,
        {
          minHeight: height,
          paddingHorizontal: inside,
          borderRadius: tall ? tokens.radiusInset : tokens.radiusRow,
        },
        width == null ? styles.grow : { width },
        wrong && styles.wrong,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${words}`}
      testID={testID}
    >
      <Text size={tall ? 16 : 15} weight="medium" accessible={false} style={styles.figures}>
        {words}
      </Text>
    </Pressable>
  );
}

/** A typed field in the event's own box, as tall and as round as the date and time boxes beside it. */
export function BoxField({
  wrong = false,
  accessibilityLabel,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps & { accessibilityLabel: string }) {
  const [focused, setFocused] = useState(false);

  return (
    <TextField
      {...rest}
      accessibilityLabel={accessibilityLabel}
      wrong={wrong}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[styles.field, (focused || wrong) && styles.fieldLit]}
    />
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: tokens.opacityPressed },
  figures: { fontVariant: ['tabular-nums'] },
  scrim: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spaceXxl,
    backgroundColor: tokens.scrimDialog,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    gap: tokens.spaceLg,
    padding: tokens.spaceXl,
    borderRadius: tokens.space3xl,
    backgroundColor: tokens.colorCard,
  },
  box: {
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: tokens.colorFieldBorder,
    backgroundColor: tokens.colorCard,
  },
  wrong: { borderWidth: 2, borderColor: tokens.colorBroken },
  field: {
    minHeight: 52,
    paddingLeft: 14.5,
    paddingRight: 10.5,
    borderWidth: 1.5,
    borderRadius: tokens.radiusInset,
    ...weight('medium'),
  },
  fieldLit: { paddingLeft: tokens.spacePillEnd, paddingRight: tokens.spaceMd, borderWidth: 2 },
});
