<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261118210000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'An organisation\'s plan (sc-581): every organisation, existing and new, starts on free.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE organisations ADD plan VARCHAR(20) DEFAULT 'free' NOT NULL
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE organisations DROP plan');
    }
}
