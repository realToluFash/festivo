<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261018230000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'An account holding verified phone numbers and no verified primary has its earliest-verified number as primary; an unverified primary stays linked.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            UPDATE phone_numbers unverified
            SET    is_primary = FALSE
            WHERE  unverified.is_primary
              AND  unverified.verified_at IS NULL
              AND  EXISTS (
                       SELECT 1
                       FROM   phone_numbers proved
                       WHERE  proved.user_id = unverified.user_id
                         AND  proved.verified_at IS NOT NULL
                         AND  NOT proved.is_pending
                   )
            SQL);

        $this->addSql(<<<'SQL'
            UPDATE phone_numbers
            SET    is_primary = TRUE
            WHERE  id IN (
                       SELECT DISTINCT ON (earliest.user_id) earliest.id
                       FROM   phone_numbers earliest
                       WHERE  earliest.verified_at IS NOT NULL
                         AND  NOT earliest.is_pending
                         AND  NOT EXISTS (
                                  SELECT 1
                                  FROM   phone_numbers held
                                  WHERE  held.user_id = earliest.user_id
                                    AND  held.is_primary
                              )
                       ORDER  BY earliest.user_id, earliest.verified_at, earliest.id
                   )
            SQL);
    }

    public function down(Schema $schema): void
    {
    }
}
