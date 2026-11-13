import { hostsLine } from '@soirely/domain';
import { useTranslation } from 'react-i18next';

import './thanks.css';

/** The hosts' own words as typed, never translated or linked (sc-6476): the guest's page and the event's Overview show this one line. */
export function Thanks({
  line,
  hosts,
  locale,
  small = false,
}: {
  line: string;
  hosts: readonly string[];
  locale: string;
  small?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <figure className={small ? 'gp-thanks is-small' : 'gp-thanks'}>
      <blockquote dir="auto">{line}</blockquote>
      {hosts.length > 0 && (
        <figcaption>{t('thankYou.signed', { hosts: hostsLine(hosts, locale) })}</figcaption>
      )}
    </figure>
  );
}
