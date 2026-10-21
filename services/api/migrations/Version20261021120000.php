<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261021120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Two-factor for everyone (sc-609): when an organisation began requiring it, and when each member was first held at its deadline.';
    }

    public function up(Schema $schema): void
    {
        // Both nullable with no backfill: no organisation requires it yet, so nobody has been held.
        $this->addSql('ALTER TABLE organisations ADD two_factor_required_since TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('ALTER TABLE memberships ADD two_factor_blocked_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE memberships DROP two_factor_blocked_at');
        $this->addSql('ALTER TABLE organisations DROP two_factor_required_since');
    }
}
