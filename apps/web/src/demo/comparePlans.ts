import { type Currency, money } from './billing.ts';
import { writtenTime } from './clock.ts';
import { type Lang, count } from './credits.ts';
import { ORG } from './dataControl.ts';

export type PlanKey = 'free' | 'enterprise';
export type Sales = 'self_serve' | 'contract';
export type Period = 'month' | 'year';
type Amount = number | 'unlimited';

export type LimitKey =
  'liveEvents' | 'peoplePerEvent' | 'seats' | 'emails' | 'assistant' | 'storageGb' | 'credits';

export type Feature =
  | 'service_floor'
  | 'guest_list'
  | 'seating'
  | 'invitations'
  | 'budget'
  | 'vendors'
  | 'sms_channel'
  | 'whatsapp_channel'
  | 'assistant'
  | 'email_domains'
  | 'audit_log'
  | 'guest_data_deletion'
  | 'margin'
  | 'branding'
  | 'api';

export interface PlanTerms {
  key: PlanKey;
  sales: Sales;
  /** The catalogue's per-plan flag for "From {price} a month" on a contract plan. */
  fromLine: boolean;
  limits: Readonly<Record<LimitKey, Amount>>;
  prices: Readonly<Record<Currency, Readonly<Record<Period, number>>>>;
  features: readonly Feature[];
}

const FREE_FEATURES: readonly Feature[] = [
  'service_floor',
  'guest_list',
  'seating',
  'invitations',
  'budget',
  'vendors',
  'sms_channel',
  'whatsapp_channel',
  'assistant',
];

/** sc-3928's plans of 19 Oct (migration Version20261119180000). */
export const CATALOGUE: Readonly<Record<PlanKey, PlanTerms>> = {
  free: {
    key: 'free',
    sales: 'self_serve',
    fromLine: false,
    limits: {
      liveEvents: 2,
      peoplePerEvent: 100,
      seats: 3,
      emails: 2500,
      assistant: 5,
      storageGb: 2,
      credits: 50,
    },
    prices: {
      USD: { month: 0, year: 0 },
      EUR: { month: 0, year: 0 },
      GBP: { month: 0, year: 0 },
    },
    features: FREE_FEATURES,
  },
  enterprise: {
    key: 'enterprise',
    sales: 'contract',
    fromLine: true,
    limits: {
      liveEvents: 'unlimited',
      peoplePerEvent: 'unlimited',
      seats: 'unlimited',
      emails: 100000,
      assistant: 100,
      storageGb: 100,
      credits: 3000,
    },
    prices: {
      USD: { month: 249, year: 2490 },
      EUR: { month: 229, year: 2290 },
      GBP: { month: 199, year: 1990 },
    },
    features: [
      ...FREE_FEATURES,
      'email_domains',
      'audit_log',
      'guest_data_deletion',
      'margin',
      'branding',
      'api',
    ],
  },
};

export const PLAN_ORDER: readonly PlanKey[] = ['free', 'enterprise'];
export const LIMIT_ORDER: readonly LimitKey[] = [
  'liveEvents',
  'peoplePerEvent',
  'seats',
  'emails',
  'assistant',
  'storageGb',
  'credits',
];
export const FEATURE_ORDER: readonly Feature[] = CATALOGUE.enterprise.features;

export type Catalogue = Readonly<Record<PlanKey, PlanTerms>>;

export function catalogueOf(selfServe: boolean, fromLine = true): Catalogue {
  return {
    free: CATALOGUE.free,
    enterprise: {
      ...CATALOGUE.enterprise,
      sales: selfServe ? 'self_serve' : 'contract',
      fromLine,
    },
  };
}

function rankOf(plan: PlanKey): number {
  return PLAN_ORDER.indexOf(plan);
}

export type BoxStep = 'current' | 'talk' | 'upgrade' | 'downgrade';

export function stepOf(target: PlanTerms, current: PlanKey): BoxStep {
  if (target.key === current) return 'current';
  if (rankOf(target.key) < rankOf(current)) return 'downgrade';

  return target.sales === 'contract' ? 'talk' : 'upgrade';
}

