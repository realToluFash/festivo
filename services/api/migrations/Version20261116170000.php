<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261116170000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Variants of a dish, each with its own allergens, diets and money, in the library and on an event\'s menu, and the cost an event\'s dish takes when it folds back to one (sc-3903).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE dish_variants (
                id                  UUID NOT NULL,
                dish_id             UUID NOT NULL,
                name                VARCHAR(240) NOT NULL,
                for_children        BOOLEAN NOT NULL,
                allergens           JSON NOT NULL,
                diets               JSON NOT NULL,
                last_price_minor    BIGINT DEFAULT NULL,
                last_price_currency VARCHAR(3) DEFAULT NULL,
                position            SMALLINT NOT NULL,
                created_at          TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at          TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_dish_variant_order ON dish_variants (dish_id, position)');
        $this->addSql('CREATE INDEX IDX_AA64D28A148EB0CB ON dish_variants (dish_id)');
        $this->addSql('ALTER TABLE dish_variants ADD CONSTRAINT FK_AA64D28A148EB0CB FOREIGN KEY (dish_id) REFERENCES dishes (id) ON DELETE CASCADE NOT DEFERRABLE');

        $this->addSql(<<<'SQL'
            CREATE TABLE menu_dish_variants (
                id           UUID NOT NULL,
                dish_id      UUID NOT NULL,
                name         VARCHAR(240) NOT NULL,
                for_children BOOLEAN NOT NULL,
                allergens    JSON NOT NULL,
                diets        JSON NOT NULL,
                cost_minor   BIGINT DEFAULT NULL,
                priced_in    VARCHAR(3) DEFAULT NULL,
                position     SMALLINT NOT NULL,
                created_at   TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at   TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_menu_dish_variant_order ON menu_dish_variants (dish_id, position)');
        $this->addSql('CREATE INDEX IDX_CA7871C148EB0CB ON menu_dish_variants (dish_id)');
        $this->addSql('ALTER TABLE menu_dish_variants ADD CONSTRAINT FK_CA7871C148EB0CB FOREIGN KEY (dish_id) REFERENCES menu_dishes (id) ON DELETE CASCADE NOT DEFERRABLE');

        $this->addSql('ALTER TABLE menu_dishes ADD cost_minor BIGINT DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE menu_dishes DROP cost_minor');
        $this->addSql('DROP TABLE menu_dish_variants');
        $this->addSql('DROP TABLE dish_variants');
    }
}
