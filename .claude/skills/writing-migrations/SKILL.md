---
name: writing-migrations
description: How Doctrine migrations are written in services/api — SQL in a nowdoc so a column list is readable at a glance, where a backfill belongs, the order of a backfill against a constraint, and why a generated migration is read before it is run. Use when adding, editing or reviewing anything under services/api/migrations.
---

# Writing migrations

A migration is the one file nobody re-reads until something has gone wrong, and by then it
has already run everywhere. **writing-php** owns how a class is written; this owns the
migration.

## SQL goes in a nowdoc, one column per line

`doctrine:migrations:diff` emits the whole of a `CREATE TABLE` as a single-quoted string on
one line. For a real table that is 700-odd characters, and at that width nobody reads the
column list — they scan for the name they came for and trust the rest.

Rewrite it. The migration is reviewed as the description of a schema change, so it has to
be readable as one:

```php
public function up(Schema $schema): void
{
    $this->addSql(<<<'SQL'
        CREATE TABLE assistant_interactions (
            id                UUID NOT NULL,
            occurred_at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
            actor_type        VARCHAR(20) NOT NULL,
            actor_id          UUID DEFAULT NULL,
            context           VARCHAR(40) NOT NULL,
            system_prompt     TEXT NOT NULL,
            input_tokens      INT NOT NULL,
            PRIMARY KEY (id)
        )
        SQL);
}
```

Rules that make this worth the keystrokes:

- **A nowdoc (`<<<'SQL'`), not a heredoc (`<<<SQL`).** The quoted label turns interpolation
  off, so a `$` in the SQL is a `$` and a value cannot be spliced into a statement by
  accident. A migration with an interpolated variable in its SQL is the shape of an
  injection even when today's value is safe.
- **The label is `SQL`.** Editors and `mago` syntax-highlight a nowdoc by its label, and the
  highlighting is most of what makes the block readable.
- **One column per line, with the names padded to a common width.** The alignment is the
  point: a column whose type is wrong, or whose `NOT NULL` is missing, shows in the shape of
  the block rather than having to be read for.
- **Pad the names only, not the types.** Aligning a second column sounds better and is
  worse: `TIMESTAMP(0) WITHOUT TIME ZONE` is forty characters wide, so every other line gets
  padded out past it and the block becomes mostly whitespace.
- **Closing label indented to match the statement.** PHP strips that indentation from the
  value, so the SQL arrives unindented and the file stays readable.
- **A short statement stays on one line.** `DROP TABLE x`, `CREATE INDEX …`, a single
  `ALTER TABLE … ADD COLUMN` — a nowdoc around twelve words is ceremony. The rule is about
  statements too long to take in at a glance, which in practice means a column list, a
  multi-clause `ALTER`, or any backfill.

## A backfill belongs in the migration that needs it

Never in a one-off command somebody runs by hand at deploy time. The migration that adds
the constraint is the only place that knows the constraint is coming.

**Write it as raw SQL through `addSql`, never through an entity or a repository.** The
mapping describes the schema at HEAD, not the schema at this point in the chain, so an
entity-driven backfill breaks the moment a later migration changes a column — and it breaks
for whoever deploys next, not for whoever wrote it.

```php
$this->addSql(<<<'SQL'
    UPDATE guests
    SET    rsvp_status = 'held'
    WHERE  rsvp_status IS NULL
      AND  host_guest_id IS NOT NULL
    SQL);
```

## Order: backfill, then the constraint

The column has to be clean before it can be made `NOT NULL`. Put an explicit assert between
the two **only where the constraint's own error would not identify the bad rows**:

- `SET NOT NULL` on one column already names the table and the column in its error. No
  assert needed.
- One message covering two tables, or a check constraint whose violation says only that a
  constraint failed, does need one:

```php
$this->addSql(<<<'SQL'
    DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM guests WHERE rsvp_status IS NULL) THEN
            RAISE EXCEPTION 'guests still has rows with no rsvp_status; backfill did not cover them';
        END IF;
    END $$;
    SQL);
```

That block is why the nowdoc matters: `$$` is PostgreSQL's dollar quoting, and in a heredoc
PHP would try to read `$$` as a variable.

## Read a generated migration before you run it

`doctrine:migrations:diff` is a starting point and it is wrong in two ways that cost real
data:

- **It cannot tell a rename from a drop and a create**, and emits the destructive pair. The
  table rename in `Version20261014202500.php` is hand-written for exactly this reason — the
  generated version would have dropped three tables and made three empty ones.
- **It diffs against whatever the database currently is.** A database behind on migrations
  produces a diff that recreates tables that already exist. Run `just migrate-database-dev`
  first, then diff.

`just diff-database` shows what a migration would contain without writing one. Read that,
then `just new-migration` and write the file.

## What goes in `getDescription()`

One sentence, in the present tense, saying what the schema can now hold — not what the
command does. `'Records each turn asked of the assistant: prompt, provider, outcome and
tokens.'` rather than `'Add assistant_interaction table'`. It is what
`doctrine:migrations:list` prints, and that list is the only index of the schema's history
anybody reads.

## `down()` is real, and it is not always symmetric

A `down()` that drops a table is honest. A `down()` that cannot restore what `up()` deleted
should say so rather than pretend:

```php
public function down(Schema $schema): void
{
    throw new RuntimeException('Dropping these columns would lose the only copy of the data.');
}
```

A silently lossy `down()` is worse than one that refuses, because somebody will run it.

## What does not go in a comment

**What happens to rows that predate the change** goes in the story's AC and the pull
request's Risks, per `docs/architecture/database.md` — not in a docblock above the class.
`code-comments` applies here as everywhere: `migrations/` is held at 0% comments
deliberately. The SQL, read as a block, says what the change is; the description says what
it is for; the pull request says what it means for existing data.

## Table and column names

- **Tables are plural** — `users`, `audit_entries`, `assistant_interactions`. The convention
  and its reasoning are in `docs/architecture/database.md`.
- **Columns are `snake_case`**, and a timestamp says what happened: `activated_at`,
  `email_verified_at`, `deleted_at` — not `is_activated` plus a separate date.
- **An index is named**, and the name says what it is for: `idx_assistant_occurred`,
  `uniq_user_email`. An auto-generated `IDX_8F3A2B1C` tells a reader nothing when it appears
  in a slow-query log.

## Before you call it done

```bash
just prepare-database-test    # drops, recreates, runs every migration from nothing
just validate-database        # does the mapping agree with the schema the migrations made?
```

**`prepare-database-test` is the gate.** It is the only thing that proves the migration runs
against an empty database rather than against yours, and a migration that only works against
a database with history in it is a migration that fails for everyone else.