export interface Meter {
  liveEvents: number;
  /** Live or draft events over Free's 100 people, companion places counted. */
  overPeople: number;
  seats: number;
  settings: readonly Feature[];
}

export const FREE_METER: Meter = { liveEvents: 2, overPeople: 0, seats: 3, settings: [] };

/** On Enterprise from the test catalogue, and still the same on Free after leaving it: nothing is deleted. */
export const ENTERPRISE_METER: Meter = {
  liveEvents: 7,
  overPeople: 3,
  seats: 6,
  settings: ['email_domains'],
};

export const TODAY = '2026-11-28';
export const PERIOD_END = '2026-12-02';
export const NEXT_MONTH = '2026-12-28';
export const NEXT_YEAR = '2027-11-28';
const DAY_MS = 24 * 60 * 60 * 1000;

/** The provider's preview of a switch to yearly today, as a sample: the year, less what is left of the month. */
export function yearlyDue(plan: PlanTerms, currency: Currency, renews: string): number {
  const left = Math.round(
    (Date.parse(`${renews}T00:00:00Z`) - Date.parse(`${TODAY}T00:00:00Z`)) / DAY_MS,
  );
  const cents = (amount: number) => Math.round(amount * 100);
  const price = plan.prices[currency];

  return (cents(price.year) - cents((price.month * left) / 30)) / 100;
}

export function upgradeDue(plan: PlanTerms, currency: Currency): number {
  return plan.prices[currency].month;
}

export function houseDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}

export const TALK_WINDOW_MS = DAY_MS;

export type TalkAnswer = { sent: number } | { already: number };

/** The server's rule as the demo plays it: one request per organisation in 24 hours; a repeat sends nothing and gives the first one's time. */
export function answerTalk(lastAt: number | null, at: number): TalkAnswer {
  return lastAt != null && at - lastAt < TALK_WINDOW_MS ? { already: lastAt } : { sent: at };
}

export function sentWhen(sentAt: number, now: number, locale: string, lang: Lang): string {
  const day = (at: number) => new Date(at).toDateString();
  const time = writtenTime(new Date(sentAt), locale);
  const today = day(sentAt) === day(now);
  if (lang === 'fr') return `${today ? 'aujourd’hui' : 'hier'} à ${time}`;

  return `${today ? 'today' : 'yesterday'} at ${time}`;
}

/** Only billing.manage gets See plans on sc-87's read-only line: the Budget demo's Owner, never its Admin or Lead. */
export function seesPlans(as: string | null, state: string | null): boolean {
  return (as == null || as === 'folake') && state !== 'lead';
}

type Words = (typeof COMPARE_WORDS)[Lang];

function amountWords(amount: Amount, key: LimitKey, locale: string, w: Words): string {
  if (amount === 'unlimited') return w.unlimited;
  if (key === 'storageGb') return `${count(amount, locale)} GB`;

  return count(amount, locale);
}

export function limitCell(plan: PlanTerms, key: LimitKey, locale: string, lang: Lang): string {
  return amountWords(plan.limits[key], key, locale, COMPARE_WORDS[lang]);
}

export function includes(plan: PlanTerms, feature: Feature): boolean {
  return plan.features.includes(feature);
}

export interface PriceLines {
  main: string;
  under: string | null;
}

export function priceLines(
  plan: PlanTerms,
  currency: Currency,
  locale: string,
  lang: Lang,
): PriceLines {
  const w = COMPARE_WORDS[lang];
  const month = money(plan.prices[currency].month, currency, locale);
  if (plan.sales === 'contract') {
    return plan.fromLine
      ? { main: w.fromMonth(month), under: w.soldByContract }
      : { main: w.soldByContract, under: null };
  }
  if (plan.prices[currency].year === 0) return { main: w.perMonth(month), under: null };

  return {
    main: w.perMonth(month),
    under: w.orYear(money(plan.prices[currency].year, currency, locale)),
  };
}

