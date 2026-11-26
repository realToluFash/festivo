<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261118220000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Jobs and shifts on an event (sc-3908), each person with one job; every event starts with the suggested jobs.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE staff_jobs (
                id          UUID NOT NULL,
                event_id    UUID NOT NULL,
                name        VARCHAR(240) NOT NULL,
                name_key    VARCHAR(240) NOT NULL,
                access      VARCHAR(16) NOT NULL,
                position    INT NOT NULL,
                created_at  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_staff_job_name ON staff_jobs (event_id, name_key)');
        $this->addSql('CREATE INDEX IDX_4AA51B4A71F7E88B ON staff_jobs (event_id)');
        $this->addSql('ALTER TABLE staff_jobs ADD CONSTRAINT FK_4AA51B4A71F7E88B FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');

        $this->addSql(<<<'SQL'
            CREATE TABLE staff_shifts (
                id          UUID NOT NULL,
                job_id      UUID NOT NULL,
                starts_at   TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                ends_at     TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                needed      INT NOT NULL,
                created_at  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX IDX_1860C394BE04EA9 ON staff_shifts (job_id)');
        $this->addSql('ALTER TABLE staff_shifts ADD CONSTRAINT FK_1860C394BE04EA9 FOREIGN KEY (job_id) REFERENCES staff_jobs (id) ON DELETE CASCADE NOT DEFERRABLE');

        $this->addSql(<<<'SQL'
            CREATE TABLE staff_shift_people (
                shift_id         UUID NOT NULL,
                staff_member_id  UUID NOT NULL,
                PRIMARY KEY (shift_id, staff_member_id)
            )
            SQL);
        $this->addSql('CREATE INDEX IDX_215AFA5BBB70BC0E ON staff_shift_people (shift_id)');
        $this->addSql('CREATE INDEX IDX_215AFA5B44DB03B1 ON staff_shift_people (staff_member_id)');
        $this->addSql('ALTER TABLE staff_shift_people ADD CONSTRAINT FK_215AFA5BBB70BC0E FOREIGN KEY (shift_id) REFERENCES staff_shifts (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE staff_shift_people ADD CONSTRAINT FK_215AFA5B44DB03B1 FOREIGN KEY (staff_member_id) REFERENCES staff_members (id) ON DELETE CASCADE NOT DEFERRABLE');

        $this->addSql('ALTER TABLE staff_members ADD job_id UUID DEFAULT NULL');
        $this->addSql('CREATE INDEX IDX_1916C549BE04EA9 ON staff_members (job_id)');
        $this->addSql('ALTER TABLE staff_members ADD CONSTRAINT FK_1916C549BE04EA9 FOREIGN KEY (job_id) REFERENCES staff_jobs (id) ON DELETE SET NULL NOT DEFERRABLE');

        $this->addSql(<<<'SQL'
            INSERT INTO staff_jobs (id, event_id, name, name_key, access, position, created_at, updated_at)
            SELECT gen_random_uuid(), e.id, s.name, s.name_key, s.access, s.position, NOW(), NOW()
            FROM events e
            CROSS JOIN (VALUES
                ('Floor lead', 'floor lead', 'run',      0),
                ('Waiter',     'waiter',     'floor',    1),
                ('Runner',     'runner',     'floor',    2),
                ('Bar',        'bar',        'view',     3),
                ('Door',       'door',       'check_in', 4),
                ('Kitchen',    'kitchen',    'pass',     5),
                ('Security',   'security',   'view',     6),
                ('Sound',      'sound',      'view',     7),
                ('MC',         'mc',         'view',     8)
            ) AS s (name, name_key, access, position)
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE staff_members DROP CONSTRAINT FK_1916C549BE04EA9');
        $this->addSql('DROP INDEX IDX_1916C549BE04EA9');
        $this->addSql('ALTER TABLE staff_members DROP job_id');
        $this->addSql('DROP TABLE staff_shift_people');
        $this->addSql('DROP TABLE staff_shifts');
        $this->addSql('DROP TABLE staff_jobs');
    }
}
