<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261119210000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A removed budget line is kept for its Undo and erased a day later (sc-85, decided 19 Nov); only a line still on the budget holds the one staff-time line, and a currency change marks the removed ones as past their Undo and erases their words and price (#72668, #72947). Lines were deleted until now, so nothing is backfilled.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE budget_lines ADD removed_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('ALTER TABLE budget_lines ADD currency_changed BOOLEAN DEFAULT false NOT NULL');
        $this->addSql('DROP INDEX uniq_budget_staff_line');
        $this->addSql(<<<'SQL'
            CREATE UNIQUE INDEX uniq_budget_staff_line ON budget_lines (event_id)
             WHERE (basis = 'per_staff_hour' AND removed_at IS NULL)
            SQL);
        $this->addSql('ALTER TABLE budget_lines ALTER label DROP NOT NULL');
        $this->addSql('ALTER TABLE budget_lines DROP CONSTRAINT budget_lines_price_on_priced_basis');
        $this->addSql(<<<'SQL'
            ALTER TABLE budget_lines
              ADD CONSTRAINT budget_lines_price_on_priced_basis CHECK (currency_changed OR (basis = 'per_staff_hour') = (price_minor IS NULL)),
              ADD CONSTRAINT budget_lines_label CHECK (currency_changed OR label IS NOT NULL),
              ADD CONSTRAINT budget_lines_erased_past_currency CHECK (
                  NOT currency_changed OR (removed_at IS NOT NULL AND label IS NULL AND price_minor IS NULL AND note IS NULL)
              )
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DELETE FROM budget_lines WHERE removed_at IS NOT NULL');
        $this->addSql('ALTER TABLE budget_lines DROP CONSTRAINT budget_lines_erased_past_currency');
        $this->addSql('ALTER TABLE budget_lines DROP CONSTRAINT budget_lines_label');
        $this->addSql('ALTER TABLE budget_lines DROP CONSTRAINT budget_lines_price_on_priced_basis');
        $this->addSql("ALTER TABLE budget_lines ADD CONSTRAINT budget_lines_price_on_priced_basis CHECK ((basis = 'per_staff_hour') = (price_minor IS NULL))");
        $this->addSql('ALTER TABLE budget_lines ALTER label SET NOT NULL');
        $this->addSql('DROP INDEX uniq_budget_staff_line');
        $this->addSql("CREATE UNIQUE INDEX uniq_budget_staff_line ON budget_lines (event_id) WHERE (basis = 'per_staff_hour')");
        $this->addSql('ALTER TABLE budget_lines DROP currency_changed');
        $this->addSql('ALTER TABLE budget_lines DROP removed_at');
    }
}
