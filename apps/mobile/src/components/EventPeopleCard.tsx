import type { EventPerson, OrganisationEvent } from '@soirely/api-client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { api } from '../api.ts';
import { cardFacts, cardWords } from '../kit/eventPeople.ts';
import { useSignedIn } from '../signedIn.ts';
import { tokens } from '../theme/tokens.ts';
import { LineIcon } from './AccountCard.tsx';
import { AlertLine } from './AlertLine.tsx';
import { useReadOut } from './ReadOut.tsx';
import { AREA_GLYPH } from './areaGlyph.ts';
import { Row, RowList, Section, TextAction } from './Summary.tsx';
import { Text } from './Text.tsx';

type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; people: EventPerson[] };

/** Overview's People (sc-68607): how many People lists on the event and who leads it, the whole row opening People. */
export function EventPeopleCard({
  event,
  onOpen,
}: {
  event: OrganisationEvent;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const { account } = useSignedIn();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;

    api.eventPeople(event.id).then(
      ({ people }) => live && setLoad({ kind: 'loaded', people }),
      () => live && setLoad({ kind: 'failed' }),
    );

    return () => {
      live = false;
    };
  }, [event.id, attempt]);

  const mark = <LineIcon name={AREA_GLYPH.people} />;

  if (load.kind === 'failed')
    return (
      <View testID="overview.people">
        <Section title={t('eventPeople.title')}>
          <AlertLine text={t('eventPeople.card.failed')} />
          <TextAction
            label={t('eventPeople.retry')}
            onPress={() => {
              setLoad({ kind: 'loading' });
              setAttempt((n) => n + 1);
            }}
            testID="overview.people.retry"
          />
        </Section>
      </View>
    );

  if (load.kind === 'loading')
    return (
      <View testID="overview.people">
        <Section title={t('eventPeople.title')}>
          <Loading />
          <View style={styles.loading} accessible accessibilityLabel={t('eventPeople.loading')}>
            {mark}
            <View style={styles.lines}>
              <View style={styles.count}>
                <View style={styles.bar} />
                <Text size={16} weight="semibold">
                  {t('eventPeople.card.held')}
                </Text>
              </View>
              <View style={styles.lineBar} />
            </View>
          </View>
        </Section>
      </View>
    );

  const words = cardWords(t, cardFacts(load.people, account?.id ?? null));

  return (
    <View testID="overview.people">
      <Section title={t('eventPeople.title')}>
        <RowList
          items={[
            {
              key: 'people',
              row: (
                <Row
                  title={words.title}
                  line={words.line}
                  lead={mark}
                  opens
                  pad={4}
                  onPress={onOpen}
                  accessibilityLabel={words.label}
                  testID="overview.people.open"
                />
              ),
            },
          ]}
        />
      </Section>
    </View>
  );
}

function Loading() {
  const { t } = useTranslation();
  useReadOut(t('eventPeople.loading'));

  return null;
}

const styles = StyleSheet.create({
  loading: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
  },
  lines: { gap: tokens.spaceXs },
  count: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceXs },
  bar: { width: 24, height: 14, borderRadius: 7, backgroundColor: tokens.colorNeutralFill },
  lineBar: { width: 132, height: 12, borderRadius: 6, backgroundColor: tokens.colorNeutralFill },
});
