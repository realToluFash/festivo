<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261122130000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'See picks (sc-3909): a meal answer the host made for a guest names the host and the time, and the allergens confirmed despite the record.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE meal_answers
                ADD chosen_by_id   UUID DEFAULT NULL,
                ADD chosen_by_name VARCHAR(200) DEFAULT NULL,
                ADD chosen_at      TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                ADD overridden     JSON DEFAULT '[]' NOT NULL
            SQL);
        $this->addSql('ALTER TABLE meal_answers ALTER overridden DROP DEFAULT');
        $this->addSql('CREATE INDEX IDX_2963741FF5535B5B ON meal_answers (chosen_by_id)');
        $this->addSql(<<<'SQL'
            ALTER TABLE meal_answers
                ADD CONSTRAINT FK_2963741FF5535B5B FOREIGN KEY (chosen_by_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE meal_answers DROP CONSTRAINT FK_2963741FF5535B5B');
        $this->addSql('DROP INDEX IDX_2963741FF5535B5B');
        $this->addSql(<<<'SQL'
            ALTER TABLE meal_answers
                DROP chosen_by_id,
                DROP chosen_by_name,
                DROP chosen_at,
                DROP overridden
            SQL);
    }
}
