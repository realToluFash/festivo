// Hermes has no Intl.DisplayNames, Intl.ListFormat, Intl.RelativeTimeFormat or Intl.supportedValuesOf: country names fell back to
// their codes, a list of organisations crashed the screen (sc-509), and the organisation page had no
// currencies or time zones to offer (sc-1427). Each polyfill installs only where the engine lacks it,
// except plural rules and numbers, forced so every device counts and writes by the same CLDR: an older
// ICU, or the intl-pluralrules package this replaced, never picks `many` for a million in es, fr or pt
// (sc-8529), and an older one groups «1.000» in es where CLDR writes «1000» (sc-15361).
import '@formatjs/intl-getcanonicallocales/polyfill.js';
import '@formatjs/intl-locale/polyfill.js';
import '@formatjs/intl-displaynames/polyfill.js';
import '@formatjs/intl-displaynames/locale-data/en.js';
import '@formatjs/intl-displaynames/locale-data/es.js';
import '@formatjs/intl-displaynames/locale-data/fr.js';
import '@formatjs/intl-displaynames/locale-data/pt.js';
import '@formatjs/intl-enumerator/polyfill.js';
import '@formatjs/intl-listformat/polyfill.js';
import '@formatjs/intl-listformat/locale-data/en.js';
import '@formatjs/intl-listformat/locale-data/es.js';
import '@formatjs/intl-listformat/locale-data/fr.js';
import '@formatjs/intl-listformat/locale-data/pt.js';
import '@formatjs/intl-pluralrules/polyfill-force.js';
import '@formatjs/intl-pluralrules/locale-data/en.js';
import '@formatjs/intl-pluralrules/locale-data/es.js';
import '@formatjs/intl-pluralrules/locale-data/fr.js';
import '@formatjs/intl-pluralrules/locale-data/pt.js';
import '@formatjs/intl-pluralrules/locale-data/pt-PT.js';
import '@formatjs/intl-numberformat/polyfill-force.js';
import '@formatjs/intl-numberformat/locale-data/en.js';
import '@formatjs/intl-numberformat/locale-data/es.js';
import '@formatjs/intl-numberformat/locale-data/fr.js';
import '@formatjs/intl-numberformat/locale-data/pt.js';
import '@formatjs/intl-numberformat/locale-data/pt-PT.js';
import '@formatjs/intl-relativetimeformat/polyfill.js';
import '@formatjs/intl-relativetimeformat/locale-data/en.js';
import '@formatjs/intl-relativetimeformat/locale-data/es.js';
import '@formatjs/intl-relativetimeformat/locale-data/fr.js';
import '@formatjs/intl-relativetimeformat/locale-data/pt.js';
import '@formatjs/intl-relativetimeformat/locale-data/pt-PT.js';
