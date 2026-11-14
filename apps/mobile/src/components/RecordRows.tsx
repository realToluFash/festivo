import { setStringAsync } from 'expo-clipboard';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Row, RowList, TextAction } from './Summary.tsx';

export interface RecordValue {
  label: string;
  value: string;
  copied: string;
}

/** A DNS record to publish, as owner claims and Email domains both show it: the value as the row's title, Copy turning into a ticked Copied in place. */
export function RecordRows({
  rows,
  copied,
  onCopy,
  testID,
}: {
  rows: readonly RecordValue[];
  copied: RecordValue | null;
  onCopy: (row: RecordValue) => void;
  testID: string;
}) {
  const { t } = useTranslation();

  return (
    <RowList
      items={rows.map((row) => {
        const done = copied?.label === row.label;

        return {
          key: row.label,
          row: (
            <Row
              title={row.value}
              line={row.label}
              selectable
              trail={
                <TextAction
                  label={done ? t('ownerClaim.copied') : t('ownerClaim.copy')}
                  glyph={done ? 'tick' : 'copy'}
                  onPress={() => onCopy(row)}
                  accessibilityLabel={
                    done
                      ? t('ownerClaim.copiedNamed', { label: row.label })
                      : t('ownerClaim.copyNamed', { label: row.label })
                  }
                  testID={`${testID}.${row.label.toLowerCase()}`}
                />
              }
            />
          ),
        };
      })}
    />
  );
}

/** Which value was copied last, for its tick and its toast ("Name copied."). */
export function useCopied() {
  const [copied, setCopied] = useState<RecordValue | null>(null);

  return {
    copied,
    copy: (row: RecordValue) => {
      setStringAsync(row.value).then(
        () => setCopied(row),
        () => setCopied(null),
      );
    },
    clear: () => setCopied(null),
  };
}
