<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261118150000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Vendors (sc-82): the people an organisation buys from.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE vendors (
                id                  UUID NOT NULL,
                organisation_id     UUID NOT NULL,
                name                VARCHAR(400) NOT NULL,
                category            VARCHAR(20) NOT NULL,
                contact_name        VARCHAR(400) DEFAULT NULL,
                email_address       VARCHAR(254) DEFAULT NULL,
                phone_number        VARCHAR(20) DEFAULT NULL,
                phone_country_code  VARCHAR(2) DEFAULT NULL,
                website             VARCHAR(8192) DEFAULT NULL,
                address             VARCHAR(1200) DEFAULT NULL,
                note                VARCHAR(4000) DEFAULT NULL,
                archived_at         TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                created_at          TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at          TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_vendor_organisation ON vendors (organisation_id)');
        $this->addSql('ALTER TABLE vendors ADD CONSTRAINT FK_vendors_organisation FOREIGN KEY (organisation_id) REFERENCES organisations (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE vendors');
    }
}
