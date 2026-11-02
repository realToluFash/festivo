<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261017050000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A two-factor challenge carries the Google or Apple identity to link once its code passes.';
    }

    public function up(Schema $schema): void
    {
        // Both null on every existing challenge: none of them was waiting to link anything.
        $this->addSql('ALTER TABLE two_factor_challenges ADD link_provider VARCHAR(32) DEFAULT NULL');
        $this->addSql('ALTER TABLE two_factor_challenges ADD link_subject VARCHAR(255) DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE two_factor_challenges DROP link_provider');
        $this->addSql('ALTER TABLE two_factor_challenges DROP link_subject');
    }
}
