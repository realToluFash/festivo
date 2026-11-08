import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';

import { Glyph } from '../../components/Glyph.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { useShell } from '../../components/settingsShell.ts';
import {
  AnchoredMenu,
  type Anchor,
  anchorUnder,
  CardSays,
  FailedBlock,
  Line,
  LoadingBlock,
  OnCard,
  Row,
  RowList,
  Section,
  SummaryCard,
  TextAction,
} from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { eventHref } from '../events/EventsModel.ts';
import {
  type AuditStart,
  auditStart,
  auditStateOf,
  buttonWords,
  byDay,
  entryLine,
  entryOf,
  exportAnswer,
  type Filters,
  filtered,
  FORMAT_WORDS,
  matching,
  type Menu,
  MENU_NAMES,
  menuChoices,
  NO_FILTERS,
  type Range,
  SAMPLE_RANGE,
} from './AuditModel.ts';
import type { AuditEntry } from './AuditSample.ts';
import { DatesScreen, EntryRows, EntrySheet, ExportScreen } from './AuditScreens.tsx';
import { DATA_PEOPLE } from './DataModel.ts';
import { DataSubPage, useDataNav } from './DataParts.tsx';
import { type DataSay, dataSayIn } from './DataSample.ts';
import { AUDIT_WORDS as A, DATA_WORDS as H } from './DataWords.ts';
import { SeenBy } from './Frame.tsx';
import { useLoad } from './MembersLoading.tsx';
import { memberLooking } from './sample.ts';
import { SummaryPage } from './SummaryPage.tsx';

/** A linked menu opens once the page has laid out, from its button. */
const MENU_AFTER_MS = 600;

/** The audit log in B (sc-611): who did what, by day, filtered by four menus; Export on the iPad only. */
export function AuditLogSection() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const shell = useShell();
  const { viewer } = useDataNav();
  const phone = shell.layout === 'phone';
  const name = auditStateOf(state, phone);
  const looking = useMemo(() => memberLooking(DATA_PEOPLE[viewer].email), [viewer]);

  return (
    <SeenBy looking={looking}>
      <AuditPage key={`${name}:${String(phone)}`} start={auditStart(name)} />
    </SeenBy>
  );
}

