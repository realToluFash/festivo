import { MEMBERS_PAGE, type MemberState, memberIsShown } from '@soirely/domain';

interface Row {
  id: string;
  status: MemberState;
  role: { seededAs: string | null };
}

const SHOWN = ['all', 'active', 'waiting', 'suspended', 'former'] as const;

/** A whole organisation's members as a test writes them, served a page at a time as MembersController serves it (sc-49170). */
export function membersPage(
  whole: { members: readonly Row[]; invitations: readonly unknown[] },
  url: string,
): Record<string, unknown> {
  const query = new URL(url).searchParams;
  const show = (query.get('show') ?? 'all') as (typeof SHOWN)[number];
  const limit = Number(query.get('limit') ?? MEMBERS_PAGE);
  const under = (option: (typeof SHOWN)[number]) =>
    whole.members.filter((one) => memberIsShown(one.status, option));
  const listed = under(show);
  const after = query.get('after');
  const from = after == null ? 0 : listed.findIndex((one) => one.id === after) + 1;
  const page = listed.slice(from, from + limit);

  return {
    members: page,
    next: page.length === limit ? (page.at(-1)?.id ?? null) : null,
    counts: Object.fromEntries(SHOWN.map((option) => [option, under(option).length])),
    owners: under('active').filter((one) => one.role.seededAs === 'owner').length,
    faces: under('all').slice(0, 5),
    waiting: under('waiting'),
    invitations: whole.invitations,
  };
}

/** A test's answer to GET …/members, paged by the request's own query when it holds the whole organisation. */
export async function pagedMembers(answer: Response, url: string): Promise<Response> {
  if (!answer.ok) return answer;
  const body = (await answer.clone().json()) as Record<string, unknown>;
  if ('counts' in body) return answer;

  return new Response(JSON.stringify(membersPage(body as Parameters<typeof membersPage>[0], url)), {
    status: answer.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
