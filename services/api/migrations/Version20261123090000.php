<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261123090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A course\'s default and choose-by date (sc-1362): the whole pick given to anyone coming with no answer at the date.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE menu_courses
                ADD default_dish_id    UUID DEFAULT NULL,
                ADD default_variant_id UUID DEFAULT NULL,
                ADD default_options    JSON DEFAULT '[]' NOT NULL,
                ADD choose_by          DATE DEFAULT NULL
            SQL);
        $this->addSql('CREATE INDEX IDX_217E47F2E60BE18E ON menu_courses (default_dish_id)');
        $this->addSql('CREATE INDEX IDX_217E47F2734AFDCC ON menu_courses (default_variant_id)');
        $this->addSql(<<<'SQL'
            ALTER TABLE menu_courses
                ADD CONSTRAINT FK_217E47F2E60BE18E FOREIGN KEY (default_dish_id) REFERENCES menu_dishes (id) ON DELETE SET NULL NOT DEFERRABLE
            SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE menu_courses
                ADD CONSTRAINT FK_217E47F2734AFDCC FOREIGN KEY (default_variant_id) REFERENCES menu_dish_variants (id) ON DELETE SET NULL NOT DEFERRABLE
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE menu_courses DROP CONSTRAINT FK_217E47F2E60BE18E');
        $this->addSql('ALTER TABLE menu_courses DROP CONSTRAINT FK_217E47F2734AFDCC');
        $this->addSql('DROP INDEX IDX_217E47F2E60BE18E');
        $this->addSql('DROP INDEX IDX_217E47F2734AFDCC');
        $this->addSql(<<<'SQL'
            ALTER TABLE menu_courses
                DROP default_dish_id,
                DROP default_variant_id,
                DROP default_options,
                DROP choose_by
            SQL);
    }
}
