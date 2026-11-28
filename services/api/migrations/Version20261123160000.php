<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261123160000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Menu changed (sc-3913): the dish a person picked, why a menu change asks them again for its course, and the allergens added to it they have recorded.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE meal_answers
                ADD changed_from VARCHAR(200) DEFAULT NULL,
                ADD changed_why  VARCHAR(16)  DEFAULT NULL,
                ADD changed_ways SMALLINT     DEFAULT NULL,
                ADD changed_allergens JSON    DEFAULT '[]' NOT NULL
            SQL);
        $this->addSql('ALTER TABLE meal_answers ALTER changed_allergens DROP DEFAULT');
    }

    public function down(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE meal_answers
                DROP changed_from,
                DROP changed_why,
                DROP changed_ways,
                DROP changed_allergens
            SQL);
    }
}
