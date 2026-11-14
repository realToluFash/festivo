import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';
import { inModal } from '../kit/anchoredMenu.ts';
import {
  answer,
  ask,
  cellWidth,
  columnsFor,
  currentPlace,
  expand,
  fold,
  founded,
  frameFor,
  noneMatch,
  notNow,
  openerLabel,
  orgMesh,
  pick,
  placeOf,
  rowsOf,
  scrollToShow,
  searchable,
  sending,
  sessionFor,
  settled,
  switcherStateOf,
  tileKey,
  tilesOf,
  untilIn,
  waitingOf,
  withoutPlaces,
} from './OrgSwitcherModel.ts';

const i18n = createInstance();
void i18n.init({
  resources: { en: { translation: en } },
  lng: 'en',
  interpolation: { escapeValue: false },
  initAsync: false,
});
const { t } = i18n;
const CREATE = t('createOrganisation.row');

const names = (tiles: ReturnType<typeof tilesOf>) =>
  tiles.map((tile) =>
    tile.kind === 'place'
      ? tile.place.name
      : tile.kind === 'create'
        ? CREATE
        : tile.kind === 'offer'
          ? tile.offer.name
          : tile.invite.name,
  );

describe('the switch', () => {
  it('makes the picked organisation current and says so', () => {
    const switched = pick(sessionFor('populated'), 'org-casa-lumen');

    expect(currentPlace(switched).name).toBe('Casa Lumen Eventos');
    expect(t('switcher.switched', { name: currentPlace(switched).name })).toBe(
      'Now working in Casa Lumen Eventos.',
    );
    expect(tilesOf(switched, '').filter((tile) => tile.kind === 'place' && tile.current)).toEqual([
      { kind: 'place', place: currentPlace(switched), current: true },
    ]);
  });

  it('names the organisation, the role and what waits in the opener’s label', () => {
    const session = sessionFor('populated');

    expect(openerLabel(currentPlace(session), waitingOf(session))).toBe(
      'Organisation: Ire Events, your role Owner. Switch organisation. 2 invitations waiting',
    );
    expect(openerLabel(currentPlace(session), 1)).toBe(
      'Organisation: Ire Events, your role Owner. Switch organisation. 1 invitation waiting',
    );
    expect(openerLabel(currentPlace(session), 0)).toBe(
      'Organisation: Ire Events, your role Owner. Switch organisation',
    );
    expect(t('invitations.count', { count: 2 })).toBe('2 invitations');
  });

  it('opens in each state ?switcher= names, and in none it does not know', () => {
    expect(switcherStateOf('no-match')).toBe('no-match');
    expect(switcherStateOf('paused')).toBeNull();
    expect(switcherStateOf(undefined)).toBeNull();
  });

  it('keeps Create an organisation last, after the invitations', () => {
    expect(names(tilesOf(sessionFor('populated'), ''))).toEqual([
      'Ire Events',
      'Casa Lumen Eventos',
      'Atelier Céleste Réceptions et Mariages',
      'Celebraciones Alameda',
      'Bluebird Gatherings',
      CREATE,
    ]);
    expect(names(tilesOf(sessionFor('offer'), ''))).toEqual([
      'Ire Events',
      'Casa Lumen Eventos',
      'Atelier Céleste Réceptions et Mariages',
      'Ire Weddings',
      'Celebraciones Alameda',
      'Bluebird Gatherings',
      CREATE,
    ]);
    expect(names(tilesOf(sessionFor('one'), ''))).toEqual(['Ire Events', CREATE]);
  });
});

describe('a new organisation', () => {
  const lumen = { id: 'org-lumen-feiras-pt', name: 'Lumen Feiras', role: 'Owner', fresh: true };

  it('comes after Ire Events, current, with Create an organisation still last', () => {
    const session = founded(sessionFor('one'), lumen);

    expect(placeOf(session)).toEqual(lumen);
    expect(names(tilesOf(session, ''))).toEqual(['Ire Events', 'Lumen Feiras', CREATE]);
  });

  it('is the only one for somebody who had none', () => {
    const none = withoutPlaces(sessionFor('one'));

    expect(placeOf(none)).toBeNull();
    expect(names(tilesOf(founded(none, lumen), ''))).toEqual(['Lumen Feiras', CREATE]);
  });

  it('takes amber from the id the walk gives it', () => {
    expect(orgMesh(lumen.id)).toBe('amber');
  });

  it('is made again, not twice, by a second walk', () => {
    const again = founded(founded(sessionFor('one'), lumen), { ...lumen, name: 'Lumen Eventos' });

    expect(names(tilesOf(again, ''))).toEqual(['Ire Events', 'Lumen Eventos', CREATE]);
  });
});

