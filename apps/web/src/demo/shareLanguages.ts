import type { Lang } from './guest.ts';
import { SHARE_WORDS as W } from './shareWords.ts';
import { type Category } from './vendors.ts';
import { CATEGORY_WORDS } from './vendorsWords.ts';

export type Covers = 'all of it' | 'half';

/** What the signed-out share says, in the language its reader chose; es, fr and pt settled by l10n on sc-31779 (#34553), pt's board lines from Budget-A-Share 26. */
export interface ReaderWords {
  yourShareOf: (event: string) => string;
  budgetFor: (event: string) => string;
  categoryFor: (category: string, event: string) => string;
  thisEventWillCost: string;
  sharedBy: (org: string, day: string, time: string) => string;
  yourShare: string;
  willCost: (category: string) => string;
  between: (low: string, high: string, still: number) => string;
  range: (low: string, high: string) => string;
  repliesDoNot: string;
  notPricedYet: (n: number) => string;
  perHeadSettled: string;
  perHeadIfAll: string;
  coming: (n: number) => string;
  paid: string;
  stillToCome: string;
  stillToPay: string;
  noneScheduled: string;
  nextTo: (amount: string, vendor: string, day: string) => string;
  next: (amount: string, day: string) => string;
  whatItCovers: string;
  whatItIsMadeOf: string;
  forEachGuest: string;
  forEachDay: (days: number) => string;
  noSeatingPlan: string;
  nothingYet: string;
  notPriced: string;
  planningFee: string;
  print: string;
  asksTitle: string;
  asksLine: string;
  passphrase: string;
  open: string;
  wrongPassphrase: string;
  tooMany: (time: string) => string;
  tooManySoon: string;
  goneTitle: string;
  goneLine: string;
  endedTitle: string;
  endedLine: (name: string) => string;
  covers: Record<Covers, string>;
  categories: Record<Category, string>;
  /** A day as the reader's language writes it: English keeps the board's weekday, the others the board's «3 de novembro». */
  day: Intl.DateTimeFormatOptions;
}

const isOne = (tag: string, n: number): boolean => new Intl.PluralRules(tag).select(n) === 'one';

const ENGLISH: ReaderWords = {
  yourShareOf: W.yourShareOf,
  budgetFor: W.budgetFor,
  categoryFor: W.categoryFor,
  thisEventWillCost: W.thisEventWillCost,
  sharedBy: W.sharedBy,
  yourShare: W.yourShare,
  willCost: W.willCost,
  between: W.between,
  range: (low, high) => `${low} to ${high}`,
  repliesDoNot: W.repliesDoNot,
  notPricedYet: W.notPricedYet,
  perHeadSettled: W.perHeadSettled,
  perHeadIfAll: W.perHeadIfAll,
  coming: W.coming,
  paid: W.paid,
  stillToCome: W.stillToCome,
  stillToPay: W.stillToPay,
  noneScheduled: 'No payments scheduled yet',
  nextTo: W.nextTo,
  next: W.next,
  whatItCovers: W.whatItCovers,
  whatItIsMadeOf: W.whatItIsMadeOf,
  forEachGuest: W.forEachGuest,
  forEachDay: W.forEachDay,
  noSeatingPlan: W.noSeatingPlan,
  nothingYet: W.nothingYet,
  notPriced: W.notPriced,
  planningFee: W.planningFee,
  print: W.print,
  asksTitle: W.asksTitle,
  asksLine: W.asksLine,
  passphrase: W.passphrase,
  open: W.open,
  wrongPassphrase: W.wrongPassphrase,
  tooMany: W.tooMany,
  tooManySoon: W.tooManySoon,
  goneTitle: W.goneTitle,
  goneLine: W.goneLine,
  endedTitle: W.endedTitle,
  endedLine: W.endedLine,
  covers: { 'all of it': 'all of it', half: 'half' },
  categories: CATEGORY_WORDS,
  day: { weekday: 'short', month: 'short', day: 'numeric' },
};

