<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Tests\FunctionalTestCase;
use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\DependencyFactory;
use Doctrine\Migrations\Version\Version;
use PHPUnit\Framework\Attributes\Test;
use Psl\Type;
use Symfony\Component\Uid\Uuid;

final class SuggestedJobsLanguageTest extends FunctionalTestCase
{
    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    private const string MIGRATION = 'DoctrineMigrations\Version20261119100000';

    private string $organisation;

    #[Test]
    public function anEventFromBeforeTheStoryTakesItsOrganisationsLanguage(): void
    {
        $event = $this->event('2026-11-01 10:00:00');
        $this->job($event, 'Floor lead', 'floor lead');
        $this->job($event, 'Waiter', 'waiter');

        $this->migrate();

        self::assertSame(['Camarero/a', 'Responsable de sala'], $this->names($event));
    }

    #[Test]
    public function aRenamedJobKeepsItsName(): void
    {
        $event = $this->event('2026-11-01 10:00:00');
        $this->job($event, 'Head waiter', 'head waiter');

        $this->migrate();

        self::assertSame(['Head waiter'], $this->names($event));
    }

    #[Test]
    public function aJobWhoseTranslatedNameTheEventHasKeepsItsEnglishName(): void
    {
        $event = $this->event('2026-11-01 10:00:00');
        $this->job($event, 'Door', 'door');
        $this->job($event, 'PUERTA', 'puerta');

        $this->migrate();

        self::assertSame(['Door', 'PUERTA'], $this->names($event));
    }

    #[Test]
    public function anEventSeededAsItWasCreatedIsLeftAsItIs(): void
    {
        $event = $this->event(null);
        $this->job($event, 'Waiter', 'waiter');

        $this->migrate();

        self::assertSame(['Waiter'], $this->names($event));
    }

    protected function setUp(): void
    {
        parent::setUp();

        $owner = self::service(UserRegistrar::class)->register('owner@ire.events', 'Folake', self::PASSWORD)->user;
        self::em()->flush();
        $organisation = self::service(OrganisationFounder::class)->found($owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
        $this->organisation = $organisation->getId()->toRfc4122();
        self::em()->getConnection()->executeStatement("UPDATE organisations SET locale = 'es' WHERE id = :id", ['id' => $this->organisation]);
    }

    private function event(?string $createdAt): string
    {
        $id = Uuid::v7()->toRfc4122();
        self::em()->getConnection()->executeStatement(<<<'SQL'
            INSERT INTO events (id, organisation_id, name, type, status, starts_at, ends_at, time_zone, starts_at_utc, ends_at_utc, currency, created_at, updated_at)
            VALUES (:id, :organisation, 'Owambe', 'other', 'draft', '2026-11-14 16:00:00', '2026-11-15 02:00:00', 'Africa/Lagos', '2026-11-14 15:00:00', '2026-11-15 01:00:00', 'NGN', COALESCE(CAST(:created AS TIMESTAMP), NOW()), NOW())
            SQL, ['id' => $id, 'organisation' => $this->organisation, 'created' => $createdAt]);

        return $id;
    }

    private function job(string $event, string $name, string $key): void
    {
        self::em()->getConnection()->executeStatement(<<<'SQL'
            INSERT INTO staff_jobs (id, event_id, name, name_key, access, position, created_at, updated_at)
            VALUES (:id, :event, :name, :key, 'view', 0, NOW(), NOW())
            SQL, ['id' => Uuid::v7()->toRfc4122(), 'event' => $event, 'name' => $name, 'key' => $key]);
    }

    /** @return list<string> */
    private function names(string $event): array
    {
        return Type\vec(Type\string())->coerce(
            self::em()->getConnection()->fetchFirstColumn('SELECT name FROM staff_jobs WHERE event_id = :event ORDER BY name', ['event' => $event]),
        );
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
