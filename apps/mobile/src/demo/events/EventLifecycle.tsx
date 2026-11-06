import { copyEndsLine, typedNameMatches } from '@soirely/domain';
import { type RefObject, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Field, TextField } from '../../components/Field.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { Ask, type AskProps, FocusedScreen, SectionHead } from '../settings/Summary.tsx';
import { wallOf } from './EventsModel.ts';
import { MomentBox, type Picking, PickerLayer, pick } from './EventsPick.tsx';
import { RESTORE_UNTIL, type SampleEvent } from './EventsSample.ts';
import { W, say, t } from './EventsWords.ts';

type Opener = RefObject<ScreenReaderTarget | null>;

export type LifeAsk = 'pause' | 'callOff' | 'endNow' | 'deleteDraft';

/** The lifecycle's questions: what happens, the way back first, and the verb, red when it cannot be undone. */
export function LifecycleAsk({
  ask,
  name,
  opener,
  onKeep,
  onConfirm,
}: {
  ask: LifeAsk | null;
  name: string;
  opener: Opener;
  onKeep: () => void;
  onConfirm: (ask: LifeAsk) => void;
}) {
  const [shown, setShown] = useState<LifeAsk>(ask ?? 'pause');
  if (ask != null && ask !== shown) setShown(ask);
  const words = asked(shown, name);

  return (
    <Ask
      open={ask != null}
      opener={opener}
      {...words}
      onKeep={onKeep}
      onConfirm={() => onConfirm(shown)}
      testID={`event.ask.${shown}`}
    />
  );
}

function asked(ask: LifeAsk, name: string): Omit<AskProps, 'onKeep' | 'onConfirm'> {
  const testID = `event.ask.${ask}`;

  switch (ask) {
    case 'pause':
      return {
        title: say.pauseTitle(name),
        line: W.pauseBody,
        keep: { label: W.keepItLive, testID: `${testID}.keep` },
        confirm: { label: W.pause, testID: `${testID}.confirm` },
      };
    case 'callOff':
      return {
        title: say.callOffTitle(name),
        line: W.callOffBody,
        keep: { label: W.keepItOn, testID: `${testID}.keep` },
        confirm: { label: W.callOff, testID: `${testID}.confirm`, removes: true },
      };
    case 'endNow':
      return {
        title: say.endTitle(name),
        line: W.endBody,
        keep: { label: W.keepItOn, testID: `${testID}.keep` },
        confirm: { label: W.endNow, testID: `${testID}.confirm`, removes: true },
      };
    case 'deleteDraft':
      return {
        title: say.deleteTitle(name),
        line: W.draftBody,
        keep: { label: W.keepIt, testID: `${testID}.keep` },
        confirm: { label: W.delete, testID: `${testID}.confirm`, removes: true },
      };
  }
}

export type DeleteStart = 'delete' | 'deleteMismatch' | 'deleteTyped';

