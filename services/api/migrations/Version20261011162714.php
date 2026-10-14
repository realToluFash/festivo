<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261011162714 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE audit_entry (id UUID NOT NULL, occurred_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL, actor_type VARCHAR(20) NOT NULL, actor_id UUID DEFAULT NULL, actor_label VARCHAR(180) DEFAULT NULL, subject_type VARCHAR(80) NOT NULL, subject_id UUID NOT NULL, action VARCHAR(60) NOT NULL, changes JSON NOT NULL, ip VARCHAR(45) DEFAULT NULL, correlation_id VARCHAR(36) DEFAULT NULL, PRIMARY KEY (id))');
        $this->addSql('CREATE INDEX idx_audit_subject ON audit_entry (subject_type, subject_id)');
        $this->addSql('CREATE INDEX idx_audit_occurred ON audit_entry (occurred_at)');
        $this->addSql('CREATE INDEX idx_audit_actor ON audit_entry (actor_type, actor_id)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP TABLE audit_entry');
    }
}
