<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261125200000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Door codes (sc-4002): a code can also give Can work the floor or Can work the pass, never Can run the floor.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE door_codes DROP CONSTRAINT chk_door_code_role');
        $this->addSql("ALTER TABLE door_codes ADD CONSTRAINT chk_door_code_role CHECK (role IN ('can_view', 'can_check_in', 'can_work_floor', 'can_work_pass'))");
    }

    public function down(Schema $schema): void
    {
        throw new \RuntimeException('Narrowing the check would refuse every code already made at Can work the floor or Can work the pass.');
    }
}
