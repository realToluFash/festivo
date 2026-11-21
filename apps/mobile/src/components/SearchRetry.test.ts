import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const screen = readFileSync(join('src', 'components', 'SearchScreen.tsx'), 'utf8');
const retry = /function retry\(\): void \{([\s\S]*?)\n {2}\}/u.exec(screen)?.[1] ?? '';
const search = /function search\(\): void \{([\s\S]*?)\n {2}\}/u.exec(screen)?.[1] ?? '';
const failed = /if \(answer\.kind === 'failed'\)\n([\s\S]*?)\);\n/u.exec(screen)?.[1] ?? '';

describe('the app’s Search failing online, and its Try again (sc-39534)', () => {
  it('draws the failure sentence with a Try again that reaches retry', () => {
    expect(failed).toContain("{t('search.failed')}");
    expect(failed).toMatch(/<TextAction label=\{t\('search\.tryAgain'\)\} onPress=\{onRetry\}/u);
    expect(screen).toMatch(/onRetry=\{retry\}/u);
  });

  it('asks the typed term again through loading, with no typing pause, focus back in the field', () => {
    expect(retry).toContain("setAnswer({ kind: 'loading' });");
    expect(retry).toContain('search();');
    expect(retry).toContain('field.current?.focus();');
    expect(retry).not.toMatch(/setTyped/u);
    expect(search).toContain('term: typed, round: was.round + 1');
    expect(screen).toMatch(/asked\.round > 0 && asked\.term === typed \? 0 : TYPING_PAUSE_MS/u);
  });

  it('shows a failure on a working connection as failed, and a refusal as no match', () => {
    expect(screen).toMatch(/const failure = searchFailure\(error\);/u);
    expect(screen).toMatch(
      /failure === 'refused' \? \{ kind: 'found', term, groups: \[\] \} : \{ kind: failure \}/u,
    );
  });

  it('reads the failure out, as it reads the count', () => {
    expect(screen).toMatch(/answer\.kind === 'failed'\n\s*\? t\('search\.failed'\)/u);
  });
});