const SPANISH: ReaderWords = {
  yourShareOf: (event) => `Su parte de ${event}`,
  budgetFor: (event) => `El presupuesto de ${event}`,
  categoryFor: (category, event) => `${category} de ${event}`,
  thisEventWillCost: 'Este evento costará',
  sharedBy: (org, day, time) => `Compartido por ${org} · Actualizado el ${day} a las ${time}`,
  yourShare: 'Su parte',
  willCost: (category) => `${category}: coste previsto`,
  between: (low, high, still) =>
    `Entre ${low} y ${high}, según cuántas de las ${still} personas que aún no han respondido digan que sí.`,
  range: (low, high) => `${low} a ${high}`,
  repliesDoNot: 'Las respuestas no cambian esta cifra.',
  notPricedYet: (n) => (n === 1 ? '1 coste aún sin precio.' : `${n} costes aún sin precio.`),
  perHeadSettled: 'Por persona, confirmados',
  perHeadIfAll: 'Por persona, si vienen todos',
  coming: (n) => (isOne('es', n) ? `${n} asistente` : `${n} asistentes`),
  paid: 'Pagado',
  stillToCome: 'Pendiente',
  stillToPay: 'Por pagar',
  noneScheduled: 'Aún no hay pagos programados',
  nextTo: (amount, vendor, day) => `Siguiente: ${amount} a ${vendor}, vence el ${day}`,
  next: (amount, day) => `Siguiente: ${amount}, vence el ${day}`,
  whatItCovers: 'Qué cubre',
  whatItIsMadeOf: 'De qué se compone',
  forEachGuest: 'por cada invitado que diga que sí',
  forEachDay: (days) => `por cada uno de los ${days} días`,
  noSeatingPlan: 'aún sin plano de mesas',
  nothingYet: 'Aún nada',
  notPriced: 'Aún sin precio',
  planningFee: 'Honorarios de organización',
  print: 'Imprimir',
  asksTitle: 'Este enlace pide una frase de acceso',
  asksLine: 'Quien lo compartió le da la frase de acceso por otra vía.',
  passphrase: 'Frase de acceso',
  open: 'Abrir',
  wrongPassphrase: 'Esa frase de acceso no es correcta. Revísela y vuelva a intentarlo.',
  tooMany: (time) =>
    `Se han probado demasiadas frases de acceso incorrectas en este enlace. Vuelva a intentarlo a las ${time}.`,
  tooManySoon:
    'Se han probado demasiadas frases de acceso incorrectas en este enlace. Espere un momento y vuelva a intentarlo.',
  goneTitle: 'Este enlace no abre nada',
  goneLine: 'Puede que se haya revocado o que haya caducado. Pida uno nuevo a quien se lo envió.',
  endedTitle: 'Este enlace ha caducado.',
  endedLine: (name) => `Pida uno nuevo a ${name}.`,
  covers: { 'all of it': 'todo', half: 'la mitad' },
  categories: {
    catering: 'Catering',
    venue: 'Lugar',
    flowers: 'Flores',
    photography: 'Fotografía',
    music: 'Música',
    transport: 'Transporte',
    staffing: 'Personal',
    hire: 'Alquiler',
    other: 'Otros',
  },
  day: { month: 'long', day: 'numeric' },
};

const FRENCH: ReaderWords = {
  yourShareOf: (event) => `Votre part pour ${event}`,
  budgetFor: (event) => `Le budget de ${event}`,
  categoryFor: (category, event) => `${category} pour ${event}`,
  thisEventWillCost: 'Cet événement coûtera',
  sharedBy: (org, day, time) => `Partagé par ${org} · Mis à jour le ${day} à ${time}`,
  yourShare: 'Votre part',
  willCost: (category) => `${category}\u00a0: coût prévu`,
  between: (low, high, still) =>
    `Entre ${low} et ${high}, selon le nombre de personnes qui diront oui parmi les ${still} qui n’ont pas encore répondu.`,
  range: (low, high) => `${low} à ${high}`,
  repliesDoNot: 'Les réponses ne changent pas ce montant.',
  notPricedYet: (n) =>
    n < 2 ? `${n} coût pas encore chiffré.` : `${n} coûts pas encore chiffrés.`,
  perHeadSettled: 'Par personne, confirmés',
  perHeadIfAll: 'Par personne, si tout le monde vient',
  coming: (n) => (isOne('fr', n) ? `${n} présent` : `${n} présents`),
  paid: 'Payé',
  stillToCome: 'Reste à payer',
  stillToPay: 'À payer',
  noneScheduled: 'Aucun paiement prévu pour l’instant',
  nextTo: (amount, vendor, day) => `Prochain\u00a0: ${amount} à ${vendor}, dû le ${day}`,
  next: (amount, day) => `Prochain\u00a0: ${amount}, dû le ${day}`,
  whatItCovers: 'Ce que cela couvre',
  whatItIsMadeOf: 'Ce qui le compose',
  forEachGuest: 'par invité qui dit oui',
  forEachDay: (days) => `pour chacun des ${days} jours`,
  noSeatingPlan: 'pas encore de plan de table',
  nothingYet: 'Rien pour l’instant',
  notPriced: 'Pas encore chiffré',
  planningFee: 'Frais d’organisation',
  print: 'Imprimer',
  asksTitle: 'Ce lien demande une phrase secrète',
  asksLine: 'La personne qui l’a partagé vous transmet la phrase secrète par un autre moyen.',
  passphrase: 'Phrase secrète',
  open: 'Ouvrir',
  wrongPassphrase: 'Cette phrase secrète n’est pas la bonne. Vérifiez-la et réessayez.',
  tooMany: (time) =>
    `Trop de tentatives avec une phrase secrète erronée sur ce lien. Réessayez à ${time}.`,
  tooManySoon:
    'Trop de tentatives avec une phrase secrète erronée sur ce lien. Patientez un instant, puis réessayez.',
  goneTitle: 'Ce lien n’ouvre rien',
  goneLine:
    'Il a peut-être été révoqué ou a expiré. Demandez-en un nouveau à la personne qui vous l’a envoyé.',
  endedTitle: 'Ce lien a expiré.',
  endedLine: (name) => `Demandez-en un nouveau à ${name}.`,
  covers: { 'all of it': 'en totalité', half: 'la moitié' },
  categories: {
    catering: 'Traiteur',
    venue: 'Lieu',
    flowers: 'Fleurs',
    photography: 'Photographie',
    music: 'Musique',
    transport: 'Transport',
    staffing: 'Personnel',
    hire: 'Location',
    other: 'Autre',
  },
  day: { month: 'long', day: 'numeric' },
};

