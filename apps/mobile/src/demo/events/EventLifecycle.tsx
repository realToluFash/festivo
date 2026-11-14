import { addDays, copyEndsLine, typedNameMatches } from '@soirely/domain';
import { type RefObject, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { ASK_WIDTH, EventField, useEditGap } from './EventEdits.tsx';
import { wallOf } from './EventsModel.ts';
import {
  BoxField,
  MomentBox,
  type Picking,
  PickerLayer,
  pick,
} from '../../components/MomentPick.tsx';
import { type Refusal, type RefusedVerb, refusalWords } from './DeleteRefusal.ts';
import { ORGANISATION, RESTORE_UNTIL, type SampleEvent } from './EventsSample.ts';
import { W, say, t } from './EventsWords.ts';
import { figureOf } from './GuestCounts.ts';
import { Ask, type AskProps, FocusedScreen, SectionHead } from '../../components/Summary.tsx';

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
      width={ASK_WIDTH}
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

/** Delete event, refused while a guest is Invited (sc-14445): A's alert in place of the name, with the page's own Call off or End now, or who can. */
export function RefusedAsk({
  open,
  refusal,
  name,
  opener,
  onKeep,
  onVerb,
}: {
  open: boolean;
  refusal: Refusal;
  name: string;
  opener: Opener;
  onKeep: () => void;
  onVerb: (verb: RefusedVerb) => void;
}) {
  const words = refusalWords(refusal, name, ORGANISATION);

  return (
    <Ask
      open={open}
      opener={opener}
      title={words.title}
      line={words.line}
      body={
        words.who == null ? undefined : (
          <Text size={15} weight="medium" style={styles.lines} testID="event.refused.who">
            {words.who}
          </Text>
        )
      }
      keep={{ label: W.keepIt, testID: 'event.refused.keep' }}
      confirm={
        words.verb == null
          ? null
          : { label: words.verb, testID: 'event.refused.confirm', removes: true }
      }
      width={ASK_WIDTH}
      onKeep={onKeep}
      onConfirm={() => onVerb(refusal.verb)}
      testID="event.refused"
    />
  );
}

export type DeleteStart = 'delete' | 'deleteMismatch' | 'deleteTyped';

/** Delete by its name, for anything that has been live or has anybody on its list: Delete stays off until the name matches. */
export function DeleteScreen({
  open,
  event,
  people,
  start,
  opener,
  onClose,
  onDeleted,
}: {
  open: boolean;
  event: SampleEvent;
  people: number;
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
  const gap = useEditGap();

  return (
    <FocusedScreen
      gap={gap}
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
        <Text size={15} weight="semibold" style={styles.lines}>
          {W.removes}
        </Text>
        <Text size={15} weight="medium" style={styles.bullet}>
          {`• ${W.removesEvent}`}
        </Text>
        {people > 0 && (
          <Text size={15} weight="medium" style={styles.bullet} testID="event.delete.guests">
            {`• ${say.removesGuests(figureOf(people), people)}`}
          </Text>
        )}
      </View>
      <Text size={15} weight="medium" style={[styles.secondary, styles.lines]}>
        {W.deleteGuests}
      </Text>
      <Text size={15} weight="medium" style={[styles.secondary, styles.lines]}>
        {say.deleteWindow(RESTORE_UNTIL)}
      </Text>
      <EventField
        label={say.deleteType(event.name)}
        error={mismatch ? say.deleteMismatch(event.name) : null}
        help={mismatch ? undefined : W.typeHint}
      >
        <BoxField
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
      </EventField>
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
    date: addDays(begins.date, 52 * 7),
    time: begins.time,
  });
  const [picking, setPicking] = useState<Picking | null>(null);
  const choose = (mode: 'date' | 'time') =>
    pick({ title: say.timesIn(event.timeZone), mode, field: starts, take: setStarts }, setPicking);
  const gap = useEditGap();

  return (
    <FocusedScreen
      gap={gap}
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
      <Text size={15} weight="medium" style={[styles.secondary, styles.lines]}>
        {W.duplicateLine}
      </Text>
      <Listed title={W.copied} items={W.copiedList} />
      <Listed title={W.notCopied} items={W.notCopiedList} />
      <View style={styles.starts}>
        <Text size={14} weight="semibold" style={styles.label}>
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
      <Text size={14} weight="medium" style={[styles.secondary, styles.said]}>
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
  title: { letterSpacing: 22 * -0.015, lineHeight: 22 * 1.2 },
  tight: { gap: tokens.spaceHair },
  bullet: { lineHeight: 15 * 1.45 },
  lines: { lineHeight: 15 * 1.45 },
  label: { lineHeight: 14 * 1.3 },
  said: { lineHeight: 14 * 1.45 },
  starts: { gap: 7 },
  pair: { flexDirection: 'row', gap: tokens.spaceSm },
});
