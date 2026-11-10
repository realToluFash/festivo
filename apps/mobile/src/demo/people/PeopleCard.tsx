import { type Href, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AlertLine } from '../../components/AlertLine.tsx';
import { LineIcon } from '../../components/AccountCard.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { Row, TextAction } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { W } from '../events/EventsWords.ts';
import { BlockHead } from '../guests/GuestsParts.tsx';
import {
  CARD_FAILED,
  type CardState,
  ON_THIS_EVENT,
  PEOPLE_TITLE,
  cardSays,
} from './PeopleCardModel.ts';
import { HELD_MS, LOADING_WORDS, SAVE_MS } from './PeopleSample.ts';

/** Overview's People (sc-29914): how many are on the event and who leads it, the whole row opening People. */
export function PeopleCard({ state }: { state: CardState }) {
  const [now, setNow] = useState(state);

  useEffect(() => {
    if (now !== 'loading') return undefined;
    const timer = setTimeout(() => setNow('people'), state === 'loading' ? HELD_MS : SAVE_MS);

    return () => clearTimeout(timer);
  }, [now, state]);

  if (now === 'failed')
    return (
      <View testID="overview.people">
        <BlockHead title={PEOPLE_TITLE} />
        <AlertLine text={CARD_FAILED} />
        <TextAction
          label={W.tryAgain}
          onPress={() => setNow('loading')}
          testID="overview.people.retry"
        />
      </View>
    );

  if (now === 'loading')
    return (
      <View testID="overview.people">
        <BlockHead title={PEOPLE_TITLE} />
        <Loading />
        <View
          style={styles.row}
          accessible
          accessibilityLabel={LOADING_WORDS}
          testID="overview.people.loading"
        >
          <LineIcon name="people" />
          <View style={styles.words}>
            <View style={styles.held}>
              <View style={styles.count} />
              <Text size={16} weight="semibold" accessible={false}>
                {ON_THIS_EVENT}
              </Text>
            </View>
            <View style={styles.line} />
          </View>
        </View>
      </View>
    );

  const says = cardSays(now);

  return (
    <View testID="overview.people">
      <BlockHead title={PEOPLE_TITLE} />
      <Row
        title={says.title}
        line={says.line ?? undefined}
        lead={<LineIcon name="people" />}
        opens
        pad={tokens.spaceXxs}
        onPress={() => router.push(says.href as Href)}
        accessibilityRole="link"
        accessibilityLabel={says.label}
        testID="overview.people.open"
      />
    </View>
  );
}

function Loading() {
  useReadOut(LOADING_WORDS);
  return null;
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    paddingVertical: tokens.spaceXxs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
  },
  words: { flex: 1, minWidth: 0, gap: tokens.spaceXs },
  held: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  count: { width: 22, height: 14, borderRadius: 7, backgroundColor: tokens.colorNeutralFill },
  line: { width: 132, height: 12, borderRadius: 6, backgroundColor: tokens.colorNeutralFill },
});
