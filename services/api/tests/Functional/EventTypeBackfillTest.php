<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Event;
use App\Enum\EventType;
use App\Tests\FunctionalTestCase;
use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\DependencyFactory;
use Doctrine\Migrations\Version\Version;
use PHPUnit\Framework\Attributes\Test;
use Symfony\Component\Uid\Uuid;

final class EventTypeBackfillTest extends FunctionalTestCase
{
    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string MIGRATION = 'DoctrineMigrations\Version20261026120000';

    #[Test]
    public function anEventFromBeforeTheTypeBecomesOther(): void
    {
        $owner = self::service(UserRegistrar::class)->register('owner@ire.events', 'Folake', self::PASSWORD)->user;
        self::em()->flush();
        $organisation = self::service(OrganisationFounder::class)->found($owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $connection = self::em()->getConnection();
        $id = Uuid::v7()->toRfc4122();

        $connection->executeStatement('ALTER TABLE events DROP type');
        $connection->executeStatement(<<<'SQL'
            INSERT INTO events (id, organisation_id, name, status, starts_at, ends_at, time_zone, starts_at_utc, ends_at_utc, currency, created_at, updated_at)
            VALUES (:id, :organisation, 'Owambe', 'draft', '2026-11-14 16:00:00', '2026-11-15 02:00:00', 'Africa/Lagos', '2026-11-14 15:00:00', '2026-11-15 01:00:00', 'NGN', NOW(), NOW())
            SQL, ['id' => $id, 'organisation' => $organisation->getId()->toRfc4122()]);
        $this->migrate();

        self::assertSame(EventType::Other, self::em()->find(Event::class, $id)?->getType());
    }

    private function migrate(): void
    {
        $factory = self::serviceById('doctrine.migrations.dependency_factory', DependencyFactory::class);
        $migration = $factory->getMigrationRepository()->getMigration(new Version(self::MIGRATION))->getMigration();
        $migration->up(new Schema());

        foreach ($migration->getSql() as $query) {
            self::em()->getConnection()->executeStatement($query->getStatement());
        }

        self::em()->clear();
    }
}
