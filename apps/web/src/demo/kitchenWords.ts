import { type PluralBase, demoWords } from './demoWords.ts';

/** sc-3777's codes: the 14 allergens in the order of EU 1169/2011 Annex II, then Other allergy. */
export const ALLERGENS = [
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soybeans',
  'milk',
  'tree_nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
  'other',
] as const;
export type Allergen = (typeof ALLERGENS)[number];

export const DIETS = [
  'vegetarian',
  'vegan',
  'pescatarian',
  'halal',
  'kosher',
  'no_pork',
  'no_beef',
  'no_alcohol',
] as const;
export type Diet = (typeof DIETS)[number];

export const ACCESS = [
  'step_free',
  'near_exit',
  'hearing_loop',
  'sign_language',
  'wheelchair_space',
] as const;
export type Access = (typeof ACCESS)[number];

export type KitchenLang = 'en' | 'es' | 'fr' | 'pt';

/** The board's English (GuestPage.dc.html, page e30, v373): the AC's lines, [en]'s (#4791, #29905) and pm's 422 line (#29942). */
const ENGLISH = {
  title: 'Anything the kitchen must know?',
  intro: 'Choose anything that applies to you and to each person coming with you.',
  introAlone: 'Choose anything that applies to you.',
  consent: 'Only {{hosts}} and the people who cook and serve your meal will see this.',
  you: 'You',
  allergies: 'Allergies',
  diet: 'Diet',
  allergyWord: 'Allergy',
  which: 'Which allergy?',
  sayWhich: 'Say which',
  tooLong: 'Shorten it to 100 characters or fewer.',
  words: 'Anything else, in your own words',
  access: 'Anything that would make it easier to get in or around?',
  optional: 'Optional',
  line: '{{allergies}}. The kitchen and your server will see this.',
  byHosts: 'Last changed by {{hosts}} on {{date}}. Change anything that is not right.',
  byYou: 'Last changed by you on {{date}}.',
  alsoNoted_one: '{{hosts}} also noted:',
  alsoNoted_other: '{{hosts}} also noted:',
  remove: 'Remove',
  removeAria: 'Remove {{label}}',
  keepIt: 'Keep it',
  keepAria: 'Keep it, {{label}}',
  willRemove: '{{label}} will be removed when you send.',
  next: 'Next',
  nothing: 'Nothing to add',
  leave: 'Leave it as it is',
  row: 'For the kitchen',
  changeKitchen: 'Change what the kitchen must know',
  changeAnswer: 'Change your answer',
  allergyLine_one: 'Allergy: {{list}}',
  allergyLine_other: 'Allergies: {{list}}',
  removed: 'Removed: {{label}}',
  gettingIn: 'Getting in and around: {{text}}',
  quote: '“{{text}}”',
  nothingRow: 'Nothing to add',
  notSaved:
    'Not saved. This page is out of date. Reload it, then choose again. What you chose stays on screen until you do.',
  yourMeals: 'Your meals',
  theirMeals: '{{name}}’s meals',
  changeMeals: 'Change {{row}}',
  reason: '{{name}} is allergic to: {{list}}.',
  reasonYou: 'You are allergic to: {{list}}.',
  allergyOne: '[A pick contains an allergen. Change it before you send.]',
  notBuilt: 'AC, not yet built · sc-3907',
} as const;

type Key = keyof typeof ENGLISH;

/** The board's French: [brackets] until [l10n] writes it; the allergen names are sc-4042's. */
const FRENCH: Partial<Record<Key, string>> = {
  title: '[Y a-t-il quelque chose que la cuisine doit savoir ?]',
  intro: '[Choisissez tout ce qui s’applique à vous et à chaque personne qui vous accompagne.]',
  introAlone: '[Choisissez tout ce qui s’applique à vous.]',
  consent:
    '[Seuls {{hosts}} et les personnes qui préparent et servent votre repas verront ces informations.]',
  you: '[Vous]',
  allergies: '[Allergies]',
  diet: '[Régime alimentaire]',
  allergyWord: '[Allergie]',
  which: '[Quelle allergie ?]',
  sayWhich: '[Précisez laquelle]',
  tooLong: '[Raccourcissez le texte à 100 caractères maximum.]',
  words: '[Autre chose, avec vos propres mots]',
  access: '[Y a-t-il quelque chose qui faciliterait votre arrivée ou vos déplacements sur place ?]',
  optional: '[Facultatif]',
  line: '[{{allergies}}. La cuisine et la personne qui vous sert verront ces informations.]',
  byHosts: '[Dernière modification par {{hosts}} le {{date}}. Corrigez ce qui n’est pas exact.]',
  byYou: '[Dernière modification par vous le {{date}}.]',
  alsoNoted_one: '[{{hosts}} a aussi noté :]',
  alsoNoted_other: '[{{hosts}} ont aussi noté :]',
  remove: '[Retirer]',
  removeAria: '[Retirer {{label}}]',
  keepIt: '[Garder]',
  keepAria: '[Garder {{label}}]',
  willRemove: '[Sera retiré à l’envoi : {{label}}]',
  next: '[Suivant]',
  nothing: '[Rien à ajouter]',
  leave: '[Laisser tel quel]',
  row: '[Pour la cuisine]',
  changeKitchen: 'Modifier ce que la cuisine doit savoir',
  changeAnswer: 'Modifier votre réponse',
  allergyLine_one: '[Allergie : {{list}}]',
  allergyLine_other: '[Allergies : {{list}}]',
  removed: '[Retiré : {{label}}]',
  gettingIn: '[Pour arriver et circuler : {{text}}]',
  quote: '« {{text}} »',
  nothingRow: '[Rien à ajouter]',
  notSaved:
    '[Non enregistré. Cette page n’est plus à jour. Rechargez-la, puis choisissez à nouveau. Vos choix restent à l’écran jusqu’à ce que vous le fassiez.]',
  yourMeals: '[Vos repas]',
  theirMeals: '[Repas de {{name}}]',
  changeMeals: '[Modifier : {{row}}]',
  reason: '[{{name}} est allergique à : {{list}}.]',
  reasonYou: '[Vous êtes allergique à : {{list}}.]',
  allergyOne: '[Un choix contient un allergène. Modifiez-le avant d’envoyer.]',
};

