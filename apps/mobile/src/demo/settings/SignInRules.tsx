import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { tokens } from '../../theme/tokens.ts';
import { useShell } from './Frame.tsx';
import { useLoad } from './MembersLoading.tsx';
import {
  ASK_OWNER,
  type ChangeRow,
  changeRows,
  type Mark,
  type RuleRow,
  ruleLabel,
  rulesCard,
  type SignInRulesStart,
  signInRulesStart,
  signInRulesStateOf,
  standFoot,
  TITLE,
  whereYouStand,
} from './SignInRulesSample.ts';
import {
  CardSays,
  FailedBlock,
  LoadingBlock,
  OnCard,
  Row,
  RowList,
  Section,
  StatusMark,
  SummaryCard,
  SummaryPage,
} from './Summary.tsx';

const MARK = 22;

const hidden = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** Sign-in rules in B, where you stand: read only for everyone, each rule with a mark and a line about you, then what changed. */
export function SignInRulesSection() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const name = signInRulesStateOf(state);

  return <SignInRulesPage key={name} start={signInRulesStart(name)} />;
}

function SignInRulesPage({ start }: { start: SignInRulesStart }) {
  const shell = useShell();
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

  const { page, viewer } = start;
  const rules = whereYouStand(page, viewer, locale);
  const card = rulesCard(rules, viewer);
  const asking = rules.find((rule) => rule.ask != null)?.key;
  const pane = shell.layout === 'landscape';

  return (
    <SummaryPage title={TITLE}>
      <SummaryCard
        size={shell.layout === 'portrait' ? 'wide' : 'page'}
        height={card.step == null ? 170 : 210}
        step={
          card.step == null
            ? null
            : {
                label: card.step,
                onPress: () =>
                  shell.openSection('security', asking === 'method' ? 'link' : 'setup'),
                testID: 'signInRules.step',
              }
        }
        testID="signInRules.card"
      >
        <CardSays text={card.says} size={pane ? 26 : 24} heading />
        <OnCard text={card.line} />
      </SummaryCard>
      <Section title="Where you stand" foot={standFoot(page)}>
        <RowList
          items={rules.map((rule) => ({
            key: rule.key,
            inset: MARK + tokens.spaceLg,
            row: <RuleLine rule={rule} />,
          }))}
        />
      </Section>
      <Section title="What changed" foot={viewer.setsRules ? undefined : ASK_OWNER}>
        <Changes changes={changeRows(page.changes, viewer.seen, locale)} />
      </Section>
    </SummaryPage>
  );
}

function RuleLine({ rule }: { rule: RuleRow }) {
  return (
    <Row
      lead={<RuleMark mark={rule.mark} />}
      title={rule.title}
      line={rule.line}
      accessibilityLabel={ruleLabel(rule)}
      testID={`signInRules.rule.${rule.key}`}
    />
  );
}

/** Met is the green tick, needs you the amber half disc, and doesn't apply a Sunk disc with a bar. */
function RuleMark({ mark }: { mark: Mark }) {
  if (mark === 'met') return <StatusMark kind="yes" side={MARK} ink={tokens.marks.done.ink} />;
  if (mark === 'needs')
    return <StatusMark kind="waiting" side={MARK} ink={tokens.colorAttentionText} />;

  return (
    <View style={styles.notApplicable} {...hidden}>
      <View style={styles.bar} />
    </View>
  );
}

function Changes({ changes }: { changes: readonly ChangeRow[] }) {
  if (changes.length === 0)
    return (
      <Row title="No changes yet" line="These are the rules every organisation starts with." />
    );

  return (
    <RowList
      items={changes.map((change) => ({
        key: change.at,
        row: (
          <Row
            title={change.title}
            tag={change.isNew ? { kind: 'now', word: 'New' } : null}
            line={change.line}
            accessibilityLabel={change.label}
            testID={`signInRules.change.${change.at}`}
          />
        ),
      }))}
    />
  );
}

const styles = StyleSheet.create({
  notApplicable: {
    width: MARK,
    height: MARK,
    borderRadius: MARK / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorNeutralFill,
  },
  bar: {
    width: Math.round(MARK * 0.45),
    height: 2,
    borderRadius: 1,
    backgroundColor: tokens.colorInkSecondary,
  },
});
