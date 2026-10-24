import { describe, expect, it } from 'vitest';

import { blocks, isChecked, isCounted, problemsFor } from './check-comments.mjs';

describe('what counts as a comment', () => {
  it.each([
    ['a line comment', '// the code says this already'],
    ['an indented line comment', '    // and so does this'],
    ['the opening of a block', '/*'],
    ['the body of a block', ' * why the code is shaped this way'],
    ['the close of a block', ' */'],
    ['a JSX comment', '      {/* the heading, but larger */}'],
  ])('%s', (_name, line) => {
    expect(isCounted(line, 'apps/web/src/Screen.tsx')).toBe(true);
  });

  it.each([
    ['code', 'const verified = true;'],
    ['a string that mentions a comment', "const marker = '// not a comment';"],
    ['a JS private field', '  #challenges = new Map();'],
    ['a CSS id selector', '#root {'],
    ['a PHP attribute', '#[Route("/api/auth/verify/email")]'],
  ])('%s is not', (_name, line) => {
    expect(isCounted(line, 'apps/web/src/Screen.tsx')).toBe(false);
  });

  it('a hash opens a comment in PHP', () => {
    expect(isCounted('# legacy style', 'services/api/src/Entity/User.php')).toBe(true);
    expect(isCounted('# legacy style', 'apps/web/src/Screen.tsx')).toBe(false);
  });
});

describe('annotations are read by tools and never counted', () => {
  it.each([
    ' * @param array<string, string> $parts',
    ' * @return list<Suggestion>',
    ' * @extends ServiceEntityRepository<User>',
    '    // eslint-disable-next-line react-hooks/exhaustive-deps',
    '    /* stylelint-disable-next-line custom-property-pattern */',
    '  // @ts-expect-error the mock omits the discriminant',
    '    // @mago-expect analysis:unused-parameter',
  ])('%s', (line) => {
    expect(isCounted(line, 'services/api/src/Repository/UserRepository.php')).toBe(false);
  });

  it('a docblock carrying only types is not a comment block at all', () => {
    const docblock = ['/**', ' * @param non-empty-string $code', ' */'];

    expect(problemsFor('services/api/src/Verifier.php', docblock)).toEqual([]);
  });
});

describe('a block is a run of consecutive comment lines', () => {
  it('code between two comments makes two blocks', () => {
    const added = ['// first', 'const a = 1;', '// second', '// still second'];

    expect(blocks(added, 'scripts/thing.mjs').map((block) => block.length)).toEqual([1, 2]);
  });

  it('nothing but code makes none', () => {
    expect(blocks(['const a = 1;', 'return a;'], 'scripts/thing.mjs')).toEqual([]);
  });
});

describe('the limits', () => {
  const header = (lines) => [
    '/**',
    ...Array.from({ length: lines }, (_, at) => ` * line ${at}`),
    ' */',
  ];

  it('a one-line comment is always fine', () => {
    expect(problemsFor('apps/web/src/session.ts', ['// unrevoked, not newest'])).toEqual([]);
  });

  it('three lines is the most a single comment may run to', () => {
    expect(problemsFor('apps/web/src/session.ts', header(1))).toEqual([]);
    expect(problemsFor('apps/web/src/session.ts', header(2))).toHaveLength(1);
  });

  it('names the file and quotes the comment, so the author can find it', () => {
    const [problem] = problemsFor('services/api/src/Verifier.php', header(3));

    expect(problem).toContain('services/api/src/Verifier.php');
    expect(problem).toContain('a 5-line comment');
    expect(problem).toContain('line 0');
  });

  it('eight scattered one-liners pass and nine do not', () => {
    const scattered = (count) =>
      Array.from({ length: count }, (_, at) => [
        `// note ${at}`,
        `const value${at} = ${at};`,
      ]).flat();

    expect(problemsFor('apps/web/src/session.ts', scattered(8))).toEqual([]);
    expect(problemsFor('apps/web/src/session.ts', scattered(9))).toEqual([
      'apps/web/src/session.ts: 9 added comment lines (at most 8)',
    ]);
  });
});

describe('which files are checked', () => {
  it.each([
    'apps/web/src/routes/public/VerifyEmail.tsx',
    'apps/mobile/app/verify-email.tsx',
    'packages/domain/src/datetime.ts',
    'scripts/check-comments.mjs',
    'services/api/src/Entity/VerificationChallenge.php',
    'apps/web/src/styles.css',
  ])('%s', (file) => {
    expect(isChecked(file)).toBe(true);
  });

  it.each([
    ['prose, where explanation belongs', 'docs/architecture/sessions.md'],
    ['a catalogue', 'apps/web/src/i18n/locales/fr.json'],
    [
      'a workflow, which documents itself to whoever debugs it',
      '.github/workflows/pull-request.yml',
    ],
    ['configuration generated from the bundles', 'services/api/config/reference.php'],
  ])('%s is not', (_name, file) => {
    expect(isChecked(file)).toBe(false);
  });
});

describe('the shape that caused this check to exist', () => {
  it('refuses a header block on a new file', () => {
    const added = [
      '/*',
      ' * Verifies an email address against a challenge.',
      ' *',
      ' * The code is hashed because a leaked table should not be a leaked set of',
      ' * codes, and the challenge is revoked on success so a code works once.',
      ' */',
      'final class EmailAddressVerifier',
    ];

    expect(problemsFor('services/api/src/Verifier.php', added)).toHaveLength(1);
  });

  it('allows the one-liner that says what will break', () => {
    const added = [
      '    // Flushed before the throw: the rollback would otherwise lose the attempt.',
      '    $this->entityManager->flush();',
    ];

    expect(problemsFor('services/api/src/Verifier.php', added)).toEqual([]);
  });
});
