import type { LimitStateName } from './limitRules.ts';

export interface LimitBoard {
  title: string;
  what: string;
  href: string;
}

const at = (state: LimitStateName, title: string, what: string): LimitBoard => ({
  title,
  what,
  href: `/demo/limit-reached?state=${state}`,
});

/** The app does not invite (Members), so an invitation sent has no refusal here; Duplicate is web only. */
export const LIMIT_BOARDS: readonly LimitBoard[] = [
  at('liveManage', 'Live events · billing.manage', 'The plan cannot be changed in the app.'),
  at('liveOther', 'Live events · anyone else', 'Ask an owner: sending, then sent'),
  at(
    'liveSending',
    'Live events · Ask an owner, sending',
    'Same label, a second press sends nothing',
  ),
  at('liveSentOne', 'Live events · sent to the one owner', 'The tick and the one-owner line'),
  at('liveSentSeveral', 'Live events · sent to the owners', 'The tick and the several-owners line'),
  at('liveNotSent', 'Live events · not sent', 'The button stays, Not sent read out'),
  at('guestManage', 'A guest added · billing.manage', 'The form kept, Remove a guest'),
  at('guestOther', 'A guest added · anyone else', 'The form kept, Ask an owner'),
  at('importManage', 'An import · billing.manage', 'The file’s count and the room left'),
  at('importOther', 'An import · anyone else', 'The file kept, Ask an owner'),
  at('accept', 'An invitation accepted', 'No figure, Ask an owner and Not now'),
  at('acceptSent', 'An invitation accepted · sent', 'The owners sent the link'),
  at('ceilingGuest', 'The ceiling · a guest added', 'Remove a guest only, any role'),
  at('ceilingImport', 'The ceiling · an import', 'Remove a guest only, no plan named'),
];