function AuditPage({ start }: { start: AuditStart }) {
  const shell = useShell();
  const phone = shell.layout === 'phone';
  const pane = shell.layout === 'landscape';
  const locale = formattingLocale('en', getLocales()[0]?.languageTag);
  const say = dataSayIn(locale);
  const { load, retry } = useLoad(start.load);
  const [filters, setFilters] = useState<Filters>(start.filters);
  const [menu, setMenu] = useState<Menu | null>(start.menu);
  const [dates, setDates] = useState<Range | null>(start.dates);
  const [open, setOpen] = useState<string | null>(start.open);
  const [exporting, setExporting] = useState(start.exporting);
  const [exportVisit, setExportVisit] = useState(0);
  const [datesVisit, setDatesVisit] = useState(0);
  const [preparing, setPreparing] = useState(start.preparing);
  const opener = useRef<ScreenReaderTarget | null>(null);
  const cardStep = useRef<ViewInstance>(null);

  useEffect(() => {
    if (start.toast != null) shell.tell(start.toast);
    // Once, as a linked export_small lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (load !== 'loaded')
    return (
      <DataSubPage title={A.title}>
        {load === 'failed' ? (
          <FailedBlock title={A.failed} line={H.tryLine} onRetry={retry} testID="audit.retry" />
        ) : (
          <LoadingBlock words={A.loading} />
        )}
      </DataSubPage>
    );

  const entry = entryOf(open);
  const openEvent = (id: string) => router.push(eventHref(id) as Href);

  if (phone && entry != null)
    return (
      <SummaryPage title={A.entry} back={{ label: A.back, onPress: () => setOpen(null) }}>
        <EntryRows entry={entry} say={say} onEvent={openEvent} />
      </SummaryPage>
    );

  const shown = matching(filters);
  const words = buttonWords(filters, locale);
  const card = start.locked
    ? { says: A.locked, line: A.lockedLine, step: H.contact }
    : preparing
      ? { says: A.preparing, line: A.preparingLine(shell.looking.email), step: null }
      : { says: A.says, line: A.line, step: phone ? null : A.export };
  const onStep = () => {
    if (start.locked) {
      shell.tell(H.contacting);
      return;
    }
    opener.current = cardStep.current;
    setExportVisit((count) => count + 1);
    setExporting({ format: 'csv', refused: false });
  };
  const clear = () => setFilters(NO_FILTERS);

  return (
    <>
      <DataSubPage title={A.title}>
        <SummaryCard
          size={shell.layout === 'portrait' ? 'wide' : 'page'}
          height={card.step == null ? 170 : 210}
          step={
            card.step == null
              ? null
              : { label: card.step, onPress: onStep, testID: 'audit.step', ref: cardStep }
          }
          testID="audit.card"
        >
          <CardSays text={card.says} size={pane ? 26 : 24} heading />
          <OnCard text={card.line} />
        </SummaryCard>
        {!start.locked && (
          <>
            <View style={styles.filters}>
              {(['person', 'type', 'event'] as const).map((which) => (
                <MenuButton
                  key={which}
                  which={which}
                  word={words[which]}
                  filters={filters}
                  open={menu === which}
                  onOpen={() => setMenu(which)}
                  onClose={() => setMenu(null)}
                  onChoose={(value) => {
                    setMenu(null);
                    setFilters((now) => ({ ...now, [which]: value }));
                  }}
                />
              ))}
              <DatesButton
                word={words.dates}
                onPress={(view) => {
                  opener.current = view;
                  setDatesVisit((count) => count + 1);
                  setDates(filters.range ?? SAMPLE_RANGE);
                }}
              />
              {filtered(filters) && (
                <TextAction label={A.clear} onPress={clear} testID="audit.clear" />
              )}
            </View>
            {shown.length === 0 ? (
              <View style={styles.none}>
                <Line size={15} quiet={false} text={A.none} />
                <TextAction label={A.clear} onPress={clear} testID="audit.none.clear" />
              </View>
            ) : (
              <Days
                entries={shown}
                say={say}
                onOpen={(id, view) => {
                  opener.current = view;
                  setOpen(id);
                }}
              />
            )}
          </>
        )}
      </DataSubPage>
      {!phone && (
        <EntrySheet
          entry={entry}
          say={say}
          opener={opener}
          onEvent={(id) => {
            setOpen(null);
            openEvent(id);
          }}
          onClose={() => setOpen(null)}
        />
      )}
      <DatesScreen
        key={`dates.${datesVisit}`}
        range={dates}
        opener={opener}
        locale={locale}
        onCancel={() => setDates(null)}
        onApply={(range) => {
          setDates(null);
          setFilters((now) => ({ ...now, range }));
        }}
      />
      {!phone && (
        <ExportScreen
          key={`export.${exportVisit}`}
          exporting={exporting}
          opener={opener}
          onCancel={() => setExporting(null)}
          onExport={(format) => {
            const answer = exportAnswer(start.scale);
            if (answer === 'refuse') {
              setExporting({ format, refused: true });
              return;
            }
            setExporting(null);
            if (answer === 'download') shell.tell(A.downloading(FORMAT_WORDS[format]));
            else setPreparing(true);
          }}
        />
      )}
    </>
  );
}

function Days({
  entries,
  say,
  onOpen,
}: {
  entries: readonly AuditEntry[];
  say: DataSay;
  onOpen: (id: string, view: ViewInstance | null) => void;
}) {
  const rows = useRef<Record<string, ViewInstance | null>>({});

  return (
    <>
      {byDay(entries, say).map((day) => (
        <Section key={day.key} title={day.heading}>
          <RowList
            items={day.entries.map((entry) => ({
              key: entry.id,
              inset: TIME_LEAD + tokens.spaceLg,
              row: (
                <Row
                  ref={(view) => {
                    rows.current[entry.id] = view;
                  }}
                  lead={
                    <Text size={15} weight="semibold" accessible={false} style={styles.time}>
                      {say.time(entry.at)}
                    </Text>
                  }
                  title={entry.what}
                  line={entryLine(entry)}
                  opens
                  onPress={() => onOpen(entry.id, rows.current[entry.id] ?? null)}
                  accessibilityLabel={`${say.time(entry.at)}. ${entry.what}. ${entryLine(entry)}`}
                  testID={`audit.entry.${entry.id}`}
                />
              ),
            }))}
          />
        </Section>
      ))}
    </>
  );
}

const TIME_LEAD = 48;

function MenuButton({
  which,
  word,
  filters,
  open,
  onOpen,
  onClose,
  onChoose,
}: {
  which: Menu;
  word: string;
  filters: Filters;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChoose: (value: string | null) => void;
}) {
  const trigger = useRef<ViewInstance>(null);
  const [at, setAt] = useState<Anchor | null>(null);
  const current = filters[which];

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
        label={`${MENU_NAMES[which]}: ${word}`}
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
        {menuChoices(which).map((choice) => (
          <MenuRow
            key={choice.word}
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

function DatesButton({
  word,
  onPress,
}: {
  word: string;
  onPress: (view: ViewInstance | null) => void;
}) {
  const trigger = useRef<ViewInstance>(null);

  return (
    <MenuTrigger
      ref={trigger}
      word={word}
      onPress={() => onPress(trigger.current)}
      label={`${MENU_NAMES.dates}: ${word}`}
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

/** A menu's choice: a tick on the one in use, as the switcher's menus have it. */
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

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  accent: { color: tokens.colorAccentText },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.space3xl,
  },
  none: { gap: tokens.spaceXxs, paddingTop: tokens.spaceXs },
  time: { minWidth: TIME_LEAD, fontVariant: ['tabular-nums'] },
  shrink: { flexShrink: 1, fontVariant: ['tabular-nums'] },
  pressed: { opacity: tokens.opacityPressed },
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
});
