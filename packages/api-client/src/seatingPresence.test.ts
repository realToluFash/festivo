import { describe, expect, it } from 'vitest';

import { realtimeTopic } from './topics.ts';

import {
  asColleagueChoice,
  isSeatingNumbers,
  asPlanBeat,
  asPlanSubscriber,
  asPlanSubscribers,
  subscribersTopic,
  subscribersUrl,
} from './seatingPresence.ts';

const TOPIC = realtimeTopic('EventSeating', '0199d4a2-7b1e');

function subscription(payload: unknown, active = true, topic = TOPIC) {
  return {
    id: `/.well-known/mercure/subscriptions/${encodeURIComponent(topic)}/urn%3Auuid%3A1`,
    type: 'Subscription',
    subscriber: 'urn:uuid:1',
    topic,
    active,
    payload,
  };
}

describe('the hub’s subscriptions topic', () => {
  it('escapes the plan’s topic as the hub does, so the token the API issues covers it', () => {
    expect(subscribersTopic(TOPIC)).toBe(
      '/.well-known/mercure/subscriptions/events%2F0199d4a2-7b1e%2Fseating{/subscriber}',
    );
    expect(subscribersUrl('http://localhost:3000/.well-known/mercure', TOPIC)).toBe(
      'http://localhost:3000/.well-known/mercure/subscriptions/events%2F0199d4a2-7b1e%2Fseating',
    );
  });
});

describe('asPlanSubscriber', () => {
  it('reads a person from the payload their token carries', () => {
    expect(
      asPlanSubscriber(subscription({ userId: 'u1', name: 'Priya Shah', editor: true }), TOPIC),
    ).toEqual({
      subscriber: 'urn:uuid:1',
      userId: 'u1',
      name: 'Priya Shah',
      editor: true,
      active: true,
    });
  });

  it('drops a subscription to another topic, or one whose token named nobody', () => {
    expect(
      asPlanSubscriber(
        subscription(
          { userId: 'u1', name: 'Priya Shah', editor: true },
          true,
          realtimeTopic('EventSeatingChoices', 'x'),
        ),
        TOPIC,
      ),
    ).toBeNull();
    expect(asPlanSubscriber(subscription(null), TOPIC)).toBeNull();
    expect(asPlanSubscriber({ plan: null, measurementSystem: 'metric' }, TOPIC)).toBeNull();
  });

  it('lists only the subscriptions still active', () => {
    expect(
      asPlanSubscribers(
        {
          subscriptions: [
            subscription({ userId: 'u1', name: 'Priya Shah', editor: true }),
            subscription({ userId: 'u2', name: 'Sade Bello', editor: false }, false),
          ],
        },
        TOPIC,
      ).map((one) => one.name),
    ).toEqual(['Priya Shah']);
  });
});

describe('asColleagueChoice', () => {
  it('reads an item, a table’s chair, and nothing chosen', () => {
    expect(
      asColleagueChoice({ userId: 'u1', chosen: { kind: 'table', id: 't7', chair: null } }),
    ).toEqual({ userId: 'u1', chosen: { kind: 'table', id: 't7', chair: null } });
    expect(
      asColleagueChoice({ userId: 'u1', chosen: { kind: 'table', id: 't7', chair: 2 } })?.chosen
        ?.chair,
    ).toBe(2);
    expect(asColleagueChoice({ userId: 'u1', chosen: null })).toEqual({
      userId: 'u1',
      chosen: null,
    });
  });

  it('drops the plan itself and anything else', () => {
    expect(asColleagueChoice({ plan: null, measurementSystem: 'metric' })).toBeNull();
    expect(asColleagueChoice({ userId: 'u1', chosen: { kind: 'stage', id: 's' } })).toBeNull();
  });
});

describe('asPlanBeat', () => {
  it('reads who says they are still here, and nothing else', () => {
    expect(asPlanBeat({ userId: 'u1', here: true })).toBe('u1');
    expect(asPlanBeat({ userId: 'u1', chosen: null })).toBeNull();
    expect(asPlanBeat({ here: true })).toBeNull();
    expect(asPlanBeat(null)).toBeNull();
  });

  it('is never read as a choice', () => {
    expect(asColleagueChoice({ userId: 'u1', here: true })).toBeNull();
  });
});

describe('isSeatingNumbers', () => {
  const numbers = {
    reason: null,
    plan: { tables: 1 },
    sections: [],
    noSection: { tables: 0 },
    people: { coming: 2, comingAndSeated: 1, withoutSeat: 1 },
  };

  it('knows the room in numbers, and not a plan, a choice or a beat', () => {
    expect(isSeatingNumbers(numbers)).toBe(true);
    expect(isSeatingNumbers({ measurementSystem: 'metric', plan: null })).toBe(false);
    expect(isSeatingNumbers({ userId: 'u1', chosen: null })).toBe(false);
    expect(isSeatingNumbers({ userId: 'u1', here: true })).toBe(false);
    expect(isSeatingNumbers(null)).toBe(false);
  });
});
