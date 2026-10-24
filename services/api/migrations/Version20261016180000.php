<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261016180000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'At most one unrevoked verification challenge per address and per phone, enforced by the database.';
    }

    public function up(Schema $schema): void
    {
        // Concurrent resends left several live rows; all but the newest go first, or the index cannot be built.
        $this->addSql(<<<'SQL'
            UPDATE verification_challenges c
            SET    revoked_at = NOW()
            WHERE  c.revoked_at IS NULL
              AND  c.email_address_id IS NOT NULL
              AND  c.id <> (
                       SELECT newest.id
                       FROM   verification_challenges newest
                       WHERE  newest.email_address_id = c.email_address_id
                         AND  newest.revoked_at IS NULL
                       ORDER  BY newest.id DESC
                       LIMIT  1
                   )
            SQL);

        $this->addSql(<<<'SQL'
            UPDATE verification_challenges c
            SET    revoked_at = NOW()
            WHERE  c.revoked_at IS NULL
              AND  c.phone_number_id IS NOT NULL
              AND  c.id <> (
                       SELECT newest.id
                       FROM   verification_challenges newest
                       WHERE  newest.phone_number_id = c.phone_number_id
                         AND  newest.revoked_at IS NULL
                       ORDER  BY newest.id DESC
                       LIMIT  1
                   )
            SQL);

        $this->addSql(<<<'SQL'
            CREATE UNIQUE INDEX uniq_live_challenge_per_email
                ON verification_challenges (email_address_id)
                WHERE revoked_at IS NULL
            SQL);

        $this->addSql(<<<'SQL'
            CREATE UNIQUE INDEX uniq_live_challenge_per_phone
                ON verification_challenges (phone_number_id)
                WHERE revoked_at IS NULL
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX uniq_live_challenge_per_email');
        $this->addSql('DROP INDEX uniq_live_challenge_per_phone');
    }
}
