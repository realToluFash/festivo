<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261104120200 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A role is one of the three fixed ones (sc-29912): its name and what it holds are no longer stored.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('DROP INDEX uniq_role_name_per_organisation');
        $this->addSql('ALTER TABLE roles DROP name');
        $this->addSql('ALTER TABLE roles DROP permissions');
        $this->addSql('ALTER TABLE roles ALTER seeded_as SET NOT NULL');
        $this->addSql('ALTER TABLE roles ALTER seeded_as DROP DEFAULT');
    }

    public function down(Schema $schema): void
    {
        $this->throwIrreversibleMigrationException('The roles that were removed, and what each held, are not kept.');
    }
}
