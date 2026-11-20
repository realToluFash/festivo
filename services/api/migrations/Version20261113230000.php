<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261113230000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A guest is Not yet invited until somebody invites them: when, how, and who marked them by hand (sc-3788). A guest who has already replied is invited when they replied; everyone else stays Not yet invited.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE guests ADD invited_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
        $this->addSql('ALTER TABLE guests ADD invitation_method VARCHAR(16) DEFAULT NULL');
        $this->addSql('ALTER TABLE guests ADD invited_by_id UUID DEFAULT NULL');
        $this->addSql('CREATE INDEX IDX_4D11BCB2A7B4A7E3 ON guests (invited_by_id)');
        $this->addSql('ALTER TABLE guests ADD CONSTRAINT FK_4D11BCB2A7B4A7E3 FOREIGN KEY (invited_by_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql(<<<'SQL'
            UPDATE guests
               SET invited_at        = replied_at,
                   invitation_method = 'reply'
             WHERE host_id IS NULL
               AND reply IS NOT NULL
               AND reply <> 'noReply'
               AND replied_at IS NOT NULL
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE guests DROP CONSTRAINT FK_4D11BCB2A7B4A7E3');
        $this->addSql('DROP INDEX IDX_4D11BCB2A7B4A7E3');
        $this->addSql('ALTER TABLE guests DROP invited_by_id');
        $this->addSql('ALTER TABLE guests DROP invitation_method');
        $this->addSql('ALTER TABLE guests DROP invited_at');
    }
}
