import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import {
  AUDIT_AT_MOST,
  AUDIT_AT_ONCE,
  type AuditEntry,
  type AuditFormat,
  type AuditLogPage,
} from '@soirely/api-client';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View, type ViewInstance } from 'react-native';

import {
  type AuditMenu,
  type AuditPicks,
  byDay,
  datesProblem,
  type DayRange,
  type DetailRow,
  detailRows,
  entryLine,
  menuChoices,
} from '../kit/auditLog.ts';
import { tokens } from '../theme/tokens.ts';
import { FieldError } from './Field.tsx';
import { Glyph } from './Glyph.tsx';
import { MomentBox } from './MomentPick.tsx';
import type { ScreenReaderTarget } from './screenReaderFocus.ts';
import {
  AnchoredMenu,
  type Anchor,
  anchorUnder,
  ChoiceRow,
  FocusedScreen,
  Line,
  Row,
  RowList,
  Section,
  TextAction,
} from './Summary.tsx';
import { Text } from './Text.tsx';

type Opener = RefObject<ScreenReaderTarget | null>;

/** A linked menu opens once the page has laid out, from its button. */
const MENU_AFTER_MS = 600;
const TIME_LEAD = 48;

export type Exporting = { format: AuditFormat; refused: 'tooMany' | 'failed' | null } | null;

/** A code, a reference or an address: Sans with tabular figures, tracked 0.04em. */
function Code({ text, size = 16 }: { text: string; size?: number }) {
  return (
    <Text
      size={size}
      weight="medium"
      selectable
      style={[styles.code, { letterSpacing: size * 0.04 }]}
    >
      {text}
    </Text>
  );
}

export function AuditDays({
  entries,
  now,
  zone,
  locale,
  onOpen,
}: {
  entries: readonly AuditEntry[];
  now: Date;
  zone: string | null;
  locale: string;
  onOpen: (entry: AuditEntry, view: ViewInstance | null) => void;
}) {
  const { t } = useTranslation();
  const rows = useRef<Record<string, ViewInstance | null>>({});

  return (
    <>
      {byDay(t, entries, now, zone, locale).map((day) => (
        <Section key={day.key} title={day.heading}>
          <RowList
            items={day.entries.map((entry) => {
              const line = entryLine(t, entry);

              return {
                key: entry.id,
                inset: TIME_LEAD + tokens.spaceLg,
                row: (
                  <Row
                    ref={(view) => {
                      rows.current[entry.id] = view;
                    }}
                    lead={
                      <Text size={15} weight="semibold" accessible={false} style={styles.time}>
                        {entry.time}
                      </Text>
                    }
                    title={entry.what}
                    line={line}
                    opens
                    onPress={() => onOpen(entry, rows.current[entry.id] ?? null)}
                    accessibilityLabel={t('auditLog.entryLabel', {
                      time: entry.time,
                      what: entry.what,
                      line,
                    })}
                    testID={`audit.entry.${entry.id}`}
                  />
                ),
              };
            })}
          />
        </Section>
      ))}
    </>
  );
}

export function MenuButton({
  which,
  word,
  picks,
  page,
  open,
  onOpen,
  onClose,
  onChoose,
}: {
  which: AuditMenu;
  word: string;
  picks: AuditPicks;
  page: Pick<AuditLogPage, 'people' | 'events'>;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChoose: (value: string | null) => void;
}) {
  const { t } = useTranslation();
  const trigger = useRef<ViewInstance>(null);
  const [at, setAt] = useState<Anchor | null>(null);
  const current = picks[which];

  useEffect(() => {
    if (!open || at != null) return;
    const wait = setTimeout(() => anchorUnder(trigger, setAt), MENU_AFTER_MS);

    return () => clearTimeout(wait);
  }, [open, at]);

  const close = () => {
    setAt(null);
    onClose();
  };

  return (
    <>
      <MenuTrigger
        ref={trigger}
        word={word}
        expanded={open}
        onPress={() => {
          onOpen();
          anchorUnder(trigger, setAt);
        }}
        label={t('auditLog.filterLabel', { filter: t(`auditLog.${which}`), value: word })}
        testID={`audit.filter.${which}`}
      />
      <AnchoredMenu
        at={open ? at : null}
        onClose={close}
        opener={trigger as RefObject<ScreenReaderTarget | null>}
        align="start"
        width={260}
        testID={`audit.menu.${which}`}
      >
        {menuChoices(t, which, page).map((choice) => (
          <MenuRow
            key={choice.value ?? 'all'}
            word={choice.word}
            on={choice.value === current}
            onPress={() => {
              setAt(null);
              onChoose(choice.value);
            }}
            testID={`audit.menu.${which}.${choice.value ?? 'all'}`}
          />
        ))}
      </AnchoredMenu>
    </>
  );
}

