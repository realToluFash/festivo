<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261024200000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'When a member already gone on 19 Oct joined (sc-8168).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            UPDATE memberships m
            SET    joined_at = COALESCE(
                       (SELECT MAX(t.occurred_at)
                        FROM   membership_transitions t
                        WHERE  t.membership_id = m.id
                          AND  t.to_status = 'active'
                          AND  t.from_status IS DISTINCT FROM 'suspended'),
                       CASE WHEN NOT EXISTS (SELECT 1
                                             FROM   membership_transitions t
                                             WHERE  t.membership_id = m.id
                                               AND  t.from_status IS NULL
                                               AND  t.to_status = 'pending_approval')
                            THEN m.created_at
                       END)
            WHERE  m.status IN ('left_or_removed', 'pending_approval')
              AND  m.joined_at IS NULL
            SQL);
    }

    public function down(Schema $schema): void
    {
        // The dates filled are true whichever schema reads them, as in Version20261024180000.
    }
}
