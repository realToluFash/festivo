<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261019210000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Company domain joining (sc-561): the domains an organisation lists, and the offers an account said Not now to.';
    }

    public function up(Schema $schema): void
    {
        // Two new tables: every organisation starts with none listed, which is the setting's Off.
        $this->addSql(<<<'SQL'
            CREATE TABLE organisation_domains (
                id               UUID NOT NULL,
                organisation_id  UUID NOT NULL,
                domain           VARCHAR(253) NOT NULL,
                proved_at        TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                created_at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_organisation_domain ON organisation_domains (organisation_id, domain)');
        $this->addSql('CREATE INDEX idx_organisation_domain_organisation ON organisation_domains (organisation_id)');
        $this->addSql('CREATE INDEX idx_organisation_domain_domain ON organisation_domains (domain)');
        $this->addSql('ALTER TABLE organisation_domains ADD CONSTRAINT FK_organisation_domains_organisation FOREIGN KEY (organisation_id) REFERENCES organisations (id) ON DELETE CASCADE NOT DEFERRABLE');

        $this->addSql(<<<'SQL'
            CREATE TABLE join_offer_dismissals (
                id               UUID NOT NULL,
                user_id          UUID NOT NULL,
                organisation_id  UUID NOT NULL,
                dismissed_at     TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_join_offer_dismissal ON join_offer_dismissals (user_id, organisation_id)');
        $this->addSql('CREATE INDEX idx_join_offer_dismissal_user ON join_offer_dismissals (user_id)');
        $this->addSql('CREATE INDEX idx_join_offer_dismissal_organisation ON join_offer_dismissals (organisation_id)');
        $this->addSql('ALTER TABLE join_offer_dismissals ADD CONSTRAINT FK_join_offer_dismissals_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE join_offer_dismissals ADD CONSTRAINT FK_join_offer_dismissals_organisation FOREIGN KEY (organisation_id) REFERENCES organisations (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE join_offer_dismissals');
        $this->addSql('DROP TABLE organisation_domains');
    }
}
