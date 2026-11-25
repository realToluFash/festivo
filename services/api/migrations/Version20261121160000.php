<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261121160000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'One answer per person per course of an event\'s menu (sc-3907).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE meal_answers (
                id                UUID NOT NULL,
                guest_id          UUID NOT NULL,
                course_id         UUID NOT NULL,
                kind              VARCHAR(16) NOT NULL,
                dish_id           UUID DEFAULT NULL,
                variant_id        UUID DEFAULT NULL,
                options           JSON NOT NULL,
                allergens_at_pick JSON NOT NULL,
                created_at        TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at        TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_meal_answer ON meal_answers (guest_id, course_id)');
        $this->addSql('CREATE INDEX idx_meal_answer_dish ON meal_answers (dish_id)');
        $this->addSql('CREATE INDEX IDX_2963741F9A4AA658 ON meal_answers (guest_id)');
        $this->addSql('CREATE INDEX IDX_2963741F591CC992 ON meal_answers (course_id)');
        $this->addSql('CREATE INDEX IDX_2963741F3B69A9AF ON meal_answers (variant_id)');
        $this->addSql('ALTER TABLE meal_answers ADD CONSTRAINT FK_2963741F9A4AA658 FOREIGN KEY (guest_id) REFERENCES guests (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE meal_answers ADD CONSTRAINT FK_2963741F591CC992 FOREIGN KEY (course_id) REFERENCES menu_courses (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE meal_answers ADD CONSTRAINT FK_2963741F148EB0CB FOREIGN KEY (dish_id) REFERENCES menu_dishes (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE meal_answers ADD CONSTRAINT FK_2963741F3B69A9AF FOREIGN KEY (variant_id) REFERENCES menu_dish_variants (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE meal_answers');
    }
}
