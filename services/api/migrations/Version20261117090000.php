<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261117090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Choices inside an event\'s dish, each a question with its options and what each contains (sc-3904).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE menu_dish_choices (
                id         UUID NOT NULL,
                dish_id    UUID NOT NULL,
                question   VARCHAR(320) NOT NULL,
                pick       SMALLINT NOT NULL,
                required   BOOLEAN NOT NULL,
                position   SMALLINT NOT NULL,
                created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_menu_dish_choice_order ON menu_dish_choices (dish_id, position)');
        $this->addSql('CREATE INDEX IDX_EA7B7D0A148EB0CB ON menu_dish_choices (dish_id)');
        $this->addSql('ALTER TABLE menu_dish_choices ADD CONSTRAINT FK_EA7B7D0A148EB0CB FOREIGN KEY (dish_id) REFERENCES menu_dishes (id) ON DELETE CASCADE NOT DEFERRABLE');

        $this->addSql(<<<'SQL'
            CREATE TABLE menu_choice_options (
                id         UUID NOT NULL,
                choice_id  UUID NOT NULL,
                name       VARCHAR(240) NOT NULL,
                allergens  JSON NOT NULL,
                position   SMALLINT NOT NULL,
                created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_menu_choice_option_order ON menu_choice_options (choice_id, position)');
        $this->addSql('CREATE INDEX IDX_F019CBED998666D1 ON menu_choice_options (choice_id)');
        $this->addSql('ALTER TABLE menu_choice_options ADD CONSTRAINT FK_F019CBED998666D1 FOREIGN KEY (choice_id) REFERENCES menu_dish_choices (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE menu_choice_options');
        $this->addSql('DROP TABLE menu_dish_choices');
    }
}
