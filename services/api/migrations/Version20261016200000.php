<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261016200000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Organisations, their roles, and memberships; and how each account came to exist.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE organisations (
                id               UUID NOT NULL,
                name             VARCHAR(100) NOT NULL,
                country_code     VARCHAR(2) NOT NULL,
                currency         VARCHAR(3) NOT NULL,
                timezone         VARCHAR(64) NOT NULL,
                contact_address  VARCHAR(180) NOT NULL,
                created_at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);

        $this->addSql(<<<'SQL'
            CREATE TABLE roles (
                id               UUID NOT NULL,
                organisation_id  UUID NOT NULL,
                seeded_as        VARCHAR(20) DEFAULT NULL,
                name             VARCHAR(40) DEFAULT NULL,
                created_at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);

        $this->addSql('CREATE INDEX idx_role_organisation ON roles (organisation_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_seeded_role_per_organisation ON roles (organisation_id, seeded_as)');

        $this->addSql(<<<'SQL'
            CREATE TABLE memberships (
                id               UUID NOT NULL,
                organisation_id  UUID NOT NULL,
                user_id          UUID NOT NULL,
                role_id          UUID NOT NULL,
                status           VARCHAR(20) NOT NULL,
                created_at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at       TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);

        $this->addSql('CREATE INDEX idx_membership_organisation ON memberships (organisation_id)');
        $this->addSql('CREATE INDEX idx_membership_user ON memberships (user_id)');
        $this->addSql('CREATE INDEX idx_membership_role ON memberships (role_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_membership_per_user ON memberships (organisation_id, user_id)');

        $this->addSql(<<<'SQL'
            ALTER TABLE roles
                ADD CONSTRAINT fk_role_organisation
                FOREIGN KEY (organisation_id) REFERENCES organisations (id)
                ON DELETE CASCADE NOT DEFERRABLE
            SQL);

        $this->addSql(<<<'SQL'
            ALTER TABLE memberships
                ADD CONSTRAINT fk_membership_organisation
                FOREIGN KEY (organisation_id) REFERENCES organisations (id)
                ON DELETE CASCADE NOT DEFERRABLE
            SQL);

        $this->addSql(<<<'SQL'
            ALTER TABLE memberships
                ADD CONSTRAINT fk_membership_user
                FOREIGN KEY (user_id) REFERENCES users (id)
                ON DELETE CASCADE NOT DEFERRABLE
            SQL);

        // No cascade: a role somebody holds is replaced before it goes (sc-66), never deleted out from under them.
        $this->addSql(<<<'SQL'
            ALTER TABLE memberships
                ADD CONSTRAINT fk_membership_role
                FOREIGN KEY (role_id) REFERENCES roles (id)
                NOT DEFERRABLE
            SQL);

        // Every account so far registered on its own: nothing has created one from an invitation yet.
        $this->addSql("ALTER TABLE users ADD origin VARCHAR(20) DEFAULT 'self_registered' NOT NULL");
        $this->addSql('ALTER TABLE users ALTER origin DROP DEFAULT');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE users DROP origin');
        $this->addSql('DROP TABLE memberships');
        $this->addSql('DROP TABLE roles');
        $this->addSql('DROP TABLE organisations');
    }
}
