<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261021180100 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Every existing organisation\'s Administrator and Event manager can create events, once.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            UPDATE roles
            SET    permissions = (permissions::jsonb || '["events.create"]'::jsonb)::json
            WHERE  seeded_as IN ('administrator', 'event_manager')
              AND  NOT permissions::jsonb @> '["events.create"]'::jsonb
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            UPDATE roles
            SET    permissions = (permissions::jsonb - 'events.create')::json
            SQL);
    }
}