describe('the search', () => {
  it('comes only above 15 organisations', () => {
    expect(searchable(sessionFor('populated'))).toBe(false);
    expect(searchable(sessionFor('many'))).toBe(true);
    expect(tilesOf(sessionFor('many'), '')).toHaveLength(19);
    expect(tilesOf(sessionFor('populated'), 'even')).toHaveLength(6);
  });

  it('ignores case and accents', () => {
    expect(fold('Maison Ondine ÉVÉNEMENTS')).toBe('maison ondine evenements');
    expect(names(tilesOf(sessionFor('search'), 'even'))).toEqual([
      'Ire Events',
      'Casa Lumen Eventos',
      'Maison Ondine Événements',
      'Eventos Mar Azul',
      'Thornbury Hall Events',
      'Atlântico Comunicações e Eventos',
      CREATE,
    ]);
    expect(names(tilesOf(sessionFor('many'), '  CÉLESTE '))).toEqual([
      'Atelier Céleste Réceptions et Mariages',
      CREATE,
    ]);
    expect(t('switcher.matches', { count: 6 })).toBe('6 organisations match');
    expect(t('switcher.matches', { count: 1 })).toBe('1 organisation matches');
  });

  it('says no organisation matches, keeps Create, and clears', () => {
    const session = sessionFor('no-match');

    expect(noneMatch(session, session.query)).toBe(true);
    expect(t('switcher.noMatch', { text: session.query })).toBe('No organisation matches “Belém”.');
    expect(names(tilesOf(session, session.query))).toEqual([CREATE]);
    expect(t('switcher.clearSearch')).toBe('Clear search');
    expect(noneMatch(session, '')).toBe(false);
    expect(settled(session).query).toBe('');
  });
});

describe('the answers', () => {
  const CELEBRACIONES = 'org-celebraciones-alameda';
  const BLUEBIRD = 'org-bluebird-gatherings';

  it('opens one invitation at a time, in place', () => {
    const opened = expand(sessionFor('populated'), CELEBRACIONES);

    expect(opened.expanded).toBe(CELEBRACIONES);
    expect(expand(opened, BLUEBIRD).expanded).toBe(BLUEBIRD);
    expect(expand(opened, CELEBRACIONES).expanded).toBeNull();
  });

  it('joins: the tile is the place’s own, one invitation fewer waits, and it stays a place', () => {
    const joined = answer(sessionFor('invitation'), CELEBRACIONES, true);

    expect(tilesOf(joined, '')[3]).toEqual({
      kind: 'joined',
      invite: expect.objectContaining({ id: CELEBRACIONES }) as unknown,
    });
    expect(waitingOf(joined)).toBe(1);
    expect(t('invitations.joined', { organisation: 'Celebraciones Alameda', role: 'Member' })).toBe(
      'You joined Celebraciones Alameda as Member.',
    );

    const opened = pick(joined, CELEBRACIONES);
    expect(currentPlace(opened)).toEqual({
      id: CELEBRACIONES,
      name: 'Celebraciones Alameda',
      role: 'Member',
    });
    expect(names(tilesOf(opened, ''))).toEqual([
      'Ire Events',
      'Casa Lumen Eventos',
      'Atelier Céleste Réceptions et Mariages',
      'Celebraciones Alameda',
      'Bluebird Gatherings',
      CREATE,
    ]);
    expect(tilesOf(opened, '')[3]?.kind).toBe('place');
  });

  it('declines: the tile stays while it is open, and is gone the next time', () => {
    const declined = answer(sessionFor('populated'), BLUEBIRD, false);

    expect(waitingOf(declined)).toBe(1);
    expect(tilesOf(declined, '').map(tileKey)).toContain(BLUEBIRD);
    expect(tilesOf(settled(declined), '').map(tileKey)).not.toContain(BLUEBIRD);
    expect(t('invitations.declined', { inviter: 'Beatriz Lima' })).toBe(
      'You declined. Beatriz Lima will see that you said no.',
    );
  });

  it('counts an answer that did not reach us as still waiting, and takes it again', () => {
    const failed = sessionFor('failed');

    expect(waitingOf(failed)).toBe(2);
    expect(tilesOf(settled(failed), '').map(tileKey)).toContain(BLUEBIRD);
    expect(waitingOf(answer(failed, BLUEBIRD, true))).toBe(1);
  });

  it('holds a press in flight as still waiting, saying what the pressed answer is doing (#36160)', () => {
    const busy = sending(sessionFor('invitation'), BLUEBIRD, false);

    expect(busy.outcomes[BLUEBIRD]).toEqual({ kind: 'busy', answer: 'decline' });
    expect(busy.expanded).toBe(BLUEBIRD);
    expect(waitingOf(busy)).toBe(2);
    expect(sessionFor('busy').outcomes[BLUEBIRD]).toEqual({ kind: 'busy', answer: 'accept' });
    expect([t('invitations.joining'), t('invitations.declining')]).toEqual([
      'Joining…',
      'Declining…',
    ]);
  });

  it('draws a refused answer in the panel and takes the invitation off the next opening (#36160)', () => {
    const expired = sessionFor('refused');
    const withdrawn = sessionFor('withdrawn');

    expect(expired.outcomes[BLUEBIRD]).toEqual({ kind: 'refused', refusal: 'invitation_expired' });
    expect(withdrawn.outcomes[BLUEBIRD]).toEqual({
      kind: 'refused',
      refusal: 'invitation_revoked',
    });
    expect(waitingOf(expired)).toBe(1);
    expect(tilesOf(expired, '').map(tileKey)).toContain(BLUEBIRD);
    expect(tilesOf(settled(expired), '').map(tileKey)).not.toContain(BLUEBIRD);
  });

  it('asks to join, keeps a refusal, and puts the offer away for Not now', () => {
    expect(ask(sessionFor('offer')).offer?.status).toBe('asked');
    expect(ask(sessionFor('offer-unavailable')).offer?.status).toBe('unavailable');

    const away = notNow(sessionFor('offer'));
    expect(away.expanded).toBeNull();
    expect(names(tilesOf(away, ''))).not.toContain('Ire Weddings');
    expect(settled(away).offer).toBeNull();
    expect(t('domainJoining.switcherAsked', { email: 'folake@ire.events' })).toBe(
      'we’ll email folake@ire.events when they answer.',
    );
  });

  it('dates an invitation in the reader’s own way', () => {
    expect(untilIn('en-US', '2026-11-20')).toBe('Fri, Nov 20');
    expect(untilIn('en-GB', '2026-11-30')).toBe('Mon 30 Nov');
  });
});

