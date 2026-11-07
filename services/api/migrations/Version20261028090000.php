<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20261028090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'A trigger keeps an exact moment apart from a caller\'s calendar day, which follows the event\'s zone (sc-17127).';
    }

    public function up(Schema $schema): void
    {
        // Trigger::at wrote a date anchor at PT0S with no time of day; any other date row was a caller's day.
        $this->addSql(<<<'SQL'
            UPDATE scheduled_notifications
            SET    trigger = jsonb_build_object('anchor', 'moment', 'moment', trigger->>'date', 'day', NULL, 'offset', 'PT0S', 'timeOfDay', NULL)
            WHERE  trigger->>'anchor' = 'date'
              AND  trigger->>'offset' = 'PT0S'
              AND  trigger->>'timeOfDay' IS NULL
            SQL);
        $this->addSql(<<<'SQL'
            UPDATE scheduled_notifications
            SET    trigger = jsonb_build_object('anchor', 'date', 'moment', NULL, 'day', LEFT(trigger->>'date', 10), 'offset', trigger->>'offset', 'timeOfDay', trigger->>'timeOfDay')
            WHERE  trigger->>'anchor' = 'date'
            SQL);
        $this->addSql(<<<'SQL'
            UPDATE scheduled_notifications
            SET    trigger = (trigger - 'date') || jsonb_build_object('moment', NULL, 'day', NULL)
            WHERE  trigger->>'anchor' IN ('event_start', 'event_end')
            SQL);
    }

    public function down(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            UPDATE scheduled_notifications
            SET trigger = jsonb_build_object(
                'anchor',    CASE WHEN trigger->>'anchor' = 'moment' THEN 'date' ELSE trigger->>'anchor' END,
                'date',      COALESCE(trigger->>'moment', CASE WHEN trigger->>'day' IS NOT NULL THEN (trigger->>'day') || 'T00:00:00+00:00' END),
                'offset',    trigger->>'offset',
                'timeOfDay', trigger->>'timeOfDay'
            )
            SQL);
    }
}