function limitOf(plan: PlanTerms, key: LimitKey): number | null {
  const amount = plan.limits[key];

  return amount === 'unlimited' ? null : amount;
}

function list(items: readonly string[], and: string): string {
  if (items.length < 2) return items.join('');

  return `${items.slice(0, -1).join(', ')} ${and} ${items.at(-1) ?? ''}`;
}

export function changesFor(
  target: PlanTerms,
  current: PlanTerms,
  meter: Meter,
  locale: string,
  lang: Lang,
): string[] {
  const w = COMPARE_WORDS[lang];
  if (target.key === current.key) return [w.nothing];
  const n = (value: number) => count(value, locale);
  const amount = (plan: PlanTerms, key: LimitKey) => amountWords(plan.limits[key], key, locale, w);
  const monthly = (plan: PlanTerms) =>
    (['emails', 'assistant', 'storageGb', 'credits'] as const).map((key) => amount(plan, key));
  const down = rankOf(target.key) < rankOf(current.key);
  const events = limitOf(target, 'liveEvents');
  const people = limitOf(target, 'peoplePerEvent');
  const seats = limitOf(target, 'seats');
  const lines: string[] = [];

  if (down) {
    if (events != null && meter.liveEvents > events) {
      lines.push(w.eventsOver(n(meter.liveEvents), n(events)));
    }
    if (people != null && meter.overPeople > 0) {
      lines.push(w.peopleOver(meter.overPeople, n(meter.overPeople), n(people)));
    }
    if (seats != null && meter.seats > seats) lines.push(w.seatsOver(n(meter.seats), n(seats)));
  } else {
    const eventsWas = limitOf(current, 'liveEvents');
    if (events == null && eventsWas != null && meter.liveEvents >= eventsWas) {
      lines.push(w.eventsFreed(n(meter.liveEvents), n(eventsWas)));
    }
    if (people == null && meter.overPeople > 0) {
      lines.push(w.peopleFreed(meter.overPeople, n(meter.overPeople)));
    }
    const seatsWas = limitOf(current, 'seats');
    if (seats == null && seatsWas != null && meter.seats >= seatsWas) {
      lines.push(w.seatsFreed(n(meter.seats), n(seatsWas)));
    }
  }

  lines.push(w.monthly(monthly(target), list(monthly(current), w.and)));

  if (down) {
    const off = meter.settings.filter((one) => includes(current, one) && !includes(target, one));
    if (off.length > 0) lines.push(w.settingsOff(off.map((one) => w.features[one]).join(', ')));
  } else {
    const back = meter.settings.filter((one) => includes(target, one) && !includes(current, one));
    if (back.length > 0) lines.push(w.settingsBack(back.map((one) => w.features[one]).join(', ')));
    const gained = target.features.filter((one) => !includes(current, one) && !back.includes(one));
    if (gained.length > 0)
      lines.push(
        w.adds(
          list(
            gained.map((one) => w.features[one]),
            w.and,
          ),
        ),
      );
  }

  return lines;
}

type Monthly = readonly [string, string, string, string] | readonly string[];

