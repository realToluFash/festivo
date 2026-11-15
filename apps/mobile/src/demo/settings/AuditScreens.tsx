import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { type RefObject, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { FieldError } from '../../components/Field.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { ChoiceRow, FocusedScreen, Line, RowList, TextAction } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { MomentBox } from '../../components/MomentPick.tsx';
import {
  datesProblem,
  detailRows,
  type DetailRow,
  type Format,
  FORMAT_WORDS,
  type Range,
} from './AuditModel.ts';
import type { AuditEntry } from './AuditSample.ts';
import { Code } from './DataParts.tsx';
import type { DataSay } from './DataSample.ts';
import { AUDIT_WORDS as A } from './DataWords.ts';

type Opener = RefObject<ScreenReaderTarget | null>;

/** An entry's record: each label over its value, the event a link while it exists, and that nobody can change it. */
export function EntryRows({
  entry,
  say,
  onEvent,
}: {
  entry: AuditEntry;
  say: DataSay;
  onEvent: (id: string) => void;
}) {
  return (
    <View style={styles.entry}>
      <RowList
        items={detailRows(entry, say).map((row) => ({
          key: row.label,
          row: <DetailLine row={row} onEvent={onEvent} />,
        }))}
      />
      <Line text={A.fixed} />
    </View>
  );
}

function DetailLine({ row, onEvent }: { row: DetailRow; onEvent: (id: string) => void }) {
  const label = (
    <Text size={14} weight="medium" accessible={false} style={styles.secondary}>
      {row.label}
    </Text>
  );
  const said = [row.value, row.code].filter((part) => part != null && part !== '').join(' ');

  if (row.eventId != null) {
    const id = row.eventId;

    return (
      <Pressable
        onPress={() => onEvent(id)}
        style={({ pressed }) => [styles.detail, pressed && styles.pressed]}
        accessibilityRole="link"
        accessibilityLabel={`${row.label}: ${said}`}
        testID="audit.detail.on"
      >
        {label}
        <Text size={16} weight="semibold" accessible={false} style={styles.accent}>
          {row.value}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.detail} accessible accessibilityLabel={`${row.label}: ${said}`}>
      {label}
      <View style={styles.value}>
        {!row.codeOnly && (
          <Text size={16} weight="medium" accessible={false}>
            {row.value}
          </Text>
        )}
        {row.code != null && <Code text={row.code} />}
      </View>
    </View>
  );
}

/** On an iPad, the entry in a 540 sheet titled Entry with Done; it keeps its words while it slides away. */
export function EntrySheet({
  entry,
  say,
  opener,
  onEvent,
  onClose,
}: {
  entry: AuditEntry | null;
  say: DataSay;
  opener: Opener;
  onEvent: (id: string) => void;
  onClose: () => void;
}) {
  const [shown, setShown] = useState(entry);
  if (entry != null && entry !== shown) setShown(entry);

  return (
    <FocusedScreen
      open={entry != null}
      title={A.entry}
      verb={{ label: A.done, on: true, onPress: onClose, testID: 'audit.entry.done' }}
      cancels={false}
      onCancel={onClose}
      opener={opener}
      testID="audit.entrySheet"
    >
      {shown != null && <EntryRows entry={shown} say={say} onEvent={onEvent} />}
    </FocusedScreen>
  );
}

function asDate(day: string): Date {
  return new Date(`${day}T12:00:00Z`);
}

/** Dates: From and To on the device's own calendar, the order checked as they change, Apply off while it is wrong. */
export function DatesScreen({
  range,
  opener,
  locale,
  onCancel,
  onApply,
}: {
  range: Range | null;
  opener: Opener;
  locale: string;
  onCancel: () => void;
  onApply: (range: Range) => void;
}) {
  const [held, setHeld] = useState<Range>(range ?? { from: '', to: '' });
  const [picking, setPicking] = useState<keyof Range | null>(null);
  const problem = held.from === '' ? null : datesProblem(held);
  const press = (which: keyof Range) => {
    if (Platform.OS !== 'android') {
      setPicking(picking === which ? null : which);
      return;
    }
    DateTimePickerAndroid.open({
      value: asDate(held[which]),
      mode: 'date',
      timeZoneName: 'UTC',
      onChange: (event, picked) => {
        if (event.type === 'set' && picked != null)
          setHeld((now) => ({ ...now, [which]: picked.toISOString().slice(0, 10) }));
      },
    });
  };

  return (
    <FocusedScreen
      open={range != null}
      title={A.dates}
      verb={{
        label: A.apply,
        on: problem == null,
        onPress: () => onApply(held),
        testID: 'audit.dates.apply',
      }}
      onCancel={onCancel}
      cancelTestID="audit.dates.cancel"
      opener={opener}
      testID="audit.dates"
    >
      {(['from', 'to'] as const).map((which) => (
        <View key={which} style={styles.date}>
          <Text size={15} weight="semibold">
            {which === 'from' ? A.from : A.to}
          </Text>
          {held[which] !== '' && (
            <MomentBox
              label={which === 'from' ? A.from : A.to}
              mode="date"
              value={held[which]}
              locale={locale}
              wrong={which === 'to' && problem != null}
              onPress={() => press(which)}
              testID={`audit.dates.${which}`}
            />
          )}
          {which === 'to' && problem != null && <FieldError message={problem} />}
          {picking === which && (
            <>
              <DateTimePicker
                value={asDate(held[which])}
                mode="date"
                display="inline"
                timeZoneName="UTC"
                locale={locale}
                onChange={(_event, picked) => {
                  if (picked != null)
                    setHeld((now) => ({ ...now, [which]: picked.toISOString().slice(0, 10) }));
                }}
              />
              <TextAction
                label={A.done}
                onPress={() => setPicking(null)}
                testID={`audit.dates.${which}.done`}
              />
            </>
          )}
        </View>
      ))}
    </FocusedScreen>
  );
}

/** Export these entries, on an iPad: the format, how many download at once, and the refusal for too many. */
export function ExportScreen({
  exporting,
  opener,
  onCancel,
  onExport,
}: {
  exporting: { format: Format; refused: boolean } | null;
  opener: Opener;
  onCancel: () => void;
  onExport: (format: Format) => void;
}) {
  const [format, setFormat] = useState<Format>(exporting?.format ?? 'csv');

  return (
    <FocusedScreen
      open={exporting != null}
      title={A.export}
      verb={{
        label: A.exportVerb,
        on: true,
        onPress: () => onExport(format),
        testID: 'audit.export.send',
      }}
      onCancel={onCancel}
      cancelTestID="audit.export.cancel"
      opener={opener}
      testID="audit.export"
    >
      <View accessibilityRole="radiogroup">
        {(['csv', 'jsonLines'] as const).map((one) => (
          <ChoiceRow
            key={one}
            title={FORMAT_WORDS[one]}
            on={format === one}
            onPress={() => setFormat(one)}
            testID={`audit.export.${one}`}
          />
        ))}
      </View>
      <Line text={A.exportLine} />
      {exporting?.refused === true && <FieldError message={A.tooMany} />}
    </FocusedScreen>
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  pressed: { opacity: tokens.opacityPressed },
  entry: { gap: tokens.spaceLg },
  detail: { minHeight: 64, justifyContent: 'center', gap: 3, paddingVertical: 11 },
  value: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 6 },
  date: { gap: tokens.spaceSm },
});
