import { LOCALES } from '@soirely/domain';
import { useId } from 'react';

import { RowWords } from '../components/SettingsParts.tsx';

/** Stands in for `Choices` until `Choice` grows `lang?: string`; the product adds that field rather than copying this (WCAG 2.2, 3.1.2). */
export function LanguageChoices({
  legend,
  picked,
  onPick,
  foot,
}: {
  legend: string;
  picked: string;
  onPick: (code: string) => void;
  foot: string;
}) {
  const name = useId();

  return (
    <fieldset className="desk-choices">
      <legend className="desk-unseen">{legend}</legend>
      <ul className="desk-rows">
        {LOCALES.map((locale) => (
          <li key={locale.code}>
            <label className={locale.code === picked ? 'desk-row is-picked' : 'desk-row'}>
              <RowWords title={<span lang={locale.code}>{locale.nativeName}</span>} />
              <input
                type="radio"
                className="desk-radio"
                name={name}
                checked={locale.code === picked}
                onChange={() => onPick(locale.code)}
              />
            </label>
          </li>
        ))}
      </ul>
      <p className="desk-foot">{foot}</p>
    </fieldset>
  );
}
