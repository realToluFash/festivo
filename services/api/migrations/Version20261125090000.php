<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261125090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Billing (sc-3929): a moved period end and a moved period start are each their own change kind, period_end and period_start.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            UPDATE subscription_changes
            SET kind = CASE WHEN actor_type = 'system' THEN 'period_end' ELSE 'period_start' END
            WHERE kind = 'period'
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            DELETE FROM subscription_changes start
            WHERE start.kind = 'period_start'
              AND EXISTS (
                  SELECT 1 FROM subscription_changes ended
                  WHERE ended.kind = 'period_end' AND ended.actor_type = 'system' AND ended.actor_label = start.actor_label
              )
            SQL);
        $this->addSql(<<<'SQL'
            UPDATE subscription_changes SET kind = 'period' WHERE kind IN ('period_end', 'period_start')
            SQL);
    }
}
