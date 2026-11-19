import { createContext, useContext } from 'react';

import fr from '../i18n/locales/fr.json';
import { mw } from './menuServed.ts';
import { LINK_WORDS, ORGANISATION, RW, type LinkState } from './roster.ts';
import { SW } from './stations.ts';
import { type Delivered, type Trail, LW, trailLine } from './staffLink.ts';

/** The Roster's words in one language: the product's own where it has them, [bracketed] samples where l10n has not written them. */
export interface RosterWords {
  lang: 'en' | 'fr';
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

const R = fr.roster;
const MORE = /<more>(.*)<\/more>/u.exec(R.moreShifts)?.[1] ?? R.moreShifts;

const RW_FR: typeof RW = {
  title: R.title,
  sub: R.sub,
  tabs: [R.roster, fr.jobs.tab, fr.stations.tab, '[Heures travaillées]'],
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
  notBuilt: RW.notBuilt,
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
  emailShape:
    '[Cette adresse e-mail ne semble pas valide. Vérifiez qu’elle contient un @ et un domaine.]',
  phoneLength: (problem, country) =>
    `[Ce numéro semble trop ${problem === 'short' ? 'court' : 'long'} pour ${country}. Vérifiez-le et réessayez.]`,
  uses: (name) => mw(R.uses, { name }),
  added: (name) => mw(R.added, { name }),
  member: (name) => mw(R.member, { name, organisation: ORGANISATION }),
  removed: (name, shifts) =>
    `[${mw(R.removed, { name })} ${shifts > 1 ? 'Ses services ne sont plus attribués.' : 'Son service n’est plus attribué.'}]`,
  more: (n) => mw(MORE, { count: n }),
  jobLocked: (name) => mw(R.onShifts, { name }),
  jobLockedHelp: R.onShiftsHint,
  notAdded: (name) => `[Impossible d’ajouter ${name}.]`,
  removeAsk: (name) => mw(R.removeAsk, { name }),
  editTitle: (name) => mw(R.editTitle, { name }),
  nextSend: R.nextSend,
  nextHours: R.nextHours,
  nextCopied: '[Étape suivante : une fois le lien copié envoyé, indiquez qu’il a été envoyé.]',
  nextErasing: R.nextErasing,
  lock: R.lock,
  stationChange: '[Changer de poste]',
  noStationNow: fr.stations.noStation,
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

export const ROSTER_WORDS = { en: EN, fr: FR } as const;

export const RosterWordsContext = createContext<RosterWords>(EN);

export function useRosterWords(): RosterWords {
  return useContext(RosterWordsContext);
}
