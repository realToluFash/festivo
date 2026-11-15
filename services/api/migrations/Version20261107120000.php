<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261107120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'An account holds the colour scheme its person picked, or none for the default (sc-30441).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE users ADD colour_scheme VARCHAR(16) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE users DROP colour_scheme');
    }
}
