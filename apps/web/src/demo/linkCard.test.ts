import { describe, expect, it } from 'vitest';

import { meshFor } from '../mesh.ts';
import { EVENT } from './guest.ts';
import { AWKWARD_NAME, COVER_DESCRIPTION, cardOf, headOf, messageFor } from './linkCard.ts';

const tags = (lines: readonly string[]) =>
  lines.map((line) => /property="([^"]+)"/u.exec(line)?.[1] ?? 'title');

describe('the card a guest’s link answers (sc-89272)', () => {
  it('is the name, the hosts’ line and the photo with its description', () => {
    const card = cardOf('photo');

    expect(card.title).toBe(EVENT.name);
    expect(card.line).toBe('Your invitation from Adaeze Obi and Tunde Bakare');
    expect(tags(headOf(card))).toEqual([
      'title',
      'og:title',
      'og:description',
      'og:image',
      'og:image:alt',
    ]);
    expect(headOf(card).at(-1)).toContain(COVER_DESCRIPTION);
  });

  it('leaves out og:image:alt for a photo with no description and for a colour', () => {
    expect(tags(headOf(cardOf('photoNoAlt')))).not.toContain('og:image:alt');
    expect(tags(headOf(cardOf('colour')))).not.toContain('og:image:alt');
  });

  it('draws the colour the guest’s page draws for the event', () => {
    expect(cardOf('colour').picture).toEqual({ kind: 'colour', mesh: meshFor(EVENT.id) });
    expect(cardOf('colour', 'draft').picture).toEqual({ kind: 'colour', mesh: 'draft' });
  });

  it('escapes the name in the head and joins three hosts as the page does', () => {
    const card = cardOf('awkward');

    expect(card.title).toBe(AWKWARD_NAME);
    expect(card.line).toBe('Your invitation from Tunde, Kemi and Bola');
    expect(headOf(card)[0]).toBe(
      '<title>Kemi&#39;s 40th &lt;&quot;Surprise&quot;&gt; &amp; more</title>',
    );
  });

  it('has no line for an event that names no hosts', () => {
    expect(tags(headOf(cardOf('noHosts')))).toEqual(['title', 'og:title', 'og:image']);
  });

  it('speaks the guest’s language, and translates only the line', () => {
    const card = cardOf('french');

    expect(card.lang).toBe('fr');
    expect(card.title).toBe(EVENT.name);
    expect(card.line).toBe('[Votre invitation de la part de Adaeze Obi et Tunde Bakare]');
  });

  it('is the name alone once the event is Called off or Finished', () => {
    expect(tags(headOf(cardOf('ended')))).toEqual(['title', 'og:title']);
  });

  it('is today’s Soirely title alone for a link that opens no page', () => {
    expect(headOf(cardOf('gone'))).toEqual(['<title>Soirely</title>']);
  });

  it('carries no guest’s name, and the picture’s address no token', () => {
    const head = headOf(cardOf('colour')).join('\n');

    expect(head).not.toContain('Yusuf');
    expect(head).not.toContain('/i/');
  });

  it('sends sc-26025’s message while the event invites, and the bare link otherwise', () => {
    expect(messageFor('photo')).toMatch(/^Yusuf Ibrahim, Adaeze Obi and Tunde Bakare would love/u);
    expect(messageFor('ended')).toMatch(/^https:\/\//u);
  });
});
