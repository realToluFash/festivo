<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261024180000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'When a former member last joined (sc-8168): a requester never let in has none, and is shown only to the people who decide on them.';
    }

    public function up(Schema $schema): void
    {
        // Version20261021120000 filled active and suspended rows only.
        $this->addSql(<<<'SQL'
            UPDATE memberships m
            SET    joined_at = (SELECT MAX(t.occurred_at)
                                FROM   membership_transitions t
                                WHERE  t.membership_id = m.id
                                  AND  t.to_status = 'active'
                                  AND  t.from_status IS DISTINCT FROM 'suspended')
            WHERE  m.status = 'left_or_removed'
              AND  m.joined_at IS NULL
            SQL);
    }

    public function down(Schema $schema): void
    {
        // The dates filled are true whichever schema reads them, and leaving now keeps joined_at anyway.
    }
}
