<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261122110000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Guest replies (sc-4331): each member keeps one item per event, the one a change would reopen (unread, else the newest read one); the rest go.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            DELETE FROM notification_items
            WHERE id IN (
                SELECT id
                FROM (
                    SELECT id,
                           ROW_NUMBER() OVER (
                               PARTITION BY user_id, thread
                               ORDER BY read_at IS NOT NULL, created_at DESC, id DESC
                           ) AS rank
                    FROM notification_items
                    WHERE thread LIKE 'guest-replies:%'
                ) AS ranked
                WHERE rank > 1
            )
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->throwIrreversibleMigrationException('The extra Guest replies items that were removed are not kept.');
    }
}
