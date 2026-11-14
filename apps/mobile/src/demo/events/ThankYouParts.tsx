import { hostsLine } from '@soirely/domain';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlertLine } from '../../components/AlertLine.tsx';
import type { RefFor } from '../../components/EventOverview.tsx';
import type { ScreenReaderTarget } from '../../components/screenReaderFocus.ts';
import {
  Ask,
  type AskProps,
  FocusedScreen,
  Section,
  TextAction,
} from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { ASK_WIDTH, EventField, NoteBox, useEditGap } from './EventEdits.tsx';
import type { SampleEvent } from './EventsSample.ts';
import { W, say } from './EventsWords.ts';
import {
  type Card,
  type EndField,
  THANK_YOU_MS,
  TY_WORDS,
  cleanThankYou,
  closed,
  pressedSave,
  settled,
  thankYouCount,
  thankYouOver,
  thankYouTooLong,
  typed,
} from './ThankYou.ts';

type Opener = RefObject<ScreenReaderTarget | null>;

/** sc-6476: first on a Finished event's Overview. Add, then the line with Edit; read-only without the permission to end it. */
export function ThankYouCard({
  event,
  card,
  locale,
  refFor,
  onOpen,
}: {
  event: Pick<SampleEvent, 'hosts'>;
  card: Card;
  locale: string;
  refFor: RefFor;
  onOpen: () => void;
}) {
  return (
    <Section title={TY_WORDS.title}>
      <View style={styles.body} testID="event.thankYou">
        {card.line === '' ? (
          <Text size={15} weight="medium" style={[styles.secondary, styles.lines]}>
            {TY_WORDS.hint}
          </Text>
        ) : (
          <View style={styles.line}>
            <Text size={16} weight="medium" style={styles.quote} testID="event.thankYou.line">
              {card.line}
            </Text>
            <Text size={14} weight="semibold" style={[styles.secondary, styles.signed]}>
              {hostsLine(event.hosts, locale)}
            </Text>
          </View>
        )}
        {card.canEnd && (
          <View style={styles.action}>
            <TextAction
              ref={refFor('thankYou')}
              label={card.line === '' ? TY_WORDS.add : TY_WORDS.edit}
              {...(card.line === '' ? { glyph: 'plus' as const } : {})}
              onPress={onOpen}
              testID={card.line === '' ? 'event.thankYou.add' : 'event.thankYou.edit'}
            />
          </View>
        )}
      </View>
    </Section>
  );
}

