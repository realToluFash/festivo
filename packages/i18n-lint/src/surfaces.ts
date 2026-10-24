/**
 * Every surface that carries translations, and every exception. ONE place.
 *
 * Both halves matter. The surfaces, because a check that each app runs for
 * itself is a check a new app silently does not have — and the previous build
 * had three copies of the same parity test, which is three places to forget to
 * update and three subtly different ideas of what parity means.
 *
 * And the exceptions, because the alternative is suppression comments
 * scattered through the code. A `// eslint-disable`-shaped opt-out is invisible
 * in review, accumulates, and nobody ever audits whether it is still needed.
 * Listed here, each one has to carry a reason, and a test fails when one stops
 * suppressing anything.
 */
import { LOCALE_CODES } from '@soirely/domain';

/** The repository root, from this package. */
export const ROOT = new URL('../../../', import.meta.url).pathname.replace(/\/$/, '');

export interface Surface {
  /** How it is named in a failure message. */
  name: string;
  /** Directory holding the catalogues, relative to the repository root. */
  catalogues: string;
  /** How a catalogue file is named for a locale. */
  file: (locale: string) => string;
  /**
   * Source roots to scan for untranslated literals, relative to the root.
   * Empty for a surface with no client code of its own.
   */
  sources: readonly string[];
}

export const SURFACES: readonly Surface[] = [
  {
    name: 'apps/web',
    catalogues: 'apps/web/src/i18n/locales',
    file: (locale) => `${locale}.json`,
    sources: ['apps/web/src'],
  },
  {
    name: 'apps/mobile',
    catalogues: 'apps/mobile/src/i18n/locales',
    file: (locale) => `${locale}.json`,
    // `app` as well as `src`: expo-router puts the screens there, which is
    // where most user-facing text lives.
    sources: ['apps/mobile/src', 'apps/mobile/app'],
  },
  {
    name: 'services/api (errors)',
    catalogues: 'services/api/translations',
    file: (locale) => `errors.${locale}.json`,
    // No TypeScript. The server's own guards are PHP — ErrorCodeCatalogueTest
    // walks the closed ErrorCode enum, which this cannot see. Its catalogues
    // are checked here so all three surfaces are checked the same way.
    sources: [],
  },
];

export const LOCALES = LOCALE_CODES;

export interface WordCopy extends Pick<Surface, 'name' | 'catalogues' | 'file'> {
  /** The dotted key the words sit under. */
  under: string;
}

/** Words several surfaces keep a copy of: the API refuses a role name by its own (sc-2301). */
export const SHARED_WORDS: readonly { what: string; copies: readonly WordCopy[] }[] = [
  {
    what: 'the seeded roles',
    copies: [
      {
        name: 'apps/web',
        catalogues: 'apps/web/src/i18n/locales',
        file: (locale) => `${locale}.json`,
        under: 'roles',
      },
      {
        name: 'apps/mobile',
        catalogues: 'apps/mobile/src/i18n/locales',
        file: (locale) => `${locale}.json`,
        under: 'roles',
      },
      {
        name: 'services/api (messages)',
        catalogues: 'services/api/translations',
        file: (locale) => `messages.${locale}.json`,
        under: 'seeded_role',
      },
    ],
  },
];

/**
 * Props whose value a person reads. A literal in one of these is untranslated
 * text, however innocuous it looks.
 *
 * Deliberately a short list of things that are definitely prose. `title` on an
 * `<option>` is a tooltip; `accessibilityRole` is an enum and is not here.
 */
export const USER_FACING_PROPS: readonly string[] = [
  'accessibilityHint',
  'accessibilityLabel',
  'alt',
  'aria-label',
  'helper',
  'label',
  'placeholder',
  'subtitle',
  'title',
];

export interface Exemption {
  /** Path from the repository root. */
  path: string;
  /** Why. Not optional — an exemption with no reason is a suppression. */
  because: string;
}

/**
 * Files allowed to contain user-facing literals.
 *
 * Each needs a reason, and `noStaleExemptions` fails when one no longer
 * suppresses anything — so this list shrinks on its own rather than growing
 * forever.
 */
export const LITERAL_EXEMPT: readonly Exemption[] = [
  {
    path: 'apps/mobile/app/_layout.tsx',
    because:
      'The boot-failure screen. It renders when localisation itself failed to initialise, so there is no translator to render it with — English is the only option, and saying nothing would be a blank screen.',
  },
];
