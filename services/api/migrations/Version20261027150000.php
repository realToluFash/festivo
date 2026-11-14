<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261027150000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A scheduled notification names its audience\'s organisation, and goes at that organisation\'s purge (sc-17126).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE scheduled_notifications ADD organisation_id UUID DEFAULT NULL');
        $this->addSql(<<<'SQL'
            UPDATE scheduled_notifications s
            SET    organisation_id = CAST(s.audience->>'organisationId' AS UUID)
            WHERE  s.audience->>'organisationId' IS NOT NULL
              AND  EXISTS (SELECT 1 FROM organisations o WHERE o.id = CAST(s.audience->>'organisationId' AS UUID))
            SQL);
        $this->addSql(<<<'SQL'
            ALTER TABLE scheduled_notifications
                ADD CONSTRAINT FK_SCHEDULED_NOTIFICATION_ORGANISATION
                FOREIGN KEY (organisation_id) REFERENCES organisations (id) ON DELETE CASCADE NOT DEFERRABLE
            SQL);
        $this->addSql('CREATE INDEX idx_scheduled_notification_organisation ON scheduled_notifications (organisation_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE scheduled_notifications DROP organisation_id');
    }
}
