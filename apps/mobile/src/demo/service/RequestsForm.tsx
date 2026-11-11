import { useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type TextInputInstance,
  type ViewInstance,
} from 'react-native';

import { PrimaryButton, QuietButton } from '../../components/Buttons.tsx';
import { Field, TextField, focusRefused } from '../../components/Field.tsx';
import { moveScreenReaderFocus } from '../../components/screenReaderFocus.ts';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { FlagLine, Glyph } from '../queue/QueueParts.tsx';
import { PATHS, shared } from './HowItsGoingParts.tsx';
import {
  type Demo,
  FIELD_ERROR,
  type FieldName,
  type Form,
  KINDS,
  KIND_WORD,
  NO_SEAT_LINE,
  WORDS_MAX,
  add,
  check,
  dishOptions,
  noSeatCanChange,
  otherLine,
  routeLine,
  seatWhy,
} from './RequestsModel.ts';

export function AddRequest({
  d,
  setD,
  apply,
  framed,
}: {
  d: Demo;
  setD: (d: Demo) => void;
  apply: (d: Demo) => void;
  framed: 'sheet' | 'dialog' | 'docked';
}) {
  const kindRef = useRef<ViewInstance | null>(null);
  const seatRef = useRef<ViewInstance | null>(null);
  const dishRef = useRef<ViewInstance | null>(null);
  const wordsRef = useRef<TextInputInstance | null>(null);
  const form = d.form;
  if (form == null) return null;

  const table = d.table;
  const wrong = d.tried ? check(form, table) : [];
  const error = (f: FieldName) => (wrong.includes(f) ? FIELD_ERROR[f] : null);
  const plate = form.kind === 'plate';
  const seat = typeof form.who === 'number' ? table.seats.find((s) => s.n === form.who) : undefined;
  const seatOk = seat != null && seatWhy(table, seat) == null;
  const set = (f: Partial<Form>) => setD({ ...d, form: { ...form, ...f } });
  const close = () => setD({ ...d, form: null, tried: false, refused: '' });
  const whys = plate ? table.seats.flatMap((s) => seatWhy(table, s) ?? []) : [];

  function send(): void {
    const { d: next, wrong: failed } = add(d);
    apply(next);
    const first = failed[0];
    if (first === 'words') focusRefused(wordsRef);
    else if (first != null)
      moveScreenReaderFocus({ kind: kindRef, seat: seatRef, dish: dishRef }[first].current);
  }

  return (
    <View style={styles.form} testID={`requests.form.${framed}`}>
      <Text size={22} weight="bold" accessibilityRole="header">
        {`Add request · ${table.name}`}
      </Text>
      {!d.online && (
        <View accessibilityRole="alert" style={styles.line}>
          <Glyph paths={PATHS.offline} ink={tokens.colorInk} side={18} />
          <Text size={15} weight="semibold" style={shared.grow}>
            {d.refused === '' ? 'No connection. Adding a request needs one.' : d.refused}
          </Text>
        </View>
      )}
      <Field label="Kind" error={error('kind')} ref={kindRef}>
        <View style={styles.choices} accessibilityRole="radiogroup">
          {KINDS.map((k) => (
            <Choice
              key={k}
              word={KIND_WORD[k]}
              on={form.kind === k}
              onPress={() =>
                set({
                  kind: k,
                  who: k === 'plate' ? (seatOk ? form.who : null) : (form.who ?? 'table'),
                  dish: k === 'plate' ? form.dish : null,
                })
              }
              testID={`requests.kind.${k}`}
            />
          ))}
        </View>
      </Field>
      {plate && noSeatCanChange(table) && (
        <Text size={14} weight="semibold" style={wrong.includes('seat') ? styles.error : undefined}>
          {NO_SEAT_LINE}
        </Text>
      )}
      <Field
        label={plate ? 'Whose plate changes' : 'Who asked'}
        error={error('seat')}
        ref={seatRef}
        help={whys}
      >
        <View style={styles.choices} accessibilityRole="radiogroup">
          {!plate && (
            <Choice
              word="Whole table"
              on={form.who === 'table'}
              onPress={() => set({ who: 'table' })}
              testID="requests.who.table"
            />
          )}
          {table.seats.map((s) => {
            const off = plate && seatWhy(table, s) != null;
            return (
              <Choice
                key={s.n}
                word={`Seat ${s.n}`}
                on={form.who === s.n}
                off={off}
                onPress={() => set({ who: s.n, dish: null })}
                testID={`requests.who.${s.n}`}
              />
            );
          })}
        </View>
      </Field>
      {plate && seat != null && seatOk && (
        <Field label="New dish" error={error('dish')} ref={dishRef}>
          <View style={styles.dishes}>
            {seat.flags.map((f) => (
              <FlagLine key={f.words} flag={f.words} />
            ))}
            {otherLine(seat) != null && (
              <Text size={14} style={shared.secondary}>
                {otherLine(seat)}
              </Text>
            )}
            {dishOptions(table, seat).map((c) => (
              <View key={c.course.id} style={styles.course}>
                <Text size={15} weight="bold" accessibilityRole="header">
                  {c.course.name}
                </Text>
                <Text size={14} style={shared.secondary}>
                  {`Now: ${c.now ?? 'nothing chosen'}${c.course.fired ? ' · To serve' : ' · not fired yet'}`}
                </Text>
                {c.dishes.map(({ dish, refused }) => (
                  <Pressable
                    key={dish.name}
                    onPress={refused == null ? () => set({ dish: dish.name }) : undefined}
                    accessibilityRole="radio"
                    accessibilityState={{
                      checked: form.dish === dish.name,
                      disabled: refused != null,
                    }}
                    accessibilityHint={refused ?? undefined}
                    style={[
                      styles.dish,
                      form.dish === dish.name && styles.on,
                      refused != null && styles.off,
                    ]}
                    testID={`requests.dish.${dish.name}`}
                  >
                    <Text size={16} weight="semibold">
                      {dish.name}
                    </Text>
                    <Text size={13} style={shared.secondary}>
                      {dish.contains == null
                        ? 'Allergens not stated'
                        : dish.contains.length === 0
                          ? 'Contains no listed allergen'
                          : `Contains ${dish.contains.join(', ')}`}
                    </Text>
                    {dish.suitable.length > 0 && (
                      <Text size={13} style={shared.secondary}>
                        {`Suitable for ${dish.suitable.join(', ')}`}
                      </Text>
                    )}
                    {dish.choice != null && (
                      <Text size={13} style={shared.secondary}>
                        {`${dish.choice}: chef’s choice`}
                      </Text>
                    )}
                    {refused != null && (
                      <Text size={14} weight="semibold" style={styles.refused}>
                        {refused}
                      </Text>
                    )}
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        </Field>
      )}
      <Field
        label="What they asked for"
        error={error('words')}
        help={`${form.words.length} of ${WORDS_MAX}`}
      >
        <TextField
          accessibilityLabel="What they asked for"
          ref={wordsRef}
          value={form.words}
          onChangeText={(words) => set({ words })}
          maxLength={WORDS_MAX}
          multiline
          wrong={wrong.includes('words')}
          testID="requests.words"
        />
      </Field>
      <Text size={14} style={shared.secondary}>
        {routeLine(form, table, d.viewer)}
      </Text>
      <View style={framed === 'sheet' ? styles.stacked : styles.row}>
        {framed !== 'sheet' && (
          <QuietButton label="Cancel" onPress={close} testID="requests.form.cancel" />
        )}
        <PrimaryButton label="Add request" onPress={send} testID="requests.form.send" />
      </View>
    </View>
  );
}

function Choice({
  word,
  on,
  off = false,
  onPress,
  testID,
}: {
  word: string;
  on: boolean;
  off?: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on, disabled: off }}
      style={[styles.choice, on && styles.on, off && styles.off]}
      testID={testID}
    >
      {on && <Glyph paths={PATHS.check} ink={tokens.colorAccentText} side={14} />}
      <Text size={15} weight="semibold" style={off ? shared.secondary : undefined}>
        {word}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  form: { gap: tokens.spaceLg, paddingBottom: tokens.spaceLg },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: tokens.spaceMd,
    borderRadius: tokens.radiusRow,
    backgroundColor: tokens.colorInset,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceSm },
  choice: {
    minHeight: tokens.sizeHitPhonePrimary,
    paddingHorizontal: 16,
    borderRadius: tokens.radiusPill,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    backgroundColor: tokens.colorCard,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  on: { borderColor: tokens.colorAccent, borderWidth: 2, backgroundColor: tokens.colorAccentTint },
  off: { borderStyle: 'dashed', backgroundColor: tokens.colorInset },
  dishes: { gap: tokens.spaceSm },
  course: { gap: 6 },
  dish: {
    minHeight: tokens.sizeHitPhonePrimary,
    gap: 2,
    padding: tokens.spaceMd,
    borderRadius: tokens.radiusRow,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    backgroundColor: tokens.colorCard,
  },
  refused: { color: tokens.colorBrokenText },
  error: { color: tokens.colorBrokenText },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: tokens.spaceSm },
  stacked: { gap: tokens.spaceSm },
});
