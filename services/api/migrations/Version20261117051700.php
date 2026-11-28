<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261117051700 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A press that would change another item on its track is set aside and never counts, naming the press it would have changed (sc-3895).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE schedule_presses ADD set_aside BOOLEAN DEFAULT false NOT NULL');
        $this->addSql('ALTER TABLE schedule_presses ADD set_aside_for_id UUID DEFAULT NULL');
        $this->addSql('ALTER TABLE schedule_presses ADD CONSTRAINT FK_15ED110C9EB0CD24 FOREIGN KEY (set_aside_for_id) REFERENCES schedule_presses (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql('CREATE INDEX IDX_15ED110C9EB0CD24 ON schedule_presses (set_aside_for_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE schedule_presses DROP CONSTRAINT FK_15ED110C9EB0CD24');
        $this->addSql('DROP INDEX IDX_15ED110C9EB0CD24');
        $this->addSql('ALTER TABLE schedule_presses DROP set_aside_for_id');
        $this->addSql('ALTER TABLE schedule_presses DROP set_aside');
    }
}
