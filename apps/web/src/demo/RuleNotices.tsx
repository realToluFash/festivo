import { formatDay } from '@soirely/domain';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { RuleNoticeBox, type RuleNoticeWords } from '../components/RuleNoticeBox.tsx';
import { dateLocale } from '../i18n/index.ts';
import { afterNotice, useFocusOnceShown } from '../stepFocus.ts';
import { ORGANISATION } from './events.ts';
import { CHANGED_AT, DEADLINE, type RuleNotice, noticesAsked } from './ruleNotices.ts';
import { HELD_STEPS, heldStepPath } from './security.ts';
import { viewerOf } from './settings.ts';

/** The sign-in rules' notices (SignInRulesNotices), in the amber box's place above the title row, under it when offline. */
export function DemoRuleNotices() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [shown, setShown] = useState(() => noticesAsked(params));
  const land = useFocusOnceShown();
  const as = params.get('as');
  const viewer = as == null ? '' : `?as=${as}`;
  const security = `/demo/settings/security${viewer}`;
  const turnOn = heldStepPath(HELD_STEPS.turnOn, viewerOf(as));
  const organisation = ORGANISATION;

  const drawn: Record<RuleNotice, RuleNoticeWords> = {
    due: {
      kind: 'attention',
      title: t('signInRules.dueBody', { organisation, deadline: DEADLINE }),
      body: null,
      step: { label: t('signInRules.dueSetUp'), to: turnOn },
      close: null,
    },
    unlinked: {
      kind: 'attention',
      title: t('signInRules.unlinkedTitle'),
      body: t('signInRules.unlinkedBody', { organisation }),
      step: { label: t('signInRules.unlinkedLink'), to: security },
      close: null,
    },
    gate: {
      kind: 'quiet',
      title: t('signInRules.gateTitle', { organisation }),
      body: t('signInRules.gateBody', { organisation }),
      step: { label: t('signInRules.gateTurnOn'), to: turnOn },
      close: t('signInRules.gateLater'),
    },
    changed: {
      kind: 'quiet',
      title: t('signInRules.changedTitle'),
      body: t('signInRules.changedBody', {
        organisation,
        day: formatDay(CHANGED_AT, dateLocale()),
      }),
      step: { label: t('signInRules.changedSee'), to: `/demo/settings/sign-in-rules${viewer}` },
      close: t('signInRules.changedClose'),
    },
  };

  return shown.map((notice) => (
    <RuleNoticeBox
      key={notice}
      words={drawn[notice]}
      onClose={(box) => {
        const next = afterNotice(box);
        setShown((was) => was.filter((one) => one !== notice));
        land(() => next);
      }}
    />
  ));
}
