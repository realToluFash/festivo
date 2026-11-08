import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { SeenBy } from './Frame.tsx';
import { useLoad } from './MembersLoading.tsx';
import { memberLooking } from './sample.ts';
import {
  ASK_OWNER,
  changeRows,
  ruleLabel,
  rulesCard,
  type SignInRulesStart,
  signInRulesStart,
  signInRulesStateOf,
  standFoot,
  TITLE,
  whereYouStand,
} from './SignInRulesSample.ts';
import { useShell } from '../../components/settingsShell.ts';
import { SummaryPage } from './SummaryPage.tsx';
import { StandChanges, StandRules } from '../../components/SignInRulesStand.tsx';
import {
  CardSays,
  FailedBlock,
  LoadingBlock,
  OnCard,
  Section,
  SummaryCard,
} from '../../components/Summary.tsx';

/** Sign-in rules in B, where you stand: read only for everyone, each rule with a mark and a line about you, then what changed. */
export function SignInRulesSection() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const name = signInRulesStateOf(state);
  const start = useMemo(() => signInRulesStart(name), [name]);
  const looking = useMemo(() => memberLooking(start.viewer.id), [start]);

  return (
    <SeenBy looking={looking}>
      <SignInRulesPage key={name} start={start} />
    </SeenBy>
  );
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
                  shell.openSection('security', asking === 'method' ? 'linkPick' : 'setup'),
                testID: 'signInRules.step',
              }
        }
        testID="signInRules.card"
      >
        <CardSays text={card.says} size={pane ? 26 : 24} heading />
        <OnCard text={card.line} />
      </SummaryCard>
      <Section title="Where you stand" foot={standFoot(page)}>
        <StandRules rules={rules.map((rule) => ({ ...rule, label: ruleLabel(rule) }))} />
      </Section>
      <Section title="What changed" foot={viewer.setsRules ? undefined : ASK_OWNER}>
        <StandChanges
          changes={changeRows(page.changes, viewer.seen, locale)}
          none={{
            title: 'No changes yet',
            line: 'These are the rules every organisation starts with.',
          }}
          newWord="New"
        />
      </Section>
    </SummaryPage>
  );
}
