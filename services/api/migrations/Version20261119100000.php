<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;
use RuntimeException;

final class Version20261119100000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'The suggested jobs Version20261118220000 seeded in English take their organisation\'s language (sc-3908).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
            UPDATE staff_jobs j
            SET    name = s.name, name_key = s.name_key, updated_at = NOW()
            FROM   events e
            JOIN   organisations o ON o.id = e.organisation_id
            JOIN   (VALUES
                ('es', 'Floor lead',  'Responsable de sala',   'responsable de sala'),
                ('es', 'Waiter',      'Camarero/a',            'camarero/a'),
                ('es', 'Bar',         'Barra',                 'barra'),
                ('es', 'Door',        'Puerta',                'puerta'),
                ('es', 'Kitchen',     'Cocina',                'cocina'),
                ('es', 'Security',    'Seguridad',             'seguridad'),
                ('es', 'Sound',       'Sonido',                'sonido'),
                ('es', 'MC',          'Presentador/a',         'presentador/a'),
                ('fr', 'Floor lead',  'Maître d’hôtel',        'maitre d’hotel'),
                ('fr', 'Waiter',      'Chef de rang',          'chef de rang'),
                ('fr', 'Runner',      'Commis de salle',       'commis de salle'),
                ('fr', 'Door',        'Accueil',               'accueil'),
                ('fr', 'Kitchen',     'Cuisine',               'cuisine'),
                ('fr', 'Security',    'Sécurité',              'securite'),
                ('fr', 'Sound',       'Son',                   'son'),
                ('fr', 'MC',          'Animation',             'animation'),
                ('pt', 'Floor lead',  'Chefe de sala',         'chefe de sala'),
                ('pt', 'Waiter',      'Empregado/a de mesa',   'empregado/a de mesa'),
                ('pt', 'Door',        'Entrada',               'entrada'),
                ('pt', 'Kitchen',     'Cozinha',               'cozinha'),
                ('pt', 'Security',    'Segurança',             'seguranca'),
                ('pt', 'Sound',       'Som',                   'som'),
                ('pt', 'MC',          'Apresentador/a',        'apresentador/a')
            ) AS s (locale, english, name, name_key)
                   ON s.locale = split_part(lower(replace(o.locale, '_', '-')), '-', 1)
            WHERE  j.event_id = e.id
              AND  j.name = s.english
              AND  j.created_at > e.created_at + INTERVAL '1 minute'
              AND  NOT EXISTS (
                       SELECT 1 FROM staff_jobs taken
                       WHERE  taken.event_id = j.event_id AND taken.name_key = s.name_key
                   )
            SQL);
    }

    public function down(Schema $schema): void
    {
        throw new RuntimeException('The renamed jobs cannot be told from ones an organiser has since named the same.');
    }
}