/** The board's English, and French for the 320 check: proposals for [en] and l10n, except the title, settled 27 Nov. */
export const COMPARE_WORDS = {
  en: {
    title: 'Compare plans',
    close: 'Close',
    caption: 'The plans, their limits and what each includes',
    yourPlan: 'Your plan',
    names: { free: 'Free', enterprise: 'Enterprise' } as Readonly<Record<PlanKey, string>>,
    perMonth: (price: string) => `${price} a month`,
    perYear: (price: string) => `${price} a year`,
    orYear: (price: string) => `or ${price} a year`,
    fromMonth: (price: string) => `From ${price} a month`,
    soldByContract: 'Sold by contract',
    tax: 'Prices exclude tax for business buyers.',
    limits: {
      liveEvents: 'Live events',
      peoplePerEvent: 'People per event',
      seats: 'Team seats',
      emails: 'Emails each month',
      assistant: 'Assistant requests each month',
      storageGb: 'Storage',
      credits: 'Credits each month',
    } as Readonly<Record<LimitKey, string>>,
    unlimited: 'Unlimited',
    included: 'Included',
    notIncluded: 'Not included',
    features: {
      service_floor: 'Service floor',
      guest_list: 'Guest list',
      seating: 'Seating',
      invitations: 'Invitations',
      budget: 'Budget',
      vendors: 'Vendors',
      sms_channel: 'SMS',
      whatsapp_channel: 'WhatsApp',
      assistant: 'Assistant',
      email_domains: 'Email domains',
      audit_log: 'Audit log',
      guest_data_deletion: 'Guest data deletion',
      margin: 'Margin',
      branding: 'Branding',
      api: 'API',
    } as Readonly<Record<Feature, string>>,
    and: 'and',
    changes: `What changes for ${ORG}`,
    nothing: `Nothing. This is the plan ${ORG} is on.`,
    eventsOver: (have: string, allows: string) =>
      `You have ${have} live events; this plan allows ${allows}. All ${have} stay live; you can’t publish another until you’re under ${allows}.`,
    peopleOver: (n: number, shown: string, limit: string) =>
      n === 1
        ? `1 of your events has more than ${limit} people. It keeps every guest; you can’t add more to it.`
        : `${shown} of your events have more than ${limit} people. They keep every guest; you can’t add more to them.`,
    seatsOver: (have: string, allows: string) =>
      `You have ${have} team seats; this plan allows ${allows}. Everyone keeps their seat; you can’t invite anyone until you’re under ${allows}.`,
    eventsFreed: (have: string, allowed: string) =>
      `You have ${have} live events; Free allows ${allowed}. This plan has no limit.`,
    peopleFreed: (n: number, shown: string) =>
      n === 1
        ? '1 of your events has more than 100 people. This plan has no limit, so you can add to it again.'
        : `${shown} of your events have more than 100 people. This plan has no limit, so you can add to them again.`,
    seatsFreed: (have: string, allowed: string) =>
      `You use ${have} team seats; Free allows ${allowed}. This plan has no limit.`,
    monthly: (now: Monthly, was: string) =>
      `Each month includes ${now[0]} emails, ${now[1]} assistant requests, ${now[2]} of storage and ${now[3]} credits, instead of ${was}.`,
    settingsOff: (names: string) =>
      `These Enterprise settings switch off and keep their values: ${names}.`,
    settingsBack: (names: string) =>
      `These settings come back on with the values they kept: ${names}.`,
    adds: (names: string) => `Adds ${names}.`,
    talk: 'Talk to us',
    talkLine: `Talk to us sends Soirely ${ORG}, your name and email, and this summary.`,
    talkSending: 'Sending…',
    thanks: 'Thanks. We’ll reply within one working day.',
    already: (when: string) =>
      `Already sent ${when}, so nothing more was sent. We’ll reply within one working day.`,
    upgrade: 'Upgrade',
    previewing: 'Getting today’s amount from the payment provider…',
    dueToday: 'Due today',
    newPeriod: (date: string) =>
      `Billed from today: a new month starts today, with nothing used. Next payment ${date}.`,
    appliesOnPayment: 'The new limits apply once the payment is confirmed.',
    notNow: 'Not now',
    toPayment: 'Continue to payment',
    downgrade: 'Downgrade…',
    testCatalogue:
      'Test catalogue: Enterprise sold self-serve. At launch it is sold by contract, and nobody sees Upgrade, Switch to yearly, Downgrade or Cancel plan.',
    askUpgrade: (plan: string) => `Upgrade to ${plan}?`,
    askDowngrade: (plan: string) => `Downgrade to ${plan}?`,
    askCancel: (plan: string) => `Cancel ${plan}?`,
    askLine: (current: string, target: string, date: string) =>
      `${ORG} stays on ${current} until ${date}, then moves to ${target}. Nothing is deleted.`,
    keep: (plan: string) => `Keep ${plan}`,
    goDowngrade: 'Downgrade',
    goCancel: 'Cancel plan',
    cancelPlan: 'Cancel plan…',
    switchYearly: 'Switch to yearly',
    askYearly: 'Switch to yearly?',
    yearlyLine: (price: string, due: string, date: string) =>
      `${price} a year, billed from today: ${due} due today, the year less what is left of this month. A new year starts today, with nothing used. Next payment ${date}.`,
    keepMonthly: 'Keep monthly',
    yearlyRefused: `The payment provider refused the charge. Nothing was charged, and ${ORG} stays on Enterprise, monthly. Update the payment method, then switch again.`,
    updateMethod: 'Update payment method',
    moving: (plan: string, date: string) => `Moving to ${plan} on ${date}.`,
    kept: (plan: string) => `Staying on ${plan}.`,
    downgraded: 'Nothing was deleted. Everything over Free’s limits is kept and reads as it did.',
    yearly: (price: string, date: string) => `${price} a year, renews ${date}`,
    monthlyLine: (price: string, date: string) => `${price} a month, renews ${date}`,
  },
  fr: {
    title: 'Comparer les forfaits',
    close: 'Fermer',
    caption: 'Les forfaits, leurs limites et ce que chacun comprend',
    yourPlan: 'Votre forfait',
    names: { free: 'Gratuit', enterprise: 'Enterprise' } as Readonly<Record<PlanKey, string>>,
    perMonth: (price: string) => `${price} par mois`,
    perYear: (price: string) => `${price} par an`,
    orYear: (price: string) => `ou ${price} par an`,
    fromMonth: (price: string) => `À partir de ${price} par mois`,
    soldByContract: 'Vendu sur contrat',
    tax: 'Prix hors taxes pour les clients professionnels.',
    limits: {
      liveEvents: 'Événements actifs',
      peoplePerEvent: 'Personnes par événement',
      seats: 'Places dans l’équipe',
      emails: 'E-mails par mois',
      assistant: 'Demandes à l’assistant par mois',
      storageGb: 'Stockage',
      credits: 'Crédits par mois',
    } as Readonly<Record<LimitKey, string>>,
    unlimited: 'Illimité',
    included: 'Inclus',
    notIncluded: 'Non inclus',
    features: {
      service_floor: 'Service en salle',
      guest_list: 'Liste des invités',
      seating: 'Plan de table',
      invitations: 'Invitations',
      budget: 'Budget',
      vendors: 'Prestataires',
      sms_channel: 'SMS',
      whatsapp_channel: 'WhatsApp',
      assistant: 'Assistant',
      email_domains: 'Domaines de messagerie',
      audit_log: 'Journal d’audit',
      guest_data_deletion: 'Suppression des données des invités',
      margin: 'Marge',
      branding: 'Image de marque',
      api: 'API',
    } as Readonly<Record<Feature, string>>,
    and: 'et',
    changes: `Ce qui change pour ${ORG}`,
    nothing: `Rien. ${ORG} est déjà sur ce forfait.`,
    eventsOver: (have: string, allows: string) =>
      `Vous avez ${have} événements actifs ; ce forfait en permet ${allows}. Les ${have} restent actifs ; vous ne pourrez pas en publier d’autre avant d’être sous ${allows}.`,
    peopleOver: (n: number, shown: string, limit: string) =>
      n === 1
        ? `1 de vos événements compte plus de ${limit} personnes. Il garde tous ses invités ; vous ne pourrez pas en ajouter.`
        : `${shown} de vos événements comptent plus de ${limit} personnes. Ils gardent tous leurs invités ; vous ne pourrez pas en ajouter.`,
    seatsOver: (have: string, allows: string) =>
      `Vous avez ${have} places dans l’équipe ; ce forfait en permet ${allows}. Chacun garde sa place ; vous ne pourrez inviter personne avant d’être sous ${allows}.`,
    eventsFreed: (have: string, allowed: string) =>
      `Vous avez ${have} événements actifs ; Gratuit en permet ${allowed}. Ce forfait n’a pas de limite.`,
    peopleFreed: (n: number, shown: string) =>
      n === 1
        ? '1 de vos événements compte plus de 100 personnes. Ce forfait n’a pas de limite : vous pourrez de nouveau y ajouter des invités.'
        : `${shown} de vos événements comptent plus de 100 personnes. Ce forfait n’a pas de limite : vous pourrez de nouveau y ajouter des invités.`,
    seatsFreed: (have: string, allowed: string) =>
      `Vous utilisez ${have} places dans l’équipe ; Gratuit en permet ${allowed}. Ce forfait n’a pas de limite.`,
    monthly: (now: Monthly, was: string) =>
      `Chaque mois comprend ${now[0]} e-mails, ${now[1]} demandes à l’assistant, ${now[2]} de stockage et ${now[3]} crédits, au lieu de ${was}.`,
    settingsOff: (names: string) =>
      `Ces réglages Enterprise se désactivent et gardent leurs valeurs : ${names}.`,
    settingsBack: (names: string) =>
      `Ces réglages se réactivent avec les valeurs qu’ils ont gardées : ${names}.`,
    adds: (names: string) => `Ajoute ${names}.`,
    talk: 'Nous contacter',
    talkLine: `Nous contacter envoie à Soirely ${ORG}, votre nom et votre e-mail, et ce résumé.`,
    talkSending: 'Envoi…',
    thanks: 'Merci. Nous vous répondrons sous un jour ouvré.',
    already: (when: string) =>
      `Déjà envoyé ${when} : rien de plus n’a été envoyé. Nous vous répondrons sous un jour ouvré.`,
    upgrade: 'Passer à ce forfait',
    previewing: 'Montant du jour demandé au prestataire de paiement…',
    dueToday: 'À payer aujourd’hui',
    newPeriod: (date: string) =>
      `Facturé à partir d’aujourd’hui : un nouveau mois commence aujourd’hui, sans rien d’utilisé. Prochain paiement ${date}.`,
    appliesOnPayment: 'Les nouvelles limites s’appliquent une fois le paiement confirmé.',
    notNow: 'Pas maintenant',
    toPayment: 'Continuer vers le paiement',
    downgrade: 'Passer à un forfait inférieur…',
    testCatalogue:
      'Catalogue de test : Enterprise vendu en libre-service. Au lancement, il est vendu sur contrat.',
    askUpgrade: (plan: string) => `Passer à ${plan} ?`,
    askDowngrade: (plan: string) => `Passer à ${plan} ?`,
    askCancel: (plan: string) => `Résilier ${plan} ?`,
    askLine: (current: string, target: string, date: string) =>
      `${ORG} reste sur ${current} jusqu’au ${date}, puis passe à ${target}. Rien n’est supprimé.`,
    keep: (plan: string) => `Garder ${plan}`,
    goDowngrade: 'Passer au forfait inférieur',
    goCancel: 'Résilier le forfait',
    cancelPlan: 'Résilier le forfait…',
    switchYearly: 'Passer à l’annuel',
    askYearly: 'Passer à l’annuel ?',
    yearlyLine: (price: string, due: string, date: string) =>
      `${price} par an, facturé à partir d’aujourd’hui : ${due} à payer aujourd’hui, l’année moins ce qui reste de ce mois. Une nouvelle année commence aujourd’hui, sans rien d’utilisé. Prochain paiement ${date}.`,
    keepMonthly: 'Garder le mensuel',
    yearlyRefused: `Le prestataire de paiement a refusé le prélèvement. Rien n’a été débité, et ${ORG} reste sur Enterprise, au mois. Mettez à jour le moyen de paiement, puis réessayez.`,
    updateMethod: 'Mettre à jour le moyen de paiement',
    moving: (plan: string, date: string) => `Passage à ${plan} le ${date}.`,
    kept: (plan: string) => `Vous restez sur ${plan}.`,
    downgraded:
      'Rien n’a été supprimé. Tout ce qui dépasse les limites de Gratuit est gardé et se lit comme avant.',
    yearly: (price: string, date: string) => `${price} par an, renouvelé le ${date}`,
    monthlyLine: (price: string, date: string) => `${price} par mois, renouvelé le ${date}`,
  },
} satisfies Record<Lang, unknown>;
