import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';

import { Glyph, type GlyphName } from '../../components/Glyph.tsx';
import { ReadOut } from '../../components/ReadOut.tsx';
import { moveScreenReaderFocus } from '../../components/screenReaderFocus.ts';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { DATA_PEOPLE } from './DataModel.ts';
import { useDataNav } from './DataParts.tsx';
import { ASK_WORDS as W } from './DataWords.ts';
import {
  ASKS,
  type AskNow,
  answerAsk,
  answered,
  askStart,
  lockStepOf,
  mayAsk,
  showsButton,
} from './EnterpriseAsk.ts';

const ASK_MS = 700;
const OWNERS = Object.values(DATA_PEOPLE).filter((person) => person.owns).length;

/** The step on a locked Enterprise card (sc-72241): the line for an owner, Ask an owner for an admin. */
export function EnterpriseStep({ testID }: { testID: string }) {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const { viewer } = useDataNav();
  const step = lockStepOf(DATA_PEOPLE[viewer]);

  if (step === 'line')
    return (
      <Text
        size={15}
        weight="semibold"
        style={[styles.end, styles.white]}
        testID={`${testID}.line`}
      >
        {W.appLine}
      </Text>
    );
  if (step === 'ask') return <AskStep key={state} start={askStart(state)} testID={testID} />;
  return null;
}

function AskStep({ start, testID }: { start: AskNow; testID: string }) {
  const [ask, setAsk] = useState<AskNow>(start);
  const told = useRef<ViewInstance>(null);
  const pressed = useRef(false);
  const answer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (answer.current != null) clearTimeout(answer.current);
    },
    [],
  );
  useEffect(() => {
    if ((ask.now !== 'sent' && ask.now !== 'asked') || !pressed.current) return undefined;
    const later = setTimeout(() => moveScreenReaderFocus(told.current), 350);

    return () => clearTimeout(later);
  }, [ask]);

  const press = () => {
    if (!mayAsk(ask)) return;
    pressed.current = true;
    setAsk({ now: 'sending' });
    answer.current = setTimeout(() => {
      const at = Date.now();
      const said = answerAsk(ASKS.lastAt, at, OWNERS);
      if (said !== 'failed' && 'sent' in said) ASKS.lastAt = at;
      setAsk(answered(said));
    }, ASK_MS);
  };
  const sending = ask.now === 'sending';

  return (
    <View style={[styles.end, styles.ask]}>
      {showsButton(ask) && (
        <Pressable
          onPress={sending ? undefined : press}
          style={({ pressed: down }) => [styles.button, down && !sending && styles.down]}
          accessibilityRole="button"
          accessibilityLabel={W.ask}
          accessibilityState={{ disabled: sending, busy: sending }}
          testID={`${testID}.ask`}
        >
          <Text size={15} weight="semibold" accessible={false} style={styles.accent}>
            {W.ask}
          </Text>
        </Pressable>
      )}
      {ask.now === 'notSent' && (
        <Said
          words={W.notSent}
          glyph="alert"
          ink={tokens.colorBroken}
          broken
          testID={`${testID}.notSent`}
        />
      )}
      {ask.now === 'asked' && (
        <View ref={told} accessible accessibilityLabel={W.asked[ask.owners]}>
          <Said
            words={W.asked[ask.owners]}
            glyph="info"
            ink={tokens.colorInkSecondary}
            testID={`${testID}.asked`}
          />
        </View>
      )}
      {ask.now === 'sent' && (
        <View ref={told} accessible accessibilityLabel={W.sent[ask.owners]}>
          <Said
            words={W.sent[ask.owners]}
            glyph="tick"
            ink={tokens.colorAccentText}
            status
            testID={`${testID}.sent`}
          />
        </View>
      )}
    </View>
  );
}

function Said({
  words,
  glyph,
  ink,
  broken = false,
  status = false,
  testID,
}: {
  words: string;
  glyph: GlyphName;
  ink: string;
  broken?: boolean;
  status?: boolean;
  testID: string;
}) {
  return (
    <ReadOut
      words={words}
      interrupts={!status}
      accessibilityRole={status ? undefined : 'alert'}
      style={styles.said}
      testID={testID}
    >
      <View style={styles.mark}>
        <Glyph name={glyph} size={16} ink={ink} weight={2.4} />
      </View>
      <Text
        size={14.5}
        weight="semibold"
        accessible={false}
        style={[styles.grow, broken ? styles.broken : styles.ink]}
      >
        {words}
      </Text>
    </ReadOut>
  );
}

const styles = StyleSheet.create({
  end: { marginTop: 'auto' },
  white: { color: tokens.colorInkOnDark },
  ask: { alignSelf: 'stretch', alignItems: 'flex-start', gap: tokens.spaceMd },
  button: {
    minHeight: tokens.sizeHit,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: tokens.sizeHit / 2,
    backgroundColor: tokens.colorCard,
  },
  down: { opacity: tokens.opacityPressed },
  accent: { color: tokens.colorAccentText },
  said: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceMd,
    paddingVertical: tokens.spaceMd,
    paddingHorizontal: 14,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorCard,
  },
  mark: { paddingTop: 2 },
  grow: { flex: 1, minWidth: 0, lineHeight: 14.5 * 1.4 },
  ink: { color: tokens.colorInk },
  broken: { color: tokens.colorBrokenText },
});