export function DatesButton({
  word,
  onPress,
}: {
  word: string;
  onPress: (view: ViewInstance | null) => void;
}) {
  const { t } = useTranslation();
  const trigger = useRef<ViewInstance>(null);

  return (
    <MenuTrigger
      ref={trigger}
      word={word}
      onPress={() => onPress(trigger.current)}
      label={t('auditLog.filterLabel', { filter: t('auditLog.dates'), value: word })}
      testID="audit.filter.dates"
    />
  );
}

/** A filter's button: its words in Violet and the chevron down, wrapping at the largest text rather than running past the page. */
function MenuTrigger({
  word,
  expanded,
  onPress,
  label,
  testID,
  ref,
}: {
  word: string;
  expanded?: boolean;
  onPress: () => void;
  label: string;
  testID: string;
  ref: RefObject<ViewInstance | null>;
}) {
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={expanded == null ? undefined : { expanded }}
      testID={testID}
    >
      <Text size={15} weight="semibold" accessible={false} style={[styles.accent, styles.shrink]}>
        {word}
      </Text>
      <Glyph name="down" size={16} ink={tokens.colorAccentText} weight={2.4} />
    </Pressable>
  );
}

function MenuRow({
  word,
  on,
  onPress,
  testID,
}: {
  word: string;
  on: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && styles.menuPressed]}
      accessibilityRole="menuitem"
      accessibilityState={{ checked: on }}
      accessibilityLabel={word}
      testID={testID}
    >
      <View style={styles.menuTick}>
        {on && <Glyph name="tick" size={16} ink={tokens.colorAccentText} weight={2.6} />}
      </View>
      <Text
        size={16}
        weight={on ? 'semibold' : 'medium'}
        accessible={false}
        style={[styles.grow, on && styles.accent]}
      >
        {word}
      </Text>
    </Pressable>
  );
}

/** An entry's record: each label over its value, the event a link while it exists, and that nobody can change it. */
export function EntryRows({
  entry,
  onEvent,
}: {
  entry: AuditEntry;
  onEvent: (id: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.entry}>
      <RowList
        items={detailRows(t, entry).map((row) => ({
          key: row.key,
          row: <DetailLine row={row} onEvent={onEvent} />,
        }))}
      />
      <Line text={t('auditLog.fixed')} />
    </View>
  );
}

