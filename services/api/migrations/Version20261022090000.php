<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261022090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Answering requests to join (sc-392): the instant an unanswered one is removed, and when an organisation was last told of new ones.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE memberships ADD request_expires_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('ALTER TABLE organisations ADD join_requests_noticed_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');

        // A request already waiting is removed 30 × 24 h after it was last asked, as a new one is.
        $this->addSql(<<<'SQL'
            UPDATE memberships m
            SET    request_expires_at = asked.at + INTERVAL '720 hours'
            FROM   (
                SELECT   membership_id, MAX(occurred_at) AS at
                FROM     membership_transitions
                WHERE    to_status = 'pending_approval'
                GROUP BY membership_id
            ) asked
            WHERE  asked.membership_id = m.id
              AND  m.status = 'pending_approval'
            SQL);

        $this->addSql('CREATE INDEX idx_membership_request_expires ON memberships (request_expires_at)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX idx_membership_request_expires');
        $this->addSql('ALTER TABLE organisations DROP join_requests_noticed_at');
        $this->addSql('ALTER TABLE memberships DROP request_expires_at');
    }
}
