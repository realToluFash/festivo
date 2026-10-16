// Hermes has no Intl.DisplayNames, so country names fell back to their codes and the picker
// could not be searched by name. Each polyfill installs only where the engine lacks it.
import '@formatjs/intl-getcanonicallocales/polyfill.js';
import '@formatjs/intl-locale/polyfill.js';
import '@formatjs/intl-displaynames/polyfill.js';
import '@formatjs/intl-displaynames/locale-data/en.js';
import '@formatjs/intl-displaynames/locale-data/es.js';
import '@formatjs/intl-displaynames/locale-data/fr.js';
import '@formatjs/intl-displaynames/locale-data/pt.js';
