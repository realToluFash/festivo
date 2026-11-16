<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261116140000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Holds each organisation\'s menu library: a dish, the allergens and diets it is stated with, its last price, and whether an event has used it (sc-3901).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE dishes (
                id                  UUID NOT NULL,
                organisation_id     UUID NOT NULL,
                name                VARCHAR(480) NOT NULL,
                description         VARCHAR(1200) DEFAULT NULL,
                allergens           JSON DEFAULT NULL,
                diets               JSON NOT NULL,
                last_price_minor    BIGINT DEFAULT NULL,
                last_price_currency VARCHAR(3) DEFAULT NULL,
                used_by_event       BOOLEAN NOT NULL,
                archived_at         TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                created_at          TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at          TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_dish_organisation ON dishes (organisation_id)');
        $this->addSql('ALTER TABLE dishes ADD CONSTRAINT FK_584DD35D9E6B1585 FOREIGN KEY (organisation_id) REFERENCES organisations (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE dishes');
    }
}
