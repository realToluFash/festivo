<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261119090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Door codes (sc-72): a code onto one event, each use of it, and the code a person on People came in by. No row predates them.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE door_codes (
                id         UUID NOT NULL,
                event_id   UUID NOT NULL,
                code       VARCHAR(8) NOT NULL,
                role       VARCHAR(20) NOT NULL,
                job_label  VARCHAR(240) DEFAULT NULL,
                use_cap    SMALLINT NOT NULL,
                expires_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                stopped_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL,
                made_by_id UUID DEFAULT NULL,
                created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id),
                CONSTRAINT chk_door_code_use_cap CHECK (use_cap BETWEEN 1 AND 500),
                CONSTRAINT chk_door_code_role CHECK (role IN ('can_view', 'can_check_in'))
            )
            SQL);
        $this->addSql('CREATE INDEX idx_door_code_event ON door_codes (event_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_door_code_code ON door_codes (code)');
        $this->addSql('CREATE INDEX IDX_14377D6E90B9D269 ON door_codes (made_by_id)');
        $this->addSql('ALTER TABLE door_codes ADD CONSTRAINT FK_14377D6E71F7E88B FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE door_codes ADD CONSTRAINT FK_14377D6E90B9D269 FOREIGN KEY (made_by_id) REFERENCES users (id) ON DELETE SET NULL NOT DEFERRABLE');

        $this->addSql(<<<'SQL'
            CREATE TABLE door_code_redemptions (
                id           UUID NOT NULL,
                door_code_id UUID NOT NULL,
                user_id      UUID NOT NULL,
                name         VARCHAR(720) NOT NULL,
                created_at   TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at   TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_door_code_redemption ON door_code_redemptions (door_code_id, user_id)');
        $this->addSql('CREATE INDEX idx_door_code_redemption_user ON door_code_redemptions (user_id)');
        $this->addSql('CREATE INDEX IDX_17CA68E85BA4874B ON door_code_redemptions (door_code_id)');
        $this->addSql('ALTER TABLE door_code_redemptions ADD CONSTRAINT FK_17CA68E85BA4874B FOREIGN KEY (door_code_id) REFERENCES door_codes (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE door_code_redemptions ADD CONSTRAINT FK_17CA68E8A76ED395 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE');

        $this->addSql('ALTER TABLE event_people ADD door_code_id UUID DEFAULT NULL');
        $this->addSql('CREATE INDEX IDX_1A8F1D745BA4874B ON event_people (door_code_id)');
        $this->addSql('ALTER TABLE event_people ADD CONSTRAINT FK_1A8F1D745BA4874B FOREIGN KEY (door_code_id) REFERENCES door_codes (id) ON DELETE SET NULL NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE event_people DROP door_code_id');
        $this->addSql('DROP TABLE door_code_redemptions');
        $this->addSql('DROP TABLE door_codes');
    }
}
