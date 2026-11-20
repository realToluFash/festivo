import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';

import { SecondaryButton } from '../../components/Buttons.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { Notice } from '../../components/Notice.tsx';
import { moveScreenReaderFocus } from '../../components/screenReaderFocus.ts';
import { Skeleton } from '../../components/Skeleton.tsx';
import { HeadCount, Row, RowList, Section } from '../../components/SummaryRows.tsx';
import { Text } from '../../components/Text.tsx';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { WORDS } from './StaffLinkModel.ts';
import { StatusShape } from './StaffLinkScreen.tsx';
import {
  LIVE_CHANGE,
  LIVE_MS,
  type OnRoster,
  RW,
  type RosterState,
  type Shown,
  keep,
  resetKept,
  rosterOrder,
  rowLine,
  sampleRoster,
  shownOf,
  withKept,
} from './StaffRosterModel.ts';

const RETRY_MS = 1200;

const SHOWN_WORDS: Record<Shown, string> = { ...WORDS, noMobile: RW.noMobile, erased: RW.erased };

type Phase = 'loading' | 'failed' | 'ready';

/** The event's Staff in the app (sc-77903): the roster to read, in sc-3906's order, each person opening their own link. */
export function StaffRoster({ state }: { state: RosterState }) {
  const [phase, setPhase] = useState<Phase>(
    state === 'loading' ? 'loading' : state === 'failed' ? 'failed' : 'ready',
  );
  const [answer, setAnswer] = useState(0);
  const [people, setPeople] = useState<OnRoster[]>(() => {
    resetKept();
    return state === 'empty' ? [] : rosterOrder(sampleRoster());
  });
  const rows = useRef<Partial<Record<string, ViewInstance | null>>>({});
  const head = useRef<ViewInstance | null>(null);
  const opened = useRef<string | null>(null);
  const erased = state === 'erased';
  const manage = state !== 'readOnly';

  const reread = useCallback(() => {
    if (state !== 'empty') setPeople(rosterOrder(withKept(sampleRoster())));
  }, [state]);

  useFocusEffect(
    useCallback(() => {
      reread();
      const id = opened.current;
      if (id == null) return undefined;
      opened.current = null;
      const timer = setTimeout(() => moveScreenReaderFocus(rows.current[id] ?? head.current), 350);
      return () => clearTimeout(timer);
    }, [reread]),
  );

  const webChange = useCallback(() => {
    keep(LIVE_CHANGE.id, LIVE_CHANGE.status, LIVE_CHANGE.trail);
    reread();
  }, [reread]);

  useEffect(() => {
    if (state !== 'live' || phase !== 'ready') return undefined;
    const timer = setTimeout(webChange, LIVE_MS);
    return () => clearTimeout(timer);
  }, [state, phase, webChange]);

  useEffect(() => {
    if (phase !== 'loading' || state === 'loading') return undefined;
    const timer = setTimeout(() => setPhase('ready'), RETRY_MS);
    return () => clearTimeout(timer);
  }, [phase, state]);

  function open(person: OnRoster): void {
    opened.current = person.id;
    const view = erased ? '&view=erased' : manage ? '' : '&view=read';
    router.push(`/demo/staff-link?person=${person.id}${view}`);
  }

  let body;
  if (phase === 'loading')
    body = <Skeleton shape="rows" rowHeight={64} rows={6} words={RW.loading} />;
  else if (phase === 'failed')
    body = (
      <View style={styles.failed} testID="staff.failed">
        <Notice tone="broken" mark="alert" body={RW.failed} answer={answer} />
        <SecondaryButton
          label={RW.tryAgain}
          onPress={() => {
            setAnswer((n) => n + 1);
            setPhase('loading');
          }}
          testID="staff.retry"
        />
      </View>
    );
  else if (people.length === 0)
    body = (
      <View style={styles.empty} testID="staff.empty">
        <Text size={17} weight="semibold" accessibilityRole="header">
          {RW.empty}
        </Text>
        <Text size={15} weight="medium" style={styles.secondary}>
          {RW.emptyLine}
        </Text>
      </View>
    );
  else
    body = (
      <>
        {!manage && (
          <View style={styles.lock} testID="staff.readOnly">
            <Glyph name="lock" size={16} ink={tokens.colorInkSecondary} />
            <Text size={15} weight="medium" style={[styles.secondary, styles.shrink]}>
              {RW.lock}
            </Text>
          </View>
        )}
        <RowList
          items={people.map((person) => {
            const shown = shownOf(person, erased);
            const word = SHOWN_WORDS[shown];
            const line = rowLine(person);

            return {
              key: person.id,
              row: (
                <Row
                  ref={(view) => {
                    rows.current[person.id] = view;
                  }}
                  title={person.name}
                  line={line}
                  below={
                    <View style={styles.status}>
                      <StatusShape shape={shown} side={14} />
                      <Text
                        size={14}
                        weight="semibold"
                        accessible={false}
                        style={[styles.shrink, shown === 'noMobile' && styles.attention]}
                      >
                        {word}
                      </Text>
                    </View>
                  }
                  opens
                  onPress={() => open(person)}
                  accessibilityLabel={`${person.name}. ${line}. ${word}`}
                  testID={`staff.row.${person.id}`}
                />
              ),
            };
          })}
        />
      </>
    );

  return (
    <View style={styles.page} testID={`staff.${state}`}>
      <View ref={head} accessible={false}>
        <Section
          title={RW.roster}
          right={
            phase === 'ready' && people.length > 0 ? (
              <HeadCount text={RW.people(people.length)} />
            ) : undefined
          }
        >
          {body}
        </Section>
      </View>
      <DemoOnly title="Demo only: the board’s switches">
        <SecondaryButton
          label="A change on the web: Amina Yusuf’s link sent"
          onPress={webChange}
          testID="staff.demo.web"
        />
        <SecondaryButton
          label="The roster fails to load"
          onPress={() => setPhase('failed')}
          testID="staff.demo.fails"
        />
        <SecondaryButton
          label="Start again"
          onPress={() => {
            resetKept();
            setPhase(state === 'loading' ? 'loading' : state === 'failed' ? 'failed' : 'ready');
            setPeople(state === 'empty' ? [] : rosterOrder(sampleRoster()));
          }}
          testID="staff.demo.reset"
        />
      </DemoOnly>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: tokens.spaceXl },
  secondary: { color: tokens.colorInkSecondary },
  attention: { color: tokens.colorAttentionText },
  shrink: { flexShrink: 1 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingTop: tokens.spaceXs,
  },
  lock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceSm,
    paddingBottom: tokens.spaceSm,
  },
  failed: { gap: tokens.spaceMd, alignItems: 'flex-start' },
  empty: {
    gap: tokens.spaceXxs,
    paddingVertical: 18,
    paddingHorizontal: tokens.spaceXxl,
    borderRadius: tokens.radiusCardLarge,
    backgroundColor: tokens.colorInset,
  },
});