/** The field and its count: the count sits in the field's hint and is not read out as you type. */
function ThankYouField({
  draft,
  tried,
  help,
  optional,
  locale,
  autoFocus,
  onType,
  onFocus,
  onBlur,
  testID,
}: {
  draft: string;
  tried: boolean;
  help: string;
  optional: boolean;
  locale: string;
  autoFocus: boolean;
  onType: (typed: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  testID: string;
}) {
  const count = thankYouCount(draft, locale);
  const over = thankYouOver(draft);

  return (
    <View style={styles.field}>
      <EventField
        label={TY_WORDS.title}
        optional={optional}
        error={tried ? thankYouTooLong(locale) : null}
        help={help}
      >
        <NoteBox
          value={draft}
          onChangeText={onType}
          autoFocus={autoFocus}
          wrong={tried}
          placeholder={TY_WORDS.placeholder}
          accessibilityLabel={optional ? `${TY_WORDS.title} · ${W.optional}` : TY_WORDS.title}
          accessibilityHint={`${help} ${count}`}
          onFocus={onFocus}
          onBlur={onBlur}
          testID={testID}
        />
      </EventField>
      <Text
        size={13.5}
        weight={over ? 'bold' : 'medium'}
        accessible={false}
        style={[styles.count, over ? styles.over : styles.secondary]}
        testID={`${testID}.count`}
      >
        {count}
      </Text>
    </View>
  );
}

/** Add a thank-you and Edit thank-you: the app's own screen for one part, as Details' rows open theirs. */
export function ThankYouScreen({
  card,
  locale,
  opener,
  onCard,
  onSaid,
}: {
  card: Card;
  locale: string;
  opener: Opener;
  onCard: (next: Card) => void;
  onSaid: (words: string) => void;
}) {
  const gap = useEditGap();
  const [discarding, setDiscarding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const changed = card.draft !== card.line;
  const close = () => {
    setDiscarding(false);
    onCard(closed(card));
  };
  const discard: AskProps | null = discarding
    ? {
        title: W.discardTitle,
        line: W.discardLine,
        keep: { label: W.keepEditing, testID: 'event.thankYou.keep' },
        confirm: { label: W.discard, testID: 'event.thankYou.discard', removes: true },
        onKeep: () => setDiscarding(false),
        onConfirm: close,
      }
    : null;

  useEffect(
    () => () => {
      if (timer.current != null) clearTimeout(timer.current);
    },
    [],
  );

  const save = () => {
    const next = pressedSave(card);

    onCard(next);
    if (!next.busy || card.busy) return;
    timer.current = setTimeout(() => {
      const answer = settled(next);

      onCard(answer.card);
      if (answer.said === 'saved') onSaid(TY_WORDS.saved);
      if (answer.said === 'removed') onSaid(TY_WORDS.removed);
    }, THANK_YOU_MS);
  };

  return (
    <FocusedScreen
      gap={gap}
      open={card.open}
      title={card.line === '' ? TY_WORDS.add : TY_WORDS.edit}
      verb={{
        label: card.busy ? TY_WORDS.saving : W.save,
        on: changed,
        busy: card.busy,
        onPress: save,
        testID: 'event.thankYou.save',
      }}
      waits={card.busy}
      onCancel={() => (changed ? setDiscarding(true) : close())}
      cancelTestID="event.thankYou.cancel"
      opener={opener}
      ask={discard && { ...discard, width: ASK_WIDTH }}
      testID="event.thankYou.screen"
    >
      <ThankYouField
        draft={card.draft}
        tried={card.tried}
        help={card.line === '' ? TY_WORDS.hint : TY_WORDS.remove}
        optional={false}
        locale={locale}
        autoFocus
        onType={(text) => onCard(typed(card, text))}
        testID="event.thankYou.field"
      />
      {card.failed && <AlertLine text={TY_WORDS.notSaved} />}
    </FocusedScreen>
  );
}

/** End {event} now?, with the optional thank-you: one request ends it and saves the line. */
export function EndNowAsk({
  open,
  name,
  start,
  locale,
  opener,
  onKeep,
  onEnded,
}: {
  open: boolean;
  name: string;
  start: EndField;
  locale: string;
  opener: Opener;
  onKeep: () => void;
  onEnded: (line: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [field, setField] = useState(start);
  const [typing, setTyping] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current != null) clearTimeout(timer.current);
    },
    [],
  );

  const go = () => {
    if (field.busy) return;
    if (thankYouOver(field.draft)) {
      setField({ ...field, tried: true, failed: false });
      return;
    }
    setField({ ...field, busy: true, failed: false });
    const line = cleanThankYou(field.draft);
    timer.current = setTimeout(() => onEnded(line), THANK_YOU_MS);
  };

  return (
    <Ask
      open={open}
      opener={opener}
      title={say.endTitle(name)}
      line={W.endBody}
      keep={{ label: W.keepItOn, off: field.busy, testID: 'event.ask.endNow.keep' }}
      confirm={{
        label: W.endNow,
        removes: true,
        busy: field.busy ? TY_WORDS.ending : undefined,
        testID: 'event.ask.endNow.confirm',
      }}
      failed={
        field.failed
          ? cleanThankYou(field.draft) === ''
            ? TY_WORDS.notEndedPlain
            : TY_WORDS.notEnded
          : null
      }
      body={
        <ThankYouField
          draft={field.draft}
          tried={field.tried}
          help={TY_WORDS.hint}
          optional
          locale={locale}
          autoFocus={start.tried}
          onType={(text) =>
            setField({ ...field, draft: text, tried: field.tried && thankYouOver(text) })
          }
          onFocus={() => setTyping(true)}
          onBlur={() => setTyping(false)}
          testID="event.ask.endNow.field"
        />
      }
      top={typing ? insets.top + tokens.spaceLg : null}
      width={ASK_WIDTH}
      onKeep={() => {
        if (!field.busy) onKeep();
      }}
      onConfirm={go}
      testID="event.ask.endNow"
    />
  );
}

const styles = StyleSheet.create({
  body: { gap: tokens.spaceSm },
  secondary: { color: tokens.colorInkSecondary },
  lines: { lineHeight: 15 * 1.45 },
  line: {
    gap: tokens.spaceSm,
    paddingVertical: 14,
    paddingHorizontal: tokens.spaceLg,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInset,
  },
  quote: { lineHeight: 16 * 1.5, writingDirection: 'auto' },
  signed: { lineHeight: 14 * 1.4 },
  action: { alignItems: 'flex-start' },
  field: { gap: tokens.spaceXxs },
  count: { alignSelf: 'flex-end', fontVariant: ['tabular-nums'] },
  over: { color: tokens.colorBrokenText },
});