const PORTUGUESE: ReaderWords = {
  yourShareOf: (event) => `A sua parte em ${event}`,
  budgetFor: (event) => `O orçamento de ${event}`,
  categoryFor: (category, event) => `${category} de ${event}`,
  thisEventWillCost: 'Este evento vai custar',
  sharedBy: (org, day, time) => `Partilhado por ${org} · Atualizado a ${day} às ${time}`,
  yourShare: 'A sua parte',
  willCost: (category) => `${category}: custo previsto`,
  between: (low, high, still) =>
    `Entre ${low} e ${high}, consoante quantas das ${still} pessoas que ainda não responderam disserem que sim.`,
  range: (low, high) => `${low} a ${high}`,
  repliesDoNot: 'As respostas não alteram este valor.',
  notPricedYet: (n) => (n === 1 ? '1 custo ainda sem preço.' : `${n} custos ainda sem preço.`),
  perHeadSettled: 'Por pessoa, confirmados',
  perHeadIfAll: 'Por pessoa, se todos vierem',
  coming: (n) => (isOne('pt-PT', n) ? `${n} presente` : `${n} presentes`),
  paid: 'Pago',
  stillToCome: 'Ainda por pagar',
  stillToPay: 'Falta pagar',
  noneScheduled: 'Ainda sem pagamentos agendados',
  nextTo: (amount, vendor, day) => `Próximo: ${amount} a ${vendor}, até ${day}`,
  next: (amount, day) => `Próximo: ${amount}, até ${day}`,
  whatItCovers: 'O que cobre',
  whatItIsMadeOf: 'De que é feito',
  forEachGuest: 'por cada convidado que disser que sim',
  forEachDay: (days) => `por cada um dos ${days} dias`,
  noSeatingPlan: 'ainda sem plano de mesas',
  nothingYet: 'Ainda nada',
  notPriced: 'Ainda sem preço',
  planningFee: 'Taxa de planeamento',
  print: 'Imprimir',
  asksTitle: 'Esta ligação pede uma frase-passe',
  asksLine: 'Quem a partilhou envia-lhe a frase-passe por outro meio.',
  passphrase: 'Frase-passe',
  open: 'Abrir',
  wrongPassphrase: 'Esta frase-passe não está correta. Verifique-a e tente novamente.',
  tooMany: (time) =>
    `Foram tentadas demasiadas frases-passe erradas nesta ligação. Tente novamente às ${time}.`,
  tooManySoon:
    'Foram tentadas demasiadas frases-passe erradas nesta ligação. Aguarde um momento e tente novamente.',
  goneTitle: 'Esta ligação não abre nada',
  goneLine: 'Pode ter sido revogada ou ter expirado. Peça uma nova a quem a enviou.',
  endedTitle: 'Esta ligação expirou.',
  endedLine: (name) => `Peça uma nova a ${name}.`,
  covers: { 'all of it': 'tudo', half: 'metade' },
  categories: {
    catering: 'Catering',
    venue: 'Espaço',
    flowers: 'Flores',
    photography: 'Fotografia',
    music: 'Música',
    transport: 'Transporte',
    staffing: 'Equipa',
    hire: 'Aluguer',
    other: 'Outros',
  },
  day: { month: 'long', day: 'numeric' },
};

export const READER_WORDS: Record<Lang, ReaderWords> = {
  en: ENGLISH,
  es: SPANISH,
  fr: FRENCH,
  pt: PORTUGUESE,
};
