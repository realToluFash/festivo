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

export type GuestKitchenLang = 'en' | 'es' | 'fr' | 'pt';

/** The board's English (GuestPage.dc.html, page e30, v373): the AC's lines, [en]'s (#4791, #29905) and pm's 422 line (#29942). */
const ENGLISH = {
  title: 'Anything the kitchen must know?',
  intro: 'Choose anything that applies to you and to each person coming with you.',
  introAlone: 'Choose anything that applies to you.',
  consent: 'Only {{hosts}} and the people who cook and serve your meal will see this.',
  you: 'You',
  yourGuest: 'Your guest',
  yourGuestN: 'Your guest {{n}}',
  saved: 'Saved. The kitchen will see this.',
  save: 'Save',
  stays: 'Your answer stays Coming, and who is coming with you stays the same.',
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
type Sample = Record<Exclude<Key, 'notBuilt'>, string>;

/** The board's French: [brackets] until [l10n] writes it; the allergen names are sc-4042's. */
const FRENCH: Sample = {
  title: '[Y a-t-il quelque chose que la cuisine doit savoir ?]',
  intro: '[Choisissez tout ce qui s’applique à vous et à chaque personne qui vous accompagne.]',
  introAlone: '[Choisissez tout ce qui s’applique à vous.]',
  consent:
    '[Seuls {{hosts}} et les personnes qui préparent et servent votre repas verront ces informations.]',
  you: '[Vous]',
  yourGuest: '[Votre invité]',
  yourGuestN: '[Votre invité {{n}}]',
  saved: '[Enregistré. La cuisine verra ces informations.]',
  save: '[Enregistrer]',
  stays: '[Votre réponse reste Présent, et les personnes qui vous accompagnent ne changent pas.]',
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
  changeKitchen: '[Modifier ce que la cuisine doit savoir]',
  changeAnswer: '[Modifier votre réponse]',
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

/** Spanish (Spain) and Portuguese (Portugal) as samples in [brackets], as the guest page's (sc-3790), until l10n writes them. */
const SPANISH: Sample = {
  title: '[¿Hay algo que la cocina deba saber?]',
  intro: '[Elija todo lo que se aplique a usted y a cada persona que le acompaña.]',
  introAlone: '[Elija todo lo que se aplique a usted.]',
  consent: '[Solo {{hosts}} y las personas que cocinan y sirven su comida verán esto.]',
  you: '[Usted]',
  yourGuest: '[Su invitado]',
  yourGuestN: '[Su invitado {{n}}]',
  saved: '[Guardado. La cocina lo verá.]',
  save: '[Guardar]',
  stays: '[Su respuesta sigue siendo Asiste, y quienes le acompañan no cambian.]',
  allergies: '[Alergias]',
  diet: '[Dieta]',
  allergyWord: '[Alergia]',
  which: '[¿Qué alergia?]',
  sayWhich: '[Indique cuál]',
  tooLong: '[Acórtelo a 100 caracteres o menos.]',
  words: '[Algo más, con sus propias palabras]',
  access: '[¿Hay algo que le facilite llegar o moverse por el lugar?]',
  optional: '[Opcional]',
  line: '[{{allergies}}. La cocina y quien le sirva lo verán.]',
  byHosts: '[Último cambio de {{hosts}} el {{date}}. Cambie lo que no sea correcto.]',
  byYou: '[Último cambio suyo el {{date}}.]',
  alsoNoted_one: '[{{hosts}} también anotó:]',
  alsoNoted_other: '[{{hosts}} también anotaron:]',
  remove: '[Quitar]',
  removeAria: '[Quitar {{label}}]',
  keepIt: '[Mantener]',
  keepAria: '[Mantener {{label}}]',
  willRemove: '[{{label}} se quitará al enviar.]',
  next: '[Siguiente]',
  nothing: '[Nada que añadir]',
  leave: '[Dejarlo como está]',
  row: '[Para la cocina]',
  changeKitchen: '[Cambiar lo que la cocina debe saber]',
  changeAnswer: '[Cambiar su respuesta]',
  allergyLine_one: '[Alergia: {{list}}]',
  allergyLine_other: '[Alergias: {{list}}]',
  removed: '[Quitado: {{label}}]',
  gettingIn: '[Para llegar y moverse: {{text}}]',
  quote: '«{{text}}»',
  nothingRow: '[Nada que añadir]',
  notSaved:
    '[No se ha guardado. Esta página no está actualizada. Vuelva a cargarla y elija de nuevo. Lo que eligió sigue en pantalla hasta entonces.]',
  yourMeals: '[Sus comidas]',
  theirMeals: '[Comidas de {{name}}]',
  changeMeals: '[Cambiar: {{row}}]',
  reason: '[{{name}} tiene alergia a: {{list}}.]',
  reasonYou: '[Usted tiene alergia a: {{list}}.]',
  allergyOne: '[Una elección contiene un alérgeno. Cámbiela antes de enviar.]',
};

const PORTUGUESE: Sample = {
  title: '[Há alguma coisa que a cozinha deva saber?]',
  intro: '[Escolha tudo o que se aplica a si e a cada pessoa que o acompanha.]',
  introAlone: '[Escolha tudo o que se aplica a si.]',
  consent: '[Só {{hosts}} e as pessoas que cozinham e servem a sua refeição vão ver isto.]',
  you: '[Você]',
  yourGuest: '[O seu convidado]',
  yourGuestN: '[O seu convidado {{n}}]',
  saved: '[Guardado. A cozinha vai ver isto.]',
  save: '[Guardar]',
  stays: '[A sua resposta continua Presente, e quem vem consigo não muda.]',
  allergies: '[Alergias]',
  diet: '[Dieta]',
  allergyWord: '[Alergia]',
  which: '[Que alergia?]',
  sayWhich: '[Indique qual]',
  tooLong: '[Encurte para 100 caracteres ou menos.]',
  words: '[Mais alguma coisa, por palavras suas]',
  access: '[Há alguma coisa que lhe facilite chegar ou deslocar-se no local?]',
  optional: '[Opcional]',
  line: '[{{allergies}}. A cozinha e quem o servir vão ver isto.]',
  byHosts: '[Última alteração por {{hosts}} a {{date}}. Altere o que não estiver certo.]',
  byYou: '[Última alteração sua a {{date}}.]',
  alsoNoted_one: '[{{hosts}} também anotou:]',
  alsoNoted_other: '[{{hosts}} também anotaram:]',
  remove: '[Remover]',
  removeAria: '[Remover {{label}}]',
  keepIt: '[Manter]',
  keepAria: '[Manter {{label}}]',
  willRemove: '[{{label}} será removido ao enviar.]',
  next: '[Seguinte]',
  nothing: '[Nada a acrescentar]',
  leave: '[Deixar como está]',
  row: '[Para a cozinha]',
  changeKitchen: '[Alterar o que a cozinha deve saber]',
  changeAnswer: '[Alterar a sua resposta]',
  allergyLine_one: '[Alergia: {{list}}]',
  allergyLine_other: '[Alergias: {{list}}]',
  removed: '[Removido: {{label}}]',
  gettingIn: '[Para chegar e circular: {{text}}]',
  quote: '«{{text}}»',
  nothingRow: '[Nada a acrescentar]',
  notSaved:
    '[Não foi guardado. Esta página está desatualizada. Recarregue-a e escolha de novo. O que escolheu fica no ecrã até lá.]',
  yourMeals: '[As suas refeições]',
  theirMeals: '[Refeições de {{name}}]',
  changeMeals: '[Alterar: {{row}}]',
  reason: '[{{name}} tem alergia a: {{list}}.]',
  reasonYou: '[Tem alergia a: {{list}}.]',
  allergyOne: '[Uma escolha contém um alergénio. Altere-a antes de enviar.]',
};

export const GUEST_KITCHEN_ENGLISH = ENGLISH;
export const GUEST_KITCHEN_SAMPLES: Record<Exclude<GuestKitchenLang, 'en'>, Sample> = {
  fr: FRENCH,
  es: SPANISH,
  pt: PORTUGUESE,
};

export const GUEST_KITCHEN_NAMES: Record<
  GuestKitchenLang,
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
  es: {
    allergens: {
      gluten: '[Cereales que contienen gluten]',
      crustaceans: '[Crustáceos]',
      eggs: '[Huevos]',
      fish: '[Pescado]',
      peanuts: '[Cacahuetes]',
      soybeans: '[Soja]',
      milk: '[Leche]',
      tree_nuts: '[Frutos de cáscara]',
      celery: '[Apio]',
      mustard: '[Mostaza]',
      sesame: '[Sésamo]',
      sulphites: '[Dióxido de azufre y sulfitos]',
      lupin: '[Altramuces]',
      molluscs: '[Moluscos]',
      other: '[Otra alergia]',
    },
    diets: {
      vegetarian: '[Vegetariana]',
      vegan: '[Vegana]',
      pescatarian: '[Pescetariana]',
      halal: '[Halal]',
      kosher: '[Kosher]',
      no_pork: '[Sin cerdo]',
      no_beef: '[Sin ternera]',
      no_alcohol: '[Sin alcohol]',
    },
    access: {
      step_free: '[Acceso sin escalones]',
      near_exit: '[Un asiento cerca de una salida]',
      hearing_loop: '[Un bucle magnético]',
      sign_language: '[Lengua de signos]',
      wheelchair_space: '[Espacio para una silla de ruedas en la mesa]',
    },
  },
  pt: {
    allergens: {
      gluten: '[Cereais que contêm glúten]',
      crustaceans: '[Crustáceos]',
      eggs: '[Ovos]',
      fish: '[Peixe]',
      peanuts: '[Amendoins]',
      soybeans: '[Soja]',
      milk: '[Leite]',
      tree_nuts: '[Frutos de casca rija]',
      celery: '[Aipo]',
      mustard: '[Mostarda]',
      sesame: '[Sésamo]',
      sulphites: '[Dióxido de enxofre e sulfitos]',
      lupin: '[Tremoço]',
      molluscs: '[Moluscos]',
      other: '[Outra alergia]',
    },
    diets: {
      vegetarian: '[Vegetariana]',
      vegan: '[Vegana]',
      pescatarian: '[Pescetariana]',
      halal: '[Halal]',
      kosher: '[Kosher]',
      no_pork: '[Sem porco]',
      no_beef: '[Sem vaca]',
      no_alcohol: '[Sem álcool]',
    },
    access: {
      step_free: '[Acesso sem degraus]',
      near_exit: '[Um lugar perto de uma saída]',
      hearing_loop: '[Um anel de indução magnética]',
      sign_language: '[Língua gestual]',
      wheelchair_space: '[Espaço para uma cadeira de rodas à mesa]',
    },
  },
};

const TAGS: Record<GuestKitchenLang, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  pt: 'pt-PT',
};

