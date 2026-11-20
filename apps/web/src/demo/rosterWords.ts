import { createContext, useContext } from 'react';

import es from '../i18n/locales/es.json';
import fr from '../i18n/locales/fr.json';
import pt from '../i18n/locales/pt.json';
import { mw } from './menuServed.ts';
import { LINK_WORDS, ORGANISATION, RW, type LinkState } from './roster.ts';
import { SW } from './stations.ts';
import { type Delivered, type Trail, LW, trailLine } from './staffLink.ts';

/** The Roster's words in one language: the product's own where it has them, [bracketed] samples where l10n has not written them. */
export interface RosterWords {
  lang: 'en' | 'fr' | 'es' | 'pt';
  rw: typeof RW;
  lw: typeof LW;
  links: Record<LinkState, string>;
  tabs: readonly string[];
  events: string;
  crumb: string;
  close: string;
  cancel: string;
  trail: (link: Delivered, trail: Trail | null) => string | null;
}

const EN: RosterWords = {
  lang: 'en',
  rw: RW,
  lw: LW,
  links: LINK_WORDS,
  tabs: SW.tabs,
  events: 'Events',
  crumb: 'Breadcrumb',
  close: SW.close,
  cancel: SW.cancel,
  trail: trailLine,
};

type Locale = typeof fr;

/** The Roster's words the product already has in a locale; what l10n has not written stays [bracketed]. */
function productWords(L: Locale, hours: string) {
  const R = L.roster;
  const more = /<more>(.*)<\/more>/u.exec(R.moreShifts)?.[1] ?? R.moreShifts;

  return {
    tabs: [R.roster, L.jobs.tab, L.stations.tab, hours],
    title: R.title,
    sub: R.sub,
    roster: R.roster,
    add: R.add,
    empty: R.empty,
    emptySub: R.emptySub,
    person: R.name,
    job: R.job,
    station: R.station,
    shift: R.shift,
    link: R.link,
    mobile: R.mobile,
    email: R.email,
    optional: R.optional,
    country: R.country,
    noJob: R.noJob,
    noStation: R.noStation,
    noShift: R.noShift,
    nameHelp: mw(R.nameHelp, { max: '200' }),
    mobileHelp: R.mobileHelp,
    addCta: R.addCta,
    addAnyway: R.addAnyway,
    saveChanges: R.saveChanges,
    saveAnyway: R.saveAnyway,
    cancel: R.cancel,
    edit: R.edit,
    remove: R.remove,
    keep: R.keep,
    stopsWorking: R.stopsWorking,
    saved: R.saved,
    dismiss: R.dismiss,
    close: R.close,
    blank: R.blank,
    uses: (name: string) => mw(R.uses, { name }),
    added: (name: string) => mw(R.added, { name }),
    member: (name: string) => mw(R.member, { name, organisation: ORGANISATION }),
    more: (n: number) => mw(more, { count: n }),
    jobLocked: (name: string) => mw(R.onShifts, { name }),
    removeAsk: (name: string) => mw(R.removeAsk, { name }),
    editTitle: (name: string) => mw(R.editTitle, { name }),
    noStationNow: L.stations.noStation,
  };
}

const R = fr.roster;

const RW_FR: typeof RW = {
  ...RW,
  ...productWords(fr, '[Heures travaillées]'),
  emailShape:
    '[Cette adresse e-mail ne semble pas valide. Vérifiez qu’elle contient un @ et un domaine.]',
  phoneLength: (problem, country) =>
    `[Ce numéro semble trop ${problem === 'short' ? 'court' : 'long'} pour ${country}. Vérifiez-le et réessayez.]`,
  removed: (name, shifts) =>
    `[${mw(R.removed, { name })} ${shifts > 1 ? 'Ses services ne sont plus attribués.' : 'Son service n’est plus attribué.'}]`,
  jobLockedHelp: R.onShiftsHint,
  notAdded: (name) => `[Impossible d’ajouter ${name}.]`,
  nextSend: R.nextSend,
  nextHours: R.nextHours,
  nextCopied: '[Étape suivante : une fois le lien copié envoyé, indiquez qu’il a été envoyé.]',
  nextErasing: R.nextErasing,
  lock: R.lock,
  stationChange: '[Changer de poste]',
  sectionGone: (section) => `[${section} a été supprimée du plan de table.]`,
};

const FR: RosterWords = {
  lang: 'fr',
  rw: RW_FR,
  lw: {
    copy: fr.requestLink.copy,
    markSent: '[Marquer comme envoyé]',
    replace: fr.requestLink.replaceConfirm,
    replaceOpen: fr.requestLink.replace,
    copied: '[Lien copié.]',
    notIssued: '[Cela n’a pas fonctionné. Réessayez dans un instant.]',
    refused: '[Impossible de copier le lien. Copiez-le depuis le champ du lien.]',
    linkFor: (name) => `[Lien de ${name}]`,
    replaceTitle: (name) => `[Remplacer le lien de ${name} ?]`,
    replaceLine: '[Son lien actuel cesse de fonctionner dès maintenant.]',
    keep: '[Garder ce lien]',
    replaced: (name) =>
      `[Le lien de ${name} est remplacé. Copier le lien lui en donne un nouveau à envoyer.]`,
    marked: (name) => `[Marqué comme envoyé à ${name}.]`,
  },
  links: {
    opened: '[Lien ouvert]',
    sent: '[Lien envoyé]',
    copied: fr.ownerClaim.copied,
    none: R.linkNone,
    noMobile: R.linkNoMobile,
    erased: R.linkErased,
  },
  tabs: RW_FR.tabs,
  events: R.events,
  crumb: R.crumb,
  close: R.close,
  cancel: R.cancel,
  trail: (link, trail) => {
    if (trail == null || link === 'none') return null;
    if (link === 'copied') return `[Copié par ${trail.by} · ${trail.at} · pas marqué comme envoyé]`;
    if (link === 'sent') return `[Marqué comme envoyé par ${trail.by} · ${trail.at}]`;

    return `[Ouvert à ${trail.at}]`;
  },
};

/** Spanish and Portuguese: the card, its table and the details in the product's words, so QA can measure the Link column in all four locales (sc-75033). */
function productRoster(L: Locale, lang: 'es' | 'pt'): RosterWords {
  const rw: typeof RW = { ...RW, ...productWords(L, `[${RW.tabs[3]}]`) };

  return {
    ...EN,
    lang,
    rw,
    links: {
      opened: `[${LINK_WORDS.opened}]`,
      sent: `[${LINK_WORDS.sent}]`,
      copied: L.ownerClaim.copied,
      none: L.roster.linkNone,
      noMobile: L.roster.linkNoMobile,
      erased: L.roster.linkErased,
    },
    tabs: rw.tabs,
    events: L.roster.events,
    crumb: L.roster.crumb,
    close: L.roster.close,
    cancel: L.roster.cancel,
  };
}

export const ROSTER_WORDS = {
  en: EN,
  fr: FR,
  es: productRoster(es, 'es'),
  pt: productRoster(pt, 'pt'),
} as const;

export const RosterWordsContext = createContext<RosterWords>(EN);

export function useRosterWords(): RosterWords {
  return useContext(RosterWordsContext);
}
