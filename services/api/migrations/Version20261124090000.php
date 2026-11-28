<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261124090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Door codes (sc-72): the code Make a new code put in a code\'s place, so People leaves a replaced code out. No code predates it as replaced.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE door_codes ADD replaced_by_id UUID DEFAULT NULL');
        $this->addSql('ALTER TABLE door_codes ADD CONSTRAINT FK_14377D6E9AC69B54 FOREIGN KEY (replaced_by_id) REFERENCES door_codes (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql('CREATE INDEX IDX_14377D6E9AC69B54 ON door_codes (replaced_by_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE door_codes DROP CONSTRAINT FK_14377D6E9AC69B54');
        $this->addSql('DROP INDEX IDX_14377D6E9AC69B54');
        $this->addSql('ALTER TABLE door_codes DROP replaced_by_id');
    }
}
