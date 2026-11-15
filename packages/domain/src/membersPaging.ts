/** People on Settings › Members, read a page at a time (sc-49170). The web shows 50 a page, the figure its status line puts on screen. */
export const MEMBERS_PAGE = 50;

/** The next page under the rows held: none asked for, on its way, or failed with the rows already shown kept. */
export type MembersMore = 'idle' | 'loading' | 'failed';

/** The most rows one read brings back, as MembersController allows. */
const MEMBERS_MOST = 500;

interface Paged {
  members: readonly { id: string }[];
  next: string | null;
}

/** The next page under the rows held; the page's counts, Waiting and invitations are newer, so they replace the held ones. */
export function withNextPage<List extends Paged>(held: List, page: List): List {
  const seen = new Set(held.members.map((one) => one.id));

  return {
    ...page,
    members: [...held.members, ...page.members.filter((one) => !seen.has(one.id))],
  };
}

/** How many rows to read again after a change, so every row on screen comes back as it now is. */
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
