import { useState } from 'react';

import { Glyph } from '../components/Glyph.tsx';
import { RowWords, type Tell } from '../components/SettingsParts.tsx';
import { copyText } from './settings.ts';

export interface RecordPart {
  label: string;
  value: string;
}

/** A DNS record to publish, as owner claims and Email domains both show it: the value as the row's title, Copy turning into a ticked Copied in place. */
export function RecordRows({
  parts,
  tell,
  copiedFirst = null,
}: {
  parts: readonly RecordPart[];
  tell: Tell;
  copiedFirst?: string | null;
}) {
  const [copied, setCopied] = useState(copiedFirst);

  return (
    <ul className="desk-rows">
      {parts.map((part) => {
        const done = copied === part.label;

        return (
          <li key={part.label} className="desk-row">
            <RowWords title={part.value} lines={[part.label]} />
            <button
              type="button"
              className="desk-text"
              aria-label={done ? `${part.label}, copied` : `Copy ${part.label}`}
              onClick={() =>
                void copyText(part.value).then(
                  () => {
                    setCopied(part.label);
                    tell(`${part.label} copied.`);
                  },
                  () => undefined,
                )
              }
            >
              <Glyph name={done ? 'tick' : 'copy'} size={17} weight={2.3} />
              {done ? 'Copied' : 'Copy'}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
