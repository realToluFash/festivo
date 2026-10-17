import { describe, expect, it } from 'vitest';

import { brief, decide, header, inboxFor, queueQuery, ROLES, rollup } from './role-tick.mjs';

const MINUTE = 60_000;
const now = 1_000 * MINUTE;

describe('a comment header', () => {
  it('reads the addressees and the author', () => {
    expect(header('[pm] [ux] (from qa)\nThe code-entry screen…')).toEqual({
      to: ['pm', 'ux'],
      from: 'qa',
    });
  });

  it('is not a header when the first line has no author', () => {
    expect(header('[pm] please look')).toBeNull();
    expect(header('A QA report\n[pm] (from qa)')).toBeNull();
  });
});

describe('the inbox', () => {
  const stories = [
    {
      id: 56,
      comments: [
        { id: 1, text: '[lead] (from dev)\nFixed, please re-review.' },
        { id: 2, text: '[dev] (from lead)\nblocking: …' },
        { id: 3, text: '[lead] (from dev)\nwithdrawn', deleted: true },
      ],
    },
  ];

  it('holds the comments addressed to the role, and nothing else', () => {
    expect(inboxFor('lead', stories)).toEqual(['56#1']);
    expect(inboxFor('dev', stories)).toEqual(['56#2']);
    expect(inboxFor('qa', stories)).toEqual([]);
  });
});

// Every tick that wakes for nothing is a full run of the role paid for no work,
// and every one that sleeps through a change is a story left waiting.
describe('a tick', () => {
  const previous = { seen: ['sc-56:In Review'], woke: now - 5 * MINUTE };

  it('sleeps when nothing new has arrived', () => {
    const snapshot = { queue: ['sc-56:In Review'], inbox: [], shortcut: true };
    expect(decide({ role: 'lead', previous, snapshot, now }).verdict).toBe('idle');
  });

  it('wakes for a story that entered the queue, and names it', () => {
    const snapshot = { queue: ['sc-56:In Review', 'sc-61:In Review'], inbox: [], shortcut: true };
    const { verdict, reasons, state } = decide({ role: 'lead', previous, snapshot, now });
    expect(verdict).toBe('wake');
    expect(reasons).toEqual(['queue sc-61:In Review']);
    expect(state).toMatchObject({ woke: now, running: now });
  });

  it('wakes for a new comment addressed to the role', () => {
    const snapshot = { queue: ['sc-56:In Review'], inbox: ['56#9'], shortcut: true };
    expect(decide({ role: 'lead', previous, snapshot, now }).reasons).toEqual(['inbox 56#9']);
  });

  it('does not wake for a story that left the queue', () => {
    const snapshot = { queue: [], inbox: [], shortcut: true };
    expect(decide({ role: 'lead', previous, snapshot, now }).verdict).toBe('idle');
  });

  it('wakes for a story that comes back to a queue it left', () => {
    const left = decide({
      role: 'lead',
      previous,
      snapshot: { queue: [], shortcut: true },
      now,
    }).state;
    const snapshot = { queue: ['sc-56:In Review'], shortcut: true };
    expect(decide({ role: 'lead', previous: left, snapshot, now }).verdict).toBe('wake');
  });

  it('is busy while the last run is still going, and changes nothing', () => {
    const running = { ...previous, running: now - 20 * MINUTE };
    const snapshot = { queue: ['sc-61:In Review'], shortcut: true };
    expect(decide({ role: 'lead', previous: running, snapshot, now })).toEqual({
      verdict: 'busy',
      state: running,
    });
  });

  it('stops counting a run as going after three hours', () => {
    const stuck = { ...previous, running: now - 181 * MINUTE };
    const snapshot = { queue: ['sc-61:In Review'], shortcut: true };
    expect(decide({ role: 'lead', previous: stuck, snapshot, now }).verdict).toBe('wake');
  });

  it('wakes on the heartbeat while work is waiting, and not on an empty queue', () => {
    const quiet = { seen: ['sc-56:In Review'], woke: now - ROLES.lead.heartbeat * MINUTE };
    const waiting = { queue: ['sc-56:In Review'], shortcut: true };
    expect(decide({ role: 'lead', previous: quiet, snapshot: waiting, now }).verdict).toBe('wake');
    expect(
      decide({ role: 'lead', previous: quiet, snapshot: { queue: [], shortcut: true }, now })
        .verdict,
    ).toBe('idle');
  });

  it('sweeps on the heartbeat for a role whose work nobody files', () => {
    const quiet = { seen: [], woke: now - ROLES.ux.heartbeat * MINUTE };
    expect(
      decide({ role: 'ux', previous: quiet, snapshot: { queue: [], shortcut: true }, now }).verdict,
    ).toBe('wake');
  });

  it('falls back to the heartbeat when Shortcut cannot be read', () => {
    const quiet = { seen: [], woke: now - ROLES.qa.heartbeat * MINUTE };
    expect(
      decide({ role: 'qa', previous: quiet, snapshot: { shortcut: false }, now }).verdict,
    ).toBe('wake');
  });
});

describe('the checks on a pull request', () => {
  it('are red when any check failed, pending while any runs, green otherwise', () => {
    expect(rollup([{ conclusion: 'SUCCESS' }, { conclusion: 'FAILURE' }])).toBe('red');
    expect(rollup([{ conclusion: 'SUCCESS' }, { status: 'IN_PROGRESS', conclusion: '' }])).toBe(
      'pending',
    );
    expect(rollup([{ conclusion: 'SUCCESS' }, { conclusion: 'SKIPPED' }])).toBe('green');
  });
});

describe('the brief for a woken run', () => {
  it('names the skill, the reasons, and how to say the run is over', () => {
    const text = brief(
      'qa',
      ['queue sc-795:Ready For QA'],
      '/repo/.git/soirely-roles/role-tick.mjs',
    );
    expect(text).toContain('`/soirely-qa-tester`');
    expect(text).toContain('queue sc-795:Ready For QA');
    expect(text).toContain('node /repo/.git/soirely-roles/role-tick.mjs qa --done');
  });
});

describe('a run that left work waiting', () => {
  it('wakes on the next tick, because --done --more zeroes the heartbeat', () => {
    const more = { seen: ['sc-56:Ready For QA'], woke: 0 };
    const snapshot = { queue: ['sc-56:Ready For QA'], shortcut: true };
    expect(decide({ role: 'qa', previous: more, snapshot, now }).verdict).toBe('wake');
  });
});

// A translation ticket in To Do is the linguists' work; waking the developer for it is a
// full run spent finding nothing to build.
describe('a queue', () => {
  it('belongs to the linguists when it is a translation, and to nobody else', () => {
    expect(queueQuery('fr', 'To Do')).toBe('state:"To Do" label:translation');
    expect(queueQuery('dev', 'To Do')).toBe('state:"To Do" !label:translation');
    expect(queueQuery('qa', 'Ready For QA')).toBe('state:"Ready For QA"');
  });

  it('wakes a linguist with its own locale', () => {
    expect(brief('pt', ['inbox 900#1'], '/x/role-tick.mjs')).toContain('`/soirely-linguist pt`');
  });
});
