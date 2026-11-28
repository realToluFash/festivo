<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261119200000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Only our organisation on a proved email domain: when it was switched on, the instant it applies, and when its applying was recorded (sc-563).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE organisation_email_domains
                ADD only_ours_switched_on_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                ADD only_ours_from           TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                ADD only_ours_applied_at     TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL
            SQL);
        $this->addSql('CREATE INDEX idx_email_domain_only_ours ON organisation_email_domains (only_ours_from) WHERE (only_ours_from IS NOT NULL)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX idx_email_domain_only_ours');
        $this->addSql(<<<'SQL'
            ALTER TABLE organisation_email_domains
                DROP only_ours_switched_on_at,
                DROP only_ours_from,
                DROP only_ours_applied_at
            SQL);
    }
}
