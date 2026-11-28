import type { Membership, SingleSignOnPage } from '@soirely/api-client';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { Head, RowWords } from '../../../components/SettingsParts.tsx';
import { currentLocale } from '../../../i18n/index.ts';
import { SsoMark } from './SingleSignOn.tsx';
import { SINGLE_SIGN_ON, liveOf, standingOf } from './singleSignOn.ts';

/** Single sign-on's section on Sign-in rules: where it stands, opening its own page. */
export function SingleSignOnRow({
  page,
  organisation,
}: {
  page: SingleSignOnPage;
  organisation: Membership;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const standing = standingOf(page);
  const domains = new Intl.ListFormat(currentLocale()).format(page.domains);
  const words = {
    organisation: organisation.name,
    domains,
    provider: (liveOf(page) ?? page.provider)?.name ?? '',
  };
  const row = {
    none: [
      'grey',
      'sso.rowNone',
      page.domains.length === 0 ? 'sso.proveFirstLine' : 'sso.rowNoneLine',
    ],
    saved: ['grey', 'sso.rowSaved', 'sso.rowSavedLine'],
    on: ['on', 'sso.onWord', 'sso.rowOnLine'],
    required: ['on', 'sso.requiredWord', 'sso.requiredStatus'],
    free: ['lock', 'sso.enterprise', 'sso.enterpriseLine'],
  } as const;
  const [mark, word, line] = row[standing];

  return (
    <section className="desk-block">
      <Head title={t('sso.title')} />
      <ul className="desk-rows signin-rows">
        <li>
          <button type="button" className="desk-row" onClick={() => void navigate(SINGLE_SIGN_ON)}>
            <SsoMark kind={mark} />
            <RowWords title={t(word)} lines={[t(line, words)]} />
            <span className="signin-change">
              {t(
                !page.ownerChanges
                  ? 'sso.see'
                  : standing === 'none'
                    ? 'sso.setUp'
                    : 'signInRules.change',
              )}
            </span>
          </button>
        </li>
      </ul>
    </section>
  );
}
