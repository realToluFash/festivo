import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useShell } from '../../components/settingsShell.ts';
import {
  CardSays,
  FailedBlock,
  Line,
  LoadingBlock,
  OnCard,
  RowList,
  Section,
  SummaryCard,
} from '../../components/Summary.tsx';
import { tokens } from '../../theme/tokens.ts';
import { SeenBy } from './Frame.tsx';
import { useLoad } from './MembersLoading.tsx';
import { memberLooking } from './sample.ts';
import {
  DATA_PEOPLE,
  type Go,
  hubCard,
  hubRows,
  type HubStart,
  type HubState,
  hubStart,
  hubStateOf,
  hubStepOpens,
} from './DataModel.ts';
import { LOCK_TAG, Lead, TagRow, useDataNav } from './DataParts.tsx';
import { dataSayIn, zoneFor } from './DataSample.ts';
import { DATA_WORDS as H } from './DataWords.ts';
import { SummaryPage } from './SummaryPage.tsx';

/** Settings › Data and control in B: one card with the soonest step, then Control's rows; the rest is on the web. */
export function DataHubSection() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const { viewer } = useDataNav();
  const name = hubStateOf(state);
  const start = useMemo(() => hubStart(name), [name]);
  const looking = useMemo(() => memberLooking(DATA_PEOPLE[viewer].email), [viewer]);

  return (
    <SeenBy looking={looking}>
      <HubPage key={name} state={name} start={start} />
    </SeenBy>
  );
}

function HubPage({ state, start }: { state: HubState; start: HubStart }) {
  const shell = useShell();
  const { open, viewer } = useDataNav();
  const { load, retry } = useLoad(start.load);
  const say = dataSayIn(formattingLocale('en', getLocales()[0]?.languageTag), zoneFor(viewer));
  const pane = shell.layout === 'landscape';

  if (load !== 'loaded')
    return (
      <SummaryPage title={H.title}>
        {load === 'failed' ? (
          <FailedBlock title={H.failed} line={H.tryLine} onRetry={retry} testID="data.retry" />
        ) : (
          <LoadingBlock words={H.loading} />
        )}
      </SummaryPage>
    );

  const card = hubCard(start, say);
  const go = (to: Go) => {
    if (to.kind === 'contact') shell.tell(H.contacting);
    else open('emailDomains', hubStepOpens(state), state);
  };

  return (
    <SummaryPage title={H.title}>
      <SummaryCard
        size={shell.layout === 'portrait' ? 'wide' : 'page'}
        height={card.step == null ? 170 : 210}
        step={
          card.step == null
            ? null
            : {
                label: card.step.label,
                onPress: () => go(card.step?.go ?? { kind: 'contact' }),
                testID: 'data.step',
              }
        }
        testID="data.card"
      >
        <CardSays text={card.says} size={pane ? 26 : 24} heading />
        <OnCard text={card.line} />
      </SummaryCard>
      <View>
        <Section title={H.control}>
          <RowList
            items={hubRows(start, state).map((row) => ({
              key: row.key,
              inset: 28 + tokens.spaceLg,
              row: (
                <TagRow
                  title={row.title}
                  line={row.line}
                  lead={<Lead glyph={row.key === 'emailDomains' ? 'globe' : 'history'} />}
                  tag={row.locked ? LOCK_TAG : null}
                  opens
                  onPress={() => open(row.key, row.opens, state)}
                  testID={`data.${row.key}`}
                />
              ),
            }))}
          />
        </Section>
        <View style={styles.web}>
          <Line size={14} text={H.onTheWeb} />
        </View>
      </View>
    </SummaryPage>
  );
}

const styles = StyleSheet.create({
  web: { paddingTop: tokens.spaceXs },
});
