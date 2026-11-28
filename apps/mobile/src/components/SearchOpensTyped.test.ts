import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const route = readFileSync(join('app', 'search.tsx'), 'utf8');
const screen = readFileSync(join('src', 'components', 'SearchScreen.tsx'), 'utf8');

describe('‹ Search opens Search with what was typed still there (sc-83008)', () => {
  it('hands the route’s term to SearchScreen', () => {
    expect(route).toMatch(
      /const \{ \[SEARCH_OPENED_WITH\]: term \} = useLocalSearchParams<[^>]*>\(\);/u,
    );
    expect(route).toMatch(/<SearchScreen organisationId=\{organisation\.id\} term=\{term\} \/>/u);
  });

  it('starts the field with that term', () => {
    expect(screen).toMatch(/const \[typed, setTyped\] = useState\(term \?\? ''\);/u);
    expect(screen).toMatch(/<SearchField\s+ref=\{field\}\s+typed=\{typed\}/u);
  });
});
