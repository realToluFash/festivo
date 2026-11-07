import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { useReadOut } from '../../components/ReadOut.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { useShell } from './Frame.tsx';
import { ColoursScreen } from './PersonalisationColours.tsx';
import {
  cardLine,
  type Colours,
  heldChoice,
  holdChoice,
  inUse,
  PERSONALISATION_TITLE,
  type PersonalisationState,
  personalisationStart,
  personalisationStateOf,
  restartTold,
  sampleClient,
  WORDS,
} from './PersonalisationModel.ts';
import { SchemeCard } from './PersonalisationParts.tsx';
import { FailedBlock, SummaryPage } from './Summary.tsx';

/** Settings › Personalisation in A · Swatches, on a sample account the demo never writes to. */
export function PersonalisationSection() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const shown = personalisationStateOf(state);

  return <PersonalisationScreen key={shown ?? 'atRest'} state={shown} />;
}

function PersonalisationScreen({ state }: { state: PersonalisationState | null }) {
  const shell = useShell();
  const { tell } = shell;
  const [start] = useState(() => personalisationStart(state, heldChoice()));
  const [client] = useState(() => sampleClient(state, start.choice));
  const [choice, setChoice] = useState(start.choice);
  const [load, setLoad] = useState(start.load);
  const [saved, setSaved] = useState(start.saved);
  const [open, setOpen] = useState(start.colours != null);
  const [colours, setColours] = useState<Colours>(
    start.colours ?? { picked: inUse(start.choice), phase: 'choosing' },
  );
  const [sending, setSending] = useState(start.colours?.phase === 'saving' ? 1 : 0);
  const [attempt, setAttempt] = useState(start.load === 'loading' ? 1 : 0);
  const [visit, setVisit] = useState(0);
  const step = useRef<ViewInstance>(null);
  const current = inUse(choice);
  const { picked } = colours;

  useEffect(() => {
    if (state != null && start.load === 'loaded') holdChoice(start.choice);
  }, [state, start]);

  useEffect(() => {
    if (attempt === 0) return;
    let live = true;
    void client.read().then((read) => {
      if (!live) return;
      setChoice(read);
      setLoad('loaded');
    });

    return () => {
      live = false;
    };
  }, [attempt, client]);

  useEffect(() => {
    if (sending === 0) return;
    let live = true;
    void client.save(picked).then((answer) => {
      if (!live) return;
      setSending(0);
      if (!answer.saved) {
        setColours((now) => ({ ...now, phase: answer.refusal }));
        return;
      }
      holdChoice(answer.choice);
      setChoice(answer.choice);
      setSaved(true);
      setColours({ picked: answer.choice, phase: 'choosing' });
      setOpen(false);
    });

    return () => {
      live = false;
    };
  }, [sending, picked, client]);

  useEffect(() => {
    if (saved) tell(restartTold(current));
  }, [saved, current, tell]);

  useReadOut(load === 'loading' ? WORDS.loading : null);

  function openColours(): void {
    setVisit((count) => count + 1);
    setColours({ picked: current, phase: 'choosing' });
    setOpen(true);
  }

  function save(): void {
    setColours((now) => ({ ...now, phase: 'saving' }));
    setSending((count) => count + 1);
  }

  return (
    <>
      <SummaryPage title={PERSONALISATION_TITLE}>
        {load === 'loading' && <Loading />}
        {load === 'failed' && (
          <FailedBlock
            title={WORDS.notLoaded}
            line={WORDS.notLoadedLine}
            onRetry={() => {
              setLoad('loading');
              setAttempt((tries) => tries + 1);
            }}
            testID="personalisation.tryAgainLoad"
          />
        )}
        {load === 'loaded' && (
          <>
            <SchemeCard
              scheme={current}
              line={cardLine(choice, saved)}
              wide={shell.layout === 'portrait'}
              stepRef={step}
              onChoose={openColours}
            />
            <View style={styles.lines}>
              <Text size={14} weight="medium" style={styles.quiet}>
                {WORDS.follows}
              </Text>
              <Text size={14} weight="medium" style={styles.quiet}>
                {WORDS.keeps}
              </Text>
            </View>
          </>
        )}
      </SummaryPage>
      <ColoursScreen
        key={visit}
        open={open}
        colours={colours}
        current={current}
        opener={step}
        onPick={(scheme) => setColours({ picked: scheme, phase: 'choosing' })}
        onSave={save}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

const BARS = ['86%', '64%', '78%'] as const;

/** The card's shape and the section's lines while the account answers; Loading… is read out. */
function Loading() {
  return (
    <View
      style={styles.loading}
      accessible
      accessibilityLabel={WORDS.loading}
      accessibilityState={{ busy: true }}
    >
      <View style={styles.sunkCard} />
      <View style={styles.bars}>
        {BARS.map((width) => (
          <View key={width} style={[styles.bar, { width }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lines: { gap: tokens.spaceSm },
  quiet: { lineHeight: Math.round(14 * 1.45), color: tokens.colorInkSecondary },
  loading: { gap: 18 },
  sunkCard: { height: 200, borderRadius: 26, backgroundColor: tokens.colorNeutralFill },
  bars: { gap: tokens.spaceMd },
  bar: { height: 13, borderRadius: 7, backgroundColor: tokens.colorNeutralFill },
});
