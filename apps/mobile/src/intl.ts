// Hermes has no Intl.DisplayNames or Intl.ListFormat: country names fell back to their codes, and a
// list of organisations crashed the screen (sc-509). Each polyfill installs only where the engine lacks it.
import '@formatjs/intl-getcanonicallocales/polyfill.js';
import '@formatjs/intl-locale/polyfill.js';
import '@formatjs/intl-displaynames/polyfill.js';
import '@formatjs/intl-displaynames/locale-data/en.js';
import '@formatjs/intl-displaynames/locale-data/es.js';
import '@formatjs/intl-displaynames/locale-data/fr.js';
import '@formatjs/intl-displaynames/locale-data/pt.js';
import '@formatjs/intl-listformat/polyfill.js';
import '@formatjs/intl-listformat/locale-data/en.js';
import '@formatjs/intl-listformat/locale-data/es.js';
import '@formatjs/intl-listformat/locale-data/fr.js';
import '@formatjs/intl-listformat/locale-data/pt.js';
