<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261126090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A guest’s Greet as (sc-3960): how messages address them, none until a host sets it.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE guests ADD greet_as VARCHAR(240) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE guests DROP greet_as');
    }
}
