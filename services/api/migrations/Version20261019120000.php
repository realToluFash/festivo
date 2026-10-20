<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261019120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Invitations as their own record, every membership transition with who, when and through which channel, and the language a stranger is invited in. Left and removed become one state, so rolling back returns every former membership as removed.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            UPDATE memberships
               SET status = 'left_or_removed'
             WHERE status IN ('left', 'removed')
            SQL);

        $this->addSql(<<<'SQL'
            CREATE TABLE membership_transitions (
                id             UUID NOT NULL,
                membership_id  UUID NOT NULL,
                from_status    VARCHAR(20) DEFAULT NULL,
                to_status      VARCHAR(20) NOT NULL,
                channel        VARCHAR(20) NOT NULL,
                actor_id       UUID DEFAULT NULL,
                occurred_at    TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE INDEX idx_membership_transition_membership ON membership_transitions (membership_id, occurred_at)');
        $this->addSql('CREATE INDEX IDX_95A537E31FB354CD ON membership_transitions (membership_id)');
        $this->addSql('CREATE INDEX IDX_95A537E310DAF24A ON membership_transitions (actor_id)');
        $this->addSql('ALTER TABLE membership_transitions ADD CONSTRAINT FK_95A537E31FB354CD FOREIGN KEY (membership_id) REFERENCES memberships (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE membership_transitions ADD CONSTRAINT FK_95A537E310DAF24A FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql(<<<'SQL'
            INSERT INTO membership_transitions (id, membership_id, from_status, to_status, channel, actor_id, occurred_at)
            SELECT gen_random_uuid(),
                   m.id,
                   NULL,
                   m.status,
                   CASE WHEN u.origin = 'invitation' THEN 'invitation' ELSE 'self_created' END,
                   m.user_id,
                   m.created_at
              FROM memberships m
              JOIN users u ON u.id = m.user_id
            SQL);

        $this->addSql(<<<'SQL'
            CREATE TABLE invitations (
                id                 UUID NOT NULL,
                organisation_id    UUID DEFAULT NULL,
                organisation_name  VARCHAR(100) NOT NULL,
                email              VARCHAR(180) NOT NULL,
                role_id            UUID DEFAULT NULL,
                invited_by_id      UUID DEFAULT NULL,
                token_hash         VARCHAR(64) NOT NULL,
                status             VARCHAR(20) NOT NULL,
                expires_at         TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                accepted_at        TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                accepted_by_id     UUID DEFAULT NULL,
                declined_at        TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                revoked_at         TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                delivery           VARCHAR(20) NOT NULL,
                sent_at            TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                created_at         TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at         TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_invitation_token_hash ON invitations (token_hash)');
        $this->addSql("CREATE UNIQUE INDEX uniq_pending_invitation_per_email ON invitations (organisation_id, email) WHERE status = 'pending'");
        $this->addSql('CREATE INDEX idx_invitation_email ON invitations (email)');
        $this->addSql('CREATE INDEX IDX_232710AE9E6B1585 ON invitations (organisation_id)');
        $this->addSql('CREATE INDEX IDX_232710AED60322AC ON invitations (role_id)');
        $this->addSql('CREATE INDEX IDX_232710AEA7B4A7E3 ON invitations (invited_by_id)');
        $this->addSql('CREATE INDEX IDX_232710AE20F699D9 ON invitations (accepted_by_id)');
        $this->addSql('ALTER TABLE invitations ADD CONSTRAINT FK_232710AE9E6B1585 FOREIGN KEY (organisation_id) REFERENCES organisations (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql('ALTER TABLE invitations ADD CONSTRAINT FK_232710AED60322AC FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql('ALTER TABLE invitations ADD CONSTRAINT FK_232710AEA7B4A7E3 FOREIGN KEY (invited_by_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql('ALTER TABLE invitations ADD CONSTRAINT FK_232710AE20F699D9 FOREIGN KEY (accepted_by_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE');

        $this->addSql("ALTER TABLE organisations ADD locale VARCHAR(5) DEFAULT 'en' NOT NULL");
        $this->addSql(<<<'SQL'
            UPDATE organisations o
               SET locale = owner.locale
              FROM (
                    SELECT DISTINCT ON (m.organisation_id) m.organisation_id, u.locale
                      FROM memberships m
                      JOIN roles r ON r.id = m.role_id AND r.seeded_as = 'owner'
                      JOIN users u ON u.id = m.user_id
                     WHERE u.locale IN ('en', 'es', 'fr', 'pt')
                     ORDER BY m.organisation_id, m.created_at, m.id
                   ) owner
             WHERE owner.organisation_id = o.id
            SQL);
        $this->addSql('ALTER TABLE organisations ALTER locale DROP DEFAULT');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE organisations DROP locale');
        $this->addSql('DROP TABLE invitations');
        $this->addSql('DROP TABLE membership_transitions');
        $this->addSql(<<<'SQL'
            UPDATE memberships
               SET status = 'removed'
             WHERE status = 'left_or_removed'
            SQL);
    }
}
