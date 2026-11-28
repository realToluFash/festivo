import { createInstance } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import { contactNumberLabel } from './contactNumberLabel.ts';
import en from './i18n/locales/en.json';

const i18n = createInstance();

beforeAll(async () => {
  await i18n.init({ resources: { en: { translation: en } }, lng: 'en' });
});

describe('contactNumberLabel', () => {
  it('keeps a label the person wrote over the kind', () => {
    const t = (key: string) => i18n.t(key);

    expect(
      contactNumberLabel({ number: '+441', kind: 'other', label: "Grandma's landline" }, t),
    ).toBe("Grandma's landline");
  });

  it("words a phone's own label from the kind", () => {
    const t = (key: string) => i18n.t(key);

    expect(contactNumberLabel({ number: '+442', kind: 'home', label: '' }, t)).toBe('Home');
  });
});
