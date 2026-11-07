<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261021120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Two-factor for everyone (sc-609): when an organisation began requiring it, when each member last joined, and when each was first held at its deadline.';
    }

    public function up(Schema $schema): void
    {
        // Both nullable with no backfill: no organisation requires it yet, so nobody has been held.
        $this->addSql('ALTER TABLE organisations ADD two_factor_required_since TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('ALTER TABLE memberships ADD two_factor_blocked_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('ALTER TABLE memberships ADD joined_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');

        // The latest move into active that was not a reinstatement; a row with no transitions joined when it was made.
        $this->addSql(<<<'SQL'
            UPDATE memberships m
            SET    joined_at = COALESCE(
                       (SELECT MAX(t.occurred_at)
                        FROM   membership_transitions t
                        WHERE  t.membership_id = m.id
                          AND  t.to_status = 'active'
                          AND  t.from_status IS DISTINCT FROM 'suspended'),
                       m.created_at)
            WHERE  m.status IN ('active', 'suspended')
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE memberships DROP joined_at');
        $this->addSql('ALTER TABLE memberships DROP two_factor_blocked_at');
        $this->addSql('ALTER TABLE organisations DROP two_factor_required_since');
    }
}
