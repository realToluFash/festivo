import type { BellRead } from '../bellSize/bellSizeRules.ts';
import type { BellRows } from './bellRowsRules.ts';

/** A sample's words in English, Spanish, French and Portuguese. */
export interface Words {
  en: string;
  es: string;
  fr: string;
  pt: string;
}

export interface RowSample {
  id: string;
  category: string;
  title: Words;
  lines: readonly Words[];
  event: Words | null;
  time: string;
  unread: boolean;
  muted: boolean;
}

const same = (name: string): Words => ({ en: name, es: name, fr: name, pt: name });

const WEDDING = same('Adaeze & Tunde’s wedding');
const PARTY = same('Ire Events end-of-year party');

/** One event name of 40 letters with no space, as a host may type it. */
export const WORD_40 = same('AdaezeAndTundesWeddingReceptionAndBrunch');

/** The server's titles and lines (sc-83081's kinds), filled with sample names: guestReplies.bell, eventChanges.title and .line, twoFactorRecovery.approver.subject and domainSuspended.subject. */
const REPLIES: Words = {
  en: '3 coming, 1 not coming',
  es: '3 vienen, 1 no viene',
  fr: '3 viennent, 1 ne vient pas',
  pt: '3 vêm, 1 não vem',
};

const ANA_CHANGED: Words = {
  en: 'Ana Souza changed the event',
  es: 'Ana Souza ha modificado el evento',
  fr: 'Ana Souza a modifié l’événement',
  pt: 'Ana Souza alterou o evento',
};

const STARTS: Words = {
  en: 'The start time is now 19:30 (was 19:00).',
  es: 'Nueva hora de inicio: 19:30 (antes: 19:00).',
  fr: 'Nouvelle heure de début : 19:30 (avant : 19:00).',
  pt: 'Nova hora de início: 19:30 (antes: 19:00).',
};

export const ROW_SETS: Readonly<Record<Exclude<BellRows, 'main'>, readonly RowSample[]>> = {
  qa: [1, 2, 3].map((at) => ({
    id: `qa${at}`,
    category: 'qa',
    title: same(`QA notification ${at}`),
    lines: [],
    event: null,
    time: `09:${String(41 - at).padStart(2, '0')}`,
    unread: at < 3,
    muted: false,
  })),
  mixed: [
    {
      id: 'replies',
      category: 'guest_replies',
      title: REPLIES,
      lines: [],
      event: WEDDING,
      time: '09:40',
      unread: true,
      muted: false,
    },
    {
      id: 'recovery',
      category: 'account_security',
      title: {
        en: 'Oluwaseyifunmi Adeyemi asked to get back into their account',
        es: 'Oluwaseyifunmi Adeyemi ha pedido volver a entrar en su cuenta',
        fr: 'Oluwaseyifunmi Adeyemi a demandé à revenir dans son compte',
        pt: 'Oluwaseyifunmi Adeyemi pediu para voltar a entrar na conta',
      },
      lines: [],
      event: null,
      time: '09:31',
      unread: true,
      muted: false,
    },
    {
      id: 'change',
      category: 'event_changes',
      title: ANA_CHANGED,
      lines: [STARTS],
      event: WEDDING,
      time: '08:15',
      unread: false,
      muted: true,
    },
  ],
  steps: [
    {
      id: 'venue',
      category: 'event_changes',
      title: {
        en: 'Chukwuemeka Okonkwo changed the event',
        es: 'Chukwuemeka Okonkwo ha modificado el evento',
        fr: 'Chukwuemeka Okonkwo a modifié l’événement',
        pt: 'Chukwuemeka Okonkwo alterou o evento',
      },
      lines: [
        {
          en: 'The venue is now Eko Hotel and Suites (was The Landmark).',
          es: 'Nuevo lugar: Eko Hotel and Suites (antes: The Landmark).',
          fr: 'Nouveau lieu : Eko Hotel and Suites (avant : The Landmark).',
          pt: 'Novo local: Eko Hotel and Suites (antes: The Landmark).',
        },
      ],
      event: PARTY,
      time: '09:12',
      unread: true,
      muted: false,
    },
    {
      id: 'paused',
      category: 'account_security',
      title: {
        en: 'Access paused for Chukwuemeka Okonkwo in QA Organisation',
        es: 'Acceso en pausa: Chukwuemeka Okonkwo en QA Organisation',
        fr: 'Accès en pause : Chukwuemeka Okonkwo dans QA Organisation',
        pt: 'Acesso em pausa: Chukwuemeka Okonkwo em QA Organisation',
      },
      lines: [],
      event: null,
      time: '08:50',
      unread: false,
      muted: false,
    },
  ],
  word40: [
    {
      id: 'replies40',
      category: 'guest_replies',
      title: REPLIES,
      lines: [],
      event: WORD_40,
      time: '09:40',
      unread: true,
      muted: false,
    },
    {
      id: 'change40',
      category: 'event_changes',
      title: ANA_CHANGED,
      lines: [STARTS],
      event: WORD_40,
      time: '08:15',
      unread: false,
      muted: false,
    },
  ],
};

export function rowWords(words: Words, language: string): string {
  return language === 'es' || language === 'fr' || language === 'pt' ? words[language] : words.en;
}

export function rowsUnreadAt(read: BellRead, rows: Exclude<BellRows, 'main'>): ReadonlySet<string> {
  return new Set(
    read !== 'some' ? [] : ROW_SETS[rows].filter((one) => one.unread).map((one) => one.id),
  );
}
