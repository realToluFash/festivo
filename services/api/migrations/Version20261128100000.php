<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261128100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A schedule item can be a course from the menu (sc-3898): one course at most, a course on one item at most, and the notice an item keeps when its course was removed from the menu.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE schedule_items
                ADD COLUMN course_id         UUID DEFAULT NULL,
                ADD COLUMN course_removed_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL
            SQL);
        $this->addSql('ALTER TABLE schedule_items ADD CONSTRAINT FK_1D472911591CC992 FOREIGN KEY (course_id) REFERENCES menu_courses (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql('CREATE UNIQUE INDEX UNIQ_1D472911591CC992 ON schedule_items (course_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE schedule_items DROP CONSTRAINT FK_1D472911591CC992');
        $this->addSql('DROP INDEX UNIQ_1D472911591CC992');
        $this->addSql(<<<'SQL'
            ALTER TABLE schedule_items
                DROP COLUMN course_id,
                DROP COLUMN course_removed_at
            SQL);
    }
}
