<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261016210000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'When an account first saved the details screen, which "complete" requires once.';
    }

    public function up(Schema $schema): void
    {
        // Null for every existing account: none has seen the details screen, so each is asked once.
        $this->addSql('ALTER TABLE users ADD details_saved_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE users DROP details_saved_at');
    }
}