/** Delete by its name, for anything that has been live: Delete stays off until the name matches. */
export function DeleteScreen({
  open,
  event,
  start,
  opener,
  onClose,
  onDeleted,
}: {
  open: boolean;
  event: SampleEvent;
  start: DeleteStart | null;
  opener: Opener;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [typed, setTyped] = useState(
    start === 'deleteTyped'
      ? event.name
      : start === 'deleteMismatch'
        ? event.name.replace('’s', 's').replace('&', 'and')
        : '',
  );
  const [left, setLeft] = useState(start === 'deleteMismatch');
  const matches = typedNameMatches(typed, event.name);
  const mismatch = left && typed !== '' && !matches;

  return (
    <FocusedScreen
      open={open}
      title={W.deleteEvent}
      verb={{
        label: W.delete,
        on: matches,
        onPress: onDeleted,
        removes: true,
        testID: 'event.delete.confirm',
      }}
      onCancel={onClose}
      cancelTestID="event.delete.cancel"
      opener={opener}
      testID="event.delete"
    >
      <Text size={22} weight="bold" accessibilityRole="header" style={styles.title}>
        {say.deleteTitle(event.name)}
      </Text>
      <View style={styles.tight}>
        <Text size={15} weight="semibold">
          {W.removes}
        </Text>
        <Text size={15} weight="medium" style={styles.bullet}>
          {`• ${W.removesEvent}`}
        </Text>
      </View>
      <Text size={15} weight="medium" style={styles.secondary}>
        {W.deleteGuests}
      </Text>
      <Text size={15} weight="medium" style={styles.secondary}>
        {say.deleteWindow(RESTORE_UNTIL)}
      </Text>
      <Field
        label={say.deleteType(event.name)}
        error={mismatch ? say.deleteMismatch(event.name) : null}
        help={mismatch ? undefined : W.typeHint}
      >
        <TextField
          value={typed}
          wrong={mismatch}
          autoFocus={start !== 'deleteMismatch'}
          autoCorrect={false}
          autoCapitalize="none"
          onChangeText={(text) => {
            setTyped(text);
            if (typedNameMatches(text, event.name)) setLeft(false);
          }}
          onBlur={() => setLeft(true)}
          accessibilityLabel={say.deleteType(event.name)}
          testID="event.delete.field"
        />
      </Field>
    </FocusedScreen>
  );
}

/** Duplicate makes a draft: what is copied and what is not, and the copy's start with its end worked out. */
export function DuplicateScreen({
  open,
  event,
  locale,
  opener,
  onClose,
  onCreated,
}: {
  open: boolean;
  event: SampleEvent;
  locale: string;
  opener: Opener;
  onClose: () => void;
  onCreated: () => void;
}) {
  const begins = wallOf(event.startsAt, event.timeZone);
  const [starts, setStarts] = useState({
    date: `${Number(begins.date.slice(0, 4)) + 1}${begins.date.slice(4)}`,
    time: begins.time,
  });
  const [picking, setPicking] = useState<Picking | null>(null);
  const choose = (mode: 'date' | 'time') =>
    pick({ title: say.timesIn(event.timeZone), mode, field: starts, take: setStarts }, setPicking);

  return (
    <FocusedScreen
      open={open}
      title={W.duplicate}
      verb={{
        label: W.createDraft,
        on: true,
        onPress: onCreated,
        testID: 'event.duplicate.create',
      }}
      onCancel={onClose}
      cancelTestID="event.duplicate.cancel"
      opener={opener}
      over={
        picking == null
          ? null
          : {
              layer: (
                <PickerLayer picking={picking} locale={locale} onClose={() => setPicking(null)} />
              ),
              onClose: () => setPicking(null),
            }
      }
      testID="event.duplicate"
    >
      <Text size={22} weight="bold" accessibilityRole="header" style={styles.title}>
        {say.duplicateTitle(event.name)}
      </Text>
      <Text size={15} weight="medium" style={styles.secondary}>
        {W.duplicateLine}
      </Text>
      <Listed title={W.copied} items={W.copiedList} />
      <Listed title={W.notCopied} items={W.notCopiedList} />
      <View style={styles.starts}>
        <Text size={14} weight="semibold">
          {W.starts}
        </Text>
        <View style={styles.pair}>
          <MomentBox
            label={`${W.starts}, ${W.date}`}
            mode="date"
            value={starts.date}
            locale={locale}
            onPress={() => choose('date')}
            testID="event.duplicate.date"
          />
          <MomentBox
            label={`${W.starts}, ${W.time}`}
            mode="time"
            value={starts.time}
            locale={locale}
            width={104}
            onPress={() => choose('time')}
            testID="event.duplicate.time"
          />
        </View>
      </View>
      <Text size={14} weight="medium" style={styles.secondary}>
        {copyEndsLine(starts.date, starts.time, event, locale, t)}
      </Text>
    </FocusedScreen>
  );
}

function Listed({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <View>
      <SectionHead title={title} />
      {items.map((item) => (
        <Text key={item} size={15} weight="medium" style={styles.bullet}>
          {`• ${item}`}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  title: { letterSpacing: 22 * -0.015 },
  tight: { gap: tokens.spaceHair },
  bullet: { paddingLeft: tokens.spaceXxs },
  starts: { gap: 7 },
  pair: { flexDirection: 'row', gap: tokens.spaceSm },
});