/** A name inside a list, lower case ("peanuts"); a [bracketed] proposal keeps its bracket. */
export function lowered(name: string, locale: string): string {
  if (name.startsWith('[')) return `[${lowered(name.slice(1), locale)}`;

  return name.charAt(0).toLocaleLowerCase(locale) + name.slice(1);
}

/** The kitchen step's words in the reader's language: the board's English, its French, and bracketed Spanish and Portuguese samples. */
export function guestKitchenWordsFor(lang: GuestKitchenLang) {
  const locale = TAGS[lang];
  const table: Record<Key, string> = {
    ...ENGLISH,
    ...(lang === 'en' ? {} : GUEST_KITCHEN_SAMPLES[lang]),
  };
  const { filled, many, listed } = demoWords(table, { locale });
  const names = GUEST_KITCHEN_NAMES[lang];

  return {
    locale,
    say: (key: Key, slots: Record<string, string> = {}) => filled(table[key], slots),
    many: (base: PluralBase<typeof table>, count: number, slots: Record<string, string>) =>
      many(base, count, slots),
    list: listed,
    lower: (name: string) => lowered(name, locale),
    nth: (n: number) => filled(table.yourGuestN, { n }),
    allergen: (code: Allergen) => names.allergens[code],
    diet: (code: Diet) => names.diets[code],
    access: (code: Access) => names.access[code],
  };
}

export type GuestKitchenWords = ReturnType<typeof guestKitchenWordsFor>;
