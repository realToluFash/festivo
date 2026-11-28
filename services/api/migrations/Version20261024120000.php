<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261024120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Claims to own an organisation whose only Owner is suspended (sc-6640): the fresh DNS record, when it was found, when ownership passes, and how each ended.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE owner_claims (
                id               UUID NOT NULL,
                domain           VARCHAR(253) NOT NULL,
                record_value     VARCHAR(100) NOT NULL,
                started_at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                lapses_at        TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                checked_at       TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                found_at         TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                passes_at        TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                ended_at         TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                outcome          VARCHAR(20) DEFAULT NULL,
                told             JSON NOT NULL,
                created_at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                organisation_id  UUID NOT NULL,
                claimant_id      UUID NOT NULL,
                stopped_by_id    UUID DEFAULT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_owner_claim_organisation ON owner_claims (organisation_id)');
        $this->addSql('CREATE INDEX idx_owner_claim_claimant ON owner_claims (claimant_id)');
        $this->addSql('CREATE INDEX idx_owner_claim_stopped_by ON owner_claims (stopped_by_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_open_owner_claim ON owner_claims (organisation_id) WHERE (ended_at IS NULL)');
        $this->addSql('ALTER TABLE owner_claims ADD CONSTRAINT FK_1B593FE09E6B1585 FOREIGN KEY (organisation_id) REFERENCES organisations (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE owner_claims ADD CONSTRAINT FK_1B593FE09F409843 FOREIGN KEY (claimant_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE owner_claims ADD CONSTRAINT FK_1B593FE09C2F63E2 FOREIGN KEY (stopped_by_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE owner_claims');
    }
}
