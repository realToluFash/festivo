import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Glyph } from '../../../components/Glyph.tsx';
import { RowWords } from '../../../components/SettingsParts.tsx';

/** The record as rows, its value as each row's title, Copy turning into a ticked Copied in place. */
export function RecordRows({ record }: { record: { type: string; name: string; value: string } }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<'type' | 'name' | 'value' | null>(null);
  const parts = [
    { field: 'type', label: t('ownerClaim.type'), value: record.type },
    { field: 'name', label: t('ownerClaim.name'), value: record.name },
    { field: 'value', label: t('ownerClaim.value'), value: record.value },
  ] as const;

  return (
    <>
      <ul className="desk-rows">
        {parts.map((part) => {
          const done = copied === part.field;

          return (
            <li key={part.field} className="desk-row">
              <RowWords title={part.value} lines={[part.label]} />
              <button
                type="button"
                className="desk-text"
                aria-label={t(done ? 'ownerClaim.partCopied' : 'ownerClaim.copyPart', {
                  part: part.label,
                })}
                onClick={() =>
                  void navigator.clipboard.writeText(part.value).then(
                    () => setCopied(part.field),
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
        {copied == null ? '' : t(`ownerClaim.${copied}Copied`)}
      </span>
    </>
  );
}
