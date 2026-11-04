import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { useShell } from './Frame.tsx';
import { useLoad } from './MembersLoading.tsx';
import {
  ASK_OWNER,
  type Change,
  changeWhen,
  limitApplies,
  READ_HERE,
  type Rule,
  SET_BY,
  type SignInRulesStart,
  signInRulesStart,
  signInRulesStateOf,
  TITLE,
} from './SignInRulesSample.ts';
import {
  CardSays,
  FailedBlock,
  HeadCount,
  Line,
  LoadingBlock,
  OnCard,
  Row,
  RowList,
  Section,
  SummaryCard,
  SummaryPage,
} from './Summary.tsx';

/** Sign-in rules in B, summary first: read only for everyone, who sets them on the card, what changed, then the rules in force. */
export function SignInRulesSection() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const name = signInRulesStateOf(state);

  return <SignInRulesPage key={name} start={signInRulesStart(name)} />;
}

function SignInRulesPage({ start }: { start: SignInRulesStart }) {
  const { layout } = useShell();
  const { load, retry } = useLoad(start.load);
  const locale = formattingLocale('en', getLocales()[0]?.languageTag);

  if (load !== 'loaded')
    return (
      <SummaryPage title={TITLE}>
        {load === 'failed' ? (
          <FailedBlock
            title="We could not load the sign-in rules."
            line="Check your connection and try again."
            onRetry={retry}
            testID="signInRules.retry"
          />
        ) : (
          <LoadingBlock words="Loading the sign-in rules…" />
        )}
      </SummaryPage>
    );

  return (
    <SummaryPage title={TITLE}>
      <SummaryCard
        size={layout === 'portrait' ? 'wide' : 'page'}
        height={200}
        testID="signInRules.card"
      >
        <CardSays text={SET_BY} heading />
        <OnCard text={READ_HERE} />
        {start.limit != null && (
          <OnCard text={limitApplies(start.limit.days, start.limit.organisation)} strong />
        )}
      </SummaryCard>
      <Changes changes={start.changes} locale={locale} />
      <InForce rules={start.rules} />
    </SummaryPage>
  );
}

function Changes({ changes, locale }: { changes: readonly Change[]; locale: string }) {
  if (changes.length === 0)
    return (
      <Section title="What changed">
        <View style={styles.none}>
          <Text size={16} weight="semibold">
            No changes yet
          </Text>
          <Line size={14} text="These are the rules every organisation starts with." />
        </View>
      </Section>
    );

  return (
    <Section title="What changed" right={<HeadCount text="Newest first" />}>
      <RowList
        items={changes.map((change) => {
          const when = changeWhen(change, locale);
          const was = `was: ${change.was}`;

          return {
            key: change.at,
            row: (
              <View
                style={styles.change}
                accessible
                accessibilityLabel={`${change.now}. ${was}. ${when}`}
                testID={`signInRules.change.${change.at}`}
              >
                <Text size={16} weight="semibold" accessible={false}>
                  {change.now}
                </Text>
                <Text size={14} weight="medium" accessible={false} style={styles.secondary}>
                  {was}
                </Text>
                <Text
                  size={13}
                  weight="medium"
                  accessible={false}
                  style={[styles.secondary, styles.figures]}
                >
                  {when}
                </Text>
              </View>
            ),
          };
        })}
      />
    </Section>
  );
}

function InForce({ rules }: { rules: readonly Rule[] }) {
  return (
    <Section title="In force" foot={ASK_OWNER}>
      <RowList
        items={rules.map((rule) => ({
          key: rule.label,
          row: <Row title={rule.value} line={rule.label} weight="medium" />,
        }))}
      />
    </Section>
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  figures: { fontVariant: ['tabular-nums'] },
  none: { gap: 3, paddingVertical: tokens.spaceXs },
  change: { gap: 3, paddingVertical: 11 },
});
