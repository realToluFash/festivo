<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261116120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Each limited text holds its limit in letters as a reader counts them, up to four code points each (sc-54292). Widening only: nothing saved is rewritten.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE seating_plans ALTER room_name TYPE VARCHAR(240)');
        $this->addSql('ALTER TABLE seating_sections ALTER name TYPE VARCHAR(160)');
        $this->addSql('ALTER TABLE seating_rows ALTER label TYPE VARCHAR(40)');
        $this->addSql('ALTER TABLE seating_seats ALTER name TYPE VARCHAR(120)');
        $this->addSql('ALTER TABLE events ALTER name TYPE VARCHAR(480)');
        $this->addSql('ALTER TABLE events ALTER venue_name TYPE VARCHAR(480)');
        $this->addSql('ALTER TABLE events ALTER venue_address TYPE VARCHAR(1200)');
        $this->addSql('ALTER TABLE guest_groups ALTER name TYPE VARCHAR(240)');
        $this->addSql('ALTER TABLE staff_members ALTER full_name TYPE VARCHAR(800)');
        $this->addSql('ALTER TABLE event_people ALTER job_label TYPE VARCHAR(240)');
        $this->addSql('ALTER TABLE organisations ALTER name TYPE VARCHAR(400)');
        $this->addSql('ALTER TABLE users ALTER name TYPE VARCHAR(720)');
        $this->addSql('ALTER TABLE guests ALTER full_name TYPE VARCHAR(800)');
        $this->addSql('ALTER TABLE guests ALTER other_allergy TYPE VARCHAR(400)');
        $this->addSql('ALTER TABLE guests ALTER other_diet TYPE VARCHAR(400)');
        $this->addSql('ALTER TABLE guests ALTER other_access TYPE VARCHAR(400)');
        $this->addSql('ALTER TABLE event_covers ALTER description TYPE VARCHAR(1000)');
        $this->addSql('ALTER TABLE schedule_items ALTER title TYPE VARCHAR(480)');
        $this->addSql('ALTER TABLE schedule_items ALTER place TYPE VARCHAR(240)');
        $this->addSql('ALTER TABLE schedule_items ALTER owner_name TYPE VARCHAR(480)');
        $this->addSql('ALTER TABLE schedule_items ALTER owner_role TYPE VARCHAR(160)');
        $this->addSql('ALTER TABLE schedule_items ALTER note TYPE VARCHAR(2000)');
        $this->addSql('ALTER TABLE audit_entries ALTER actor_label TYPE VARCHAR(720)');
        $this->addSql('ALTER TABLE assistant_interactions ALTER actor_label TYPE VARCHAR(720)');
        $this->addSql('ALTER TABLE memberships ALTER request_message TYPE VARCHAR(2000)');
        $this->addSql('ALTER TABLE invitations ALTER organisation_name TYPE VARCHAR(400)');
        $this->addSql('ALTER TABLE pending_registrations ALTER name TYPE VARCHAR(720)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE seating_plans ALTER room_name TYPE VARCHAR(60)');
        $this->addSql('ALTER TABLE seating_sections ALTER name TYPE VARCHAR(40)');
        $this->addSql('ALTER TABLE seating_rows ALTER label TYPE VARCHAR(10)');
        $this->addSql('ALTER TABLE seating_seats ALTER name TYPE VARCHAR(30)');
        $this->addSql('ALTER TABLE events ALTER name TYPE VARCHAR(120)');
        $this->addSql('ALTER TABLE events ALTER venue_name TYPE VARCHAR(120)');
        $this->addSql('ALTER TABLE events ALTER venue_address TYPE VARCHAR(300)');
        $this->addSql('ALTER TABLE guest_groups ALTER name TYPE VARCHAR(60)');
        $this->addSql('ALTER TABLE staff_members ALTER full_name TYPE VARCHAR(200)');
        $this->addSql('ALTER TABLE event_people ALTER job_label TYPE VARCHAR(60)');
        $this->addSql('ALTER TABLE organisations ALTER name TYPE VARCHAR(100)');
        $this->addSql('ALTER TABLE users ALTER name TYPE VARCHAR(180)');
        $this->addSql('ALTER TABLE guests ALTER full_name TYPE VARCHAR(200)');
        $this->addSql('ALTER TABLE guests ALTER other_allergy TYPE VARCHAR(100)');
        $this->addSql('ALTER TABLE guests ALTER other_diet TYPE VARCHAR(100)');
        $this->addSql('ALTER TABLE guests ALTER other_access TYPE VARCHAR(100)');
        $this->addSql('ALTER TABLE event_covers ALTER description TYPE VARCHAR(250)');
        $this->addSql('ALTER TABLE schedule_items ALTER title TYPE VARCHAR(120)');
        $this->addSql('ALTER TABLE schedule_items ALTER place TYPE VARCHAR(60)');
        $this->addSql('ALTER TABLE schedule_items ALTER owner_name TYPE VARCHAR(120)');
        $this->addSql('ALTER TABLE schedule_items ALTER owner_role TYPE VARCHAR(40)');
        $this->addSql('ALTER TABLE schedule_items ALTER note TYPE VARCHAR(500)');
        $this->addSql('ALTER TABLE audit_entries ALTER actor_label TYPE VARCHAR(180)');
        $this->addSql('ALTER TABLE assistant_interactions ALTER actor_label TYPE VARCHAR(180)');
        $this->addSql('ALTER TABLE memberships ALTER request_message TYPE VARCHAR(500)');
        $this->addSql('ALTER TABLE invitations ALTER organisation_name TYPE VARCHAR(100)');
        $this->addSql('ALTER TABLE pending_registrations ALTER name TYPE VARCHAR(255)');
    }
}
