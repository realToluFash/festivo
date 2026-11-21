<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261121130000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Staff rates (sc-101): a job\'s pay on an event, or one person\'s own instead, by the hour or a flat fee. No row predates them, so every job starts with No rate yet.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE staff_rates (
                id           UUID NOT NULL,
                event_id     UUID NOT NULL,
                job_id       UUID DEFAULT NULL,
                person_id    UUID DEFAULT NULL,
                pay          VARCHAR(16) NOT NULL,
                amount_minor BIGINT NOT NULL,
                set_by_id    UUID DEFAULT NULL,
                set_at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                created_at   TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at   TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id),
                CONSTRAINT chk_staff_rate_one_holder CHECK ((job_id IS NULL) <> (person_id IS NULL)),
                CONSTRAINT chk_staff_rate_pay CHECK (pay IN ('hourly', 'flat')),
                CONSTRAINT chk_staff_rate_amount CHECK (amount_minor >= 0)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_staff_rate_event ON staff_rates (event_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_staff_rate_job ON staff_rates (job_id) WHERE (job_id IS NOT NULL)');
        $this->addSql('CREATE UNIQUE INDEX uniq_staff_rate_person ON staff_rates (person_id) WHERE (person_id IS NOT NULL)');
        $this->addSql('CREATE INDEX IDX_393103FB3E16DC62 ON staff_rates (set_by_id)');
        $this->addSql('ALTER TABLE staff_rates ADD CONSTRAINT FK_STAFF_RATE_EVENT FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE staff_rates ADD CONSTRAINT FK_STAFF_RATE_JOB FOREIGN KEY (job_id) REFERENCES staff_jobs (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE staff_rates ADD CONSTRAINT FK_STAFF_RATE_PERSON FOREIGN KEY (person_id) REFERENCES staff_members (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE staff_rates ADD CONSTRAINT FK_STAFF_RATE_SET_BY FOREIGN KEY (set_by_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE staff_rates');
    }
}
