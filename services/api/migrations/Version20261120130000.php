<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261120130000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'How many days before a scheduled payment falls due its reminder goes, per organisation (sc-95). Every organisation starts at 3.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE organisations
                ADD payment_reminder_days SMALLINT DEFAULT 3 NOT NULL,
                ADD CONSTRAINT organisations_payment_reminder_days_range CHECK (payment_reminder_days BETWEEN 1 AND 30)
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            ALTER TABLE organisations
                DROP CONSTRAINT organisations_payment_reminder_days_range,
                DROP payment_reminder_days
            SQL);
    }
}
