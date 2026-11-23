import { formatDay } from '@soirely/domain';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';

import { TextAction } from '../components/SettingsParts.tsx';
import { dateLocale } from '../i18n/index.ts';
import { afterNotice, useFocusOnceShown } from '../stepFocus.ts';
import { ORGANISATION } from './events.ts';
import { CHANGED_AT, DEADLINE, type RuleNotice, noticesAsked } from './ruleNotices.ts';

import './ruleNotices.css';

interface Drawn {
  kind: 'attention' | 'quiet';
  title: string;
  body: string | null;
  step: { label: string; to: string };
  close: string | null;
}

/** The sign-in rules' notices (SignInRulesNotices), in the amber box's place above the title row, under it when offline. */
export function DemoRuleNotices() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [shown, setShown] = useState(() => noticesAsked(params));
  const land = useFocusOnceShown();
  const as = params.get('as');
  const viewer = as == null ? '' : `?as=${as}`;
  const security = `/demo/settings/security${viewer}`;
  const organisation = ORGANISATION;

  const drawn: Record<RuleNotice, Drawn> = {
    due: {
      kind: 'attention',
      title: t('signInRules.dueBody', { organisation, deadline: DEADLINE }),
      body: null,
      step: { label: t('signInRules.dueSetUp'), to: security },
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
      step: { label: t('signInRules.gateTurnOn'), to: security },
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
    <Notice
      key={notice}
      drawn={drawn[notice]}
      onClose={(box) => {
        const next = afterNotice(box);
        setShown((was) => was.filter((one) => one !== notice));
        land(() => next);
      }}
    />
  ));
}

function Notice({ drawn, onClose }: { drawn: Drawn; onClose: (box: HTMLElement | null) => void }) {
  const box = useRef<HTMLDivElement>(null);

  return (
    <div ref={box} className={`rn-box is-${drawn.kind}`} role="status">
      <span className="rn-mark" aria-hidden="true" />
      <div className="rn-main">
        <div className="rn-words" data-notice-lead tabIndex={-1}>
          <p className="rn-title">{drawn.title}</p>
          {drawn.body != null && <p className="rn-body">{drawn.body}</p>}
        </div>
        <div className="rn-actions">
          <Link className="desk-step" to={drawn.step.to}>
            {drawn.step.label}
          </Link>
          {drawn.close != null && (
            <TextAction label={drawn.close} onClick={() => onClose(box.current)} />
          )}
        </div>
      </div>
    </div>
  );
}
