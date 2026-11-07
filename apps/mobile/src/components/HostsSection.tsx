import { type EventStatus } from '@soirely/api-client';
import {
  HOSTS_MAXIMUM,
  type HostErrors,
  type HostFocus,
  type HostRow,
  type HostsChange,
  hostCalled,
  hostsArrival,
  keepsLastHost,
  movedHost,
  removedHost,
} from '@soirely/domain';
import { type Ref, type RefObject, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  type TextInputInstance,
  View,
  type ViewInstance,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { type LayoutKind } from '../layout/useLayout.ts';
import { rowsChange } from '../motion.ts';
import { useReducedMotion } from '../reducedMotion.ts';
import { tokens } from '../theme/tokens.ts';
import { CONTROL_TEXT_SIZE, Field, TextField, focusChecked } from './Field.tsx';
import { readOut } from './ReadOut.tsx';
import { SETTLED_MS, useBroughtIntoView } from './Screen.tsx';
import { moveScreenReaderFocus } from './screenReaderFocus.ts';
import { GlyphMark } from './StatusMark.tsx';
import { Text } from './Text.tsx';

/** `keys` raises the keyboard on the name: a new row is typed in at once, a moved or removed one only read. */
type FocusNext = { to: HostFocus; keys: boolean } | null;

/** Hosted by in Edit details (sc-15497): the web's section (sc-6713) in the app's controls. */
export function HostsSection({
  kind,
  rows,
  errors,
  saved,
  busy,
  arrive,
  focusHost,
  onRows,
  onLeave,
}: {
  kind: LayoutKind;
  rows: readonly HostRow[];
  errors: HostErrors;
  saved: { status: EventStatus; hosts: readonly string[] };
  busy: boolean;
  /** Opened from Make live's Add who is hosting: focus to the first name, else Add a host. */
  arrive: boolean;
  /** A refused row the form sends focus to, with a new object for each refusal. */
  focusHost: { key: number } | null;
  onRows: (rows: HostRow[], touched: number | null) => void;
  onLeave: (row: HostRow) => void;
}) {
  const { t } = useTranslation();
  const inputs = useRef(new Map<number, TextInputInstance | null>());
  const ups = useRef(new Map<number, ViewInstance | null>());
  const downs = useRef(new Map<number, ViewInstance | null>());
  const addButton = useRef<ViewInstance>(null);
  const focusNext = useRef<FocusNext>(null);
  const nextKey = useRef(Math.max(0, ...rows.map((row) => row.key)) + 1);
  const reduced = useReducedMotion();
  const [arrival, setArrival] = useState(() => (arrive ? hostsArrival(rows) : null));
  const keepLast = keepsLastHost(saved, rows.length);
  const phone = kind === 'phone';

  useEffect(() => {
    if (arrival == null || arrival === 'add') return;
    const timer = setTimeout(
      () => focusChecked({ current: inputs.current.get(arrival.key) ?? null }),
      SETTLED_MS,
    );

    return () => clearTimeout(timer);
  }, [arrival]);

  useEffect(() => {
    if (focusHost == null) return;
    focusChecked({ current: inputs.current.get(focusHost.key) ?? null });
  }, [focusHost]);

  useEffect(() => {
    const next = focusNext.current;
    focusNext.current = null;

    if (next == null) return;
    const { to, keys } = next;
    if (to === 'add') {
      moveScreenReaderFocus(addButton.current);
      return;
    }

    const input = { current: inputs.current.get(to.key) ?? null };
    if (to.control === 'name' && keys) focusChecked(input);
    else if (to.control === 'name') moveScreenReaderFocus(input.current);
    else moveScreenReaderFocus((to.control === 'up' ? ups : downs).current.get(to.key) ?? null);
  }, [rows]);

  function apply(change: HostsChange | null): void {
    if (change == null) return;
    focusNext.current = { to: change.focus, keys: false };
    onRows(change.rows, null);
    readOut(change.said);
  }

  function add(): void {
    const key = nextKey.current;
    nextKey.current += 1;
    focusNext.current = { to: { key, control: 'name' }, keys: true };
    if (arrival === 'add') setArrival(null);
    rowsChange(reduced);
    onRows([...rows, { key, name: '' }], null);
  }

  return (
    <View style={styles.section} testID="eventForm.hosts">
      <View style={styles.head}>
        <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
          {t('eventHosts.heading')}
        </Text>
        <Text size={tokens.typeSmall.size} style={styles.secondary}>
          {t('eventHosts.explainer')}
        </Text>
      </View>

      {rows.length === 0 && (
        <View style={styles.none} testID="eventForm.hosts.none">
          <GlyphMark mark={tokens.marks.notStarted} />
          <Text size={tokens.typeBody.size} style={styles.grow}>
            {t('eventHosts.none')}
          </Text>
        </View>
      )}

      {rows.map((row, index) => {
        const label = t('eventHosts.label', { position: index + 1 });
        const error = errors[row.key];
        const name = hostCalled(row, index, t);
        const testID = `eventForm.host.${index + 1}`;

        return (
          <Field
            key={row.key}
            label={label}
            error={error}
            help={keepLast ? t('eventHosts.lastHost') : undefined}
          >
            <View style={styles.line}>
              <View style={phone ? styles.fieldPhone : styles.fieldTablet}>
                <TextField
                  ref={(input) => {
                    inputs.current.set(row.key, input);
                  }}
                  value={row.name}
                  onChangeText={(typed) =>
                    onRows(
                      rows.map((one) => (one.key === row.key ? { ...one, name: typed } : one)),
                      row.key,
                    )
                  }
                  onBlur={() => onLeave(row)}
                  multiline
                  scrollEnabled={false}
                  wrong={error != null}
                  submitting={busy}
                  style={styles.name}
                  accessibilityLabel={label}
                  accessibilityHint={describedBy(
                    error,
                    keepLast ? t('eventHosts.lastHost') : undefined,
                    index === 0 ? t('eventHosts.explainer') : undefined,
                  )}
                  testID={testID}
                />
              </View>
              <View style={styles.controls}>
                {index === 0 ? (
                  <View style={styles.gap} />
                ) : (
                  <Round
                    ref={(view) => {
                      ups.current.set(row.key, view);
                    }}
                    glyph="↑"
                    label={t('eventHosts.moveUp', { name })}
                    off={busy}
                    onPress={() => apply(movedHost(rows, index, -1, t))}
                    testID={`${testID}.up`}
                  />
                )}
                {index === rows.length - 1 ? (
                  <View style={styles.gap} />
                ) : (
                  <Round
                    ref={(view) => {
                      downs.current.set(row.key, view);
                    }}
                    glyph="↓"
                    label={t('eventHosts.moveDown', { name })}
                    off={busy}
                    onPress={() => apply(movedHost(rows, index, 1, t))}
                    testID={`${testID}.down`}
                  />
                )}
                {!keepLast && (
                  <Pressable
                    style={styles.remove}
                    onPress={() => {
                      rowsChange(reduced);
                      apply(removedHost(rows, index, t));
                    }}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel={t('eventHosts.removeNamed', { name })}
                    accessibilityState={{ disabled: busy }}
                    testID={`${testID}.remove`}
                  >
                    <Text size={tokens.typeButton.size} weight="semibold">
                      {t('eventHosts.remove')}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          </Field>
        );
      })}

      {rows.length >= HOSTS_MAXIMUM ? (
        <Text size={tokens.typeSmall.size} style={styles.secondary} testID="eventForm.hosts.most">
          {t('eventHosts.most', { most: HOSTS_MAXIMUM })}
        </Text>
      ) : arrival === 'add' ? (
        <ArrivingAdd addRef={addButton} off={busy} onPress={add} />
      ) : (
        <AddHost addRef={addButton} off={busy} onPress={add} />
      )}
    </View>
  );
}

function describedBy(...lines: (string | undefined)[]): string | undefined {
  const joined = lines.filter((line) => line != null).join(' ');

  return joined === '' ? undefined : joined;
}

/** Arrived from Make live with no hosts: Add a host is brought into sight and a screen reader lands on it. */
function ArrivingAdd({
  addRef,
  ...props
}: AddHostProps & { addRef: RefObject<ViewInstance | null> }) {
  const { shown, read } = useBroughtIntoView(addRef);

  return (
    <View ref={shown}>
      <AddHost {...props} addRef={read} />
    </View>
  );
}

interface AddHostProps {
  addRef: Ref<ViewInstance>;
  off: boolean;
  onPress: () => void;
}

function AddHost({ addRef, off, onPress }: AddHostProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      ref={addRef}
      style={styles.add}
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      testID="eventForm.hosts.add"
    >
      <Text size={tokens.typeButton.size} weight="semibold">
        {t('eventHosts.add')}
      </Text>
    </Pressable>
  );
}

function Round({
  ref,
  glyph,
  label,
  off,
  onPress,
  testID,
}: {
  ref: Ref<ViewInstance>;
  glyph: string;
  label: string;
  off: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      ref={ref}
      style={styles.round}
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off }}
      testID={testID}
    >
      <Text size={CONTROL_TEXT_SIZE} weight="bold" accessible={false}>
        {glyph}
      </Text>
    </Pressable>
  );
}

const HIT = tokens.sizeHitPhonePrimary;

const styles = StyleSheet.create({
  section: { gap: tokens.spaceMd },
  head: { gap: tokens.spaceXs },
  secondary: { color: tokens.colorInkSecondary },
  grow: { flexGrow: 1, flexShrink: 1 },
  none: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceMd,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
    backgroundColor: tokens.colorInset,
  },
  line: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: tokens.spaceSm },
  fieldPhone: { flexBasis: '100%' },
  // Beside the field on a tablet, until the field would go below about 260.
  fieldTablet: { flexGrow: 1, flexShrink: 1, flexBasis: 260 },
  name: { minHeight: HIT, paddingTop: tokens.spaceMd, paddingBottom: tokens.spaceMd },
  controls: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  gap: { width: HIT, height: HIT },
  round: {
    width: HIT,
    height: HIT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: HIT / 2,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    backgroundColor: tokens.colorCard,
  },
  remove: {
    minHeight: HIT,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXl,
    borderRadius: HIT / 2,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    backgroundColor: tokens.colorCard,
  },
  add: {
    alignSelf: 'flex-start',
    minHeight: HIT,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXl,
    borderRadius: HIT / 2,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    backgroundColor: tokens.colorCard,
  },
});
