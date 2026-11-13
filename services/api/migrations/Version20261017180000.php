<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261017180000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A sign-in proof can wait for its two-factor code, so a mistyped code never sends the person back to Google or Apple.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE sign_in_proofs ADD awaiting_code BOOLEAN DEFAULT false NOT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE sign_in_proofs DROP awaiting_code');
    }
}
