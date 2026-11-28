import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Glyph } from '../../../components/Glyph.tsx';
import { RowWords } from '../../../components/SettingsParts.tsx';

/** Soirely's own values to give the provider, each with Copy. */
export function ValueRows({ values }: { values: readonly { label: string; value: string }[] }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<string | null>(null);

  return (
    <>
      <ul className="desk-rows">
        {values.map((part) => {
          const done = copied === part.label;

          return (
            <li key={part.label} className="desk-row">
              <RowWords title={part.value} lines={[part.label]} />
              <button
                type="button"
                className="desk-text"
                aria-label={t(done ? 'ownerClaim.partCopied' : 'ownerClaim.copyPart', {
                  part: part.label,
                })}
                onClick={() =>
                  void navigator.clipboard.writeText(part.value).then(
                    () => setCopied(part.label),
                    () => setCopied(null),
                  )
                }
              >
                <Glyph name={done ? 'tick' : 'copy'} size={17} weight={2.3} />
                {done ? t('ownerClaim.copied') : t('ownerClaim.copy')}
              </button>
            </li>
          );
        })}
      </ul>
      <span className="desk-unseen" role="status">
        {copied == null ? '' : t('ownerClaim.partCopied', { part: copied })}
      </span>
    </>
  );
}
