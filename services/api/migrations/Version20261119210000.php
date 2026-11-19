<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261119210000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A removed budget line is kept for its Undo and erased a day later (sc-85, decided 19 Nov); only a line still on the budget holds the one staff-time line. Lines were deleted until now, so nothing is backfilled.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE budget_lines ADD removed_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('DROP INDEX uniq_budget_staff_line');
        $this->addSql(<<<'SQL'
            CREATE UNIQUE INDEX uniq_budget_staff_line ON budget_lines (event_id)
             WHERE (basis = 'per_staff_hour' AND removed_at IS NULL)
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DELETE FROM budget_lines WHERE removed_at IS NOT NULL');
        $this->addSql('DROP INDEX uniq_budget_staff_line');
        $this->addSql("CREATE UNIQUE INDEX uniq_budget_staff_line ON budget_lines (event_id) WHERE (basis = 'per_staff_hour')");
        $this->addSql('ALTER TABLE budget_lines DROP removed_at');
    }
}
