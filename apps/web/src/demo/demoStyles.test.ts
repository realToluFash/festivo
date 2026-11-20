import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

type Family = { prefix: string; sheets: readonly string[] | 'all'; part: string };

const NARROW = 'narrowDesk.css';
const WIDE = 'wideDesk.css';

const SHARED: readonly Family[] = [
  { prefix: 'is', sheets: 'all', part: 'a state on any part (is-open, is-side)' },
  {
    prefix: 'bud',
    sheets: [
      'budget.css',
      'budgetHome.css',
      'decide.css',
      'payers.css',
      'payments.css',
      'plan.css',
    ],
    part: 'the Budget (BudgetParts) on its home, Plan, Payers, Payments and Decide',
  },
  {
    prefix: 'button',
    sheets: ['demo.css', 'unsubscribe.css'],
    part: 'the web Button as the demo sizes it',
  },
  {
    prefix: 'dc-switch',
    sheets: ['dataControl.css', 'schedule.css'],
    part: 'the switch of Data control (DataControlParts), which the Schedule uses',
  },
  {
    prefix: 'demo',
    sheets: ['demo.css', 'legal.css', 'unsubscribe.css'],
    part: 'the demo page (demo-page) that Legal and Unsubscribe sit in',
  },
  {
    prefix: 'desk',
    sheets: [
      'arrivalNote.css',
      'budget.css',
      'budgetHome.css',
      'createOrg.css',
      'dataControl.css',
      'dataSettings.css',
      'decide.css',
      'dishVariants.css',
      'doorCode.css',
      'events.css',
      'guestAsk.css',
      'guestGroups.css',
      'guestRemove.css',
      'guests.css',
      'guestsMany.css',
      'handover.css',
      'kitchen.css',
      'makeLive.css',
      'members.css',
      'menu.css',
      'menuCourses.css',
      'menuLibrary.css',
      'messages.css',
      'messagesStop.css',
      NARROW,
      'overviewReflow.css',
      'payers.css',
      'payments.css',
      'people.css',
      'phone.css',
      'quotes.css',
      'roster.css',
      'schedule.css',
      'seating.css',
      'share.css',
      'shareTables.css',
      'singleSignOn.css',
      'stations.css',
      'thankYou.css',
      WIDE,
    ],
    part: 'the desk (desk-row, desk-ask, desk-dialog) every desk board is built from',
  },
  {
    prefix: 'ev',
    sheets: [
      'arrivalNote.css',
      'budget.css',
      'budgetHome.css',
      'events.css',
      'guest.css',
      'guests.css',
      'guestsMany.css',
      'kitchen.css',
      'menuCourses.css',
      NARROW,
      'overviewReflow.css',
      'payers.css',
      'quotes.css',
      'roster.css',
      'schedule.css',
      'share.css',
      'shareTables.css',
      'thankYou.css',
    ],
    part: 'the event (EventPage, EventParts) that the event areas sit in',
  },
  {
    prefix: 'gk',
    sheets: ['guest.css', 'guestKitchen.css', 'mealStep.css'],
    part: 'the guest kitchen step (GuestKitchen) on the guest page',
  },
  {
    prefix: 'gm',
    sheets: ['guestsMany.css', 'guestsMark.css'],
    part: 'many guests at once (GuestsMany, GuestsMark)',
  },
  {
    prefix: 'gp',
    sheets: [
      'guest.css',
      'guestAsk.css',
      'guestCompanions.css',
      'guestDay.css',
      'guestKitchen.css',
      'guestProgramme.css',
      'guestTable.css',
      'share.css',
      'thanks.css',
    ],
    part: 'the guest page (GuestParts), which Share and Thanks also use',
  },
  {
    prefix: 'gs',
    sheets: [
      'guestGroups.css',
      'guests.css',
      'guestsMany.css',
      'guestsMark.css',
      'menuCourses.css',
      NARROW,
      'roster.css',
      'schedule.css',
      'showOnScreen.css',
      'stations.css',
      WIDE,
    ],
    part: 'the guest list (Guests, GuestsParts), whose rows and pills other lists reuse',
  },
  {
    prefix: 'lib',
    sheets: [
      'dishChoices.css',
      'dishVariants.css',
      'menuCourses.css',
      'menuLibrary.css',
      NARROW,
      WIDE,
    ],
    part: 'the menu library (MenuLibrary), whose tags and ticks courses and dishes reuse',
  },
  {
    prefix: 'mg',
    sheets: [
      'makeLive.css',
      'messages.css',
      'messagesInvite.css',
      'messagesNotice.css',
      'messagesPreview.css',
      'messagesScheduled.css',
      'messagesSms.css',
      'messagesTap.css',
      'messagesTo.css',
      'messagesWaits.css',
    ],
    part: 'Messages (MessagesParts), and its waits on Make live (EventMakeLive)',
  },
  {
    prefix: 'mgt',
    sheets: ['messagesStop.css', 'messagesTo.css'],
    part: 'who a message goes to (MessagesTo), which Stop reuses',
  },
  {
    prefix: 'mn',
    sheets: [
      'dishChoices.css',
      'dishVariants.css',
      'menu.css',
      'menuCourses.css',
      'menuLibrary.css',
      NARROW,
      'roster.css',
      'schedule.css',
      'stations.css',
      WIDE,
    ],
    part: 'the menu (MenuCourses, MenuCoursesParts), whose side panel the Schedule and Roster reuse',
  },
  {
    prefix: 'queue-initials',
    sheets: ['queue.css', 'team.css'],
    part: 'the initials of the Queue, which Team reuses',
  },
  {
    prefix: 'ro',
    sheets: [NARROW, 'schedule.css', WIDE],
    part: 'the Schedule (Schedule) at both desk widths',
  },
  {
    prefix: 'rs',
    sheets: ['roster.css', WIDE],
    part: 'the Roster (Roster) from 961 to 1279 px',
  },
  {
    prefix: 'sn',
    sheets: ['roster.css', 'schedule.css', 'stations.css'],
    part: 'Stations (Stations), whose cards the Roster and Schedule reuse',
  },
  {
    prefix: 'sw',
    sheets: ['phone.css', 'switcher.css'],
    part: 'the organisation switcher (OrgSwitcher) on a phone',
  },
  {
    prefix: 'today',
    sheets: [
      'budgetHome.css',
      'events.css',
      'guestsMany.css',
      'menuCourses.css',
      'menuLibrary.css',
      NARROW,
      'overviewReflow.css',
      'people.css',
      'phone.css',
      'roster.css',
      'schedule.css',
      'switcher.css',
      'today.css',
      WIDE,
    ],
    part: 'the desk frame (Today, TodaySidebar) every desk board sits in',
  },
];

