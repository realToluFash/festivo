import { describe, expect, it } from 'vitest';

import { endsSentence, followValueStops } from './sentenceStops.ts';

function interpolator() {
  const placeholders: Parameters<typeof followValueStops>[0] = {
    prefix: '\\{\\{',
    suffix: '\\}\\}',
    interpolate: (str: string, data: object) =>
      str.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
        String((data as Record<string, unknown>)[key]),
      ),
  };
  followValueStops(placeholders);

  return (str: string, data: object) => placeholders.interpolate(str, data, 'en', {});
}

describe('followValueStops', () => {
  const render = interpolator();

  it.each([
    ['Galas Ltd.', 'Made by Galas Ltd.'],
    ['Party Time!', 'Made by Party Time!'],
    ["Who's Next?", "Made by Who's Next?"],
    ['Galas…', 'Made by Galas…'],
    ['Galas Ltd..', 'Made by Galas Ltd..'],
    ['Galas Ltd', 'Made by Galas Ltd.'],
    ['Galas (Lagos)', 'Made by Galas (Lagos).'],
    ['Galas »', 'Made by Galas ».'],
    ['Lot 7', 'Made by Lot 7.'],
  ])('puts %j before the string’s full stop as %j', (name, shown) => {
    expect(render('Made by {{name}}.', { name })).toBe(shown);
  });

  it.each([
    ['Organisation: {{name}}, your role', 'Organisation: Galas Ltd., your role'],
    ['Did you mean {{name}}?', 'Did you mean Galas Ltd.?'],
    ['Made by {{name}} today.', 'Made by Galas Ltd. today.'],
    ['Made by {{name}} !', 'Made by Galas Ltd. !'],
    ['No time zone matches “{{name}}”.', 'No time zone matches “Galas Ltd.”.'],
  ])('keeps everything but a full stop after the value: %j', (template, shown) => {
    expect(render(template, { name: 'Galas Ltd.' })).toBe(shown);
  });

  it('looks at each placeholder on its own', () => {
    expect(render('{{org}} and {{role}}.', { org: 'Galas Ltd.', role: 'Door team' })).toBe(
      'Galas Ltd. and Door team.',
    );
    expect(render('{{org}}. {{role}}.', { org: 'Galas Ltd.', role: 'Door team.' })).toBe(
      'Galas Ltd. Door team.',
    );
  });
});

describe('endsSentence', () => {
  it('is true only for the four marks', () => {
    expect(['a.', 'a!', 'a?', 'a…'].map(endsSentence)).toEqual([true, true, true, true]);
    expect(['a', 'a,', 'a)', 'a”', '7'].map(endsSentence)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});
