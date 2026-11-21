<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261116150000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Holds an event\'s menu: its courses in order, how guests answer each, and the event\'s own copy of each dish on a course (sc-3902).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE menu_courses (
                id            UUID NOT NULL,
                event_id      UUID NOT NULL,
                name          VARCHAR(240) NOT NULL,
                served_at     VARCHAR(5) DEFAULT NULL,
                position      SMALLINT NOT NULL,
                guests_choose BOOLEAN NOT NULL,
                skippable     BOOLEAN NOT NULL,
                created_at    TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at    TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_menu_course_order ON menu_courses (event_id, position)');
        $this->addSql('CREATE INDEX IDX_217E47F271F7E88B ON menu_courses (event_id)');
        $this->addSql('ALTER TABLE menu_courses ADD CONSTRAINT FK_217E47F271F7E88B FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');

        $this->addSql(<<<'SQL'
            CREATE TABLE menu_dishes (
                id              UUID NOT NULL,
                course_id       UUID NOT NULL,
                library_dish_id UUID DEFAULT NULL,
                name            VARCHAR(480) NOT NULL,
                description     VARCHAR(1200) DEFAULT NULL,
                allergens       JSON DEFAULT NULL,
                diets           JSON NOT NULL,
                position        SMALLINT NOT NULL,
                created_at      TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at      TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_menu_dish_order ON menu_dishes (course_id, position)');
        $this->addSql('CREATE INDEX IDX_8B0A8B85591CC992 ON menu_dishes (course_id)');
        $this->addSql('CREATE INDEX IDX_8B0A8B856E4F08FB ON menu_dishes (library_dish_id)');
        $this->addSql('ALTER TABLE menu_dishes ADD CONSTRAINT FK_8B0A8B85591CC992 FOREIGN KEY (course_id) REFERENCES menu_courses (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE menu_dishes ADD CONSTRAINT FK_8B0A8B856E4F08FB FOREIGN KEY (library_dish_id) REFERENCES dishes (id) ON DELETE SET NULL NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE menu_dishes');
        $this->addSql('DROP TABLE menu_courses');
    }
}