const NAMES: Record<
  'en' | 'fr',
  {
    allergens: Record<Allergen, string>;
    diets: Record<Diet, string>;
    access: Record<Access, string>;
  }
> = {
  en: {
    allergens: {
      gluten: 'Cereals containing gluten',
      crustaceans: 'Crustaceans',
      eggs: 'Eggs',
      fish: 'Fish',
      peanuts: 'Peanuts',
      soybeans: 'Soya',
      milk: 'Milk',
      tree_nuts: 'Tree nuts',
      celery: 'Celery',
      mustard: 'Mustard',
      sesame: 'Sesame',
      sulphites: 'Sulphur dioxide and sulphites',
      lupin: 'Lupin',
      molluscs: 'Molluscs',
      other: 'Other allergy',
    },
    diets: {
      vegetarian: 'Vegetarian',
      vegan: 'Vegan',
      pescatarian: 'Pescatarian',
      halal: 'Halal',
      kosher: 'Kosher',
      no_pork: 'No pork',
      no_beef: 'No beef',
      no_alcohol: 'No alcohol',
    },
    access: {
      step_free: 'Step-free access',
      near_exit: 'A seat near an exit',
      hearing_loop: 'A hearing loop',
      sign_language: 'Sign language',
      wheelchair_space: 'Space for a wheelchair at the table',
    },
  },
  fr: {
    allergens: {
      gluten: 'Céréales contenant du gluten',
      crustaceans: 'Crustacés',
      eggs: 'Œufs',
      fish: 'Poissons',
      peanuts: 'Arachides',
      soybeans: 'Soja',
      milk: 'Lait',
      tree_nuts: 'Fruits à coque',
      celery: 'Céleri',
      mustard: 'Moutarde',
      sesame: 'Sésame',
      sulphites: 'Anhydride sulfureux et sulfites',
      lupin: 'Lupin',
      molluscs: 'Mollusques',
      other: '[Autre allergie]',
    },
    diets: {
      vegetarian: '[Végétarien]',
      vegan: '[Végan]',
      pescatarian: '[Pescétarien]',
      halal: '[Halal]',
      kosher: '[Casher]',
      no_pork: '[Sans porc]',
      no_beef: '[Sans bœuf]',
      no_alcohol: '[Sans alcool]',
    },
    access: {
      step_free: '[Accès sans marches]',
      near_exit: '[Une place près d’une sortie]',
      hearing_loop: '[Une boucle magnétique]',
      sign_language: '[Langue des signes]',
      wheelchair_space: '[De la place pour un fauteuil roulant à table]',
    },
  },
};

const TAGS: Record<KitchenLang, string> = { en: 'en-US', es: 'es-ES', fr: 'fr-FR', pt: 'pt-PT' };

/** A name inside a list, lower case ("peanuts"); a [bracketed] proposal keeps its bracket. */
export function lowered(name: string, locale: string): string {
  if (name.startsWith('[')) return `[${lowered(name.slice(1), locale)}`;

  return name.charAt(0).toLocaleLowerCase(locale) + name.slice(1);
}

/** The kitchen step's words in the reader's language: the board's English, its French, and English for es and pt, which the board does not draw. */
export function kitchenWordsFor(lang: KitchenLang) {
  const locale = TAGS[lang];
  const table: Record<Key, string> = { ...ENGLISH, ...(lang === 'fr' ? FRENCH : {}) };
  const { filled, many, listed } = demoWords(table, { locale });
  const names = NAMES[lang === 'fr' ? 'fr' : 'en'];

  return {
    locale,
    say: (key: Key, slots: Record<string, string> = {}) => filled(table[key], slots),
    many: (base: PluralBase<typeof table>, count: number, slots: Record<string, string>) =>
      many(base, count, slots),
    list: listed,
    lower: (name: string) => lowered(name, locale),
    allergen: (code: Allergen) => names.allergens[code],
    diet: (code: Diet) => names.diets[code],
    access: (code: Access) => names.access[code],
  };
}

export type KitchenWords = ReturnType<typeof kitchenWordsFor>;
