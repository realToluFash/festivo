import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { useLocalSearchParams } from 'expo-router';
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { Notice } from '../../components/Notice.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { SettingsPage } from './Frame.tsx';
import { Failed, LoadingCards, useLoad } from './MembersLoading.tsx';
import { Card, CardHead, TYPE } from './parts.tsx';
import {
  ASK_OWNER,
  type Change,
  changeWhen,
  INTRO,
  limitApplies,
  type Rule,
  type SignInRulesStart,
  signInRulesStart,
  signInRulesStateOf,
  TITLE,
} from './SignInRulesSample.ts';

/** Sign-in rules in B: read only for everyone, what changed first, then the rules in force. */
export function SignInRulesSection() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const name = signInRulesStateOf(state);

  return <SignInRulesPage key={name} start={signInRulesStart(name)} />;
}

const LOADING_CARDS = [
  { head: '46%', options: 2 },
  { head: '52%', options: 2 },
  { head: '40%', options: 1 },
] as const;

function SignInRulesPage({ start }: { start: SignInRulesStart }) {
  const { load, retry } = useLoad(start.load);
  const locale = formattingLocale('en', getLocales()[0]?.languageTag);

  return (
    <SettingsPage title={TITLE} sub={INTRO}>
      {load === 'loaded' ? (
        <>
          {start.limit != null && (
            <Notice
              tone="quiet"
              mark={tokens.marks.info.glyph}
              body={limitApplies(start.limit.days, start.limit.organisation)}
            />
          )}
          <Changes changes={start.changes} locale={locale} />
          <InForce rules={start.rules} />
        </>
      ) : load === 'failed' ? (
        <Failed
          words="The sign-in rules did not load."
          onRetry={retry}
          testID="signInRules.retry"
        />
      ) : (
        <LoadingCards words="Loading the sign-in rules…" cards={LOADING_CARDS} />
      )}
    </SettingsPage>
  );
}

function Changes({ changes, locale }: { changes: readonly Change[]; locale: string }) {
  if (changes.length === 0)
    return (
      <Card>
        <CardHead
          title="What changed, newest first"
          line="No changes yet. These are the rules every organisation starts with."
        />
      </Card>
    );

  return (
    <Card>
      <CardHead title="What changed, newest first" />
      <View style={styles.rows}>
        {changes.map((change, index) => (
          <Fragment key={change.at}>
            {index > 0 && <View style={styles.rule} />}
            <View style={styles.change}>
              <Text size={13} weight="medium" style={[styles.secondary, styles.figures]}>
                {changeWhen(change, locale)}
              </Text>
              <Text size={15.5} weight="semibold">
                {change.now}
              </Text>
              <Text size={14} weight="medium" style={styles.secondary}>
                {`was: ${change.was}`}
              </Text>
            </View>
          </Fragment>
        ))}
      </View>
    </Card>
  );
}

function InForce({ rules }: { rules: readonly Rule[] }) {
  return (
    <Card>
      <CardHead title="The rules in force" />
      <View style={styles.rows}>
        {rules.map((rule, index) => (
          <Fragment key={rule.label}>
            {index > 0 && <View style={styles.rule} />}
            <View style={styles.inForce}>
              <Text size={12} weight="semibold" style={[styles.secondary, styles.caps]}>
                {rule.label.toUpperCase()}
              </Text>
              <Text size={15.5} weight="medium">
                {rule.value}
              </Text>
            </View>
          </Fragment>
        ))}
      </View>
      <Text size={TYPE.line} weight="medium" style={styles.secondary}>
        {ASK_OWNER}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  rows: { gap: 14 },
  rule: { height: 1, backgroundColor: tokens.colorBorder },
  change: { gap: 3 },
  inForce: { gap: 5 },
  secondary: { color: tokens.colorInkSecondary },
  figures: { fontVariant: ['tabular-nums'] },
  caps: { letterSpacing: 12 * 0.08 },
});
