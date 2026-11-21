import { describe, expect, it } from 'vitest';

import { DATA_CONTROL_PAGES } from './dataControlPages.ts';
import {
  ASK_WINDOW_MS,
  ASK_WORDS,
  LOCK_PAGE_NAMES,
  LOCK_STATES,
  SAMPLE_OWNERS,
  answerAsk,
  answered,
  askStart,
  lockStepOf,
  mayAsk,
  ownersOf,
  pageStateOf,
  showsButton,
} from './enterpriseAsk.ts';
import { VIEWERS } from './settings.ts';

describe('the step on a locked Enterprise card (sc-72241)', () => {
  it('gives an owner Contact, an admin Ask an owner, and a member nothing', () => {
    expect(lockStepOf(VIEWERS.folake)).toBe('contact');
    expect(lockStepOf(VIEWERS.julien)).toBe('ask');
    expect(lockStepOf(VIEWERS.ana)).toBeNull();
  });

  it('opens each page locked for its states, and leaves its other states alone', () => {
    expect(pageStateOf('hub', 'admin_sent_one')).toBe('locked');
    expect(pageStateOf('emailDomains', 'owner_web')).toBe('ed_locked');
    expect(pageStateOf('auditLog', 'admin_asked_several')).toBe('locked');
    expect(pageStateOf('deleteGuestData', 'admin_not_sent')).toBe('rt_locked');
    expect(pageStateOf('emailDomains', 'ed_downgraded')).toBe('ed_downgraded');
  });

  it('names each page as the owners’ email does', () => {
    expect(Object.values(LOCK_PAGE_NAMES)).toEqual([
      'Data and control',
      'Email domains',
      'Audit log',
      'Delete guest data after an event',
    ]);
  });

  it('starts every admin state where it says', () => {
    expect(askStart('admin')).toEqual({ now: 'ready' });
    expect(askStart('admin_sending')).toEqual({ now: 'sending' });
    expect(askStart('admin_not_sent')).toEqual({ now: 'notSent' });
    expect(askStart('admin_sent_several')).toEqual({ now: 'sent', owners: 'several' });
    expect(askStart('admin_asked_one')).toEqual({ now: 'asked', owners: 'one' });
  });

  it('presses only from ready or Not sent, and keeps the button until an answer replaces it', () => {
    expect(mayAsk({ now: 'ready' })).toBe(true);
    expect(mayAsk({ now: 'notSent' })).toBe(true);
    expect(mayAsk({ now: 'sending' })).toBe(false);
    expect(showsButton({ now: 'notSent' })).toBe(true);
    expect(showsButton({ now: 'sent', owners: 'one' })).toBe(false);
    expect(showsButton({ now: 'asked', owners: 'several' })).toBe(false);
  });

  it('sends once per organisation in 24 hours, and refuses the next ask until then', () => {
    const at = Date.parse('2026-11-19T10:00:00Z');

    expect(answerAsk(null, at, 1)).toEqual({ sent: 1 });
    expect(answerAsk(at, at + ASK_WINDOW_MS - 1, 2)).toEqual({ asked: 2 });
    expect(answerAsk(at, at + ASK_WINDOW_MS, 2)).toEqual({ sent: 2 });
  });

  it('picks the words by the count the response gives, never showing it', () => {
    expect(ownersOf(1)).toBe('one');
    expect(ownersOf(3)).toBe('several');
    expect(answered({ sent: 3 })).toEqual({ now: 'sent', owners: 'several' });
    expect(answered({ asked: 1 })).toEqual({ now: 'asked', owners: 'one' });
    expect(answered('failed')).toEqual({ now: 'notSent' });
    expect(SAMPLE_OWNERS).toBe(1);
    expect(Object.values(ASK_WORDS.sent).join(' ')).not.toMatch(/\d/u);
    expect(Object.values(ASK_WORDS.asked).join(' ').match(/\d+/gu)).toEqual(['24', '24']);
  });

  it('links every state on every page, the admin’s as Julien', () => {
    const linked = DATA_CONTROL_PAGES.flatMap((one) => one.states.map((state) => state.to));

    for (const path of ['', '/email-domains', '/audit-log', '/delete-guest-data'])
      for (const state of LOCK_STATES) {
        const as = state === 'owner_web' ? '' : 'as=julien&';
        expect(linked).toContain(`/demo/settings/data-and-control${path}?${as}state=${state}`);
      }
  });
});
