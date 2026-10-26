<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Domain\Organisation\OrganisationFounder;
use App\Domain\User\UserRegistrar;
use App\Entity\Event;
use App\Entity\Organisation;
use App\Enum\EventType;
use App\Repository\EventRepository;
use App\Tests\ApiTestCase;
use App\Tests\Traits\OnboardsAccounts;
use DateTimeImmutable;
use DateTimeZone;
use Doctrine\DBAL\Connection;
use LogicException;
use PHPUnit\Framework\Attributes\Test;
use Psl\Vec;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Component\Clock\Test\ClockSensitiveTrait;
use Symfony\Component\Console\Tester\CommandTester;

/** A stale UTC copy is written straight to the row, as a tzdata change would leave it. The entity manager is cleared after each write, as the command runs in its own process. */
final class EventTimesRecomputeTest extends ApiTestCase
{
    use ClockSensitiveTrait;
    use OnboardsAccounts;

    /** @mago-expect lint:no-literal-password */
    private const string PASSWORD = 'a decent passphrase';

    /** `xmin` moves on any update, even one that rewrites the same values within the same second. */
    private const string VERSIONED = 'xmin::text AS version, *';

    private const string ROWS = 'SELECT ' . self::VERSIONED . ' FROM events ORDER BY id';

    private Organisation $organisation;

    protected function setUp(): void
    {
        parent::setUp();
        self::mockTime('2026-10-24 12:00:00');
        $owner = self::service(UserRegistrar::class)->register('owner@ire.events', 'Person', self::PASSWORD)->user;
        self::onboard($owner, withOrganisation: false);
        $this->organisation = self::service(OrganisationFounder::class)->found($owner, 'Ìrè Events', 'NG', 'Africa/Lagos');
        self::em()->flush();
    }

    #[Test]
    public function anEventNotYetOverIsRecomputedFromItsLocalTimes(): void
    {
        $id = $this->event('Owambe', '2026-11-14 16:00', '2026-11-15 02:00', 'Europe/Madrid');
        $this->staleBy($id, '3 hours');

        self::assertStringContainsString('Recomputed the UTC times of 1 events.', $this->recompute());
        self::assertSame(
            ['starts_at' => '2026-11-14 16:00:00', 'starts_at_utc' => '2026-11-14 15:00:00', 'ends_at_utc' => '2026-11-15 01:00:00', 'closes_at' => '2026-11-15 01:00:00'],
            $this->row($id, 'starts_at, starts_at_utc, ends_at_utc, closes_at'),
        );
    }

    #[Test]
    public function aWallClockTimeInsideAGapKeepsWhatTheHostEnteredAndTakesTheOffsetFromBeforeIt(): void
    {
        $id = $this->event('Madrugada', '2027-03-27 20:00', '2027-03-28 05:00', 'Europe/Madrid');
        self::service(Connection::class)->executeStatement(
            "UPDATE events SET starts_at = '2027-03-28 02:30:00', starts_at_utc = '2027-03-28 04:30:00', ends_at_utc = '2027-03-28 06:00:00' WHERE id = :id",
            ['id' => $id],
        );
        self::em()->clear();

        self::assertStringContainsString('Recomputed the UTC times of 1 events.', $this->recompute());
        self::assertSame(
            ['starts_at' => '2027-03-28 02:30:00', 'ends_at' => '2027-03-28 05:00:00', 'time_zone' => 'Europe/Madrid', 'starts_at_utc' => '2027-03-28 01:30:00', 'ends_at_utc' => '2027-03-28 03:00:00'],
            $this->row($id, 'starts_at, ends_at, time_zone, starts_at_utc, ends_at_utc'),
        );
    }

    #[Test]
    public function aDryRunCountsWhatWouldChangeAndWritesNothing(): void
    {
        $this->staleBy($this->event('Owambe', '2026-11-14 16:00', '2026-11-15 02:00', 'Europe/Madrid'), '3 hours');
        $before = self::service(Connection::class)->fetchAllAssociative(self::ROWS);

        self::assertStringContainsString('Would recompute the UTC times of 1 events.', $this->recompute(['--dry-run' => true]));
        self::assertSame($before, self::service(Connection::class)->fetchAllAssociative(self::ROWS));
    }

