import { formattingLocale } from '@soirely/domain';
import { getLocales } from 'expo-localization';
import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { SeenBy } from './Frame.tsx';
import { useLoad } from './MembersLoading.tsx';
import { memberLooking } from './sample.ts';
import {
  NOW,
  ORG,
  type SignInRulesStart,
  signInRulesStart,
  signInRulesStateOf,
  standRules,
  standViewer,
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
import {
  changeRows,
  ruleLabel,
  rulesCard,
  standFoot,
  whereYouStand,
} from '../../kit/whereYouStand.ts';

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
  const { t } = useTranslation();
  const shell = useShell();
  const { load, retry } = useLoad(start.load);
  const locale = formattingLocale('en', getLocales()[0]?.languageTag);
  const title = t('settings.signInRules');

  if (load !== 'loaded')
    return (
      <SummaryPage title={title}>
        {load === 'failed' ? (
          <FailedBlock
            title={t('signInRules.stand.loadFailedTitle')}
            line={t('signInRules.stand.loadFailedLine')}
            onRetry={retry}
            testID="signInRules.retry"
          />
        ) : (
          <LoadingBlock words={t('signInRules.loading')} />
        )}
      </SummaryPage>
    );

  const rules = standRules(start.page);
  const viewer = standViewer(start.viewer);
  const rows = whereYouStand(t, rules, viewer, locale, NOW);
  const card = rulesCard(t, rows, viewer);
  const pane = shell.layout === 'landscape';

  return (
    <SummaryPage title={title}>
      <SummaryCard
        size={shell.layout === 'portrait' ? 'wide' : 'page'}
        height={card.step == null ? 170 : 210}
        step={
          card.step == null
            ? null
            : {
                label: card.step.label,
                onPress: () =>
                  shell.openSection('security', card.step?.opens === 'link' ? 'linkPick' : 'setup'),
                testID: 'signInRules.step',
              }
        }
        testID="signInRules.card"
      >
        <CardSays text={card.says} size={pane ? 26 : 24} heading />
        <OnCard text={card.line} />
      </SummaryCard>
      <Section title={t('signInRules.stand.whereTitle')} foot={standFoot(t, rules)}>
        <StandRules rules={rows.map((rule) => ({ ...rule, label: ruleLabel(t, rule) }))} />
      </Section>
      <Section
        title={t('signInRules.stand.changedTitle')}
        foot={viewer.setsRules ? undefined : t('signInRules.askOwner', { organisation: ORG })}
      >
        <StandChanges
          changes={changeRows(t, start.page.changes, start.viewer.seen, locale, NOW)}
          none={{
            title: t('signInRules.stand.noChangesTitle'),
            line: t('signInRules.stand.noChangesLine'),
          }}
          newWord={t('signInRules.stand.new')}
        />
      </Section>
    </SummaryPage>
  );
}
