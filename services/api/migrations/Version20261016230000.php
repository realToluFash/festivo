<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261016230000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A phone number texted to replace the primary, which it does only once it is verified.';
    }

    public function up(Schema $schema): void
    {
        // Every existing row is false: none was texted as a replacement under the new rule.
        $this->addSql('ALTER TABLE phone_numbers ADD is_pending BOOLEAN DEFAULT false NOT NULL');
        $this->addSql('CREATE UNIQUE INDEX uniq_pending_phone_per_user ON phone_numbers (user_id) WHERE is_pending');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX uniq_pending_phone_per_user');
        $this->addSql('ALTER TABLE phone_numbers DROP is_pending');
    }
}
