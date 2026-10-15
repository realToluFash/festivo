<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261015005000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Groups refresh tokens into chains, so replaying a used one can revoke every token descended from the same sign-in.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE refresh_tokens ADD chain_id UUID DEFAULT NULL');

        // Backfill before the constraint. Each existing row is its own chain.
        $this->addSql('UPDATE refresh_tokens SET chain_id = id WHERE chain_id IS NULL');

        $this->addSql('ALTER TABLE refresh_tokens ALTER COLUMN chain_id SET NOT NULL');
        $this->addSql('CREATE INDEX idx_refresh_token_chain ON refresh_tokens (chain_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX idx_refresh_token_chain');
        $this->addSql('ALTER TABLE refresh_tokens DROP chain_id');
    }
}
