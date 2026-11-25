import { type MemberFilter, type MemberState, memberIsShown } from './members.ts';

/** People on Settings › Members, read a page at a time (sc-49170). The web shows 50 a page, the figure its status line puts on screen. */
export const MEMBERS_PAGE = 50;

/** The most rows one read of Members brings back, as MembersController::MOST allows. */
export const MEMBERS_MOST = 500;

/** The next page under the rows held: none asked for, on its way, or failed with the rows already shown kept. */
export type MembersMore = 'idle' | 'loading' | 'failed';

interface Paged {
  members: readonly { id: string }[];
  next: string | null;
}

/** The next page under the rows held; the page's counts and Waiting are newer, so they replace the held ones, and the invitations, which only a first page carries, are kept. */
export function withNextPage<List extends Paged & { invitations: readonly unknown[] }>(
  held: List,
  page: List,
): List {
  const seen = new Set(held.members.map((one) => one.id));

  return {
    ...page,
    members: [...held.members, ...page.members.filter((one) => !seen.has(one.id))],
    invitations: held.invitations,
  };
}

/** A read again of the rows held, with the rows a page brought while it was out kept under it. A read that reached the end is the whole list. */
export function withPagesSince<List extends Paged>(reread: List, held: List): List {
  if (reread.next == null || held.members.length <= reread.members.length) return reread;

  const last = held.members.findIndex((one) => one.id === reread.members.at(-1)?.id);
  const seen = new Set(reread.members.map((one) => one.id));
  const since = held.members.slice(last === -1 ? reread.members.length : last + 1);

  return {
    ...reread,
    members: [...reread.members, ...since.filter((one) => !seen.has(one.id))],
    next: held.next,
  };
}

/** The list after a change to one person: the rows read again, the rows held past them kept, and that person's row as it now is wherever they are held, or gone once the option shown no longer lists them. */
export function withChanged<
  Row extends { id: string; status: MemberState },
  List extends { members: readonly Row[]; next: string | null },
>(reread: List, held: List, changed: Row, shown: MemberFilter): List {
  const list = withPagesSince(reread, held);
  const listed = memberIsShown(changed.status, shown);

  return {
    ...list,
    members: list.members.flatMap((one) =>
      one.id !== changed.id ? [one] : listed ? [changed] : [],
    ),
  };
}

/** How many rows to read again after a change, so every row on screen comes back as it now is, up to what one read brings; `withChanged` puts back the changed row past that. */
export function rereadLimit(held: Paged): number {
  return Math.min(Math.max(held.members.length, MEMBERS_PAGE), MEMBERS_MOST);
}

/** The app's next page starts once the list's end is within one screen of the bottom of the view. */
export function nearsEnd({
  contentOffset,
  contentSize,
  layoutMeasurement,
}: {
  contentOffset: { y: number };
  contentSize: { height: number };
  layoutMeasurement: { height: number };
}): boolean {
  return contentOffset.y + layoutMeasurement.height * 2 >= contentSize.height;
}
