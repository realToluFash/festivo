/** Terms and Privacy (sc-28982): the page's own words, and sample documents plainly marked as sample. */

export type LegalDoc = 'terms' | 'privacy';
export type LegalLang = 'en' | 'es' | 'fr' | 'pt';

/** A run of a paragraph: plain words, or a link to the other document. */
export type Run = string | { words: string; to: LegalDoc };

export type Block =
  | { kind: 'h2' | 'h3'; words: string; middle?: true }
  | { kind: 'p'; runs: readonly Run[] }
  | { kind: 'ul' | 'ol'; items: readonly string[] };

export interface Document {
  title: string;
  blocks: readonly Block[];
}

/** The effective date the owner gives a document; the sample's, the same in every language. */
export const EFFECTIVE = new Date(Date.UTC(2026, 10, 4));

/** The page's own words, the linguist's: settled English, and [bracketed] French until l10n writes it. */
export const PAGE_WORDS: Record<
  'en' | 'fr',
  { terms: string; privacy: string; updated: (date: string) => string }
> = {
  en: { terms: 'Terms', privacy: 'Privacy', updated: (date) => `Last updated ${date}` },
  fr: {
    terms: '[Conditions]',
    privacy: '[Confidentialité]',
    updated: (date) => `[Dernière mise à jour\u00a0: ${date}]`,
  },
};

/** The demo writes its sample in English and French, the longest; Spanish and Portuguese show the English. */
export function sampleLang(lang: LegalLang): 'en' | 'fr' {
  return lang === 'fr' ? 'fr' : 'en';
}

