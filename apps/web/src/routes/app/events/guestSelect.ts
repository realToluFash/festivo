import type {
  Guest,
  GuestInvitationHow,
  MarkedTogether,
  MovedTogether,
  RemovedTogether,
} from '@soirely/api-client';
import { type ListView, type ViewRow, listFormat, shownReply } from '@soirely/domain';
import { type TFunction } from 'i18next';

import { currentLocale } from '../../../i18n/index.ts';

function rowsOf(view: ListView): ViewRow[] {
  return view.kind === 'groups' ? view.groups.flatMap((group) => group.rows) : view.rows;
}

/** The guests the list shows as their own rows: the ones a box selects. A companion follows their guest, so their row has none. */
export function shownGuests(view: ListView): string[] {
  return rowsOf(view)
    .filter((row) => row.person.companion == null)
    .map((row) => row.person.guest.id);
}

/** Rows shown, none of them a guest's, as on the Held tab: the note says where companions are selected. */
export function onlyCompanions(view: ListView): boolean {
  const rows = rowsOf(view);

  return rows.length > 0 && rows.every((row) => row.person.companion != null);
}

function chosen(guests: readonly Guest[], selected: ReadonlySet<string>): Guest[] {
  return guests.filter((one) => selected.has(one.id));
}

export function companionsWith(guests: readonly Guest[], selected: ReadonlySet<string>): number {
  return chosen(guests, selected).reduce((sum, one) => sum + one.companions.length, 0);
}

export interface RemoveQuestion {
  goes: number;
  companions: number;
  replied: number;
}

export function removeQuestion(
  guests: readonly Guest[],
  selected: ReadonlySet<string>,
): RemoveQuestion {
  const goes = chosen(guests, selected);

  return {
    goes: goes.length,
    companions: companionsWith(guests, selected),
    replied: goes.filter((one) => one.reply !== 'noReply').length,
  };
}

/** sc-46880 (Decided, 14 Nov): the dialog names at most five already invited, then "and {r} more". */
export const NAMED_MOST = 5;

export interface MarkQuestion {
  marks: number;
  already: string[];
}

/** What pressing Mark as invited asks: only guests Not yet invited are counted, and the already invited are named. */
export function markQuestion(
  guests: readonly Guest[],
  selected: ReadonlySet<string>,
): MarkQuestion {
  const picked = chosen(guests, selected);
  const already = picked.filter((one) => shownReply(one) !== 'notYetInvited');

  return { marks: picked.length - already.length, already: already.map((one) => one.fullName) };
}

export function alreadyLine(t: TFunction, already: readonly string[]): string {
  const more = already.length - NAMED_MOST;
  const names = [
    ...already.slice(0, NAMED_MOST),
    ...(more > 0 ? [t('guestSelect.more', { count: more })] : []),
  ];

  return t('guestSelect.alreadyNamed', {
    count: already.length,
    names: listFormat(currentLocale(), { type: 'conjunction' }).format(names),
  });
}

export type Action =
  | { kind: 'mark'; how: GuestInvitationHow }
  | { kind: 'move'; to: { id: string } | { name: string } }
  | { kind: 'remove' };

export type Line =
  | { kind: 'marked'; marked: MarkedTogether; how: GuestInvitationHow }
  | { kind: 'nothing'; already: number }
  | { kind: 'notLive' }
  | { kind: 'moved'; moved: MovedTogether }
  | { kind: 'removed'; removed: RemovedTogether }
  | { kind: 'undone'; guests: number }
  | { kind: 'failed'; action: Action };

function counted(
  t: TFunction,
  guests: number,
  companions: number,
): { count: number; guests: string; companions: string } {
  return {
    count: guests,
    guests: t('guestSelect.guests', { count: guests }),
    companions: t('guestSelect.companions', { count: companions }),
  };
}

/** The one line an action ends in: every guest it did not change is counted, with why. */
export function lineWords(t: TFunction, line: Line): string[] {
  switch (line.kind) {
    case 'marked': {
      const { marked, already, gone } = line.marked;

      return [
        t('guestSelect.marked', { count: marked, how: t(`guestList.howMid.${line.how}`) }),
        ...(already > 0 ? [t('guestSelect.keptAsRecorded', { count: already })] : []),
        ...(gone > 0 ? [t('guestSelect.removedMeanwhile', { count: gone })] : []),
      ];
    }
    case 'nothing':
      return [t('guestSelect.nothingToMark', { count: line.already })];
    case 'notLive':
      return [t('guestSelect.notLive')];
    case 'moved': {
      const { moved, already, gone, group } = line.moved;

      return [
        ...(moved > 0 ? [t('guestSelect.moved', { count: moved, group: group.name })] : []),
        ...(already > 0 ? [t('guestSelect.alreadyIn', { count: already, group: group.name })] : []),
        ...(gone > 0 ? [t('guestSelect.removedMeanwhile', { count: gone })] : []),
      ];
    }
    case 'removed': {
      const { guests, companions, gone, removal } = line.removed;
      const words = counted(t, guests, companions);

      if (removal == null)
        return [
          t('guestSelect.nothingRemoved'),
          ...(gone > 0 ? [t('guestSelect.removedMeanwhile', { count: gone })] : []),
        ];

      return [
        t(companions === 0 ? 'guestSelect.removed' : 'guestSelect.removedWith', words),
        ...(gone > 0 ? [t('guestSelect.removedMeanwhile', { count: gone })] : []),
        t('guestSelect.undoNote'),
      ];
    }
    case 'undone':
      return [t('guestSelect.undone', { count: line.guests })];
    case 'failed':
      return [t('guestSelect.failed')];
  }
}

export function removeTitle(t: TFunction, asked: RemoveQuestion): string {
  const words = counted(t, asked.goes, asked.companions);

  return t(
    asked.companions === 0 ? 'guestSelect.removeTitle' : 'guestSelect.removeTitleWith',
    words,
  );
}
