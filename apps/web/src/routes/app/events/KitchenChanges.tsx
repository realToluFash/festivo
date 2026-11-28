import type { KitchenChange, KitchenChangesSince } from '@soirely/api-client';
import { useTranslation } from 'react-i18next';

import { Glyph } from '../../../components/Glyph.tsx';
import { Head, RowWords } from '../../../components/SettingsParts.tsx';
import { dateLocale } from '../../../i18n/index.ts';
import { changeLine, sinceLine } from './kitchenSheet.ts';

function lead({ kind }: KitchenChange) {
  if (kind.startsWith('allergy')) return 'alert';
  if (kind.startsWith('diet')) return 'menu';

  return kind.startsWith('coming') ? 'users' : null;
}

/** sc-30692: what changed since the latest copy, opening the sheet, in its order; Give the changes… ends it only when there is a change. */
export function KitchenChanges({
  changes,
  timeZone,
  onGive,
}: {
  changes: KitchenChangesSince;
  timeZone: string;
  /** Null without menu.manage, and once the event has started. */
  onGive: (() => void) | null;
}) {
  const { t } = useTranslation();

  return (
    <section className="desk-block ks-card ks-changes" aria-labelledby="ks-since">
      <Head title={<span id="ks-since">{sinceLine(t, changes, timeZone, dateLocale())}</span>} />
      {changes.lines.length > 0 && (
        <ul className="desk-rows">
          {changes.lines.map((line, at) => {
            const glyph = lead(line);

            return (
              <li key={at} className="desk-row">
                {glyph != null && (
                  <span className="ev-lead" aria-hidden="true">
                    <Glyph name={glyph} size={22} weight={2} />
                  </span>
                )}
                <RowWords title={changeLine(t, line)} />
              </li>
            );
          })}
        </ul>
      )}
      {onGive != null && changes.lines.length > 0 && (
        <button type="button" className="desk-text ev-maps" onClick={onGive}>
          {t('kitchenSheet.changes.give')}
          <Glyph name="arrow" size={16} weight={2.4} />
        </button>
      )}
    </section>
  );
}
