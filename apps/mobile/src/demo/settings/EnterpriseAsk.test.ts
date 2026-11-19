import { describe, expect, it } from 'vitest';

import { DATA_BOARDS } from './DataBoards.ts';
import { DATA_PEOPLE, hubFor } from './DataModel.ts';
import { ASK_WORDS } from './DataWords.ts';
import {
  ASK_WINDOW_MS,
  LOCK_STATES,
  answerAsk,
  answered,
  askStart,
  lockStepOf,
  mayAsk,
  pageStateOf,
  showsButton,
} from './EnterpriseAsk.ts';

describe('the step on a locked Enterprise card in the app (sc-72241)', () => {
  it('gives an owner the line, an admin Ask an owner, and a member nothing', () => {
    expect(lockStepOf(DATA_PEOPLE.folake)).toBe('line');
    expect(lockStepOf(DATA_PEOPLE.julien)).toBe('ask');
    expect(lockStepOf(DATA_PEOPLE.ana)).toBeNull();
  });

  it('says nothing of the web, a website or upgrading', () => {
    const words = JSON.stringify(ASK_WORDS);

    expect(ASK_WORDS.appLine).toBe('The plan cannot be changed in the app.');
    expect(words).not.toMatch(/web|online|soirely\.com|upgrade/iu);
  });

  it('opens each page locked for its states, and back goes to the locked hub', () => {
    expect(pageStateOf('hub', 'admin')).toBe('locked');
    expect(pageStateOf('emailDomains', 'admin_sent_one')).toBe('ed_locked');
    expect(pageStateOf('auditLog', 'owner_app')).toBe('locked');
    expect(pageStateOf('emailDomains', 'ed_downgraded')).toBe('ed_downgraded');
    expect(hubFor('admin_asked_one', undefined)).toBe('locked');
  });

  it('starts each admin state where it says, the button only until an answer replaces it', () => {
    expect(askStart('admin_sending')).toEqual({ now: 'sending' });
    expect(askStart('admin_asked_several')).toEqual({ now: 'asked', owners: 'several' });
    expect(mayAsk(askStart('admin_sending'))).toBe(false);
    expect(mayAsk(askStart('admin_not_sent'))).toBe(true);
    expect(showsButton(askStart('admin_not_sent'))).toBe(true);
    expect(showsButton(askStart('admin_sent_one'))).toBe(false);
  });

  it('sends once per organisation in 24 hours, then refuses until then', () => {
    const at = Date.parse('2026-11-19T10:00:00Z');

    expect(answered(answerAsk(null, at, 1))).toEqual({ now: 'sent', owners: 'one' });
    expect(answered(answerAsk(at, at + ASK_WINDOW_MS - 1, 3))).toEqual({
      now: 'asked',
      owners: 'several',
    });
    expect(answered('failed')).toEqual({ now: 'notSent' });
  });

  it('links every state on the three pages, the admin’s as Julien', () => {
    const hrefs = DATA_BOARDS.map((board) => board.href);

    for (const path of ['', '/email-domains', '/audit-log'])
      for (const state of LOCK_STATES) {
        const as = state === 'owner_app' ? '' : '&as=julien';
        expect(hrefs).toContain(`/demo/settings/data-and-control${path}?state=${state}${as}`);
      }
  });
});
