import { type ListedEvent, realtimeTopic } from '@soirely/api-client';
import { followedIds } from '@soirely/domain';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  allEvents: vi.fn(),
  unfinishedEvents: vi.fn(),
  headcountsSubscription: vi.fn(),
}));
const following = vi.hoisted(() => ({
  topics: [] as unknown,
  readAgain: (): void => {
    throw new Error('nothing followed');
  },
}));

vi.mock('../api.ts', () => ({ api }));
vi.mock('../followTopic.ts', () => ({
  followReadingAgain: (topics: unknown, _subscribe: unknown, read: () => void) => {
    following.topics = topics;
    following.readAgain = read;
    return () => {};
  },
}));

const { followTodayFigures } = await import('./todayFigures.ts');

const event = (id: string, guests: ListedEvent['guests']) =>
  ({ id, name: id, milestones: [], guests }) as unknown as ListedEvent;

const replied = event('e_replied', { invited: 10, coming: 4, notReplied: 6 });
const quiet = event('e_quiet', { invited: 8, coming: 2, notReplied: 3 });
const finished = event('e_finished', null);
const repliedNow = event('e_replied', { invited: 10, coming: 5, notReplied: 5 });

describe("Today's Your events when a headcount reply lands (sc-49692)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.allEvents.mockResolvedValue([replied, quiet, finished]);
    api.unfinishedEvents.mockResolvedValue([repliedNow, { ...quiet }]);
  });

  it('follows each followed event, then reads only the figures and merges them in', async () => {
    let events: readonly ListedEvent[] = await api.allEvents('org_1');
    followTodayFigures('org_1', followedIds(events), (merge) => {
      events = merge(events);
    });

    expect(following.topics).toEqual([
      realtimeTopic('EventHeadcount', 'e_replied'),
      realtimeTopic('EventHeadcount', 'e_quiet'),
    ]);

    following.readAgain();
    await vi.waitFor(() => expect(events[0]).not.toBe(replied));

    expect(api.unfinishedEvents).toHaveBeenCalledOnce();
    expect(api.unfinishedEvents).toHaveBeenCalledWith('org_1');
    expect(api.allEvents).toHaveBeenCalledOnce();
    expect(events.map(({ id }) => id)).toEqual(['e_replied', 'e_quiet', 'e_finished']);
    expect(events[0]?.guests).toEqual(repliedNow.guests);
    expect(events[1]?.guests).toEqual(quiet.guests);
    expect(events[2]).toBe(finished);
  });
});