describe('the grid', () => {
  it('takes as many columns as leave a cell 112 or wider', () => {
    expect(columnsFor(402 - 24)).toBe(3);
    expect(cellWidth(402 - 24)).toBeCloseTo(114.67, 2);
    expect(columnsFor(375 - 24)).toBe(2);
    expect(cellWidth(375 - 24)).toBeCloseTo(160.5, 2);
    expect(columnsFor(500)).toBe(4);
    expect(cellWidth(500)).toBeCloseTo(115.5, 2);
  });

  it('lays the tiles in rows', () => {
    expect(rowsOf([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });

  it('colours each sample organisation from its id, as the boards do', () => {
    expect(
      [
        'org-ire-events',
        'org-casa-lumen',
        'org-atelier-celeste-receptions',
        'org-harbourlight',
      ].map(orgMesh),
    ).toEqual(['accent', 'rose', 'teal', 'amber']);
    expect(
      ['org-celebraciones-alameda', 'org-bluebird-gatherings', 'org-ire-weddings'].map(orgMesh),
    ).toEqual(['amber', 'accent', 'rose']);
  });
});

describe('the drop-down', () => {
  it('drops 8 under its opener on the phone, across the screen less 12, over the tab bar', () => {
    expect(
      frameFor({
        opener: { x: 20, y: 62, width: 186, height: 56 },
        window: { width: 402, height: 874 },
        insets: { bottom: 34 },
        phone: true,
      }),
    ).toEqual({ left: 12, top: 126, width: 378, maxHeight: 642, originX: 101 });
  });

  it('drops 8 under its opener on Android, whose window starts below the status bar', () => {
    const opener = { x: 20, y: inModal(38, -24), width: 186, height: 56 };

    expect(
      frameFor({ opener, window: { width: 402, height: 874 }, insets: { bottom: 34 }, phone: true })
        .top,
    ).toBe(126);
  });

  it('drops 500 wide from the opener’s left edge on the iPad', () => {
    expect(
      frameFor({
        opener: { x: 24, y: 48, width: 200, height: 56 },
        window: { width: 834, height: 1194 },
        insets: { bottom: 20 },
        phone: false,
      }),
    ).toEqual({ left: 24, top: 112, width: 500, maxHeight: 1050, originX: 100 });
  });

  it('scrolls by the least that shows an opened panel', () => {
    expect(scrollToShow({ top: 300, bottom: 500, offset: 0, viewport: 400 })).toBe(112);
    expect(scrollToShow({ top: 100, bottom: 200, offset: 0, viewport: 400 })).toBeNull();
    expect(scrollToShow({ top: 40, bottom: 600, offset: 0, viewport: 400 })).toBe(40);
  });
});
