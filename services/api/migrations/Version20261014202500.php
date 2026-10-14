<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261014202500 extends AbstractMigration
{
    private const RENAMES = [
        'assistant_interaction' => 'assistant_interactions',
        'audit_entry' => 'audit_entries',
        'schema_probe' => 'schema_probes',
    ];

    public function getDescription(): string
    {
        return 'Renames the existing tables to the plural convention. Rows are not moved.';
    }

    public function up(Schema $schema): void
    {
        foreach (self::RENAMES as $from => $to) {
            $this->addSql(sprintf('ALTER TABLE %s RENAME TO %s', $from, $to));
        }
    }

    public function down(Schema $schema): void
    {
        foreach (self::RENAMES as $from => $to) {
            $this->addSql(sprintf('ALTER TABLE %s RENAME TO %s', $to, $from));
        }
    }
}
