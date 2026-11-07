import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useReadOut } from '../../components/ReadOut.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { AlertLine } from '../events/EventEdits.tsx';
import { LineIcon } from '../settings/AccountCard.tsx';
import { Row, RowList, TextAction } from '../settings/Summary.tsx';
import { type FilterKey, type OverviewState, countsOf, filterWord } from './GuestsModel.ts';
import { BlockHead } from './GuestsParts.tsx';
import { GUESTS } from './GuestsSample.ts';
import { W, say } from './GuestsWords.ts';
import { MarkSlot, ReplyMark } from './ReplyMark.tsx';

const COUNTED = ['invited', 'coming', 'notcoming', 'maybe', 'noreply', 'held'] as const;

/** Overview's Guests (sc-3786): the six exclusive counts as rows, each opening the guests it counts, and who is not yet invited. */
export function GuestNumbers({
  state,
  onOpen,
}: {
  state: OverviewState;
  onOpen: (filter: FilterKey) => void;
}) {
  const [now, setNow] = useState(state);
  const counts = countsOf(GUESTS);
  const open = (
    <TextAction
      label={W.openGuestList}
      onPress={() => onOpen('all')}
      testID="overview.guests.open"
    />
  );

  if (now === 'overviewViewer') return null;
  if (now === 'overviewFailed')
    return (
      <View testID="overview.guests">
        <BlockHead title={W.guests} />
        <AlertLine text={W.numbersFailed} />
        <TextAction
          label={W.tryAgain}
          onPress={() => setNow('overview')}
          testID="overview.guests.retry"
        />
      </View>
    );
  if (now === 'overviewNone')
    return (
      <View testID="overview.guests">
        <BlockHead title={W.guests} />
        <Text size={16} weight="semibold" style={styles.lines}>
          {W.noneInvited}
        </Text>
        {open}
      </View>
    );

  const loading = now === 'overviewLoading';

  return (
    <View testID="overview.guests">
      <BlockHead title={W.guests} right={open} />
      <Text size={14.5} weight="medium" style={[styles.secondary, styles.lines]}>
        {say.numbersLead(say.says(counts.coming, counts.invited))}
      </Text>
      {loading && <Loading />}
      <RowList
        items={COUNTED.map((key) => ({
          key,
          inset: 40,
          row: (
            <Row
              title={filterWord(key)}
              line={key === 'held' ? W.heldCounts : undefined}
              lead={key === 'invited' ? <LineIcon name="users" /> : <MarkSlot kind={key} />}
              value={loading ? undefined : String(counts[key])}
              trail={loading ? <View style={styles.bar} /> : undefined}
              opens
              pad={4}
              onPress={() => onOpen(key)}
              accessibilityLabel={
                loading
                  ? filterWord(key)
                  : `${counts[key]} ${filterWord(key)}, ${say.opens(filterWord(key))}`
              }
              testID={`overview.guests.${key}`}
            />
          ),
        }))}
      />
      {!loading && counts.notyet > 0 && (
        <TextAction
          label={say.notYetInvited(counts.notyet)}
          figures
          after="chevron"
          renderMark={() => <ReplyMark kind="notyet" side={16} />}
          onPress={() => onOpen('notyet')}
          accessibilityLabel={`${say.notYetInvited(counts.notyet)}, ${say.opens(filterWord('notyet'))}`}
          testID="overview.guests.notyet"
        />
      )}
    </View>
  );
}

function Loading() {
  useReadOut(W.loading);
  return null;
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  lines: { lineHeight: 14.5 * 1.45 },
  bar: { width: 34, height: 14, borderRadius: 7, backgroundColor: tokens.colorNeutralFill },
});
