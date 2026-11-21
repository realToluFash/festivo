<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261119120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Email domains, a list of their own that an organisation proves by DNS; proved moves off the joining list (sc-560).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE organisation_email_domains (
                id              UUID         NOT NULL,
                organisation_id UUID         NOT NULL,
                domain          VARCHAR(253) NOT NULL,
                record_value    VARCHAR(64)  NOT NULL,
                added_at        TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                checked_at      TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                proved_at       TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                found_at        TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                missing_since   TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                failed_at       TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_email_domain_organisation ON organisation_email_domains (organisation_id, domain)');
        $this->addSql('CREATE UNIQUE INDEX uniq_email_domain_proved ON organisation_email_domains (domain) WHERE (proved_at IS NOT NULL)');
        $this->addSql('CREATE INDEX idx_email_domain_organisation ON organisation_email_domains (organisation_id)');
        $this->addSql('CREATE INDEX idx_email_domain_domain ON organisation_email_domains (domain)');
        $this->addSql('ALTER TABLE organisation_email_domains ADD CONSTRAINT FK_organisation_email_domains_organisation FOREIGN KEY (organisation_id) REFERENCES organisations (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE organisation_domains DROP COLUMN proved_at');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE organisation_domains ADD proved_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('DROP TABLE organisation_email_domains');
    }
}