/** The locale's long date (CLDR), never all numbers: "November 4, 2026", "4 novembre 2026". */
export function longDate(lang: LegalLang, date: Date = EFFECTIVE): string {
  return new Intl.DateTimeFormat(lang, { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}

export function updatedLine(lang: LegalLang): string {
  return PAGE_WORDS[sampleLang(lang)].updated(longDate(sampleLang(lang)));
}

export const SAMPLE_MARK: Record<LegalDoc, string> = {
  terms: 'Sample text, not Soirely’s Terms',
  privacy: 'Sample text, not Soirely’s Privacy notice',
};

const TERMS_EN: Document = {
  title: 'Terms',
  blocks: [
    { kind: 'h2', words: '1. About this sample' },
    {
      kind: 'p',
      runs: [
        'Every word under this heading is sample text. It is here to show how a long document reads on this page, with its headings, paragraphs, lists and links. It is not an agreement, and it binds nobody.',
      ],
    },
    {
      kind: 'p',
      runs: ['Soirely’s own Terms take its place, in English, Spanish, French and Portuguese.'],
    },
    { kind: 'h2', words: '2. How the text is set', middle: true },
    {
      kind: 'p',
      runs: [
        'A paragraph runs to the width of a comfortable line, about 70 characters at a desk, and narrows on a phone without the page scrolling sideways. The space between lines and between paragraphs lets a long document be read without losing the place.',
      ],
    },
    { kind: 'h3', words: '2.1 Lists' },
    {
      kind: 'p',
      runs: ['A list with bullets keeps the second line of each item under its first word:'],
    },
    {
      kind: 'ul',
      items: [
        'A short item.',
        'An item long enough to run onto a second line, so the indent under its bullet shows.',
        'A third item, to end the list.',
      ],
    },
    { kind: 'p', runs: ['A numbered list counts its items in the document’s own order:'] },
    {
      kind: 'ol',
      items: [
        'The first item.',
        'The second item, which also runs long enough to wrap onto another line on a phone.',
        'The last item.',
      ],
    },
    { kind: 'h3', words: '2.2 Links' },
    {
      kind: 'p',
      runs: [
        'A link inside a sentence is underlined, like the one to the ',
        { words: 'sample Privacy notice', to: 'privacy' },
        ', and opens in the same tab.',
      ],
    },
    { kind: 'h2', words: '3. Headings' },
    {
      kind: 'p',
      runs: [
        'The document’s headings become the page’s headings, in the order the document gives them. A screen reader can move from one heading to the next, and the page’s title is the document’s own.',
      ],
    },
    { kind: 'h3', words: '3.1 A heading one level down' },
    {
      kind: 'p',
      runs: [
        'A heading under a heading sits closer to the text it introduces, so the two levels are told apart by size and spacing, not by colour.',
      ],
    },
    { kind: 'h2', words: '4. Dates' },
    {
      kind: 'p',
      runs: [
        'The date at the top of the page is the date the document takes effect. It is the same date in every language, and each language writes it its own way, never in numbers alone.',
      ],
    },
    { kind: 'h2', words: '5. What this sample leaves out' },
    {
      kind: 'p',
      runs: [
        'This sample names no company, no address and no other service. Everything of that kind comes with the real text.',
      ],
    },
  ],
};

const TERMS_FR: Document = {
  title: 'Conditions',
  blocks: [
    { kind: 'h2', words: '1. À propos de cet exemple' },
    {
      kind: 'p',
      runs: [
        'Tous les mots sous ce titre sont un texte d’exemple. Il montre comment un long document se lit sur cette page, avec ses titres, ses paragraphes, ses listes et ses liens. Ce n’est pas un contrat et il n’engage personne.',
      ],
    },
    {
      kind: 'p',
      runs: [
        'Les Conditions de Soirely prendront sa place, en anglais, en espagnol, en français et en portugais.',
      ],
    },
    { kind: 'h2', words: '2. Comment le texte est composé', middle: true },
    {
      kind: 'p',
      runs: [
        'Un paragraphe s’étend sur une ligne confortable, environ 70 caractères sur un ordinateur, et se resserre sur un téléphone sans que la page défile de côté. L’espace entre les lignes et entre les paragraphes permet de lire un long document sans perdre le fil.',
      ],
    },
    { kind: 'h3', words: '2.1 Listes' },
    {
      kind: 'p',
      runs: [
        'Une liste à puces garde la deuxième ligne de chaque élément sous son premier mot\u00a0:',
      ],
    },
    {
      kind: 'ul',
      items: [
        'Un élément court.',
        'Un élément assez long pour passer sur une deuxième ligne, afin que le retrait sous sa puce se voie.',
        'Un troisième élément, pour finir la liste.',
      ],
    },
    {
      kind: 'p',
      runs: ['Une liste numérotée compte ses éléments dans l’ordre du document\u00a0:'],
    },
    {
      kind: 'ol',
      items: [
        'Le premier élément.',
        'Le deuxième élément, lui aussi assez long pour passer à la ligne sur un téléphone.',
        'Le dernier élément.',
      ],
    },
    { kind: 'h3', words: '2.2 Liens' },
    {
      kind: 'p',
      runs: [
        'Un lien dans une phrase est souligné, comme celui vers la ',
        { words: 'politique de confidentialité d’exemple', to: 'privacy' },
        ', et s’ouvre dans le même onglet.',
      ],
    },
    { kind: 'h2', words: '3. Titres' },
    {
      kind: 'p',
      runs: [
        'Les titres du document deviennent ceux de la page, dans l’ordre que le document leur donne. Un lecteur d’écran peut passer d’un titre au suivant, et le titre de la page est celui du document.',
      ],
    },
    { kind: 'h3', words: '3.1 Un titre de niveau inférieur' },
    {
      kind: 'p',
      runs: [
        'Un titre placé sous un autre est plus proche du texte qu’il introduit\u00a0: les deux niveaux se distinguent par la taille et l’espacement, pas par la couleur.',
      ],
    },
    { kind: 'h2', words: '4. Dates' },
    {
      kind: 'p',
      runs: [
        'La date en haut de la page est celle à laquelle le document prend effet. C’est la même date dans toutes les langues, et chaque langue l’écrit à sa façon, jamais en chiffres seuls.',
      ],
    },
    { kind: 'h2', words: '5. Ce que cet exemple laisse de côté' },
    {
      kind: 'p',
      runs: [
        'Cet exemple ne nomme aucune société, aucune adresse et aucun autre service. Tout cela viendra avec le vrai texte.',
      ],
    },
  ],
};

const PRIVACY_EN: Document = {
  title: 'Privacy notice',
  blocks: [
    { kind: 'h2', words: '1. About this sample' },
    {
      kind: 'p',
      runs: [
        'This is sample text, not Soirely’s Privacy notice. It shows how the second document reads in the same page as the first. It says nothing about how any data is used.',
      ],
    },
    { kind: 'h2', words: '2. What the real notice covers', middle: true },
    {
      kind: 'p',
      runs: [
        'When Soirely asks for personal data, such as an email address at sign-in, the real notice tells the reader:',
      ],
    },
    {
      kind: 'ul',
      items: [
        'who is responsible for the data, and how to reach them;',
        'what the data is used for, and on what basis;',
        'who else receives it;',
        'whether it leaves the European Economic Area;',
        'how long it is kept;',
        'the reader’s rights, including the right to complain to a supervisory authority.',
      ],
    },
    { kind: 'h2', words: '3. Reading it in another language' },
    {
      kind: 'p',
      runs: [
        'The notice comes in English, Spanish, French and Portuguese. The language button at the foot of the page changes the text without leaving the page.',
      ],
    },
    { kind: 'h3', words: '3.1 Steps' },
    {
      kind: 'ol',
      items: [
        'Choose the language button at the foot of the page.',
        'Choose a language.',
        'The notice changes to that language, on the same page.',
      ],
    },
    {
      kind: 'p',
      runs: ['The ', { words: 'sample Terms', to: 'terms' }, ' are set the same way.'],
    },
  ],
};

const PRIVACY_FR: Document = {
  title: 'Politique de confidentialité',
  blocks: [
    { kind: 'h2', words: '1. À propos de cet exemple' },
    {
      kind: 'p',
      runs: [
        'Ceci est un texte d’exemple, pas la politique de confidentialité de Soirely. Il montre comment le deuxième document se lit dans la même page que le premier. Il ne dit rien de l’usage d’aucune donnée.',
      ],
    },
    { kind: 'h2', words: '2. Ce que couvre la vraie politique', middle: true },
    {
      kind: 'p',
      runs: [
        'Quand Soirely demande des données personnelles, comme une adresse e-mail à la connexion, la vraie politique indique au lecteur\u00a0:',
      ],
    },
    {
      kind: 'ul',
      items: [
        'qui est responsable des données, et comment le joindre\u00a0;',
        'à quoi servent les données, et sur quelle base\u00a0;',
        'qui d’autre les reçoit\u00a0;',
        'si elles quittent l’Espace économique européen\u00a0;',
        'combien de temps elles sont conservées\u00a0;',
        'les droits du lecteur, dont celui de saisir une autorité de contrôle.',
      ],
    },
    { kind: 'h2', words: '3. La lire dans une autre langue' },
    {
      kind: 'p',
      runs: [
        'La politique existe en anglais, en espagnol, en français et en portugais. Le bouton de langue en bas de la page change le texte sans quitter la page.',
      ],
    },
    { kind: 'h3', words: '3.1 Étapes' },
    {
      kind: 'ol',
      items: [
        'Choisissez le bouton de langue en bas de la page.',
        'Choisissez une langue.',
        'La politique s’affiche dans cette langue, sur la même page.',
      ],
    },
    {
      kind: 'p',
      runs: [
        'Les ',
        { words: 'Conditions d’exemple', to: 'terms' },
        ' sont composées de la même façon.',
      ],
    },
  ],
};

const DOCUMENTS: Record<LegalDoc, Record<'en' | 'fr', Document>> = {
  terms: { en: TERMS_EN, fr: TERMS_FR },
  privacy: { en: PRIVACY_EN, fr: PRIVACY_FR },
};

export function documentFor(doc: LegalDoc, lang: LegalLang): Document {
  return DOCUMENTS[doc][sampleLang(lang)];
}

export const LEGAL_LANGS: readonly LegalLang[] = ['en', 'es', 'fr', 'pt'];

export function legalLang(code: string): LegalLang {
  return LEGAL_LANGS.find((lang) => lang === code) ?? 'en';
}

/** Where a footer's link goes, in the language it is shown in. */
export function legalPath(doc: LegalDoc, lang: LegalLang = 'en'): string {
  return lang === 'fr' ? `/demo/${doc}?state=fr` : `/demo/${doc}`;
}

const STATES = [
  { key: '', name: 'Signed out' },
  { key: 'signed-in', name: 'Signed in, the same page' },
  { key: 'middle', name: 'Scrolled to the middle' },
  { key: 'fr', name: 'In French, then the language button at the foot' },
] as const;

/** The board's states, each at its own `?state=`. */
export const LEGAL_PAGES = (['terms', 'privacy'] as const).map((doc) => ({
  name: doc === 'terms' ? 'Terms' : 'Privacy',
  states: STATES.map(({ key, name }) => ({
    to: key === '' ? `/demo/${doc}` : `/demo/${doc}?state=${key}`,
    name,
  })),
}));
