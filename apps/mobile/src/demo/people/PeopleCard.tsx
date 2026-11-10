import { type Href, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AlertLine } from '../../components/AlertLine.tsx';
import { LineIcon } from '../../components/AccountCard.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { Text } from '../../components/Text.tsx';
import { AREA_GLYPH } from '../../components/areaGlyph.ts';
import { Row, RowList, TextAction } from '../../components/Summary.tsx';
import { tokens } from '../../theme/tokens.ts';
import { BlockHead } from '../guests/GuestsParts.tsx';
import { useLoad } from '../settings/MembersLoading.tsx';
import {
  CARD_FAILED,
  CARD_TITLE,
  type CardState,
  cardFacts,
  cardStart,
  leadLine,
  onThisEvent,
} from './PeopleCardModel.ts';
import { EMPTY_TITLE, LOADING_WORDS } from './PeopleSample.ts';

const OPENS = 'Opens People.';
/** Loading holds the count's words, its figure a bar. */
const HELD = 'on this event';

/** Overview's People (sc-29914): how many are on the event and who leads it, the whole row opening People. */
export function PeopleCard({ state }: { state: CardState | null }) {
  const start = cardStart(state);
  const { load, retry } = useLoad(start.load);
  const { count, lead } = cardFacts(start.onEvent, start.viewer);
  const mark = <LineIcon name={AREA_GLYPH.people} />;

  if (load === 'failed')
    return (
      <View testID="overview.people">
        <BlockHead title={CARD_TITLE} />
        <AlertLine text={CARD_FAILED} />
        <TextAction label="Try again" onPress={retry} testID="overview.people.retry" />
      </View>
    );

  if (load !== 'loaded')
    return (
      <View testID="overview.people">
        <BlockHead title={CARD_TITLE} />
        <Loading />
        <View style={styles.loading}>
          {mark}
          <View style={styles.bar} />
          <Text size={16} weight="semibold" style={styles.held}>
            {HELD}
          </Text>
        </View>
      </View>
    );

  const title = count === 0 ? EMPTY_TITLE : onThisEvent(count);
  const line = count === 0 || lead == null ? undefined : leadLine(lead);

  return (
    <View testID="overview.people">
      <BlockHead title={CARD_TITLE} />
      <RowList
        items={[
          {
            key: 'people',
            row: (
              <Row
                title={title}
                line={line}
                lead={mark}
                opens
                pad={4}
                onPress={() => router.push(start.href as Href)}
                accessibilityLabel={[
                  count === 0 ? title : `${title}.`,
                  line == null ? null : `Lead, ${lead}.`,
                  OPENS,
                ]
                  .filter((part) => part != null)
                  .join(' ')}
                testID="overview.people.open"
              />
            ),
          },
        ]}
      />
    </View>
  );
}

function Loading() {
  useReadOut(LOADING_WORDS);
  return null;
}

const styles = StyleSheet.create({
  loading: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
  },
  bar: { width: 24, height: 14, borderRadius: 7, backgroundColor: tokens.colorNeutralFill },
  held: { color: tokens.colorInkSecondary },
});
