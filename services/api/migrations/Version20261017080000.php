<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261017080000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return "The account's own IANA time zone, for the times in what it is sent.";
    }

    public function up(Schema $schema): void
    {
        // Accounts from before this have none, so their emails stay in UTC until their next request names a zone.
        $this->addSql('ALTER TABLE users ADD timezone VARCHAR(64) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE users DROP timezone');
    }
}
