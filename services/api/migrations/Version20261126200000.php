<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261126200000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'The briefing (sc-3917): an event\'s house rules, and how far each person\'s briefing got. Every existing person starts Not sent, with no briefing copy, and every event with no rules.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE events ADD staff_rules TEXT DEFAULT NULL');
        $this->addSql(<<<'SQL'
            ALTER TABLE staff_members
                ADD brief_status      VARCHAR(16) DEFAULT 'none' NOT NULL,
                ADD brief_print       VARCHAR(64) DEFAULT NULL,
                ADD brief_copy_by_id  UUID DEFAULT NULL,
                ADD brief_copy_at     TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                ADD brief_copy_marked BOOLEAN DEFAULT false NOT NULL
            SQL);
        $this->addSql('CREATE INDEX IDX_1916C5491C49E9F7 ON staff_members (brief_copy_by_id)');
        $this->addSql(<<<'SQL'
            ALTER TABLE staff_members
                ADD CONSTRAINT FK_1916C5491C49E9F7 FOREIGN KEY (brief_copy_by_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE staff_members DROP CONSTRAINT FK_1916C5491C49E9F7');
        $this->addSql('DROP INDEX IDX_1916C5491C49E9F7');
        $this->addSql(<<<'SQL'
            ALTER TABLE staff_members
                DROP brief_status,
                DROP brief_print,
                DROP brief_copy_by_id,
                DROP brief_copy_at,
                DROP brief_copy_marked
            SQL);
        $this->addSql('ALTER TABLE events DROP staff_rules');
    }
}