const CLASS = /\.(-?[_a-zA-Z][\w-]*)/gu;
const LEADING = /^[\s&>+~]*(?:[a-z][\w-]*)?(?::where\(|:is\()?\.(-?[_a-zA-Z][\w-]*)/u;

function selectorsOf(css: string): string[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(["'])(?:\\.|(?!\1).)*\1/gu, '""');
  const found: string[] = [];
  let prelude = '';
  for (const ch of text) {
    if (ch === '{') {
      const head = prelude.trim();
      if (head !== '' && !head.startsWith('@')) found.push(...splitList(head));
      prelude = '';
    } else if (ch === '}' || ch === ';') {
      prelude = '';
    } else {
      prelude += ch;
    }
  }
  return found;
}

function splitList(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let part = '';
  for (const ch of list) {
    if (ch === '(' || ch === '[') depth += 1;
    if (ch === ')' || ch === ']') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(part.trim());
      part = '';
    } else {
      part += ch;
    }
  }
  parts.push(part.trim());
  return parts.filter((p) => p !== '');
}

type Use = { leads: Set<string>; names: Set<string> };

function collisions(sheets: ReadonlyMap<string, string>, shared: readonly Family[]): string[] {
  const uses = new Map<string, Use>();
  const usesOf = (name: string): Use => {
    const known = uses.get(name);
    if (known != null) return known;
    const fresh: Use = { leads: new Set(), names: new Set() };
    uses.set(name, fresh);
    return fresh;
  };
  for (const [sheet, css] of sheets) {
    for (const selector of selectorsOf(css)) {
      for (const m of selector.matchAll(CLASS)) usesOf(m[1] ?? '').names.add(sheet);
      const lead = LEADING.exec(selector)?.[1];
      if (lead != null) usesOf(lead).leads.add(sheet);
    }
  }

  const lines: string[] = [];
  for (const [name, { leads, names }] of [...uses].sort(([a], [b]) => a.localeCompare(b))) {
    if (leads.size === 0 || names.size < 2) continue;
    const family = shared.find((f) => name === f.prefix || name.startsWith(`${f.prefix}-`));
    const outside =
      family == null
        ? [...names]
        : family.sheets === 'all'
          ? []
          : [...names].filter((s) => !family.sheets.includes(s));
    if (outside.length === 0) continue;
    const named = [...names].sort().join(', ');
    lines.push(
      family == null
        ? `.${name}: ${named}`
        : `.${name}: ${named} (${outside.sort().join(', ')} not listed for ${family.prefix}-)`,
    );
  }
  return lines;
}

function demoSheets(): Map<string, string> {
  const dir = import.meta.dirname;
  return new Map(
    readdirSync(dir)
      .filter((name) => name.endsWith('.css'))
      .sort()
      .map((name) => [name, readFileSync(join(dir, name), 'utf8')] as const),
  );
}

describe('demo stylesheets', () => {
  it('style only their own board, or a shared family they are listed for', () => {
    expect(collisions(demoSheets(), SHARED).join('\n')).toBe('');
  });

  it('give every shared family a part of the demo, and sheets that exist', () => {
    const sheets = demoSheets();
    for (const family of SHARED) {
      expect(family.part, family.prefix).not.toBe('');
      if (family.sheets === 'all') continue;
      for (const sheet of family.sheets)
        expect(sheets.has(sheet), `${family.prefix}: ${sheet}`).toBe(true);
    }
  });

  it('find a class one sheet leads with and another names', () => {
    const sheets = new Map([
      ['schedule.css', '.zz-probe { color: red; }\n.sc-row .zz-own {}'],
      ['runOut.css', '.rout .zz-probe {}\n.zz-own-x {}'],
    ]);

    expect(collisions(sheets, SHARED)).toEqual(['.zz-probe: runOut.css, schedule.css']);
  });

  it('count a class as leading behind an element or :where()', () => {
    const sheets = new Map([
      ['schedule.css', ':where(.zz-probe) button {}\na.zz-tag.zz-own {}'],
      ['runOut.css', '.rout .zz-probe {}\n.rout .zz-tag {}'],
    ]);

    expect(collisions(sheets, SHARED)).toEqual([
      '.zz-probe: runOut.css, schedule.css',
      '.zz-tag: runOut.css, schedule.css',
    ]);
  });

  it('let a class that only ever sits beneath another pass', () => {
    const sheets = new Map([
      ['schedule.css', '.sc .zz-probe {}'],
      ['runOut.css', '.rout .zz-probe {}'],
    ]);

    expect(collisions(sheets, SHARED)).toEqual([]);
  });

  it('fail a family class in a sheet the family does not list', () => {
    const sheets = new Map([
      ['messages.css', '.mg-row {}'],
      ['budget.css', '.mg-row { color: red; }'],
    ]);

    expect(collisions(sheets, SHARED)).toEqual([
      '.mg-row: budget.css, messages.css (budget.css not listed for mg-)',
    ]);
  });
});
