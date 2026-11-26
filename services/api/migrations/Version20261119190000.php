<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261119190000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Stations on an event (sc-3910): places and sections, each person\'s station, the floor lead, which place dishes each item, and the walking order; every event starts with the suggested places in its organisation\'s language.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            CREATE TABLE staff_stations (
                id             UUID NOT NULL,
                event_id       UUID NOT NULL,
                kind           VARCHAR(16) NOT NULL,
                name           VARCHAR(240) NOT NULL,
                name_key       VARCHAR(240) NOT NULL,
                section_id     UUID DEFAULT NULL,
                lead_id        UUID DEFAULT NULL,
                position       INT NOT NULL,
                walk_position  INT DEFAULT NULL,
                created_at     TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at     TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_staff_station_section ON staff_stations (section_id)');
        $this->addSql('CREATE INDEX IDX_85A9D54771F7E88B ON staff_stations (event_id)');
        $this->addSql('CREATE INDEX IDX_85A9D54755458D ON staff_stations (lead_id)');
        $this->addSql('ALTER TABLE staff_stations ADD CONSTRAINT FK_85A9D54771F7E88B FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE staff_stations ADD CONSTRAINT FK_85A9D547D823E37A FOREIGN KEY (section_id) REFERENCES seating_sections (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql('ALTER TABLE staff_stations ADD CONSTRAINT FK_85A9D54755458D FOREIGN KEY (lead_id) REFERENCES staff_members (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql(<<<'SQL'
            CREATE TABLE staff_item_stations (
                id          UUID NOT NULL,
                course_id   UUID NOT NULL,
                item_key    VARCHAR(240) NOT NULL,
                station_id  UUID NOT NULL,
                created_at  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                updated_at  TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL,
                PRIMARY KEY (id)
            )
            SQL);
        $this->addSql('CREATE UNIQUE INDEX uniq_staff_item_station ON staff_item_stations (course_id, item_key)');
        $this->addSql('CREATE INDEX IDX_8816C04A591CC992 ON staff_item_stations (course_id)');
        $this->addSql('CREATE INDEX IDX_8816C04A21BDB235 ON staff_item_stations (station_id)');
        $this->addSql('ALTER TABLE staff_item_stations ADD CONSTRAINT FK_8816C04A591CC992 FOREIGN KEY (course_id) REFERENCES menu_courses (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE staff_item_stations ADD CONSTRAINT FK_8816C04A21BDB235 FOREIGN KEY (station_id) REFERENCES staff_stations (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE staff_members ADD station_id UUID DEFAULT NULL');
        $this->addSql('ALTER TABLE staff_members ADD as_well_station_id UUID DEFAULT NULL');
        $this->addSql('ALTER TABLE staff_members ADD floor_lead BOOLEAN DEFAULT false NOT NULL');
        $this->addSql('CREATE INDEX IDX_1916C54921BDB235 ON staff_members (station_id)');
        $this->addSql('CREATE INDEX IDX_1916C5491B5C0E2A ON staff_members (as_well_station_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_staff_floor_lead ON staff_members (event_id) WHERE floor_lead');
        $this->addSql('ALTER TABLE staff_members ADD CONSTRAINT FK_1916C54921BDB235 FOREIGN KEY (station_id) REFERENCES staff_stations (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql('ALTER TABLE staff_members ADD CONSTRAINT FK_1916C5491B5C0E2A FOREIGN KEY (as_well_station_id) REFERENCES staff_stations (id) ON DELETE SET NULL NOT DEFERRABLE');
        $this->addSql(<<<'SQL'
            INSERT INTO staff_stations (id, event_id, kind, name, name_key, position, created_at, updated_at)
            SELECT gen_random_uuid(), e.id, s.kind, s.name, s.name_key, s.position, NOW(), NOW()
            FROM   events e
            JOIN   organisations o ON o.id = e.organisation_id
            JOIN   (VALUES
                ('en', 'pass',  'Pass',      'pass',      0),
                ('en', 'place', 'Door',      'door',      1),
                ('en', 'place', 'Bar',       'bar',       2),
                ('en', 'place', 'Kitchen',   'kitchen',   3),
                ('en', 'place', 'Stage',     'stage',     4),
                ('en', 'place', 'Floor',     'floor',     5),
                ('es', 'pass',  'Pase',      'pase',      0),
                ('es', 'place', 'Puerta',    'puerta',    1),
                ('es', 'place', 'Barra',     'barra',     2),
                ('es', 'place', 'Cocina',    'cocina',    3),
                ('es', 'place', 'Escenario', 'escenario', 4),
                ('es', 'place', 'Sala',      'sala',      5),
                ('fr', 'pass',  'Passe',     'passe',     0),
                ('fr', 'place', 'Accueil',   'accueil',   1),
                ('fr', 'place', 'Bar',       'bar',       2),
                ('fr', 'place', 'Cuisine',   'cuisine',   3),
                ('fr', 'place', 'Scène',     'scene',     4),
                ('fr', 'place', 'Salle',     'salle',     5),
                ('pt', 'pass',  'Passe',     'passe',     0),
                ('pt', 'place', 'Entrada',   'entrada',   1),
                ('pt', 'place', 'Bar',       'bar',       2),
                ('pt', 'place', 'Cozinha',   'cozinha',   3),
                ('pt', 'place', 'Palco',     'palco',     4),
                ('pt', 'place', 'Sala',      'sala',      5)
            ) AS s (locale, kind, name, name_key, position)
                   ON s.locale = CASE
                       WHEN split_part(lower(replace(o.locale, '_', '-')), '-', 1) IN ('es', 'fr', 'pt')
                       THEN split_part(lower(replace(o.locale, '_', '-')), '-', 1)
                       ELSE 'en'
                   END
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE staff_members DROP CONSTRAINT FK_1916C54921BDB235');
        $this->addSql('ALTER TABLE staff_members DROP CONSTRAINT FK_1916C5491B5C0E2A');
        $this->addSql('DROP INDEX uniq_staff_floor_lead');
        $this->addSql('DROP INDEX IDX_1916C54921BDB235');
        $this->addSql('DROP INDEX IDX_1916C5491B5C0E2A');
        $this->addSql('ALTER TABLE staff_members DROP floor_lead');
        $this->addSql('ALTER TABLE staff_members DROP station_id');
        $this->addSql('ALTER TABLE staff_members DROP as_well_station_id');
        $this->addSql('DROP TABLE staff_item_stations');
        $this->addSql('DROP TABLE staff_stations');
    }
}