function DetailLine({ row, onEvent }: { row: DetailRow; onEvent: (id: string) => void }) {
  const { t } = useTranslation();
  const label = (
    <Text size={14} weight="medium" accessible={false} style={styles.secondary}>
      {row.label}
    </Text>
  );
  const said = [row.value, row.code].filter((part) => part != null && part !== '').join(' ');
  const spoken = t('auditLog.detailLabel', { label: row.label, value: said });

  if (row.eventId != null) {
    const id = row.eventId;

    return (
      <Pressable
        onPress={() => onEvent(id)}
        style={({ pressed }) => [styles.detail, pressed && styles.pressed]}
        accessibilityRole="link"
        accessibilityLabel={spoken}
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
    <View
      style={styles.detail}
      accessible
      accessibilityLabel={spoken}
      testID={`audit.detail.${row.key}`}
    >
      {label}
      <View style={styles.value}>
        {row.codeOnly !== true && (
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
  opener,
  onEvent,
  onClose,
}: {
  entry: AuditEntry | null;
  opener: Opener;
  onEvent: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [shown, setShown] = useState(entry);
  if (entry != null && entry !== shown) setShown(entry);

  return (
    <FocusedScreen
      open={entry != null}
      title={t('auditLog.entry')}
      verb={{ label: t('auditLog.done'), on: true, onPress: onClose, testID: 'audit.entry.done' }}
      cancels={false}
      onCancel={onClose}
      opener={opener}
      testID="audit.entrySheet"
    >
      {shown != null && <EntryRows entry={shown} onEvent={onEvent} />}
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
  range: DayRange | null;
  opener: Opener;
  locale: string;
  onCancel: () => void;
  onApply: (range: DayRange) => void;
}) {
  const { t } = useTranslation();
  const [held, setHeld] = useState<DayRange>(range ?? { from: '', to: '' });
  const [picking, setPicking] = useState<keyof DayRange | null>(null);
  const problem = held.from === '' ? null : datesProblem(t, held);
  const press = (which: keyof DayRange) => {
    if (Platform.OS !== 'android') {
      setPicking(picking === which ? null : which);
      return;
    }
    DateTimePickerAndroid.open({
      value: asDate(held[which]),
      mode: 'date',
      timeZoneName: 'UTC',
      onChange: (event, chosen) => {
        if (event.type === 'set' && chosen != null)
          setHeld((now) => ({ ...now, [which]: chosen.toISOString().slice(0, 10) }));
      },
    });
  };

  return (
    <FocusedScreen
      open={range != null}
      title={t('auditLog.dates')}
      verb={{
        label: t('auditLog.apply'),
        on: problem == null,
        onPress: () => {
          if (problem == null) onApply(held);
        },
        testID: 'audit.dates.apply',
      }}
      onCancel={onCancel}
      cancelTestID="audit.dates.cancel"
      opener={opener}
      testID="audit.dates"
    >
      {(['from', 'to'] as const).map((which) => {
        const name = which === 'from' ? t('auditLog.from') : t('auditLog.to');

        return (
          <View key={which} style={styles.date}>
            <Text size={15} weight="semibold">
              {name}
            </Text>
            {held[which] !== '' && (
              <MomentBox
                label={name}
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
                  onChange={(_event, chosen) => {
                    if (chosen != null)
                      setHeld((now) => ({ ...now, [which]: chosen.toISOString().slice(0, 10) }));
                  }}
                />
                <TextAction
                  label={t('auditLog.done')}
                  onPress={() => setPicking(null)}
                  testID={`audit.dates.${which}.done`}
                />
              </>
            )}
          </View>
        );
      })}
    </FocusedScreen>
  );
}

export const FORMAT_KEYS = { csv: 'auditLog.csv', jsonl: 'auditLog.jsonLines' } as const;

/** Export these entries, on an iPad: the format, how many download at once, and the refusal for too many. */
export function ExportScreen({
  exporting,
  busy,
  opener,
  onCancel,
  onExport,
}: {
  exporting: Exporting;
  busy: boolean;
  opener: Opener;
  onCancel: () => void;
  onExport: (format: AuditFormat) => void;
}) {
  const { t } = useTranslation();
  const [format, setFormat] = useState<AuditFormat>(exporting?.format ?? 'csv');
  const refused = exporting?.refused ?? null;

  return (
    <FocusedScreen
      open={exporting != null}
      title={t('auditLog.export')}
      verb={{
        label: t('auditLog.exportVerb'),
        on: !busy,
        busy,
        onPress: () => onExport(format),
        testID: 'audit.export.send',
      }}
      waits={busy}
      onCancel={onCancel}
      cancelTestID="audit.export.cancel"
      opener={opener}
      testID="audit.export"
    >
      <View accessibilityRole="radiogroup">
        {(['csv', 'jsonl'] as const).map((one) => (
          <ChoiceRow
            key={one}
            title={t(FORMAT_KEYS[one])}
            on={format === one}
            onPress={() => setFormat(one)}
            testID={`audit.export.${one}`}
          />
        ))}
      </View>
      <Line text={t('auditLog.exportLine', { atOnce: AUDIT_AT_ONCE })} />
      {refused === 'tooMany' && (
        <FieldError message={t('auditLog.tooMany', { most: AUDIT_AT_MOST })} />
      )}
      {refused === 'failed' && <FieldError message={t('auditLog.exportFailed')} />}
    </FocusedScreen>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  pressed: { opacity: tokens.opacityPressed },
  code: { fontVariant: ['tabular-nums'] },
  time: { minWidth: TIME_LEAD, fontVariant: ['tabular-nums'] },
  shrink: { flexShrink: 1, fontVariant: ['tabular-nums'] },
  trigger: {
    minHeight: tokens.sizeHit,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  menuRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingHorizontal: tokens.spaceLg,
  },
  menuPressed: { backgroundColor: tokens.colorInset },
  menuTick: { width: 18, alignItems: 'center' },
  entry: { gap: tokens.spaceLg },
  detail: { minHeight: 64, justifyContent: 'center', gap: 3, paddingVertical: 11 },
  value: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 6 },
  date: { gap: tokens.spaceSm },
});
