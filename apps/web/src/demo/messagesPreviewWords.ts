/** sc-3960's own words ('English copy (l10n)', settled 27 Oct, reworded 7 Nov, the braces line settled 8 Nov): Insert's lines and the preview's. */
export const PW = {
  insertGreeting: 'Their Greet as, or their full name if they have none',
  insertEvent: 'The event’s name',
  insertDate: 'The event’s day, or its days',
  insertHosts: 'The event’s hosts',
  previewAs: 'Preview as',
  option: '{{name}} · {{language}}',
  greetedAs: 'Greeted as “{{greetAs}}”, their Greet as.',
  choseLanguage: 'In {{language}}, the language they chose on their page.',
  organisationLanguage:
    'In {{language}}, your organisation’s language, as no language is set for them.',
  typedBraces:
    'Anything you type in braces shows exactly as typed. To fill something in for each guest, use Insert.',
  nothingToFill: 'Nothing to fill in, so every guest gets exactly these words.',
  nobodyToPreview: 'No guests chosen yet, so there is nobody to preview it as.',
  filling: 'Filling it in for {{name}}…',
};

/** Soirely's words in a guest's own language: length stand-ins in brackets, not [fr]'s or [es]'s words (STATES.md, 8 Nov). */
export const STAND_INS = {
  fr: {
    subject: '[Adaeze & Tunde’s wedding : un message de Adaeze Obi et Tunde Bakare]',
    dear: '[Bonjour {{greeting}},]',
    body: '[Adaeze Obi et Tunde Bakare vous ont envoyé un message à propos de Adaeze & Tunde’s wedding. Il est sur votre page.]',
    button: '[Le lire sur votre page]',
    stop: '[Ne plus recevoir les e-mails de Ire Events]',
    sms: '[Adaeze Obi et Tunde Bakare : vous avez un nouveau message à propos de Adaeze & Tunde’s wedding. Lisez-le sur votre page : {{link}}]',
  },
  es: {
    subject: '[Adaeze & Tunde’s wedding: un mensaje de Adaeze Obi y Tunde Bakare]',
    dear: '[Hola, {{greeting}}:]',
    body: '[Adaeze Obi y Tunde Bakare te enviaron un mensaje sobre Adaeze & Tunde’s wedding. Está en tu página.]',
    button: '[Leerlo en tu página]',
    stop: '[Dejar de recibir correos de Ire Events]',
    sms: '[Adaeze Obi y Tunde Bakare: tienes un mensaje nuevo sobre Adaeze & Tunde’s wedding. Léelo en tu página: {{link}}]',
  },
} as const;
