import { expect, it } from 'vitest';

import SOURCE from './main.tsx?raw';

it('main.tsx imports the base stylesheet before anything else', () => {
  const first = SOURCE.match(/^import\s+[^;]*;/m)?.[0];

  expect(
    first,
    'In the build, CSS lands in import order: anything imported before styles.css lets its h2 margin beat the :where(.desk) reset (sc-14445).',
  ).toBe("import './styles.css';");
});