    #[Test]
    public function aSecondRunChangesNothing(): void
    {
        $this->staleBy($this->event('Owambe', '2026-11-14 16:00', '2026-11-15 02:00', 'Europe/Madrid'), '3 hours');
        $this->recompute();
        $after = self::service(Connection::class)->fetchAllAssociative(self::ROWS);

        self::assertStringContainsString('Recomputed the UTC times of 0 events.', $this->recompute());
        self::assertSame($after, self::service(Connection::class)->fetchAllAssociative(self::ROWS));
    }

    #[Test]
    public function anEventAlreadyOverIsUntouched(): void
    {
        $id = $this->event('Last week', '2026-10-17 16:00', '2026-10-17 22:00', 'Europe/Madrid');
        $this->staleBy($id, '3 hours');
        $stale = $this->row($id, self::VERSIONED);

        self::assertStringContainsString('Recomputed the UTC times of 0 events.', $this->recompute());
        self::assertSame($stale, $this->row($id, self::VERSIONED));
    }

    #[Test]
    public function anEventEndedEarlyIsUntouchedAndKeepsWhenItEnded(): void
    {
        $id = $this->event('Cut short', '2026-10-24 10:00', '2026-11-01 22:00', 'Europe/Madrid');
        $this->staleBy($id, '3 hours');
        self::service(Connection::class)->executeStatement("UPDATE events SET ended_at = '2026-10-24 11:00:00' WHERE id = :id", ['id' => $id]);
        $ended = $this->row($id, self::VERSIONED);

        $this->recompute();

        self::assertSame($ended, $this->row($id, self::VERSIONED));
        self::assertSame(['ended_at' => '2026-10-24 11:00:00'], $this->row($id, 'ended_at'));
    }

    #[Test]
    public function withTzdataUnchangedNothingMovesAndTheOrderHolds(): void
    {
        $this->event('Later', '2026-12-01 10:00', '2026-12-01 12:00', 'Africa/Lagos');
        $this->event('In Madrid, an hour earlier', '2026-11-14 16:00', '2026-11-14 18:00', 'Europe/Madrid');
        $this->event('Alpha', '2026-11-14 16:00', '2026-11-14 18:00', 'Africa/Lagos');
        $before = self::service(Connection::class)->fetchAllAssociative(self::ROWS);

        self::assertStringContainsString('Recomputed the UTC times of 0 events.', $this->recompute());
        self::assertSame($before, self::service(Connection::class)->fetchAllAssociative(self::ROWS));
        self::assertSame(['Alpha', 'In Madrid, an hour earlier', 'Later'], $this->listed());
    }

    private function event(string $name, string $startsAt, string $endsAt, string $zone): string
    {
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');
        $event = new Event(
            $organisation,
            $name,
            EventType::Other,
            new DateTimeImmutable($startsAt, new DateTimeZone($zone)),
            new DateTimeImmutable($endsAt, new DateTimeZone($zone)),
            'EUR',
        );
        self::em()->persist($event);
        self::em()->flush();
        self::em()->clear();

        return $event->getId()->toRfc4122();
    }

    private function staleBy(string $id, string $shift): void
    {
        self::service(Connection::class)->executeStatement(
            "UPDATE events SET starts_at_utc = starts_at_utc - INTERVAL '" . $shift . "', ends_at_utc = ends_at_utc - INTERVAL '" . $shift . "' WHERE id = :id",
            ['id' => $id],
        );
        self::em()->clear();
    }

    /** @return array<string, mixed> */
    private function row(string $id, string $columns): array
    {
        return self::service(Connection::class)->fetchAssociative('SELECT ' . $columns . ' FROM events WHERE id = :id', ['id' => $id]) ?: self::fail('no event');
    }

    /** @return list<string> */
    private function listed(): array
    {
        $organisation = self::em()->find(Organisation::class, $this->organisation->getId()) ?? self::fail('no organisation');

        return Vec\map(self::service(EventRepository::class)->findInOrganisation($organisation), static fn (Event $event): string => $event->getName());
    }

    /** @param array<string, mixed> $input */
    private function recompute(array $input = []): string
    {
        $application = new Application(self::$kernel ?? throw new LogicException('No kernel.'));
        $tester = new CommandTester($application->find('app:recompute-event-times'));
        $tester->execute($input);
        $tester->assertCommandIsSuccessful();

        return $tester->getDisplay();
    }
}
