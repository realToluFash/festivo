<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Tests\FunctionalTestCase;
use Doctrine\DBAL\DriverManager;
use PHPUnit\Framework\Attributes\Test;
use Psl\Iter;
use Psl\Json;
use Psl\Str;
use Psl\Type;
use Psl\Vec;

/** Two hosts seating at the same moment, each in its own process (sc-4013): one wins, a party sits whole or not at all, and no chair or guest is ever counted twice. */
final class SeatingRaceTest extends FunctionalTestCase
{
    private const string SETUP = __DIR__ . '/../Fixtures/Concurrency/seat-race-setup.php';

    private const string SEAT = __DIR__ . '/../Fixtures/Concurrency/seat-race.php';

    /** @var list<array{userId: string, organisationId: string, eventId: string}> */
    private static array $made = [];

    protected function tearDown(): void
    {
        $elsewhere = DriverManager::getConnection(self::em()->getConnection()->getParams());

        foreach (self::$made as $made) {
            $notifications = 'SELECT id FROM scheduled_notifications WHERE organisation_id = :organisation OR audience -> \'conditions\' ->> \'address\' IN (SELECT address FROM email_addresses WHERE user_id = :user)';
            $ids = ['organisation' => $made['organisationId'], 'user' => $made['userId'], 'event' => $made['eventId']];
            $elsewhere->executeStatement('DELETE FROM notification_deliveries WHERE event_id = :event OR scheduled_notification_id IN (' . $notifications . ')', $ids);
            $elsewhere->executeStatement('DELETE FROM scheduled_notifications WHERE id IN (' . $notifications . ')', $ids);
            $elsewhere->executeStatement('DELETE FROM audit_entries WHERE actor_id = ? OR subject_id IN (?, ?, ?)', [$made['userId'], $made['userId'], $made['organisationId'], $made['eventId']]);
            $elsewhere->executeStatement('DELETE FROM organisations WHERE id = ?', [$made['organisationId']]);
            $elsewhere->executeStatement('DELETE FROM users WHERE id = ?', [$made['userId']]);
        }
        self::$made = [];
        $elsewhere->close();
        parent::tearDown();
    }

    #[Test]
    public function twoGuestsSentToOneChairTogetherSeatOneAndTellTheOtherItWasTaken(): void
    {
        $plan = self::setUpPlan(10, [0, 0]);

        $answers = self::race(Vec\map($plan['guests'], static fn (string $guest): array => [$plan, $guest, 1]));

        self::assertSame(['200', '409 https://soirely.com/errors/seating_seat_taken'], $answers);
        self::assertSame(1, self::seatedAt($plan['tableId']));
    }

    #[Test]
    public function twoPartiesRacingForATableWithRoomForOneSeatOneWholeAndNoneOfTheOther(): void
    {
        $plan = self::setUpPlan(3, [1, 1]);

        $answers = self::race(Vec\map($plan['guests'], static fn (string $guest): array => [$plan, $guest, 0]));

        self::assertSame(['200', '409 https://soirely.com/errors/seating_table_short'], $answers);
        self::assertSame(2, self::seatedAt($plan['tableId']));
    }

    /**
     * @param list<int> $companions each guest's
     *
     * @return array{token: string, userId: string, organisationId: string, eventId: string, tableId: string, guests: list<string>}
     */
    private static function setUpPlan(int $seats, array $companions): array
    {
        $out = \shell_exec(\escapeshellcmd('php ' . self::SETUP . ' ' . $seats . ' ' . Str\join(Vec\map($companions, static fn (int $n): string => (string) $n), ',')) . ' 2>/dev/null');

        $plan = Type\shape(['token' => Type\string(), 'userId' => Type\string(), 'organisationId' => Type\string(), 'eventId' => Type\string(), 'tableId' => Type\string(), 'guests' => Type\vec(Type\string())])->coerce(Json\decode((string) $out));
        self::$made[] = ['userId' => $plan['userId'], 'organisationId' => $plan['organisationId'], 'eventId' => $plan['eventId']];

        return $plan;
    }

    /**
     * @param list<array{0: array{token: string, userId: string, organisationId: string, eventId: string, tableId: string, guests: list<string>}, 1: string, 2: int}> $attempts
     *
     * @return list<string> each answer, sorted
     */
    private static function race(array $attempts): array
    {
        // Long enough for every process to boot its kernel before the instant they all seat at.
        $startAt = (string) (\microtime(true) + 15);
        $processes = Vec\map($attempts, static fn (array $attempt): array => self::start($startAt, $attempt[0]['token'], $attempt[0]['eventId'], $attempt[0]['tableId'], $attempt[1], (string) $attempt[2]));

        $answers = Vec\map($processes, static function (array $process): string {
            [$handle, $pipes] = $process;
            $out = Str\trim((string) \stream_get_contents($pipes[1]));
            \fclose($pipes[1]);
            \proc_close($handle);

            return $out;
        });

        self::assertFalse(Iter\contains($answers, 'late'), 'a process missed the instant, so the requests were not parallel');

        return Vec\sort($answers);
    }

    /** @return array{0: resource, 1: array<int, resource>} */
    private static function start(string ...$arguments): array
    {
        $handle = \proc_open(['php', self::SEAT, ...$arguments], [1 => ['pipe', 'w'], 2 => ['file', '/dev/null', 'w']], $pipes);
        self::assertIsResource($handle);

        return [$handle, $pipes];
    }

    private static function seatedAt(string $table): int
    {
        return Type\int()->coerce(self::em()->getConnection()->fetchOne('SELECT count(*) FROM seat_assignments WHERE place_id = ?', [$table]));
    }
}
