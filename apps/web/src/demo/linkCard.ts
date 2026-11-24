import { hostsLine } from '@soirely/domain';

import { type Mesh, meshFor } from '../mesh.ts';
import { EVENT } from './guest.ts';
import { type Guest, type GuestLanguage, LINK, sampleGuests } from './guests.ts';
import draftJpeg from './linkCards/draft.jpg';
import iretiJpeg from './linkCards/ireti.jpg';
import partyJpeg from './linkCards/party.jpg';
import wedJpeg from './linkCards/wed.jpg';
import type { DemoLink } from './settings.ts';
import { messageLanguage, messageOf } from './whatsAppSend.ts';

/** The four colours an event without a photo is drawn in, exported once at 1200 × 675 with no words (sc-89272). */
export const MESH_JPEGS: Record<Mesh, string> = {
  wed: wedJpeg,
  ireti: iretiJpeg,
  party: partyJpeg,
  draft: draftJpeg,
};

export const MESHES: readonly Mesh[] = ['wed', 'ireti', 'party', 'draft'];

export const CARD_STATES = [
  'photo',
  'photoNoAlt',
  'colour',
  'awkward',
  'noHosts',
  'french',
  'ended',
  'gone',
] as const;

export type CardState = (typeof CARD_STATES)[number];

const NAMES: Record<CardState, string> = {
  photo: 'Live, with a cover photo and its description',
  photoNoAlt: 'Live, a cover photo with no description: no og:image:alt',
  colour: 'Live, no cover photo: the event’s own colour (tweak: &mesh=ireti, party or draft)',
  awkward: 'A name with quotes, angle brackets and an ampersand, and three hosts',
  noHosts: 'An event that names no hosts: no line',
  french: 'A guest set to French: the line in French, whatever the fetch asks for',
  ended: 'Called off or Finished: its name alone',
  gone: 'A link that opens no page: Soirely alone, as a made-up token',
};

export const LINK_CARD_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'A guest’s link in WhatsApp',
    states: CARD_STATES.map((key) => ({ to: `/demo/link-card?state=${key}`, name: NAMES[key] })),
  },
];

export function cardStateOf(raw: string | null): CardState {
  return CARD_STATES.find((key) => key === raw) ?? 'photo';
}

export function meshOf(raw: string | null, fallback: Mesh): Mesh {
  return MESHES.find((mesh) => mesh === raw) ?? fallback;
}

const LINE: Record<GuestLanguage, (hosts: string) => string> = {
  en: (hosts) => `Your invitation from ${hosts}`,
  es: (hosts) => `Su invitación de ${hosts}`,
  fr: (hosts) => `Votre invitation de la part de ${hosts}`,
  pt: (hosts) => `O seu convite da parte de ${hosts}`,
};

export type Picture = { kind: 'photo'; alt: string | null } | { kind: 'colour'; mesh: Mesh };

/** What the guest's link answers a chat app: null is a tag the head leaves out. */
export type Card = {
  opens: boolean;
  title: string;
  line: string | null;
  picture: Picture | null;
  lang: GuestLanguage;
};

export const COVER_DESCRIPTION = 'Adaeze and Tunde under the arch at The Landmark';
export const AWKWARD_NAME = `Kemi's 40th <"Surprise"> & more`;
const AWKWARD_HOSTS = ['Tunde', 'Kemi', 'Bola'];
const AWKWARD_ID = 'evt-kemi-40';

/** The sample's English guest, who has a phone, and its French one (sc-3790). */
function guestFor(state: CardState): Guest {
  const guests = sampleGuests(EVENT.id);
  const id = state === 'french' ? 'sophie' : 'yusuf';
  const found = guests.find((one) => one.id === id);

  if (found == null) throw new Error(`No sample guest ${id}`);

  return found;
}

export function cardOf(state: CardState, mesh: Mesh = EVENT.mesh): Card {
  const lang = messageLanguage(guestFor(state));
  const named = state === 'awkward' ? AWKWARD_NAME : EVENT.name;
  const hosts = state === 'awkward' ? AWKWARD_HOSTS : state === 'noHosts' ? [] : EVENT.hosts;
  const own = state === 'awkward' ? meshFor(AWKWARD_ID) : mesh;

  if (state === 'gone') return { opens: false, title: 'Soirely', line: null, picture: null, lang };
  if (state === 'ended') return { opens: true, title: named, line: null, picture: null, lang };

  const picture: Picture =
    state === 'photo'
      ? { kind: 'photo', alt: COVER_DESCRIPTION }
      : state === 'photoNoAlt'
        ? { kind: 'photo', alt: null }
        : { kind: 'colour', mesh: own };

  return {
    opens: true,
    title: named,
    line: hosts.length === 0 ? null : LINE[lang](hostsLine(hosts, lang)),
    picture,
    lang,
  };
}

const BARE_LINK: ReadonlySet<CardState> = new Set(['awkward', 'noHosts', 'ended', 'gone']);

/** What the host sent: sc-26025's message, or the bare link from Copy invitation link (sc-1526) as the board draws it. */
export function messageFor(state: CardState): string {
  if (BARE_LINK.has(state)) return LINK;

  return messageOf(guestFor(state), EVENT, LINK);
}

export function guestNameFor(state: CardState): string {
  return guestFor(state).name;
}

function escaped(text: string): string {
  return text
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

/** The picture's address is the developer's to choose: absolute https, no guest token, nothing that counts. */
export const PICTURE_ADDRESS = 'https://soirely.app/[the picture’s address].jpg';

/** The head as `curl` prints it, the lines QA reads. */
export function headOf(card: Card): string[] {
  const meta = (property: string, content: string) =>
    `<meta property="${property}" content="${escaped(content)}">`;
  const lines = [`<title>${escaped(card.title)}</title>`];

  if (!card.opens) return lines;

  lines.push(meta('og:title', card.title));
  if (card.line != null) lines.push(meta('og:description', card.line));
  if (card.picture != null) {
    lines.push(meta('og:image', PICTURE_ADDRESS));
    if (card.picture.kind === 'photo' && card.picture.alt != null)
      lines.push(meta('og:image:alt', card.picture.alt));
  }

  return lines;
}
