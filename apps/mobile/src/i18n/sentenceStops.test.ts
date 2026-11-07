import { followValueStops } from '@soirely/domain';
import { createInstance } from 'i18next';
import { beforeAll, expect, it } from 'vitest';

import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';

const i18n = createInstance();

beforeAll(async () => {
  await i18n.init({
    resources: Object.fromEntries(
      Object.entries({ en, es, fr, pt }).map(([code, translation]) => [code, { translation }]),
    ),
    lng: 'en',
    interpolation: { escapeValue: false },
  });
  followValueStops(i18n.services.interpolator);
});

const org = 'Ọ̀ṣun Galas Ltd.';

it.each(['en', 'es', 'fr', 'pt'])(
  'gives the organisation pill one stop after a name ending in one, in %s',
  (lng) => {
    const label = i18n.t('switcher.labelSwitch', { lng, name: org, role: 'Door team.' });

    expect(label).toContain('Ọ̀ṣun Galas Ltd.,');
    expect(label).toContain('Door team.');
    expect(label).not.toContain('..');
  },
);

it.each(['Party Time!', "Who's Next?", 'Galas…', 'Galas Ltd..'])(
  'ends the tablet settings line on %j as typed',
  (name) => {
    expect(i18n.t('settings.chooseLineWithOrganisation', { name })).toMatch(
      new RegExp(`the settings for ${name.replace(/[.?]/g, '\\$&')}$`),
    );
  },
);

it('gives a name ending in a letter the string’s full stop', () => {
  expect(i18n.t('settings.chooseLineWithOrganisation', { name: 'Galas Ltd' })).toMatch(
    /the settings for Galas Ltd\.$/,
  );
});

it('drops only a full stop, never a question mark or a space after the value', () => {
  expect(i18n.t('test.unused', { defaultValue: 'Is it {{name}}? Yes.', name: org })).toBe(
    'Is it Ọ̀ṣun Galas Ltd.? Yes.',
  );
  expect(i18n.t('test.unused', { defaultValue: '{{name}} made it.', name: org })).toBe(
    'Ọ̀ṣun Galas Ltd. made it.',
  );
});
