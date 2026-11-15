import { describe, expect, it } from 'vitest';

import { problemsIn } from './check-migrations.mjs';

const quoted = (sql) => `        $this->addSql('${sql}');`;

describe('a migration statement', () => {
  it.each([
    [
      'a CREATE TABLE',
      'CREATE TABLE things (id UUID NOT NULL, name VARCHAR(80) NOT NULL, PRIMARY KEY (id))',
    ],
    ['a multi-clause ALTER', 'ALTER TABLE things ADD a INT DEFAULT NULL, ADD b INT DEFAULT NULL'],
    ['a backfill', 'UPDATE things SET a = 0 WHERE a IS NULL'],
  ])('refuses %s in a quoted string', (_name, sql) => {
    expect(problemsIn(quoted(sql))).toHaveLength(1);
  });

  it.each([
    ['DROP TABLE things'],
    ['CREATE INDEX idx_thing_user ON things (user_id)'],
    ['ALTER TABLE things ADD a INT DEFAULT NULL'],
    [
      'ALTER TABLE things ADD CONSTRAINT FK_1 FOREIGN KEY (user_id) REFERENCES users (id) NOT DEFERRABLE',
    ],
  ])('lets a short one stay on one line: %s', (sql) => {
    expect(problemsIn(quoted(sql))).toEqual([]);
  });

  it('takes anything in a nowdoc', () => {
    const source = `        $this->addSql(<<<'SQL'
            CREATE TABLE things (
                id    UUID NOT NULL,
                name  VARCHAR(80) NOT NULL
            )
            SQL);`;

    expect(problemsIn(source)).toEqual([]);
  });
});
