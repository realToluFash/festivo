import { describe, expect, it } from 'vitest';

import { languageChoices } from './locales.ts';

describe('languageChoices', () => {
  it("names each supported language in the reader's language, then once more in its own", () => {
    const french: Record<string, string> = {
      'languageNames.en': 'Anglais',
      'languageNames.es': 'Espagnol',
      'languageNames.fr': 'Français',
      'languageNames.pt': 'Portugais',
    };

    expect(languageChoices((key) => french[key] ?? key)).toEqual([
      { code: 'en', name: 'Anglais · English' },
      { code: 'es', name: 'Espagnol · Español' },
      { code: 'fr', name: 'Français' },
      { code: 'pt', name: 'Portugais · Português' },
    ]);
  });
});
